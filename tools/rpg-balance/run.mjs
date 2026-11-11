// バランス計測の実行役（node）。サーバーを立ててヘッドレス Chrome で harness.js を動かし、全職の数値を表にする
//   node tools/rpg-balance/run.mjs [出力名=jobs] [秒数=60] [職業ID,...]
// 必要なもの：playwright（グローバルに入っていれば NODE_PATH で解決）と Chrome。リポジトリの依存には足さない
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const outDir = path.join(root, 'docs/balance');
const [outName = 'jobs', secsArg = '60', only = ''] = process.argv.slice(2);
const SECS = Number(secsArg);
const PORT = 3190;

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch { /* グローバル */ }
  const g = execSync('npm root -g').toString().trim();
  return req(path.join(g, 'playwright'));
}

const { JOBS, JOB_ORDER } = await import(path.join(root, 'games/rpg/src/data/jobs.js'));
const { ROLES } = await import(path.join(root, 'games/rpg/src/data/roles.js')).catch(() => ({ ROLES: null }));

// 技 id の重複チェック（重なると後から書いた方が上書きして、別の職業の技が化ける）
const seen = new Map();
for (const id of JOB_ORDER) {
  for (const k of ['q', 'e', 'r']) {
    const sid = JOBS[id][k]?.id;
    if (!sid) continue;
    if (seen.has(sid)) {
      console.error(`技 id の重複：${sid}（${seen.get(sid)} と ${id}）`);
      process.exit(1);
    }
    seen.set(sid, id);
  }
}

const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const { chromium } = loadPlaywright();
const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}/games/rpg/?debug`);
await page.waitForFunction(() => !!window.rpg);
await page.addScriptTag({ path: path.join(here, 'harness.js') });

const list = only ? only.split(',') : JOB_ORDER;
const RANDOMISH = new Set(['shifter', 'gambler', 'jester', 'mimic', 'astrologer', 'drunkard']);
const rows = [];
for (const id of list) {
  const runs = RANDOMISH.has(id) ? 4 : 1;
  const acc = [];
  for (let i = 0; i < runs; i++) {
    try {
      acc.push(await page.evaluate(([j, s]) => window.__balance.runJob(j, s), [id, SECS]));
    } catch (e) {
      errors.push(`${id}: ${String(e).split('\n').slice(0, 3).join(' / ')}`);
      await page.reload();
      await page.waitForFunction(() => !!window.rpg);
      await page.addScriptTag({ path: path.join(here, 'harness.js') });
    }
  }
  if (!acc.length) continue;
  const avg = { ...acc[0] };
  for (const k of ['dps', 'burst10', 'brkPerSec', 'takenMul', 'ehp', 'teamHealPerSec', 'teamShieldPerSec', 'teamAtk', 'bossAmp', 'amp', 'slow', 'stop']) {
    avg[k] = acc.reduce((a, c) => a + c[k], 0) / runs;
  }
  avg.role = ROLES?.[id] || JOBS[id].roleKey || '';
  rows.push(avg);
  process.stdout.write(`${id} dps=${avg.dps.toFixed(1)}\n`);
}
await browser.close();
server.kill();

// ---- 表にする（剣士=100 の指数つき） ----
// 基準（100）は固定：剣士の火力・実質HP（火力係数 1）と僧侶の回復（支援係数 1）。ref.json に保存して毎回同じ物差しで測る
const refPath = path.join(here, 'ref.json');
let ref = fs.existsSync(refPath) ? JSON.parse(fs.readFileSync(refPath, 'utf8')) : null;
if (!ref) {
  const sw = rows.find((r) => r.job === 'swordsman');
  const pr = rows.find((r) => r.job === 'priest');
  if (!sw || !pr || sw.power !== 1 || pr.support !== 1) throw new Error('ref.json が無い。剣士（power 1）と僧侶（support 1）を含めて測ること');
  ref = { dps: sw.dps, burst10: sw.burst10, ehp: sw.ehp, heal: pr.teamHealPerSec + pr.teamShieldPerSec, secs: SECS };
  fs.writeFileSync(refPath, JSON.stringify(ref, null, 1));
}
const idx = (v, b) => (b ? Math.round((v / b) * 100) : 0);
for (const r of rows) {
  r.dpsIdx = idx(r.dps, ref.dps);
  r.burstIdx = idx(r.burst10, ref.burst10);
  r.ehpIdx = idx(r.ehp, ref.ehp);
  r.healIdx = idx(r.teamHealPerSec + r.teamShieldPerSec, ref.heal);
  // PT 火力貢献：自分の火力＋味方3人の火力をどれだけ上げるか（味方1人＝剣士の火力として）
  r.ptIdx = Math.round(r.dpsIdx + 300 * Math.max(0, r.amp));
}
fs.mkdirSync(outDir, { recursive: true });
const cols = ['job', 'name', 'role', 'hp', 'atk', 'power', 'support', 'dps', 'dpsIdx', 'burstIdx', 'ehp', 'ehpIdx', 'teamHealPerSec', 'teamShieldPerSec', 'healIdx', 'teamAtk', 'bossAmp', 'amp', 'ptIdx', 'slow', 'stop', 'brkPerSec'];
const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : String(v));
fs.writeFileSync(path.join(outDir, `${outName}.csv`), '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => fmt(r[c])).join(','))].join('\n'));
const pct = (v) => `${Math.round(v * 100)}%`;
const md = [
  `# 職業の計測結果（${outName}）`,
  '',
  `条件：ステージ3 第1の間のボスを動かない木人にして ${SECS} 秒。R→Q→E を使えるたびに使い、残りは通常攻撃。木人は ${4} 秒ごとに1発反撃、自分の HP は 60% に保つ。指数は剣士=100、回復指数は僧侶=100`,
  '',
  '| 職業 | ロール | HP | 火力係数 | 支援係数 | DPS | 火力 | 10秒火力 | 実質HP | 回復 | 味方攻撃+ | ボス被ダメ+ | PT貢献 | 鈍化 |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.name} | ${r.role} | ${r.hp} | ${r.power} | ${r.support} | ${r.dps.toFixed(0)} | ${r.dpsIdx} | ${r.burstIdx} | ${r.ehpIdx} | ${r.healIdx} | ${pct(r.teamAtk)} | ${pct(r.bossAmp)} | ${r.ptIdx} | ${pct(r.slow)} |`),
  '',
  errors.length ? `## ページのエラー\n\n${[...new Set(errors)].map((e) => `- ${e}`).join('\n')}` : '',
].join('\n');
fs.writeFileSync(path.join(outDir, `${outName}.md`), '﻿' + md);
fs.writeFileSync(path.join(outDir, `${outName}.json`), JSON.stringify(rows, null, 1));
console.log(`\n${rows.length} 職 → docs/balance/${outName}.md／.csv／.json${errors.length ? `（ページのエラー ${new Set(errors).size} 種）` : ''}`);
