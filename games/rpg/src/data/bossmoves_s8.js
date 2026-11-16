// ステージ8「灼熱の火山」（溶岩の流れる火口）のボス6体。技の書き方は src/bossmoves.js・src/bossmoves_ext.js
// 新しい技：残る溶岩溜まり（pool kind:'lava'）・十字の炎（shape:'cross'）・火球の輪（orbs）・弾ける火種（cluster）
// 最後のムスペルは体も攻撃範囲も2倍（data/bossscale.js）。部屋も縦横2倍
import { giant } from './bossscale.js';

const PI = Math.PI;
const ULT_AT = [0.75, 0.45, 0.2];
const RAGE = { at: 0.5, speedMul: 1.3, windupMul: 0.68, countMul: 1.2 };
const LAVA = 0xff5722;
const MAGMA = 0xff9100;
const EMBER = 0xffd180;
const ASH = 0x8d6e63;
/** ボスから標的の方へ順に噴き上がる溶岩柱 */
const eruptLine = (t0, n, gap, step, r, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ at: t0 + i * gap, tele: 0.55, do: 'hit', shape: 'circle', dist: 3 + i * step, r, reaim: i === 0 ? undefined : false, fx: 'pillar', se: 'slam', ...extra }));

// ---------------- 火蜥蜴サラマンダー（溶岩を残して走る獣） ----------------
const salamander = {
  name: '火蜥蜴サラマンダー', color: 0xe64a19,
  hp: 20800, def: 11, speed: 6.8, radius: 2.2, hpY: 5.5,
  shotHit: 1 / 5, meleeHit: 1 / 2.9,
  nearRange: 7,
  near: { claws: 0.25, tail: 0.2, roll: 0.2, breath: 0.2, trail: 0.15 },
  far: { spit: 0.3, roll: 0.25, trail: 0.25, breath: 0.2 },
  patterns: {
    claws: { kind: 'seq', name: '灼爪の連撃', color: LAVA, recover: 0.4, steps: [
      { at: 0.45, tele: 0.4, do: 'hit', shape: 'sector', r: 5.5, arc: 1.4, a: -0.3, k: 0.7, fx: 'claw', fxd: { r: 5 }, pose: 'swing', se: 'swing' },
      { at: 0.8, tele: 0.32, do: 'hit', shape: 'sector', r: 5.5, arc: 1.4, a: 0.3, k: 0.7, fx: 'claw', fxd: { r: 5 }, pose: 'swing', se: 'swing' },
      { at: 1.25, tele: 0.4, do: 'hit', shape: 'sector', r: 7, arc: 0.9, k: 1.1, fx: 'bite', fxDist: 4, pose: 'bite', se: 'swing' },
    ] },
    tail: { kind: 'seq', name: '炎の尾', color: MAGMA, recover: 0.45, steps: [
      { at: 0.6, tele: 0.5, do: 'hit', shape: 'sector', r: 7.5, arc: 2.6, a: PI, fx: 'arc', pose: 'tail', se: 'swing' },
      { at: 0.7, do: 'cluster', n: 3, spread: 0.7, speed: 8, pop: 0.8, ring: 6 },
    ] },
    roll: { kind: 'seq', name: '火炎車', color: LAVA, recover: 0.5, steps: [
      { at: 0.7, tele: 0.65, do: 'move', m: 'dash', speed: 26, dur: 0.7, w: 3.8, k: 1.1, pose: 'coil' },
      { at: 0.8, tele: 0.1, do: 'pool', r: 2.6, dur: 4, every: 0.5, k: 0.25, kind: 'lava' },
      { at: 1.2, tele: 0.1, do: 'pool', r: 2.6, dur: 4, every: 0.5, k: 0.25, kind: 'lava' },
    ] },
    breath: { kind: 'seq', name: '溶岩の吐息', color: MAGMA, recover: 0.5, steps: [
      { at: 0.85, tele: 0.75, do: 'hit', shape: 'sector', r: 12, arc: 0.9, fx: 'breath', fxDur: 0.7, fxd: { len: 12, w: 8, y: 2.5 }, pose: 'lunge', se: 'wave' },
      { at: 1.5, tele: 0.5, do: 'pool', o: 'fan', n: 3, spread: 0.3, dist: 8, reaim: false, r: 2.6, dur: 4, every: 0.5, k: 0.3, kind: 'lava' },
    ] },
    spit: { kind: 'seq', name: '火種吐き', color: EMBER, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'cluster', n: 4, spread: 0.35, speed: 11, pop: 0.9, ring: 8, pose: 'lunge' },
      { at: 1.2, tele: 0.3, do: 'shots', pat: 'fan', n: 5, spread: 0.18, speed: 16, volleys: 2, gap: 0.3 },
    ] },
    trail: { kind: 'seq', name: '溶岩の足跡', color: LAVA, recover: 0.45, steps: [
      { at: 0.3, tele: 0.25, do: 'move', m: 'orbit', rr: 8, speed: 2.6, dur: 1.6, pose: 'lunge' },
      { at: 2.0, tele: 0.8, do: 'pool', o: 'ring', n: 6, rr: 8, r: 2.4, dur: 4.5, every: 0.5, k: 0.3, kind: 'lava' },
      { at: 2.2, tele: 0.5, do: 'move', m: 'dash', speed: 26, dur: 0.5, w: 3.5, k: 1, pose: 'coil' },
    ] },
    ult: { kind: 'seq', ult: true, name: '火口の怒り', hint: '溶岩があふれる！ 緑の円へ逃げろ（2回）', hpAt: ULT_AT, charge: 2.6, color: LAVA, recover: 0.8, steps: [
      { at: 0.05, do: 'safe', groups: [{ kind: 'safe', n: 3, rr: 9, r: 3 }], show: 4.0 },
      { at: 2.6, tele: 2.6, do: 'se', se: 'roar', shake: 0.8, pose: 'charge' },
      { at: 4.0, do: 'check', color: LAVA, pose: 'rear' },
      { at: 4.2, do: 'safe', groups: [{ kind: 'safe', n: 3, rr: 13, r: 3 }], show: 2.4 },
      { at: 6.4, do: 'check', color: LAVA, pose: 'rear' },
    ] },
  },
  rage: RAGE, restMin: 0.35, restMax: 0.75,
  look: { monster: 'beast', scale: 2.0, horn: 0xffab40, eye: 0xffeb3b, belly: 0xffccbc, mane: 0xff6d00 },
};

// ---------------- 溶岩竜ラーヴァワーム（地中を泳ぐ大蛇） ----------------
const lavaworm = {
  name: '溶岩竜ラーヴァワーム', color: 0x6d4c41,
  hp: 21600, def: 13, speed: 4.8, radius: 2.4, hpY: 7.5,
  shotHit: 1 / 5, meleeHit: 1 / 2.9,
  nearRange: 8,
  near: { bite: 0.25, coil: 0.2, burrow: 0.2, erupt: 0.15, spit: 0.2 },
  far: { burrow: 0.3, erupt: 0.25, spit: 0.25, rain: 0.2 },
  patterns: {
    bite: { kind: 'seq', name: '灼熱の顎', color: LAVA, recover: 0.45, steps: [
      { at: 0.55, tele: 0.48, do: 'hit', shape: 'sector', r: 7.5, arc: 1.0, k: 0.9, fx: 'bite', fxDist: 4.5, pose: 'bite', se: 'swing' },
      { at: 1.1, tele: 0.45, do: 'hit', shape: 'rect', len: 11, w: 3, k: 1.1, fx: 'line', pose: 'lunge', se: 'swing' },
    ] },
    coil: { kind: 'seq', name: '灼熱のとぐろ', color: MAGMA, recover: 0.5, steps: [
      { at: 0.7, tele: 0.65, do: 'hit', shape: 'circle', r: 5, k: 1, fx: 'pillar', pose: 'coil' },
      { at: 1.3, tele: 0.55, do: 'hit', shape: 'donut', rIn: 5, rOut: 9.5, pose: 'coil' },
      { at: 1.9, tele: 0.55, do: 'hit', shape: 'donut', rIn: 9.5, rOut: 14, pose: 'coil' },
    ] },
    burrow: { kind: 'seq', name: '地中遊泳', color: ASH, recover: 0.55, steps: [
      { at: 0.45, tele: 0.4, do: 'move', m: 'hide', color: LAVA, pose: 'sink' },
      { at: 1.6, tele: 1.0, do: 'move', m: 'warp', to: 'tgt', follow: 0.6, r: 3.6, k: 0.9, fx: 'pillar' },
      { at: 1.9, do: 'move', m: 'hide', color: LAVA },
      { at: 3.2, tele: 1.1, do: 'move', m: 'warp', to: 'tgt', follow: 0.7, r: 4.5, k: 1.2, ring: 14, fx: 'pillar' },
    ] },
    erupt: { kind: 'seq', name: '噴火の列', color: MAGMA, recover: 0.45, steps: [
      { at: 0.4, tele: 0.35, do: 'se', se: 'slam', pose: 'rear' },
      ...eruptLine(0.9, 7, 0.1, 2.6, 2.1),
      { at: 1.9, tele: 0.6, do: 'pool', o: 'tgt', r: 3.2, dur: 4, every: 0.5, k: 0.3, kind: 'lava' },
    ] },
    spit: { kind: 'seq', name: '溶岩弾', color: LAVA, recover: 0.45, steps: [
      { at: 0.7, tele: 0.6, do: 'pool', o: 'each', r: 3, dur: 4.5, every: 0.5, k: 0.3, kind: 'lava', pose: 'lunge', se: 'wave' },
      { at: 1.0, do: 'shots', pat: 'ring', n: 14, speed: 8, waves: 2, gap: 0.4 },
    ] },
    rain: { kind: 'seq', name: '火山弾の雨', color: EMBER, recover: 0.45, steps: [
      { at: 0.5, tele: 0.45, do: 'se', se: 'roar', pose: 'rear' },
      { at: 1.7, tele: 1.15, do: 'zones', o: 'rand', n: 8, spread: 12, first: false, r: 2.4, stagger: 0.09, fx: 'meteor' },
      { at: 2.0, tele: 1.25, do: 'zones', o: 'each', r: 2.8, burst: 6, fx: 'meteor' },
    ] },
    ult: { kind: 'seq', ult: true, name: '大地の裂け目', hint: '地面が十字に裂ける！ 線の間に逃げて、最後は回避', hpAt: ULT_AT, charge: 2.6, color: MAGMA, recover: 0.8, steps: [
      { at: 2.6, tele: 2.6, do: 'se', se: 'roar', shake: 0.8, pose: 'charge' },
      { at: 3.6, tele: 1.0, do: 'hit', shape: 'cross', len: 30, w: 3.2, fx: 'line', fxd: { tall: 3 }, pose: 'sink', se: 'slam' },
      { at: 4.6, tele: 0.9, do: 'hit', shape: 'cross', len: 30, w: 3.2, a: PI / 4, fx: 'line', fxd: { tall: 3 }, se: 'slam' },
      { at: 4.7, do: 'vfx', type: 'beat', d: { times: [1.4], lead: 1.0 } },
      { at: 6.1, do: 'all', flash: true, se: 'slam', pose: 'rear' },
    ] },
  },
  rage: RAGE, restMin: 0.4, restMax: 0.85,
  look: { monster: 'serpent', scale: 2.5, horn: 0xffab40, eye: 0xffeb3b, belly: 0xff7043, fin: 0xff6d00 },
};

// ---------------- 炎魔イフリート（浮かぶ炎の魔人） ----------------
const ifrit = {
  name: '炎魔イフリート', color: 0xff6f00,
  hp: 22200, def: 11, speed: 4.6, radius: 1.8, hpY: 7, keep: 8,
  shotHit: 1 / 5, meleeHit: 1 / 2.9,
  nearRange: 6,
  near: { cross: 0.25, orbs: 0.25, pillars: 0.2, warp: 0.15, flamewall: 0.15 },
  far: { meteor: 0.25, cross: 0.2, orbs: 0.2, flamewall: 0.2, fan: 0.15 },
  patterns: {
    cross: { kind: 'seq', name: '十字の業火', color: LAVA, recover: 0.5, steps: [
      { at: 0.9, tele: 0.8, do: 'hit', shape: 'cross', len: 16, w: 2.4, fx: 'line', fxd: { tall: 2 }, pose: 'cast', se: 'wave' },
      { at: 1.6, tele: 0.6, do: 'hit', shape: 'cross', len: 16, w: 2.4, a: PI / 4, fx: 'line', fxd: { tall: 2 }, pose: 'cast', se: 'wave' },
    ] },
    orbs: { kind: 'seq', name: '炎の衛星', color: MAGMA, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'orbs', n: 6, rr0: 2, rr1: 12, dur: 3.0, speed: 2.4, r: 1.1, k: 0.6, pose: 'float' },
      { at: 1.4, do: 'shots', pat: 'spiral', arms: 3, dur: 1.4, interval: 0.14, turn: 0.28, speed: 8 },
    ] },
    pillars: { kind: 'seq', name: '火柱の陣', color: LAVA, recover: 0.45, steps: [
      { at: 0.9, tele: 0.8, do: 'hit', o: 'ring', n: 6, rr: 6, off: 0, shape: 'circle', r: 2.6, fx: 'pillar', pose: 'cast' },
      { at: 1.5, tele: 0.55, do: 'hit', o: 'ring', n: 8, rr: 11, off: PI / 8, shape: 'circle', r: 2.8, fx: 'pillar' },
    ] },
    warp: { kind: 'seq', name: '陽炎渡り', color: EMBER, recover: 0.45, steps: [
      { at: 0.5, tele: 0.45, do: 'move', m: 'warp', to: 'back', dist: 5, pose: 'float' },
      { at: 1.05, tele: 0.5, do: 'hit', shape: 'circle', r: 5, fx: 'pillar', pose: 'cast' },
      { at: 1.1, do: 'pool', tele: 0.1, r: 3, dur: 3.5, every: 0.5, k: 0.25, kind: 'lava' },
    ] },
    flamewall: { kind: 'seq', name: '炎の壁', color: LAVA, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'se', se: 'wave', pose: 'over' },
      { at: 0.7, do: 'wall', speed: 10, max: 44, gapW: 4.6, gapRange: 7, wait: 0.7 },
      { at: 1.6, do: 'shots', pat: 'fan', n: 5, spread: 0.25, speed: 14 },
    ] },
    meteor: { kind: 'seq', name: '隕炎', color: MAGMA, recover: 0.45, steps: [
      { at: 0.5, tele: 0.45, do: 'se', se: 'roar', pose: 'cast' },
      { at: 1.7, tele: 1.2, do: 'zones', o: 'rand', n: 7, spread: 11, first: false, r: 2.6, stagger: 0.1, fx: 'meteor' },
      { at: 2.0, tele: 1.3, do: 'zones', o: 'each', r: 3, burst: 6, fx: 'meteor' },
    ] },
    fan: { kind: 'seq', name: '火炎扇', color: EMBER, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'shots', pat: 'fan', n: 7, spread: 0.16, speed: 15, volleys: 3, gap: 0.3, alternate: true, pose: 'cast' },
    ] },
    ult: { kind: 'seq', ult: true, name: '灼熱の太陽', hint: '炎の衛星が迫る！ 隙間を抜けて、最後は回避', hpAt: ULT_AT, charge: 2.6, color: MAGMA, recover: 0.8, steps: [
      { at: 2.6, tele: 2.6, do: 'se', se: 'roar', shake: 0.6, pose: 'charge' },
      { at: 2.7, do: 'orbs', tele: 0.1, n: 10, rr0: 18, rr1: 1, dur: 3.6, speed: 1.2, r: 1.3, k: 0.6 },
      { at: 2.8, do: 'orbs', tele: 0.1, n: 6, rr0: 2, rr1: 16, dur: 3.4, speed: -1.6, r: 1.2, k: 0.6 },
      { at: 4.6, do: 'vfx', type: 'beat', d: { times: [1.8], lead: 1.2 } },
      { at: 6.4, do: 'all', flash: true, se: 'wave', pose: 'float' },
    ] },
  },
  rage: RAGE, restMin: 0.4, restMax: 0.85,
  look: { scale: 2.6, horn: 0xffd180, eye: 0xffff00, weapon: 'staff', metal: 0xbf360c },
};

// ---------------- 鍛冶神ヴァルカン ＆ 炎の魔女ブレイズ（第4の間・2体同時） ----------------
const vulcan = {
  name: '鍛冶神ヴァルカン', color: 0x5d4037,
  hp: 13400, def: 14, speed: 4.6, radius: 2.2, hpY: 8,
  shotHit: 1 / 5, meleeHit: 1 / 2.9,
  nearRange: 7,
  near: { anvil: 0.3, quake: 0.25, swing: 0.25, sparks: 0.2 },
  far: { hammer: 0.35, sparks: 0.3, quake: 0.35 },
  patterns: {
    anvil: { kind: 'seq', name: '金床落とし（十字）', color: MAGMA, recover: 0.55, steps: [
      { at: 0.95, tele: 0.85, do: 'hit', shape: 'cross', len: 13, w: 2.6, k: 1.2, fx: 'line', fxd: { tall: 2 }, pose: 'over', se: 'slam' },
      { at: 1.0, do: 'shots', pat: 'ring', n: 12, speed: 8 },
    ] },
    quake: { kind: 'seq', name: '鍛えの地響き', color: ASH, recover: 0.5, steps: [
      { at: 0.7, tele: 0.65, do: 'hit', shape: 'circle', r: 4.5, fx: 'pillar', pose: 'over' },
      { at: 1.4, tele: 0.65, do: 'hit', shape: 'donut', rIn: 4.5, rOut: 8.5, pose: 'over' },
      { at: 2.1, tele: 0.65, do: 'hit', shape: 'donut', rIn: 8.5, rOut: 12.5, pose: 'over' },
    ] },
    swing: { kind: 'seq', name: '大槌の薙ぎ', color: MAGMA, recover: 0.5, steps: [
      { at: 0.75, tele: 0.65, do: 'hit', shape: 'sector', r: 8, arc: 2.8, a: 0.01, fx: 'arc', pose: 'swing', se: 'swing' },
      { at: 1.4, tele: 0.5, do: 'hit', shape: 'sector', r: 8, arc: 2.8, a: -0.01, fx: 'arc', pose: 'swing', se: 'swing' },
    ] },
    hammer: { kind: 'seq', name: '投げ大槌', color: MAGMA, recover: 0.5, steps: [
      { at: 0.8, tele: 0.7, do: 'mover', r: 2.2, speed: 16, back: true, fx: 'axe', pose: 'over' },
    ] },
    sparks: { kind: 'seq', name: '火花散らし', color: EMBER, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'cluster', n: 5, spread: 0.3, speed: 10, pop: 0.8, ring: 7, pose: 'over' },
    ] },
    ult: { kind: 'seq', ult: true, name: '神の鍛錬', hint: '大槌を3回 振り下ろす！ 十字の間に逃げろ', hpAt: ULT_AT, charge: 2.4, color: MAGMA, recover: 0.8, steps: [
      { at: 2.4, tele: 2.4, do: 'se', se: 'roar', pose: 'charge' },
      { at: 3.4, tele: 1.0, do: 'hit', shape: 'cross', len: 26, w: 3.4, fx: 'line', fxd: { tall: 3 }, pose: 'over', se: 'slam' },
      { at: 4.4, tele: 0.9, do: 'hit', shape: 'cross', len: 26, w: 3.4, a: PI / 4, fx: 'line', fxd: { tall: 3 }, pose: 'over', se: 'slam' },
      { at: 5.4, tele: 0.9, do: 'hit', shape: 'cross', len: 26, w: 3.4, a: PI / 8, fx: 'line', fxd: { tall: 3 }, pose: 'over', se: 'slam' },
    ] },
  },
  rage: RAGE, restMin: 0.55, restMax: 1.1,
  look: { scale: 3.2, horn: 0xffab40, eye: 0xff6d00, weapon: 'club', metal: 0x3e2723 },
};

const blaze = {
  name: '炎の魔女ブレイズ', color: 0xd50000,
  hp: 12600, def: 9, speed: 5.0, radius: 1.4, hpY: 5.5, keep: 9,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 6,
  near: { pools: 0.3, warp: 0.3, orbs: 0.4 },
  far: { fireball: 0.3, pools: 0.25, meteor: 0.25, orbs: 0.2 },
  patterns: {
    fireball: { kind: 'seq', name: '火球三連', color: LAVA, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'cluster', n: 1, speed: 12, pop: 1.0, ring: 12, ringSpeed: 7, pose: 'cast' },
      { at: 0.9, tele: 0.3, do: 'cluster', n: 1, speed: 12, pop: 1.0, ring: 12, ringSpeed: 7, pose: 'cast' },
      { at: 1.3, tele: 0.3, do: 'cluster', n: 1, speed: 12, pop: 1.0, ring: 12, ringSpeed: 7, pose: 'cast' },
    ] },
    pools: { kind: 'seq', name: '溶岩の罠', color: LAVA, recover: 0.45, steps: [
      { at: 0.85, tele: 0.8, do: 'pool', o: 'each', r: 3, dur: 5, every: 0.5, k: 0.3, kind: 'lava', pose: 'cast', se: 'wave' },
      { at: 1.4, tele: 0.7, do: 'pool', o: 'rand', n: 3, spread: 10, first: false, r: 2.6, dur: 4.5, every: 0.5, k: 0.3, kind: 'lava' },
    ] },
    warp: { kind: 'seq', name: '炎の転移', color: EMBER, recover: 0.45, steps: [
      { at: 0.45, tele: 0.4, do: 'move', m: 'warp', to: 'rand', dist: 9, pose: 'float' },
      { at: 0.9, tele: 0.4, do: 'shots', pat: 'ring', n: 16, speed: 8, waves: 2, gap: 0.4, pose: 'cast' },
    ] },
    orbs: { kind: 'seq', name: '鬼火の輪', color: MAGMA, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'orbs', n: 5, rr0: 1.5, rr1: 11, dur: 2.8, speed: -2.2, r: 1, k: 0.6, pose: 'float' },
    ] },
    meteor: { kind: 'seq', name: '火の雨', color: MAGMA, recover: 0.45, steps: [
      { at: 0.5, tele: 0.45, do: 'se', se: 'seal', pose: 'cast' },
      { at: 1.7, tele: 1.15, do: 'zones', o: 'rand', n: 6, spread: 10, first: false, r: 2.4, stagger: 0.1, fx: 'meteor' },
      { at: 2.0, tele: 1.25, do: 'zones', o: 'each', r: 2.8, burst: 5, fx: 'meteor' },
    ] },
    ult: { kind: 'seq', ult: true, name: '業火の舞', hint: '足元が燃える！ 3回、出た溶岩から逃げろ', hpAt: ULT_AT, charge: 2.2, color: LAVA, recover: 0.7, steps: [
      { at: 2.2, tele: 2.2, do: 'se', se: 'seal', pose: 'charge' },
      { at: 3.0, tele: 0.8, do: 'pool', o: 'each', r: 3.4, dur: 3, every: 0.4, k: 0.4, kind: 'lava', pose: 'float' },
      { at: 4.2, tele: 0.8, do: 'pool', o: 'each', r: 3.4, dur: 3, every: 0.4, k: 0.4, kind: 'lava', pose: 'float' },
      { at: 5.4, tele: 0.8, do: 'pool', o: 'each', r: 3.4, dur: 3, every: 0.4, k: 0.4, kind: 'lava', pose: 'float' },
    ] },
  },
  rage: RAGE, restMin: 0.45, restMax: 0.95,
  look: { scale: 2.0, horn: 0x212121, eye: 0xffab00, weapon: 'staff', metal: 0xb71c1c },
};

// ---------------- 溶岩の巨神ムスペル（最後のボス・2倍の巨体） ----------------
const muspelBase = {
  name: '溶岩の巨神ムスペル', color: 0x3e2723,
  hp: 36000, def: 15, speed: 3.6, radius: 2.8, hpY: 8.5,
  shotHit: 1 / 5, meleeHit: 1 / 2.8,
  nearRange: 8,
  near: { fist: 0.2, sweep: 0.2, quake: 0.15, cross: 0.15, pools: 0.15, stomp: 0.15 },
  far: { boulder: 0.25, beam: 0.2, cross: 0.2, pools: 0.15, stomp: 0.2 },
  patterns: {
    fist: { kind: 'seq', name: '溶岩拳', color: LAVA, recover: 0.55, steps: [
      { at: 0.85, tele: 0.75, do: 'hit', o: 'tgt', shape: 'circle', r: 4, k: 1.2, fx: 'pillar', pose: 'over', se: 'slam' },
      { at: 0.9, tele: 0.1, do: 'pool', o: 'tgt', r: 3, dur: 4, every: 0.5, k: 0.3, kind: 'lava', reaim: false },
      { at: 1.6, tele: 0.6, do: 'hit', o: 'tgt', shape: 'circle', r: 4, k: 1.2, fx: 'pillar', pose: 'over', se: 'slam' },
    ] },
    sweep: { kind: 'seq', name: '巨腕の薙ぎ払い', color: MAGMA, recover: 0.5, steps: [
      { at: 0.8, tele: 0.7, do: 'hit', shape: 'sector', r: 10, arc: 3.0, a: 0.01, fx: 'arc', pose: 'swing', se: 'swing' },
      { at: 1.5, tele: 0.5, do: 'hit', shape: 'sector', r: 10, arc: 3.0, a: -0.01, fx: 'arc', pose: 'swing', se: 'swing' },
    ] },
    quake: { kind: 'seq', name: '大地震', color: ASH, recover: 0.5, steps: [
      { at: 0.8, tele: 0.75, do: 'hit', shape: 'circle', r: 5, fx: 'pillar', pose: 'crouch' },
      { at: 0.85, do: 'nova', max: 22, speed: 10, width: 0.8, waves: 3, gap: 0.5 },
    ] },
    cross: { kind: 'seq', name: '溶岩の十字裂', color: LAVA, recover: 0.5, steps: [
      { at: 0.95, tele: 0.85, do: 'hit', shape: 'cross', len: 20, w: 2.8, fx: 'line', fxd: { tall: 3 }, pose: 'over', se: 'slam' },
      { at: 1.7, tele: 0.65, do: 'hit', shape: 'cross', len: 20, w: 2.8, a: PI / 4, fx: 'line', fxd: { tall: 3 }, se: 'slam' },
    ] },
    pools: { kind: 'seq', name: '溶岩の沼', color: LAVA, recover: 0.45, steps: [
      { at: 0.9, tele: 0.85, do: 'pool', o: 'each', r: 3.2, dur: 5, every: 0.5, k: 0.3, kind: 'lava', pose: 'rear', se: 'wave' },
      { at: 1.5, tele: 0.8, do: 'pool', o: 'ring', n: 5, rr: 9, r: 3, dur: 4.5, every: 0.5, k: 0.3, kind: 'lava' },
    ] },
    stomp: { kind: 'seq', name: '跳躍踏み潰し', color: ASH, recover: 0.6, steps: [
      { at: 0.85, tele: 0.85, do: 'move', m: 'leap', dur: 0.85, h: 8, r: 5.5, k: 1.3, ring: 14, fx: 'pillar', pose: 'crouch' },
      { at: 1.8, tele: 0.2, do: 'pool', r: 4, dur: 4, every: 0.5, k: 0.3, kind: 'lava' },
    ] },
    boulder: { kind: 'seq', name: '火山岩投げ', color: EMBER, recover: 0.5, steps: [
      { at: 0.5, tele: 0.45, do: 'se', se: 'roar', pose: 'over' },
      { at: 1.8, tele: 1.25, do: 'zones', o: 'rand', n: 8, spread: 13, first: false, r: 2.8, stagger: 0.08, fx: 'meteor' },
      { at: 2.1, tele: 1.3, do: 'zones', o: 'each', r: 3.4, burst: 8, fx: 'meteor' },
    ] },
    beam: { kind: 'seq', name: '溶岩の奔流', color: MAGMA, recover: 0.6, steps: [
      { at: 0.95, tele: 0.85, do: 'rot', arms: 2, arc: 0.45, len: 22, speed: 1.0, a: -PI / 2, dur: 1.6, pose: 'lunge' },
      { at: 0.95, do: 'se', se: 'wave', pose: 'lunge', dur: 1.6 },
    ] },
    ult: { kind: 'seq', ult: true, name: '終焉の炎', hint: '火口が爆ぜる！ 岩の陰（巨神から見て後ろ）に隠れろ', hpAt: ULT_AT, charge: 3.0, color: LAVA, recover: 0.9, steps: [
      { at: 0.05, do: 'safe', groups: [{ kind: 'rock', n: 4, rr: 8, r: 2.4 }], show: 4.2 },
      { at: 3.0, tele: 3.0, do: 'se', se: 'roar', shake: 0.9, pose: 'charge' },
      { at: 2.0, do: 'zones', tele: 1.4, o: 'rand', n: 8, spread: 14, first: false, r: 2.8, fx: 'meteor', stagger: 0.06 },
      { at: 3.6, do: 'cover', pose: 'rear' },
    ] },
  },
  rage: { ...RAGE, summon: 'golem', summonEvery: 18, summonMax: 2, summonOffset: [8, 4] },
  restMin: 0.45, restMax: 0.9,
  look: { monster: 'golem', scale: 2.4, horn: 0x212121, eye: 0xffea00, glow: 0xff6d00 },
};
const muspel = giant(muspelBase, 2);

/** ステージ8のボス（data/enemies.js の BOSSES に足す） */
export const S8_BOSSES = { salamander, lavaworm, ifrit, vulcan, blaze, muspel };
