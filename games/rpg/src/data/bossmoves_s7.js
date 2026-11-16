// ステージ7「蒼海の神殿」（海の底の神殿）のボス6体。技の書き方は src/bossmoves.js・src/bossmoves_ext.js
// 新しい技：渦潮（pool kind:'whirl'＋横に流す pull）・泡の輪舞（orbs）・弾ける泡（cluster）・包囲の水槍（o:'around'）
// 最後のクラーケンは体も攻撃範囲も2倍（data/bossscale.js）。部屋も縦横2倍
import { giant } from './bossscale.js';

const PI = Math.PI;
const ULT_AT = [0.75, 0.45, 0.2];
const RAGE = { at: 0.5, speedMul: 1.3, windupMul: 0.68, countMul: 1.2 };
const SEA = 0x29b6f6;
const FOAM = 0xe0f7fa;
const DEEP = 0x1565c0;
const TEAL = 0x26c6da;
/** ボスから標的の方へ、手前から順に噴き上がる水柱 */
const geyserLine = (t0, n, gap, step, r, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ at: t0 + i * gap, tele: 0.55, do: 'hit', shape: 'circle', dist: 3 + i * step, r, reaim: i === 0 ? undefined : false, fx: 'pillar', se: 'slam', ...extra }));

// ---------------- 歌姫セイレーン（距離を取る水の魔導士） ----------------
const siren = {
  name: '歌姫セイレーン', color: 0x4dd0e1,
  hp: 18800, def: 10, speed: 4.6, radius: 1.6, hpY: 6, keep: 9,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 6,
  near: { whirl: 0.25, bubbles: 0.25, dive: 0.2, wave: 0.15, song: 0.15 },
  far: { song: 0.25, lance: 0.25, wave: 0.2, whirl: 0.15, bubbles: 0.15 },
  patterns: {
    song: { kind: 'seq', name: '弾ける泡の歌', color: FOAM, recover: 0.45, steps: [
      { at: 0.6, tele: 0.5, do: 'cluster', n: 5, spread: 0.32, speed: 10, pop: 0.9, ring: 8, ringSpeed: 6, pose: 'cast' },
      { at: 1.5, tele: 0.4, do: 'cluster', n: 4, spread: 0.45, speed: 9, pop: 1.1, ring: 8, ringSpeed: 6, pose: 'cast' },
    ] },
    lance: { kind: 'seq', name: '水槍の三連', color: SEA, recover: 0.45, steps: [
      { at: 0.8, tele: 0.7, do: 'hit', o: 'fan', n: 3, spread: 0.35, shape: 'rect', len: 24, w: 1.8, fx: 'line', fxd: { tall: 2 }, pose: 'cast', se: 'wave' },
      { at: 1.5, tele: 0.55, do: 'hit', o: 'fan', n: 2, spread: 0.2, shape: 'rect', len: 24, w: 1.8, fx: 'line', fxd: { tall: 2 }, pose: 'cast', se: 'wave' },
    ] },
    whirl: { kind: 'seq', name: '渦潮', color: TEAL, recover: 0.5, steps: [
      { at: 0.9, tele: 0.85, do: 'pool', o: 'each', r: 3.2, dur: 4.5, every: 0.5, k: 0.3, kind: 'whirl', pose: 'cast', se: 'wave' },
      { at: 1.0, do: 'pull', strength: 2.4, spin: 4.5, dur: 2.2 },
    ] },
    bubbles: { kind: 'seq', name: '泡の輪舞', color: FOAM, recover: 0.5, steps: [
      { at: 0.7, tele: 0.6, do: 'orbs', n: 6, rr0: 1.5, rr1: 13, dur: 3.2, speed: 1.8, r: 1.1, k: 0.6, pose: 'float' },
      { at: 1.6, do: 'shots', pat: 'ring', n: 12, speed: 7, waves: 2, gap: 0.6 },
    ] },
    wave: { kind: 'seq', name: '大波', color: SEA, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'se', se: 'wave', pose: 'over' },
      { at: 0.7, do: 'wall', speed: 11, max: 44, gapW: 4.6, gapRange: 7, wait: 0.7, thick: 2 },
    ] },
    dive: { kind: 'seq', name: '潜行からの奇襲', color: DEEP, recover: 0.5, steps: [
      { at: 0.5, tele: 0.45, do: 'move', m: 'hide', color: SEA, pose: 'sink' },
      { at: 2.1, tele: 1.4, do: 'move', m: 'warp', to: 'tgt', follow: 0.9, r: 4, k: 1.1, ring: 12, fx: 'pillar' },
    ] },
    ult: { kind: 'seq', ult: true, name: '海神の子守唄', hint: '大渦に流される！ 緑の円の中で耐えろ（2回）', hpAt: ULT_AT, charge: 2.6, color: TEAL, recover: 0.8, steps: [
      { at: 0.05, do: 'safe', groups: [{ kind: 'safe', n: 3, rr: 9, r: 3 }], show: 6.2 },
      { at: 2.6, tele: 2.6, do: 'se', se: 'seal', pose: 'charge' },
      { at: 2.7, do: 'pull', strength: 1.2, spin: 6.5, dur: 3.6 },
      { at: 2.7, do: 'vfx', type: 'coil', y: 0, d: { r: 16, dur: 3.6 } },
      { at: 4.2, do: 'check', color: TEAL, pose: 'float' },
      { at: 6.2, do: 'check', color: TEAL, pose: 'float' },
    ] },
  },
  rage: RAGE, restMin: 0.4, restMax: 0.85,
  look: { scale: 2.3, horn: 0xb2ebf2, eye: 0x18ffff, weapon: 'staff', metal: 0x00838f },
};

// ---------------- 大蟹キングクラブ（横歩き・はさみ） ----------------
const SHELL = 0xff7043;
const kingcrab = {
  name: '大蟹キングクラブ', color: 0xd84315,
  hp: 19600, def: 14, speed: 5.4, radius: 2.6, hpY: 5.5,
  shotHit: 1 / 5, meleeHit: 1 / 2.9,
  nearRange: 7,
  near: { pinch: 0.25, spin: 0.2, hammer: 0.2, side: 0.2, sand: 0.15 },
  far: { side: 0.3, bubbles: 0.25, sand: 0.25, hammer: 0.2 },
  patterns: {
    pinch: { kind: 'seq', name: '両ばさみ', color: SHELL, recover: 0.45, steps: [
      { at: 0.65, tele: 0.55, do: 'hit', shape: 'sector', r: 6.5, arc: 1.0, a: -0.7, k: 0.8, fx: 'claw', fxd: { r: 6 }, pose: 'clap', se: 'swing' },
      { at: 0.65, tele: 0.55, do: 'hit', shape: 'sector', r: 6.5, arc: 1.0, a: 0.7, k: 0.8, fx: 'claw', fxd: { r: 6 } },
      { at: 1.25, tele: 0.45, do: 'hit', shape: 'sector', r: 7, arc: 0.7, k: 1.2, fx: 'bite', fxDist: 4, pose: 'clap', se: 'slam' },
    ] },
    side: { kind: 'seq', name: '横走り（左右）', color: SHELL, recover: 0.45, steps: [
      { at: 0.5, tele: 0.45, do: 'move', m: 'dash', speed: 22, dur: 0.55, w: 4.5, k: 0.9, a: PI / 2, pose: 'crouch' },
      { at: 1.3, tele: 0.45, do: 'move', m: 'dash', speed: 22, dur: 0.55, w: 4.5, k: 0.9, a: -PI / 2, pose: 'crouch' },
      { at: 1.9, tele: 0.4, do: 'shots', pat: 'ring', n: 12, speed: 8 },
    ] },
    spin: { kind: 'seq', name: '甲羅独楽', color: 0xffab91, recover: 0.5, steps: [
      { at: 0.5, tele: 0.45, do: 'move', m: 'dash', speed: 7, dur: 1.5, hitR: -1, pose: 'spinH' },
      ...[0.5, 0.9, 1.3, 1.7].map((at, i) => ({ at, tele: i ? 0.2 : 0.45, do: 'hit', shape: 'circle', r: 4.6, k: 0.55, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'spin' })),
    ] },
    hammer: { kind: 'seq', name: '大槌ばさみ', color: SHELL, recover: 0.55, steps: [
      { at: 0.95, tele: 0.85, do: 'hit', shape: 'rect', len: 12, w: 3.4, k: 1.3, fx: 'line', fxd: { tall: 2 }, pose: 'over', se: 'slam' },
      ...geyserLine(1.3, 4, 0.1, 2.5, 2, { k: 0.6 }).map((s, i) => ({ ...s, dist: 13 + i * 2.5, reaim: false })),
    ] },
    bubbles: { kind: 'seq', name: '泡吹き', color: FOAM, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'shots', pat: 'spiral', arms: 3, dur: 1.8, interval: 0.12, turn: 0.3, speed: 7, pose: 'rear' },
      { at: 1.2, do: 'cluster', n: 3, spread: 0.5, speed: 9, pop: 1, ring: 6 },
    ] },
    sand: { kind: 'seq', name: '砂煙の噴出', color: 0xd7ccc8, recover: 0.4, steps: [
      { at: 0.4, tele: 0.4, do: 'se', se: 'slam', pose: 'crouch' },
      { at: 1.5, tele: 1.1, do: 'zones', o: 'rand', n: 7, spread: 11, first: false, r: 2.6, stagger: 0.08, fx: 'pillar' },
      { at: 1.8, tele: 1.2, do: 'zones', o: 'each', r: 3, burst: 6, fx: 'pillar' },
    ] },
    ult: { kind: 'seq', ult: true, name: '甲殻大回転', hint: '大回転の衝撃が3回！ 輪が縮んだら回避', hpAt: ULT_AT, charge: 2.4, color: SHELL, recover: 0.8, steps: [
      { at: 2.4, tele: 2.4, do: 'se', se: 'roar', shake: 0.6, pose: 'charge' },
      { at: 2.5, do: 'rot', arms: 4, arc: 0.45, len: 20, speed: 1.5, dur: 3.6, pose: 'spinH' },
      { at: 2.55, do: 'vfx', type: 'beat', d: { times: [1.4, 2.6, 3.8], lead: 1.0 } },
      { at: 3.95, do: 'all', flash: true, se: 'slam' },
      { at: 5.15, do: 'all', flash: true, se: 'slam' },
      { at: 6.35, do: 'all', flash: true, se: 'slam', pose: 'rear' },
    ] },
  },
  rage: RAGE, restMin: 0.45, restMax: 0.9,
  look: { monster: 'crab', scale: 1.9, horn: 0xfff3e0, eye: 0x212121, belly: 0xffccbc },
};

// ---------------- 海竜リヴァイア（とぐろの海蛇） ----------------
const leviath = {
  name: '海竜リヴァイア', color: 0x1e88e5,
  hp: 20400, def: 12, speed: 5.2, radius: 2.4, hpY: 7.5,
  shotHit: 1 / 5, meleeHit: 1 / 2.9,
  nearRange: 8,
  near: { bite: 0.25, coil: 0.25, whirl: 0.15, emerge: 0.15, breath: 0.2 },
  far: { breath: 0.25, geyser: 0.25, emerge: 0.25, whirl: 0.25 },
  patterns: {
    bite: { kind: 'seq', name: '噛み砕き', color: SEA, recover: 0.45, steps: [
      { at: 0.55, tele: 0.48, do: 'hit', shape: 'sector', r: 7, arc: 1.1, k: 0.8, fx: 'bite', fxDist: 4, pose: 'bite', se: 'swing' },
      { at: 1.1, tele: 0.45, do: 'hit', shape: 'sector', r: 8.5, arc: 0.9, k: 1.1, fx: 'bite', fxDist: 5, pose: 'bite', se: 'swing' },
    ] },
    coil: { kind: 'seq', name: '締めつけ（内→外）', color: DEEP, recover: 0.5, steps: [
      { at: 0.75, tele: 0.7, do: 'hit', shape: 'circle', r: 5, k: 1.1, fx: 'pillar', pose: 'coil' },
      { at: 1.45, tele: 0.6, do: 'hit', shape: 'donut', rIn: 5, rOut: 10, pose: 'coil' },
      { at: 1.5, do: 'shots', pat: 'ring', n: 16, speed: 8 },
    ] },
    breath: { kind: 'seq', name: '激流の息吹', color: SEA, recover: 0.55, steps: [
      { at: 0.9, tele: 0.8, do: 'rot', arms: 1, arc: 0.55, len: 24, speed: 1.6, a: -0.9, dur: 1.15, sweepTele: true, pose: 'lunge' },
      { at: 0.9, do: 'se', se: 'wave', pose: 'lunge', dur: 1.15 },
    ] },
    geyser: { kind: 'seq', name: '間欠泉の列', color: FOAM, recover: 0.45, steps: [
      { at: 0.4, tele: 0.35, do: 'se', se: 'slam', pose: 'rear' },
      ...geyserLine(0.9, 7, 0.1, 2.6, 2.1),
      { at: 1.8, tele: 0.6, do: 'hit', o: 'fan', n: 2, spread: 0.8, shape: 'rect', len: 22, w: 2, fx: 'line', pose: 'over' },
    ] },
    emerge: { kind: 'seq', name: '海中から急襲', color: DEEP, recover: 0.55, steps: [
      { at: 0.45, tele: 0.4, do: 'move', m: 'hide', color: SEA, pose: 'sink' },
      { at: 1.9, tele: 1.3, do: 'move', m: 'warp', to: 'tgt', follow: 0.8, r: 4.5, k: 1.2, ring: 14, fx: 'pillar' },
      { at: 2.7, tele: 0.6, do: 'hit', shape: 'donut', rIn: 4.5, rOut: 9 },
    ] },
    whirl: { kind: 'seq', name: '大渦', color: TEAL, recover: 0.5, steps: [
      { at: 0.4, do: 'pull', strength: 3.6, spin: 5, dur: 2.0, pose: 'coil' },
      { at: 0.5, tele: 0.5, do: 'pool', r: 5.5, dur: 3.2, every: 0.45, k: 0.35, kind: 'whirl' },
      { at: 2.4, tele: 1.2, do: 'hit', shape: 'circle', r: 7, k: 1.1, fx: 'pillar', pose: 'rear' },
    ] },
    ult: { kind: 'seq', ult: true, name: '大海嘯', hint: '大波が3回！ 波の切れ目を抜けろ', hpAt: ULT_AT, charge: 2.6, color: SEA, recover: 0.8, steps: [
      { at: 2.6, tele: 2.6, do: 'se', se: 'roar', shake: 0.7, pose: 'charge' },
      { at: 2.7, do: 'wall', speed: 12, max: 48, gapW: 4.4, gapRange: 9, wait: 0.6, thick: 2.4, k: 3 },
      { at: 4.2, do: 'wall', speed: 12, max: 48, gapW: 4.4, gapRange: 9, wait: 0.6, thick: 2.4, k: 3, pose: 'rear' },
      { at: 5.7, do: 'wall', speed: 13, max: 48, gapW: 4.0, gapRange: 9, wait: 0.6, thick: 2.4, k: 3, pose: 'rear' },
    ] },
  },
  rage: RAGE, restMin: 0.4, restMax: 0.85,
  look: { monster: 'serpent', scale: 2.4, horn: 0x4fc3f7, eye: 0xffeb3b, belly: 0xbbdefb, fin: 0x26c6da },
};

// ---------------- 海神騎士トリトン（三叉槍の騎士）＆ 深海の眼ゲイザー（第4の間・2体同時） ----------------
const triton = {
  name: '海神騎士トリトン', color: 0x00897b,
  hp: 12600, def: 12, speed: 6.4, radius: 1.5, hpY: 5.8,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 6,
  near: { thrust: 0.3, sweep: 0.25, charge: 0.2, siege: 0.25 },
  far: { siege: 0.3, charge: 0.3, javelin: 0.4 },
  patterns: {
    thrust: { kind: 'seq', name: '三叉槍の連突き', color: TEAL, recover: 0.4, steps: [
      { at: 0.45, tele: 0.4, do: 'hit', shape: 'rect', len: 8, w: 1.8, k: 0.7, fx: 'line', pose: 'lunge', se: 'swing' },
      { at: 0.8, tele: 0.3, do: 'hit', shape: 'rect', len: 8, w: 1.8, k: 0.7, fx: 'line', pose: 'lunge', se: 'swing' },
      { at: 1.25, tele: 0.4, do: 'hit', o: 'fan', n: 3, spread: 0.3, shape: 'rect', len: 10, w: 1.6, k: 1, fx: 'line', pose: 'lunge', se: 'swing' },
    ] },
    sweep: { kind: 'seq', name: '槍の薙ぎ払い', color: TEAL, recover: 0.45, steps: [
      { at: 0.6, tele: 0.5, do: 'hit', shape: 'sector', r: 6.5, arc: 3.4, a: 0.01, fx: 'arc', pose: 'swing', se: 'swing' },
    ] },
    charge: { kind: 'seq', name: '海流突撃', color: SEA, recover: 0.5, steps: [
      { at: 0.65, tele: 0.6, do: 'move', m: 'dash', speed: 30, dur: 0.5, w: 3, k: 1, pose: 'lunge' },
      { at: 1.3, tele: 0.45, do: 'move', m: 'dash', speed: 30, dur: 0.5, w: 3, k: 1, pose: 'lunge' },
    ] },
    siege: { kind: 'seq', name: '包囲の水槍', color: FOAM, recover: 0.5, steps: [
      { at: 0.95, tele: 0.85, do: 'hit', o: 'around', n: 4, dist: 10, shape: 'rect', len: 20, w: 1.6, fx: 'line', fxd: { tall: 2 }, pose: 'cast', se: 'wave' },
      { at: 1.7, tele: 0.6, do: 'hit', o: 'around', n: 4, dist: 10, off: PI / 4, shape: 'rect', len: 20, w: 1.6, fx: 'line', fxd: { tall: 2 }, reaim: false, se: 'wave' },
    ] },
    javelin: { kind: 'seq', name: '投げ槍', color: TEAL, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'shots', pat: 'fan', n: 3, spread: 0.12, speed: 22, volleys: 3, gap: 0.3, pose: 'over' },
    ] },
    ult: { kind: 'seq', ult: true, name: '海神の裁き', hint: '槍の雨が四方から！ 包囲の隙間を抜けて、最後は回避', hpAt: ULT_AT, charge: 2.2, color: TEAL, recover: 0.7, steps: [
      { at: 2.2, tele: 2.2, do: 'se', se: 'seal', pose: 'charge' },
      { at: 3.2, tele: 1.0, do: 'hit', o: 'around', n: 6, dist: 11, shape: 'rect', len: 22, w: 1.8, fx: 'line', fxd: { tall: 3 }, pose: 'cast', se: 'wave' },
      { at: 4.2, tele: 0.8, do: 'hit', o: 'around', n: 6, dist: 11, off: PI / 6, shape: 'rect', len: 22, w: 1.8, fx: 'line', fxd: { tall: 3 }, se: 'wave' },
      { at: 4.3, do: 'vfx', type: 'beat', d: { times: [1.3], lead: 1.0 } },
      { at: 5.6, do: 'all', flash: true, se: 'slam', pose: 'over' },
    ] },
  },
  rage: RAGE, restMin: 0.45, restMax: 0.95,
  look: { scale: 2.1, horn: 0x80cbc4, eye: 0x18ffff, weapon: 'sword', metal: 0x00695c },
};

const VOID_SEA = 0x5e35b1;
const gazer = {
  name: '深海の眼ゲイザー', color: 0x4a148c,
  hp: 11800, def: 9, speed: 3.6, radius: 1.8, hpY: 6.5, keep: 10,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 6,
  near: { stare: 0.25, orbs: 0.25, ink: 0.25, beam: 0.25 },
  far: { beam: 0.3, cluster: 0.3, ink: 0.2, stare: 0.2 },
  patterns: {
    stare: { kind: 'seq', name: '魔眼（目を逸らせ）', color: 0xea80fc, recover: 0.5, steps: [
      { at: 0.2, do: 'banner', text: '👁 目を見るな！（背を向けろ）' },
      { at: 2.0, tele: 1.8, do: 'facing', pose: 'float' },
    ] },
    beam: { kind: 'seq', name: '眼光のなぎ払い', color: 0xea80fc, recover: 0.55, steps: [
      { at: 0.9, tele: 0.8, do: 'rot', arms: 1, arc: 0.4, len: 22, speed: -1.5, a: 0.9, dur: 1.2, sweepTele: true, pose: 'float' },
    ] },
    orbs: { kind: 'seq', name: '発光クラゲ', color: 0x80deea, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'orbs', n: 5, rr0: 12, rr1: 2, dur: 3.0, speed: -1.6, r: 1.1, k: 0.6, pose: 'float' },
    ] },
    ink: { kind: 'seq', name: '墨の溜まり', color: VOID_SEA, recover: 0.45, steps: [
      { at: 0.9, tele: 0.85, do: 'pool', o: 'rand', n: 4, spread: 9, r: 3.2, dur: 5, every: 0.5, k: 0.3, kind: 'void', pose: 'flail', se: 'wave' },
    ] },
    cluster: { kind: 'seq', name: '弾ける墨玉', color: VOID_SEA, recover: 0.4, steps: [
      { at: 0.55, tele: 0.5, do: 'cluster', n: 3, spread: 0.6, speed: 9, pop: 1.0, ring: 10, ringSpeed: 6, pose: 'flail' },
    ] },
    ult: { kind: 'seq', ult: true, name: '深淵の凝視', hint: '目を3回開く！ そのたびにゲイザーに背を向けろ', hpAt: ULT_AT, charge: 2.4, color: 0xea80fc, recover: 0.7, steps: [
      { at: 2.4, tele: 2.4, do: 'se', se: 'seal', pose: 'charge' },
      ...[0, 1, 2].flatMap((i) => [
        { at: 2.5 + i * 1.9, do: 'banner', text: '👁 背を向けろ！' },
        { at: 3.8 + i * 1.9, tele: 1.2, do: 'facing', pose: 'float' },
      ]),
    ] },
  },
  rage: RAGE, restMin: 0.5, restMax: 1.0,
  look: { monster: 'eye', scale: 1.8, horn: 0x7e57c2, eye: 0xea80fc, belly: 0xede7f6 },
};

// ---------------- 深淵の主クラーケン（最後のボス・2倍の巨体） ----------------
const INK = 0x311b92;
const krakenBase = {
  name: '深淵の主クラーケン', color: 0x6a1b9a,
  hp: 32000, def: 14, speed: 3.6, radius: 3.2, hpY: 8,
  shotHit: 1 / 5, meleeHit: 1 / 2.8,
  nearRange: 8,
  near: { slam: 0.2, sweep: 0.2, grab: 0.15, whirl: 0.15, ink: 0.15, rise: 0.15 },
  far: { tentacles: 0.25, grab: 0.2, rise: 0.2, ink: 0.15, bubbles: 0.2 },
  patterns: {
    slam: { kind: 'seq', name: '触手叩きつけ', color: 0xce93d8, recover: 0.55, steps: [
      { at: 0.8, tele: 0.7, do: 'hit', o: 'fan', n: 2, spread: 0.55, shape: 'rect', len: 11, w: 2.6, k: 1, fx: 'line', fxd: { tall: 2 }, pose: 'over', se: 'slam' },
      { at: 1.5, tele: 0.6, do: 'hit', o: 'fan', n: 3, spread: 0.45, shape: 'rect', len: 12, w: 2.6, k: 1, fx: 'line', fxd: { tall: 2 }, pose: 'over', se: 'slam' },
    ] },
    sweep: { kind: 'seq', name: '触手の大振り', color: 0xce93d8, recover: 0.5, steps: [
      { at: 0.7, tele: 0.6, do: 'hit', shape: 'sector', r: 10, arc: 3.2, a: 0.01, fx: 'arc', pose: 'flail', se: 'swing' },
      { at: 1.4, tele: 0.5, do: 'hit', shape: 'sector', r: 10, arc: 3.2, a: -0.01, fx: 'arc', pose: 'flail', se: 'swing' },
    ] },
    grab: { kind: 'seq', name: '包み込む触手', color: 0xba68c8, recover: 0.5, steps: [
      { at: 1.0, tele: 0.9, do: 'hit', o: 'around', n: 5, dist: 9, shape: 'rect', len: 12, w: 2, fx: 'line', pose: 'clap', se: 'swing' },
      { at: 1.8, tele: 0.7, do: 'hit', o: 'tgt', shape: 'circle', r: 3.4, k: 1.2, fx: 'pillar', pose: 'clap' },
    ] },
    tentacles: { kind: 'seq', name: '地中の触手', color: 0xce93d8, recover: 0.45, steps: [
      { at: 0.45, tele: 0.4, do: 'se', se: 'slam', pose: 'sink' },
      { at: 1.6, tele: 1.1, do: 'zones', o: 'rand', n: 9, spread: 13, first: false, r: 2.4, stagger: 0.07, fx: 'pillar' },
      { at: 1.9, tele: 1.2, do: 'zones', o: 'each', r: 3, burst: 8, fx: 'pillar' },
    ] },
    whirl: { kind: 'seq', name: '深海の大渦', color: TEAL, recover: 0.55, steps: [
      { at: 0.4, do: 'pull', strength: 4.2, spin: 5.5, dur: 2.2, pose: 'flail' },
      { at: 0.5, tele: 0.5, do: 'pool', r: 6, dur: 3.4, every: 0.45, k: 0.4, kind: 'whirl' },
      { at: 2.6, tele: 1.3, do: 'hit', shape: 'donut', rIn: 6, rOut: 14, pose: 'rear' },
    ] },
    ink: { kind: 'seq', name: '墨の海', color: INK, recover: 0.45, steps: [
      { at: 0.8, tele: 0.75, do: 'pool', o: 'each', r: 3.6, dur: 5, every: 0.5, k: 0.3, kind: 'void', pose: 'rear', se: 'wave' },
      { at: 1.4, tele: 0.8, do: 'pool', o: 'rand', n: 4, spread: 12, first: false, r: 3, dur: 4.5, every: 0.5, k: 0.3, kind: 'void' },
    ] },
    rise: { kind: 'seq', name: '潜って浮上', color: DEEP, recover: 0.6, steps: [
      { at: 0.5, tele: 0.45, do: 'move', m: 'hide', color: SEA, pose: 'sink' },
      { at: 2.3, tele: 1.5, do: 'move', m: 'warp', to: 'tgt', follow: 1.0, r: 5, k: 1.3, ring: 18, fx: 'pillar' },
      { at: 3.0, tele: 0.6, do: 'hit', shape: 'donut', rIn: 5, rOut: 10 },
    ] },
    bubbles: { kind: 'seq', name: '泡の大輪', color: FOAM, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'orbs', n: 8, rr0: 2, rr1: 15, dur: 3.4, speed: 1.4, r: 1.2, k: 0.6, pose: 'rear' },
      { at: 1.2, do: 'cluster', n: 5, spread: 0.4, speed: 10, pop: 1, ring: 8 },
    ] },
    ult: { kind: 'seq', ult: true, name: '深淵の大渦', hint: '海が渦を巻く！ 緑の円で耐えて、最後は回避', hpAt: ULT_AT, charge: 3.0, color: TEAL, recover: 0.9, steps: [
      { at: 0.05, do: 'safe', groups: [{ kind: 'safe', n: 4, rr: 10, r: 3 }], show: 5.4 },
      { at: 3.0, tele: 3.0, do: 'se', se: 'roar', shake: 0.9, pose: 'charge' },
      { at: 3.1, do: 'pull', strength: 1.6, spin: 6, dur: 2.6 },
      { at: 3.1, do: 'vfx', type: 'coil', y: 0, d: { r: 20, dur: 2.6 } },
      { at: 5.4, do: 'check', color: TEAL, pose: 'flail' },
      { at: 5.5, do: 'vfx', type: 'beat', d: { times: [1.5], lead: 1.1 } },
      { at: 7.0, do: 'all', flash: true, se: 'wave', pose: 'rear' },
    ] },
  },
  rage: { ...RAGE, summon: 'wraith', summonEvery: 20, summonMax: 2, summonOffset: [8, 4] },
  restMin: 0.4, restMax: 0.85,
  look: { monster: 'kraken', scale: 2.4, horn: 0xe1bee7, eye: 0xffeb3b, belly: 0xce93d8 },
};
const kraken = giant(krakenBase, 2);

/** ステージ7のボス（data/enemies.js の BOSSES に足す） */
export const S7_BOSSES = { siren, kingcrab, leviath, triton, gazer, kraken };
