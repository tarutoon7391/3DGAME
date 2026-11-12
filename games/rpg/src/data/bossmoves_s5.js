// ステージ5「黄昏の古戦場」のボスの固有技（各7種）と必殺技。動かし方は src/bossmoves.js
// 1つの技 = { kind: 'seq', name, steps: [...], recover, after }。steps の書き方は bossmoves.js の先頭を参照
// 必殺技（ult）は HP が hpAt を切るたびに1回。溜め（charge 秒）の間、画面に警告を出す。威力は通常の3倍（k: 3 が既定）
const PI = Math.PI;
const ULT_AT = [0.75, 0.45, 0.2];

// ---------------- 地獄の番犬ケルベロス（炎・速い獣） ----------------
const FIRE = 0xff5722;
const cerberus = {
  nearRange: 7,
  near: { bite3: 0.25, tail: 0.2, ring: 0.2, pounce: 0.15, rush: 0.2 },
  far: { breath3: 0.3, howl: 0.25, pounce: 0.2, rush: 0.25 },
  patterns: {
    bite3: { kind: 'seq', name: '三つ首の連続噛みつき', color: FIRE, recover: 0.45, steps: [
      { at: 0.55, tele: 0.45, do: 'hit', shape: 'sector', r: 6, arc: 1.3, a: -0.45, k: 0.7, fx: 'bite', fxDist: 3.5, pose: 'bite', se: 'swing' },
      { at: 0.95, tele: 0.35, do: 'hit', shape: 'sector', r: 6, arc: 1.3, a: 0.45, k: 0.7, fx: 'bite', fxDist: 3.5, pose: 'bite', se: 'swing' },
      { at: 1.4, tele: 0.4, do: 'hit', shape: 'sector', r: 7, arc: 1.0, k: 1, fx: 'bite', fxDist: 4, pose: 'bite', se: 'swing' },
    ] },
    breath3: { kind: 'seq', name: '三方向の業火ブレス', color: 0xff3d00, recover: 0.6, steps: [
      { at: 1.0, tele: 0.85, do: 'hit', o: 'fan', n: 3, spread: 0.62, shape: 'rect', len: 17, w: 3.2, fx: 'breath', fxDur: 0.5, fxd: { y: 3.5 }, pose: 'rear', se: 'wave' },
      { at: 1.6, do: 'shots', pat: 'fan', n: 9, spread: 0.24, speed: 14, volleys: 2, gap: 0.3 },
    ] },
    pounce: { kind: 'seq', name: '飛びかかり', color: FIRE, recover: 0.5, steps: [
      { at: 0.6, tele: 0.6, do: 'move', m: 'leap', dur: 0.6, h: 5, r: 3.8, fx: 'pillar', pose: 'crouch' },
      { at: 1.6, tele: 0.3, do: 'hit', shape: 'sector', r: 6, arc: 1.4, k: 0.8, fx: 'bite', fxDist: 3.5, pose: 'bite', se: 'swing' },
    ] },
    ring: { kind: 'seq', name: '地獄の炎の輪（外→内）', color: 0xff3d00, recover: 0.5, steps: [
      { at: 0.75, tele: 0.7, do: 'hit', shape: 'circle', r: 4.8, fx: 'pillar', pose: 'rear' },
      { at: 1.7, tele: 0.85, do: 'hit', shape: 'donut', rIn: 4.8, rOut: 13, pose: 'crouch' },
      { at: 1.7, do: 'nova', max: 18, speed: 11 },
    ] },
    tail: { kind: 'seq', name: '尻尾薙ぎ→振り向き噛み', color: FIRE, recover: 0.45, steps: [
      { at: 0.6, tele: 0.5, do: 'hit', shape: 'sector', r: 7, arc: 2.4, a: PI, fx: 'arc', pose: 'tail', se: 'swing' },
      { at: 1.15, tele: 0.35, do: 'hit', shape: 'sector', r: 6, arc: 1.2, k: 0.8, fx: 'bite', fxDist: 3.5, pose: 'bite', se: 'swing' },
    ] },
    howl: { kind: 'seq', name: '遠吠え（火の玉を呼ぶ）', color: 0xff7043, recover: 0.4, steps: [
      { at: 0.8, tele: 0.8, do: 'nova', max: 10, speed: 10, pose: 'rear' },
      { at: 0.8, do: 'se', se: 'roar', shake: 0.5 },
      { at: 2.0, tele: 1.15, do: 'zones', o: 'each', r: 3, burst: 6, fx: 'meteor' },
      { at: 2.3, tele: 1.2, do: 'zones', o: 'rand', n: 5, spread: 12, first: false, r: 2.6, stagger: 0.12, fx: 'meteor' },
    ] },
    rush: { kind: 'seq', name: '突進噛みつき', color: 0xff3d00, recover: 0.5, steps: [
      { at: 0.6, tele: 0.6, do: 'move', m: 'dash', speed: 26, dur: 0.55, w: 4.4, pose: 'crouch' },
      { at: 1.5, tele: 0.3, do: 'hit', shape: 'sector', r: 6.5, arc: 1.4, k: 1.2, fx: 'bite', fxDist: 4, pose: 'bite', se: 'swing' },
    ] },
    ult: { kind: 'seq', ult: true, name: '冥界の三重咆哮', hint: '3本のブレスのすき間に入って、回るのに合わせて回り込め！', hpAt: ULT_AT, charge: 2.6, color: 0xff3d00, recover: 0.8, steps: [
      { at: 2.6, tele: 2.6, do: 'se', se: 'roar', shake: 0.8, pose: 'charge' },
      { at: 2.7, tele: 1.2, do: 'rot', arms: 3, arc: 0.9, len: 26, speed: 0.55, dur: 4.2, colors: [0xff3d00, 0xff9100, 0xd50000] },
      { at: 2.7, do: 'se', se: 'wave', pose: 'rear', dur: 4.2 },
    ] },
  },
  look: { monster: 'beast', scale: 2.0, horn: 0x212121, eye: 0xff3d00, belly: 0x5d4037, mane: 0xbf360c, heads: 3 },
};

// ---------------- 双頭のバジリスク（毒・石化。距離を取る） ----------------
const VENOM = 0x9ccc65;
const STONE = 0xeeff41;
const basilisk = {
  nearRange: 6,
  near: { pincer: 0.25, tail: 0.2, coil: 0.2, breath: 0.2, burrow: 0.15 },
  far: { gaze: 0.25, volley: 0.25, tail: 0.15, burrow: 0.2, breath: 0.15 },
  patterns: {
    gaze: { kind: 'seq', name: '石化の視線（二つの首）', color: STONE, recover: 0.5, steps: [
      { at: 0.9, tele: 0.8, do: 'hit', shape: 'rect', len: 32, w: 2.2, fx: 'line', fxd: { tall: 2.5 }, pose: 'rear', se: 'wave' },
      { at: 1.55, tele: 0.55, do: 'hit', shape: 'rect', len: 32, w: 2.2, fx: 'line', fxd: { tall: 2.5 }, pose: 'rear', se: 'wave' },
    ] },
    pincer: { kind: 'seq', name: '双頭の挟み噛み', color: VENOM, recover: 0.45, steps: [
      { at: 0.7, tele: 0.55, do: 'hit', shape: 'sector', r: 6.5, arc: 1.0, a: -0.7, k: 0.8, fx: 'bite', fxDist: 3.5 },
      { at: 0.7, tele: 0.55, do: 'hit', shape: 'sector', r: 6.5, arc: 1.0, a: 0.7, k: 0.8, fx: 'bite', fxDist: 3.5, pose: 'bite', se: 'swing' },
      { at: 1.3, tele: 0.4, do: 'hit', shape: 'sector', r: 7.5, arc: 0.8, fx: 'bite', fxDist: 4.5, pose: 'bite', se: 'swing' },
    ] },
    breath: { kind: 'seq', name: '毒の吐息', color: VENOM, recover: 0.5, steps: [
      { at: 0.9, tele: 0.75, do: 'hit', shape: 'sector', r: 12, arc: 0.9, fx: 'breath', fxDur: 0.7, fxd: { len: 12, w: 8, y: 3 }, pose: 'lunge', se: 'wave' },
      { at: 1.7, tele: 0.55, do: 'zones', o: 'fan', n: 3, spread: 0.3, dist: 7, reaim: false, r: 2.4, burst: 4 },
    ] },
    tail: { kind: 'seq', name: '尾の叩きつけ', color: 0xafb42b, recover: 0.5, steps: [
      { at: 1.0, tele: 0.9, do: 'zones', o: 'tgt', r: 4, burst: 10, fx: 'pillar', pose: 'tail' },
    ] },
    burrow: { kind: 'seq', name: '地中に潜って奇襲', color: 0x9e9d24, recover: 0.6, steps: [
      { at: 0.5, tele: 0.45, do: 'move', m: 'hide', pose: 'crouch' },
      { at: 2.3, tele: 1.7, do: 'move', m: 'warp', to: 'tgt', follow: 1.15, r: 4.6, ring: 10, fx: 'pillar' },
    ] },
    volley: { kind: 'seq', name: '毒の弾幕（左右の首から）', color: VENOM, recover: 0.4, steps: [
      { at: 0.6, tele: 0.5, do: 'shots', pat: 'fan', n: 5, spread: 0.22, speed: 13, volleys: 4, gap: 0.34, from: [-1.3, 1.5], alternate: true, pose: 'lunge' },
      { at: 0.77, do: 'shots', pat: 'fan', n: 5, spread: 0.22, speed: 13, volleys: 4, gap: 0.34, from: [1.3, 1.5], alternate: true },
    ] },
    coil: { kind: 'seq', name: '締め付け（吸い寄せて締める）', color: STONE, recover: 0.5, steps: [
      { at: 0.35, do: 'pull', strength: 4.4, dur: 1.6 },
      { at: 0.35, do: 'vfx', type: 'coil', y: 0, d: { r: 7, dur: 1.7 } },
      { at: 1.95, tele: 1.6, do: 'hit', shape: 'circle', r: 5, k: 1.2, fx: 'pillar', pose: 'cast' },
    ] },
    ult: { kind: 'seq', ult: true, name: '石化の大睨み', hint: 'バジリスクに背を向けろ！（目を見たら石になる）', hpAt: ULT_AT, charge: 3.0, color: STONE, recover: 0.8, steps: [
      { at: 0.05, do: 'vfx', type: 'eye', d: { y: 9, dur: 2.95 } },
      { at: 3.0, tele: 3.0, do: 'se', se: 'gate', pose: 'charge' },
      { at: 3.0, do: 'facing', pose: 'rear' },
    ] },
  },
  look: { monster: 'hydra', scale: 2.0, horn: 0xeeff41, eye: 0xeeff41, belly: 0x9ccc65, heads: 2 },
};

// ---------------- 夕焼けの火の鳥（炎・空から） ----------------
const FLAME = 0xff6d00;
const EMBER = 0xffab40;
const firebird = {
  nearRange: 7,
  near: { ring: 0.2, rebirth: 0.15, dive: 0.2, tornado: 0.2, fan: 0.25 },
  far: { fan: 0.2, dive: 0.2, rain: 0.2, tornado: 0.15, phantom: 0.25 },
  patterns: {
    fan: { kind: 'seq', name: '火の羽根の弾幕', color: EMBER, recover: 0.4, steps: [
      { at: 0.6, tele: 0.5, do: 'shots', pat: 'fan', n: 7, spread: 0.2, speed: 15, volleys: 3, gap: 0.3, from: [-2.4, 0.5], a: -0.15, alternate: true, pose: 'wings' },
      { at: 0.6, do: 'shots', pat: 'fan', n: 7, spread: 0.2, speed: 15, volleys: 3, gap: 0.3, from: [2.4, 0.5], a: 0.15, alternate: true },
    ] },
    dive: { kind: 'seq', name: '炎の急降下', color: FLAME, recover: 0.5, steps: [
      { at: 0.7, tele: 0.45, do: 'move', m: 'rise', h: 14, dur: 0.7, pose: 'wings' },
      { at: 2.5, tele: 1.8, do: 'move', m: 'dive', dur: 0.4, r: 5, follow: 1.2, ring: 12, fx: 'pillar' },
    ] },
    ring: { kind: 'seq', name: '翼を広げて炎の輪', color: EMBER, recover: 0.5, steps: [
      { at: 0.8, tele: 0.7, do: 'nova', max: 18, speed: 11, waves: 2, gap: 0.5, pose: 'wings' },
      { at: 0.8, do: 'shots', pat: 'ring', n: 16, speed: 9, waves: 2, gap: 0.5 },
    ] },
    rain: { kind: 'seq', name: '火の玉の雨', color: 0xff9100, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'se', se: 'roar', pose: 'cast' },
      { at: 1.7, tele: 1.15, do: 'zones', o: 'rand', n: 8, spread: 12, first: false, r: 2.6, stagger: 0.1, burst: 3, fx: 'meteor' },
      { at: 2.0, tele: 1.25, do: 'zones', o: 'each', r: 2.8, fx: 'meteor' },
    ] },
    tornado: { kind: 'seq', name: '炎の竜巻（3本）', color: FLAME, recover: 0.4, steps: [
      { at: 0.8, tele: 0.6, do: 'mover', a: -0.5, r: 2.2, speed: 9, len: 22, pose: 'wings' },
      { at: 0.8, tele: 0.6, do: 'mover', a: 0, r: 2.2, speed: 9, len: 22, reaim: false },
      { at: 0.8, tele: 0.6, do: 'mover', a: 0.5, r: 2.2, speed: 9, len: 22, reaim: false },
    ] },
    phantom: { kind: 'seq', name: '炎の分身（交差する突撃）', color: EMBER, recover: 0.5, steps: [
      { at: 1.1, tele: 0.9, do: 'hit', o: 'tgt', dist: -13, a: 0.785, shape: 'rect', len: 26, w: 3, fx: 'phantom', pose: 'cast', se: 'swing' },
      { at: 1.55, tele: 0.9, do: 'hit', o: 'tgt', dist: -13, a: -0.785, shape: 'rect', len: 26, w: 3, fx: 'phantom', se: 'swing' },
    ] },
    rebirth: { kind: 'seq', name: '再誕の炎（回復して爆発）', color: FLAME, recover: 0.5, steps: [
      { at: 0.4, do: 'heal', frac: 0.03 },
      { at: 0.4, do: 'vfx', type: 'pillar', d: { r: 3, h: 10 } },
      { at: 1.8, tele: 1.5, do: 'hit', shape: 'circle', r: 7.5, k: 1.2, fx: 'pillar', pose: 'wings' },
    ] },
    ult: { kind: 'seq', ult: true, name: '天照の翼', hint: '水たまりに入れ！（外はすべて焼き尽くされる）', hpAt: ULT_AT, charge: 2.8, color: EMBER, recover: 0.6, steps: [
      { at: 0.05, do: 'safe', groups: [{ kind: 'water', n: 3, rr: 9, r: 2.8 }], show: 3.6 },
      { at: 0.6, do: 'move', m: 'rise', h: 6, dur: 0.8 },
      { at: 2.8, tele: 2.8, do: 'se', se: 'roar', pose: 'charge' },
      { at: 3.3, do: 'check', color: 0xffab40, pose: 'wings' },
      { at: 3.3, do: 'vfx', type: 'pillar', d: { r: 9, h: 18 } },
      { at: 3.6, do: 'move', m: 'dive', to: 'self', dur: 0.5 },
    ] },
  },
};

// ---------------- 猛牛ミノタウロス（大斧・土） ----------------
const AXE = 0xbcaaa4;
const EARTH = 0x8d6e63;
const minotaur = {
  nearRange: 6,
  near: { combo: 0.25, spin: 0.2, slam: 0.2, axe: 0.15, trap: 0.2 },
  far: { charge: 0.35, throw: 0.3, trap: 0.15, axe: 0.2 },
  patterns: {
    axe: { kind: 'seq', name: '大斧振り下ろし（地割れ）', color: AXE, recover: 0.5, steps: [
      { at: 0.85, tele: 0.75, do: 'hit', shape: 'rect', len: 10, w: 2.6, k: 1.3, fx: 'line', fxd: { tall: 2 }, pose: 'over', se: 'swing' },
      { at: 1.25, tele: 0.4, do: 'hit', shape: 'rect', dist: 10, len: 10, w: 2.2, k: 0.8, reaim: false, fx: 'line', color: EARTH },
    ] },
    charge: { kind: 'seq', name: '角の突進（壁にぶつかると怯む）', color: EARTH, recover: 0.4, steps: [
      { at: 0.75, tele: 0.75, do: 'move', m: 'dash', speed: 30, dur: 0.9, w: 4, k: 1.2, bumpStun: 1.8, pose: 'crouch' },
    ] },
    spin: { kind: 'seq', name: '回転斧', color: AXE, recover: 0.5, steps: [
      { at: 0.6, tele: 0.5, do: 'hit', shape: 'circle', r: 4.8, k: 0.6, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'spin' },
      { at: 0.6, do: 'move', m: 'dash', speed: 4.5, dur: 1.3, hitR: -1, pose: 'spin' },
      { at: 1.05, tele: 0.25, do: 'hit', shape: 'circle', r: 4.8, k: 0.6, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'swing' },
      { at: 1.5, tele: 0.25, do: 'hit', shape: 'circle', r: 4.8, k: 0.6, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'swing' },
      { at: 1.95, tele: 0.25, do: 'hit', shape: 'circle', r: 4.8, k: 0.6, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'swing' },
    ] },
    slam: { kind: 'seq', name: '地面叩き（三方向の地割れ）', color: EARTH, recover: 0.5, steps: [
      { at: 0.9, tele: 0.8, do: 'hit', shape: 'circle', r: 5, fx: 'pillar', pose: 'over' },
      { at: 1.4, tele: 0.5, do: 'hit', o: 'fan', n: 3, spread: 2.094, shape: 'rect', len: 16, w: 2.2, k: 0.8, reaim: false, fx: 'line' },
    ] },
    throw: { kind: 'seq', name: '斧投げ（戻ってくる）', color: AXE, recover: 0.6, steps: [
      { at: 0.8, tele: 0.7, do: 'mover', fx: 'axe', r: 1.8, speed: 16, len: 20, back: true, pose: 'swing' },
    ] },
    combo: { kind: 'seq', name: '猛牛の連撃', color: AXE, recover: 0.5, steps: [
      { at: 0.5, tele: 0.42, do: 'hit', shape: 'sector', r: 6, arc: 2.2, a: 0.01, k: 0.7, fx: 'arc', pose: 'swing', se: 'swing' },
      { at: 0.95, tele: 0.38, do: 'hit', shape: 'sector', r: 6, arc: 2.2, a: -0.01, k: 0.7, fx: 'arc', pose: 'swing', se: 'swing' },
      { at: 1.5, tele: 0.45, do: 'hit', shape: 'rect', len: 9, w: 3, k: 1.1, fx: 'line', fxd: { tall: 2 }, pose: 'over', se: 'swing' },
    ] },
    trap: { kind: 'seq', name: '石柱の檻（中が崩れる）', color: EARTH, recover: 0.5, steps: [
      { at: 0.2, do: 'vfx', o: 'tgt', type: 'pillars', d: { r: 5.5, n: 16, dur: 2.2 }, se: 'slam' },
      { at: 2.0, tele: 1.8, do: 'hit', o: 'tgt', shape: 'circle', r: 5.2, k: 1.3, fx: 'pillar', pose: 'over' },
    ] },
    ult: { kind: 'seq', ult: true, name: '迷宮崩し', hint: '炎の壁が3枚来る！ すき間を抜けろ！', hpAt: ULT_AT, charge: 2.5, color: 0xff7043, recover: 0.6, steps: [
      { at: 2.5, tele: 2.5, do: 'se', se: 'roar', shake: 0.8, pose: 'charge' },
      { at: 2.5, do: 'wall', back: 24, speed: 9, max: 56, gapW: 4.6, gapRange: 8, wait: 0.9, pose: 'over' },
      { at: 4.3, do: 'wall', back: 24, speed: 9, max: 56, gapW: 4.6, gapRange: 8, wait: 0.9, reaim: false, pose: 'over' },
      { at: 6.1, do: 'wall', back: 24, speed: 9, max: 56, gapW: 4.6, gapRange: 8, wait: 0.9, reaim: false, pose: 'over' },
    ] },
  },
};

// ---------------- ハーピー女王（羽根・歌。距離を取る） ----------------
const PLUME = 0xb39ddb;
const harpy = {
  nearRange: 6,
  near: { talon: 0.3, ring: 0.2, song: 0.2, charm: 0.3 },
  far: { dive: 0.2, gale: 0.25, bomb: 0.25, ring: 0.15, song: 0.15 },
  patterns: {
    talon: { kind: 'seq', name: '爪の引っかき', color: 0xd1c4e9, recover: 0.45, steps: [
      { at: 0.5, tele: 0.5, do: 'move', m: 'dash', speed: 24, dur: 0.4, w: 2.4, k: 0.6, pose: 'lunge' },
      { at: 1.05, tele: 0.3, do: 'hit', shape: 'sector', r: 5, arc: 1.6, a: 0.01, k: 0.7, fx: 'claw', fxDist: 1, pose: 'swing', se: 'swing' },
      { at: 1.4, tele: 0.3, do: 'hit', shape: 'sector', r: 5, arc: 1.6, a: -0.01, k: 0.7, fx: 'claw', fxDist: 1, pose: 'swing', se: 'swing' },
    ] },
    ring: { kind: 'seq', name: '羽根の弾幕', color: 0xd1c4e9, recover: 0.4, steps: [
      { at: 0.6, tele: 0.5, do: 'shots', pat: 'ring', n: 16, speed: 9.5, waves: 4, gap: 0.35, turn: 0.1, pose: 'wings' },
    ] },
    song: { kind: 'seq', name: '歌声（音の波）', color: PLUME, recover: 0.4, steps: [
      { at: 0.6, tele: 0.5, do: 'nova', max: 18, speed: 9, width: 0.5, waves: 3, gap: 0.55, pose: 'rear' },
    ] },
    dive: { kind: 'seq', name: '急降下', color: PLUME, recover: 0.4, steps: [
      { at: 0.55, tele: 0.4, do: 'move', m: 'rise', h: 10, dur: 0.55, pose: 'wings' },
      { at: 2.1, tele: 1.5, do: 'move', m: 'dive', dur: 0.35, r: 4, follow: 1.0, ring: 10 },
    ] },
    gale: { kind: 'seq', name: '竜巻の羽ばたき', color: PLUME, recover: 0.4, steps: [
      { at: 0.7, tele: 0.6, do: 'mover', a: -0.35, r: 2, speed: 10, len: 24, pose: 'wings' },
      { at: 0.7, tele: 0.6, do: 'mover', a: 0.35, r: 2, speed: 10, len: 24, reaim: false },
      { at: 1.1, do: 'shots', pat: 'fan', n: 5, spread: 0.25, speed: 15, volleys: 2, gap: 0.3 },
    ] },
    charm: { kind: 'seq', name: '魅了の歌（吸い寄せて引っかく）', color: 0xf48fb1, recover: 0.5, steps: [
      { at: 0.3, do: 'pull', strength: 5, dur: 1.6, pose: 'cast' },
      { at: 0.3, do: 'vfx', type: 'coil', y: 0, d: { r: 9, dur: 1.6 } },
      { at: 2.0, tele: 1.7, do: 'hit', shape: 'circle', r: 4.5, k: 1.1, fx: 'claw', fxd: { r: 4 }, pose: 'swing' },
    ] },
    bomb: { kind: 'seq', name: '旋回しながら爆撃', color: PLUME, recover: 0.5, steps: [
      { at: 0.4, tele: 0.3, do: 'move', m: 'orbit', rr: 9, speed: 1.8, dur: 2.6, h: 2, pose: 'wings' },
      { at: 1.3, tele: 0.75, do: 'zones', o: 'each', r: 2.6, fx: 'pillar' },
      { at: 2.0, tele: 0.75, do: 'zones', o: 'each', r: 2.6, fx: 'pillar' },
      { at: 2.7, tele: 0.75, do: 'zones', o: 'each', r: 2.6, fx: 'pillar' },
    ] },
    ult: { kind: 'seq', ult: true, name: '破滅の歌', hint: '足元の輪が縮みきった瞬間に回避！（3回）', hpAt: ULT_AT, charge: 2.6, color: PLUME, recover: 0.6, steps: [
      { at: 0.05, do: 'vfx', type: 'beat', d: { times: [3.15, 4.25, 5.15], lead: 1 } },
      { at: 2.6, tele: 2.6, do: 'se', se: 'roar', pose: 'charge' },
      { at: 3.2, do: 'all', flash: true, se: 'wave', pose: 'rear' },
      { at: 3.2, do: 'vfx', type: 'wind', d: { r: 20, dur: 0.6 } },
      { at: 4.3, do: 'all', flash: true, se: 'wave', pose: 'rear' },
      { at: 4.3, do: 'vfx', type: 'wind', d: { r: 20, dur: 0.6 } },
      { at: 5.2, do: 'all', flash: true, se: 'wave', pose: 'rear' },
      { at: 5.2, do: 'vfx', type: 'wind', d: { r: 20, dur: 0.6 } },
    ] },
  },
};

// ---------------- 黄昏竜ラグナ（最後のボス） ----------------
const DUSK = 0xff6e40;
const GOLD = 0xffd54f;
const ragna = {
  nearRange: 9,
  near: { claws: 0.2, tail: 0.15, breath: 0.15, storm: 0.15, roar: 0.15, rift: 0.2 },
  far: { breath: 0.2, meteor: 0.25, rift: 0.25, storm: 0.15, roar: 0.15 },
  patterns: {
    claws: { kind: 'seq', name: '黄昏の爪（三連）', color: DUSK, recover: 0.5, steps: [
      { at: 0.6, tele: 0.5, do: 'hit', shape: 'sector', r: 8.5, arc: 1.6, a: 0.01, k: 0.8, fx: 'claw', fxd: { r: 8 }, pose: 'swing', se: 'swing' },
      { at: 1.05, tele: 0.4, do: 'hit', shape: 'sector', r: 8.5, arc: 1.6, a: -0.01, k: 0.8, fx: 'claw', fxd: { r: 8 }, pose: 'swing', se: 'swing' },
      { at: 1.6, tele: 0.5, do: 'hit', shape: 'sector', r: 10, arc: 1.0, k: 1.1, fx: 'claw', fxd: { r: 10, n: 4 }, pose: 'over', se: 'swing' },
    ] },
    tail: { kind: 'seq', name: '尾の薙ぎ払い→振り向き', color: DUSK, recover: 0.5, steps: [
      { at: 0.75, tele: 0.65, do: 'hit', shape: 'sector', r: 11, arc: 3.2, a: PI, k: 1.1, fx: 'arc', pose: 'tail', se: 'swing' },
      { at: 1.4, tele: 0.45, do: 'hit', shape: 'sector', r: 9, arc: 1.6, fx: 'arc', pose: 'lunge', se: 'swing' },
    ] },
    breath: { kind: 'seq', name: '黄金のブレス（なぎ払い）', color: GOLD, recover: 0.6, steps: [
      { at: 0.9, tele: 0.8, do: 'rot', arms: 1, arc: 0.55, len: 26, speed: 1.25, a: -1.05, dur: 1.7, sweepTele: true, pose: 'lunge' },
      { at: 0.9, do: 'se', se: 'wave', pose: 'lunge', dur: 1.7 },
    ] },
    meteor: { kind: 'seq', name: '隕石の召喚', color: 0xff3d00, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'se', se: 'roar', pose: 'cast' },
      { at: 2.0, tele: 1.4, do: 'zones', o: 'each', r: 4, burst: 8, fx: 'meteor' },
      { at: 2.3, tele: 1.5, do: 'zones', o: 'rand', n: 6, spread: 13, first: false, r: 3, stagger: 0.12, fx: 'meteor' },
    ] },
    storm: { kind: 'seq', name: '翼の嵐（吹き飛ばし）', color: 0xff9e80, recover: 0.5, steps: [
      { at: 0.7, tele: 0.6, do: 'pull', strength: -7, dur: 1.2, pose: 'wings' },
      { at: 0.7, do: 'vfx', type: 'wind', y: 0, d: { r: 16, dur: 1.2 } },
      { at: 0.9, do: 'shots', pat: 'ring', n: 20, speed: 10, waves: 3, gap: 0.4 },
    ] },
    rift: { kind: 'seq', name: '次元の裂け目（井桁）', color: 0xb388ff, recover: 0.5, steps: [
      { at: 1.4, tele: 1.2, do: 'hit', o: 'grid', n: 4, gapW: 7, len: 34, shape: 'rect', w: 3, fx: 'line', fxd: { tall: 4 }, pose: 'cast', se: 'gate' },
    ] },
    roar: { kind: 'seq', name: '終焉の咆哮', color: 0xff9e80, recover: 0.5, steps: [
      { at: 0.8, tele: 0.75, do: 'hit', shape: 'circle', r: 5.5, fx: 'pillar', pose: 'rear' },
      { at: 0.8, do: 'nova', max: 26, speed: 12, width: 0.8, waves: 3, gap: 0.45 },
      { at: 0.8, do: 'se', se: 'roar', shake: 1 },
    ] },
    ult: { kind: 'seq', ult: true, name: 'ラグナロク', hint: '光→闇→光の順に波が来る！ 同じ色の円に入れ', hpAt: ULT_AT, charge: 3.0, color: GOLD, recover: 0.8, steps: [
      { at: 0.05, do: 'safe', groups: [{ kind: 'light', n: 3, rr: 8, r: 3 }, { kind: 'dark', n: 3, rr: 15, r: 3 }], show: 8 },
      { at: 3.0, tele: 3.0, do: 'se', se: 'roar', shake: 0.8, pose: 'charge' },
      { at: 3.0, do: 'banner', text: '☀ 光の波！ 光の円へ' },
      { at: 3.6, do: 'check', need: 'light', color: 0xfff176, pose: 'rear' },
      { at: 3.9, do: 'banner', text: '☾ 闇の波が来る！ 闇の円へ' },
      { at: 5.6, do: 'check', need: 'dark', color: 0x7c4dff, pose: 'rear' },
      { at: 6.0, do: 'banner', text: '☀ 光の波！ 光の円へ' },
      { at: 7.8, do: 'check', need: 'light', color: 0xfff176, pose: 'rear' },
    ] },
  },
};

/** ボス → 差し替える内容（data/enemies.js で BOSSES にかぶせる） */
export const S5_MOVES = { cerberus, basilisk, firebird, minotaur, harpy, ragna };
