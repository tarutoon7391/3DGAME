// ボスの計測（node）：各部屋のボスの「痛さ」（棒立ちの剣士が毎秒削られる量）を測り、
// 職業の計測結果（docs/balance/after.json）と合わせて、人数ごとの撃破時間の見積もりを docs/balance/bosses.md に出す
//   node tools/rpg-balance/bosses.mjs
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const PORT = 3191;
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = req(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const { AREAS, COURSES } = await import(path.join(root, 'games/rpg/src/data/areas.js'));
const J = await import(path.join(root, 'games/rpg/src/data/jobs.js'));
const jobs = JSON.parse(fs.readFileSync(path.join(root, 'docs/balance/after.json'), 'utf8'));
const dpsOf = (id) => jobs.find((r) => r.job === id).dps;
const ref = JSON.parse(fs.readFileSync(path.join(here, 'ref.json'), 'utf8'));

const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const browser = await pw.chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto(`http://localhost:${PORT}/games/rpg/?debug`);
await page.waitForFunction(() => !!window.rpg);
await page.addScriptTag({ path: path.join(here, 'harness.js') });

const rows = [];
for (const c of COURSES.slice(1)) {
  const list = AREAS[c.start].bosses;
  for (let i = 0; i < list.length; i++) {
    const r = await page.evaluate(([a, s]) => window.__balance.runBoss(a, s, 60), [c.start, i]);
    r.course = c.label;
    rows.push(r);
    process.stdout.write(`${c.label} ${r.names.join('＆')} 通常 ${r.dpsNormal.toFixed(1)}/秒 怒り ${r.dpsRage.toFixed(1)}/秒\n`);
  }
}
await browser.close();
server.kill();

// ---- 撃破時間の見積もり ----
// 計測の木人はステージ3 第1の間のボス（防御 REF_DEF）。防御の違いは calcDamage と同じ式で直す
const REF_DEF = 10;
const DEF_K = 30;
const comp = J.STANDARD_PARTY; // 人数ごとの標準編成
const up = J.UPTIME; // 実戦で攻撃できている時間の割合（避ける・追いかける・倒れるぶんを引く）
const healPerSec = ref.heal * 300; // 僧侶1人がアタッカー（HP 300）1人を毎秒回復する量
const lines = ['# ボスの計測結果', '',
  `痛さ：剣士ひとりがボスの 7m 手前で棒立ち（避けない）のとき毎秒削られる HP（協力プレイ時の値。ソロは × ${J.SOLO_DAMAGE}）。目安は僧侶1人の回復（アタッカー1人あたり毎秒 ${healPerSec.toFixed(0)}）の 1.5倍 ＝ ${(healPerSec * 1.5).toFixed(0)}`,
  `撃破時間：標準編成が、実戦で攻撃できている時間を ${Math.round(up * 100)}% として見積もった時間（分:秒）。部屋のボス全員を倒すまで`, '',
  `| ステージ | ボス | HP（1人） | 痛さ 通常 | 痛さ 怒り | ${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${n}人`).join(' | ')} |`,
  `|---|---|---|---|---|${'---|'.repeat(8)}`];
const mmss = (s0) => { const s = Math.round(s0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
for (const r of rows) {
  const times = [];
  for (let n = 1; n <= 8; n++) {
    const party = comp[n].reduce((a, id) => a + dpsOf(id), 0) * up;
    let t = 0;
    r.keys.forEach((k, i) => {
      const hp = r.maxHp[i] * J.RAID_SCALE(n); // 計測はソロなので maxHp は 1人ぶん
      t += hp / (party * ((DEF_K + REF_DEF) / (DEF_K + r.def[i])));
    });
    times.push(t);
  }
  r.times = times;
  lines.push(`| ${r.course} | ${r.names.join('＆')} | ${r.maxHp.join('＋')} | ${(r.dpsNormal / J.SOLO_DAMAGE).toFixed(0)} | ${(r.dpsRage / J.SOLO_DAMAGE).toFixed(0)} | ${times.map(mmss).join(' | ')} |`);
}
fs.writeFileSync(path.join(root, 'docs/balance/bosses.md'), '﻿' + lines.join('\n') + '\n');
fs.writeFileSync(path.join(root, 'docs/balance/bosses.json'), JSON.stringify(rows, null, 1));
console.log('→ docs/balance/bosses.md');
