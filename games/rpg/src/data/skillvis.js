// 技の演出のレシピ（鎖鎌使いより後の職業）。src/skillvis.js が読んで出す
//   cast … 使った瞬間に出すもの / tick … 周囲攻撃の1回ごと（noSpin：いつもの輪を出さない）
//   zone … 置いたエリア・時間差の一撃（fall 落ちてくる物 / loop 置いている間ずっと） / land … 一撃が落ちたとき
//   landing … 跳ぶ技の着地
// 1つの演出は [種類, { … }]。at は何秒後に出すか、where は場所（self 足元 / front 前 / target 一番近いボス / aim 狙った場所）
// 種類：vm 一人称の動き / slash 斬撃（roll 90°で縦、±0.85 で斜め） / ring マークの輪 / song 楽譜の輪 / scatter 画面にマーク
//   explode 爆発 / bolt 稲妻 / column 光の柱 / pillar 相手に光の柱 / slam 地面の衝撃 / flash 光 / streak 光の筋 / orbit まわりを回るマーク
//   dome 膜 / burst 火花 / shake 揺れ / confetti 紙吹雪 / fire 吐き出す炎 / bind 鎖で縛る / net 網 / skulls ドクロ / drain 吸い取る風
//   lob 投げる / clock 時計 / suck 吸い込む渦 / shieldwall 盾の壁 / rewind 時計の縁 / whiteout 画面が光る
const V = Math.PI / 2;
const vm = (kind, dur, extra) => ['vm', { kind, dur, extra }];
const vert = (o = {}) => ['slash', { roll: V, sweep: 1.1, arc: 1.4, y: 1.4, ...o }]; // 縦斬り
const diag = (left, o = {}) => ['slash', { roll: left ? 0.85 : -0.85, sweep: left ? 1.6 : -1.6, arc: 2.4, y: 1.35, ...o }]; // 斜め斬り
const side = (toRight, o = {}) => ['slash', { roll: 0, sweep: toRight ? -1.8 : 1.8, arc: 2.6, ...o }]; // 横薙ぎ
const shake = (amt) => ['shake', { amt }];
/** 交互の斜め斬り（×字）。周囲攻撃の1回ごと */
const xTick = (color, r) => (n) => [diag(n % 2 === 1, { color, r, dur: 0.22 }), ['burst', { color, n: 10, speed: 7, up: 3, life: 0.3, size: 0.1 }], shake(0.12)];
/** 振り下ろして地面を叩く（周囲攻撃の1回ごと） */
const smashTick = (color, r, big = false) => () => [vm('bigchop', 0.32), ['slam', { color, r, at: 0.1 }], ['explode', { color, r: r * 0.7, big, at: 0.1 }], shake(big ? 0.7 : 0.45)];

export const SKILL_VIS = {
  // ---- 暗黒騎士 ----
  darkblade: { cast: [vm('iai', 0.4, { glow: 0x5a1a8a }), ['orbit', { color: 0xb388ff, n: 14, r: 0.7, h: 2.2, dur: 0.45, spin: 6, size: 0.3 }], vert({ r: 5, color: 0x9c27b0, at: 0.14 }), vert({ r: 5.4, color: 0x6a1b9a, white: false, at: 0.18, dur: 0.4 }), ['flash', { where: 'front', dist: 3, color: 0xb388ff, size: 5, at: 0.16 }], ['shake', { amt: 0.4, at: 0.14 }]] },
  darkveil: { cast: [vm('raise', 0.7), ['orbit', { tex: 'smoke', color: 0x6a1b9a, n: 12, r: 1, h: 2.4, rise: 0.5, size: 1.2, opacity: 0.7 }], ['dome', { color: 0x4a148c, r: 1.6, dur: 0.8 }]] },
  // 暗黒解放：剣を掲げて（windup 0.35秒）、周りに闇の雷を降らせる
  darkrelease: { cast: [vm('raise', 1.4, { glow: 0x5a1a8a }), ['whiteout', { css: '#12001f', max: 0.55, dur: 1.3 }], ['orbit', { color: 0xb388ff, n: 16, r: 1, h: 3, dur: 1.3, rise: 1.2, size: 0.35 }]], tick: () => [['bolt', { where: 'self', n: 3, spread: 4.5, color: 0x6a1b9a, core: 0xe1bee7, size: 1.1, gap: 0.05 }], ['slam', { r: 5, color: 0x7b1fa2 }], shake(0.5)], noSpin: true },
  // ---- 祈祷師（トーテムは足元に杖を突き立てる） ----
  wartotem: { cast: [vm('plant', 0.6, { hit: 0.3 }), ['flash', { color: 0xff7043, size: 4, at: 0.3 }]], zone: { loop: { type: 'rise', glyph: '⚔', every: 0.35, h: 2.5, size: 0.5, life: 1.2 } } },
  healtotem: { cast: [vm('plant', 0.6, { hit: 0.3 }), ['flash', { color: 0x69f0ae, size: 4, at: 0.3 }]], zone: { loop: { type: 'rise', glyph: '✚', every: 0.3, h: 2.5, size: 0.5, life: 1.2 } } },
  spirittotem: { cast: [vm('plant', 0.6, { hit: 0.3 }), ['column', { color: 0xffd54f, r: 1.2, h: 6, dur: 0.7, at: 0.3 }], shake(0.3)], zone: { loop: [{ type: 'rise', glyph: '✦', every: 0.2, h: 3, size: 0.55, life: 1.4 }, { type: 'swirl', tex: 'smoke', every: 0.12, out: true, lift: 2, size: 0.8, opacity: 0.5 }] } },
  // ---- 鞭使い ----
  lash: { cast: [vm('drawcut', 0.5), side(true, { r: 7, color: 0xd7ccc8, at: 0.06, dur: 0.35 }), ['burst', { where: 'front', dist: 5, color: 0xd7ccc8, n: 16, at: 0.15 }]] },
  whipcrack: { cast: [vm('iai', 0.3), vert({ r: 4.5, arc: 0.7, color: 0xffffff, at: 0.1 }), ['flash', { where: 'front', dist: 4, color: 0xffffff, size: 4, at: 0.15 }], ['burst', { where: 'front', dist: 4, color: 0xffe0b2, n: 24, speed: 10, at: 0.15 }], shake(0.4)] },
  whiptornado: { cast: [vm('xstorm', 1.2, { every: 0.12 })], tick: xTick(0xd7ccc8, 6) },
  // ---- 変化師 ----
  morphshot: { cast: [vm('hat', 0.8), ['burst', { color: 0xce93d8, n: 30, at: 0.35 }], ['flash', { where: 'front', dist: 1, color: 0xe1bee7, size: 3, at: 0.35 }]] },
  morphstep: { cast: [['flash', { color: 0xe1bee7, size: 4 }], ['orbit', { tex: 'smoke', color: 0xce93d8, n: 8, dur: 0.6, r: 0.8, size: 1, rise: 1.5 }]] },
  morphburst: { cast: [vm('cheer', 1)], tick: () => [['explode', { color: 0xce93d8, r: 3, spread: 2, n: 2, gap: 0.05 }], ['burst', { color: 0xe1bee7, n: 20 }]] },
  // ---- ギャンブラー ----
  dice: { cast: [['scatter', { glyph: ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'], css: '#ffffff', self: true, n: 10 }], ['lob', { glyph: '⚅', color: 0xffffff, normal: true, time: 0.4 }]] },
  cardtrick: { cast: [vm('hat', 0.8), ['scatter', { glyph: ['♠', '♥', '♦', '♣'], css: '#ffd54f', self: true }]] },
  allin: { cast: [['whiteout', { css: '#ffd54f', max: 0.5 }], ['scatter', { glyph: ['♛', '$', '♠', '♦'], css: '#ffd54f', self: true, n: 18 }], ['confetti', { n: 100 }], ['ring', { glyph: '♛', color: 0xffd54f, r: 6 }]] },
  // ---- 爆弾魔 ----
  clusterbomb: { cast: [vm('toss4', 0.38)] },
  timebomb: { cast: [vm('throwdown', 0.45)], zone: { loop: { type: 'rise', glyph: '⚠', color: 0xff3d00, every: 0.3, h: 1.5, size: 0.7, life: 0.5 } }, land: [['explode', { r: 5, big: true, color: 0xff3d00 }], ['explode', { r: 3, color: 0xffd740, at: 0.12 }], shake(0.9)] },
  selfdestruct: { cast: [['whiteout', { css: '#ff3d00', max: 0.5 }]], tick: () => [['explode', { r: 5, big: true, color: 0xff3d00 }], ['burst', { color: 0xffd740, n: 40, speed: 12 }], shake(0.9)], noSpin: true },
  // ---- 魂喰い ----
  soulrend: { cast: [vm('drawcut', 0.5), side(true, { r: 4, color: 0x80cbc4, at: 0.06 }), ['drain', { color: 0x80cbc4, at: 0.15 }]] },
  soulstep: { cast: [['orbit', { glyph: '☠', color: 0x80cbc4, n: 6, dur: 0.6, r: 0.9, size: 0.4 }], ['flash', { color: 0x80cbc4, size: 4 }]] },
  soulfeast: { cast: [vm('xstorm', 0.9, { every: 0.12 }), ['orbit', { glyph: '☠', color: 0x26a69a, n: 10, dur: 1.2, r: 2.5, h: 2, spin: 4, size: 0.5 }]], tick: xTick(0x26a69a, 4.5), noSpin: true },
  // ---- 鏡術師 ----
  mirrorshard: { cast: [['flash', { where: 'front', dist: 1.2, color: 0xe0f7fa, size: 3 }], ['burst', { where: 'front', dist: 1.2, color: 0xe0f7fa, n: 20, speed: 9 }]] },
  mirrorwall: { cast: [vm('plant', 0.6, { hit: 0.3 }), ['ring', { glyph: '◇', color: 0xe0f7fa, r: 4, n: 8 }]], zone: { loop: { type: 'rise', glyph: '◆', every: 0.15, h: 2.5, size: 0.35, life: 0.8 } } },
  mirrorworld: { cast: [vm('cheer', 1), ['whiteout', { css: '#e0f7fa', max: 0.4 }], ['ring', { glyph: '◇', color: 0xb2ebf2, r: 9, n: 14, dur: 1.4 }]], zone: { loop: { type: 'rise', glyph: '◆', every: 0.06, h: 3.5, size: 0.4, life: 1 } } },
  // ---- 重力術師 ----
  gravwell: { cast: [vm('raise', 0.6)], zone: { loop: [{ type: 'swirl', tex: 'smoke', every: 0.05, turn: 5, size: 0.9, opacity: 0.7 }, { type: 'swirl', every: 0.08, turn: 6, size: 0.4 }] } },
  graviton: { cast: [vm('throwdown', 0.45), ['column', { where: 'target', color: 0x5c6bc0, r: 2, h: 7, dur: 0.5, at: 0.15 }], ['slam', { where: 'target', color: 0x5c6bc0, r: 4, at: 0.2 }], ['orbit', { where: 'target', glyph: '▼', color: 0x7986cb, n: 6, r: 1.6, h: 3, dur: 5, rise: -0.6, size: 0.5 }], shake(0.5)] },
  blackhole: { cast: [vm('cheer', 1), ['whiteout', { css: '#1a237e', max: 0.45 }]], zone: { loop: [{ type: 'swirl', tex: 'smoke', every: 0.025, turn: 7, size: 1.2, normal: true, color: 0x0d0d2b, opacity: 0.9 }, { type: 'swirl', every: 0.015, turn: 8, size: 0.8, color: 0xb388ff }, { type: 'swirl', tex: 'smoke', every: 0.05, turn: 6, size: 1.4, color: 0x7c4dff, opacity: 0.6 }] } },
  // ---- 韋駄天 ----
  sonicdash: { cast: [['whiteout', { css: '#ffff8d', max: 0.25, dur: 0.2 }], ['flash', { where: 'front', dist: 10, color: 0xffff8d, size: 5, at: 0.12 }], ['burst', { color: 0xffff8d, n: 30, speed: 10 }]] },
  afterimage: { cast: [vm('raise', 0.5), ['orbit', { color: 0xffff8d, n: 12, r: 1.2, h: 2, spin: 8, size: 0.35 }]] },
  lightspeed: { cast: [vm('xstorm', 1.3, { every: 0.1 }), ['whiteout', { css: '#ffff00', max: 0.3, dur: 0.25 }]], tick: xTick(0xffff00, 4.5), noSpin: true },
  // ---- 呪いの騎士 ----
  cursedblade: { cast: [vm('iai', 0.34), vert({ r: 4.5, color: 0xb71c1c, at: 0.12 }), ['drain', { color: 0xb71c1c, at: 0.2 }]] },
  bloodpact: { cast: [vm('raise', 0.7), ['orbit', { glyph: '♦', color: 0xb71c1c, n: 12, r: 0.9, h: 2.4, rise: 0.6, size: 0.35 }], ['column', { color: 0xb71c1c, r: 1, h: 5, dur: 0.6 }]] },
  cursestorm: { cast: [vm('xstorm', 0.75, { every: 0.12 }), ['orbit', { glyph: '☠', color: 0x880e4f, n: 10, dur: 1, r: 2.4, spin: 5, size: 0.5 }]], tick: xTick(0x880e4f, 4.5), noSpin: true },
  // ---- 背水の剣士 ----
  lastcut: { cast: [vm('drawcut', 0.55), side(true, { r: 5, arc: 2.8, color: 0xff8a80, at: 0.06, dur: 0.35 }), shake(0.4)] },
  rally: { cast: [vm('cheer', 1), ['ring', { glyph: '✚', color: 0xff8a80, r: 8, n: 10 }], ['scatter', { glyph: '✚', css: '#ff8a80', r: 8, n: 10 }]] },
  nowornever: { tick: () => [vm('iai', 0.32), vert({ r: 4.5, color: 0xff5252, at: 0.1 }), ['explode', { where: 'front', dist: 2, color: 0xff5252, r: 3, at: 0.12 }], shake(0.6)], noSpin: true },
  // ---- 料理人 ----
  picnic: { cast: [vm('throwdown', 0.45)], zone: { loop: { type: 'rise', glyph: '♨', color: 0xffcc80, every: 0.25, h: 2, size: 0.55, life: 1.2 } } },
  spicy: { cast: [vm('cheer', 1), ['ring', { glyph: '♨', color: 0xff5722, r: 9, n: 10 }], ['scatter', { glyph: '♨', css: '#ff5722', r: 9, n: 12 }], ['burst', { color: 0xff7043, n: 40, up: 6 }]] },
  feast: { cast: [vm('cheer', 1), ['ring', { glyph: '★', color: 0xffcc80, r: 12, n: 14, dur: 1.4 }], ['confetti', { n: 90 }], ['scatter', { glyph: ['♨', '★', '♥'], css: '#ffcc80', n: 14 }]] },
  // ---- 酔拳家 ----
  drunkpalm: { cast: [vm('kiblast', 0.5), ['burst', { where: 'front', dist: 2, color: 0xffab91, n: 24 }]] },
  sake: { cast: [vm('raise', 0.6), ['orbit', { glyph: '○', color: 0xffab91, n: 10, r: 0.9, h: 2.2, rise: 0.7, size: 0.3 }]] },
  drunkstorm: { cast: [vm('barrage', 1.1)], tick: (n) => [['slash', { roll: (n * 1.7) % 3 - 1.5, sweep: n % 2 ? 1.6 : -1.6, r: 3.5, color: 0xff7043, dur: 0.2, yawOff: (n * 2.3) % 6 }], ['burst', { color: 0xffab91, n: 12, speed: 6, up: 3, life: 0.3 }]] },
  // ---- 狙撃手 ----
  headshot: { cast: [['streak', { color: 0xc8e6c9, w: 0.35, dur: 0.35 }], ['flash', { where: 'target', color: 0xc8e6c9, size: 5, at: 0.05 }], ['burst', { where: 'target', color: 0xffffff, n: 20, speed: 9, at: 0.05 }], shake(0.3)] },
  camo: { cast: [['orbit', { glyph: '❦', color: 0x558b2f, n: 10, r: 1, h: 2, size: 0.45, normal: true }]] },
  railgun: { cast: [0, 0.18, 0.36].flatMap((t) => [['streak', { color: 0x76ff03, w: 0.9, dur: 0.35, at: t }], ['flash', { where: 'target', color: 0x76ff03, size: 6, at: t + 0.04 }], ['shake', { amt: 0.35, at: t }]]) },
  // ---- 予言者 ----
  prophecy: { cast: [vm('raise', 0.6)], zone: { fall: { shape: 'light', fall: 0.4, big: true, boomR: 4 }, loop: { type: 'rise', glyph: '☉', every: 0.25, h: 3, size: 0.6, life: 1 } }, land: [['pillar', { where: 'self', r: 2, h: 12 }], shake(0.7)] },
  foresight: { cast: [vm('raise', 0.5), ['scatter', { glyph: '◉', css: '#fff9c4', self: true, n: 8 }], ['orbit', { glyph: '◉', color: 0xfff9c4, n: 6, r: 1, h: 2.2, size: 0.35 }]] },
  doomsday: { cast: [vm('cheer', 1.1), ['whiteout', { css: '#fff176', max: 0.3 }]], zone: { fall: { shape: 'light', fall: 0.5, big: true, boomR: 4 }, loop: { type: 'rise', glyph: '☉', every: 0.2, h: 4, size: 0.7, life: 1 } }, land: [['pillar', { where: 'self', r: 2.2, h: 14 }], shake(0.6)] },
  // ---- 鬼 ----
  onismash: { cast: [vm('bigchop', 0.55)], tick: () => [['slam', { color: 0xef5350, r: 3.5, at: 0.18 }], ['explode', { color: 0xef5350, r: 3, at: 0.18 }], ['shake', { amt: 0.7, at: 0.18 }]], noSpin: true },
  oniroar: { cast: [vm('cheer', 0.9), ['ring', { glyph: '鬼', color: 0xef5350, r: 6, n: 8 }], ['whiteout', { css: '#d50000', max: 0.3 }], shake(0.6)] },
  onirampage: { tick: smashTick(0xd50000, 3.8, true), noSpin: true },
  // ---- 幽霊 ----
  haunt: { cast: [['orbit', { where: 'target', tex: 'smoke', color: 0xeceff1, n: 10, r: 1.6, h: 3, dur: 3, rise: 0.5, size: 1, opacity: 0.6 }], ['skulls', { color: 0xeceff1 }]] },
  phase: { cast: [['whiteout', { css: '#eceff1', max: 0.3 }], ['orbit', { tex: 'smoke', color: 0xeceff1, n: 10, r: 0.9, h: 2.4, rise: 0.8, size: 1, opacity: 0.5 }]] },
  poltergeist: { cast: [vm('cheer', 0.8), ['explode', { r: 5.5, color: 0xb0bec5, big: true }], ['explode', { r: 3.5, color: 0xeceff1, at: 0.1 }], ['whiteout', { css: '#eceff1', max: 0.45 }], ['orbit', { glyph: ['✎', '☕', '✂', '☐', '♜'], color: 0xcfd8dc, n: 10, r: 2.2, h: 2.5, dur: 4, spin: 2.5, size: 0.55, normal: true }], ['orbit', { tex: 'smoke', color: 0xeceff1, n: 10, r: 0.8, h: 2.4, dur: 4, rise: 0.6, size: 1, opacity: 0.5 }], shake(0.6)] },
  // ---- 双子 ----
  twinshot: { cast: [vm('kiblast', 0.4)] },
  swap: { cast: [['flash', { color: 0xf48fb1, size: 4 }], ['flash', { where: 'front', dist: 5, color: 0x90caf9, size: 4, at: 0.15 }]] },
  twinstorm: { cast: [vm('kiblast', 1.1), ['flash', { where: 'front', dist: 1.5, color: 0xff1744, size: 5 }], ['flash', { where: 'front', dist: 1.5, color: 0x2979ff, size: 5, at: 0.05 }], ...[0.2, 0.4, 0.6, 0.8].map((t) => ['shake', { amt: 0.2, at: t }])] },
  // ---- マシンガンナー ----
  suppress: { cast: [['scatter', { glyph: '•', css: '#ffe082', self: true, n: 10 }]] },
  reloadroll: { cast: [['burst', { color: 0xbdbdbd, n: 16 }]] },
  gatling: { cast: [['akimbo', { dur: 4.3 }], ...[0, 0.6, 1.2, 1.8, 2.4, 3, 3.6].map((t) => ['shake', { amt: 0.15, at: t }])] }, // 左手にも同じ銃（二丁持ち）
  // ---- 火炎放射兵 ----
  napalm: { cast: [['lob', { glyph: '●', color: 0xff5722, to: 'aim', time: 0.4 }]], zone: { loop: { type: 'rise', tex: 'smoke', color: 0xff5722, every: 0.02, h: 2.4, size: 1.1, grow: 1.6, life: 0.7 } } },
  flameburst: { tick: () => [['explode', { r: 3.5, color: 0xff7043 }], ['burst', { color: 0xffca28, n: 40, speed: 9, up: 3 }]] },
  inferno: { cast: [['fire', { range: 8, arc: 1.4 }], shake(0.3)] },
  // ---- ロケット兵 ----
  multirocket: { cast: [shake(0.3)] },
  rocketjump: { cast: [['explode', { r: 2.2, color: 0xff7043 }], shake(0.4)], landing: [['explode', { r: 3.5, color: 0xff7043, big: true }], shake(0.6)] },
  airstrike: { zone: { fall: { shape: 'bomb', fall: 0.55, boomR: 3, big: true } } },
  // ---- 衛生兵 ----
  firstaid: { cast: [vm('throwdown', 0.4), ['ring', { glyph: '✚', color: 0xef5350, r: 6, n: 8 }], ['scatter', { glyph: '✚', css: '#ff5252', r: 6, n: 10 }]] },
  stimpack: { cast: [vm('raise', 0.5), ['ring', { glyph: '✚', color: 0xef9a9a, r: 8, n: 10 }], ['burst', { color: 0xef9a9a, n: 30 }]] },
  fieldhospital: { cast: [vm('plant', 0.6, { hit: 0.3 })], zone: { loop: { type: 'rise', glyph: '✚', color: 0xff5252, every: 0.18, h: 2.5, size: 0.5, life: 1.2 } } },
  // ---- 大槌使い ----
  quake: { cast: [vm('bigchop', 0.55)], tick: () => [['slam', { r: 5, color: 0xa1887f, at: 0.18 }], ['burst', { color: 0x8d6e63, n: 40, speed: 9, up: 5, at: 0.18 }], ['shake', { amt: 0.9, at: 0.18 }]], noSpin: true },
  hammerleap: { cast: [vm('bigchop', 0.7)], landing: [['slam', { r: 4, color: 0x8d6e63 }], ['explode', { r: 3, color: 0xa1887f }], shake(0.8)] },
  meteorhammer: { tick: smashTick(0x6d4c41, 4.5, true), noSpin: true },
  // ---- 双剣士 ----
  crosscut: { cast: [vm('xstorm', 0.3, { every: 0.12 }), diag(false, { r: 4, color: 0x80deea, at: 0.04 }), diag(true, { r: 4, color: 0x80deea, at: 0.14 })] },
  spinrush: { cast: [['burst', { color: 0x80deea, n: 24 }]] },
  bladedance: { cast: [vm('xstorm', 1.6, { every: 0.1 })], tick: xTick(0x4dd0e1, 4), noSpin: true },
  // ---- 盾投げ士 ----
  shieldrush: { cast: [['shieldwall', { dur: 0.5, color: 0x90caf9 }]] },
  shieldwall: { cast: [['shieldwall', { dur: 3, color: 0x90caf9 }], ['ring', { tex: 'shield', color: 0x90caf9, r: 3, n: 6 }]] },
  shieldstorm: { cast: [vm('cheer', 1), ['ring', { tex: 'shield', color: 0x64b5f6, r: 7, n: 8 }]] },
  // ---- ナイフ投げ ----
  poisonknife: { cast: [vm('toss4', 0.38)] },
  backflip: { cast: [['burst', { color: 0xcfd8dc, n: 16 }]] },
  knifestorm: { cast: [vm('cheer', 1)], zone: { loop: { type: 'fall', glyph: '†', color: 0xeceff1, every: 0.025, h: 7, life: 0.35, size: 1, splash: true } } },
  // ---- 光線術士 ----
  ray: { cast: [['flash', { where: 'front', dist: 1, color: 0xe1f5fe, size: 3 }]] },
  prism: { cast: [['flash', { where: 'front', dist: 1, color: 0xb3e5fc, size: 4 }], ['scatter', { glyph: '◆', css: '#b3e5fc', self: true, n: 6 }]] },
  megaray: { cast: [['whiteout', { css: '#40c4ff', max: 0.35 }], ['flash', { where: 'front', dist: 1, color: 0x40c4ff, size: 7 }], ...[0, 0.4, 0.8, 1.2, 1.6].map((t) => ['shake', { amt: 0.3, at: t }])] },
  // ---- 氷結術士 ----
  frostnova: { cast: [vm('throwdown', 0.4)], tick: () => [['ring', { glyph: '❄', color: 0xb3e5fc, r: 5, n: 12, dur: 0.8, rise: 0.2 }], ['burst', { color: 0xe1f5fe, n: 40, speed: 9, up: 3 }]] },
  icefield: { cast: [vm('raise', 0.5)], zone: { loop: [{ type: 'fall', glyph: '❄', color: 0xe1f5fe, every: 0.07, h: 6, life: 0.9, size: 0.45, spin: 3 }, { type: 'rise', glyph: '◆', color: 0x81d4fa, every: 0.2, h: 0.6, size: 0.4, life: 0.8 }] } },
  absolutezero: { cast: [vm('cheer', 1), ['whiteout', { css: '#b3e5fc', max: 0.45 }], ['pillar', { color: 0xb3e5fc, r: 2.2, h: 10 }], ['orbit', { where: 'target', glyph: '❄', color: 0x81d4fa, n: 12, r: 2, h: 3.5, dur: 8, size: 0.5 }]] },
  // ---- 修羅 ----
  asurastrike: { cast: [vm('kiblast', 0.45), ['flash', { where: 'front', dist: 2.5, color: 0xff5252, size: 5, at: 0.12 }], ['burst', { where: 'front', dist: 2.5, color: 0xff5252, n: 30, speed: 10, at: 0.12 }], shake(0.5)] },
  endure: { cast: [vm('raise', 0.6), ['orbit', { tex: 'smoke', color: 0xff5252, n: 10, r: 0.9, h: 2.4, rise: 0.6, size: 1 }]] },
  asurarage: { cast: [vm('barrage', 0.9)], tick: () => [['burst', { where: 'front', dist: 2, color: 0xd50000, n: 20, speed: 9 }], ['slam', { r: 3, color: 0xd50000 }], shake(0.3)] },
  // ---- 鷹匠 ----
  divebomb: { zone: { fall: { shape: 'bird', fall: 0.45, boomR: 2, dx: 0.8, dz: 0.2, height: 14 } } },
  hawkfrenzy: { cast: [vm('raise', 0.5), ['orbit', { glyph: '➶', color: 0xbcaaa4, n: 4, r: 2.2, h: 1.5, spin: 3, size: 0.8, normal: true }]] },
  hawkflock: { cast: [vm('raise', 0.5), ['orbit', { where: 'target', glyph: '➶', color: 0x8d6e63, n: 8, r: 2.5, h: 2.5, dur: 1.5, spin: 6, size: 0.8, normal: true }]] },
  // ---- 吸血鬼 ----
  bite: { cast: [vm('kiblast', 0.4), ['drain', { color: 0xb71c1c, at: 0.1 }], ['flash', { where: 'front', dist: 2, color: 0xb71c1c, size: 4, at: 0.1 }]] },
  batswarm: { cast: [['orbit', { glyph: '⌒', color: 0x4a148c, n: 14, r: 1.2, h: 2.4, dur: 0.7, spin: 9, size: 0.45, normal: true }], ['burst', { color: 0x7b1fa2, n: 30 }]] },
  nightlord: { cast: [vm('cheer', 1), ['whiteout', { css: '#1a0026', max: 0.5 }], ['orbit', { glyph: '☾', color: 0xce93d8, n: 6, r: 1.1, h: 2.4, size: 0.5 }], ['ring', { glyph: '☾', color: 0x7b1fa2, r: 5, n: 8 }]] },
  // ---- ガンブレード ----
  gunslash: { cast: [vm('iai', 0.3), ['flash', { where: 'front', dist: 1.5, color: 0xffe0b2, size: 3, at: 0.1 }]] },
  triggercut: { cast: [vm('drawcut', 0.5), side(true, { r: 4, color: 0xffab40, at: 0.06 }), ['explode', { where: 'front', dist: 2.5, r: 3, color: 0xffab40, at: 0.12 }], shake(0.5)] },
  fullburst: { cast: [0, 0.3, 0.6, 0.9, 1.2].map((t) => ['shake', { amt: 0.2, at: t }]) },
  // ---- 投槍兵 ----
  burstjavelin: { cast: [vm('toss4', 0.38)] },
  javelinrain: { cast: [vm('toss4', 0.38)], zone: { fall: { shape: 'spear', fall: 0.5, boom: false, dx: 0.3, dz: 0.2 } }, land: [['burst', { color: 0xffe0b2, n: 14, speed: 6, y: 0.3 }], ['slam', { r: 2, color: 0xffe0b2 }]] },
  godspear: { cast: [vm('arcane', 0.9, { w: 0.5 }), ['column', { color: 0xffd54f, r: 1, h: 6, dur: 0.5 }], ['whiteout', { css: '#ffd54f', max: 0.35, at: 0.5 }], ['shake', { amt: 0.6, at: 0.5 }]] },
  // ---- メイド ----
  sweepup: { cast: [vm('drawcut', 0.5), side(true, { r: 6, arc: 6.2, color: 0xf8bbd0, at: 0.05 }), ['ring', { glyph: '✦', color: 0xf8bbd0, r: 6, n: 10, dur: 0.9 }]] },
  teatime: { cast: [vm('raise', 0.5), ['ring', { glyph: '♨', color: 0xf8bbd0, r: 8, n: 10 }], ['scatter', { glyph: ['✿', '♥'], css: '#f8bbd0', r: 8, n: 12 }]] },
  springclean: { cast: [vm('cheer', 1), ['ring', { glyph: '✦', color: 0xff80ab, r: 14, n: 16, dur: 1.4 }], ['dome', { color: 0xff80ab, r: 3, dur: 1 }], ['confetti', { n: 60 }]] },
  // ---- ものまね師 ----
  copycat: { cast: [vm('hat', 0.8), ['burst', { color: 0xffcc80, n: 24, at: 0.35 }]] },
  copycat2: { cast: [vm('hat', 0.8), ['burst', { color: 0xffcc80, n: 24, at: 0.35 }]] },
  copyburst: { cast: [vm('cheer', 1), ['confetti', { n: 80 }]], tick: (n) => [['explode', { r: 3, color: [0xff5252, 0x40c4ff, 0x69f0ae, 0xffeb3b][n % 4] }]] },
  // ---- 不死鳥使い ----
  phoenixflame: { cast: [['fire', { range: 6, arc: 1.2 }]] },
  emberheal: { cast: [vm('raise', 0.6), ['orbit', { tex: 'smoke', color: 0xff8a65, n: 14, r: 0.9, h: 2.4, rise: 0.7, size: 0.6 }]] },
  phoenixdive: { cast: [['orbit', { tex: 'smoke', color: 0xff7043, n: 16, r: 1.4, h: 2.5, dur: 0.9, spin: 6, size: 1.1 }]], landing: [['explode', { r: 4.5, big: true, color: 0xff3d00 }], ['ring', { glyph: '✹', color: 0xff7043, r: 5, n: 10, dur: 0.8 }], shake(0.8)] },
  // ---- 天候術士 ----
  thunderstorm: { cast: [vm('cheer', 1)], zone: { loop: [{ type: 'bolt', every: 0.45 }, { type: 'fall', glyph: '❘', color: 0x90caf9, every: 0.025, h: 8, life: 0.3, size: 0.5 }] } },
  sunshine: { cast: [vm('cheer', 1), ['ring', { glyph: '☀', color: 0xffee58, r: 10, n: 12 }], ['column', { color: 0xfff59d, r: 2, h: 10, dur: 0.8 }]] },
  hurricane: { cast: [vm('cheer', 1), ['whiteout', { css: '#42a5f5', max: 0.3 }]], zone: { loop: [{ type: 'swirl', tex: 'smoke', every: 0.03, turn: 6, out: true, lift: 4, size: 1.2, color: 0xb3e5fc, opacity: 0.6 }, { type: 'fall', glyph: '❘', color: 0x90caf9, every: 0.03, h: 8, life: 0.3, size: 0.5 }, { type: 'bolt', every: 1.1 }] } },
  // ---- 暗殺者 ----
  shadowwalk: { cast: [['slash', { where: 'target', roll: -0.85, sweep: 1.6, r: 3, color: 0x424242, at: 0.08 }], ['flash', { where: 'target', color: 0x9e9e9e, size: 4, at: 0.08 }]] },
  vanish: { cast: [['burst', { color: 0x616161, n: 40, speed: 5 }], ['orbit', { tex: 'smoke', color: 0x9e9e9e, n: 12, r: 1, h: 2, rise: 0.6, size: 1.4, normal: true, opacity: 0.7, dur: 1.5 }]] },
  assassinate: { cast: [['whiteout', { css: '#000000', max: 0.6, dur: 0.4 }], ['flash', { where: 'target', color: 0xff1744, size: 7, at: 0.15 }], ['burst', { where: 'target', color: 0xff1744, n: 40, speed: 10, at: 0.15 }], ['shake', { amt: 0.6, at: 0.15 }]] },
  // ---- 機工士 ----
  turret: { cast: [vm('throwdown', 0.45), ['ring', { glyph: '⚙', color: 0xffb74d, r: 3, n: 6, dur: 0.8 }]] },
  repairkit: { cast: [vm('raise', 0.5), ['ring', { glyph: '⚙', color: 0xffb74d, r: 8, n: 10 }]] },
  bigturret: { cast: [vm('throwdown', 0.45), ['ring', { glyph: '⚙', color: 0xff7043, r: 5, n: 10 }], shake(0.4)] },
  // ---- 次元術士 ----
  warp: { cast: [['whiteout', { css: '#b388ff', max: 0.3, dur: 0.25 }], ['ring', { glyph: '✧', color: 0xb388ff, r: 3, n: 8, dur: 0.6 }]] },
  riftbeam: { cast: [['flash', { where: 'front', dist: 1, color: 0x7c4dff, size: 4 }], shake(0.3)] },
  dimensioncut: { cast: [['whiteout', { css: '#651fff', max: 0.3 }], ...[0, 0.25, 0.5, 0.75].map((t) => ['shake', { amt: 0.35, at: t }])] },
  // ---- 陰陽師 ----
  talisman: { cast: [vm('toss4', 0.38)] },
  shikigami: { cast: [vm('toss4', 0.38), ['burst', { where: 'front', dist: 1, color: 0xfffde7, n: 16 }]] },
  gofu: { cast: [vm('raise', 0.6), ['ring', { glyph: '☆', color: 0xfff176, r: 6, n: 5, dur: 1 }]], zone: { fall: { shape: 'light', fall: 0.4, boomR: 3.5, big: true } }, land: [['pillar', { where: 'self', r: 1.8, h: 10, color: 0xfff176 }]] },
  // ---- 狩人 ----
  huntmark: { cast: [['orbit', { where: 'target', glyph: '◎', color: 0xff5252, n: 1, r: 0.01, h: 0, dur: 12, size: 2.6, top: true }], ['flash', { where: 'target', color: 0xff5252, size: 5 }]] },
  netshot: { cast: [['net', { dur: 4, color: 0xa1887f, at: 0.1 }]] },
  volley: { cast: [vm('raise', 0.5)] },
  // ---- 剣闘士 ----
  arenaslash: { cast: [vm('drawcut', 0.55), side(true, { r: 5, arc: 2.8, color: 0xffcc80, at: 0.06, dur: 0.35 }), shake(0.4)] },
  netthrow: { cast: [vm('toss4', 0.38), ['net', { dur: 4, color: 0x8d6e63, at: 0.15 }]] },
  crowdroar: { cast: [['scatter', { glyph: ['★', '!', '♪'], css: '#ffb74d', self: true, n: 16 }], ['confetti', { n: 70 }], vm('xstorm', 0.8, { every: 0.12 })], tick: xTick(0xffb74d, 4.5), noSpin: true },
  // ---- 精霊術士 ----
  elemcycle: { cast: [['burst', { where: 'front', dist: 1, color: 0x80cbc4, n: 20 }]] },
  elemshield: { cast: [vm('raise', 0.5), ['orbit', { glyph: '◆', color: 0x80cbc4, n: 4, r: 1.3, h: 1.6, spin: 2, size: 0.5 }], ['orbit', { glyph: '◆', color: 0xff7043, n: 4, r: 1.5, h: 1.2, spin: -2, size: 0.4 }]] },
  elemstorm: { zone: { fall: { shape: 'light', fall: 0.45, big: true, boomR: 3.5 } } },
  // ---- 人狼 ----
  clawrake: { cast: [vm('kiblast', 0.4), ...[-0.5, 0, 0.5].map((dy) => ['slash', { roll: -0.6, sweep: 1.2, r: 3.4, arc: 1.4, y: 1.25 + dy * 0.6, color: 0xa1887f, dur: 0.25, at: 0.08 }])] },
  pounce: { landing: [...[-0.5, 0, 0.5].map((dy) => ['slash', { roll: -0.6, sweep: 1.2, r: 3, arc: 1.4, y: 1.2 + dy * 0.6, color: 0xa1887f, dur: 0.25 }]), shake(0.4)] },
  fullmoon: { cast: [vm('cheer', 1), ['whiteout', { css: '#0d1b3a', max: 0.55 }], ['scatter', { glyph: '☾', css: '#fff9c4', self: true, n: 8 }], ['orbit', { glyph: '☾', color: 0xfff9c4, n: 1, r: 0.01, h: 2, size: 1.2 }]] },
  // ---- 要塞兵 ----
  cannonshot: { cast: [shake(0.4)] },
  entrench: { cast: [vm('throwdown', 0.45), ['dome', { color: 0x90a4ae, r: 2, dur: 1 }], ['shieldwall', { dur: 1.2, color: 0x90a4ae }]] },
  fortbarrage: { zone: { fall: { shape: 'shell', fall: 0.6, big: true, boomR: 3 } } },
  // ---- 治癒拳士 ----
  chipalm: { cast: [vm('kiblast', 0.45), ['flash', { where: 'front', dist: 2, color: 0xa5d6a7, size: 4, at: 0.12 }]] },
  chiwave: { cast: [vm('kiblast', 0.45), ['ring', { glyph: '✚', color: 0x69f0ae, r: 8, n: 10 }]] },
  chiburst: { cast: [vm('barrage', 1.1)], tick: () => [['burst', { where: 'front', dist: 2, color: 0x69f0ae, n: 16, speed: 8 }], ['ring', { glyph: '✚', color: 0x69f0ae, r: 3, n: 4, dur: 0.5, rise: 1 }]] },
  // ---- 賢者 ----
  wisdombolt: { cast: [['flash', { where: 'front', dist: 1, color: 0xfff59d, size: 3 }]] },
  wisdomfield: { cast: [vm('plant', 0.6, { hit: 0.3 })], zone: { loop: { type: 'rise', glyph: '✦', color: 0xfff59d, every: 0.15, h: 2.5, size: 0.4, life: 1.2 } } },
  enlightenment: { cast: [vm('cheer', 1), ['whiteout', { css: '#fff59d', max: 0.35 }], ['ring', { glyph: '✺', color: 0xfff59d, r: 12, n: 14, dur: 1.4 }], ['column', { color: 0xfff59d, r: 1.6, h: 10, dur: 0.8 }]] },
  // ---- 曲芸師 ----
  cartwheel: { cast: [['burst', { color: 0xffd54f, n: 20 }]] },
  juggleknives: { cast: [vm('cheer', 0.7)] },
  grandfinale: { cast: [vm('cheer', 1.1), ['confetti', { n: 100 }]], tick: (n) => [['explode', { r: 2.5, spread: 3, color: [0xffab00, 0xff4081, 0x40c4ff, 0x69f0ae, 0xe040fb, 0xffeb3b][n % 6] }], ['burst', { color: [0xffab00, 0xff4081, 0x40c4ff][n % 3], n: 30, speed: 10, up: 8, y: 3 }]], noSpin: true },
  // ---- ドリル使い ----
  drillrush: { cast: [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8].flatMap((t) => [['burst', { where: 'front', dist: 3, color: 0xffe082, n: 10, speed: 8, at: t }], ['shake', { amt: 0.18, at: t }]]) },
  drilldive: { cast: [['slam', { r: 2.5, color: 0x8d6e63 }], ['burst', { color: 0x8d6e63, n: 30, speed: 6 }]] },
  gigadrill: { cast: [['whiteout', { css: '#e0e0e0', max: 0.25 }], ...[0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7].flatMap((t) => [['burst', { where: 'front', dist: 4, color: 0xffe082, n: 16, speed: 10, at: t }], ['shake', { amt: 0.25, at: t }]])] },
  // ---- 吸収術士 ----
  devour: { cast: [vm('kiblast', 0.6), ['suck', { r: 5, dur: 0.8 }]] },
  releasebolt: { cast: [vm('kiblast', 0.45), ['flash', { where: 'front', dist: 1.5, color: 0x4db6ac, size: 5 }], shake(0.35)] },
  blackmaw: { cast: [vm('cheer', 1.2), ['suck', { r: 12, dur: 1.4, every: 0.015, size: 0.8 }], ['whiteout', { css: '#004d40', max: 0.4 }]] },
  // ---- 反射術士 ----
  reflectwall: { cast: [vm('kiblast', 0.5), ['dome', { color: 0xb3e5fc, r: 5, dur: 0.6 }], ['ring', { glyph: '◇', color: 0xb3e5fc, r: 5, n: 8, dur: 0.7 }]] },
  prismguard: { cast: [vm('raise', 0.5), ['orbit', { glyph: '◆', color: 0x81d4fa, n: 6, r: 1.2, h: 2, size: 0.45 }]] },
  grandmirror: { cast: [vm('cheer', 1), ['whiteout', { css: '#e1f5fe', max: 0.5 }], ['dome', { color: 0x4fc3f7, r: 14, dur: 0.9 }], ['ring', { glyph: '◇', color: 0x4fc3f7, r: 14, n: 16, dur: 1.2 }], shake(0.6)] },
  // ---- 太鼓叩き ----
  warbeat: { cast: [vm('bigchop', 0.4), ['song', { r: 10, mood: 'hype', at: 0.12 }], ['shake', { amt: 0.4, at: 0.12 }]] },
  thunderdrum: { tick: () => [vm('bigchop', 0.3), ['slam', { r: 4, color: 0xfff176, at: 0.1 }], ['ring', { glyph: '♪', color: 0xfff176, r: 4, n: 8, dur: 0.5, rise: 1, at: 0.1 }], ['shake', { amt: 0.5, at: 0.1 }]], noSpin: true },
  festival: { cast: [vm('cheer', 1.1), ['song', { r: 14, mood: 'hype' }], ['confetti', { n: 120 }], ['scatter', { glyph: ['♪', '♫', '★'], css: '#ffd600', n: 16 }]] },
  // ---- 溜め斬り士 ----
  iaidash: { cast: [vm('drawcut', 0.5), side(true, { r: 4, color: 0xffab40, at: 0.15 })] },
  waitstance: { cast: [vm('sheathe', 1.2)] },
  meteorcut: { cast: [vm('arcane', 0.75, { w: 0.35 }), vert({ r: 9, arc: 1.2, color: 0xff6d00, at: 0.37, dur: 0.45 }), ['pillar', { where: 'front', dist: 5, color: 0xff6d00, at: 0.4 }], ['whiteout', { css: '#ff6d00', max: 0.3, at: 0.37 }], ['shake', { amt: 0.8, at: 0.37 }]] },
  // ---- 棘の騎士 ----
  briarbash: { cast: [['orbit', { glyph: '✣', color: 0x8bc34a, n: 10, r: 2.5, h: 1.5, dur: 0.6, spin: 6, size: 0.5 }]], tick: (n) => [side(n % 2 === 0, { r: 3.5, arc: 6.2, color: 0x8bc34a, dur: 0.25 })], noSpin: true },
  thornarmor: { cast: [vm('raise', 0.5), ['orbit', { glyph: '✣', color: 0x689f38, n: 12, r: 1.1, h: 2.2, spin: 2, size: 0.4 }], ['ring', { glyph: '✣', color: 0x689f38, r: 4, n: 10 }]] },
  briarstorm: { cast: [vm('xstorm', 1.1, { every: 0.12 }), ['orbit', { glyph: '✣', color: 0x558b2f, n: 16, r: 3, h: 2, dur: 1.2, spin: 7, size: 0.5 }]], tick: xTick(0x558b2f, 4.5), noSpin: true },
  // ---- 分裂射手 ----
  clusterbolt: { cast: [['flash', { where: 'front', dist: 1, color: 0xff4081, size: 3 }]] },
  fanburst: { cast: [['flash', { where: 'front', dist: 1, color: 0xff80ab, size: 3 }]] },
  fractal: { cast: [['scatter', { glyph: '❖', css: '#f50057', self: true, n: 10 }]] },
  // ---- ブーメラン使い ----
  tripleboom: { cast: [vm('toss4', 0.38)] },
  boomroll: { cast: [['burst', { color: 0xffcc80, n: 16 }]] },
  boomstorm: { cast: [vm('cheer', 1), ['ring', { glyph: '⟲', color: 0xff9800, r: 6, n: 12 }]] },
  // ---- 鎧砕き ----
  armorbreak: { cast: [vm('bigchop', 0.55), ['slam', { where: 'front', dist: 2.5, r: 3, color: 0x90a4ae, at: 0.2 }], ['burst', { where: 'front', dist: 2.5, color: 0xeceff1, n: 30, speed: 10, at: 0.2 }], ['shake', { amt: 0.7, at: 0.2 }]] },
  quakeleap: { cast: [vm('bigchop', 0.7)], landing: [['slam', { r: 4.5, color: 0x78909c }], ['burst', { color: 0x78909c, n: 40, speed: 9, up: 6 }], shake(0.8)] },
  crusher: { tick: smashTick(0x607d8b, 3.5), noSpin: true },
  // ---- エクソシスト ----
  holybind: { cast: [vm('raise', 0.6), ['pillar', { color: 0xfff9c4 }], ['orbit', { where: 'target', glyph: '✝', color: 0xfff59d, n: 8, r: 2, h: 3, dur: 6, size: 0.6 }]] },
  purgelight: { cast: [vm('cheer', 0.9), ['dome', { color: 0xfff59d, r: 6, dur: 0.6 }], ['ring', { glyph: '✝', color: 0xfff59d, r: 6, n: 8, dur: 0.8 }]] },
  exorcism: { cast: [['whiteout', { css: '#ffffff', max: 0.4 }], ['column', { color: 0xffffff, r: 1.4, h: 8, dur: 2 }], ...[0, 0.5, 1, 1.5].map((t) => ['shake', { amt: 0.3, at: t }])] },
  // ---- 吸着爆弾魔 ----
  stickybomb: { cast: [vm('toss4', 0.38)] },
  stickytrio: { cast: [vm('toss4', 1.0)] },
  stickyparty: { cast: [vm('toss4', 1.2), ['confetti', { n: 40 }]] },
  // ---- 鐘撞き ----
  slowbell: { cast: [vm('bigchop', 0.45), ['song', { r: 10, mood: 'lonely', at: 0.15 }], ['scatter', { glyph: ['♪', 'z'], css: '#ffe082', self: true, n: 10 }]] },
  bellslam: { tick: () => [vm('bigchop', 0.32), ['slam', { r: 3.5, color: 0xffd54f, at: 0.1 }], ['ring', { glyph: '♫', color: 0xffd54f, r: 3.5, n: 6, dur: 0.5, rise: 1, at: 0.1 }], ['shake', { amt: 0.45, at: 0.1 }]], noSpin: true },
  grandbell: { cast: [vm('bigchop', 0.5), ['song', { r: 14, mood: 'lonely', at: 0.15 }], ['whiteout', { css: '#ffca28', max: 0.35, at: 0.15 }], ['slam', { r: 8, color: 0xffca28, at: 0.15 }], ['shake', { amt: 0.8, at: 0.15 }]] },
  // ---- 庭師 ----
  flowerbed: { cast: [['lob', { glyph: '✿', color: 0xf48fb1, to: 'aim', time: 0.4, normal: true }]], zone: { loop: [{ type: 'rise', tex: 'petal', color: 0xf48fb1, every: 0.04, h: 2.2, size: 0.5, life: 1.1, spin: 4 }, { type: 'rise', glyph: '✿', color: 0xec407a, every: 0.3, h: 0.5, size: 0.5, life: 1.2 }] } },
  vinewhip: { cast: [vm('chainswing', 0.5), diag(false, { r: 4.5, color: 0x66bb6a, at: 0.12 })] },
  blossom: { cast: [vm('cheer', 1), ['confetti', { n: 60 }]], zone: { loop: [{ type: 'rise', tex: 'petal', color: 0xec407a, every: 0.04, h: 3, size: 0.45, life: 1.3, spin: 4 }, { type: 'rise', glyph: '✿', color: 0xf8bbd0, every: 0.15, h: 0.6, size: 0.6, life: 1.4 }] } },
  // ---- 残響術士（1秒後にもう一度） ----
  echobolt: { cast: [['flash', { where: 'front', dist: 1, color: 0xb388ff, size: 3 }], ['flash', { where: 'front', dist: 1, color: 0xb388ff, size: 3, at: 1 }]] },
  echopulse: { tick: () => [['song', { r: 5, mood: 'hype' }], ['slam', { r: 4.5, color: 0x7c4dff }]], noSpin: true },
  resonance: { cast: [['song', { r: 6, mood: 'hype' }], ['song', { r: 6, mood: 'hype', at: 1 }], shake(0.3), ['shake', { amt: 0.3, at: 1 }]] },
  // ---- 先駆け ----
  spearcharge: { cast: [['flash', { where: 'front', dist: 8, color: 0xef5350, size: 5, at: 0.15 }], shake(0.3)] },
  sweepspear: { cast: [vm('drawcut', 0.5), side(true, { r: 5, arc: 2.8, color: 0xe57373, at: 0.06 })] },
  tokinokoe: { cast: [vm('cheer', 1), ['ring', { glyph: '⚑', color: 0xd50000, r: 12, n: 12, dur: 1.4 }], ['scatter', { glyph: ['!', '⚑'], css: '#ff5252', n: 14 }], shake(0.6)] },
  // ---- 指揮者 ----
  tempoup: { cast: [vm('cheer', 0.9), ['song', { r: 10, mood: 'hype' }], ['ring', { glyph: '♪', color: 0xce93d8, r: 10, n: 12 }]] },
  crescendo: { cast: [vm('cheer', 0.9), ['song', { r: 10, mood: 'hype' }], ['ring', { glyph: '♫', color: 0xba68c8, r: 10, n: 12, rise: 1.2 }]] },
  dacapo: { cast: [vm('raise', 0.6), ['rewind'], ['ring', { glyph: '↺', color: 0xab47bc, r: 8, n: 10 }], ['whiteout', { css: '#ab47bc', max: 0.3 }]] },
  // ---- 献身者 ----
  bloodward: { cast: [vm('raise', 0.6), ['ring', { glyph: '♥', color: 0xe57373, r: 8, n: 10 }], ['dome', { color: 0xe57373, r: 2.5, dur: 0.9 }]] },
  offering: { cast: [vm('raise', 0.6), ['ring', { glyph: '♥', color: 0xef5350, r: 10, n: 12, rise: 1.2 }], ['column', { color: 0xef5350, r: 1, h: 6, dur: 0.6 }]] },
  lastrites: { cast: [vm('cheer', 1.2), ['whiteout', { css: '#ffffff', max: 0.7, dur: 0.6 }], ['column', { color: 0xfff8e1, r: 2.5, h: 14, dur: 1.2 }], ['ring', { glyph: '✝', color: 0xfff59d, r: 10, n: 12, dur: 1.5 }], ['scatter', { glyph: '✚', css: '#fff59d', n: 14 }]] },
};

/** バフ中の画面の縁の色（"r,g,b"）。キーはバフの名前 */
export const BUFF_FRAMES = {
  veil: '106,27,154', afterimage: '255,255,141', pact: '183,28,28', spicy: '255,112,67', feast: '255,204,128', sake: '255,171,145',
  camo: '104,159,56', foresight: '255,249,196', oniroar: '239,83,80', phase: '236,239,241', reload: '189,189,189', stim: '239,154,154',
  shieldwall: '144,202,249', endure: '255,82,82', hawkfrenzy: '188,170,164', nightlord: '123,31,162', ember: '255,138,101', sunshine: '255,238,88',
  vanish: '97,97,97', elemshield: '128,203,196', moon: '121,85,72', entrench: '144,164,174', enlight: '255,245,157', prism: '129,212,250',
  warbeat: '255,235,59', festival: '255,214,0', thornarmor: '104,159,56', warcry: '213,0,0', tempo: '206,147,216',
  unseen: '176,190,197', wartotem: '255,112,67', healtotem: '105,240,174', spirittotem: '255,213,79',
};

/** 3段目を真上からの縦斬りにする近接職（鎖鎌使いより後） */
export const LAST_VERTICAL = ['darkknight', 'cursed', 'desperado', 'oni', 'hammer', 'gunblade', 'gladiator', 'charger', 'thornknight', 'shredder', 'drummer', 'bellringer'];
/** 撃つと銃口が光る職業（銃口の位置は武器の形から自動で求める） */
export const GUN_JOBS = ['gambler', 'sniper', 'twins', 'machinegunner', 'flamer', 'rocketeer', 'medic', 'fortress', 'splitter'];
