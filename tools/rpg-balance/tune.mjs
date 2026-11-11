// 計測結果（docs/balance/<名前>.json）から、目標帯を外れた職の火力係数 power・支援係数 support を決めて data/jobs.js に書き込む
//   node tools/rpg-balance/tune.mjs <計測名>
// 帯の中にいる職は動かさない（職ごとの個性を残す）。外れた職だけ、帯の端から少し内側へ寄せる
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const jobsPath = path.join(root, 'games/rpg/src/data/jobs.js');
const [name = 'stats'] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(path.join(root, `docs/balance/${name}.json`), 'utf8'));

/** 目標帯（剣士=100、回復は僧侶=100）。docs/balance/policy.md と同じ */
export const BANDS = {
  attacker: { dps: [90, 115], pt: [0, 130] },
  gunner: { dps: [85, 110], pt: [0, 130] },
  tank: { dps: [55, 75], pt: [0, 100] },
  healer: { dps: [40, 60], heal: [70, 100] },
  buffer: { dps: [50, 70], pt: [90, 115] },
  debuffer: { dps: [55, 75], pt: [90, 115] },
  unique: { dps: [80, 110], pt: [0, 130] },
};
const IN = 3; // 帯の端からこれだけ内側へ寄せる
const into = (v, [lo, hi]) => (v < lo ? lo + IN : v > hi ? hi - IN : v);
const r2 = (v) => Math.round(v * 100) / 100;

let src = fs.readFileSync(jobsPath, 'utf8');
const changes = [];
for (const r of rows) {
  const B = BANDS[r.role];
  if (!B) continue;
  let power = r.power;
  let support = r.support;
  // 火力
  // バッファー・デバッファーで味方の火力を上げる効果が測れない職（鈍化・弾消し・ゲージ配りなど守りや回転の支援）は、
  // PT 貢献を数字で揃えられないので、火力を帯の上の方に置いて埋め合わせる
  const noAmp = B.pt && B.pt[0] > 0 && r.amp <= 0.005;
  const dpsT = noAmp ? B.dps[1] - IN : into(r.dpsIdx, B.dps);
  if (dpsT !== r.dpsIdx && r.dpsIdx > 0) power = r2(power * (dpsT / r.dpsIdx));
  const dpsNew = r.dpsIdx * (power / r.power);
  // 回復（ヒーラー）
  if (B.heal && r.healIdx > 0) {
    const hT = into(r.healIdx, B.heal);
    if (hT !== r.healIdx) support = r2(support * (hT / r.healIdx));
  }
  // PT 火力貢献（自分の火力＋味方3人への強化・ボスの被ダメ増）
  if (B.pt && r.amp > 0.005) {
    const pt = dpsNew + 300 * r.amp;
    const ptT = into(pt, B.pt);
    if (ptT !== pt) {
      const ampT = Math.max(0.01, (ptT - dpsNew) / 300);
      support = r2(support * (ampT / r.amp));
    }
  }
  power = Math.min(4, Math.max(0.2, power));
  support = Math.min(4, Math.max(0.2, support));
  if (power === r.power && support === r.support) continue;
  // その職のブロックの power: … support: … を書き換える
  const head = src.indexOf(`\n  ${r.job}: {`);
  if (head < 0) throw new Error(`職業 ${r.job} が jobs.js に見つからない`);
  const at = src.indexOf('    power: ', head);
  const end = src.indexOf(',', src.indexOf('support: ', at));
  src = `${src.slice(0, at)}    power: ${power}, support: ${support}${src.slice(end)}`;
  changes.push({ job: r.job, name: r.name, role: r.role, power: [r.power, power], support: [r.support, support], dps: r.dpsIdx, pt: r.ptIdx, heal: r.healIdx });
}
fs.writeFileSync(jobsPath, src);
const out = path.join(root, `docs/balance/tune-${name}.json`);
fs.writeFileSync(out, JSON.stringify(changes, null, 1));
console.log(`${changes.length} 職を調整 → ${path.relative(root, out)}`);
for (const c of changes) console.log(`${c.name}（${c.role}）火力係数 ${c.power[0]}→${c.power[1]}　支援係数 ${c.support[0]}→${c.support[1]}　（火力 ${c.dps}／PT ${c.pt}／回復 ${c.heal}）`);
