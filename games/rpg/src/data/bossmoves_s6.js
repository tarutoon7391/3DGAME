// ステージ6「星降る氷原」（夜の雪原）のボス6体。強さ・見た目・固有技（各7種）・必殺技をまとめて持つ
// 技の書き方は src/bossmoves.js（ステージ5 の data/bossmoves_s5.js と同じ）。必殺技は通常の3倍
const PI = Math.PI;
const ULT_AT = [0.75, 0.45, 0.2];
const RAGE = { at: 0.5, speedMul: 1.3, windupMul: 0.68, countMul: 1.2 };
/** ボスから標的の方へ、手前から順に噴き上がる氷柱（地走り） */
const runLine = (t0, n, gap, step, r, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ at: t0 + i * gap, tele: 0.55, do: 'hit', shape: 'circle', dist: 3 + i * step, r, reaim: i === 0 ? undefined : false, fx: 'pillar', se: 'slam', ...extra }));

// ---------------- 氷狼フェンリル（速い獣） ----------------
const ICE = 0x80deea;
const fenrir = {
  name: '氷狼フェンリル', color: 0xb0bec5,
  hp: 17600, def: 11, speed: 7.0, radius: 2.2, hpY: 6.5,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 7,
  near: { fangs: 0.25, tail: 0.2, lunge: 0.15, howl: 0.2, circle: 0.2 },
  far: { breath: 0.25, lunge: 0.25, icicles: 0.25, circle: 0.25 },
  patterns: {
    fangs: { kind: 'seq', name: '氷牙の連噛み', color: ICE, recover: 0.45, steps: [
      { at: 0.5, tele: 0.42, do: 'hit', shape: 'sector', r: 6, arc: 1.2, a: -0.3, k: 0.7, fx: 'bite', fxDist: 3.5, pose: 'bite', se: 'swing' },
      { at: 0.85, tele: 0.32, do: 'hit', shape: 'sector', r: 6, arc: 1.2, a: 0.3, k: 0.7, fx: 'bite', fxDist: 3.5, pose: 'bite', se: 'swing' },
      { at: 1.3, tele: 0.4, do: 'hit', shape: 'sector', r: 7.5, arc: 0.9, k: 1.1, fx: 'bite', fxDist: 4.5, pose: 'bite', se: 'swing' },
    ] },
    breath: { kind: 'seq', name: '凍てつく吐息', color: ICE, recover: 0.5, steps: [
      { at: 0.9, tele: 0.8, do: 'hit', shape: 'sector', r: 13, arc: 0.95, fx: 'breath', fxDur: 0.7, fxd: { len: 13, w: 9, y: 3 }, pose: 'lunge', se: 'wave' },
      { at: 1.6, tele: 0.5, do: 'zones', o: 'fan', n: 3, spread: 0.32, dist: 8, reaim: false, r: 2.3, fx: 'pillar' },
    ] },
    lunge: { kind: 'seq', name: '跳びかかり三連', color: 0xb3e5fc, recover: 0.5, steps: [
      { at: 0.55, tele: 0.55, do: 'move', m: 'leap', dur: 0.45, h: 4, r: 3.2, k: 0.7, pose: 'crouch' },
      { at: 1.35, tele: 0.35, do: 'move', m: 'leap', dur: 0.42, h: 4, r: 3.2, k: 0.7, pose: 'crouch' },
      { at: 2.15, tele: 0.35, do: 'move', m: 'leap', dur: 0.45, h: 5, r: 4.2, k: 1.1, fx: 'pillar', pose: 'crouch' },
    ] },
    howl: { kind: 'seq', name: '凍える遠吠え', color: ICE, recover: 0.4, steps: [
      { at: 0.75, tele: 0.7, do: 'nova', max: 16, speed: 10, waves: 2, gap: 0.5, pose: 'rear' },
      { at: 0.75, do: 'se', se: 'roar', shake: 0.5 },
      { at: 1.9, tele: 1.0, do: 'zones', o: 'each', r: 3, fx: 'pillar', burst: 6 },
    ] },
    tail: { kind: 'seq', name: '尾の吹雪', color: 0xe1f5fe, recover: 0.45, steps: [
      { at: 0.6, tele: 0.5, do: 'hit', shape: 'sector', r: 7.5, arc: 2.4, a: PI, fx: 'arc', pose: 'tail', se: 'swing' },
      { at: 0.75, do: 'shots', pat: 'ring', n: 14, speed: 9, waves: 2, gap: 0.35 },
    ] },
    circle: { kind: 'seq', name: '狼の旋回→横から突進', color: 0xb3e5fc, recover: 0.5, steps: [
      { at: 0.3, tele: 0.25, do: 'move', m: 'orbit', rr: 9, speed: 2.4, dur: 1.4, pose: 'lunge' },
      { at: 2.3, tele: 0.55, do: 'move', m: 'dash', speed: 28, dur: 0.55, w: 4, k: 1.1, pose: 'crouch' },
    ] },
    icicles: { kind: 'seq', name: '氷柱の雨', color: 0xb3e5fc, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'se', se: 'roar', pose: 'rear' },
      { at: 1.7, tele: 1.15, do: 'zones', o: 'rand', n: 7, spread: 12, first: false, r: 2.4, stagger: 0.1, fx: 'meteor' },
      { at: 2.0, tele: 1.25, do: 'zones', o: 'each', r: 2.8, burst: 5, fx: 'meteor' },
    ] },
    ult: { kind: 'seq', ult: true, name: 'フィンブルの冬', hint: '大吹雪が来る！ ボスから見て岩の陰に隠れろ！', hpAt: ULT_AT, charge: 3.0, color: 0xe1f5fe, recover: 0.8, steps: [
      { at: 0.05, do: 'safe', groups: [{ kind: 'rock', n: 4, rr: 8, r: 2.4 }], show: 4 },
      { at: 3.0, tele: 3.0, do: 'se', se: 'roar', shake: 0.8, pose: 'charge' },
      { at: 1.6, do: 'pull', strength: -2.6, dur: 1.8 },
      { at: 1.6, do: 'vfx', type: 'wind', y: 0, d: { r: 22, dur: 1.8 } },
      { at: 3.4, do: 'cover', pose: 'rear' },
    ] },
  },
  rage: RAGE, restMin: 0.3, restMax: 0.7,
  look: { monster: 'beast', scale: 2.1, horn: 0xe1f5fe, eye: 0x40c4ff, belly: 0xeceff1, mane: 0xffffff },
};

// ---------------- 氷雪の女王セルシア（氷の魔導士。距離を取る） ----------------
const FROST = 0x4fc3f7;
const celsia = {
  name: '氷雪の女王セルシア', color: 0x81d4fa,
  hp: 17000, def: 9, speed: 4.4, radius: 1.6, hpY: 6, keep: 9,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 6,
  near: { mirror: 0.25, ring: 0.25, prison: 0.2, blizzard: 0.15, shards: 0.15 },
  far: { lance: 0.25, spikes: 0.25, prison: 0.15, shards: 0.2, blizzard: 0.15 },
  patterns: {
    lance: { kind: 'seq', name: '氷槍三連射', color: 0xb3e5fc, recover: 0.45, steps: [
      { at: 0.75, tele: 0.65, do: 'hit', shape: 'rect', len: 30, w: 1.8, fx: 'line', fxd: { tall: 2 }, pose: 'cast', se: 'wave' },
      { at: 1.2, tele: 0.45, do: 'hit', shape: 'rect', len: 30, w: 1.8, fx: 'line', fxd: { tall: 2 }, pose: 'cast', se: 'wave' },
      { at: 1.65, tele: 0.45, do: 'hit', shape: 'rect', len: 30, w: 2.4, k: 1.2, fx: 'line', fxd: { tall: 3 }, pose: 'cast', se: 'wave' },
    ] },
    prison: { kind: 'seq', name: '氷の牢獄', color: ICE, recover: 0.5, steps: [
      { at: 0.2, do: 'vfx', o: 'tgt', type: 'pillars', d: { r: 4.5, n: 14, dur: 1.9 }, se: 'seal' },
      { at: 1.8, tele: 1.6, do: 'hit', o: 'tgt', shape: 'circle', r: 4.2, k: 1.3, fx: 'pillar', pose: 'cast' },
    ] },
    mirror: { kind: 'seq', name: '氷鏡渡り（背後から）', color: FROST, recover: 0.5, steps: [
      { at: 0.55, tele: 0.5, do: 'move', m: 'warp', to: 'back', dist: 4, pose: 'cast' },
      { at: 1.1, tele: 0.45, do: 'hit', shape: 'circle', r: 4.5, fx: 'pillar', pose: 'cast' },
      { at: 1.1, do: 'shots', pat: 'ring', n: 12, speed: 8 },
    ] },
    blizzard: { kind: 'seq', name: '吹雪の渦', color: 0xe1f5fe, recover: 0.5, steps: [
      { at: 0.9, tele: 0.8, do: 'rot', arms: 2, arc: 0.6, len: 18, speed: 1.0, dur: 2.2, pose: 'cast' },
      { at: 0.9, do: 'se', se: 'wave', pose: 'cast', dur: 2.2 },
    ] },
    spikes: { kind: 'seq', name: '氷結の地走り（五方向）', color: ICE, recover: 0.45, steps: [
      { at: 0.85, tele: 0.75, do: 'hit', o: 'fan', n: 5, spread: 0.42, shape: 'rect', len: 20, w: 1.8, fx: 'line', fxd: { tall: 1.5 }, pose: 'over' },
    ] },
    shards: { kind: 'seq', name: '氷晶の弾幕', color: 0xb3e5fc, recover: 0.4, steps: [
      { at: 0.6, tele: 0.5, do: 'shots', pat: 'spiral', arms: 4, dur: 2.0, interval: 0.15, turn: 0.24, speed: 8, pose: 'cast' },
      { at: 1.4, do: 'shots', pat: 'fan', n: 5, spread: 0.2, speed: 15, volleys: 2, gap: 0.4 },
    ] },
    ring: { kind: 'seq', name: '凍結陣（外→内）', color: FROST, recover: 0.5, steps: [
      { at: 0.8, tele: 0.75, do: 'hit', shape: 'donut', rIn: 4.5, rOut: 13, pose: 'cast' },
      { at: 1.75, tele: 0.8, do: 'hit', shape: 'circle', r: 4.5, k: 1.2, fx: 'pillar', pose: 'over' },
    ] },
    ult: { kind: 'seq', ult: true, name: '絶対零度', hint: '「動くな」の合図の間は一歩も動くな！（回避もダメ・3回）', hpAt: ULT_AT, charge: 2.6, color: 0xe1f5fe, recover: 0.8, steps: [
      { at: 2.6, tele: 2.6, do: 'se', se: 'seal', pose: 'charge' },
      { at: 2.7, do: 'banner', text: '❄ 動くな！' },
      { at: 3.6, tele: 0.85, do: 'still', pose: 'cast' },
      { at: 3.8, do: 'shots', pat: 'ring', n: 18, speed: 8, waves: 2, gap: 0.45 },
      { at: 4.9, do: 'banner', text: '❄ 動くな！' },
      { at: 5.8, tele: 0.85, do: 'still', pose: 'cast' },
      { at: 6.0, do: 'shots', pat: 'ring', n: 18, speed: 8, waves: 2, gap: 0.45 },
      { at: 7.1, do: 'banner', text: '❄ 動くな！' },
      { at: 8.0, tele: 0.85, do: 'still', pose: 'over' },
    ] },
  },
  rage: RAGE, restMin: 0.4, restMax: 0.85,
  look: { scale: 2.4, horn: 0xe1f5fe, eye: 0x40c4ff, weapon: 'staff', metal: 0x90caf9 },
};

// ---------------- 雷鳥ヴォルト（雷の鳥。速い） ----------------
const BOLT = 0xffee58;
const volt = {
  name: '雷鳥ヴォルト', color: 0xfdd835,
  hp: 18000, def: 9, speed: 6.6, radius: 2.2, hpY: 7,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 7,
  near: { storm: 0.2, cross: 0.2, dash: 0.2, dive: 0.2, chain: 0.2 },
  far: { bolt: 0.25, chain: 0.2, field: 0.2, dive: 0.15, dash: 0.2 },
  patterns: {
    bolt: { kind: 'seq', name: '落雷（二連）', color: BOLT, recover: 0.4, steps: [
      { at: 1.0, tele: 0.85, do: 'zones', o: 'each', r: 2.8, fx: 'bolt', pose: 'wings' },
      { at: 1.6, tele: 0.55, do: 'zones', o: 'each', r: 2.8, fx: 'bolt' },
    ] },
    chain: { kind: 'seq', name: '連鎖雷撃（はね返る）', color: BOLT, recover: 0.45, steps: [
      { at: 0.8, tele: 0.7, do: 'hit', shape: 'rect', len: 28, w: 2, fx: 'line', fxd: { tall: 3 }, pose: 'lunge', se: 'wave' },
      { at: 1.25, tele: 0.4, do: 'hit', shape: 'rect', a: 0.6, len: 26, w: 2, reaim: false, fx: 'line', fxd: { tall: 3 }, se: 'wave' },
      { at: 1.25, tele: 0.4, do: 'hit', shape: 'rect', a: -0.6, len: 26, w: 2, reaim: false, fx: 'line', fxd: { tall: 3 } },
    ] },
    dive: { kind: 'seq', name: '雷速の急降下', color: BOLT, recover: 0.4, steps: [
      { at: 0.55, tele: 0.4, do: 'move', m: 'rise', h: 13, dur: 0.55, pose: 'wings' },
      { at: 2.0, tele: 1.4, do: 'move', m: 'dive', dur: 0.3, r: 5, follow: 0.9, ring: 14, fx: 'bolt' },
    ] },
    storm: { kind: 'seq', name: '雷雲の羽ばたき', color: 0xfff59d, recover: 0.4, steps: [
      { at: 0.6, tele: 0.5, do: 'nova', max: 18, speed: 12, waves: 2, gap: 0.5, pose: 'wings' },
      { at: 0.6, do: 'shots', pat: 'ring', n: 16, speed: 10, waves: 3, gap: 0.35, turn: 0.12 },
    ] },
    cross: { kind: 'seq', name: '十字放電', color: BOLT, recover: 0.45, steps: [
      { at: 0.8, tele: 0.7, do: 'hit', o: 'fan', n: 4, spread: PI / 2, shape: 'rect', len: 22, w: 2.4, fx: 'line', fxd: { tall: 3 }, pose: 'wings', se: 'wave' },
      { at: 1.5, tele: 0.55, do: 'hit', o: 'fan', n: 4, spread: PI / 2, a: PI / 4, reaim: false, shape: 'rect', len: 22, w: 2.4, fx: 'line', fxd: { tall: 3 }, se: 'wave' },
    ] },
    dash: { kind: 'seq', name: '稲妻突進（ジグザグ）', color: 0xfff176, recover: 0.4, steps: [
      { at: 0.55, tele: 0.55, do: 'move', m: 'dash', speed: 30, dur: 0.4, w: 3.6, a: 0.4, pose: 'lunge' },
      { at: 1.25, tele: 0.4, do: 'move', m: 'dash', speed: 30, dur: 0.4, w: 3.6, pose: 'lunge' },
      { at: 1.95, tele: 0.4, do: 'move', m: 'dash', speed: 32, dur: 0.45, w: 3.6, k: 1.1, pose: 'lunge' },
    ] },
    field: { kind: 'seq', name: '帯電地帯', color: BOLT, recover: 0.4, steps: [
      { at: 0.5, tele: 0.45, do: 'se', se: 'gate', pose: 'cast' },
      { at: 1.6, tele: 1.1, do: 'zones', o: 'rand', n: 8, spread: 11, first: false, r: 2.6, stagger: 0.08, fx: 'bolt' },
      { at: 1.9, tele: 1.1, do: 'zones', o: 'each', r: 2.6, fx: 'bolt', burst: 6 },
    ] },
    ult: { kind: 'seq', ult: true, name: '雷霆の裁き', hint: '足元に落雷が6回追ってくる！ 止まらず走れ！', hpAt: ULT_AT, charge: 2.6, color: BOLT, recover: 0.8, steps: [
      { at: 2.6, tele: 2.6, do: 'se', se: 'roar', shake: 0.6, pose: 'charge' },
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ at: 3.2 + i * 0.6, tele: 0.75, do: 'zones', o: 'each', r: 3, fx: 'bolt', pose: 'wings' })),
    ] },
  },
  rage: RAGE, restMin: 0.3, restMax: 0.7,
  look: { monster: 'dragon', scale: 1.6, horn: 0xfff59d, eye: 0xffffff, belly: 0xfff9c4, wingColor: 0xf9a825 },
};

// ---------------- 霜の巨人ヨトゥン（巨体・鈍重） ----------------
const GLACIER = 0x90caf9;
const jotun = {
  name: '霜の巨人ヨトゥン', color: 0x78909c,
  hp: 11800, def: 13, speed: 4.4, radius: 2.4, hpY: 8.5,
  shotHit: 1 / 5, meleeHit: 1 / 2.9,
  nearRange: 7,
  near: { smash: 0.2, stomp: 0.25, sweep: 0.25, stamp: 0.15, glacier: 0.15 },
  far: { boulder: 0.3, avalanche: 0.25, glacier: 0.25, stamp: 0.2 },
  patterns: {
    smash: { kind: 'seq', name: '氷槌振り下ろし', color: GLACIER, recover: 0.55, steps: [
      { at: 0.95, tele: 0.85, do: 'hit', shape: 'rect', len: 11, w: 3, k: 1.3, fx: 'line', fxd: { tall: 2.5 }, pose: 'over', se: 'swing' },
      ...runLine(1.25, 4, 0.1, 2.6, 1.9, { dist: undefined }).map((s, i) => ({ ...s, dist: 12 + i * 2.6, k: 0.7, reaim: false })),
    ] },
    stomp: { kind: 'seq', name: '地響き三連（波紋）', color: 0xb0bec5, recover: 0.5, steps: [
      { at: 0.7, tele: 0.65, do: 'hit', shape: 'circle', r: 4.5, fx: 'pillar', pose: 'crouch' },
      { at: 1.4, tele: 0.65, do: 'hit', shape: 'donut', rIn: 4.5, rOut: 8, pose: 'crouch' },
      { at: 2.1, tele: 0.65, do: 'hit', shape: 'donut', rIn: 8, rOut: 12, pose: 'crouch' },
    ] },
    sweep: { kind: 'seq', name: '巨腕の薙ぎ払い', color: GLACIER, recover: 0.5, steps: [
      { at: 0.8, tele: 0.7, do: 'hit', shape: 'sector', r: 9, arc: 3.0, a: 0.01, fx: 'arc', pose: 'swing', se: 'swing' },
      { at: 1.5, tele: 0.5, do: 'hit', shape: 'sector', r: 9, arc: 3.0, a: -0.01, fx: 'arc', pose: 'swing', se: 'swing' },
    ] },
    boulder: { kind: 'seq', name: '氷塊投げ', color: 0xe1f5fe, recover: 0.5, steps: [
      { at: 1.3, tele: 1.1, do: 'zones', o: 'tgt', r: 4.6, burst: 12, fx: 'meteor', pose: 'over' },
    ] },
    avalanche: { kind: 'seq', name: '雪崩', color: 0xeceff1, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'se', se: 'roar', pose: 'rear' },
      { at: 0.7, do: 'wall', speed: 10, max: 46, gapW: 4.6, gapRange: 7, wait: 0.7 },
    ] },
    stamp: { kind: 'seq', name: '跳躍踏み潰し', color: 0xb0bec5, recover: 0.6, steps: [
      { at: 0.8, tele: 0.8, do: 'move', m: 'leap', dur: 0.8, h: 8, r: 5.5, k: 1.3, ring: 12, fx: 'pillar', pose: 'crouch' },
    ] },
    glacier: { kind: 'seq', name: '氷河の突き上げ', color: ICE, recover: 0.5, steps: [
      { at: 0.4, tele: 0.4, do: 'se', se: 'slam', pose: 'over' },
      ...runLine(0.9, 7, 0.1, 2.6, 2.1),
    ] },
    ult: { kind: 'seq', ult: true, name: '氷河崩落', hint: '空から氷河が降ってくる！ 巨人の足元（緑の円）に飛び込め！', hpAt: ULT_AT, charge: 2.8, color: 0xe1f5fe, recover: 0.8, steps: [
      { at: 0.05, do: 'safe', groups: [{ kind: 'safe', n: 1, rr: 0, r: 5 }], show: 3.6 },
      { at: 2.8, tele: 2.8, do: 'se', se: 'roar', shake: 0.8, pose: 'charge' },
      { at: 2.0, do: 'zones', tele: 1.4, o: 'rand', n: 8, spread: 14, first: false, r: 3.4, fx: 'meteor', stagger: 0.05 },
      { at: 3.4, do: 'check', color: 0xe1f5fe, pose: 'rear' },
    ] },
  },
  rage: RAGE, restMin: 0.6, restMax: 1.2,
  look: { scale: 3.4, horn: 0xe1f5fe, eye: 0x40c4ff, weapon: 'club', metal: 0x90a4ae },
};

// ---------------- 影の暗殺者ノクス（速い剣士） ----------------
const SHADE = 0x7c4dff;
const nox = {
  name: '影の暗殺者ノクス', color: 0x37474f,
  hp: 11000, def: 8, speed: 7.2, radius: 1.4, hpY: 5.5,
  shotHit: 1 / 5, meleeHit: 1 / 3,
  nearRange: 6,
  near: { slash: 0.25, whirl: 0.2, blink: 0.2, smoke: 0.15, mark: 0.2 },
  far: { daggers: 0.3, shadow: 0.25, smoke: 0.2, mark: 0.25 },
  patterns: {
    slash: { kind: 'seq', name: '影の三連斬', color: SHADE, recover: 0.4, steps: [
      { at: 0.4, tele: 0.35, do: 'hit', shape: 'sector', r: 4.8, arc: 2.0, a: 0.01, k: 0.7, fx: 'arc', pose: 'swing', se: 'swing' },
      { at: 0.75, tele: 0.3, do: 'hit', shape: 'sector', r: 4.8, arc: 2.0, a: -0.01, k: 0.7, fx: 'arc', pose: 'swing', se: 'swing' },
      { at: 1.2, tele: 0.4, do: 'hit', shape: 'rect', len: 7, w: 2.2, k: 1.1, fx: 'line', pose: 'lunge', se: 'swing' },
    ] },
    blink: { kind: 'seq', name: '背後取り', color: SHADE, recover: 0.45, steps: [
      { at: 0.45, tele: 0.4, do: 'move', m: 'warp', to: 'back', dist: 3, color: 0x311b92 },
      { at: 0.9, tele: 0.4, do: 'hit', shape: 'sector', r: 5, arc: 1.8, k: 1.1, fx: 'claw', fxd: { r: 5 }, pose: 'swing', se: 'swing' },
    ] },
    daggers: { kind: 'seq', name: '投げナイフ', color: 0xb388ff, recover: 0.35, steps: [
      { at: 0.45, tele: 0.4, do: 'shots', pat: 'fan', n: 5, spread: 0.16, speed: 20, volleys: 3, gap: 0.25, pose: 'swing' },
    ] },
    shadow: { kind: 'seq', name: '影走り（三連突進）', color: SHADE, recover: 0.4, steps: [
      { at: 0.5, tele: 0.5, do: 'move', m: 'dash', speed: 30, dur: 0.35, w: 3, k: 0.8, a: -0.5, pose: 'lunge' },
      { at: 1.1, tele: 0.4, do: 'move', m: 'dash', speed: 30, dur: 0.35, w: 3, k: 0.8, a: 0.5, pose: 'lunge' },
      { at: 1.7, tele: 0.4, do: 'move', m: 'dash', speed: 32, dur: 0.4, w: 3, k: 1, pose: 'lunge' },
    ] },
    smoke: { kind: 'seq', name: '煙幕からの奇襲', color: 0x546e7a, recover: 0.5, steps: [
      { at: 0.35, tele: 0.3, do: 'move', m: 'hide', color: 0x546e7a, pose: 'crouch' },
      { at: 1.9, tele: 1.3, do: 'move', m: 'warp', to: 'tgt', follow: 0.8, r: 3.6, k: 1.2, fx: 'claw' },
    ] },
    mark: { kind: 'seq', name: '死の刻印', color: 0xd500f9, recover: 0.4, steps: [
      { at: 0.4, tele: 0.35, do: 'se', se: 'seal', pose: 'cast' },
      { at: 2.0, tele: 1.7, do: 'zones', o: 'each', r: 2.6, k: 1.2, fx: 'claw' },
    ] },
    whirl: { kind: 'seq', name: '旋風斬', color: SHADE, recover: 0.45, steps: [
      { at: 0.45, tele: 0.4, do: 'hit', shape: 'circle', r: 4.2, k: 0.6, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'spin' },
      { at: 0.45, do: 'move', m: 'dash', speed: 6, dur: 1.2, hitR: -1, pose: 'spin' },
      { at: 0.85, tele: 0.2, do: 'hit', shape: 'circle', r: 4.2, k: 0.6, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'swing' },
      { at: 1.25, tele: 0.2, do: 'hit', shape: 'circle', r: 4.2, k: 0.6, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'swing' },
      { at: 1.65, tele: 0.2, do: 'hit', shape: 'circle', r: 4.2, k: 0.8, fx: 'arc', fxd: { arc: 6.28 }, impact: false, se: 'swing' },
    ] },
    ult: { kind: 'seq', ult: true, name: '影縫い', hint: '影が3回 死角に現れる！ 現れた方を向け！（背を向けたら斬られる）', hpAt: ULT_AT, charge: 2.4, color: SHADE, recover: 0.6, steps: [
      { at: 2.4, tele: 2.4, do: 'se', se: 'seal', pose: 'charge' },
      ...[0, 1, 2].flatMap((i) => [
        { at: 2.5 + i * 2.0, do: 'move', m: 'hide', color: 0x311b92 },
        { at: 2.9 + i * 2.0, do: 'move', m: 'warp', to: 'rand', dist: 6, color: 0x7c4dff },
        { at: 2.95 + i * 2.0, do: 'banner', text: '👁 振り向け！' },
        { at: 4.2 + i * 2.0, tele: 1.2, do: 'facing', invert: true, pose: 'swing' },
      ]),
    ] },
  },
  rage: RAGE, restMin: 0.5, restMax: 1.0,
  look: { scale: 2.0, horn: 0x212121, eye: 0xd500f9, weapon: 'sword', metal: 0x263238 },
};

// ---------------- 星喰いの竜アストラル（最後のボス） ----------------
const STAR = 0xb388ff;
const SKY = 0x80d8ff;
const astral = {
  name: '星喰いの竜アストラル', color: 0x311b92,
  hp: 26500, def: 14, speed: 4.6, radius: 3.6, hpY: 11.5,
  shotHit: 1 / 5, meleeHit: 1 / 2.8,
  nearRange: 9,
  near: { claws: 0.2, gravity: 0.15, breath: 0.15, nova: 0.15, stars: 0.15, comet: 0.2 },
  far: { meteor: 0.25, breath: 0.2, stars: 0.2, comet: 0.2, gravity: 0.15 },
  patterns: {
    claws: { kind: 'seq', name: '星爪', color: STAR, recover: 0.5, steps: [
      { at: 0.55, tele: 0.48, do: 'hit', shape: 'sector', r: 9, arc: 1.6, a: 0.01, k: 0.8, fx: 'claw', fxd: { r: 9 }, pose: 'swing', se: 'swing' },
      { at: 1.0, tele: 0.4, do: 'hit', shape: 'sector', r: 9, arc: 1.6, a: -0.01, k: 0.8, fx: 'claw', fxd: { r: 9 }, pose: 'swing', se: 'swing' },
      { at: 1.6, tele: 0.5, do: 'hit', shape: 'sector', r: 11, arc: 3.0, a: PI, k: 1, fx: 'arc', pose: 'tail', se: 'swing' },
    ] },
    meteor: { kind: 'seq', name: '流星群', color: SKY, recover: 0.5, steps: [
      { at: 0.6, tele: 0.55, do: 'se', se: 'roar', pose: 'cast' },
      { at: 1.9, tele: 1.3, do: 'zones', o: 'rand', n: 10, spread: 14, first: false, r: 2.8, stagger: 0.09, fx: 'meteor' },
      { at: 2.2, tele: 1.4, do: 'zones', o: 'each', r: 3.4, burst: 8, fx: 'meteor' },
    ] },
    gravity: { kind: 'seq', name: '重力井戸', color: STAR, recover: 0.5, steps: [
      { at: 0.3, do: 'pull', strength: 5.6, dur: 1.8, pose: 'cast' },
      { at: 0.3, do: 'vfx', type: 'coil', y: 0, d: { r: 11, dur: 1.9 } },
      { at: 2.2, tele: 1.9, do: 'hit', shape: 'circle', r: 6, k: 1.3, fx: 'pillar', pose: 'over' },
    ] },
    breath: { kind: 'seq', name: '星の息吹（左右なぎ払い）', color: SKY, recover: 0.6, steps: [
      { at: 0.9, tele: 0.8, do: 'rot', arms: 2, arc: 0.5, len: 26, speed: 1.1, a: -PI / 2, dur: 1.6, pose: 'lunge' },
      { at: 0.9, do: 'se', se: 'wave', pose: 'lunge', dur: 1.6 },
    ] },
    comet: { kind: 'seq', name: '彗星突撃', color: STAR, recover: 0.6, steps: [
      { at: 0.6, tele: 0.45, do: 'move', m: 'rise', h: 16, dur: 0.6, pose: 'wings' },
      { at: 2.4, tele: 1.7, do: 'move', m: 'dive', dur: 0.4, r: 7, follow: 1.1, ring: 18, fx: 'pillar' },
    ] },
    nova: { kind: 'seq', name: '超新星', color: 0xea80fc, recover: 0.5, steps: [
      { at: 0.85, tele: 0.8, do: 'hit', shape: 'circle', r: 6, fx: 'pillar', pose: 'rear' },
      { at: 0.85, do: 'nova', max: 26, speed: 12, width: 0.8, waves: 3, gap: 0.45 },
      { at: 0.85, do: 'se', se: 'roar', shake: 1 },
    ] },
    stars: { kind: 'seq', name: '星座の陣', color: SKY, recover: 0.5, steps: [
      { at: 0.95, tele: 0.85, do: 'hit', o: 'ring', n: 6, rr: 7, off: 0, shape: 'circle', r: 2.8, fx: 'pillar', pose: 'cast' },
      { at: 1.6, tele: 0.6, do: 'hit', o: 'ring', n: 6, rr: 12, off: PI / 6, shape: 'circle', r: 3, fx: 'pillar' },
      { at: 2.2, tele: 0.6, do: 'hit', o: 'ring', n: 8, rr: 17, off: 0, shape: 'circle', r: 3, fx: 'pillar' },
    ] },
    ult: { kind: 'seq', ult: true, name: '星墜とし', hint: '離れろ → 懐へ戻れ → 最後は輪に合わせて回避！', hpAt: ULT_AT, charge: 3.0, color: 0xea80fc, recover: 0.8, steps: [
      { at: 3.0, tele: 3.0, do: 'se', se: 'roar', shake: 0.8, pose: 'charge' },
      { at: 3.3, tele: 3.25, do: 'hit', shape: 'circle', r: 14, fx: 'pillar', fxd: { h: 24 }, pose: 'rear' },
      { at: 3.4, do: 'banner', text: '☄ 懐へ戻れ！' },
      { at: 5.6, tele: 2.2, do: 'hit', shape: 'donut', rIn: 6, rOut: 34, pose: 'wings' },
      { at: 5.65, do: 'vfx', type: 'beat', d: { times: [1.65], lead: 1.2 } },
      { at: 5.7, do: 'banner', text: '✦ 輪が縮んだら回避！' },
      { at: 7.3, do: 'all', flash: true, se: 'wave', pose: 'rear' },
      { at: 7.3, do: 'vfx', type: 'wind', y: 0, d: { r: 24, dur: 0.7 } },
    ] },
  },
  rage: { ...RAGE, summon: 'golem', summonEvery: 18, summonMax: 2, summonOffset: [7, 3] },
  restMin: 0.35, restMax: 0.8,
  look: { monster: 'dragon', scale: 3.2, horn: 0x80d8ff, eye: 0xea80fc, belly: 0x7e57c2, wingColor: 0x1a237e },
};

/** ステージ6のボス（data/enemies.js の BOSSES に足す） */
export const S6_BOSSES = { fenrir, celsia, volt, jotun, nox, astral };
