// ステージ10「天空の城」のボス11体（各部屋2体、最後の部屋3体）。技は data/bosskit.js の部品から組み立てる
// 全員 HUGE（体3倍・範囲2.4倍・弾2倍）。部屋も縦横2倍
import * as K from './bosskit.js';

const SKY = 0x81d4fa;
const GOLD = 0xffd54f;
const WHITE = 0xfafafa;
const BOLT = 0xffee58;
const WIND = 0xb2ff59;

// 第1の間：嵐の双翼
const gale = K.boss('嵐の鷲獅子ゲイル', 0x8d6e63, { monster: 'beast', wings: true, scale: 1.9, horn: 0xfff8e1, eye: 0xffeb3b, belly: 0xffecb3, wingColor: 0xa1887f, mane: 0xffffff }, { hp: 15200, speed: 6.4, radius: 2, hpY: 5.5 }, {
  claws: K.combo('鉤爪の三連', WIND, { pose: 'swing' }),
  dive: K.dive('急降下', WIND),
  dash: K.dashes('疾風の突進', WIND, { n: 3, w: 3.6 }),
  gust: K.wall('突風の壁', WIND),
  feathers: K.fan('羽根の雨', WHITE, { n: 7, volleys: 3 }),
  ult: K.ultWalls('天空の大嵐', WIND),
}, ['claws', 'dash', 'gust'], ['dive', 'feathers', 'dash']);

const vortex = K.boss('雷鳥ボルテクス', 0x1565c0, { monster: 'dragon', scale: 1.7, horn: 0xfff59d, eye: 0xffff00, belly: 0x90caf9, wingColor: 0x0d47a1 }, { hp: 14600, speed: 5.4, radius: 1.9, hpY: 6, keep: 9 }, {
  bolt: K.meteor('落雷', BOLT, { fx: 'pillar' }),
  orbs: K.orbs('雷球の輪', BOLT, { n: 6 }),
  beam: K.breath('雷のブレス', BOLT),
  cluster: K.cluster('弾ける雷玉', BOLT),
  grid: K.grid('雷の格子', BOLT),
  ult: K.ultBeat('万雷', BOLT),
}, ['orbs', 'beam', 'cluster'], ['bolt', 'grid', 'cluster']);

// 第2の間：天空騎士団
const seraph = K.boss('聖騎士セラフ', 0xeceff1, { scale: 2.2, horn: GOLD, eye: 0x40c4ff, weapon: 'sword', metal: 0xcfd8dc }, { hp: 15800, speed: 6.2, radius: 1.6, hpY: 6 }, {
  combo: K.combo('聖剣三連', GOLD),
  cross: K.cross('光の十字', GOLD, { tgt: true }),
  dash: K.dashes('天翔突き', GOLD, { n: 2 }),
  spin: K.spin('聖光の旋風', GOLD),
  siege: K.siege('光の檻', GOLD, { n: 6 }),
  ult: K.ultCross('裁きの十字', GOLD),
}, ['combo', 'spin', 'cross'], ['dash', 'siege', 'cross']);

const azure = K.boss('聖弓兵アズール', 0x42a5f5, { scale: 2.0, horn: WHITE, eye: 0x18ffff, weapon: 'bow', metal: 0x1e88e5 }, { hp: 14200, speed: 5.6, radius: 1.4, hpY: 5.5, keep: 11 }, {
  arrows: K.fan('天の矢', SKY, { n: 5, volleys: 4, speed: 20, pose: 'over' }),
  rain: K.meteor('矢の雨', SKY, { fx: 'pillar', n: 9 }),
  blink: K.blink('雲隠れ', SKY),
  cluster: K.cluster('炸裂矢', SKY, { n: 4 }),
  siege: K.siege('包囲射撃', SKY, { n: 4 }),
  ult: K.ultSiege('天弓・千本桜', SKY),
}, ['blink', 'cluster', 'arrows'], ['arrows', 'rain', 'siege']);

// 第3の間：雲の巨人と風の精
const nimbus = K.boss('雲の巨人ニンバス', 0xeeeeee, { monster: 'golem', scale: 2.2, horn: 0xb0bec5, eye: 0x40c4ff, glow: 0x81d4fa }, { hp: 17200, def: 14, speed: 4.2, radius: 2.4, hpY: 7.5 }, {
  quake: K.quake('雲の踏みしめ', SKY),
  sweep: K.sweep('巨腕の薙ぎ', WHITE),
  leap: K.leap('雲海落とし', SKY),
  pools: K.pools('雷雲の溜まり', BOLT, { kind: 'whirl' }),
  rings: K.rings('雹の輪', WHITE),
  ult: K.ultCover('天の鉄槌', SKY),
}, ['quake', 'sweep', 'leap'], ['leap', 'pools', 'rings']);

const sylph = K.boss('風の精シルフ', 0x69f0ae, { scale: 1.9, horn: 0xccff90, eye: 0x00e676, weapon: 'staff', metal: 0x2e7d32 }, { hp: 13800, speed: 6.0, radius: 1.3, hpY: 5.2, keep: 10 }, {
  vortex: K.vortex('つむじ風', WIND, { spin: 6 }),
  orbs: K.orbs('風の輪舞', WIND, { n: 6, inward: true }),
  spiral: K.spiral('旋風の弾', WIND),
  blink: K.blink('風渡り', WIND),
  wall: K.wall('風の壁', WIND, { n: 2 }),
  ult: K.ultOrbs('大旋風', WIND),
}, ['vortex', 'orbs', 'blink'], ['spiral', 'wall', 'orbs']);

// 第4の間：天馬と雷神
const pegasus = K.boss('天馬ペガサス', 0xffffff, { monster: 'beast', wings: true, scale: 2.0, horn: GOLD, eye: 0x40c4ff, belly: 0xf5f5f5, wingColor: 0xe3f2fd, mane: GOLD }, { hp: 15600, speed: 7.0, radius: 2, hpY: 5.6 }, {
  dash: K.dashes('天駆ける突進', SKY, { n: 3 }),
  dive: K.dive('流星蹄', GOLD),
  stomp: K.quake('天馬の踏み鳴らし', GOLD),
  orbs: K.orbs('星屑の輪', GOLD, { n: 5 }),
  fan: K.fan('光の羽根', GOLD, { n: 6, volleys: 2 }),
  ult: K.ultBeat('天翔ける光', GOLD),
}, ['dash', 'stomp', 'orbs'], ['dive', 'dash', 'fan']);

const thor = K.boss('雷神トール', 0x37474f, { scale: 2.4, horn: 0xffca28, eye: 0xffff00, weapon: 'mace', metal: 0x263238 }, { hp: 16800, def: 13, speed: 5.0, radius: 1.9, hpY: 7 }, {
  smash: K.combo('雷槌の連打', BOLT, { pose: 'over' }),
  cross: K.cross('雷の十字', BOLT),
  quake: K.quake('雷鳴の地響き', BOLT),
  bolt: K.meteor('神鳴り', BOLT, { fx: 'pillar' }),
  pillars: K.pillars('雷柱の陣', BOLT),
  ult: K.ultStill('雷神の審判', BOLT),
}, ['smash', 'quake', 'cross'], ['bolt', 'pillars', 'cross']);

// 第5の間（3体同時）：天の玉座
const michael = K.boss('熾天使ミカエル', 0xfff8e1, { scale: 2.3, horn: GOLD, eye: 0xff6d00, weapon: 'sword', metal: 0xffb300 }, { hp: 15200, def: 13, speed: 6.2, radius: 1.7, hpY: 6.2 }, {
  combo: K.combo('炎の剣三連', 0xff6d00),
  spin: K.spin('焔の旋回', 0xff6d00),
  cross: K.cross('天の十字', GOLD, { tgt: true }),
  dash: K.dashes('熾天突', GOLD),
  siege: K.siege('天使の包囲', GOLD, { n: 6 }),
  ult: K.ultCross('最後の審判', GOLD),
}, ['combo', 'spin', 'cross'], ['dash', 'siege', 'cross']);

const gabriel = K.boss('告知天使ガブリエル', 0xe1f5fe, { scale: 2.1, horn: WHITE, eye: 0x40c4ff, weapon: 'staff', metal: 0x81d4fa }, { hp: 14400, speed: 5.4, radius: 1.5, hpY: 5.8, keep: 11 }, {
  orbs: K.orbs('祝福の光輪', SKY, { n: 7 }),
  beams: K.beams('天の光条', SKY, { arms: 4 }),
  rings: K.rings('聖歌', WHITE),
  stare: K.stare('天啓（目を逸らせ）', SKY),
  cluster: K.cluster('光の種', SKY),
  ult: K.ultSafe('天の門', SKY),
}, ['orbs', 'stare', 'rings'], ['beams', 'cluster', 'orbs']);

const bahamut = K.boss('天空竜バハムート', 0x5c6bc0, { monster: 'dragon', scale: 2.2, horn: GOLD, eye: 0xff1744, belly: 0xc5cae9, wingColor: 0x283593 }, { hp: 16800, def: 14, speed: 5.2, radius: 2.2, hpY: 7 }, {
  bite: K.bites('天竜の顎', 0x7c4dff),
  breath: K.breath('メガフレア', 0x7c4dff),
  dive: K.dive('天竜急降下', 0x7c4dff),
  meteor: K.meteor('流星召喚', 0x7c4dff),
  vortex: K.vortex('天の渦', 0x7c4dff, { spin: 3 }),
  ult: K.ultCover('ギガフレア', 0x7c4dff),
}, ['bite', 'vortex', 'breath'], ['breath', 'meteor', 'dive']);

const H = K.huge;
/** ステージ10のボス（data/enemies.js の BOSSES に足す） */
export const S10_BOSSES = {
  gale: H(gale), vortex: H(vortex), seraph: H(seraph), azure: H(azure), nimbus: H(nimbus), sylph: H(sylph),
  pegasus: H(pegasus), thor: H(thor), michael: H(michael), gabriel: H(gabriel), bahamut: H(bahamut),
};
