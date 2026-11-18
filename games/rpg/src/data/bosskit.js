// ボスの技の部品集（ステージ10〜12）。技は「部品の関数（色・名前・強さ）」を組み合わせて作る
// 書き方の中身は src/bossmoves.js・src/bossmoves_ext.js と同じ。ここは毎回同じ形を書かずに済ませるための道具
// 部品は「ふつうの大きさ」で書き、data/bossscale.js の giant で部屋に合わせて大きくする
import { giant } from './bossscale.js';

const PI = Math.PI;

/**
 * ステージ10〜12 のボスの大きさ（ここを変えると全員まとめて変わる）
 * size：体の大きさ、range：攻撃範囲・距離、shot：弾・光球の数。部屋は縦横2倍・ボスは2〜3体同時なので範囲は3倍にしている
 */
export const HUGE = { size: 4, range: 3, shot: 2 };
/** 部品で書いたボスを HUGE の大きさにする */
export const huge = (def, over = {}) => giant(def, HUGE.range, over, { size: HUGE.size, shot: HUGE.shot });

export const ULT_AT = [0.75, 0.45, 0.2];
export const RAGE = { at: 0.5, speedMul: 1.3, windupMul: 0.68, countMul: 1.2 };

const seq = (name, color, steps, o = {}) => ({ kind: 'seq', name, color, recover: o.recover ?? 0.5, steps, ...o.extra });

// ---------------- 近接 ----------------
/** 3連撃（左・右・正面の大振り） */
export const combo = (name, c, { r = 5.5, pose = 'swing' } = {}) => seq(name, c, [
  { at: 0.45, tele: 0.4, do: 'hit', shape: 'sector', r, arc: 1.6, a: -0.3, k: 0.7, fx: 'arc', pose, se: 'swing' },
  { at: 0.8, tele: 0.32, do: 'hit', shape: 'sector', r, arc: 1.6, a: 0.3, k: 0.7, fx: 'arc', pose, se: 'swing' },
  { at: 1.3, tele: 0.45, do: 'hit', shape: 'rect', len: r * 2, w: 2.4, k: 1.1, fx: 'line', fxd: { tall: 2 }, pose: 'lunge', se: 'swing' },
], { recover: 0.4 });
/** 左右の大薙ぎ */
export const sweep = (name, c, { r = 7, pose = 'swing' } = {}) => seq(name, c, [
  { at: 0.7, tele: 0.6, do: 'hit', shape: 'sector', r, arc: 3.0, a: 0.01, fx: 'arc', pose, se: 'swing' },
  { at: 1.35, tele: 0.5, do: 'hit', shape: 'sector', r, arc: 3.0, a: -0.01, fx: 'arc', pose, se: 'swing' },
]);
/** 噛みつき2連 */
export const bites = (name, c, { r = 6.5 } = {}) => seq(name, c, [
  { at: 0.5, tele: 0.45, do: 'hit', shape: 'sector', r, arc: 1.1, k: 0.9, fx: 'bite', fxDist: r * 0.6, pose: 'bite', se: 'swing' },
  { at: 1.0, tele: 0.4, do: 'hit', shape: 'sector', r: r * 1.15, arc: 0.9, k: 1.1, fx: 'bite', fxDist: r * 0.7, pose: 'bite', se: 'swing' },
], { recover: 0.45 });
/** 突進（n 回） */
export const dashes = (name, c, { n = 2, speed = 28, w = 3.4, pose = 'lunge' } = {}) => seq(name, c,
  Array.from({ length: n }, (_, i) => ({ at: 0.6 + i * 0.65, tele: i ? 0.45 : 0.55, do: 'move', m: 'dash', speed, dur: 0.5, w, k: 1, pose })));
/** 跳んで踏みつけ */
export const leap = (name, c, { r = 5 } = {}) => seq(name, c, [
  { at: 0.85, tele: 0.85, do: 'move', m: 'leap', dur: 0.85, h: 7, r, k: 1.3, ring: 14, fx: 'pillar', pose: 'crouch' },
], { recover: 0.6 });
/** 内→外の衝撃（円→輪→輪） */
export const quake = (name, c, { r = 4.5, pose = 'over' } = {}) => seq(name, c, [
  { at: 0.7, tele: 0.65, do: 'hit', shape: 'circle', r, fx: 'pillar', pose },
  { at: 1.35, tele: 0.6, do: 'hit', shape: 'donut', rIn: r, rOut: r * 2, pose },
  { at: 2.0, tele: 0.6, do: 'hit', shape: 'donut', rIn: r * 2, rOut: r * 3, pose },
]);
/** 回転斬り（動きながら） */
export const spin = (name, c, { r = 4.5 } = {}) => seq(name, c, [
  { at: 0.5, tele: 0.45, do: 'move', m: 'dash', speed: 6, dur: 1.4, hitR: -1, pose: 'spin' },
  ...[0.5, 0.9, 1.3, 1.7].map((at, i) => ({ at, tele: i ? 0.2 : 0.45, do: 'hit', shape: 'circle', r, k: 0.55, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'spin' })),
]);

// ---------------- 範囲 ----------------
/** 十字（2回。2回目は斜め）。tgt なら標的の足元 */
export const cross = (name, c, { len = 14, w = 2.2, tgt = false } = {}) => seq(name, c, [
  { at: 0.9, tele: 0.8, do: 'hit', ...(tgt ? { o: 'tgt' } : {}), shape: 'cross', len, w, fx: 'line', fxd: { tall: 3 }, pose: 'over', se: 'slam' },
  { at: 1.6, tele: 0.6, do: 'hit', ...(tgt ? { o: 'tgt' } : {}), shape: 'cross', len, w, a: PI / 4, fx: 'line', fxd: { tall: 3 }, se: 'slam' },
]);
/** 包囲：標的を囲む位置から走る線 */
export const siege = (name, c, { n = 5, dist = 10 } = {}) => seq(name, c, [
  { at: 0.95, tele: 0.85, do: 'hit', o: 'around', n, dist, shape: 'rect', len: dist * 2, w: 1.6, fx: 'line', fxd: { tall: 3 }, pose: 'cast', se: 'wave' },
  { at: 1.7, tele: 0.65, do: 'hit', o: 'around', n, dist, off: PI / n, shape: 'rect', len: dist * 2, w: 1.6, fx: 'line', fxd: { tall: 3 }, se: 'wave' },
]);
/** 火柱の輪（内と外） */
export const pillars = (name, c, { rr = 6 } = {}) => seq(name, c, [
  { at: 0.9, tele: 0.8, do: 'hit', o: 'ring', n: 6, rr, off: 0, shape: 'circle', r: 2.6, fx: 'pillar', pose: 'cast' },
  { at: 1.5, tele: 0.55, do: 'hit', o: 'ring', n: 8, rr: rr * 1.8, off: PI / 8, shape: 'circle', r: 2.8, fx: 'pillar' },
]);
/** 降りそそぐ（ばらまき＋足元） */
export const meteor = (name, c, { fx = 'meteor', n = 7, spread = 11 } = {}) => seq(name, c, [
  { at: 0.5, tele: 0.45, do: 'se', se: 'roar', pose: 'cast' },
  { at: 1.7, tele: 1.2, do: 'zones', o: 'rand', n, spread, first: false, r: 2.4, stagger: 0.09, fx },
  { at: 2.0, tele: 1.3, do: 'zones', o: 'each', r: 2.8, burst: 6, fx },
], { recover: 0.45 });
/** 格子の線 */
export const grid = (name, c, { n = 4, len = 34 } = {}) => seq(name, c, [
  { at: 1.0, tele: 0.9, do: 'hit', o: 'grid', n, len, gapW: 7, shape: 'rect', w: 1.8, fx: 'line', fxd: { tall: 4 }, pose: 'cast', se: 'wave' },
  { at: 1.8, tele: 0.7, do: 'hit', o: 'grid', n, len, gapW: 7, a: PI / 4, shape: 'rect', w: 1.8, fx: 'line', fxd: { tall: 4 }, se: 'wave' },
]);
/** 回るビーム */
export const beams = (name, c, { arms = 3, len = 22, speed = 1.2, dur = 2.0, pose = 'cast' } = {}) => seq(name, c, [
  { at: 0.9, tele: 0.8, do: 'rot', arms, arc: 0.35, len, speed, dur, pose },
], { recover: 0.55 });
/** なぎ払いの息（1本を横に振る） */
export const breath = (name, c, { len = 22, speed = 1.6 } = {}) => seq(name, c, [
  { at: 0.9, tele: 0.8, do: 'rot', arms: 1, arc: 0.5, len, speed, a: -0.9, dur: 1.15, sweepTele: true, pose: 'lunge' },
  { at: 0.9, do: 'se', se: 'wave', pose: 'lunge', dur: 1.15 },
], { recover: 0.55 });
/** 溜まり（each：全員の足元） */
export const pools = (name, c, { kind = 'void', r = 3 } = {}) => seq(name, c, [
  { at: 0.85, tele: 0.8, do: 'pool', o: 'each', r, dur: 5, every: 0.5, k: 0.3, kind, pose: 'cast', se: 'wave' },
  { at: 1.4, tele: 0.7, do: 'pool', o: 'rand', n: 3, spread: 10, first: false, r: r * 0.9, dur: 4.5, every: 0.5, k: 0.3, kind },
], { recover: 0.45 });
/** 引き寄せ（渦）→ 中心へ一撃 */
export const vortex = (name, c, { spin = 4, r = 5 } = {}) => seq(name, c, [
  { at: 0.4, do: 'pull', strength: 3.6, spin, dur: 2.0, pose: 'charge' },
  { at: 0.5, tele: 0.5, do: 'pool', r, dur: 3.2, every: 0.45, k: 0.35, kind: 'whirl' },
  { at: 2.4, tele: 1.2, do: 'hit', shape: 'circle', r: r * 1.3, k: 1.1, fx: 'pillar', pose: 'rear' },
]);
/** 押し寄せる壁 */
export const wall = (name, c, { n = 1 } = {}) => seq(name, c, [
  { at: 0.6, tele: 0.55, do: 'se', se: 'wave', pose: 'over' },
  ...Array.from({ length: n }, (_, i) => ({ at: 0.7 + i * 1.4, do: 'wall', speed: 11, max: 44, gapW: 4.6, gapRange: 7, wait: 0.7, thick: 2 })),
]);

// ---------------- 弾 ----------------
/** 扇の弾 */
export const fan = (name, c, { n = 6, volleys = 3, speed = 15, pose = 'cast' } = {}) => seq(name, c, [
  { at: 0.5, tele: 0.45, do: 'shots', pat: 'fan', n, spread: 0.18, speed, volleys, gap: 0.3, alternate: true, pose },
], { recover: 0.4 });
/** 渦巻きの弾 */
export const spiral = (name, c, { arms = 3, dur = 1.8 } = {}) => seq(name, c, [
  { at: 0.5, tele: 0.45, do: 'shots', pat: 'spiral', arms, dur, interval: 0.13, turn: 0.28, speed: 8, pose: 'cast' },
], { recover: 0.45 });
/** 輪の弾（2波） */
export const rings = (name, c, { n = 16 } = {}) => seq(name, c, [
  { at: 0.6, tele: 0.55, do: 'shots', pat: 'ring', n, speed: 8, waves: 2, gap: 0.5, pose: 'rear' },
], { recover: 0.4 });
/** 弾ける弾 */
export const cluster = (name, c, { n = 5, ring = 8 } = {}) => seq(name, c, [
  { at: 0.55, tele: 0.5, do: 'cluster', n, spread: 0.32, speed: 10, pop: 0.9, ring, pose: 'cast' },
  { at: 1.3, tele: 0.3, do: 'cluster', n: Math.max(2, n - 2), spread: 0.5, speed: 9, pop: 1.1, ring },
], { recover: 0.45 });
/** 回る光球（out：広がる / in：縮む） */
export const orbs = (name, c, { n = 6, inward = false } = {}) => seq(name, c, [
  { at: 0.6, tele: 0.55, do: 'orbs', n, rr0: inward ? 13 : 1.5, rr1: inward ? 1.5 : 13, dur: 3.0, speed: inward ? -1.6 : 2, r: 1.1, k: 0.6, pose: 'float' },
]);

// ---------------- 移動 ----------------
/** 消えて背後へ → 一撃と輪の弾 */
export const blink = (name, c, { r = 5 } = {}) => seq(name, c, [
  { at: 0.45, tele: 0.4, do: 'move', m: 'warp', to: 'back', dist: 5, pose: 'float' },
  { at: 1.0, tele: 0.5, do: 'hit', shape: 'circle', r, fx: 'pillar', pose: 'cast' },
  { at: 1.05, do: 'shots', pat: 'ring', n: 12, speed: 8 },
], { recover: 0.45 });
/** 舞い上がって急降下（追ってくる円） */
export const dive = (name, c, { r = 5 } = {}) => seq(name, c, [
  { at: 0.55, tele: 0.45, do: 'move', m: 'rise', h: 12, dur: 0.55, pose: 'wings' },
  { at: 2.1, tele: 1.4, do: 'move', m: 'dive', dur: 0.4, r, follow: 0.9, ring: 12, fx: 'pillar' },
], { recover: 0.55 });
/** 潜って足元から */
export const burrow = (name, c, { r = 4.5 } = {}) => seq(name, c, [
  { at: 0.45, tele: 0.4, do: 'move', m: 'hide', color: c, pose: 'sink' },
  { at: 1.9, tele: 1.3, do: 'move', m: 'warp', to: 'tgt', follow: 0.8, r, k: 1.2, ring: 14, fx: 'pillar' },
], { recover: 0.55 });
/** 目を逸らせ */
export const stare = (name, c) => seq(name, c, [
  { at: 0.2, do: 'banner', text: '👁 目を見るな！（背を向けろ）' },
  { at: 1.9, tele: 1.7, do: 'facing', pose: 'float' },
]);

// ---------------- 必殺技 ----------------
const ultOf = (name, c, hint, steps, charge = 2.6) => seq(name, c, steps, { recover: 0.8, extra: { ult: true, hint, hpAt: ULT_AT, charge } });
/** 緑の円の中で耐える（2回） */
export const ultSafe = (name, c) => ultOf(name, c, '緑の円の中で耐えろ（2回）', [
  { at: 0.05, do: 'safe', groups: [{ kind: 'safe', n: 3, rr: 9, r: 3 }], show: 4.0 },
  { at: 2.6, tele: 2.6, do: 'se', se: 'roar', shake: 0.7, pose: 'charge' },
  { at: 4.0, do: 'check', color: c, pose: 'rear' },
  { at: 4.2, do: 'safe', groups: [{ kind: 'safe', n: 3, rr: 13, r: 3 }], show: 2.4 },
  { at: 6.4, do: 'check', color: c, pose: 'rear' },
]);
/** 輪が縮んだら回避（3回） */
export const ultBeat = (name, c) => ultOf(name, c, '衝撃が3回！ 輪が縮んだら回避', [
  { at: 2.4, tele: 2.4, do: 'se', se: 'roar', shake: 0.6, pose: 'charge' },
  { at: 2.5, do: 'vfx', type: 'beat', d: { times: [1.3, 2.4, 3.5], lead: 1.0 } },
  { at: 3.8, do: 'all', flash: true, se: 'slam', pose: 'rear' },
  { at: 4.9, do: 'all', flash: true, se: 'slam', pose: 'rear' },
  { at: 6.0, do: 'all', flash: true, se: 'slam', pose: 'rear' },
], 2.4);
/** 十字×3（線の間へ） */
export const ultCross = (name, c) => ultOf(name, c, '十字が3回！ 線の間に逃げろ', [
  { at: 2.4, tele: 2.4, do: 'se', se: 'roar', pose: 'charge' },
  { at: 3.4, tele: 1.0, do: 'hit', shape: 'cross', len: 30, w: 3.2, fx: 'line', fxd: { tall: 3 }, pose: 'over', se: 'slam' },
  { at: 4.4, tele: 0.9, do: 'hit', shape: 'cross', len: 30, w: 3.2, a: PI / 4, fx: 'line', fxd: { tall: 3 }, pose: 'over', se: 'slam' },
  { at: 5.4, tele: 0.9, do: 'hit', shape: 'cross', len: 30, w: 3.2, a: PI / 8, fx: 'line', fxd: { tall: 3 }, pose: 'over', se: 'slam' },
], 2.4);
/** 押し寄せる壁×3 */
export const ultWalls = (name, c) => ultOf(name, c, '壁が3回 押し寄せる！ 切れ目を抜けろ', [
  { at: 2.6, tele: 2.6, do: 'se', se: 'roar', shake: 0.7, pose: 'charge' },
  { at: 2.7, do: 'wall', speed: 12, max: 48, gapW: 4.4, gapRange: 9, wait: 0.6, thick: 2.4, k: 3 },
  { at: 4.2, do: 'wall', speed: 12, max: 48, gapW: 4.4, gapRange: 9, wait: 0.6, thick: 2.4, k: 3, pose: 'rear' },
  { at: 5.7, do: 'wall', speed: 13, max: 48, gapW: 4.0, gapRange: 9, wait: 0.6, thick: 2.4, k: 3, pose: 'rear' },
]);
/** 岩の陰に隠れろ */
export const ultCover = (name, c) => ultOf(name, c, '大技が来る！ 岩の陰（ボスから見て後ろ）に隠れろ', [
  { at: 0.05, do: 'safe', groups: [{ kind: 'rock', n: 4, rr: 8, r: 2.4 }], show: 4.2 },
  { at: 3.0, tele: 3.0, do: 'se', se: 'roar', shake: 0.9, pose: 'charge' },
  { at: 3.6, do: 'cover', pose: 'rear' },
], 3.0);
/** 包囲→回避 */
export const ultSiege = (name, c) => ultOf(name, c, '包囲の線が2回！ 隙間を抜けて、最後は回避', [
  { at: 2.2, tele: 2.2, do: 'se', se: 'seal', pose: 'charge' },
  { at: 3.2, tele: 1.0, do: 'hit', o: 'around', n: 6, dist: 11, shape: 'rect', len: 22, w: 1.8, fx: 'line', fxd: { tall: 3 }, pose: 'cast', se: 'wave' },
  { at: 4.2, tele: 0.8, do: 'hit', o: 'around', n: 6, dist: 11, off: PI / 6, shape: 'rect', len: 22, w: 1.8, fx: 'line', fxd: { tall: 3 }, se: 'wave' },
  { at: 4.3, do: 'vfx', type: 'beat', d: { times: [1.3], lead: 1.0 } },
  { at: 5.6, do: 'all', flash: true, se: 'slam', pose: 'over' },
], 2.2);
/** 目を逸らせ（3回） */
export const ultStare = (name, c) => ultOf(name, c, '目を3回開く！ そのたびに背を向けろ', [
  { at: 2.4, tele: 2.4, do: 'se', se: 'seal', pose: 'charge' },
  ...[0, 1, 2].flatMap((i) => [
    { at: 2.5 + i * 1.9, do: 'banner', text: '👁 背を向けろ！' },
    { at: 3.8 + i * 1.9, tele: 1.2, do: 'facing', pose: 'float' },
  ]),
], 2.4);
/** 光球が迫る→回避 */
export const ultOrbs = (name, c) => ultOf(name, c, '光球が迫る！ 隙間を抜けて、最後は回避', [
  { at: 2.6, tele: 2.6, do: 'se', se: 'roar', shake: 0.6, pose: 'charge' },
  { at: 2.7, do: 'orbs', tele: 0.1, n: 10, rr0: 18, rr1: 1, dur: 3.6, speed: 1.2, r: 1.3, k: 0.6 },
  { at: 2.8, do: 'orbs', tele: 0.1, n: 6, rr0: 2, rr1: 16, dur: 3.4, speed: -1.6, r: 1.2, k: 0.6 },
  { at: 4.6, do: 'vfx', type: 'beat', d: { times: [1.8], lead: 1.2 } },
  { at: 6.4, do: 'all', flash: true, se: 'wave', pose: 'float' },
]);
/** 動くな（2回） */
export const ultStill = (name, c) => ultOf(name, c, '「止まれ」の合図で2回、動かずに耐えろ', [
  { at: 2.4, tele: 2.4, do: 'se', se: 'seal', pose: 'charge' },
  { at: 2.6, do: 'banner', text: '⏸ 動くな！' },
  { at: 3.6, tele: 1.0, do: 'still', dur: 1.2, pose: 'float' },
  { at: 5.2, do: 'banner', text: '⏸ 動くな！' },
  { at: 6.2, tele: 1.0, do: 'still', dur: 1.2, pose: 'float' },
], 2.4);

/**
 * ボスを組み立てる。pats は { 名前: 部品 } で、near / far は使う技の名前の並び（重みは同じ）
 * stats：hp, def, speed, radius, hpY, keep, nearRange, shotHit, meleeHit, restMin, restMax
 */
export function boss(name, color, look, stats, pats, near, far, rage = RAGE) {
  const w = (list) => Object.fromEntries(list.map((k) => [k, +(1 / list.length).toFixed(3)]));
  return {
    name, color,
    def: 11, speed: 5, radius: 1.6, hpY: 6, nearRange: 7,
    shotHit: 1 / 5, meleeHit: 1 / 2.9,
    restMin: 0.4, restMax: 0.85,
    ...stats,
    near: w(near), far: w(far),
    patterns: pats,
    rage,
    look,
  };
}
