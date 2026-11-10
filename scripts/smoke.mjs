// スモークテスト：サーバー応答・JS 構文・import 解決先の存在・オンラインのルーム中継を確認する
// 使い方: npm run smoke            （全ゲーム）
//         npm run smoke -- rpg      （指定スラッグのみ。複数可）
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALL_SLUGS = ['rpg', 'space', 'sports', 'thief', 'farm'];

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const unknown = args.filter((s) => !ALL_SLUGS.includes(s));
if (unknown.length) {
  console.error(`不明なスラッグ: ${unknown.join(', ')}（使えるもの: ${ALL_SLUGS.join(', ')}）`);
  process.exit(1);
}
const slugs = args.length ? args : ALL_SLUGS;

const errors = [];
let passed = 0;
const ok = (msg) => { passed++; console.log(`  OK  ${msg}`); };
const ng = (msg) => { errors.push(msg); console.log(`  NG  ${msg}`); };

/** dir 以下の .js / .mjs を再帰的に集める */
function collectJs(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules') collectJs(p, out);
    } else if (/\.(m?js)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

/** import 指定子をざっくり抽出（静的 import／export from／動的 import の文字列リテラル） */
function extractImports(src) {
  // コメントを除去してから探す（コメント内の import 例を拾わないため）
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  const specs = new Set();
  const re = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(code))) specs.add(m[1] || m[2] || m[3]);
  return [...specs];
}

/** URL パスをサーバーの配信先ファイルに対応させる */
function urlToFile(url) {
  const map = [
    ['/vendor/three/addons/', 'node_modules/three/examples/jsm/'],
    ['/vendor/three/', 'node_modules/three/build/'],
    ['/vendor/socket.io/', 'node_modules/socket.io/client-dist/'],
    ['/shared/', 'shared/'],
    ['/games/', 'games/'],
  ];
  for (const [prefix, dir] of map) {
    if (url.startsWith(prefix)) return path.join(ROOT, dir, url.slice(prefix.length));
  }
  return path.join(ROOT, 'public', url);
}

/** importmap と同じ解決規則で指定子をファイルパスに */
function resolveSpec(spec, fromFile) {
  if (spec === 'three') return urlToFile('/vendor/three/three.module.js');
  if (spec.startsWith('three/addons/')) return urlToFile('/vendor/three/addons/' + spec.slice('three/addons/'.length));
  if (spec.startsWith('./') || spec.startsWith('../')) return path.resolve(path.dirname(fromFile), spec);
  if (spec.startsWith('/')) return urlToFile(spec);
  return null; // それ以外の素の指定子は importmap に無いので解決不能
}

async function checkHttp() {
  console.log('\n[1] HTTP 応答');
  const server = createServer().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (p) => {
    try {
      const res = await fetch(base + p);
      return { status: res.status, body: await res.text() };
    } catch (e) {
      return { status: 0, body: String(e) };
    }
  };
  try {
    const targets = ['/', '/healthz', '/vendor/three/three.module.js', '/vendor/socket.io/socket.io.esm.min.js', '/shared/engine.js', '/shared/net.js'];
    for (const t of targets) {
      const r = await get(t);
      r.status === 200 ? ok(`GET ${t} → 200`) : ng(`GET ${t} → ${r.status}`);
    }
    const api = await get('/api/games');
    let games = [];
    try { games = JSON.parse(api.body); } catch { /* 下で NG */ }
    if (api.status === 200 && Array.isArray(games)) ok(`GET /api/games → 200（${games.length} 件）`);
    else ng(`GET /api/games → ${api.status}`);

    for (const slug of slugs) {
      const r = await get(`/games/${slug}/`);
      r.status === 200 ? ok(`GET /games/${slug}/ → 200`) : ng(`GET /games/${slug}/ → ${r.status}`);
      if (r.status === 200 && !r.body.includes('"three": "/vendor/three/three.module.js"')) {
        ng(`games/${slug}/index.html に three の importmap がありません`);
      }
      const m = await get(`/games/${slug}/main.js`);
      m.status === 200 ? ok(`GET /games/${slug}/main.js → 200`) : ng(`GET /games/${slug}/main.js → ${m.status}`);
      const g = games.find((x) => x.slug === slug);
      g ? ok(`/api/games に ${slug} が含まれる`) : ng(`/api/games に ${slug} がありません（meta.json を確認）`);
      if (g) {
        for (const k of ['title', 'description', 'controls', 'order']) {
          if (g[k] === undefined || g[k] === '') ng(`games/${slug}/meta.json に ${k} がありません`);
        }
      }
    }
  } finally {
    server.close();
  }
}

function checkSyntaxAndImports() {
  console.log('\n[2] 構文チェック・import 解決');
  const files = [
    ...collectJs(path.join(ROOT, 'shared')),
    ...slugs.flatMap((s) => collectJs(path.join(ROOT, 'games', s))),
  ];
  for (const f of files) {
    const rel = path.relative(ROOT, f).replaceAll('\\', '/');
    // .js でも ESM として検査するため --input-type ではなく --check を使う（package.json の type: module が効く）
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) {
      ng(`構文エラー: ${rel}\n${(r.stderr || '').trim().split('\n').slice(0, 6).join('\n')}`);
      continue;
    }
    const specs = extractImports(readFileSync(f, 'utf8'));
    const bad = [];
    for (const s of specs) {
      const target = resolveSpec(s, f);
      if (!target) bad.push(`${s}（importmap で解決できない指定子）`);
      else if (!existsSync(target)) bad.push(`${s} → ${path.relative(ROOT, target)} が存在しない`);
    }
    if (bad.length) ng(`import 解決失敗: ${rel}\n      ${bad.join('\n      ')}`);
    else ok(`${rel}（import ${specs.length} 件）`);
  }
}

/** オンライン：shared/net.js を実際に使ってルーム作成〜参加〜中継〜ホスト交代を確認 */
async function checkOnline() {
  console.log('\n[3] オンライン（ルーム中継）');
  const server = createServer().listen(0);
  await new Promise((r) => server.once('listening', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  // ブラウザ用の ESM クライアントを Node で読み込む（client-dist は type:module でないため data URL 経由）
  const clientSrc = readFileSync(path.join(ROOT, 'node_modules/socket.io/client-dist/socket.io.esm.min.js'), 'utf8');
  const { io } = await import('data:text/javascript;base64,' + Buffer.from(clientSrc).toString('base64'));
  const { createNet } = await import('../shared/net.js');

  const wait = (fn, ms = 3000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('タイムアウト')), ms);
    fn((v) => { clearTimeout(t); resolve(v); });
  });
  const step = async (label, fn) => {
    try { await fn(); ok(label); } catch (e) { ng(`${label}：${e.message}`); throw e; }
  };
  const nets = [];
  const mk = (name) => { const n = createNet('smoke', { name, url, io }); nets.push(n); return n; };

  try {
    const a = mk('A');
    const b = mk('B');
    const c = mk('C');
    let code;
    await step('ルーム作成（ホストになる）', async () => {
      ({ code } = await a.createRoom({ maxPlayers: 2 }));
      if (!/^[A-Z0-9]{4}$/.test(code) || !a.isHost || a.players.length !== 1) throw new Error('作成結果が不正');
    });
    await step('合言葉で参加（小文字でも可）・参加通知', async () => {
      const joined = wait((done) => a.onPlayerJoin(done));
      await b.joinRoom(code.toLowerCase());
      const p = await joined;
      if (p.name !== 'B' || b.isHost || b.myIndex !== 1) throw new Error('参加結果が不正');
      await wait((done) => { if (a.players.length === 2) done(); else a.onRoomChange((r) => r.players.length === 2 && done()); });
    });
    await step('満員・存在しない合言葉は参加できない', async () => {
      const fails = async (p) => { try { await p; return false; } catch { return true; } };
      if (!(await fails(c.joinRoom(code)))) throw new Error('満員なのに参加できた');
      if (!(await fails(c.joinRoom('ZZZZZZ')))) throw new Error('無い合言葉で参加できた');
    });
    await step('全員へ中継（送信者には届かない）', async () => {
      let echoed = false;
      a.onMessage('state', () => { echoed = true; });
      const got = wait((done) => b.onMessage('state', (data, from) => done({ data, from })));
      a.send('state', { tick: 1, players: [{ x: 1 }] });
      const m = await got;
      if (m.data.tick !== 1 || m.from !== a.myId) throw new Error('受信内容が不正');
      if (echoed) throw new Error('送信者にも届いた');
    });
    await step('相手指定で中継', async () => {
      const got = wait((done) => a.onMessage('input', (data, from) => done({ data, from })));
      b.send('input', { keys: ['KeyW'] }, { to: a.myId });
      const m = await got;
      if (m.data.keys[0] !== 'KeyW' || m.from !== b.myId) throw new Error('受信内容が不正');
    });
    await step('ホスト切断でホスト交代・退出通知', async () => {
      const left = wait((done) => b.onPlayerLeave(done));
      const host = wait((done) => b.onHostChange(done));
      a.leaveRoom();
      await left;
      const h = await host;
      if (!h.isHost || !b.isHost) throw new Error('ホストが引き継がれていない');
    });
    await step('最後の1人が抜けるとルームが消える', async () => {
      const gone = wait((done) => b.onDisconnect(done));
      b.leaveRoom();
      await gone;
      const fails = await c.joinRoom(code).then(() => false, () => true);
      if (!fails) throw new Error('空のルームに参加できた');
    });
  } catch {
    // 失敗内容は step で記録済み
  } finally {
    nets.forEach((n) => n.leaveRoom());
    server.close();
  }
}

console.log(`smoke 対象: ${slugs.join(', ')}`);
await checkHttp();
checkSyntaxAndImports();
await checkOnline();

console.log(`\n結果: OK ${passed} 件 / NG ${errors.length} 件`);
if (errors.length) {
  console.log('smoke 失敗');
  process.exit(1);
}
console.log('smoke 通過');
