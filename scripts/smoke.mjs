// スモークテスト：サーバー応答・JS 構文・import 解決先の存在を確認する
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
    const targets = ['/', '/healthz', '/vendor/three/three.module.js', '/shared/engine.js'];
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

console.log(`smoke 対象: ${slugs.join(', ')}`);
await checkHttp();
checkSyntaxAndImports();

console.log(`\n結果: OK ${passed} 件 / NG ${errors.length} 件`);
if (errors.length) {
  console.log('smoke 失敗');
  process.exit(1);
}
console.log('smoke 通過');
