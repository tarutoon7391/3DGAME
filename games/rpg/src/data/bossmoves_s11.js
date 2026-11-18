// ステージ11「機械要塞」のボス11体（各部屋2体、最後の部屋3体）。技は data/bosskit.js の部品から組み立てる
// 全員 HUGE（体4倍・範囲3倍・弾2倍）。部屋も縦横2倍
import * as K from './bosskit.js';

const CYAN = 0x18ffff;
const RED = 0xff1744;
const AMBER = 0xffab00;
const STEEL = 0x90a4ae;
const PLASMA = 0xd500f9;

// 第1の間：迎撃システム
const turret = K.boss('自律砲台タレットα', 0x546e7a, { monster: 'saucer', scale: 1.9, horn: STEEL, eye: RED, glow: RED, metal: 0x37474f, dome: 0xff8a80 }, { hp: 15800, def: 14, speed: 3.6, radius: 2.2, hpY: 6, keep: 12 }, {
  fan: K.fan('機銃掃射', AMBER, { n: 7, volleys: 4, speed: 18 }),
  spiral: K.spiral('全方位砲', AMBER, { arms: 4 }),
  grid: K.grid('レーザー格子', RED),
  beams: K.beams('回転レーザー', RED, { arms: 3 }),
  cluster: K.cluster('榴弾', AMBER),
  ult: K.ultSiege('一斉射撃', RED),
}, ['spiral', 'beams', 'cluster'], ['fan', 'grid', 'cluster']);

const hornet = K.boss('戦闘ドローン・ホーネット', 0xfdd835, { monster: 'saucer', scale: 1.4, horn: 0x212121, eye: AMBER, glow: AMBER, metal: 0x424242, dome: 0xfff59d }, { hp: 13600, speed: 7.2, radius: 1.7, hpY: 5, keep: 9 }, {
  dash: K.dashes('急襲', AMBER, { n: 3, speed: 32, pose: 'spinH' }),
  orbs: K.orbs('子機の輪', AMBER, { n: 6 }),
  blink: K.blink('高速移動', AMBER),
  fan: K.fan('ニードル', AMBER, { n: 5, volleys: 3, speed: 20 }),
  siege: K.siege('包囲網', AMBER, { n: 4 }),
  ult: K.ultOrbs('蜂の巣', AMBER),
}, ['dash', 'orbs', 'blink'], ['fan', 'siege', 'dash']);

// 第2の間：鉄の番犬と工兵
const cerbmk = K.boss('鉄の番犬ケルベロスMk2', 0x455a64, { monster: 'beast', heads: 3, scale: 2.0, horn: STEEL, eye: RED, belly: 0x78909c, mane: 0x263238 }, { hp: 16200, def: 13, speed: 6.6, radius: 2.1, hpY: 5.8 }, {
  bites: K.bites('鋼の三つ顎', RED),
  dash: K.dashes('ブースト突進', RED, { n: 2 }),
  breath: K.breath('火炎放射', AMBER),
  leap: K.leap('飛びかかり', RED),
  rings: K.rings('放電', CYAN),
  ult: K.ultBeat('オーバーヒート', RED),
}, ['bites', 'leap', 'breath'], ['dash', 'breath', 'rings']);

const rivet = K.boss('工兵ロボ・リベット', 0xff8f00, { monster: 'golem', scale: 1.9, horn: 0x212121, eye: CYAN, glow: CYAN }, { hp: 15000, def: 15, speed: 4.4, radius: 2.2, hpY: 7 }, {
  quake: K.quake('杭打ち', AMBER),
  pillars: K.pillars('杭の陣', AMBER),
  pools: K.pools('オイル溜まり', 0x6d4c41, { kind: 'void' }),
  sweep: K.sweep('アームの薙ぎ', AMBER),
  meteor: K.meteor('資材投下', STEEL),
  ult: K.ultCover('解体作業', AMBER),
}, ['quake', 'sweep', 'pools'], ['pillars', 'meteor', 'pools']);

// 第3の間：掘削機と監視眼
const driller = K.boss('掘削機ドリラー', 0x6d4c41, { monster: 'serpent', scale: 2.2, horn: STEEL, eye: AMBER, belly: 0x8d6e63, fin: STEEL }, { hp: 16600, def: 13, speed: 5.0, radius: 2.3, hpY: 7 }, {
  burrow: K.burrow('地中掘進', AMBER),
  bites: K.bites('ドリル突き', AMBER),
  quake: K.quake('掘削振動', AMBER, { pose: 'coil' }),
  cross: K.cross('地割れ', AMBER),
  rings: K.rings('砕石散弾', STEEL),
  ult: K.ultCross('大掘削', AMBER),
}, ['bites', 'quake', 'burrow'], ['burrow', 'cross', 'rings']);

const aegis = K.boss('監視眼アイギス', 0x263238, { monster: 'eye', scale: 2.0, horn: STEEL, eye: RED, belly: 0xb0bec5 }, { hp: 14600, speed: 3.8, radius: 2, hpY: 6.5, keep: 11 }, {
  stare: K.stare('監視（目を逸らせ）', RED),
  beams: K.beams('走査レーザー', RED, { arms: 2, pose: 'float' }),
  grid: K.grid('防衛線', RED),
  orbs: K.orbs('偵察子機', CYAN, { n: 6, inward: true }),
  siege: K.siege('ロックオン', RED, { n: 5 }),
  ult: K.ultStare('全域監視', RED),
}, ['stare', 'orbs', 'beams'], ['grid', 'siege', 'beams']);

// 第4の間：機甲騎士と砲撃機
const gearknight = K.boss('機甲騎士ギアナイト', 0x607d8b, { scale: 2.3, horn: CYAN, eye: CYAN, weapon: 'spear', metal: 0x37474f }, { hp: 16400, def: 14, speed: 6.0, radius: 1.8, hpY: 6.4 }, {
  combo: K.combo('高周波ランス', CYAN, { pose: 'lunge' }),
  dash: K.dashes('ブーストチャージ', CYAN, { n: 3 }),
  spin: K.spin('回転刃', CYAN),
  cross: K.cross('十字斬', CYAN, { tgt: true }),
  siege: K.siege('包囲突撃', CYAN, { n: 4 }),
  ult: K.ultSiege('全機突撃', CYAN),
}, ['combo', 'spin', 'cross'], ['dash', 'siege', 'cross']);

const buster = K.boss('砲撃機バスター', 0x33691e, { monster: 'golem', scale: 2.1, horn: 0x212121, eye: AMBER, glow: RED }, { hp: 15400, def: 15, speed: 3.8, radius: 2.4, hpY: 7.2, keep: 12 }, {
  meteor: K.meteor('迫撃砲', AMBER),
  cluster: K.cluster('拡散弾', AMBER, { n: 6 }),
  breath: K.breath('主砲なぎ払い', RED),
  wall: K.wall('弾幕の壁', AMBER, { n: 2 }),
  rings: K.rings('全周砲', AMBER),
  ult: K.ultWalls('飽和攻撃', RED),
}, ['rings', 'breath', 'cluster'], ['meteor', 'wall', 'cluster']);

// 第5の間（3体同時）：要塞の心臓
const juggernaut = K.boss('要塞主砲ジャガーノート', 0x37474f, { monster: 'kaiju', scale: 1.9, horn: STEEL, eye: RED, belly: 0x546e7a, glow: RED }, { hp: 17600, def: 15, speed: 4.0, radius: 2.4, hpY: 7 }, {
  stomp: K.quake('重量踏みつけ', RED, { pose: 'crouch' }),
  breath: K.breath('荷電粒子砲', PLASMA),
  sweep: K.sweep('鉄尾の薙ぎ', RED, { pose: 'tail' }),
  pillars: K.pillars('爆撃', AMBER),
  rings: K.rings('全周ミサイル', AMBER),
  ult: K.ultCover('最終兵器', PLASMA),
}, ['stomp', 'sweep', 'breath'], ['breath', 'pillars', 'rings']);

const omega = K.boss('指揮官オメガ', 0x212121, { scale: 2.2, horn: PLASMA, eye: PLASMA, weapon: 'gun', metal: 0x4a148c }, { hp: 14800, speed: 5.6, radius: 1.6, hpY: 6, keep: 11 }, {
  fan: K.fan('プラズマ連射', PLASMA, { n: 6, volleys: 4, speed: 18, pose: 'over' }),
  grid: K.grid('指揮網', PLASMA),
  blink: K.blink('転送', PLASMA),
  orbs: K.orbs('防衛ビット', PLASMA, { n: 6 }),
  vortex: K.vortex('重力場', PLASMA, { spin: 2 }),
  ult: K.ultStill('凍結命令', PLASMA),
}, ['blink', 'orbs', 'vortex'], ['fan', 'grid', 'orbs']);

const mechadragon = K.boss('戦闘竜メカドラゴン', 0x78909c, { monster: 'dragon', scale: 2.0, horn: CYAN, eye: CYAN, belly: 0xb0bec5, wingColor: 0x37474f }, { hp: 16400, def: 14, speed: 5.4, radius: 2.1, hpY: 6.8 }, {
  bites: K.bites('鋼の牙', CYAN),
  breath: K.breath('冷却ブレス', CYAN),
  dive: K.dive('ジェット急降下', CYAN),
  spiral: K.spiral('ミサイル乱射', AMBER, { arms: 4 }),
  meteor: K.meteor('空爆', AMBER),
  ult: K.ultOrbs('全方位ドローン', CYAN),
}, ['bites', 'breath', 'spiral'], ['dive', 'meteor', 'spiral']);

const H = K.huge;
/** ステージ11のボス（data/enemies.js の BOSSES に足す） */
export const S11_BOSSES = {
  turret: H(turret), hornet: H(hornet), cerbmk: H(cerbmk), rivet: H(rivet), driller: H(driller), aegis: H(aegis),
  gearknight: H(gearknight), buster: H(buster), juggernaut: H(juggernaut), omega: H(omega), mechadragon: H(mechadragon),
};
