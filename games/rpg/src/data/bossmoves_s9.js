// ステージ9「星海の果て」（宇宙）のボス7体。技の書き方は src/bossmoves.js・src/bossmoves_ext.js
// 第4の間は3体同時（ルナ・ソル・ノヴァ）。最後の宇宙怪獣ギャラクトスは体も攻撃範囲も3倍、HP もけた違い（部屋も縦横3倍）
import { giant } from './bossscale.js';

const PI = Math.PI;
const ULT_AT = [0.75, 0.45, 0.2];
const RAGE = { at: 0.5, speedMul: 1.3, windupMul: 0.68, countMul: 1.2 };
const STAR = 0xb388ff;
const CYAN = 0x18ffff;
const NEBULA = 0xff4081;
const VOID = 0x4527a0;
const GOLD = 0xffd740;

// ---------------- 侵略円盤ゼノ（UFO） ----------------
const xeno = {
  name: '侵略円盤ゼノ', color: 0x78909c,
  hp: 22800, def: 12, speed: 6.0, radius: 2.4, hpY: 6,
  shotHit: 1 / 5, meleeHit: 1 / 2.9,
  nearRange: 7,
  near: { abduct: 0.25, drones: 0.2, grid: 0.2, bombs: 0.2, warp: 0.15 },
  far: { grid: 0.25, bombs: 0.25, laser: 0.25, drones: 0.25 },
  patterns: {
    abduct: { kind: 'seq', name: '牽引ビーム', color: CYAN, recover: 0.5, steps: [
      { at: 0.3, do: 'pull', strength: 5, dur: 1.6, pose: 'float' },
      { at: 0.3, do: 'vfx', type: 'coil', y: 0, d: { r: 10, dur: 1.7 } },
      { at: 2.0, tele: 1.7, do: 'hit', shape: 'circle', r: 5.5, k: 1.3, fx: 'pillar', fxd: { h: 14 }, pose: 'float' },
    ] },
    drones: { kind: 'seq', name: '護衛ドローン', color: CYAN, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'orbs', n: 4, rr0: 3, rr1: 12, dur: 3.2, speed: 2.6, r: 1, k: 0.6, pose: 'spinH' },
      { at: 1.2, do: 'shots', pat: 'spiral', arms: 4, dur: 1.6, interval: 0.15, turn: 0.22, speed: 8 },
    ] },
    grid: { kind: 'seq', name: '格子レーザー', color: NEBULA, recover: 0.5, steps: [
      { at: 1.0, tele: 0.9, do: 'hit', o: 'grid', n: 4, len: 34, gapW: 7, shape: 'rect', w: 1.8, fx: 'line', fxd: { tall: 4 }, pose: 'float', se: 'wave' },
      { at: 1.8, tele: 0.7, do: 'hit', o: 'grid', n: 4, len: 34, gapW: 7, a: PI / 4, shape: 'rect', w: 1.8, fx: 'line', fxd: { tall: 4 }, se: 'wave' },
    ] },
    bombs: { kind: 'seq', name: 'クラスター爆弾', color: GOLD, recover: 0.45, steps: [
      { at: 0.5, tele: 0.45, do: 'cluster', n: 6, spread: 0.3, speed: 11, pop: 0.85, ring: 7, pose: 'float' },
      { at: 1.3, tele: 0.3, do: 'cluster', n: 4, spread: 0.5, speed: 9, pop: 1.2, ring: 7 },
    ] },
    laser: { kind: 'seq', name: '旋回レーザー', color: NEBULA, recover: 0.55, steps: [
      { at: 0.9, tele: 0.8, do: 'rot', arms: 3, arc: 0.3, len: 22, speed: 1.2, dur: 2.0, pose: 'spinH' },
    ] },
    warp: { kind: 'seq', name: '空間跳躍', color: CYAN, recover: 0.45, steps: [
      { at: 0.4, tele: 0.35, do: 'move', m: 'warp', to: 'rand', dist: 9, pose: 'float' },
      { at: 0.9, tele: 0.45, do: 'hit', shape: 'circle', r: 5, fx: 'pillar', fxd: { h: 12 }, pose: 'float' },
      { at: 0.95, do: 'shots', pat: 'ring', n: 14, speed: 8 },
    ] },
    ult: { kind: 'seq', ult: true, name: '母艦の砲撃', hint: '格子のレーザーが3回！ 線の間に入れ', hpAt: ULT_AT, charge: 2.6, color: NEBULA, recover: 0.8, steps: [
      { at: 2.6, tele: 2.6, do: 'se', se: 'seal', pose: 'charge' },
      { at: 3.6, tele: 1.0, do: 'hit', o: 'grid', n: 6, len: 40, gapW: 6, shape: 'rect', w: 2, fx: 'line', fxd: { tall: 6 }, pose: 'float', se: 'wave' },
      { at: 4.6, tele: 0.9, do: 'hit', o: 'grid', n: 6, len: 40, gapW: 6, a: PI / 4, shape: 'rect', w: 2, fx: 'line', fxd: { tall: 6 }, se: 'wave' },
      { at: 5.6, tele: 0.9, do: 'hit', o: 'grid', n: 6, len: 40, gapW: 6, a: PI / 8, shape: 'rect', w: 2, fx: 'line', fxd: { tall: 6 }, se: 'wave' },
    ] },
  },
  rage: RAGE, restMin: 0.4, restMax: 0.85,
  look: { monster: 'saucer', scale: 2.0, horn: 0xb0bec5, eye: 0x18ffff, glow: 0x18ffff, metal: 0x546e7a, dome: 0x80deea },
};

// ---------------- 星を見張る眼オクルス ----------------
const oculus = {
  name: '星を見張る眼オクルス', color: 0x283593,
  hp: 22000, def: 10, speed: 3.8, radius: 2.2, hpY: 7, keep: 10,
  shotHit: 1 / 5, meleeHit: 1 / 2.9,
  nearRange: 7,
  near: { stare: 0.2, beams: 0.2, orbs: 0.2, void: 0.2, siege: 0.2 },
  far: { siege: 0.25, beams: 0.25, cluster: 0.25, void: 0.25 },
  patterns: {
    stare: { kind: 'seq', name: '星眼（目を逸らせ）', color: STAR, recover: 0.5, steps: [
      { at: 0.2, do: 'banner', text: '👁 目を見るな！（背を向けろ）' },
      { at: 1.9, tele: 1.7, do: 'facing', pose: 'float' },
      { at: 2.0, do: 'shots', pat: 'ring', n: 16, speed: 8 },
    ] },
    beams: { kind: 'seq', name: '三条の眼光', color: STAR, recover: 0.55, steps: [
      { at: 0.9, tele: 0.8, do: 'rot', arms: 3, arc: 0.35, len: 24, speed: -1.1, dur: 2.2, pose: 'float' },
    ] },
    orbs: { kind: 'seq', name: '衛星の環', color: CYAN, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'orbs', n: 7, rr0: 14, rr1: 2, dur: 3.2, speed: 1.5, r: 1.1, k: 0.6, pose: 'float' },
    ] },
    void: { kind: 'seq', name: '虚無の穴', color: VOID, recover: 0.45, steps: [
      { at: 0.9, tele: 0.85, do: 'pool', o: 'each', r: 3.2, dur: 5, every: 0.5, k: 0.3, kind: 'void', pose: 'flail', se: 'seal' },
      { at: 1.0, do: 'pull', strength: 2.6, dur: 1.6 },
    ] },
    siege: { kind: 'seq', name: '包囲光線', color: NEBULA, recover: 0.5, steps: [
      { at: 0.95, tele: 0.85, do: 'hit', o: 'around', n: 5, dist: 11, shape: 'rect', len: 22, w: 1.6, fx: 'line', fxd: { tall: 4 }, pose: 'float', se: 'wave' },
      { at: 1.7, tele: 0.65, do: 'hit', o: 'around', n: 5, dist: 11, off: PI / 5, shape: 'rect', len: 22, w: 1.6, fx: 'line', fxd: { tall: 4 }, se: 'wave' },
    ] },
    cluster: { kind: 'seq', name: '弾ける星屑', color: STAR, recover: 0.4, steps: [
      { at: 0.55, tele: 0.5, do: 'cluster', n: 5, spread: 0.35, speed: 10, pop: 1.0, ring: 8, pose: 'flail' },
    ] },
    ult: { kind: 'seq', ult: true, name: '万象の凝視', hint: '目を開く→光線に囲まれる→目を開く！ 背を向けて、隙間を抜けろ', hpAt: ULT_AT, charge: 2.6, color: STAR, recover: 0.8, steps: [
      { at: 2.6, tele: 2.6, do: 'se', se: 'seal', pose: 'charge' },
      { at: 2.7, do: 'banner', text: '👁 背を向けろ！' },
      { at: 4.0, tele: 1.2, do: 'facing', pose: 'float' },
      { at: 5.2, tele: 1.0, do: 'hit', o: 'around', n: 8, dist: 12, shape: 'rect', len: 24, w: 1.8, fx: 'line', fxd: { tall: 5 }, se: 'wave' },
      { at: 5.4, do: 'banner', text: '👁 背を向けろ！' },
      { at: 6.6, tele: 1.1, do: 'facing', pose: 'float' },
    ] },
  },
  rage: RAGE, restMin: 0.45, restMax: 0.9,
  look: { monster: 'eye', scale: 2.4, horn: 0x5c6bc0, eye: 0xb388ff, belly: 0xe8eaf6 },
};

// ---------------- 星騎士オリオン（星座の剣士） ----------------
const orion = {
  name: '星騎士オリオン', color: 0x1a237e,
  hp: 23400, def: 12, speed: 6.6, radius: 1.6, hpY: 6,
  shotHit: 1 / 5, meleeHit: 1 / 2.9,
  nearRange: 6,
  near: { slash: 0.25, cross: 0.2, zigzag: 0.2, siege: 0.15, spin: 0.2 },
  far: { zigzag: 0.25, meteor: 0.25, siege: 0.25, arrows: 0.25 },
  patterns: {
    slash: { kind: 'seq', name: '星剣三連', color: GOLD, recover: 0.4, steps: [
      { at: 0.45, tele: 0.4, do: 'hit', shape: 'sector', r: 5.5, arc: 2.0, a: 0.01, k: 0.7, fx: 'arc', pose: 'swing', se: 'swing' },
      { at: 0.8, tele: 0.32, do: 'hit', shape: 'sector', r: 5.5, arc: 2.0, a: -0.01, k: 0.7, fx: 'arc', pose: 'swing', se: 'swing' },
      { at: 1.3, tele: 0.45, do: 'hit', shape: 'rect', len: 12, w: 2.4, k: 1.1, fx: 'line', fxd: { tall: 2 }, pose: 'lunge', se: 'swing' },
    ] },
    cross: { kind: 'seq', name: '十字星', color: GOLD, recover: 0.5, steps: [
      { at: 0.9, tele: 0.8, do: 'hit', o: 'tgt', shape: 'cross', len: 12, w: 2.2, fx: 'line', fxd: { tall: 3 }, pose: 'over', se: 'slam' },
      { at: 1.6, tele: 0.6, do: 'hit', o: 'tgt', shape: 'cross', len: 12, w: 2.2, a: PI / 4, fx: 'line', fxd: { tall: 3 }, se: 'slam' },
    ] },
    zigzag: { kind: 'seq', name: '流星の踏み込み', color: STAR, recover: 0.45, steps: [
      { at: 0.5, tele: 0.45, do: 'move', m: 'dash', speed: 30, dur: 0.35, w: 3, k: 0.8, a: -0.55, pose: 'lunge' },
      { at: 1.05, tele: 0.4, do: 'move', m: 'dash', speed: 30, dur: 0.35, w: 3, k: 0.8, a: 0.55, pose: 'lunge' },
      { at: 1.6, tele: 0.4, do: 'move', m: 'dash', speed: 32, dur: 0.4, w: 3, k: 1, pose: 'lunge' },
    ] },
    siege: { kind: 'seq', name: '星座の檻', color: CYAN, recover: 0.5, steps: [
      { at: 0.95, tele: 0.85, do: 'hit', o: 'around', n: 6, dist: 10, shape: 'rect', len: 20, w: 1.5, fx: 'line', fxd: { tall: 3 }, pose: 'cast', se: 'wave' },
    ] },
    spin: { kind: 'seq', name: '銀河旋風', color: STAR, recover: 0.5, steps: [
      { at: 0.5, tele: 0.45, do: 'move', m: 'dash', speed: 6, dur: 1.4, hitR: -1, pose: 'spin' },
      ...[0.5, 0.9, 1.3, 1.7].map((at, i) => ({ at, tele: i ? 0.2 : 0.45, do: 'hit', shape: 'circle', r: 4.4, k: 0.55, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'spin' })),
    ] },
    meteor: { kind: 'seq', name: '流星群', color: CYAN, recover: 0.45, steps: [
      { at: 0.5, tele: 0.45, do: 'se', se: 'seal', pose: 'cast' },
      { at: 1.7, tele: 1.2, do: 'zones', o: 'rand', n: 8, spread: 12, first: false, r: 2.4, stagger: 0.08, fx: 'meteor' },
      { at: 2.0, tele: 1.3, do: 'zones', o: 'each', r: 3, burst: 6, fx: 'meteor' },
    ] },
    arrows: { kind: 'seq', name: '星の矢', color: GOLD, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'shots', pat: 'fan', n: 5, spread: 0.14, speed: 22, volleys: 3, gap: 0.28, pose: 'over' },
    ] },
    ult: { kind: 'seq', ult: true, name: '天の剣', hint: '星座の檻→十字星×2！ 隙間と線の間を見極めろ', hpAt: ULT_AT, charge: 2.6, color: GOLD, recover: 0.8, steps: [
      { at: 2.6, tele: 2.6, do: 'se', se: 'seal', pose: 'charge' },
      { at: 3.6, tele: 1.0, do: 'hit', o: 'around', n: 8, dist: 11, shape: 'rect', len: 22, w: 1.6, fx: 'line', fxd: { tall: 4 }, pose: 'cast', se: 'wave' },
      { at: 4.6, tele: 0.9, do: 'hit', o: 'tgt', shape: 'cross', len: 30, w: 3, fx: 'line', fxd: { tall: 5 }, pose: 'over', se: 'slam' },
      { at: 5.5, tele: 0.8, do: 'hit', o: 'tgt', shape: 'cross', len: 30, w: 3, a: PI / 4, fx: 'line', fxd: { tall: 5 }, pose: 'over', se: 'slam' },
    ] },
  },
  rage: RAGE, restMin: 0.4, restMax: 0.85,
  look: { scale: 2.3, horn: 0xffd740, eye: 0x18ffff, weapon: 'sword', metal: 0x283593 },
};

// ---------------- 三連星（第4の間・3体同時）：月の魔女ルナ・太陽の剣士ソル・彗星獣ノヴァ ----------------
const luna = {
  name: '月の魔女ルナ', color: 0x90a4ae,
  hp: 9800, def: 9, speed: 4.8, radius: 1.4, hpY: 5.5, keep: 10,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 6,
  near: { orbs: 0.4, warp: 0.3, void: 0.3 },
  far: { crescent: 0.35, void: 0.3, orbs: 0.35 },
  patterns: {
    crescent: { kind: 'seq', name: '三日月の刃', color: 0xe1f5fe, recover: 0.45, steps: [
      { at: 0.55, tele: 0.5, do: 'shots', pat: 'fan', n: 7, spread: 0.18, speed: 13, volleys: 2, gap: 0.45, alternate: true, pose: 'cast' },
    ] },
    orbs: { kind: 'seq', name: '月の満ち欠け', color: 0xe1f5fe, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'orbs', n: 5, rr0: 1.5, rr1: 11, dur: 2.8, speed: 2, r: 1, k: 0.6, pose: 'float' },
    ] },
    void: { kind: 'seq', name: '月影の沼', color: VOID, recover: 0.45, steps: [
      { at: 0.85, tele: 0.8, do: 'pool', o: 'each', r: 3, dur: 4.5, every: 0.5, k: 0.3, kind: 'void', pose: 'cast', se: 'seal' },
    ] },
    warp: { kind: 'seq', name: '月渡り', color: 0xe1f5fe, recover: 0.45, steps: [
      { at: 0.45, tele: 0.4, do: 'move', m: 'warp', to: 'rand', dist: 10, pose: 'float' },
      { at: 0.9, tele: 0.4, do: 'shots', pat: 'ring', n: 14, speed: 7, waves: 2, gap: 0.45 },
    ] },
    ult: { kind: 'seq', ult: true, name: '月蝕', hint: '月が欠ける！ ルナに背を向けろ（2回）', hpAt: ULT_AT, charge: 2.2, color: 0xe1f5fe, recover: 0.7, steps: [
      { at: 2.2, tele: 2.2, do: 'se', se: 'seal', pose: 'charge' },
      { at: 2.3, do: 'banner', text: '🌙 背を向けろ！' },
      { at: 3.6, tele: 1.2, do: 'facing', pose: 'float' },
      { at: 3.8, do: 'banner', text: '🌙 背を向けろ！' },
      { at: 5.1, tele: 1.2, do: 'facing', pose: 'float' },
    ] },
  },
  rage: RAGE, restMin: 0.5, restMax: 1.0,
  look: { scale: 2.0, horn: 0xeceff1, eye: 0x80d8ff, weapon: 'staff', metal: 0x607d8b },
};

const sol = {
  name: '太陽の剣士ソル', color: 0xff8f00,
  hp: 10400, def: 11, speed: 6.4, radius: 1.5, hpY: 5.8,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 6,
  near: { slash: 0.35, flare: 0.35, dash: 0.3 },
  far: { dash: 0.4, cross: 0.3, flare: 0.3 },
  patterns: {
    slash: { kind: 'seq', name: '日輪斬', color: GOLD, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'hit', shape: 'sector', r: 5.5, arc: 2.2, a: 0.01, k: 0.8, fx: 'arc', pose: 'swing', se: 'swing' },
      { at: 1.0, tele: 0.4, do: 'hit', shape: 'circle', r: 4.5, k: 0.9, fx: 'arc', fxd: { arc: 6.28 }, impact: false, pose: 'spin', se: 'spin' },
    ] },
    flare: { kind: 'seq', name: '太陽フレア', color: GOLD, recover: 0.5, steps: [
      { at: 0.8, tele: 0.75, do: 'hit', shape: 'circle', r: 5, fx: 'pillar', pose: 'rear' },
      { at: 0.85, do: 'nova', max: 16, speed: 11, width: 0.7, waves: 2, gap: 0.45 },
    ] },
    dash: { kind: 'seq', name: '陽炎の突撃', color: 0xffab00, recover: 0.45, steps: [
      { at: 0.55, tele: 0.5, do: 'move', m: 'dash', speed: 30, dur: 0.45, w: 3, k: 1, pose: 'lunge' },
      { at: 1.2, tele: 0.45, do: 'move', m: 'dash', speed: 30, dur: 0.45, w: 3, k: 1, pose: 'lunge' },
    ] },
    cross: { kind: 'seq', name: '光の十字', color: GOLD, recover: 0.5, steps: [
      { at: 0.9, tele: 0.8, do: 'hit', o: 'tgt', shape: 'cross', len: 11, w: 2, fx: 'line', fxd: { tall: 3 }, pose: 'over', se: 'slam' },
    ] },
    ult: { kind: 'seq', ult: true, name: '日輪の極光', hint: '太陽が3回 爆ぜる！ 輪が縮んだら回避', hpAt: ULT_AT, charge: 2.2, color: GOLD, recover: 0.7, steps: [
      { at: 2.2, tele: 2.2, do: 'se', se: 'roar', pose: 'charge' },
      { at: 2.3, do: 'vfx', type: 'beat', d: { times: [1.2, 2.2, 3.2], lead: 1.0 } },
      { at: 3.5, do: 'all', flash: true, se: 'slam', pose: 'rear' },
      { at: 4.5, do: 'all', flash: true, se: 'slam', pose: 'rear' },
      { at: 5.5, do: 'all', flash: true, se: 'slam', pose: 'rear' },
    ] },
  },
  rage: RAGE, restMin: 0.45, restMax: 0.95,
  look: { scale: 2.1, horn: 0xffd740, eye: 0xffff00, weapon: 'sword', metal: 0xe65100 },
};

const nova = {
  name: '彗星獣ノヴァ', color: 0x00b8d4,
  hp: 9600, def: 10, speed: 7.2, radius: 1.9, hpY: 5.5,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 7,
  near: { bite: 0.35, comet: 0.3, tail: 0.35 },
  far: { comet: 0.4, spit: 0.3, circle: 0.3 },
  patterns: {
    bite: { kind: 'seq', name: '星牙', color: CYAN, recover: 0.4, steps: [
      { at: 0.45, tele: 0.4, do: 'hit', shape: 'sector', r: 6, arc: 1.2, k: 0.9, fx: 'bite', fxDist: 3.5, pose: 'bite', se: 'swing' },
      { at: 0.9, tele: 0.35, do: 'hit', shape: 'sector', r: 6.5, arc: 1.0, k: 1, fx: 'bite', fxDist: 4, pose: 'bite', se: 'swing' },
    ] },
    comet: { kind: 'seq', name: '彗星落下', color: CYAN, recover: 0.55, steps: [
      { at: 0.55, tele: 0.45, do: 'move', m: 'rise', h: 12, dur: 0.55, pose: 'wings' },
      { at: 2.1, tele: 1.4, do: 'move', m: 'dive', dur: 0.4, r: 5, follow: 0.9, ring: 12, fx: 'pillar' },
    ] },
    tail: { kind: 'seq', name: '尾の流星', color: CYAN, recover: 0.45, steps: [
      { at: 0.55, tele: 0.45, do: 'hit', shape: 'sector', r: 7, arc: 2.4, a: PI, fx: 'arc', pose: 'tail', se: 'swing' },
      { at: 0.65, do: 'cluster', n: 3, spread: 0.6, speed: 9, pop: 0.8, ring: 6 },
    ] },
    spit: { kind: 'seq', name: '星屑のブレス', color: CYAN, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'shots', pat: 'fan', n: 6, spread: 0.2, speed: 14, volleys: 3, gap: 0.3, pose: 'lunge' },
    ] },
    circle: { kind: 'seq', name: '旋回→突進', color: CYAN, recover: 0.5, steps: [
      { at: 0.3, tele: 0.25, do: 'move', m: 'orbit', rr: 9, speed: 2.4, dur: 1.3, pose: 'lunge' },
      { at: 2.1, tele: 0.5, do: 'move', m: 'dash', speed: 28, dur: 0.5, w: 4, k: 1.1, pose: 'crouch' },
    ] },
    ult: { kind: 'seq', ult: true, name: '大彗星', hint: '空から突っ込んでくる！ 追ってくる円から逃げ切れ（2回）', hpAt: ULT_AT, charge: 2.2, color: CYAN, recover: 0.7, steps: [
      { at: 2.2, tele: 2.2, do: 'se', se: 'roar', pose: 'charge' },
      { at: 2.6, tele: 0.3, do: 'move', m: 'rise', h: 18, dur: 0.4, pose: 'wings' },
      { at: 4.4, tele: 1.6, do: 'move', m: 'dive', dur: 0.35, r: 6, follow: 1.2, ring: 16, fx: 'pillar' },
      { at: 4.9, tele: 0.3, do: 'move', m: 'rise', h: 18, dur: 0.4, pose: 'wings' },
      { at: 6.6, tele: 1.5, do: 'move', m: 'dive', dur: 0.35, r: 6, follow: 1.1, ring: 16, fx: 'pillar' },
    ] },
  },
  rage: RAGE, restMin: 0.45, restMax: 0.9,
  look: { monster: 'beast', wings: true, scale: 1.7, horn: 0x84ffff, eye: 0xffffff, belly: 0xb2ebf2, wingColor: 0x006064, mane: 0xe0f7fa },
};

// ---------------- 宇宙怪獣ギャラクトス（最後のボス・3倍の巨体） ----------------
const galactosBase = {
  name: '宇宙怪獣ギャラクトス', color: 0x311b92,
  hp: 150000, def: 16, speed: 3.4, radius: 2.4, hpY: 6.5,
  shotHit: 1 / 4.8, meleeHit: 1 / 2.7,
  nearRange: 7,
  near: { stomp: 0.15, tail: 0.15, claws: 0.15, crystals: 0.15, hole: 0.1, cross: 0.15, quake: 0.15 },
  far: { breath: 0.2, meteor: 0.2, siege: 0.15, crystals: 0.15, cluster: 0.15, hole: 0.15 },
  patterns: {
    stomp: { kind: 'seq', name: '大怪獣の踏みつけ', color: VOID, recover: 0.55, steps: [
      { at: 0.85, tele: 0.75, do: 'hit', o: 'tgt', shape: 'circle', r: 3.4, k: 1.2, fx: 'pillar', pose: 'crouch', se: 'slam' },
      { at: 1.6, tele: 0.6, do: 'hit', o: 'tgt', shape: 'circle', r: 3.4, k: 1.2, fx: 'pillar', pose: 'crouch', se: 'slam' },
      { at: 1.65, do: 'shots', pat: 'ring', n: 16, speed: 8 },
    ] },
    tail: { kind: 'seq', name: '星尾の一撃', color: STAR, recover: 0.5, steps: [
      { at: 0.75, tele: 0.65, do: 'hit', shape: 'sector', r: 8, arc: 3.4, a: PI, fx: 'arc', pose: 'tail', se: 'swing' },
      { at: 0.8, do: 'cluster', n: 4, spread: 0.6, speed: 9, pop: 0.9, ring: 7 },
    ] },
    claws: { kind: 'seq', name: '宇宙爪', color: STAR, recover: 0.5, steps: [
      { at: 0.6, tele: 0.5, do: 'hit', shape: 'sector', r: 6.5, arc: 1.6, a: 0.01, k: 0.8, fx: 'claw', fxd: { r: 6 }, pose: 'clap', se: 'swing' },
      { at: 1.05, tele: 0.4, do: 'hit', shape: 'sector', r: 6.5, arc: 1.6, a: -0.01, k: 0.8, fx: 'claw', fxd: { r: 6 }, pose: 'clap', se: 'swing' },
    ] },
    crystals: { kind: 'seq', name: '背びれの結晶衛星', color: CYAN, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'orbs', n: 8, rr0: 2, rr1: 9, dur: 3.4, speed: 1.4, r: 0.8, k: 0.6, pose: 'rear' },
      { at: 1.2, do: 'orbs', tele: 0.1, n: 6, rr0: 10, rr1: 2, dur: 3.0, speed: -1.6, r: 0.8, k: 0.6 },
    ] },
    hole: { kind: 'seq', name: 'ブラックホール', color: VOID, recover: 0.55, steps: [
      { at: 0.4, do: 'pull', strength: 4.4, spin: 3, dur: 2.2, pose: 'charge' },
      { at: 0.5, tele: 0.5, do: 'pool', o: 'tgt', r: 3, dur: 4, every: 0.45, k: 0.35, kind: 'void' },
      { at: 0.5, do: 'vfx', type: 'coil', y: 0, d: { r: 9, dur: 2.2 } },
      { at: 2.6, tele: 1.4, do: 'hit', shape: 'circle', r: 4, k: 1.3, fx: 'pillar', pose: 'rear' },
    ] },
    cross: { kind: 'seq', name: '十字の星光', color: GOLD, recover: 0.5, steps: [
      { at: 0.95, tele: 0.85, do: 'hit', shape: 'cross', len: 14, w: 1.6, fx: 'line', fxd: { tall: 3 }, pose: 'rear', se: 'wave' },
      { at: 1.7, tele: 0.65, do: 'hit', shape: 'cross', len: 14, w: 1.6, a: PI / 4, fx: 'line', fxd: { tall: 3 }, se: 'wave' },
    ] },
    quake: { kind: 'seq', name: '星震', color: VOID, recover: 0.5, steps: [
      { at: 0.8, tele: 0.75, do: 'hit', shape: 'circle', r: 3.5, fx: 'pillar', pose: 'crouch' },
      { at: 0.85, do: 'nova', max: 14, speed: 7, width: 0.5, waves: 3, gap: 0.55 },
    ] },
    breath: { kind: 'seq', name: '銀河の熱線', color: CYAN, recover: 0.6, steps: [
      { at: 1.0, tele: 0.9, do: 'rot', arms: 1, arc: 0.3, len: 16, speed: 1.3, a: -1.1, dur: 1.7, sweepTele: true, pose: 'lunge' },
      { at: 1.0, do: 'se', se: 'wave', pose: 'lunge', dur: 1.7 },
    ] },
    meteor: { kind: 'seq', name: '隕石嵐', color: NEBULA, recover: 0.5, steps: [
      { at: 0.5, tele: 0.45, do: 'se', se: 'roar', pose: 'rear' },
      { at: 1.8, tele: 1.25, do: 'zones', o: 'rand', n: 12, spread: 9, first: false, r: 1.6, stagger: 0.07, fx: 'meteor' },
      { at: 2.1, tele: 1.3, do: 'zones', o: 'each', r: 2, burst: 8, fx: 'meteor' },
    ] },
    siege: { kind: 'seq', name: '星光の包囲', color: NEBULA, recover: 0.5, steps: [
      { at: 1.0, tele: 0.9, do: 'hit', o: 'around', n: 6, dist: 7, shape: 'rect', len: 14, w: 1.1, fx: 'line', fxd: { tall: 3 }, pose: 'rear', se: 'wave' },
      { at: 1.75, tele: 0.65, do: 'hit', o: 'around', n: 6, dist: 7, off: PI / 6, shape: 'rect', len: 14, w: 1.1, fx: 'line', fxd: { tall: 3 }, se: 'wave' },
    ] },
    cluster: { kind: 'seq', name: '弾ける星雲', color: NEBULA, recover: 0.45, steps: [
      { at: 0.55, tele: 0.5, do: 'cluster', n: 7, spread: 0.26, speed: 11, pop: 1.0, ring: 9, pose: 'lunge' },
    ] },
    ult: { kind: 'seq', ult: true, name: '銀河崩壊', hint: '星が墜ちる→重力で引かれる→最後は輪に合わせて回避！', hpAt: ULT_AT, charge: 3.2, color: NEBULA, recover: 1.0, steps: [
      { at: 3.2, tele: 3.2, do: 'se', se: 'roar', shake: 1, pose: 'charge' },
      { at: 1.8, do: 'zones', tele: 1.4, o: 'rand', n: 14, spread: 10, first: false, r: 1.8, fx: 'meteor', stagger: 0.05 },
      { at: 3.4, do: 'banner', text: '🌌 重力に逆らえ！' },
      { at: 3.4, do: 'pull', strength: 5, spin: 2.5, dur: 2.2 },
      { at: 3.4, do: 'vfx', type: 'coil', y: 0, d: { r: 10, dur: 2.2 } },
      { at: 5.6, tele: 2.2, do: 'hit', shape: 'circle', r: 4.5, fx: 'pillar', fxd: { h: 30 }, pose: 'rear' },
      { at: 5.7, do: 'vfx', type: 'beat', d: { times: [1.6], lead: 1.2 } },
      { at: 5.75, do: 'banner', text: '✦ 輪が縮んだら回避！' },
      { at: 7.3, do: 'all', flash: true, se: 'wave', pose: 'rear' },
    ] },
  },
  rage: { ...RAGE, summon: 'golem', summonEvery: 16, summonMax: 3, summonOffset: [12, 6] },
  restMin: 0.35, restMax: 0.8,
  look: { monster: 'kaiju', scale: 2.6, horn: 0xb39ddb, eye: 0xff4081, belly: 0x5e35b1, glow: 0x18ffff },
};
const galactos = giant(galactosBase, 3);

/** ステージ9のボス（data/enemies.js の BOSSES に足す） */
export const S9_BOSSES = { xeno, oculus, orion, luna, sol, nova, galactos };
