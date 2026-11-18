// ステージ12「冥界」のボス11体（各部屋2体、最後の部屋3体）。技は data/bosskit.js の部品から組み立てる
// 全員 HUGE（体3倍・範囲2.4倍・弾2倍）。部屋も縦横2倍
import * as K from './bosskit.js';

const SOUL = 0x76ff03;
const HELL = 0xff3d00;
const VOID = 0x6200ea;
const BONE = 0xeeeeee;
const BLOOD = 0xd50000;

// 第1の間：冥府の門
const cerberus = K.boss('冥府の番犬ケルベロス', 0x3e2723, { monster: 'beast', heads: 3, scale: 2.1, horn: 0x212121, eye: HELL, belly: 0x5d4037, mane: 0xbf360c }, { hp: 17000, def: 13, speed: 6.6, radius: 2.2, hpY: 6 }, {
  bites: K.bites('三つ首の牙', HELL),
  breath: K.breath('獄炎の息', HELL),
  dash: K.dashes('猛追', HELL, { n: 3 }),
  pools: K.pools('獄炎の溜まり', HELL, { kind: 'lava' }),
  leap: K.leap('飛びかかり', HELL),
  ult: K.ultBeat('地獄の咆哮', HELL),
}, ['bites', 'breath', 'leap'], ['dash', 'pools', 'breath']);

const necro = K.boss('死霊術師ネクロ', 0x4a148c, { scale: 2.0, horn: BONE, eye: SOUL, weapon: 'staff', metal: 0x311b92 }, { hp: 14400, speed: 5.2, radius: 1.4, hpY: 5.6, keep: 11 }, {
  orbs: K.orbs('亡魂の輪', SOUL, { n: 7 }),
  pools: K.pools('死の沼', SOUL, { kind: 'void' }),
  spiral: K.spiral('怨霊の渦', SOUL),
  blink: K.blink('霊体化', SOUL),
  siege: K.siege('骨の檻', BONE, { n: 5 }),
  ult: K.ultSafe('死者の行進', SOUL),
}, ['orbs', 'blink', 'pools'], ['spiral', 'siege', 'pools']);

// 第2の間：死神と首無し騎士
const thanatos = K.boss('死神タナトス', 0x212121, { scale: 2.3, horn: BONE, eye: SOUL, weapon: 'scythe', metal: 0x424242 }, { hp: 16200, speed: 6.2, radius: 1.7, hpY: 6.4 }, {
  reap: K.sweep('大鎌の薙ぎ', SOUL),
  combo: K.combo('死神の三閃', SOUL),
  blink: K.blink('影渡り', SOUL),
  siege: K.siege('魂狩り', SOUL, { n: 6 }),
  vortex: K.vortex('魂吸い', VOID, { spin: 3 }),
  ult: K.ultStill('死の宣告', SOUL),
}, ['reap', 'combo', 'vortex'], ['blink', 'siege', 'reap']);

const dullahan = K.boss('首無し騎士デュラハン', 0x263238, { scale: 2.3, horn: 0x455a64, eye: 0x00e5ff, weapon: 'spear', metal: 0x37474f }, { hp: 16800, def: 14, speed: 6.4, radius: 1.8, hpY: 6.2 }, {
  dash: K.dashes('冥馬の突撃', 0x00e5ff, { n: 3 }),
  combo: K.combo('亡霊槍', 0x00e5ff, { pose: 'lunge' }),
  cross: K.cross('呪いの十字', 0x00e5ff, { tgt: true }),
  quake: K.quake('蹄の地響き', 0x00e5ff),
  fan: K.fan('冥火の矢', 0x00e5ff, { n: 5, volleys: 3 }),
  ult: K.ultSiege('死の騎行', 0x00e5ff),
}, ['combo', 'quake', 'cross'], ['dash', 'fan', 'cross']);

// 第3の間：骸骨竜と冥界の眼
const bonedragon = K.boss('骸骨竜ボーンドラゴン', 0xe0e0e0, { monster: 'dragon', scale: 2.1, horn: 0x9e9e9e, eye: SOUL, belly: 0xbdbdbd, wingColor: 0x616161 }, { hp: 17400, def: 13, speed: 5.0, radius: 2.2, hpY: 7 }, {
  bites: K.bites('骨の顎', SOUL),
  breath: K.breath('瘴気の息', SOUL),
  dive: K.dive('骨翼の急降下', SOUL),
  meteor: K.meteor('骨の雨', BONE, { fx: 'pillar' }),
  pools: K.pools('瘴気の溜まり', SOUL, { kind: 'void' }),
  ult: K.ultCover('冥府の瘴気', SOUL),
}, ['bites', 'breath', 'pools'], ['breath', 'meteor', 'dive']);

const gehenna = K.boss('冥界の眼ゲヘナ', 0x880e4f, { monster: 'eye', scale: 2.1, horn: 0x4a148c, eye: BLOOD, belly: 0xfce4ec }, { hp: 15000, speed: 3.6, radius: 2.1, hpY: 6.6, keep: 11 }, {
  stare: K.stare('呪眼（目を逸らせ）', BLOOD),
  beams: K.beams('血の眼光', BLOOD, { arms: 3, pose: 'float' }),
  orbs: K.orbs('血の衛星', BLOOD, { n: 6, inward: true }),
  cluster: K.cluster('弾ける血玉', BLOOD),
  vortex: K.vortex('奈落', VOID, { spin: 4 }),
  ult: K.ultStare('万象呪視', BLOOD),
}, ['stare', 'orbs', 'vortex'], ['beams', 'cluster', 'orbs']);

// 第4の間：魂喰いと魔女
const souleater = K.boss('魂喰いソウルイーター', 0x1a237e, { monster: 'kraken', scale: 1.9, horn: 0x7c4dff, eye: SOUL, belly: 0x5e35b1 }, { hp: 17200, def: 13, speed: 4.2, radius: 2.4, hpY: 6.8 }, {
  sweep: K.sweep('触手の大振り', VOID, { pose: 'flail' }),
  burrow: K.burrow('闇に潜る', VOID),
  vortex: K.vortex('魂の大渦', VOID, { spin: 5 }),
  pools: K.pools('闇の沼', VOID, { kind: 'void' }),
  siege: K.siege('包み込む触手', VOID, { n: 5 }),
  ult: K.ultSafe('魂喰らい', VOID),
}, ['sweep', 'vortex', 'pools'], ['burrow', 'siege', 'pools']);

const hecate = K.boss('冥界の魔女ヘカテ', 0x311b92, { scale: 2.0, horn: 0x212121, eye: 0xea80fc, weapon: 'staff', metal: 0x4a148c }, { hp: 14600, speed: 5.4, radius: 1.4, hpY: 5.6, keep: 11 }, {
  cluster: K.cluster('呪いの種', 0xea80fc, { n: 5 }),
  orbs: K.orbs('鬼火の輪', 0xea80fc, { n: 7 }),
  grid: K.grid('呪縛の線', 0xea80fc),
  blink: K.blink('三相転移', 0xea80fc),
  meteor: K.meteor('冥火の雨', 0xea80fc),
  ult: K.ultOrbs('三相の月', 0xea80fc),
}, ['orbs', 'blink', 'cluster'], ['grid', 'meteor', 'cluster']);

// 第5の間（3体同時）：冥王の玉座
const hades = K.boss('冥王ハデス', 0x1b0000, { scale: 2.6, horn: 0xffd740, eye: HELL, weapon: 'mace', metal: 0x3e0000 }, { hp: 18600, def: 15, speed: 5.0, radius: 2.0, hpY: 7.2 }, {
  smash: K.combo('冥王の鉄槌', HELL, { pose: 'over' }),
  quake: K.quake('冥府の地鳴り', HELL),
  cross: K.cross('獄門の十字', HELL),
  pillars: K.pillars('獄炎柱', HELL),
  wall: K.wall('冥河の波', HELL, { n: 2 }),
  ult: K.ultWalls('冥河の氾濫', HELL),
}, ['smash', 'quake', 'cross'], ['pillars', 'wall', 'cross']);

const persephone = K.boss('冥妃ペルセポネ', 0x4a148c, { scale: 2.1, horn: 0x69f0ae, eye: 0xff4081, weapon: 'staff', metal: 0x880e4f }, { hp: 15200, speed: 5.4, radius: 1.5, hpY: 5.8, keep: 11 }, {
  orbs: K.orbs('柘榴の輪', 0xff4081, { n: 7 }),
  pools: K.pools('毒花の園', 0x69f0ae, { kind: 'whirl' }),
  spiral: K.spiral('花吹雪', 0xff4081, { arms: 4 }),
  stare: K.stare('冥妃の眼差し', 0xff4081),
  siege: K.siege('茨の檻', 0x69f0ae, { n: 6 }),
  ult: K.ultStare('冥妃の誘惑', 0xff4081),
}, ['orbs', 'stare', 'pools'], ['spiral', 'siege', 'orbs']);

const nidhogg = K.boss('冥界竜ニーズヘッグ', 0x1b5e20, { monster: 'serpent', scale: 2.3, horn: 0x212121, eye: SOUL, belly: 0x33691e, fin: 0x004d40 }, { hp: 18000, def: 14, speed: 4.8, radius: 2.4, hpY: 7.4 }, {
  bites: K.bites('根を齧る顎', SOUL),
  burrow: K.burrow('冥界樹の根', SOUL),
  breath: K.breath('毒の息', SOUL),
  quake: K.quake('とぐろ締め', SOUL, { pose: 'coil' }),
  rings: K.rings('毒鱗', SOUL),
  ult: K.ultCross('世界樹崩し', SOUL),
}, ['bites', 'quake', 'breath'], ['burrow', 'breath', 'rings']);

const H = K.huge;
/** ステージ12のボス（data/enemies.js の BOSSES に足す） */
export const S12_BOSSES = {
  hellhound: H(cerberus), necro: H(necro), thanatos: H(thanatos), dullahan: H(dullahan), bonedragon: H(bonedragon), gehenna: H(gehenna),
  souleater: H(souleater), hecate: H(hecate), hades: H(hades), persephone: H(persephone), nidhogg: H(nidhogg),
};
