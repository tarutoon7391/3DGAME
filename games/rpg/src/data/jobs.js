// 職業8種のデータ（調整用の数値はここに集約）。処理は src/jobs.js
//
// 共通ルール：
//   通常攻撃（左クリック） … melee（近接コンボ）か shot（飛び道具）
//   Q スキル               … クールダウン制
//   E 必殺技               … 必殺ゲージ（0〜100）が満タンで撃てる。ゲージは攻撃を当てると溜まり、
//                            近接の通常攻撃がいちばん多く溜まる（gainMelee > gainShot）
//   ブレイク               … ボスに近接で当てるとブレイク値が溜まり、満タンでボスが気絶（被ダメ1.5倍）。
//                            飛び道具は breakShot 倍しか溜まらない。職業ごとに breakMul を掛ける
//
// stats.hp・atk・speed は剣士（旧仕様の固定能力）を基準にした値

export const GAUGE = {
  max: 100,
  gainMelee: 9, // 近接の通常攻撃1ヒット
  gainShot: 4, // 飛び道具の通常攻撃1ヒット
  gainSkill: 3, // Q スキル1ヒット
  breakShot: 0.3, // 飛び道具・魔法のブレイク値は近接のこの倍率
};

/** 近接コンボの型 */
const SWORD_COMBO = [
  { dur: 0.34, hit: 0.11, mult: 1.0 },
  { dur: 0.34, hit: 0.11, mult: 1.15 },
  { dur: 0.52, hit: 0.2, mult: 1.8 },
];

export const JOBS = {
  swordsman: {
    name: '剣士', role: '近接アタッカー', color: '#ffd54f',
    stats: { hp: 130, atk: 16, speed: 6.6 },
    basic: { type: 'melee', combo: SWORD_COMBO, range: 2.8, arc: 2.2, heavyBonus: 0.4 },
    q: { id: 'spin', name: '回転斬り', desc: '周囲をまとめて斬る', cd: 5, mult: 1.8, radius: 3.8 },
    e: { id: 'blade', name: '剣聖の一閃', desc: '前方へ巨大な斬撃を飛ばし、当たった敵をひるませる', mult: 4.5, range: 16, radius: 1.8 },
    trait: 'コンボ3段目が必ず会心。ブレイク値 1.3倍',
    breakMul: 1.3,
    look: { armorColor: 0x5d7fa8, swordColor: 0xcfd8dc, swordLen: 1.0, cape: 0xb71c1c, weapon: 'sword' },
  },
  knight: {
    name: '重騎士', role: '盾役（タンク）', color: '#90a4ae',
    stats: { hp: 210, atk: 13, speed: 5.7 },
    basic: { type: 'melee', combo: [{ dur: 0.45, hit: 0.16, mult: 1.2 }, { dur: 0.6, hit: 0.25, mult: 2.0 }], range: 2.6, arc: 2.4, heavyBonus: 0.3 },
    q: { id: 'taunt', name: '挑発の雄叫び', desc: 'ボスの狙いを自分に集め、6秒間 被ダメージ半減', cd: 14, dur: 6 },
    e: { id: 'aegis', name: '守護結界', desc: '足元に7秒間の結界。中に入った敵弾を消し、中の味方の被ダメージ半減', dur: 7, radius: 5.5 },
    trait: '被ダメージ -25%、ノックバックしない。ブレイク値 2倍',
    dmgTaken: 0.75, noKnock: true, breakMul: 2.0,
    look: { armorColor: 0x78909c, swordColor: 0xb0bec5, swordLen: 0.8, cape: 0x37474f, weapon: 'mace', bigShield: true },
  },
  mage: {
    name: '魔法使い', role: '遠距離・範囲火力', color: '#64b5f6',
    stats: { hp: 95, atk: 18, speed: 6.2 },
    basic: { type: 'shot', cd: 0.45, speed: 22, mult: 0.9, color: 0x64b5f6, size: 0.3, range: 26 },
    q: { id: 'fireball', name: '火球', desc: '着弾点で爆発する火の玉', cd: 6, mult: 2.4, radius: 3.5, speed: 18 },
    e: { id: 'meteor', name: 'メテオ', desc: '狙った場所に巨大な隕石を落とす（1.2秒後）', mult: 6, radius: 6, delay: 1.2, dist: 11 },
    trait: '立ち止まって撃つと通常攻撃・火球の威力 +30%',
    stillBonus: 1.3, breakMul: 1,
    look: { armorColor: 0x283593, swordColor: 0x64b5f6, swordLen: 0.9, cape: 0x1a237e, weapon: 'staff', hat: 0x283593 },
  },
  priest: {
    name: '僧侶', role: '回復・蘇生', color: '#fff59d',
    stats: { hp: 115, atk: 11, speed: 6.4 },
    basic: { type: 'shot', cd: 0.55, speed: 18, mult: 0.75, color: 0xfff59d, size: 0.28, range: 22 },
    q: { id: 'heal', name: '癒しの光', desc: '周囲8mの味方（自分も）の HP を最大の 40% 回復', cd: 10, radius: 8, amount: 0.4 },
    e: { id: 'prayer', name: '女神の祈り', desc: '全員を全回復し、倒れた味方を蘇生。3秒間 無敵', invuln: 3 },
    trait: '蘇生が2倍速。周囲6mの味方は毎秒 HP 1% 回復',
    reviveMul: 2, auraRegen: 0.01, auraRadius: 6, breakMul: 1,
    look: { armorColor: 0xeceff1, swordColor: 0xffe082, swordLen: 0.9, cape: 0xffd54f, weapon: 'staff', hat: 0xeceff1 },
  },
  archer: {
    name: '弓使い', role: '遠距離・単体火力', color: '#a5d6a7',
    stats: { hp: 105, atk: 15, speed: 6.9 },
    basic: { type: 'shot', cd: 0.32, speed: 34, mult: 0.8, color: 0xc5e1a5, size: 0.22, range: 32, pierce: true },
    q: { id: 'spread', name: '拡散矢', desc: '5方向に貫通する矢を放つ', cd: 4, mult: 1.0, count: 5, spread: 0.16 },
    e: { id: 'arrowrain', name: '矢の雨', desc: '狙った場所に3秒間 矢を降らせ続ける', radius: 5, dur: 3, every: 0.25, mult: 0.7, dist: 12 },
    trait: '10m 以上離れて当てるとダメージ +40%',
    farBonus: 1.4, farDist: 10, breakMul: 1,
    look: { armorColor: 0x558b2f, swordColor: 0x8d6e63, swordLen: 0.9, cape: 0x33691e, weapon: 'bow' },
  },
  ninja: {
    name: '忍者', role: '高速アタッカー', color: '#b39ddb',
    stats: { hp: 100, atk: 13, speed: 7.6 },
    basic: { type: 'melee', combo: [{ dur: 0.2, hit: 0.07, mult: 0.75 }, { dur: 0.2, hit: 0.07, mult: 0.75 }, { dur: 0.22, hit: 0.08, mult: 0.85 }, { dur: 0.38, hit: 0.14, mult: 1.4 }], range: 2.4, arc: 2.0, heavyBonus: 0.2 },
    q: { id: 'shadowstep', name: '瞬影斬', desc: '前方へ9m 駆け抜け、通り道の敵を斬る（その間 無敵）', cd: 6, mult: 2.2, dist: 9, time: 0.22, width: 1.6 },
    e: { id: 'clone', name: '影分身', desc: '8秒間、攻撃のたびに分身が追い打ち（威力60%）＋足が速くなる', dur: 8, cloneMult: 0.6, speedMul: 1.2 },
    trait: '回避のスタミナ消費が半分。回避直後の1撃は必ず会心',
    dodgeCostMul: 0.5, breakMul: 1,
    look: { armorColor: 0x37474f, swordColor: 0xb0bec5, swordLen: 0.6, cape: 0x4a148c, weapon: 'dagger', mask: true },
  },
  bard: {
    name: '吟遊詩人', role: '強化（バフ）', color: '#f48fb1',
    stats: { hp: 110, atk: 12, speed: 6.6 },
    basic: { type: 'shot', cd: 0.5, speed: 16, mult: 0.75, color: 0xf48fb1, size: 0.3, range: 20, wobble: true },
    q: { id: 'courage', name: '勇気の歌', desc: '周囲10mの味方の攻撃力 +30%（10秒）', cd: 15, radius: 10, dur: 10, atkMul: 1.3 },
    e: { id: 'gale', name: '疾風の旋律', desc: '全員 10秒間 スタミナ無限・移動 +25%・毎秒 HP 2% 回復', dur: 10, speedMul: 1.25, regen: 0.02 },
    trait: '周囲8mの味方の Q スキルのクールダウンが 1.3倍速で戻る',
    auraCd: 1.3, auraRadius: 8, breakMul: 1,
    look: { armorColor: 0xad1457, swordColor: 0xffcc80, swordLen: 0.7, cape: 0xf8bbd0, weapon: 'lute', hat: 0x880e4f },
  },
  summoner: {
    name: '召喚士', role: '召喚・おとり', color: '#80cbc4',
    stats: { hp: 100, atk: 12, speed: 6.4 },
    basic: { type: 'shot', cd: 0.55, speed: 20, mult: 0.75, color: 0x80cbc4, size: 0.28, range: 22 },
    q: { id: 'spirit', name: '精霊召喚', desc: 'その場に12秒間、ボスを撃ち続ける精霊を出す（最大2体）', cd: 9, dur: 12, every: 0.6, mult: 0.7, max: 2 },
    e: { id: 'golem', name: '岩巨人召喚', desc: 'ボスの狙いを引きつけ、殴りかかる岩巨人を12秒間出す', dur: 12, hp: 600, mult: 1.6 },
    trait: '召喚物がいる間、自分の被ダメージ -20%',
    summonGuard: 0.8, breakMul: 1,
    look: { armorColor: 0x00695c, swordColor: 0x80cbc4, swordLen: 0.9, cape: 0x004d40, weapon: 'staff', hat: 0x00695c },
  },
};

export const JOB_ORDER = ['swordsman', 'knight', 'mage', 'priest', 'archer', 'ninja', 'bard', 'summoner'];
export const DEFAULT_JOB = 'swordsman';

/** レイドの人数補正：ボスの HP・ブレイク値の上限に掛ける（1人 1.0 → 4人 2.8） */
export const RAID_SCALE = (n) => 1 + 0.6 * (Math.max(1, n) - 1);

/** ダウンした味方の蘇生（近くに立っている秒数）と、蘇生直後の HP 割合 */
export const REVIVE = { time: 3, radius: 2.2, hp: 0.4 };
