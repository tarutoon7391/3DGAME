// 職業80種のデータ（調整用の数値はここに集約）。処理は src/jobs.js
//
// 共通ルール：
//   通常攻撃（左クリック） … melee（近接コンボ）か shot（飛び道具）
//   Q・E スキル            … クールダウン制（それぞれ別の技）
//   R 必殺技               … 必殺ゲージ（0〜100）が満タンで撃てる。ゲージは攻撃を当てると溜まり、
//                            近接の通常攻撃がいちばん多く溜まる（gainMelee > gainShot）
//   ブレイク               … ボスに近接で当てるとブレイク値が溜まり、満タンでボスが気絶（被ダメ1.5倍）。
//                            飛び道具は breakShot 倍しか溜まらない。職業ごとに breakMul を掛ける
//
// 基本ステータス（HP・攻撃・移動）はロールで決まる（data/roles.js）。職ごとのデータに書くのは技と特性と、
//   power   … 火力係数。その職のすべての攻撃（通常攻撃・技・召喚物・設置物）のダメージに掛かる
//   support … 支援係数。味方への回復・バリア・強化と、ボスへの被ダメ増（腐食・鎧砕き）の効き目に掛かる
// の2つ。どちらも docs/balance の計測（tools/rpg-balance）で決める

import { ROLES, roleStats } from './roles.js';

export const GAUGE = {
  max: 100,
  gainMelee: 9, // 近接の通常攻撃1ヒット
  gainShot: 4, // 飛び道具の通常攻撃1ヒット
  gainSkill: 3, // Q・E スキル1ヒット
  // 通常攻撃は「1ヒットいくつ」ではなく「休まず当て続けたら毎秒いくつ」で職業ごとに揃える
  // （手数の多い職だけ一瞬で溜まらないように。1ヒットの量は下の basicGauge で職業ごとに決まる）
  basicPerSecMelee: 15, // 近接：当て続けて約7秒で満タン（近づく危険がある分 多め）
  basicPerSecShot: 8, // 飛び道具：約12.5秒で満タン
  // 技・継続ダメージ・設置物の小さなヒット（1ヒット 3 以下）は 2秒あたり合計 12 まで（多段・連射の技で一気に溜まらないように）
  skillCap: 12,
  skillCapWindow: 2,
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
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: SWORD_COMBO, range: 2.8, arc: 2.2, heavyBonus: 0.4 },
    q: { id: 'spin', name: '回転斬り', desc: '周囲をまとめて斬る', cd: 5, mult: 1.8, radius: 3.8 },
    e: { id: 'galethrust', name: '疾風突き', desc: '前方へ5m 踏み込んで突く', cd: 6, mult: 1.9, dist: 5, time: 0.18, width: 1.3 },
    r: { id: 'blade', name: '剣聖の一閃', desc: '前方へ巨大な斬撃を飛ばし、当たった敵をひるませる', mult: 4.5, range: 16, radius: 1.8 },
    trait: 'コンボ3段目が必ず会心。ブレイク値 1.3倍',
    breakMul: 1.3,
    look: { armorColor: 0x5d7fa8, swordColor: 0xcfd8dc, swordLen: 1.0, cape: 0xb71c1c, weapon: 'sword' },
  },
  knight: {
    name: '重騎士', role: '盾役（タンク）', color: '#90a4ae',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.45, hit: 0.16, mult: 1.2 }, { dur: 0.6, hit: 0.25, mult: 2.0 }], range: 2.6, arc: 2.4, heavyBonus: 0.3 },
    q: { id: 'taunt', name: '挑発の雄叫び', desc: 'ボスの狙いを自分に集め、6秒間 被ダメージ半減', cd: 14, dur: 6 },
    e: { id: 'bash', name: 'シールドバッシュ', desc: '盾を構えて4m 突進。ブレイク値が大きく溜まる', cd: 8, mult: 1.6, dist: 4, time: 0.22, width: 1.6, brkMul: 3 },
    r: { id: 'aegis', name: '守護結界', desc: '足元に7秒間の結界。中に入った敵弾を消し、中の味方の被ダメージ半減', dur: 7, radius: 5.5 },
    trait: '被ダメージ -25%、ノックバックしない。ブレイク値 2倍',
    dmgTaken: 0.75, noKnock: true, breakMul: 2.0,
    look: { armorColor: 0x78909c, swordColor: 0xb0bec5, swordLen: 0.8, cape: 0x37474f, weapon: 'mace', bigShield: true },
  },
  mage: {
    name: '魔法使い', role: '遠距離・範囲火力', color: '#64b5f6',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 22, mult: 0.9, color: 0x64b5f6, size: 0.3, range: 26 },
    q: { id: 'fireball', name: '火球', desc: '着弾点で爆発する火の玉', cd: 6, mult: 2.4, radius: 3.5, speed: 18 },
    e: { id: 'icelance', name: '氷の槍', desc: '敵を貫通する氷の槍を放つ', cd: 5, mult: 2.0, speed: 30, range: 28 },
    r: { id: 'meteor', name: 'メテオ', desc: '狙った場所に巨大な隕石を落とす（1.2秒後）', mult: 6, radius: 6, delay: 1.2, dist: 11 },
    trait: '立ち止まって撃つと通常攻撃・火球の威力 +30%',
    stillBonus: 1.3, breakMul: 1,
    look: { armorColor: 0x283593, swordColor: 0x64b5f6, swordLen: 0.9, cape: 0x1a237e, weapon: 'staff', hat: 0x283593 },
  },
  priest: {
    name: '僧侶', role: '回復・蘇生', color: '#fff59d',
    healer: true, // 回復ができる：ピンチの味方が赤く光って見える
    power: 1.3, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.55, speed: 18, mult: 0.75, color: 0xfff59d, size: 0.28, range: 22 },
    q: { id: 'heal', name: '癒しの光', desc: '周囲8mの味方（自分も）の HP を最大の 40% 回復', cd: 10, radius: 8, amount: 0.4 },
    e: { id: 'sanctuary', name: '聖なる守り', desc: '周囲8mの味方（自分も）の被ダメージ -30%（6秒）', cd: 16, radius: 8, dur: 6, mul: 0.7 },
    // 蘇生できる必殺技は強すぎるので、1回の挑戦（進行）で1度だけ。全滅してやり直しても戻らない
    r: { id: 'prayer', name: '女神の祈り', desc: '全員を全回復し、倒れた味方を蘇生。3秒間 無敵（1回の挑戦で1度だけ）', invuln: 3, oncePerRun: true },
    trait: '周囲6mの味方は毎秒 HP 1% 回復',
    auraRegen: 0.01, auraRadius: 6, breakMul: 1,
    look: { armorColor: 0xeceff1, swordColor: 0xffe082, swordLen: 0.9, cape: 0xffd54f, weapon: 'staff', hat: 0xeceff1 },
  },
  archer: {
    name: '弓使い', role: '遠距離・単体火力', color: '#a5d6a7',
    power: 0.93, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.32, speed: 34, mult: 0.8, color: 0xc5e1a5, size: 0.22, range: 32, pierce: true },
    q: { id: 'spread', name: '拡散矢', desc: '5方向に貫通する矢を放つ', cd: 4, mult: 1.0, count: 5, spread: 0.16 },
    e: { id: 'backshot', name: '跳び退き射撃', desc: '後ろへ跳び退きながら強い矢を放つ（跳ぶ間は無敵）', cd: 7, mult: 1.8, dist: 5, time: 0.25 },
    r: { id: 'arrowrain', name: '矢の雨', desc: '狙った場所に3秒間 矢を降らせ続ける', radius: 5, dur: 3, every: 0.25, mult: 0.7, dist: 12 },
    trait: '10m 以上離れて当てるとダメージ +40%',
    farBonus: 1.4, farDist: 10, breakMul: 1,
    look: { armorColor: 0x558b2f, swordColor: 0x8d6e63, swordLen: 0.9, cape: 0x33691e, weapon: 'bow' },
  },
  ninja: {
    name: '忍者', role: '高速アタッカー', color: '#b39ddb',
    power: 0.97, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.2, hit: 0.07, mult: 0.75 }, { dur: 0.2, hit: 0.07, mult: 0.75 }, { dur: 0.22, hit: 0.08, mult: 0.85 }, { dur: 0.38, hit: 0.14, mult: 1.4 }], range: 2.4, arc: 2.0, heavyBonus: 0.2 },
    q: { id: 'shadowstep', name: '瞬影斬', desc: '前方へ9m 駆け抜け、通り道の敵を斬る（その間 無敵）', cd: 6, mult: 2.2, dist: 9, time: 0.22, width: 1.6 },
    e: { id: 'shuriken', name: '手裏剣', desc: '扇状に3枚の手裏剣を投げる（貫通）', cd: 4, mult: 0.9, count: 3, spread: 0.2, speed: 30 },
    r: { id: 'clone', name: '影分身', desc: '8秒間、攻撃のたびに分身が追い打ち（威力60%）＋足が速くなる', dur: 8, cloneMult: 0.6, speedMul: 1.2 },
    trait: '回避のスタミナ消費が半分。回避直後の1撃は必ず会心',
    dodgeCostMul: 0.5, breakMul: 1,
    look: { armorColor: 0x37474f, swordColor: 0xb0bec5, swordLen: 0.6, cape: 0x4a148c, weapon: 'dagger', mask: true },
  },
  bard: {
    name: '吟遊詩人', role: '強化（バフ）', color: '#f48fb1',
    healer: true, // 回復ができる：ピンチの味方が赤く光って見える
    power: 1.1, support: 0.74, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 16, mult: 0.75, color: 0xf48fb1, size: 0.3, range: 20, wobble: true },
    q: { id: 'courage', name: '勇気の歌', desc: '周囲10mの味方の攻撃力 +30%（10秒）', cd: 15, radius: 10, dur: 10, atkMul: 1.3 },
    e: { id: 'dissonance', name: '不協和音', desc: '前方6mの扇に音の衝撃。ブレイク値が大きく溜まる', cd: 8, mult: 1.4, range: 6, arc: 1.6, brkMul: 3 },
    r: { id: 'gale', name: '疾風の旋律', desc: '全員 10秒間 スタミナ無限・移動 +25%・毎秒 HP 2% 回復', dur: 10, speedMul: 1.25, regen: 0.02 },
    trait: '周囲8mの味方の Q スキルのクールダウンが 1.3倍速で戻る',
    auraCd: 1.3, auraRadius: 8, breakMul: 1,
    look: { armorColor: 0xad1457, swordColor: 0xffcc80, swordLen: 0.7, cape: 0xf8bbd0, weapon: 'lute', hat: 0x880e4f },
  },
  summoner: {
    name: '召喚士', role: '召喚・おとり', color: '#80cbc4',
    power: 0.8, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.55, speed: 20, mult: 0.75, color: 0x80cbc4, size: 0.28, range: 22 },
    q: { id: 'spirit', name: '精霊召喚', desc: 'その場に12秒間、ボスを撃ち続ける精霊を出す（最大2体）', cd: 9, dur: 12, every: 0.6, mult: 0.7, max: 2 },
    e: { id: 'detonate', name: '精霊爆破', desc: '自分の精霊をすべて爆発させる（1体ごとに範囲ダメージ）', cd: 10, mult: 2.6, radius: 3.5 },
    r: { id: 'golem', name: '岩巨人召喚', desc: 'ボスの狙いを引きつけ、地面から岩を引き抜いて投げつける岩巨人を12秒間出す', dur: 12, hp: 600, mult: 1.6 },
    trait: '召喚物がいる間、自分の被ダメージ -20%',
    summonGuard: 0.8, breakMul: 1,
    look: { armorColor: 0x00695c, swordColor: 0x80cbc4, swordLen: 0.9, cape: 0x004d40, weapon: 'staff', hat: 0x00695c },
  },

  // ---------------- 追加の8職 ----------------
  lancer: {
    name: '槍兵', role: '長いリーチの近接', color: '#ffab91',
    power: 1.06, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    // 細く長い突き（arc が狭いぶん range が長い）
    basic: { type: 'melee', combo: [{ dur: 0.36, hit: 0.13, mult: 1.05 }, { dur: 0.36, hit: 0.13, mult: 1.1 }, { dur: 0.55, hit: 0.22, mult: 1.9 }], range: 4.0, arc: 0.9, heavyBonus: 0.6 },
    q: { id: 'lunge', name: '突進突き', desc: '前方へ7m 踏み込み、通り道の敵を貫く（ブレイク大）', cd: 6, mult: 2.4, dist: 7, time: 0.25, width: 1.4 },
    e: { id: 'whirlspear', name: '旋回槍', desc: '槍を振り回して周囲を薙ぐ', cd: 6, mult: 1.7, radius: 4.2 },
    r: { id: 'skyfall', name: '天穿ち', desc: '高く跳んで狙った場所へ急降下。着地の周囲に大ダメージ（跳んでいる間は無敵）', mult: 5.5, radius: 4.5, dist: 7, time: 0.8 },
    trait: '槍が長い（届く距離 4m）。ブレイク値 1.5倍',
    breakMul: 1.5,
    look: { armorColor: 0x8d6e63, swordColor: 0xd7ccc8, swordLen: 1.0, cape: 0xbf360c, weapon: 'spear' },
  },
  monk: {
    name: '格闘家', role: '連打で加速する近接', color: '#ffcc80',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.18, hit: 0.06, mult: 0.6 }, { dur: 0.18, hit: 0.06, mult: 0.6 }, { dur: 0.18, hit: 0.06, mult: 0.65 }, { dur: 0.2, hit: 0.07, mult: 0.7 }, { dur: 0.36, hit: 0.13, mult: 1.3 }], range: 2.2, arc: 1.8, heavyBonus: 0.2 },
    q: { id: 'kiblast', name: '気功波', desc: '前方5mの扇に気の衝撃を放ち、敵を吹き飛ばす', cd: 5, mult: 2.0, range: 5.5, arc: 1.3 },
    e: { id: 'uppercut', name: '昇龍拳', desc: '無敵で飛び上がりながら周りを打ち上げる', cd: 6, mult: 2.2, radius: 2.8, time: 0.45 },
    r: { id: 'barrage', name: '百烈拳', desc: '2秒間その場で拳を連打（約20発）。最後に強烈な一撃', dur: 2, every: 0.1, mult: 0.45, finish: 3, range: 3 },
    trait: '攻撃を当て続けるほど攻撃力アップ（1発 +2%、最大 +50%）。被弾でリセット',
    chainPer: 0.02, chainMax: 25, breakMul: 1.2,
    look: { armorColor: 0xe65100, swordColor: 0xffcc80, swordLen: 0.5, cape: 0xffb74d, weapon: 'fist' },
  },
  alchemist: {
    name: '錬金術師', role: '弱体化（デバフ）', color: '#c5e1a5',
    power: 0.82, support: 0.66, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.7, speed: 15, mult: 1.0, color: 0xaed581, size: 0.32, range: 18, explode: 2.2 },
    q: { id: 'corrode', name: '腐食の瓶', desc: '当てたボスを8秒間 腐食させ、全員の与えるダメージ +25%', cd: 14, dur: 8, mul: 1.25, speed: 18 },
    e: { id: 'triflask', name: '爆裂瓶3連', desc: '3方向に爆発する瓶を投げる', cd: 7, mult: 1.2, count: 3, spread: 0.3, speed: 16, radius: 2.4 },
    r: { id: 'bigflask', name: '大爆発フラスコ', desc: '巨大な瓶を投げる。着弾点で大爆発し、ボスも腐食させる', mult: 5, radius: 6, speed: 16, dur: 6, mul: 1.25 },
    trait: '腐食しているボスへの自分の攻撃はさらに +20%',
    vulnBonus: 1.2, breakMul: 1,
    look: { armorColor: 0x558b2f, swordColor: 0xaed581, swordLen: 0.6, cape: 0x33691e, weapon: 'flask', hat: 0x33691e },
  },
  berserker: {
    name: '狂戦士', role: '捨て身の火力', color: '#ef9a9a',
    power: 0.88, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.5, hit: 0.2, mult: 1.5 }, { dur: 0.7, hit: 0.3, mult: 2.4 }], range: 3.0, arc: 2.6, heavyBonus: 0.4 },
    q: { id: 'warcry', name: '怒号', desc: '8秒間 攻撃力 +50%。そのかわり被ダメージ +25%', cd: 16, dur: 8, atkMul: 1.5, dmgMul: 1.25 },
    e: { id: 'earthsplit', name: '大地割り', desc: '前方へ4か所、続けざまに地面を割る', cd: 8, mult: 1.4, count: 4, step: 2, radius: 1.8, every: 0.1 },
    r: { id: 'bloodstorm', name: '血の旋風', desc: '斧を振り回して周囲を4回斬る。与えたダメージの30% だけ HP 回復', mult: 1.7, radius: 4, hits: 4, every: 0.25, lifesteal: 0.3 },
    trait: 'HP が減るほど攻撃力アップ（瀕死で最大 +60%）',
    lowHpBonus: 0.6, breakMul: 1.3,
    look: { armorColor: 0x4e342e, swordColor: 0x9e9e9e, swordLen: 0.9, cape: 0x8e0000, weapon: 'axe' },
  },
  chrono: {
    name: '時魔導士', role: '時間操作', color: '#b388ff',
    power: 1.77, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 16, mult: 0.85, color: 0xb388ff, size: 0.3, range: 22 },
    q: { id: 'slowfield', name: '時の鈍化', desc: 'ボスの時間を6秒間 遅くする（動き・予備動作・弾幕の間隔が 0.6倍）', cd: 15, dur: 6, mul: 0.6 },
    e: { id: 'rewind', name: '巻き戻し', desc: '自分の HP を3秒前の状態まで戻す（減っていなければ何もしない）', cd: 18, back: 3 },
    // 強すぎたので 3.5秒→2秒。止めたあと同じボスには15秒 効かない（連発で止めっぱなしにできない）
    r: { id: 'timestop', name: '時間停止', desc: 'ボスの攻撃を中断させ、2秒間 止める（止めたボスには15秒間 効かない）', dur: 2, immune: 15 },
    trait: '回避の無敵時間が 0.2秒 長い',
    dodgeInvulnBonus: 0.2, breakMul: 1,
    look: { armorColor: 0x4527a0, swordColor: 0xb388ff, swordLen: 0.9, cape: 0x311b92, weapon: 'staff', hat: 0x4527a0 },
  },
  gunner: {
    name: '砲術士', role: '一撃の重い射撃', color: '#ffd180',
    power: 0.91, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    // 連射できないかわりに1発が重く、貫通する
    basic: { type: 'shot', cd: 0.9, speed: 48, mult: 2.2, color: 0xffd180, size: 0.2, range: 36, pierce: true },
    q: { id: 'buckshot', name: '散弾', desc: '近距離に7発の散弾。近いほど全弾当たる', cd: 5, count: 7, spread: 0.13, mult: 0.75, range: 9, speed: 34 },
    e: { id: 'mine', name: '地雷設置', desc: '足元に地雷を置く。ボスが近づくか6秒たつと爆発', cd: 10, mult: 3.2, radius: 3.5, trigger: 2.5, dur: 6 },
    r: { id: 'cannon', name: '大砲', desc: '巨大な砲弾を撃つ。着弾で大爆発', mult: 7, radius: 4.5, speed: 26 },
    trait: '会心率 +20%',
    critBonus: 0.2, breakMul: 1,
    look: { armorColor: 0x5d4037, swordColor: 0x424242, swordLen: 0.9, cape: 0xff6f00, weapon: 'gun' },
  },
  warlock: {
    name: '呪術師', role: '継続ダメージ・吸収', color: '#ce93d8',
    healer: true, // 回復ができる：ピンチの味方が赤く光って見える
    power: 0.84, support: 2.73, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    // 当てた敵に短い呪い（継続ダメージ）を付ける
    basic: { type: 'shot', cd: 0.55, speed: 18, mult: 0.6, color: 0xce93d8, size: 0.3, range: 22, dot: { mult: 0.15, every: 0.5, dur: 3 } },
    q: { id: 'hex', name: '呪いの刻印', desc: '当てた敵に8秒間の強い呪い（0.5秒ごとにダメージ）', cd: 9, speed: 20, dot: { mult: 0.4, every: 0.5, dur: 8 } },
    e: { id: 'cursespread', name: '呪いの拡散', desc: '自分の呪いがかかった敵すべてに追加ダメージを与え、呪いを延長する', cd: 9, mult: 1.6, extend: 3 },
    r: { id: 'drain', name: '生命吸収', desc: '2秒間 前方の敵から命を吸い取り、周り10mの味方を少しずつ回復（合計 最大16%）', dur: 2, every: 0.25, mult: 0.7, range: 14, heal: 0.02, healRadius: 10 },
    trait: '与えたダメージの 3% だけ HP 回復（1回の回復は最大 HP の 1.5% まで）',
    lifesteal: 0.03, lifestealCap: 0.015, breakMul: 1,
    look: { armorColor: 0x311b92, swordColor: 0xce93d8, swordLen: 0.9, cape: 0x1a0026, weapon: 'staff', hat: 0x1a0026 },
  },
  reaper: {
    name: '処刑人', role: 'とどめ役', color: '#b0bec5',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    // 大鎌：遅いが横に広い
    basic: { type: 'melee', combo: [{ dur: 0.48, hit: 0.2, mult: 1.25 }, { dur: 0.48, hit: 0.2, mult: 1.3 }, { dur: 0.65, hit: 0.28, mult: 2.0 }], range: 3.3, arc: 3.2, heavyBonus: 0.4 },
    q: { id: 'soulreap', name: '魂刈り', desc: '大きく薙ぎ払う。当てた数だけ必殺ゲージが大きく溜まる', cd: 7, mult: 2.0, range: 4.2, arc: 4.2, gauge: 14 },
    e: { id: 'scythethrow', name: '鎌投げ', desc: '大鎌を投げる。12m 先で戻ってきて往復で当たる（貫通）', cd: 6, mult: 1.3, speed: 22, range: 12 },
    r: { id: 'verdict', name: '死の宣告', desc: '前方の敵1体に、減っている HP が多いほど強い一撃（最大で通常の3倍以上）', mult: 3, missingMult: 9, range: 6 },
    trait: 'ボスの HP が 30% 以下なら攻撃力 +40%',
    executeAt: 0.3, executeBonus: 1.4, breakMul: 1,
    look: { armorColor: 0x263238, swordColor: 0xb0bec5, swordLen: 1.0, cape: 0x000000, weapon: 'scythe' },
  },

  // ================= 追加の16職（技は jobs.js の汎用の型 kind をデータで組み合わせている） =================
  trapper: {
    name: '罠士', role: '罠・妨害', color: '#a1887f',
    power: 0.81, support: 0.83, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.4, speed: 26, mult: 0.75, color: 0xbcaaa4, size: 0.2, range: 22 },
    q: { id: 'beartrap', kind: 'zone', zone: 'trap', name: 'トラバサミ', desc: '足元に罠を置く。ボスが踏むと挟んで大ダメージ＋5秒間 動きが鈍る', cd: 7, radius: 2.5, trigger: 1.6, mult: 3, dur: 25, color: 0x8d6e63, debuff: { name: 'slow', dur: 5, mul: 0.6 } },
    e: { id: 'blasttrap', kind: 'zone', zone: 'trap', name: '爆薬罠', desc: '狙った場所に爆薬罠を置く。踏むと爆発し、ボスを8秒間 腐食させる', cd: 10, at: 'aim', dist: 5, radius: 4, trigger: 2, mult: 3.5, dur: 25, color: 0xff7043, debuff: { name: 'vuln', dur: 8, mul: 1.2 } },
    r: { id: 'trapfield', kind: 'zone', zone: 'trap', name: '罠の大地', desc: '周りに罠を6つ一斉にばらまく', count: 6, scatter: 5, radius: 3, trigger: 1.8, mult: 3, dur: 30, color: 0xa1887f, debuff: { name: 'slow', dur: 4, mul: 0.6 } },
    trait: '罠のダメージ +30%',
    trapBonus: 1.3, breakMul: 1,
    look: { armorColor: 0x5d4037, swordColor: 0xa1887f, swordLen: 0.6, cape: 0x3e2723, weapon: 'dagger' },
  },
  samurai: {
    name: '侍', role: '居合・反撃', color: '#e0e0e0',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.32, hit: 0.11, mult: 1.0 }, { dur: 0.32, hit: 0.11, mult: 1.05 }, { dur: 0.5, hit: 0.2, mult: 1.8 }], range: 2.9, arc: 2.0, heavyBonus: 0.4 },
    q: { id: 'iai', kind: 'cone', name: '居合', desc: '前方へ一閃。必ず会心', cd: 6, mult: 2.4, range: 4.5, arc: 1.2, crit: true, color: 0xffffff },
    e: { id: 'mikiri', kind: 'counter', name: '見切り', desc: '1秒間 構える。その間に攻撃されると無傷で受け流し、強烈に反撃', cd: 8, dur: 1, mult: 4, range: 6 },
    r: { id: 'tsubame', kind: 'burst', name: '奥義・燕返し', desc: '一瞬溜めてから、目にも止まらぬ6連斬り（周囲）。最後は溜めた縦斬り', ticks: 6, every: 0.12, windup: 0.25, lastGap: 0.2, mult: 1.3, radius: 3.6, color: 0xffffff },
    trait: '会心のダメージがさらに +50%',
    critDmgBonus: 0.5, breakMul: 1.1,
    look: { armorColor: 0x37474f, swordColor: 0xeceff1, swordLen: 1.1, cape: 0xb71c1c, weapon: 'sword' },
  },
  dancer: {
    name: '踊り子', role: '回避で溜める', color: '#f8bbd0',
    power: 1.11, support: 0.53, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.24, hit: 0.08, mult: 0.8 }, { dur: 0.24, hit: 0.08, mult: 0.8 }, { dur: 0.24, hit: 0.08, mult: 0.85 }, { dur: 0.4, hit: 0.15, mult: 1.4 }], range: 2.5, arc: 2.6, heavyBonus: 0.2 },
    q: { id: 'swordance', kind: 'burst', name: '剣の舞', desc: '回りながら周りを3回斬る', cd: 5, ticks: 3, every: 0.15, mult: 0.9, radius: 3.2, color: 0xf48fb1 },
    e: { id: 'glide', kind: 'dash', name: 'ステップ', desc: '軽やかに6m 滑り込み、通り道を斬る（無敵）', cd: 5, mult: 1.2, dist: 6, time: 0.2, width: 1.3, color: 0xf8bbd0 },
    r: { id: 'samba', kind: 'teambuff', name: '情熱のサンバ', desc: '全員 10秒間 攻撃力 +25%・移動 +20%', buff: 'samba', dur: 10, vals: { atkMul: 1.25, speedMul: 1.2 }, color: 0xf48fb1, msg: '情熱のサンバ！ 攻撃力・移動アップ' },
    trait: '回避するたびに必殺ゲージ +8',
    dodgeGauge: 8, breakMul: 1,
    look: { armorColor: 0xc2185b, swordColor: 0xf8bbd0, swordLen: 0.6, cape: 0xf48fb1, weapon: 'dagger' },
  },
  storm: {
    name: '雷術士', role: '連鎖する雷', color: '#fff176',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 30, mult: 0.8, color: 0xfff176, size: 0.25, range: 24 },
    q: { id: 'thunder', kind: 'zone', zone: 'strike', name: '落雷', desc: '一番近いボスの足元に0.7秒後 雷を落とす', cd: 5, at: 'boss', dist: 8, radius: 3.5, dur: 0.7, mult: 2.6, color: 0xfff176 },
    e: { id: 'chainbolt', kind: 'shots', name: '連鎖雷', desc: '当たった敵の周りの敵にも連鎖する雷を放つ', cd: 6, speed: 34, mult: 1.6, size: 0.35, color: 0xffee58, chain: { range: 8, mult: 1.0 } },
    r: { id: 'tempest', kind: 'zone', zone: 'field', name: '雷嵐', desc: '一番近いボスの周りに5秒間 雷を降らせ続ける。中の敵の足元から雷がはじける', at: 'boss', dist: 8, radius: 6, dur: 5, every: 0.3, mult: 0.9, color: 0xfff176 },
    trait: '会心率 +10%。会心のダメージ +20%',
    critBonus: 0.1, critDmgBonus: 0.2, breakMul: 1,
    look: { armorColor: 0x283593, swordColor: 0xfff176, swordLen: 0.9, cape: 0xf9a825, weapon: 'staff', hat: 0x1a237e },
  },
  barrier: {
    name: '結界師', role: 'バリア（防御支援）', color: '#80d8ff',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.55, speed: 20, mult: 0.75, color: 0x80d8ff, size: 0.3, range: 22 },
    q: { id: 'ward', kind: 'teambuff', name: '守りの結界', desc: '周囲8mの味方にバリア（最大 HP の 25% を吸収・8秒）', cd: 12, radius: 8, buff: 'barrier', dur: 8, vals: { shield: 0.25 }, color: 0x80d8ff, msg: 'バリアが張られた！' },
    e: { id: 'wardburst', kind: 'burst', name: '結界破裂', desc: '自分の周りにバリアを張り、砕いた衝撃で攻撃する', cd: 7, windup: 0.35, anim: 'cast', mult: 1.8, radius: 4.5, color: 0x80d8ff, melee: false, knock: 2 },
    r: { id: 'greatward', kind: 'teambuff', name: '大結界', desc: '全員に大きなバリア（最大 HP の 60% を吸収・10秒）', buff: 'barrier', dur: 10, vals: { shield: 0.6 }, color: 0x40c4ff, msg: '大結界！ 大きなバリアが張られた' },
    trait: '自分にバリアがある間 攻撃力 +20%',
    barrierAtk: 1.2, breakMul: 1,
    look: { armorColor: 0x0277bd, swordColor: 0x80d8ff, swordLen: 0.9, cape: 0x01579b, weapon: 'staff', hat: 0x0277bd },
  },
  thief: {
    name: '盗賊', role: 'ゲージ稼ぎ・配る', color: '#bcaaa4',
    power: 0.99, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.22, hit: 0.07, mult: 0.75 }, { dur: 0.22, hit: 0.07, mult: 0.8 }, { dur: 0.36, hit: 0.13, mult: 1.25 }], range: 2.4, arc: 2.0, heavyBonus: 0.2 },
    q: { id: 'steal', kind: 'cone', name: '盗む', desc: '前方を素早く斬りつけ、必殺ゲージを大きく奪う', cd: 6, mult: 1.2, range: 3.2, arc: 1.4, gaugeSelf: 22, color: 0xffd54f },
    e: { id: 'smoke', kind: 'selfbuff', name: '煙玉', desc: '煙に紛れて1.5秒 無敵。4秒間 足が速くなる', cd: 10, buff: 'smoke', dur: 4, vals: { speedMul: 1.35 }, invuln: 1.5, color: 0x9e9e9e, sound: 'dodge' },
    r: { id: 'bounty', kind: 'teamgauge', name: '大盤振る舞い', desc: '仲間全員に必殺ゲージを +40 配る（自分は +20）', amount: 40, self: 20, color: 0xffd54f },
    trait: '必殺ゲージの溜まり方 1.3倍',
    gaugeMul: 1.3, breakMul: 1,
    look: { armorColor: 0x4e342e, swordColor: 0xbdbdbd, swordLen: 0.6, cape: 0x212121, weapon: 'dagger', mask: true },
  },
  astrologer: {
    name: '占星術師', role: 'ランダム強化', color: '#b39ddb',
    power: 0.71, support: 1.7, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 20, mult: 0.8, color: 0xd1c4e9, size: 0.3, range: 22 },
    q: { id: 'card', kind: 'random', name: '星のカード', desc: 'カードを引く：攻撃・守り・速さ・回復のどれかを周りの味方に（10秒）', cd: 9, pool: [
      { name: '太陽（攻撃 +25%）', kind: 'teambuff', radius: 9, buff: 'card', dur: 10, vals: { atkMul: 1.25 }, color: 0xffd54f },
      { name: '月（被ダメ -25%）', kind: 'teambuff', radius: 9, buff: 'card', dur: 10, vals: { dmgMul: 0.75 }, color: 0x90caf9 },
      { name: '風（移動 +30%）', kind: 'teambuff', radius: 9, buff: 'card', dur: 10, vals: { speedMul: 1.3 }, color: 0xa5d6a7 },
      { name: '星（毎秒 3% 回復）', kind: 'teambuff', radius: 9, buff: 'card', dur: 10, vals: { regen: 0.03 }, color: 0xfff59d },
    ] },
    e: { id: 'starfall', kind: 'zone', zone: 'strike', name: '流れ星', desc: '狙った場所に1秒後 光る小さな隕石を3つ落とす', cd: 6, at: 'aim', dist: 8, radius: 4, dur: 1, mult: 3, color: 0xd1c4e9 },
    r: { id: 'meteorshower', kind: 'zone', zone: 'strike', name: '流星群', desc: '狙った場所の周りに燃える隕石を降らせる', at: 'aim', dist: 9, count: 6, scatter: 3.5, radius: 3, dur: 1.2, mult: 2.6, color: 0xb39ddb },
    trait: '星の加護：会心率 +15%',
    critBonus: 0.15, breakMul: 1,
    look: { armorColor: 0x311b92, swordColor: 0xd1c4e9, swordLen: 0.9, cape: 0x4527a0, weapon: 'staff', hat: 0x1a237e },
  },
  spellblade: {
    name: '魔剣士', role: '魔力付与の近接', color: '#9575cd',
    power: 0.97, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.34, hit: 0.11, mult: 1.0 }, { dur: 0.34, hit: 0.11, mult: 1.1 }, { dur: 0.5, hit: 0.2, mult: 1.6 }], range: 2.8, arc: 2.2, heavyBonus: 0.4 },
    q: { id: 'enchant', kind: 'selfbuff', name: '魔力付与', desc: '10秒間 近接攻撃が当たるたびに小さな魔力の爆発が起きる', cd: 14, buff: 'enchant', dur: 10, vals: { mult: 0.7, radius: 2.2, color: 0x7c4dff }, color: 0x7c4dff, msg: '魔力付与！ 近接攻撃が爆発する' },
    e: { id: 'flashblade', kind: 'dash', name: '魔光閃', desc: '魔力をまとって6m 斬り抜ける', cd: 6, mult: 2.0, dist: 6, time: 0.2, width: 1.5, color: 0x9575cd },
    r: { id: 'arcanewave', kind: 'shots', name: '魔剣解放', desc: '剣を掲げて1秒 魔力を溜め、巨大な魔力の刃を放つ（貫通・着弾で爆発はしない）', windup: 1, mult: 5, speed: 26, size: 1.1, range: 22, pierce: true, color: 0x7c4dff, sound: 'wave' },
    trait: 'Q・E を使うたびに必殺ゲージ +6',
    gaugeOnSkill: 6, breakMul: 1.1,
    look: { armorColor: 0x4527a0, swordColor: 0xb39ddb, swordLen: 1.0, cape: 0x311b92, weapon: 'sword' },
  },
  dragonkin: {
    name: '竜人', role: '変身', color: '#ff8a65',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.38, hit: 0.13, mult: 1.1 }, { dur: 0.38, hit: 0.13, mult: 1.15 }, { dur: 0.55, hit: 0.22, mult: 1.8 }], range: 2.8, arc: 2.4, heavyBonus: 0.4 },
    q: { id: 'breath', kind: 'cone', name: '竜の息吹', desc: '前方に炎を吐き、焼き続ける（継続ダメージ）', cd: 7, mult: 1.2, range: 6, arc: 1.2, color: 0xff7043, melee: false, sound: 'wave', dot: { mult: 0.3, every: 0.5, dur: 4 } },
    e: { id: 'wingdash', kind: 'leap', name: '翼撃', desc: '翼を広げてその場でゆっくり舞い上がり、狙った場所へ斜めに急降下して周りを打つ', cd: 8, dist: 6, time: 2, rise: 1.2, height: 4.5, radius: 3.5, mult: 2.2, color: 0xff8a65 },
    r: { id: 'dragonform', kind: 'selfbuff', name: '竜化', desc: '空から雷を呼んで周りを打ち、12秒間 赤い竜の姿に：攻撃力 +50%・被ダメ -30%・移動 +15%', buff: 'dragon', dur: 12, strike: { mult: 2, radius: 5 }, vals: { atkMul: 1.5, dmgMul: 0.7, speedMul: 1.15 }, color: 0xff5722, sound: 'roar', msg: '竜化！' },
    trait: 'うろこの守り：被ダメージ -10%',
    dmgTaken: 0.9, breakMul: 1.2,
    look: { armorColor: 0xbf360c, swordColor: 0xffab91, swordLen: 0.6, cape: 0x8d6e63, weapon: 'fist' },
  },
  jester: {
    name: '道化師', role: '運まかせ', color: '#ffeb3b',
    power: 0.96, support: 0.45, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 22, mult: 0.8, color: 0xffeb3b, size: 0.3, range: 22, wobble: true },
    q: { id: 'jugglebomb', kind: 'shots', name: 'ジャグリング爆弾', desc: '右回りに回る3つの玉が飛んでいく（1つずつ当たって爆発）', cd: 6, count: 3, orbit: { r: 0.6, w: 9 }, colors: [0xffeb3b, 0xff5252, 0x40c4ff], speed: 16, mult: 1.2, size: 0.35, range: 14, explode: 2.4, color: 0xffeb3b },
    e: { id: 'trick', kind: 'random', name: '手品', desc: '何が起きるかはお楽しみ（攻撃・強化・回復のどれか）', cd: 7, pool: [
      { id: 'doves', name: 'ハトの群れ', kind: 'shots', count: 3, spread: 0.4, waves: 3, every: 0.18, speed: 22, mult: 0.62, size: 0.25, range: 18, color: 0xffffff },
      { id: 'bigbang', name: '大爆発', kind: 'burst', anim: 'cast', mult: 2.5, radius: 4.5, color: 0xff7043, melee: false },
      { id: 'kusudama', name: 'くす玉', kind: 'teamheal', radius: 8, amount: 0.25, color: 0xfff59d },
      { name: '元気が出るラッパ', kind: 'teambuff', radius: 8, buff: 'trick', dur: 8, vals: { atkMul: 1.2 }, color: 0xffeb3b },
    ] },
    r: { id: 'grandshow', kind: 'random', name: '大道芸', desc: '大技がランダムに出る（流星群・全員強化・大旋風のどれか）', pool: [
      { id: 'meteorshower', name: '流星群', kind: 'zone', zone: 'strike', at: 'aim', dist: 9, count: 6, scatter: 3.5, radius: 3, dur: 1.1, mult: 3, color: 0xb39ddb },
      { id: 'ovation', name: '拍手喝采（全員 攻撃 +40%）', kind: 'teambuff', buff: 'show', dur: 10, vals: { atkMul: 1.4 }, color: 0xffeb3b },
      { id: 'firewhirl', name: '大旋風', kind: 'burst', ticks: 6, every: 0.15, mult: 1.4, radius: 4.5, color: 0xff7043 },
    ] },
    trait: '15% の確率で攻撃のダメージが2倍',
    luckyChance: 0.15, breakMul: 1,
    look: { armorColor: 0x7b1fa2, swordColor: 0xffeb3b, swordLen: 0.6, cape: 0xffeb3b, weapon: 'flask', hat: 0x7b1fa2 },
  },
  paladin: {
    name: '聖騎士', role: '守りのオーラ', color: '#ffe082',
    healer: true, // 回復ができる：ピンチの味方が赤く光って見える
    power: 0.95, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.4, hit: 0.14, mult: 1.1 }, { dur: 0.4, hit: 0.14, mult: 1.15 }, { dur: 0.55, hit: 0.22, mult: 1.8 }], range: 2.7, arc: 2.3, heavyBonus: 0.3 },
    q: { id: 'holysmite', kind: 'burst', name: '聖撃', desc: '剣を振りかぶり、聖なる力をまとった縦斬りで周りを打つ', cd: 6, windup: 0.15, anim: 'cast', mult: 1.8, radius: 3.8, color: 0xffe082 },
    e: { id: 'consecrate', kind: 'zone', zone: 'field', name: '聖別', desc: '足元を6秒間 聖地にする（敵に継続ダメージ・中の味方は毎秒少し回復）', cd: 12, radius: 5, dur: 6, every: 0.5, mult: 0.5, heal: 0.01, color: 0xffe082 },
    r: { id: 'divineshield', kind: 'teambuff', name: '神の盾', desc: '周囲12mの味方の被ダメージ -50%（6秒）', radius: 12, buff: 'divine', dur: 6, vals: { dmgMul: 0.5 }, color: 0xffd54f, msg: '神の盾！ 被ダメージ半減' },
    trait: '周囲6mの味方の被ダメージ -10%',
    breakMul: 1.3,
    look: { armorColor: 0xfafafa, swordColor: 0xffd54f, swordLen: 1.0, cape: 0x1565c0, weapon: 'mace', bigShield: true },
  },
  gunslinger: {
    name: '拳銃使い', role: '速射', color: '#ffcc80',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.18, speed: 40, mult: 0.45, color: 0xffcc80, size: 0.16, range: 26 },
    q: { id: 'fanning', kind: 'shots', name: 'ファニング', desc: '0.6秒で6連射', cd: 6, count: 6, every: 0.1, jitter: 0.12, speed: 40, mult: 0.75, size: 0.18, range: 26, color: 0xffcc80 },
    e: { id: 'roll', kind: 'selfbuff', name: 'ローリング', desc: '転がって回避し（回避と同じ移動）、0.6秒 無敵・5秒間 会心率 +30%', cd: 8, move: true, buff: 'roll', dur: 5, vals: { critAdd: 0.3 }, invuln: 0.6, color: 0xffcc80, sound: 'dodge' },
    r: { id: 'deadeye', kind: 'shots', name: 'デッドアイ', desc: '一番近いボスへ自動で狙う6連射（必ず当たる向き。着弾で小さく爆ぜる）', aim: true, pop: true, count: 6, every: 0.12, speed: 50, mult: 1.6, size: 0.22, range: 40, pierce: true, color: 0xffab40 },
    trait: '移動しながらでも撃ちやすい速射。会心率 +5%',
    critBonus: 0.05, breakMul: 1,
    look: { armorColor: 0x6d4c41, swordColor: 0x424242, swordLen: 0.6, cape: 0x8d6e63, weapon: 'gun' },
  },
  chainer: {
    name: '鎖鎌使い', role: '飛びつき', color: '#90a4ae',
    power: 1.09, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.3, hit: 0.1, mult: 0.95 }, { dur: 0.3, hit: 0.1, mult: 1.0 }, { dur: 0.48, hit: 0.18, mult: 1.6 }], range: 3.2, arc: 2.2, heavyBonus: 0.4 },
    q: { id: 'grapple', kind: 'dash', name: '鎖の飛びつき', desc: '一番近いボスへ鎖を飛ばし、一気に飛びつきながら斬る（最大14m・無敵）', cd: 7, toBoss: true, dist: 14, time: 0.3, mult: 1.8, width: 1.5, color: 0x90a4ae },
    e: { id: 'chainbind', kind: 'debuff', name: '鎖縛り', desc: 'ボスを鎖で縛り、5秒間 動きを鈍らせる', cd: 14, color: 0x90a4ae, debuffs: [{ name: 'slow', dur: 5, mul: 0.65 }] },
    r: { id: 'chainstorm', kind: 'burst', name: '鎖嵐', desc: '鎖鎌を振り回して周りを8回切り刻む', ticks: 8, every: 0.12, mult: 1.0, radius: 5, color: 0xb0bec5 },
    trait: 'ブレイク値 1.4倍',
    breakMul: 1.4,
    look: { armorColor: 0x455a64, swordColor: 0xcfd8dc, swordLen: 0.8, cape: 0x263238, weapon: 'scythe' },
  },
  darkknight: {
    name: '暗黒騎士', role: 'HP を削って攻める', color: '#880e4f',
    power: 1.04, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.42, hit: 0.15, mult: 1.2 }, { dur: 0.42, hit: 0.15, mult: 1.25 }, { dur: 0.6, hit: 0.24, mult: 2.0 }], range: 2.9, arc: 2.4, heavyBonus: 0.4 },
    q: { id: 'darkblade', kind: 'cone', name: '暗黒剣', desc: 'HP を 8% 払って、前方に強烈な闇の斬撃', cd: 5, hpCost: 0.08, mult: 2.8, range: 4.5, arc: 1.8, color: 0x880e4f },
    e: { id: 'darkveil', kind: 'selfbuff', name: '闇の衣', desc: 'HP を 5% 払って、5秒間 被ダメージ -40%', cd: 12, hpCost: 0.05, buff: 'veil', dur: 5, vals: { dmgMul: 0.6 }, color: 0x4a148c },
    r: { id: 'darkrelease', kind: 'burst', name: '暗黒解放', desc: 'HP を 20% 払い、剣を掲げて周りに闇の雷を3回降らせる', hpCost: 0.2, windup: 0.35, anim: 'cast', ticks: 3, every: 0.25, mult: 2.6, radius: 5, color: 0x880e4f },
    trait: 'HP を払うと、払った分だけ必殺ゲージが溜まる',
    hpCostGauge: 0.8, breakMul: 1.2,
    look: { armorColor: 0x212121, swordColor: 0x880e4f, swordLen: 1.1, cape: 0x4a148c, weapon: 'sword' },
  },
  shaman: {
    name: '祈祷師', role: 'トーテム', color: '#aed581',
    healer: true, // 回復ができる：ピンチの味方が赤く光って見える
    power: 1.36, support: 0.43, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.55, speed: 18, mult: 0.75, color: 0xaed581, size: 0.3, range: 22 },
    q: { id: 'wartotem', kind: 'zone', zone: 'totem', name: '戦いのトーテム', desc: 'そばの味方の攻撃力 +20% のトーテムを12秒置く', cd: 13, radius: 7, dur: 12, color: 0xff7043, buff: { name: 'wartotem', vals: { atkMul: 1.2 } } },
    e: { id: 'healtotem', kind: 'zone', zone: 'totem', name: '癒しのトーテム', desc: 'そばの味方が毎秒 HP 3% 回復するトーテムを10秒置く', cd: 14, radius: 7, dur: 10, color: 0x69f0ae, buff: { name: 'healtotem', vals: { regen: 0.03 } } },
    r: { id: 'spirittotem', kind: 'zone', zone: 'totem', name: '祖霊のトーテム', desc: 'そばの味方の攻撃力 +30%・被ダメ -30%・移動 +15% のトーテムを12秒置く', radius: 8, dur: 12, color: 0xffd54f, buff: { name: 'spirittotem', vals: { atkMul: 1.3, dmgMul: 0.7, speedMul: 1.15 } } },
    trait: '周囲8mの仲間の必殺ゲージが少しずつ溜まる',
    breakMul: 1,
    look: { armorColor: 0x558b2f, swordColor: 0xaed581, swordLen: 0.9, cape: 0x8d6e63, weapon: 'staff', hat: 0x33691e },
  },
  whip: {
    name: '鞭使い', role: '中距離の近接', color: '#d7ccc8',
    power: 1.18, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    // 6m 届くが細い
    basic: { type: 'melee', combo: [{ dur: 0.34, hit: 0.13, mult: 0.9 }, { dur: 0.34, hit: 0.13, mult: 0.95 }, { dur: 0.5, hit: 0.2, mult: 1.5 }], range: 6, arc: 1.0, heavyBonus: 0.5 },
    q: { id: 'lash', kind: 'cone', name: '薙ぎ打ち', desc: '鞭を大きく振って前方7mを薙ぐ', cd: 5, mult: 1.6, range: 7, arc: 2.2, color: 0xd7ccc8 },
    e: { id: 'whipcrack', kind: 'cone', name: '打ち据え', desc: '一点に鋭く打ち込む（ブレイク大）', cd: 6, mult: 2.4, range: 7, arc: 0.6, brkMul: 3, color: 0xffffff },
    r: { id: 'whiptornado', kind: 'burst', name: '鞭の竜巻', desc: '鞭を振り回して周り6mを8回打つ', ticks: 8, every: 0.13, mult: 0.9, radius: 6, color: 0xd7ccc8 },
    trait: '当てるたびに足が速くなる（1発 +5%、最大 +30%、2秒）',
    whipSpeed: { per: 0.05, max: 6 }, breakMul: 0.9,
    look: { armorColor: 0x6d4c41, swordColor: 0x8d6e63, swordLen: 1.4, cape: 0x3e2723, weapon: 'spear' },
  },

  // ================= 追加の16職（クセの強い職業） =================
  shifter: {
    name: '変化師', role: '30秒ごとに別の職業に', color: '#e1bee7',
    power: 2.19, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 22, mult: 0.85, color: 0xe1bee7, size: 0.3, range: 22, wobble: true },
    q: { id: 'morphshot', kind: 'random', name: '変化の術', desc: '何かの職業の技をひとつ借りて使う', cd: 6, pool: [
      { name: '炎の扇', kind: 'cone', mult: 1.6, range: 5, arc: 1.4, color: 0xff7043, melee: false },
      { name: '氷の礫', kind: 'shots', count: 5, spread: 0.18, speed: 24, mult: 0.8, size: 0.26, range: 20, color: 0x80deea },
      { name: '回転斬り', kind: 'burst', mult: 1.6, radius: 3.8, color: 0xe1bee7 },
    ] },
    e: { id: 'morphstep', kind: 'dash', name: '変化歩法', desc: '姿を揺らがせて5m すり抜ける（無敵）', cd: 5, mult: 1.2, dist: 5, time: 0.2, width: 1.3, color: 0xe1bee7 },
    r: { id: 'morphburst', kind: 'burst', name: '変化爆発', desc: '周りに不安定な魔力を4回はじけさせる', ticks: 4, every: 0.2, mult: 1.6, radius: 4.5, color: 0xce93d8, melee: false },
    trait: '30秒ごとにランダムな別の職業に変身する（HP の割合と必殺ゲージは引き継ぐ）',
    shiftEvery: 30, breakMul: 1,
    look: { armorColor: 0x6a1b9a, swordColor: 0xe1bee7, swordLen: 0.9, cape: 0xf3e5f5, weapon: 'staff', hat: 0x4a148c },
  },
  gambler: {
    name: 'ギャンブラー', role: '一か八か', color: '#ffd740',
    power: 1.05, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 26, mult: 0.85, color: 0xffd740, size: 0.24, range: 24 },
    q: { id: 'dice', kind: 'random', name: 'サイコロ', desc: '出目で威力が変わる攻撃（1〜6）', cd: 5, pool: [
      { name: '1の目（しょぼい）', kind: 'shots', speed: 24, mult: 0.4, size: 0.2, range: 20, color: 0x9e9e9e },
      { name: '2の目', kind: 'shots', speed: 26, mult: 1.0, size: 0.25, range: 22, color: 0xffd740 },
      { name: '3の目', kind: 'shots', count: 3, spread: 0.15, speed: 26, mult: 0.9, size: 0.25, range: 22, color: 0xffd740 },
      { name: '4の目', kind: 'cone', mult: 2.0, range: 5, arc: 1.4, color: 0xffd740, melee: false },
      { name: '5の目', kind: 'burst', mult: 2.4, radius: 4.5, color: 0xffd740, melee: false },
      { name: '6の目（大当たり！）', kind: 'shots', speed: 30, mult: 5, size: 0.6, range: 26, pierce: true, color: 0xffab00 },
    ] },
    e: { id: 'cardtrick', kind: 'random', name: 'カード占い', desc: '引いたカードで自分に良いことか悪いことが起きる', cd: 10, pool: [
      { name: '攻撃アップ', kind: 'selfbuff', buff: 'luck', dur: 8, vals: { atkMul: 1.4 }, color: 0xffd740 },
      { name: '無敵', kind: 'selfbuff', buff: 'luck', dur: 2, vals: {}, invuln: 2, color: 0xffffff },
      { name: '会心アップ', kind: 'selfbuff', buff: 'luck', dur: 8, vals: { critAdd: 0.5 }, color: 0xffab00 },
      { name: 'ハズレ（HP -15%）', kind: 'selfhurt', frac: 0.15 },
    ] },
    r: { id: 'allin', kind: 'random', name: 'オールイン', desc: '50% で超大技、50% で自分が大ダメージ', pool: [
      { name: '大勝ち！', kind: 'burst', ticks: 5, every: 0.15, mult: 3, radius: 6, color: 0xffd740, melee: false },
      { name: '大負け……（HP -40%）', kind: 'selfhurt', frac: 0.4 },
    ] },
    trait: 'ツキがある：会心率 +15%',
    critBonus: 0.15, breakMul: 1,
    look: { armorColor: 0x1b5e20, swordColor: 0xffd740, swordLen: 0.6, cape: 0xb71c1c, weapon: 'gun', hat: 0x212121 },
  },
  bomber: {
    name: '爆弾魔', role: '全部爆発', color: '#ff9e80',
    power: 1.06, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.75, speed: 16, mult: 0.8, color: 0x424242, size: 0.32, range: 16, explode: 2.6 },
    q: { id: 'clusterbomb', kind: 'shots', name: '散弾爆弾', desc: '爆弾を4つばらまく', cd: 6, count: 4, spread: 0.3, speed: 15, mult: 1.1, size: 0.32, range: 14, explode: 2.6, color: 0x424242 },
    e: { id: 'timebomb', kind: 'zone', zone: 'strike', name: '時限爆弾', desc: '足元に2秒後に大爆発する爆弾を置く', cd: 8, radius: 5, dur: 2, mult: 4, color: 0xff3d00 },
    r: { id: 'selfdestruct', kind: 'burst', name: '自爆', desc: '周りを3回大爆発させる。終わると自分の HP が 1 になる', ticks: 3, every: 0.25, mult: 4, radius: 6.5, color: 0xff3d00, melee: false, selfHpTo: 1 },
    trait: '爆風に強い：被ダメージ -10%',
    dmgTaken: 0.9, breakMul: 1,
    look: { armorColor: 0x424242, swordColor: 0xff9e80, swordLen: 0.6, cape: 0xbf360c, weapon: 'flask' },
  },
  souleater: {
    name: '魂喰い', role: '当てるほど永久に強く', color: '#80cbc4',
    power: 0.9, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.3, hit: 0.1, mult: 0.9 }, { dur: 0.3, hit: 0.1, mult: 0.95 }, { dur: 0.46, hit: 0.18, mult: 1.5 }], range: 2.8, arc: 2.2, heavyBonus: 0.3 },
    q: { id: 'soulrend', kind: 'cone', name: '魂裂き', desc: '前方を裂いて魂を奪う', cd: 5, mult: 1.6, range: 4, arc: 1.6, color: 0x80cbc4 },
    e: { id: 'soulstep', kind: 'dash', name: '魂渡り', desc: '5m すり抜けながら斬る（無敵）', cd: 6, mult: 1.4, dist: 5, time: 0.2, width: 1.4, color: 0x80cbc4 },
    r: { id: 'soulfeast', kind: 'burst', name: '魂の饗宴', desc: '周りを6回刈り取る（魂がたまるほど強い）', ticks: 6, every: 0.13, mult: 1.2, radius: 4.5, color: 0x26a69a },
    trait: '当てるたびに攻撃力が永続で +0.6%（最大 +60%）。倒れると0に戻る',
    soulPer: 0.006, soulMax: 0.6, breakMul: 1,
    look: { armorColor: 0x004d40, swordColor: 0x80cbc4, swordLen: 1.0, cape: 0x00251a, weapon: 'scythe', mask: true },
  },
  mirror: {
    name: '鏡術師', role: '弾を消す', color: '#e0f7fa',
    power: 1.22, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 24, mult: 0.8, color: 0xe0f7fa, size: 0.28, range: 22 },
    q: { id: 'mirrorshard', kind: 'shots', name: '鏡の破片', desc: '鏡の破片を扇に5枚飛ばす（貫通）', cd: 5, count: 5, spread: 0.2, speed: 28, mult: 0.8, size: 0.24, range: 20, pierce: true, color: 0xe0f7fa },
    e: { id: 'mirrorwall', kind: 'zone', zone: 'aegis', name: '鏡の盾', desc: '足元に3秒間の鏡の盾。入ってきた敵弾を消し、中の味方の被ダメ半減', cd: 9, radius: 3.6, dur: 3, color: 0xe0f7fa },
    r: { id: 'mirrorworld', kind: 'zone', zone: 'aegis', name: '鏡の世界', desc: '大きな鏡の結界を8秒張る（敵弾を消す・被ダメ半減）', radius: 8, dur: 8, color: 0xb2ebf2 },
    trait: '回避の無敵時間 +0.15秒',
    dodgeInvulnBonus: 0.15, breakMul: 1,
    look: { armorColor: 0x80deea, swordColor: 0xe0f7fa, swordLen: 0.9, cape: 0x006064, weapon: 'staff', hat: 0x00838f },
  },
  gravity: {
    name: '重力術師', role: 'ボスを引き寄せる', color: '#9fa8da',
    power: 0.84, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.55, speed: 18, mult: 0.85, color: 0x9fa8da, size: 0.34, range: 22 },
    q: { id: 'gravwell', kind: 'zone', zone: 'field', name: '重力井戸', desc: '狙った場所にボスを最大6m 引き寄せ、4秒間 継続ダメージ', cd: 10, at: 'aim', dist: 7, radius: 4, dur: 4, every: 0.4, mult: 0.5, color: 0x5c6bc0, pullBoss: 6 },
    e: { id: 'graviton', kind: 'debuff', name: '重圧', desc: 'ボスを重くして5秒間 鈍らせる', cd: 12, color: 0x5c6bc0, debuffs: [{ name: 'slow', dur: 5, mul: 0.6 }] },
    r: { id: 'blackhole', kind: 'zone', zone: 'field', name: 'ブラックホール', desc: '狙った場所にボスを最大12m 引き寄せ、6秒間 強い継続ダメージ', at: 'aim', dist: 8, radius: 6, dur: 6, every: 0.3, mult: 0.9, color: 0x1a237e, pullBoss: 12 },
    trait: 'ブレイク値 1.3倍（重さで押しつぶす）',
    breakMul: 1.3,
    look: { armorColor: 0x1a237e, swordColor: 0x9fa8da, swordLen: 0.9, cape: 0x000051, weapon: 'staff', hat: 0x1a237e },
  },
  speedster: {
    name: '韋駄天', role: '止まると弱い', color: '#ffff8d',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.18, hit: 0.06, mult: 0.7 }, { dur: 0.18, hit: 0.06, mult: 0.7 }, { dur: 0.3, hit: 0.1, mult: 1.1 }], range: 2.4, arc: 2.2, heavyBonus: 0.2 },
    q: { id: 'sonicdash', kind: 'dash', name: '音速突破', desc: '10m を一瞬で駆け抜けて斬る（無敵）', cd: 4, mult: 1.5, dist: 10, time: 0.18, width: 1.4, color: 0xffff8d },
    e: { id: 'afterimage', kind: 'selfbuff', name: '残像', desc: '6秒間 さらに足が速くなり、被ダメージ -30%', cd: 12, buff: 'afterimage', dur: 6, vals: { speedMul: 1.25, dmgMul: 0.7 }, color: 0xffff8d, sound: 'dodge' },
    r: { id: 'lightspeed', kind: 'burst', name: '光速乱舞', desc: '周りを10回切り刻む', ticks: 10, every: 0.08, mult: 0.9, radius: 4, color: 0xffff00 },
    trait: '動いている間は攻撃力 +30%（そのかわり HP が低い）',
    moveAtk: 1.3, breakMul: 0.9,
    look: { armorColor: 0xf9a825, swordColor: 0xffff8d, swordLen: 0.6, cape: 0xffeb3b, weapon: 'dagger' },
  },
  cursed: {
    name: '呪いの騎士', role: 'HP が減り続ける', color: '#b71c1c',
    power: 0.93, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.38, hit: 0.13, mult: 1.2 }, { dur: 0.38, hit: 0.13, mult: 1.25 }, { dur: 0.55, hit: 0.22, mult: 2.0 }], range: 2.9, arc: 2.4, heavyBonus: 0.4 },
    q: { id: 'cursedblade', kind: 'cone', name: '呪剣', desc: '前方を斬り、与えたダメージの25% を吸う', cd: 5, mult: 2.0, range: 4, arc: 1.8, color: 0xb71c1c, lifesteal: 0.25 },
    e: { id: 'bloodpact', kind: 'selfbuff', name: '血の契約', desc: '8秒間 攻撃力 +40%（HP の減りは止まらない）', cd: 14, buff: 'pact', dur: 8, vals: { atkMul: 1.4 }, color: 0xb71c1c, sound: 'roar' },
    r: { id: 'cursestorm', kind: 'burst', name: '呪いの嵐', desc: '周りを5回 呪いで斬り刻む', ticks: 5, every: 0.18, mult: 2, radius: 4.8, color: 0x880e4f },
    trait: 'HP が毎秒 1.2% 減り続ける（1 は残る）が、攻撃力が高く、与ダメの15% を吸う',
    hpDrain: 0.012, lifesteal: 0.15, breakMul: 1.2,
    look: { armorColor: 0x311b1b, swordColor: 0xb71c1c, swordLen: 1.1, cape: 0x4a0000, weapon: 'sword' },
  },
  desperado: {
    name: '背水の剣士', role: '仲間が倒れるほど強い', color: '#ff8a80',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.32, hit: 0.11, mult: 1.0 }, { dur: 0.32, hit: 0.11, mult: 1.05 }, { dur: 0.5, hit: 0.2, mult: 1.7 }], range: 2.8, arc: 2.2, heavyBonus: 0.4 },
    q: { id: 'lastcut', kind: 'cone', name: '捨て身斬り', desc: '前方を大きく斬る', cd: 6, mult: 2.2, range: 4, arc: 1.6, color: 0xff8a80 },
    e: { id: 'rally', kind: 'teamheal', name: '奮起', desc: '周囲8mの味方を 20% 回復', cd: 14, radius: 8, amount: 0.2, color: 0xff8a80 },
    r: { id: 'nowornever', kind: 'burst', name: '乾坤一擲', desc: '周りに渾身の一撃を3回', ticks: 3, every: 0.25, mult: 3.2, radius: 4.5, color: 0xff5252 },
    trait: '倒れている仲間1人につき攻撃力 +35%。自分の HP が 30% 未満ならさらに +30%',
    lastStand: 0.35, breakMul: 1.1,
    look: { armorColor: 0x8d6e63, swordColor: 0xff8a80, swordLen: 1.0, cape: 0xd32f2f, weapon: 'sword' },
  },
  cook: {
    healer: true,
    name: '料理人', role: 'ごはんで支援', color: '#ffcc80',
    power: 1, support: 1.66, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 18, mult: 0.75, color: 0xffcc80, size: 0.3, range: 20, wobble: true },
    q: { id: 'picnic', kind: 'zone', zone: 'field', name: 'お弁当', desc: '足元に8秒間の食事の場。中の味方は毎秒 HP 3% 回復', cd: 14, radius: 5, dur: 8, every: 0.5, heal: 0.015, mult: 0, color: 0xffcc80 },
    e: { id: 'spicy', kind: 'teambuff', name: '激辛カレー', desc: '周囲9mの味方の攻撃力 +25%・移動 +10%（10秒）', cd: 16, radius: 9, buff: 'spicy', dur: 10, vals: { atkMul: 1.25, speedMul: 1.1 }, color: 0xff7043, msg: '激辛カレー！ 攻撃力アップ' },
    r: { id: 'feast', kind: 'teambuff', name: 'ごちそう', desc: '全員 12秒間 毎秒 HP 4% 回復・被ダメ -20%', buff: 'feast', dur: 12, vals: { regen: 0.04, dmgMul: 0.8 }, color: 0xffcc80, msg: 'ごちそう！ 回復し続ける' },
    trait: 'つまみ食い：自分は毎秒 HP 0.5% 回復',
    selfRegen: 0.005, breakMul: 1,
    look: { armorColor: 0xfafafa, swordColor: 0x9e9e9e, swordLen: 0.6, cape: 0xffffff, weapon: 'dagger', hat: 0xfafafa },
  },
  drunkard: {
    name: '酔拳家', role: 'ふらふら回避', color: '#ffab91',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.3, hit: 0.1, mult: 0.9 }, { dur: 0.36, hit: 0.14, mult: 1.1 }, { dur: 0.3, hit: 0.1, mult: 0.9 }, { dur: 0.5, hit: 0.2, mult: 1.7 }], range: 2.4, arc: 2.4, heavyBonus: 0.3 },
    q: { id: 'drunkpalm', kind: 'random', name: '酔いどれ拳', desc: 'ふらつきながら何かの技が出る', cd: 5, pool: [
      { name: '千鳥足', kind: 'dash', mult: 1.4, dist: 5, time: 0.25, width: 1.4, color: 0xffab91 },
      { name: 'ぐるぐる', kind: 'burst', mult: 1.8, radius: 3.6, color: 0xffab91 },
      { name: 'しゃっくり拳', kind: 'cone', mult: 2.2, range: 3.5, arc: 1.4, color: 0xffab91 },
    ] },
    e: { id: 'sake', kind: 'selfbuff', name: 'ひと口', desc: '6秒間 攻撃力 +30%・会心率 +20%', cd: 12, buff: 'sake', dur: 6, vals: { atkMul: 1.3, critAdd: 0.2 }, color: 0xffab91 },
    r: { id: 'drunkstorm', kind: 'burst', name: '酔八仙', desc: '周りを8回、予測不能に殴る', ticks: 8, every: 0.12, mult: 1.2, radius: 4, color: 0xff7043 },
    trait: '25% の確率で攻撃をふらりとかわす',
    evade: 0.25, breakMul: 1.1,
    look: { armorColor: 0xbf360c, swordColor: 0xffab91, swordLen: 0.5, cape: 0xff8a65, weapon: 'fist' },
  },
  sniper: {
    name: '狙撃手', role: '止まって撃つ', color: '#a5d6a7',
    power: 0.83, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    // 立ち止まって撃つと威力 3.2倍。動きながらだと弱い
    basic: { type: 'shot', cd: 0.8, speed: 60, mult: 0.7, color: 0xa5d6a7, size: 0.18, range: 45, pierce: true },
    q: { id: 'headshot', kind: 'shots', name: '狙撃', desc: '一番近いボスへ自動で狙う強力な1発', cd: 6, aim: true, speed: 70, mult: 4, size: 0.24, range: 50, pierce: true, color: 0xc8e6c9 },
    e: { id: 'camo', kind: 'selfbuff', name: '伏せ撃ち', desc: '6秒間 会心率 +40%・被ダメ -20%', cd: 12, buff: 'camo', dur: 6, vals: { critAdd: 0.4, dmgMul: 0.8 }, color: 0x558b2f },
    r: { id: 'railgun', kind: 'shots', name: '徹甲弾', desc: '一番近いボスへ巨大な貫通弾を3連射', aim: true, count: 3, every: 0.3, speed: 80, mult: 4.5, size: 0.4, range: 55, pierce: true, color: 0x76ff03 },
    trait: '立ち止まって撃つと通常攻撃の威力 3.2倍（動きながらだと弱い）',
    stillBonus: 3.2, breakMul: 1,
    look: { armorColor: 0x33691e, swordColor: 0x424242, swordLen: 1.2, cape: 0x1b5e20, weapon: 'gun' },
  },
  prophet: {
    name: '予言者', role: '少し先の一撃', color: '#fff9c4',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 20, mult: 0.85, color: 0xfff9c4, size: 0.3, range: 22 },
    q: { id: 'prophecy', kind: 'zone', zone: 'strike', name: '予言', desc: '一番近いボスの足元に、2.5秒後に大きな一撃が落ちる', cd: 8, at: 'boss', dist: 8, radius: 4.5, dur: 2.5, mult: 5, color: 0xfff176 },
    e: { id: 'foresight', kind: 'selfbuff', name: '未来視', desc: '4秒間 足が速くなり、被ダメージ -40%', cd: 12, buff: 'foresight', dur: 4, vals: { speedMul: 1.2, dmgMul: 0.6 }, color: 0xfff9c4 },
    r: { id: 'doomsday', kind: 'zone', zone: 'strike', name: '終末の予言', desc: 'ボスの周りに4秒後、巨大な一撃を5つ落とす', at: 'boss', dist: 8, count: 5, scatter: 3, radius: 4, dur: 4, mult: 5, color: 0xffee58 },
    trait: 'ブレイク値 1.2倍',
    breakMul: 1.2,
    look: { armorColor: 0xf9a825, swordColor: 0xfff9c4, swordLen: 0.9, cape: 0xfff59d, weapon: 'staff', hat: 0xf57f17 },
  },
  oni: {
    name: '鬼', role: '回避できない巨体', color: '#ef5350',
    power: 0.67, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.55, hit: 0.22, mult: 1.6 }, { dur: 0.75, hit: 0.32, mult: 2.6 }], range: 3.2, arc: 2.6, heavyBonus: 0.5 },
    q: { id: 'onismash', kind: 'burst', name: '鬼の金棒', desc: '金棒で周りを叩き潰す', cd: 6, mult: 2.6, radius: 4.2, color: 0xef5350, brkMul: 1.5 },
    e: { id: 'oniroar', kind: 'selfbuff', name: '鬼の雄叫び', desc: '6秒間 被ダメージ -40%', cd: 12, buff: 'oniroar', dur: 6, vals: { dmgMul: 0.6 }, color: 0xef5350, sound: 'roar' },
    r: { id: 'onirampage', kind: 'burst', name: '鬼の大暴れ', desc: '周りを4回 叩き潰す', ticks: 4, every: 0.3, mult: 3.2, radius: 5, color: 0xd50000, brkMul: 1.5 },
    trait: '回避ができない。そのかわり HP がとても多く、被ダメージ -15%・ブレイク値 1.5倍',
    noDodge: true, dmgTaken: 0.85, breakMul: 1.5,
    look: { armorColor: 0xc62828, swordColor: 0x424242, swordLen: 1.0, cape: 0x212121, weapon: 'mace' },
  },
  ghost: {
    name: '幽霊', role: 'すり抜ける', color: '#eceff1',
    power: 1.17, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 20, mult: 0.85, color: 0xeceff1, size: 0.3, range: 22, wobble: true },
    q: { id: 'haunt', kind: 'cone', name: '憑依', desc: '前方の敵に取り憑いて継続ダメージ', cd: 6, mult: 1.0, range: 5, arc: 1.4, color: 0xeceff1, melee: false, dot: { mult: 0.35, every: 0.5, dur: 5 } },
    e: { id: 'phase', kind: 'selfbuff', name: '透過', desc: '2秒間 完全に無敵', cd: 12, buff: 'phase', dur: 2, vals: {}, invuln: 2, color: 0xeceff1, sound: 'dodge' },
    r: { id: 'poltergeist', kind: 'selfbuff', name: 'ポルターガイスト', desc: '自分の周りで爆発を起こし、4秒間 敵に気づかれず無敵になる', buff: 'unseen', dur: 4, vals: {}, invuln: 4, unseen: 4, strike: { mult: 3, radius: 5.5 }, color: 0xb0bec5, sound: 'slam' },
    trait: '50% の確率で攻撃がすり抜ける（そのかわり HP がとても低い）',
    evade: 0.5, breakMul: 1,
    look: { armorColor: 0xb0bec5, swordColor: 0xeceff1, swordLen: 0.6, cape: 0xeceff1, weapon: 'staff', hat: 0xcfd8dc },
  },
  twins: {
    name: '双子', role: 'いつも2発', color: '#f48fb1',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    // 通常攻撃が2発同時（1発は弱め）
    basic: { type: 'shot', cd: 0.4, speed: 26, mult: 0.55, color: 0xf48fb1, size: 0.24, range: 22, count: 2, spread: 0.1 },
    q: { id: 'twinshot', kind: 'shots', name: 'ふたり撃ち', desc: '左右から3発ずつ撃つ', cd: 5, count: 6, spread: 0.12, speed: 28, mult: 0.7, size: 0.24, range: 22, color: 0xf48fb1 },
    e: { id: 'swap', kind: 'dash', name: '入れ替わり', desc: '片割れと入れ替わるように5m 跳ぶ（無敵）', cd: 6, mult: 1.0, dist: 5, time: 0.2, width: 1.2, color: 0x90caf9 },
    r: { id: 'twinstorm', kind: 'shots', name: 'ふたりの嵐', desc: '2人がかりで前方へ弾を20発撃ち込む', count: 20, spread: 0.04, colors: [0xf48fb1, 0x90caf9], speed: 24, mult: 0.8, size: 0.26, range: 22, color: 0xf48fb1 },
    trait: '通常攻撃は2発同時（双子の片割れも撃つ）',
    breakMul: 1,
    look: { armorColor: 0xad1457, swordColor: 0x90caf9, swordLen: 0.6, cape: 0x1565c0, weapon: 'gun' },
  },

  // ================= 追加の16職（今までの職業と仕組みがかぶらないもの） =================
  machinegunner: {
    name: 'マシンガンナー', role: '超連射', color: '#bdbdbd',
    power: 0.52, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.08, speed: 38, mult: 0.28, color: 0xffe082, size: 0.12, range: 26, jitter: 0.12 },
    q: { id: 'suppress', kind: 'shots', name: '制圧射撃', desc: '2秒間 弾をばらまきながらボスを鈍らせる', cd: 9, count: 24, every: 0.08, jitter: 0.25, speed: 38, mult: 0.4, size: 0.13, range: 26, color: 0xffe082, debuff: { name: 'slow', dur: 3, mul: 0.75 } },
    e: { id: 'reloadroll', kind: 'selfbuff', move: true, name: '弾込め回避', desc: '転がって回避し（回避と同じ移動）、0.6秒 無敵・6秒間 攻撃力 +25%', cd: 9, buff: 'reload', dur: 6, vals: { atkMul: 1.25 }, invuln: 0.6, color: 0xbdbdbd, sound: 'dodge' },
    r: { id: 'gatling', kind: 'shots', name: 'ガトリング', desc: '4秒間 一番近いボスへ大量の弾を撃ち込む', aim: true, count: 50, every: 0.08, jitter: 0.15, speed: 42, mult: 0.55, size: 0.15, range: 30, color: 0xffab40 },
    trait: '撃ちっぱなしの超連射（1発は軽い）',
    breakMul: 1,
    look: { armorColor: 0x546e7a, swordColor: 0x424242, swordLen: 1.0, cape: 0x37474f, weapon: 'gun' },
  },
  flamer: {
    name: '火炎放射兵', role: '近距離で焼く', color: '#ff7043',
    power: 0.96, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    // 射程が短く、当たると燃える（継続ダメージ）
    basic: { type: 'shot', cd: 0.12, speed: 16, mult: 0.3, color: 0xff7043, size: 0.35, range: 8, pierce: true, jitter: 0.25, dot: { mult: 0.12, every: 0.5, dur: 3 } },
    q: { id: 'napalm', kind: 'zone', zone: 'field', name: 'ナパーム', desc: '狙った場所を5秒間 燃やし続ける', cd: 8, at: 'aim', dist: 6, radius: 4, dur: 5, every: 0.3, mult: 0.5, color: 0xff5722 },
    e: { id: 'flameburst', kind: 'burst', name: '炎の噴射', desc: '周りに炎を噴き出して焼く', cd: 7, mult: 1.8, radius: 4.2, color: 0xff7043, melee: false },
    r: { id: 'inferno', kind: 'cone', name: '大火炎', desc: '前方8mを大きく焼き払い、燃やし続ける', mult: 3, range: 8, arc: 1.6, color: 0xff3d00, melee: false, sound: 'wave', dot: { mult: 0.5, every: 0.5, dur: 6 } },
    trait: '燃料タンク持ち：被ダメージ -10%',
    dmgTaken: 0.9, breakMul: 1,
    look: { armorColor: 0x6d4c41, swordColor: 0xff7043, swordLen: 0.9, cape: 0xbf360c, weapon: 'gun', mask: true },
  },
  rocketeer: {
    name: 'ロケット兵', role: '爆発する重い弾', color: '#ffab91',
    power: 0.83, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 1.0, speed: 22, mult: 1.6, color: 0xff7043, size: 0.35, range: 30, explode: 2.8 },
    q: { id: 'multirocket', kind: 'shots', name: '多連装ロケット', desc: '爆発するロケットを6発ばらまく', cd: 8, count: 6, spread: 0.18, speed: 20, mult: 1.2, size: 0.3, range: 26, explode: 2.6, color: 0xff7043 },
    e: { id: 'rocketjump', kind: 'leap', name: 'ロケットジャンプ', desc: '足元を爆発させて跳び、着地点の周りを吹き飛ばす', cd: 8, dist: 7, time: 0.5, radius: 3.5, mult: 2, color: 0xff7043, height: 5 },
    r: { id: 'airstrike', kind: 'zone', zone: 'strike', name: '爆撃要請', desc: '一番近いボスの周りに1.5秒後 爆弾を8つ落とす', at: 'boss', dist: 8, count: 8, scatter: 4, radius: 3.5, dur: 1.5, mult: 3.2, color: 0xff3d00 },
    trait: 'ブレイク値 1.3倍（爆風）',
    breakMul: 1.3,
    look: { armorColor: 0x5d4037, swordColor: 0x2e7d32, swordLen: 1.1, cape: 0x33691e, weapon: 'gun' },
  },
  medic: {
    healer: true,
    name: '衛生兵', role: '回復（素早い）', color: '#ef9a9a',
    power: 1, support: 0.76, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.4, speed: 30, mult: 0.7, color: 0xffffff, size: 0.2, range: 24 },
    q: { id: 'firstaid', kind: 'teamheal', name: '救急キット', desc: '周囲6mの味方の HP を 30% 回復', cd: 7, radius: 6, amount: 0.3, color: 0xef9a9a },
    e: { id: 'stimpack', kind: 'teambuff', name: '興奮剤', desc: '周囲8mの味方を 6秒間 移動 +25%・毎秒 HP 2% 回復', cd: 12, radius: 8, buff: 'stim', dur: 6, vals: { speedMul: 1.25, regen: 0.02 }, color: 0xef9a9a, msg: '興奮剤：足が速くなり回復' },
    r: { id: 'fieldhospital', kind: 'zone', zone: 'field', name: '野戦病院', desc: '足元を10秒間 回復の場にする（毎秒 HP 6% 回復）', radius: 6, dur: 10, every: 0.5, heal: 0.03, mult: 0, color: 0xef9a9a },
    trait: '足が速い衛生兵',
    breakMul: 1,
    look: { armorColor: 0xeceff1, swordColor: 0xef5350, swordLen: 0.6, cape: 0xc62828, weapon: 'gun', hat: 0xeceff1 },
  },
  hammer: {
    name: '大槌使い', role: 'ブレイク特化', color: '#a1887f',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.6, hit: 0.26, mult: 1.8 }, { dur: 0.85, hit: 0.38, mult: 3.0 }], range: 3.2, arc: 2.4, heavyBonus: 0.5 },
    q: { id: 'quake', kind: 'burst', name: '地震', desc: '地面を叩いて周りを揺らす（ブレイク大）', cd: 7, mult: 2.4, radius: 4.8, color: 0xa1887f, brkMul: 2.5 },
    e: { id: 'hammerleap', kind: 'leap', name: '飛び叩き', desc: '跳んで狙った場所に叩きつける', cd: 9, dist: 6, time: 0.55, radius: 3.8, mult: 2.8, color: 0x8d6e63, brkMul: 2 },
    r: { id: 'meteorhammer', kind: 'burst', name: '隕石の槌', desc: '周りを3回 渾身の力で叩く（ブレイク特大）', ticks: 3, every: 0.35, mult: 4, radius: 5.2, color: 0x6d4c41, brkMul: 3 },
    trait: 'ブレイク値 2倍',
    breakMul: 2.0,
    look: { armorColor: 0x5d4037, swordColor: 0x757575, swordLen: 1.0, cape: 0x3e2723, weapon: 'mace' },
  },
  dualblade: {
    name: '双剣士', role: '高速6段コンボ', color: '#80deea',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.16, hit: 0.05, mult: 0.6 }, { dur: 0.16, hit: 0.05, mult: 0.6 }, { dur: 0.16, hit: 0.05, mult: 0.65 }, { dur: 0.16, hit: 0.05, mult: 0.65 }, { dur: 0.18, hit: 0.06, mult: 0.7 }, { dur: 0.34, hit: 0.12, mult: 1.4 }], range: 2.5, arc: 2.4, heavyBonus: 0.2 },
    q: { id: 'crosscut', kind: 'cone', name: '十字斬り', desc: '前方を十字に斬る', cd: 5, mult: 2.0, range: 3.6, arc: 1.6, color: 0x80deea },
    e: { id: 'spinrush', kind: 'dash', name: '回転突進', desc: '回りながら6m 突っ込む（無敵）', cd: 6, mult: 1.5, dist: 6, time: 0.22, width: 1.6, color: 0x80deea },
    r: { id: 'bladedance', kind: 'burst', name: '双刃乱舞', desc: '周りを12回 切り刻む', ticks: 12, every: 0.07, mult: 0.8, radius: 3.6, color: 0x4dd0e1 },
    trait: '必殺ゲージの溜まり方 1.2倍（手数が多い）',
    gaugeMul: 1.2, breakMul: 1,
    look: { armorColor: 0x006064, swordColor: 0x80deea, swordLen: 0.7, cape: 0x00838f, weapon: 'dagger' },
  },
  shielder: {
    name: '盾投げ士', role: '盾で守って投げる', color: '#90caf9',
    power: 1.12, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.7, speed: 22, mult: 1.1, color: 0x90caf9, size: 0.5, range: 14, pierce: true },
    q: { id: 'shieldrush', kind: 'dash', name: '盾の突撃', desc: '盾を構えて5m 突進（ブレイク大）', cd: 6, mult: 1.6, dist: 5, time: 0.25, width: 1.8, color: 0x90caf9, brkMul: 2.5 },
    e: { id: 'shieldwall', kind: 'selfbuff', name: '盾構え', desc: '3秒間 被ダメージ -60%', cd: 9, buff: 'shieldwall', dur: 3, vals: { dmgMul: 0.4, speedMul: 0.7 }, color: 0x90caf9 },
    r: { id: 'shieldstorm', kind: 'shots', name: '盾の嵐', desc: '盾を全方向に8枚 投げる（貫通）', count: 8, spread: 0.785, speed: 22, mult: 2, size: 0.55, range: 16, pierce: true, color: 0x64b5f6 },
    trait: '被ダメージ -15%',
    dmgTaken: 0.85, breakMul: 1.3,
    look: { armorColor: 0x1565c0, swordColor: 0x90caf9, swordLen: 0.6, cape: 0x0d47a1, weapon: 'mace', bigShield: true },
  },
  knifer: {
    name: 'ナイフ投げ', role: '3本同時投げ', color: '#cfd8dc',
    power: 0.74, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.38, speed: 32, mult: 0.45, color: 0xcfd8dc, size: 0.18, range: 20, count: 3, spread: 0.12 },
    q: { id: 'poisonknife', kind: 'shots', name: '毒ナイフ', desc: '当たると6秒間 毒で削るナイフを5本', cd: 7, count: 5, spread: 0.15, speed: 30, mult: 0.5, size: 0.2, range: 20, color: 0x9ccc65, dot: { mult: 0.25, every: 0.5, dur: 6 } },
    e: { id: 'backflip', kind: 'dash', name: 'バク転', desc: '後ろへ跳ねて間合いを取る（無敵）', cd: 5, mult: 0, dist: -5, time: 0.25, width: 0.1, color: 0xcfd8dc },
    r: { id: 'knifestorm', kind: 'zone', zone: 'field', name: 'ナイフの雨', desc: '一番近いボスの足元に4秒間 ナイフを降らせ続ける', at: 'boss', dist: 8, radius: 5, dur: 4, every: 0.2, mult: 0.7, color: 0xcfd8dc },
    trait: '会心率 +10%',
    critBonus: 0.1, breakMul: 1,
    look: { armorColor: 0x37474f, swordColor: 0xcfd8dc, swordLen: 0.5, cape: 0x263238, weapon: 'dagger' },
  },
  laser: {
    name: '光線術士', role: '一直線のビーム', color: '#e1f5fe',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 50, mult: 0.85, color: 0xe1f5fe, size: 0.18, range: 28, pierce: true },
    q: { id: 'ray', kind: 'beam', name: '光線', desc: '前方20m に光線を走らせる（即着弾・貫通）', cd: 5, len: 20, width: 1.6, mult: 2.2, color: 0xe1f5fe },
    e: { id: 'prism', kind: 'beam', name: 'プリズム', desc: '光線を扇状に3本', cd: 7, len: 16, width: 1.4, mult: 1.4, fan: 3, fanSpread: 0.3, color: 0xb3e5fc },
    r: { id: 'megaray', kind: 'beam', name: '極太レーザー', desc: '2秒間 前方24m を太い光線で焼き続ける', len: 24, width: 3, mult: 1.2, ticks: 10, every: 0.2, color: 0x40c4ff },
    trait: '光線は弾と違って一瞬で届く',
    breakMul: 1,
    look: { armorColor: 0x0277bd, swordColor: 0xe1f5fe, swordLen: 0.9, cape: 0x01579b, weapon: 'staff', hat: 0x0288d1 },
  },
  cryo: {
    name: '氷結術士', role: '当てるたびに鈍らせる', color: '#b3e5fc',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    // 当たったボスが少し鈍る
    basic: { type: 'shot', cd: 0.55, speed: 22, mult: 0.8, color: 0xb3e5fc, size: 0.3, range: 22, debuff: { name: 'slow', dur: 1.5, mul: 0.85 } },
    q: { id: 'frostnova', kind: 'burst', name: '凍てつく波', desc: '周りを凍らせる', cd: 7, mult: 1.8, radius: 4.5, color: 0xb3e5fc, melee: false },
    e: { id: 'icefield', kind: 'zone', zone: 'field', name: '氷原', desc: '狙った場所を6秒間 凍らせる（継続ダメージ）', cd: 10, at: 'aim', dist: 7, radius: 4.5, dur: 6, every: 0.4, mult: 0.45, color: 0x81d4fa },
    r: { id: 'absolutezero', kind: 'debuff', name: '絶対零度', desc: 'ボスを凍えさせ、8秒間 動きを大きく鈍らせ被ダメージ +20%', color: 0x81d4fa, debuffs: [{ name: 'slow', dur: 8, mul: 0.5 }, { name: 'vuln', dur: 8, mul: 1.2 }] },
    trait: '通常攻撃が当たるとボスが少し鈍る',
    breakMul: 1,
    look: { armorColor: 0x0277bd, swordColor: 0xb3e5fc, swordLen: 0.9, cape: 0xe1f5fe, weapon: 'staff', hat: 0x01579b },
  },
  asura: {
    name: '修羅', role: '受けるほど強い', color: '#ff5252',
    power: 0.53, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.3, hit: 0.1, mult: 1.0 }, { dur: 0.3, hit: 0.1, mult: 1.05 }, { dur: 0.48, hit: 0.18, mult: 1.7 }], range: 2.8, arc: 2.3, heavyBonus: 0.3 },
    q: { id: 'asurastrike', kind: 'cone', name: '修羅の一撃', desc: '前方を力いっぱい打つ', cd: 5, mult: 2.4, range: 3.8, arc: 1.4, color: 0xff5252 },
    e: { id: 'endure', kind: 'selfbuff', name: '耐え忍ぶ', desc: '5秒間 被ダメージ -50%', cd: 12, buff: 'endure', dur: 5, vals: { dmgMul: 0.5 }, color: 0xff5252 },
    r: { id: 'asurarage', kind: 'burst', name: '修羅の怒り', desc: '周りを6回 打ちのめす（怒りが溜まるほど強い）', ticks: 6, every: 0.15, mult: 1.6, radius: 4.4, color: 0xd50000 },
    trait: '攻撃を受けるたびに攻撃力 +6%（最大 +60%）。倒れると0に戻る',
    rageOnHurt: 0.06, rageMax: 0.6, breakMul: 1.1,
    look: { armorColor: 0x4a0000, swordColor: 0xff5252, swordLen: 0.5, cape: 0x880e4f, weapon: 'fist' },
  },
  falconer: {
    name: '鷹匠', role: '鷹が自動で攻撃', color: '#bcaaa4',
    power: 0.88, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 28, mult: 0.75, color: 0xbcaaa4, size: 0.22, range: 24 },
    q: { id: 'divebomb', kind: 'zone', zone: 'strike', name: '鷹の急襲', desc: '一番近いボスへ0.6秒後 鷹が急降下', cd: 5, at: 'boss', dist: 8, radius: 2.5, dur: 0.6, mult: 2.6, color: 0xbcaaa4 },
    e: { id: 'hawkfrenzy', kind: 'selfbuff', name: '鷹の猛攻', desc: '8秒間 鷹の攻撃が2.5倍速', cd: 14, buff: 'hawkfrenzy', dur: 8, vals: {}, color: 0xbcaaa4 },
    r: { id: 'hawkflock', kind: 'shots', name: '鷹の群れ', desc: '一番近いボスへ鷹の群れ（8羽）が襲いかかる', aim: true, count: 8, spread: 0.12, speed: 30, mult: 1.5, size: 0.35, range: 30, color: 0x8d6e63 },
    trait: '鷹が1.2秒ごとに一番近い敵（20m以内）を自動で攻撃する',
    hawk: { every: 1.2, mult: 0.9, range: 20 }, breakMul: 1,
    look: { armorColor: 0x5d4037, swordColor: 0x8d6e63, swordLen: 0.9, cape: 0x33691e, weapon: 'bow' },
  },
  vampire: {
    name: '吸血鬼', role: '吸血と蝙蝠化', color: '#ce93d8',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.26, hit: 0.09, mult: 0.9 }, { dur: 0.26, hit: 0.09, mult: 0.95 }, { dur: 0.42, hit: 0.16, mult: 1.5 }], range: 2.6, arc: 2.2, heavyBonus: 0.3 },
    q: { id: 'bite', kind: 'cone', name: '吸血', desc: '噛みついて、与えたダメージの50% を吸う', cd: 6, mult: 2, range: 3, arc: 1.2, color: 0xb71c1c, lifesteal: 0.5 },
    e: { id: 'batswarm', kind: 'dash', name: '蝙蝠の群れ', desc: '蝙蝠になって7m すり抜ける（無敵）', cd: 6, mult: 1.2, dist: 7, time: 0.22, width: 1.6, color: 0x4a148c },
    r: { id: 'nightlord', kind: 'selfbuff', name: '夜の王', desc: '10秒間 攻撃力 +30%・与ダメの30% を吸う・移動 +20%', buff: 'nightlord', dur: 10, vals: { atkMul: 1.3, lifesteal: 0.3, speedMul: 1.2 }, color: 0x7b1fa2, sound: 'roar', msg: '夜の王！' },
    trait: '与えたダメージの 8% だけ HP 回復',
    lifesteal: 0.08, breakMul: 1,
    look: { armorColor: 0x212121, swordColor: 0xb71c1c, swordLen: 0.7, cape: 0x4a148c, weapon: 'dagger' },
  },
  gunblade: {
    name: 'ガンブレード', role: '斬って撃つ', color: '#b0bec5',
    power: 0.85, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.32, hit: 0.11, mult: 1.0 }, { dur: 0.32, hit: 0.11, mult: 1.05 }, { dur: 0.5, hit: 0.2, mult: 1.6 }], range: 2.8, arc: 2.2, heavyBonus: 0.3 },
    q: { id: 'gunslash', kind: 'shots', name: '斬撃弾', desc: '剣先から3発の弾を撃つ', cd: 4, count: 3, spread: 0.12, speed: 34, mult: 1.0, size: 0.22, range: 22, color: 0xb0bec5 },
    e: { id: 'triggercut', kind: 'cone', name: 'トリガー斬り', desc: '引き金を引いて爆発する斬撃', cd: 6, mult: 2.4, range: 3.6, arc: 1.6, color: 0xffab40 },
    r: { id: 'fullburst', kind: 'shots', name: 'フルバースト', desc: '一番近いボスへ弾を撃ち尽くす（12発）', aim: true, count: 12, every: 0.06, jitter: 0.1, speed: 40, mult: 1.1, size: 0.2, range: 28, color: 0xffab40 },
    trait: '近接でも射撃でもゲージが溜まりやすい（1.15倍）',
    gaugeMul: 1.15, breakMul: 1.1,
    look: { armorColor: 0x455a64, swordColor: 0xb0bec5, swordLen: 1.0, cape: 0x263238, weapon: 'sword' },
  },
  javelin: {
    name: '投槍兵', role: '貫く槍', color: '#ffe0b2',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.75, speed: 26, mult: 1.4, color: 0xffe0b2, size: 0.3, range: 26, pierce: true },
    q: { id: 'burstjavelin', kind: 'shots', name: '爆裂槍', desc: '当たると爆発する槍', cd: 6, speed: 26, mult: 2.4, size: 0.35, range: 24, explode: 3.2, color: 0xffab40 },
    e: { id: 'javelinrain', kind: 'zone', zone: 'strike', name: '槍の雨', desc: '狙った場所の周りに1秒後 槍を5本降らせる', cd: 9, at: 'aim', dist: 8, count: 5, scatter: 2.5, radius: 2.4, dur: 1, mult: 2, color: 0xffe0b2 },
    r: { id: 'godspear', kind: 'shots', name: '神槍', desc: '巨大な槍を投げる（貫通・とても強い）', speed: 30, mult: 7, size: 0.9, range: 34, pierce: true, color: 0xffd54f, sound: 'wave' },
    trait: 'ブレイク値 1.2倍',
    breakMul: 1.2,
    look: { armorColor: 0x8d6e63, swordColor: 0xffe0b2, swordLen: 1.1, cape: 0xbf360c, weapon: 'spear' },
  },
  maid: {
    name: 'メイド', role: '敵弾のお掃除', color: '#f8bbd0',
    power: 1, support: 1.33, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 24, mult: 0.75, color: 0xf8bbd0, size: 0.26, range: 22 },
    q: { id: 'sweepup', kind: 'cleanse', name: 'お掃除', desc: '周り6mの敵弾を一瞬で消して、近くの敵を叩く', cd: 6, radius: 6, mult: 1.2, color: 0xf8bbd0 },
    e: { id: 'teatime', kind: 'teamheal', name: 'お茶の時間', desc: '周囲8mの味方の HP を 20% 回復', cd: 12, radius: 8, amount: 0.2, color: 0xf8bbd0 },
    r: { id: 'springclean', kind: 'cleanse', name: '大掃除', desc: '周り14mの敵弾をすべて消し、周りの味方に8秒のバリア', radius: 14, mult: 1.5, color: 0xff80ab, team: { name: 'barrier', dur: 8, vals: { shield: 0.3 }, msg: 'メイドの大掃除！ バリアが張られた' } },
    trait: '身のこなし：回避の無敵時間 +0.1秒',
    dodgeInvulnBonus: 0.1, breakMul: 1,
    look: { armorColor: 0x212121, swordColor: 0xf8bbd0, swordLen: 0.6, cape: 0xffffff, weapon: 'staff', hat: 0xffffff },
  },

  // ================= 追加の16職（65〜80） =================
  mimic: {
    name: 'ものまね師', role: '他の職業の技を借りる', color: '#ffe0b2',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 24, mult: 0.85, color: 0xffe0b2, size: 0.28, range: 22 },
    q: { id: 'copycat', kind: 'mimic', name: 'ものまね', desc: 'ランダムな職業の Q スキルを借りて使う', cd: 5 },
    e: { id: 'copycat2', kind: 'mimic', name: 'ものまね（もう一回）', desc: 'Q とは別に、もう一度ランダムな職業の Q スキルを借りる', cd: 8 },
    r: { id: 'copyburst', kind: 'burst', name: 'ものまね大会', desc: '周りに4回、いろんな色の衝撃を出す', ticks: 4, every: 0.18, mult: 2, radius: 5, color: 0xffcc80, melee: false },
    trait: 'Q・E が何の技になるかは使うまで分からない',
    breakMul: 1,
    look: { armorColor: 0x8d6e63, swordColor: 0xffe0b2, swordLen: 0.8, cape: 0xff8a65, weapon: 'flask', hat: 0x6d4c41 },
  },
  phoenix: {
    name: '不死鳥使い', role: '一度だけ蘇る', color: '#ff8a65',
    power: 1.3, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 22, mult: 0.85, color: 0xff8a65, size: 0.3, range: 22 },
    q: { id: 'phoenixflame', kind: 'cone', name: '不死鳥の炎', desc: '前方を焼き、燃やし続ける', cd: 6, mult: 1.6, range: 6, arc: 1.3, color: 0xff7043, melee: false, sound: 'wave', dot: { mult: 0.3, every: 0.5, dur: 4 } },
    e: { id: 'emberheal', kind: 'selfbuff', name: '灰の癒し', desc: '6秒間 毎秒 HP 5% 回復', cd: 14, buff: 'ember', dur: 6, vals: { regen: 0.05 }, color: 0xff8a65 },
    r: { id: 'phoenixdive', kind: 'leap', name: '不死鳥の急降下', desc: '炎の翼で跳び、着地点を大きく焼く', dist: 8, time: 0.6, radius: 5, mult: 4, color: 0xff3d00, height: 6 },
    trait: '1回の挑戦で一度だけ、倒れてもその場で HP 50% で蘇る',
    autoRevive: 0.5, breakMul: 1,
    look: { armorColor: 0xbf360c, swordColor: 0xffab40, swordLen: 0.9, cape: 0xff6f00, weapon: 'staff', hat: 0xbf360c },
  },
  weather: {
    name: '天候術士', role: '空模様を変える', color: '#90caf9',
    power: 0.59, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 22, mult: 0.85, color: 0x90caf9, size: 0.3, range: 22 },
    q: { id: 'thunderstorm', kind: 'zone', zone: 'field', name: '雷雨', desc: '狙った場所に5秒間 雷雨を降らせる', cd: 9, at: 'aim', dist: 8, radius: 5, dur: 5, every: 0.35, mult: 0.6, color: 0x90caf9 },
    e: { id: 'sunshine', kind: 'teambuff', name: '晴れ間', desc: '周囲10mの味方 8秒間 毎秒 HP 2% 回復・移動 +15%', cd: 15, radius: 10, buff: 'sunshine', dur: 8, vals: { regen: 0.02, speedMul: 1.15 }, color: 0xffee58, msg: '晴れ間がさした' },
    r: { id: 'hurricane', kind: 'zone', zone: 'field', name: '大嵐', desc: '一番近いボスの周りに8秒間 大嵐（強い継続ダメージ）', at: 'boss', dist: 8, radius: 7, dur: 8, every: 0.3, mult: 0.8, color: 0x42a5f5 },
    trait: 'ブレイク値 1.1倍',
    healer: true, breakMul: 1.1,
    look: { armorColor: 0x1565c0, swordColor: 0x90caf9, swordLen: 0.9, cape: 0xe3f2fd, weapon: 'staff', hat: 0x0d47a1 },
  },
  assassin: {
    name: '暗殺者', role: '背後から', color: '#616161',
    power: 0.88, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.22, hit: 0.07, mult: 0.85 }, { dur: 0.22, hit: 0.07, mult: 0.85 }, { dur: 0.36, hit: 0.13, mult: 1.5 }], range: 2.4, arc: 2.0, heavyBonus: 0.2 },
    q: { id: 'shadowwalk', kind: 'blinkbehind', name: '影渡り', desc: '一番近いボスの背後へ回り込んで斬る', cd: 6, mult: 1.8, color: 0x424242 },
    e: { id: 'vanish', kind: 'selfbuff', name: '消失', desc: '1.5秒 無敵になり、5秒間 会心率 +40%', cd: 11, buff: 'vanish', dur: 5, vals: { critAdd: 0.4 }, invuln: 1.5, color: 0x424242, sound: 'dodge' },
    r: { id: 'assassinate', kind: 'blinkbehind', name: '暗殺', desc: '背後へ回り込み、必ず会心の一撃', mult: 6, crit: true, color: 0x212121 },
    trait: '相手の背中側から当てるとダメージ 1.6倍',
    backstab: 1.6, breakMul: 1,
    look: { armorColor: 0x212121, swordColor: 0x9e9e9e, swordLen: 0.6, cape: 0x000000, weapon: 'dagger', mask: true },
  },
  engineer: {
    name: '機工士', role: '自動タレット', color: '#ffb74d',
    power: 0.65, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 28, mult: 0.75, color: 0xffb74d, size: 0.22, range: 24 },
    q: { id: 'turret', kind: 'zone', zone: 'turret', name: 'タレット設置', desc: '足元に12秒間 自動で撃つタレットを置く', cd: 10, radius: 1, dur: 12, every: 0.45, mult: 0.7, range: 22, color: 0xffb74d },
    e: { id: 'repairkit', kind: 'teambuff', name: '修理キット', desc: '周囲8mの味方にバリア（最大 HP の 20%・8秒）', cd: 12, radius: 8, buff: 'barrier', dur: 8, vals: { shield: 0.2 }, color: 0xffb74d, msg: '修理キット：バリア' },
    r: { id: 'bigturret', kind: 'zone', zone: 'turret', name: '大型砲台', desc: '15秒間 爆発する砲弾を撃つ大型砲台を置く', radius: 1, dur: 15, every: 0.7, mult: 1.6, range: 26, explode: 2.6, color: 0xff7043 },
    trait: 'タレットは置いた人の攻撃力で撃つ',
    breakMul: 1,
    look: { armorColor: 0x6d4c41, swordColor: 0xffb74d, swordLen: 0.8, cape: 0x4e342e, weapon: 'mace' },
  },
  dimension: {
    name: '次元術士', role: '瞬間移動', color: '#b388ff',
    power: 1.24, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 26, mult: 0.85, color: 0xb388ff, size: 0.28, range: 22 },
    q: { id: 'warp', kind: 'blink', name: '次元跳躍', desc: '狙った場所（8m 先）へ一瞬で移動し、着いた場所の周りを打つ', cd: 5, dist: 8, mult: 1.4, radius: 3, color: 0xb388ff },
    e: { id: 'riftbeam', kind: 'beam', name: '次元の裂け目', desc: '前方18m を裂く（即着弾）', cd: 6, len: 18, width: 2, mult: 2.2, color: 0x7c4dff },
    r: { id: 'dimensioncut', kind: 'beam', name: '次元斬', desc: '前方28m を4回 切り裂く', len: 28, width: 3, mult: 2, ticks: 4, every: 0.2, color: 0x651fff },
    trait: '回避の無敵時間 +0.1秒',
    dodgeInvulnBonus: 0.1, breakMul: 1,
    look: { armorColor: 0x311b92, swordColor: 0xb388ff, swordLen: 0.9, cape: 0x1a237e, weapon: 'staff', hat: 0x311b92 },
  },
  onmyoji: {
    name: '陰陽師', role: '札を3枚そろえる', color: '#fff8e1',
    power: 0.91, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 22, mult: 0.85, color: 0xfff8e1, size: 0.26, range: 22 },
    q: { id: 'talisman', kind: 'zone', zone: 'talisman', name: '札を置く', desc: '狙った場所に札を置く。3枚そろうと一斉に大爆発', cd: 3, at: 'aim', dist: 6, radius: 4, dur: 30, mult: 3, color: 0xfff176, need: 3 },
    e: { id: 'shikigami', kind: 'shots', name: '式神', desc: '紙の式神を5羽 飛ばす', cd: 6, count: 5, spread: 0.2, speed: 22, mult: 0.9, size: 0.3, range: 22, color: 0xfffde7 },
    r: { id: 'gofu', kind: 'zone', zone: 'strike', name: '五芒の陣', desc: '一番近いボスの周りに1秒後 5つの大爆発', at: 'boss', dist: 8, count: 5, scatter: 3.5, radius: 3.8, dur: 1, mult: 3.4, color: 0xfff176 },
    trait: '札の爆発はブレイク値 1.5倍',
    breakMul: 1,
    look: { armorColor: 0xfafafa, swordColor: 0xfff176, swordLen: 0.8, cape: 0xd32f2f, weapon: 'staff', hat: 0x212121 },
  },
  hunter: {
    name: '狩人', role: '印を付けて狩る', color: '#a5d6a7',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.4, speed: 32, mult: 0.8, color: 0xa5d6a7, size: 0.22, range: 28, pierce: true },
    q: { id: 'huntmark', kind: 'mark', name: '獲物の印', desc: '一番近いボスに印。12秒間 そのボスへの自分のダメージ 1.5倍', cd: 14, dur: 12 },
    e: { id: 'netshot', kind: 'shots', name: '投網', desc: '当たったボスを4秒間 鈍らせる網を撃つ', cd: 8, speed: 24, mult: 0.8, size: 0.5, range: 20, color: 0x8d6e63, debuff: { name: 'slow', dur: 4, mul: 0.6 } },
    r: { id: 'volley', kind: 'shots', name: '一斉射撃', desc: '一番近いボスへ矢を10本 撃ち込む', aim: true, count: 10, every: 0.08, jitter: 0.08, speed: 36, mult: 1.3, size: 0.22, range: 32, pierce: true, color: 0xa5d6a7 },
    trait: '印を付けたボスには自分のダメージ 1.5倍',
    markBonus: 1.5, breakMul: 1,
    look: { armorColor: 0x33691e, swordColor: 0x8d6e63, swordLen: 0.9, cape: 0x558b2f, weapon: 'bow' },
  },
  gladiator: {
    name: '剣闘士', role: '正面に強い', color: '#ffcc80',
    power: 0.78, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.34, hit: 0.12, mult: 1.05 }, { dur: 0.34, hit: 0.12, mult: 1.1 }, { dur: 0.52, hit: 0.2, mult: 1.8 }], range: 2.8, arc: 2.2, heavyBonus: 0.3 },
    q: { id: 'arenaslash', kind: 'cone', name: '闘技の一閃', desc: '前方を大きく斬る', cd: 5, mult: 2.2, range: 4, arc: 1.8, color: 0xffcc80 },
    e: { id: 'netthrow', kind: 'debuff', name: '投げ網', desc: 'ボスに網をかけ、4秒間 鈍らせる', cd: 12, color: 0x8d6e63, debuffs: [{ name: 'slow', dur: 4, mul: 0.6 }] },
    r: { id: 'crowdroar', kind: 'burst', name: '観衆の熱狂', desc: '周りを5回 斬り刻む', ticks: 5, every: 0.15, mult: 1.8, radius: 4.4, color: 0xffb74d },
    trait: '正面（向いている方向の左右60°）からの攻撃は 40% カット',
    frontGuard: 0.6, breakMul: 1.2,
    look: { armorColor: 0x8d6e63, swordColor: 0xcfd8dc, swordLen: 0.9, cape: 0xb71c1c, weapon: 'sword', bigShield: true },
  },
  elementalist: {
    name: '精霊術士', role: '順番に属性が変わる', color: '#80cbc4',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 22, mult: 0.85, color: 0x80cbc4, size: 0.3, range: 22 },
    q: { id: 'elemcycle', kind: 'cycle', name: '属性術', desc: '使うたびに 炎（範囲）→ 氷（鈍化）→ 雷（連鎖）と順番に変わる', cd: 4, pool: [
      { name: '炎：火柱', kind: 'zone', zone: 'strike', at: 'aim', dist: 7, radius: 4, dur: 0.6, mult: 2.6, color: 0xff7043 },
      { name: '氷：氷の礫', kind: 'shots', count: 3, spread: 0.15, speed: 24, mult: 0.9, size: 0.3, range: 22, color: 0x80deea, debuff: { name: 'slow', dur: 3, mul: 0.7 } },
      { name: '雷：連鎖雷', kind: 'shots', speed: 34, mult: 1.6, size: 0.35, range: 24, color: 0xfff176, chain: { range: 8, mult: 1.0 } },
    ] },
    e: { id: 'elemshield', kind: 'selfbuff', name: '精霊の守り', desc: '6秒間 被ダメージ -30%・攻撃力 +15%', cd: 12, buff: 'elemshield', dur: 6, vals: { dmgMul: 0.7, atkMul: 1.15 }, color: 0x80cbc4 },
    r: { id: 'elemstorm', kind: 'zone', zone: 'strike', name: '四大精霊', desc: '一番近いボスの周りに4色の大爆発', at: 'boss', dist: 8, count: 4, scatter: 3, radius: 4, dur: 0.8, mult: 3.6, color: 0x4db6ac },
    trait: '属性術は 炎→氷→雷 の順で回る（次が何かは右上のトーストで分かる）',
    breakMul: 1,
    look: { armorColor: 0x00695c, swordColor: 0x80cbc4, swordLen: 0.9, cape: 0x004d40, weapon: 'staff', hat: 0x00796b },
  },
  werewolf: {
    name: '人狼', role: '追い込まれると獣化', color: '#a1887f',
    power: 0.97, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.26, hit: 0.09, mult: 0.9 }, { dur: 0.26, hit: 0.09, mult: 0.95 }, { dur: 0.42, hit: 0.16, mult: 1.6 }], range: 2.6, arc: 2.4, heavyBonus: 0.3 },
    q: { id: 'clawrake', kind: 'cone', name: '爪裂き', desc: '前方を爪で引き裂く', cd: 5, mult: 2.2, range: 3.4, arc: 1.8, color: 0xa1887f },
    e: { id: 'pounce', kind: 'leap', name: '飛びかかり', desc: '狙った場所へ飛びかかる', cd: 7, dist: 6, time: 0.45, radius: 3, mult: 2.2, color: 0x8d6e63 },
    r: { id: 'fullmoon', kind: 'selfbuff', name: '満月', desc: '12秒間 獣化：攻撃力 +45%・移動 +25%・与ダメの15% を吸う', buff: 'moon', dur: 12, vals: { atkMul: 1.45, speedMul: 1.25, lifesteal: 0.15 }, color: 0x795548, sound: 'roar', msg: '満月！ 獣化した' },
    trait: 'HP が 50% を切ると自動で10秒間 獣化（攻撃力 +35%・移動 +20%）。エリアごとに一度',
    wolfAt: 0.5, wolfBuff: { dur: 10, vals: { atkMul: 1.35, speedMul: 1.2 } }, breakMul: 1.1,
    look: { armorColor: 0x5d4037, swordColor: 0xd7ccc8, swordLen: 0.5, cape: 0x3e2723, weapon: 'fist' },
  },
  fortress: {
    name: '要塞兵', role: '止まると硬い', color: '#90a4ae',
    power: 0.67, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.6, speed: 30, mult: 1.0, color: 0x90a4ae, size: 0.26, range: 26 },
    q: { id: 'cannonshot', kind: 'shots', name: '砲撃', desc: '爆発する砲弾を撃つ', cd: 5, speed: 26, mult: 2.2, size: 0.4, range: 26, explode: 3, color: 0x78909c },
    e: { id: 'entrench', kind: 'selfbuff', name: '陣地構築', desc: '6秒間 被ダメージ -40%・攻撃力 +20%（足は遅くなる）', cd: 12, buff: 'entrench', dur: 6, vals: { dmgMul: 0.6, atkMul: 1.2, speedMul: 0.6 }, color: 0x90a4ae },
    r: { id: 'fortbarrage', kind: 'zone', zone: 'strike', name: '一斉砲撃', desc: '一番近いボスの周りに1.2秒後 砲弾を7発', at: 'boss', dist: 8, count: 7, scatter: 3.5, radius: 3.4, dur: 1.2, mult: 3.2, color: 0x78909c },
    trait: '0.5秒以上 止まっていると被ダメージ -40%',
    stillGuard: 0.6, breakMul: 1.1,
    look: { armorColor: 0x546e7a, swordColor: 0x424242, swordLen: 1.0, cape: 0x37474f, weapon: 'gun', bigShield: true },
  },
  healfist: {
    healer: true,
    name: '治癒拳士', role: '殴って回復', color: '#a5d6a7',
    power: 0.66, support: 1.92, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.24, hit: 0.08, mult: 0.8 }, { dur: 0.24, hit: 0.08, mult: 0.85 }, { dur: 0.24, hit: 0.08, mult: 0.85 }, { dur: 0.4, hit: 0.15, mult: 1.4 }], range: 2.4, arc: 2.2, heavyBonus: 0.2 },
    q: { id: 'chipalm', kind: 'cone', name: '気功掌', desc: '前方を打つ（与えたダメージも仲間の回復に回る）', cd: 5, mult: 2.0, range: 3.4, arc: 1.4, color: 0xa5d6a7 },
    e: { id: 'chiwave', kind: 'teamheal', name: '気の波', desc: '周囲8mの味方の HP を 12% 回復', cd: 12, radius: 8, amount: 0.12, color: 0xa5d6a7 },
    r: { id: 'chiburst', kind: 'burst', name: '気功乱打', desc: '周りを8回 打つ（すべて仲間の回復に回る）', ticks: 8, every: 0.12, mult: 1.1, radius: 3.8, color: 0x69f0ae },
    trait: '近接で与えたダメージの一部が、1.2秒ごとに周り8mの仲間の回復になる',
    healPool: { rate: 0.0004, max: 0.025, radius: 8 }, // 1.2秒ごとに最大 2.5%（僧侶を上回らない） breakMul: 1,
    look: { armorColor: 0x2e7d32, swordColor: 0xa5d6a7, swordLen: 0.5, cape: 0x1b5e20, weapon: 'fist' },
  },
  sage: {
    name: '賢者', role: 'スキルの回転が速い', color: '#fff59d',
    power: 0.54, support: 0.54, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 24, mult: 0.8, color: 0xfff59d, size: 0.28, range: 22 },
    q: { id: 'wisdombolt', kind: 'shots', name: '叡智の矢', desc: '光の矢を3本 撃つ', cd: 3, count: 3, spread: 0.12, speed: 28, mult: 1.0, size: 0.28, range: 24, color: 0xfff59d },
    e: { id: 'wisdomfield', kind: 'zone', zone: 'field', name: '知恵の泉', desc: '足元を6秒間 回復の場にする（敵には継続ダメージ）', cd: 9, radius: 5, dur: 6, every: 0.5, mult: 0.4, heal: 0.015, color: 0xfff59d },
    r: { id: 'enlightenment', kind: 'teambuff', name: '悟り', desc: '全員 10秒間 攻撃力 +20%・会心率 +20%', buff: 'enlight', dur: 10, vals: { atkMul: 1.2, critAdd: 0.2 }, color: 0xfff59d, msg: '悟り！ 攻撃力と会心率アップ' },
    trait: 'Q・E のクールダウンが 40% 短い',
    cdMul: 0.6, breakMul: 1,
    look: { armorColor: 0xfafafa, swordColor: 0xfff59d, swordLen: 1.0, cape: 0x1a237e, weapon: 'staff', hat: 0xfafafa },
  },
  acrobat: {
    name: '曲芸師', role: '回避で爆発', color: '#ffd54f',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.24, hit: 0.08, mult: 0.85 }, { dur: 0.24, hit: 0.08, mult: 0.9 }, { dur: 0.4, hit: 0.15, mult: 1.5 }], range: 2.5, arc: 2.4, heavyBonus: 0.2 },
    q: { id: 'cartwheel', kind: 'dash', name: '側転斬り', desc: '回りながら6m 斬り抜ける（無敵）', cd: 4, mult: 1.4, dist: 6, time: 0.22, width: 1.5, color: 0xffd54f },
    e: { id: 'juggleknives', kind: 'shots', name: '曲芸ナイフ', desc: '全方向に8本 ナイフを投げる', cd: 7, count: 8, spread: 0.785, speed: 26, mult: 0.9, size: 0.22, range: 16, color: 0xffd54f },
    r: { id: 'grandfinale', kind: 'burst', name: 'グランドフィナーレ', desc: '周りで花火のように6回 爆発', ticks: 6, every: 0.15, mult: 1.7, radius: 4.6, color: 0xffab00, melee: false },
    trait: '回避するたびに、その場で小さく爆発する（スタミナ消費も少し軽い）',
    dodgeBlast: { mult: 1.1, radius: 3 }, dodgeCostMul: 0.8, breakMul: 1,
    look: { armorColor: 0xf57f17, swordColor: 0xffd54f, swordLen: 0.6, cape: 0x6a1b9a, weapon: 'dagger', hat: 0x6a1b9a },
  },
  driller: {
    name: 'ドリル使い', role: '至近距離で削る', color: '#bdbdbd',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.2, hit: 0.07, mult: 0.75 }, { dur: 0.2, hit: 0.07, mult: 0.75 }, { dur: 0.2, hit: 0.07, mult: 0.8 }, { dur: 0.36, hit: 0.13, mult: 1.3 }], range: 2.4, arc: 1.6, heavyBonus: 0.2 },
    q: { id: 'drillrush', kind: 'beam', name: 'ドリル突撃', desc: '前方3.5m を2秒間 ガリガリ削る（ブレイク大）', cd: 7, len: 3.5, width: 2.2, mult: 0.7, ticks: 14, every: 0.14, color: 0xbdbdbd, brkMul: 3, gaugeSelf: 2 },
    e: { id: 'drilldive', kind: 'dash', name: '掘り進み', desc: '地面にもぐって6m 進む（無敵）', cd: 6, mult: 1.2, dist: 6, time: 0.3, width: 1.4, color: 0x8d6e63 },
    r: { id: 'gigadrill', kind: 'beam', name: 'ギガドリル', desc: '巨大なドリルで前方5m を3秒間 削り続ける', len: 5, width: 3.4, mult: 1.1, ticks: 20, every: 0.15, color: 0xe0e0e0, brkMul: 3 },
    trait: 'ドリルの攻撃はブレイク値が大きい',
    breakMul: 1.3,
    look: { armorColor: 0x616161, swordColor: 0xbdbdbd, swordLen: 0.8, cape: 0xffa000, weapon: 'spear' },
  },
  // ================= 追加の16職（第6弾：独特なしくみ） =================
  absorber: {
    name: '吸収術士', role: '敵弾を吸ってゲージに', color: '#80cbc4',
    power: 1.36, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 24, mult: 0.8, color: 0x80cbc4, size: 0.26, range: 22 },
    q: { id: 'devour', kind: 'absorb', name: '弾喰らい', desc: '周り5mの敵弾を吸い込む。1発ごとに必殺ゲージ +4（最大 +24）・HP 1% 回復', cd: 7, radius: 5, gaugePer: 4, gaugeMax: 24, healPer: 0.01, color: 0x80cbc4 },
    e: { id: 'releasebolt', kind: 'shots', name: '放出弾', desc: '吸った力を3発の大きな弾にして撃ち出す（貫通）', cd: 6, count: 3, spread: 0.15, speed: 26, mult: 1.4, size: 0.4, range: 24, pierce: true, color: 0x4db6ac },
    r: { id: 'blackmaw', kind: 'absorb', name: '大口', desc: '周り12mの敵弾をすべて吸い込む。1発ごとに必殺ゲージ +2（最大 +30）・HP 1% 回復', radius: 12, gaugePer: 2, gaugeMax: 30, healPer: 0.01, color: 0x26a69a },
    trait: '弾を吸うたびに強くなる（吸った弾でゲージが溜まる）',
    breakMul: 1,
    look: { armorColor: 0x00695c, swordColor: 0x80cbc4, swordLen: 0.9, cape: 0x004d40, weapon: 'staff', hat: 0x004d40 },
  },
  reflector: {
    name: '反射術士', role: '敵弾をはね返す', color: '#b3e5fc',
    power: 1.6, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 26, mult: 0.8, color: 0xb3e5fc, size: 0.24, range: 22 },
    q: { id: 'reflectwall', kind: 'reflect', name: '鏡返し', desc: '周り5mの敵弾をはね返す。返した数だけ一番近い敵に大ダメージ', cd: 7, radius: 5, base: 1.0, per: 0.4, cap: 15, color: 0xb3e5fc },
    e: { id: 'prismguard', kind: 'selfbuff', name: 'プリズムの盾', desc: '4秒間 被ダメージ -50%', cd: 12, buff: 'prism', dur: 4, vals: { dmgMul: 0.5 }, color: 0x81d4fa, msg: 'プリズムの盾！' },
    r: { id: 'grandmirror', kind: 'reflect', name: '大鏡', desc: '周り14mの敵弾をすべてはね返し、数に応じた超大ダメージ', radius: 14, base: 3, per: 0.5, cap: 30, color: 0x4fc3f7 },
    trait: '弾幕が濃いほど強い',
    breakMul: 1,
    look: { armorColor: 0x0277bd, swordColor: 0xe1f5fe, swordLen: 0.9, cape: 0x01579b, weapon: 'staff', hat: 0xe1f5fe },
  },
  drummer: {
    name: '太鼓叩き', role: 'リズムで殴る', color: '#ffeb3b',
    power: 0.52, support: 0.38, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.3, hit: 0.1, mult: 1.0 }, { dur: 0.3, hit: 0.1, mult: 1.0 }, { dur: 0.42, hit: 0.15, mult: 1.4 }], range: 2.6, arc: 2.4, heavyBonus: 0.3 },
    q: { id: 'warbeat', kind: 'teambuff', name: '戦太鼓', desc: '周り10mの味方 8秒間 攻撃力 +20%', cd: 14, radius: 10, buff: 'warbeat', dur: 8, vals: { atkMul: 1.2 }, color: 0xffeb3b, msg: '戦太鼓！ 攻撃力アップ' },
    e: { id: 'thunderdrum', kind: 'burst', name: '轟き打ち', desc: '太鼓を強く叩き、周りを4回 衝撃で打つ', cd: 7, ticks: 4, every: 0.2, mult: 1.3, radius: 4.2, color: 0xfff176 },
    r: { id: 'festival', kind: 'teambuff', name: '大祭り', desc: '全員 12秒間 攻撃力 +30%・移動 +20%', buff: 'festival', dur: 12, vals: { atkMul: 1.3, speedMul: 1.2 }, color: 0xffd600, msg: '大祭り！ みんな攻撃力・移動アップ' },
    trait: '1秒ごとの拍に合わせて通常攻撃を当てると 2倍（拍で頭上が光る）',
    beat: { period: 1.0, window: 0.12, mult: 2 }, breakMul: 1,
    look: { armorColor: 0xc62828, swordColor: 0x8d6e63, swordLen: 0.7, cape: 0xffeb3b, weapon: 'mace' },
  },
  charger: {
    name: '溜め斬り士', role: '待つほど重い一撃', color: '#ffab40',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.45, hit: 0.18, mult: 1.3 }, { dur: 0.6, hit: 0.26, mult: 2.0 }], range: 3.0, arc: 2.6, heavyBonus: 0.4 },
    q: { id: 'iaidash', kind: 'dash', name: '踏み込み斬り', desc: '前へ6m 踏み込んで斬る（無敵）', cd: 6, mult: 2.4, dist: 6, time: 0.24, width: 1.8, color: 0xffab40 },
    e: { id: 'waitstance', kind: 'counter', name: '待ちの構え', desc: '1.2秒 構える。攻撃されると受け流して強烈に反撃', cd: 9, dur: 1.2, mult: 4.5, range: 6 },
    r: { id: 'meteorcut', kind: 'cone', name: '天割り', desc: '前方を巨大な一太刀で斬る', mult: 9, range: 6, arc: 1.6, color: 0xff6d00, brkMul: 2 },
    trait: '通常攻撃を当てていない時間が長いほど強い（最大 3倍）',
    idleCharge: { per: 0.5, max: 3 }, breakMul: 1,
    look: { armorColor: 0x4e342e, swordColor: 0xffcc80, swordLen: 1.4, cape: 0xbf360c, weapon: 'sword' },
  },
  thornknight: {
    name: '棘の騎士', role: '殴られて反撃', color: '#8bc34a',
    power: 0.77, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    dmgTaken: 0.85,
    basic: { type: 'melee', combo: [{ dur: 0.32, hit: 0.12, mult: 1.0 }, { dur: 0.32, hit: 0.12, mult: 1.05 }, { dur: 0.48, hit: 0.18, mult: 1.6 }], range: 2.6, arc: 2.4, heavyBonus: 0.3 },
    q: { id: 'briarbash', kind: 'burst', name: '茨払い', desc: '周りを茨で2回 打つ', cd: 6, ticks: 2, every: 0.2, mult: 1.6, radius: 3.6, color: 0x8bc34a },
    e: { id: 'thornarmor', kind: 'selfbuff', name: '茨の鎧', desc: '6秒間 被ダメージ -40%・挑発（ボスに狙われる）', cd: 14, buff: 'thornarmor', dur: 6, vals: { dmgMul: 0.6 }, taunt: 6, color: 0x689f38, msg: '茨の鎧！' },
    r: { id: 'briarstorm', kind: 'burst', name: '茨の嵐', desc: '周りに茨を8回 巻き起こす', ticks: 8, every: 0.15, mult: 1.5, radius: 5, color: 0x558b2f },
    trait: '攻撃を受けるたびに、近くの敵へとげで反撃する（攻撃力の 1.5倍）',
    thorns: 1.5, breakMul: 1,
    look: { armorColor: 0x33691e, swordColor: 0x8bc34a, swordLen: 1.0, cape: 0x1b5e20, weapon: 'sword', bigShield: true },
  },
  splitter: {
    name: '分裂射手', role: '当たると弾が割れる', color: '#ff80ab',
    power: 0.5, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 26, mult: 0.7, color: 0xff80ab, size: 0.26, range: 22, split: { count: 3, mult: 0.3, spread: 0.7 } },
    q: { id: 'clusterbolt', kind: 'shots', name: '分裂弾', desc: '当たると5つに割れる大きな弾を撃つ', cd: 5, count: 1, speed: 22, mult: 1.6, size: 0.45, range: 24, color: 0xff4081, split: { count: 5, mult: 0.6, spread: 0.5 } },
    e: { id: 'fanburst', kind: 'shots', name: '扇撃ち', desc: '扇状に5発（それぞれ当たると割れる）', cd: 7, count: 5, spread: 0.2, speed: 24, mult: 0.8, size: 0.28, range: 20, color: 0xff80ab, split: { count: 2, mult: 0.4, spread: 0.8 } },
    r: { id: 'fractal', kind: 'shots', name: 'フラクタル', desc: '大きく割れる弾を12発 連射', count: 12, every: 0.1, jitter: 0.25, speed: 26, mult: 1.2, size: 0.38, range: 26, color: 0xf50057, split: { count: 4, mult: 0.5, spread: 0.6 } },
    trait: '通常攻撃が当たると3つの小さな弾に分かれる',
    breakMul: 1,
    look: { armorColor: 0x880e4f, swordColor: 0xff80ab, swordLen: 0.9, cape: 0x4a148c, weapon: 'gun' },
  },
  boomeranger: {
    name: 'ブーメラン使い', role: '行って帰って2回当てる', color: '#ffcc80',
    power: 0.88, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.55, speed: 22, mult: 0.75, color: 0xffcc80, size: 0.32, range: 13, pierce: true, boomerang: true },
    q: { id: 'tripleboom', kind: 'shots', name: '三連ブーメラン', desc: '3本のブーメランを投げる（行きと帰りで当たる）', cd: 5, count: 3, spread: 0.3, speed: 22, mult: 1.0, size: 0.34, range: 14, pierce: true, boomerang: true, color: 0xffb74d },
    e: { id: 'boomroll', kind: 'dash', name: '転がり投げ', desc: '前へ転がって6m 進む（無敵）', cd: 6, mult: 1.0, dist: 6, time: 0.25, width: 1.4, color: 0xffcc80 },
    r: { id: 'boomstorm', kind: 'shots', name: 'ブーメラン乱舞', desc: '全方向に12本 ブーメランを投げる', count: 12, spread: 0.524, speed: 22, mult: 1.6, size: 0.4, range: 15, pierce: true, boomerang: true, color: 0xff9800 },
    trait: '通常攻撃のブーメランは戻ってくる（貫通・往復で当たる）',
    breakMul: 1,
    look: { armorColor: 0x6d4c41, swordColor: 0xffcc80, swordLen: 0.6, cape: 0xe65100, weapon: 'dagger' },
  },
  shredder: {
    name: '鎧砕き', role: '殴るほどボスがもろく', color: '#90a4ae',
    power: 0.6, support: 0.68, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.36, hit: 0.14, mult: 1.1 }, { dur: 0.36, hit: 0.14, mult: 1.1 }, { dur: 0.55, hit: 0.22, mult: 1.8 }], range: 2.7, arc: 2.4, heavyBonus: 0.3 },
    q: { id: 'armorbreak', kind: 'cone', name: '鎧割り', desc: '前方を叩き割る（ブレイク大）', cd: 6, mult: 2.6, range: 3.6, arc: 1.4, color: 0x90a4ae, brkMul: 2.5 },
    e: { id: 'quakeleap', kind: 'leap', name: '地割り跳び', desc: '跳んで狙った場所に叩きつける', cd: 8, dist: 6, time: 0.45, radius: 3.6, mult: 2.4, color: 0x78909c },
    r: { id: 'crusher', kind: 'burst', name: '粉砕連撃', desc: '周りを6回 叩き潰す', ticks: 6, every: 0.18, mult: 2.0, radius: 4, color: 0x607d8b, brkMul: 2 },
    trait: '近接が当たるたびにボスの被ダメージ +2%（最大 +20%・しばらく残る。全員に効く）',
    shred: { per: 0.02, max: 10 }, breakMul: 1.2,
    look: { armorColor: 0x455a64, swordColor: 0x90a4ae, swordLen: 1.1, cape: 0x263238, weapon: 'axe' },
  },
  exorcist: {
    name: 'エクソシスト', role: '怒ったボスに強い', color: '#fffde7',
    power: 1.14, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 26, mult: 0.8, color: 0xfffde7, size: 0.26, range: 22 },
    q: { id: 'holybind', kind: 'debuff', name: '聖なる縛り', desc: 'ボスを6秒間 鈍らせる', cd: 12, color: 0xfff9c4, debuffs: [{ name: 'slow', dur: 6, mul: 0.65 }] },
    e: { id: 'purgelight', kind: 'cleanse', name: '祓いの光', desc: '周り6mの敵弾を消し、周りの敵を打つ', cd: 9, radius: 6, mult: 1.4, color: 0xfff59d },
    r: { id: 'exorcism', kind: 'beam', name: '大祓', desc: '前方に聖なる光線を2秒間 浴びせ続ける', len: 18, width: 2.4, mult: 0.9, ticks: 14, every: 0.14, color: 0xffffff },
    trait: '怒り状態・気絶中のボスへのダメージ 1.6倍',
    vsRage: 1.6, breakMul: 1,
    look: { armorColor: 0xfafafa, swordColor: 0xffd54f, swordLen: 0.9, cape: 0x212121, weapon: 'staff', hat: 0x212121 },
  },
  stickybomber: {
    name: '吸着爆弾魔', role: '貼り付けて時間差で爆破', color: '#ff7043',
    power: 0.77, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 24, mult: 0.8, color: 0xff8a65, size: 0.24, range: 22 },
    q: { id: 'stickybomb', kind: 'sticky', name: '吸着爆弾', desc: '一番近いボスに爆弾を貼り付ける。2秒後に大爆発', cd: 6, range: 18, delay: 2, radius: 3, mult: 4, color: 0xff7043 },
    e: { id: 'stickytrio', kind: 'sticky', name: '三連吸着', desc: '爆弾を3つ貼り付けて順番に爆発', cd: 10, count: 3, range: 18, delay: 1.5, radius: 3, mult: 2.4, color: 0xff5722 },
    r: { id: 'stickyparty', kind: 'sticky', name: '爆弾まつり', desc: '爆弾を8つ貼り付けて連続で大爆発', count: 8, range: 22, delay: 1.5, radius: 3.6, mult: 3.2, color: 0xdd2c00 },
    trait: '貼り付けた爆弾はボスが動いてもついていく',
    breakMul: 1,
    look: { armorColor: 0x3e2723, swordColor: 0xff7043, swordLen: 0.6, cape: 0xbf360c, weapon: 'flask' },
  },
  bellringer: {
    name: '鐘撞き', role: '弾幕を遅くする', color: '#ffe082',
    power: 0.85, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.38, hit: 0.15, mult: 1.1 }, { dur: 0.38, hit: 0.15, mult: 1.1 }, { dur: 0.55, hit: 0.22, mult: 1.7 }], range: 2.7, arc: 2.6, heavyBonus: 0.3 },
    q: { id: 'slowbell', kind: 'bell', name: '眠りの鐘', desc: '鐘を鳴らして4秒間 敵弾を半分の速さにする', cd: 12, mul: 0.5, dur: 4, mult: 1.2, radius: 4, color: 0xffe082 },
    e: { id: 'bellslam', kind: 'burst', name: '鐘打ち', desc: '鐘を振り回して周りを3回 打つ', cd: 7, ticks: 3, every: 0.22, mult: 1.6, radius: 4, color: 0xffd54f },
    r: { id: 'grandbell', kind: 'bell', name: '大鐘', desc: '8秒間 敵弾を 30% の速さにし、周りに大きな衝撃', mul: 0.3, dur: 8, mult: 4, radius: 6, color: 0xffca28 },
    trait: '鐘の音は自分の周りだけでなく、画面中の敵弾を遅くする',
    breakMul: 1.1,
    look: { armorColor: 0x5d4037, swordColor: 0xffe082, swordLen: 1.0, cape: 0x8d6e63, weapon: 'mace' },
  },
  gardener: {
    name: '庭師', role: '花を植えて咲かせる', color: '#f8bbd0',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 22, mult: 0.8, color: 0xf8bbd0, size: 0.26, range: 22 },
    q: { id: 'flowerbed', kind: 'zone', zone: 'field', name: '花壇', desc: '狙った場所に5秒の花壇（敵に継続ダメージ・味方を少し回復）。咲き終わると爆発', cd: 8, at: 'aim', dist: 5, radius: 3.5, dur: 5, every: 0.5, mult: 0.3, heal: 0.005, endBurst: 3, color: 0xf48fb1 },
    e: { id: 'vinewhip', kind: 'cone', name: 'つる打ち', desc: '前方をつるで打つ', cd: 5, mult: 1.8, range: 4.5, arc: 1.2, color: 0x66bb6a, melee: false },
    r: { id: 'blossom', kind: 'zone', zone: 'field', name: '満開', desc: '足元に大きな花畑（8秒）。咲き終わると大爆発', radius: 7, dur: 8, every: 0.5, mult: 0.5, heal: 0.008, endBurst: 6, color: 0xec407a },
    trait: '花は咲き終わると爆発する',
    breakMul: 1,
    look: { armorColor: 0x558b2f, swordColor: 0xf8bbd0, swordLen: 0.9, cape: 0xad1457, weapon: 'staff', hat: 0x8bc34a },
  },
  echomage: {
    name: '残響術士', role: '技がもう一度響く', color: '#b388ff',
    power: 1, support: 1, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 24, mult: 0.8, color: 0xb388ff, size: 0.26, range: 22 },
    q: { id: 'echobolt', kind: 'shots', name: '響きの矢', desc: '3本の矢を撃つ（1秒後にもう一度）', cd: 5, count: 3, spread: 0.14, speed: 26, mult: 1.1, size: 0.28, range: 24, color: 0xb388ff },
    e: { id: 'echopulse', kind: 'burst', name: '共鳴波', desc: '周りに音の波（1秒後にもう一度）', cd: 7, ticks: 2, every: 0.2, mult: 1.4, radius: 4.5, color: 0x7c4dff, melee: false },
    r: { id: 'resonance', kind: 'beam', name: '大共鳴', desc: '前方に音の光線を浴びせる（1秒後にもう一度）', len: 16, width: 2.2, mult: 1.0, ticks: 10, every: 0.12, color: 0x651fff },
    trait: 'Q・E・R が1秒後にもう一度発動する（威力は半分）',
    echo: { delay: 1, mult: 0.5 }, breakMul: 1,
    look: { armorColor: 0x311b92, swordColor: 0xb388ff, swordLen: 0.9, cape: 0x4527a0, weapon: 'lute' },
  },
  vanguard: {
    name: '先駆け', role: 'ボス戦の出だしに強い', color: '#ef5350',
    power: 1, support: 0.31, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'melee', combo: [{ dur: 0.3, hit: 0.1, mult: 1.0 }, { dur: 0.3, hit: 0.1, mult: 1.05 }, { dur: 0.48, hit: 0.18, mult: 1.6 }], range: 3.2, arc: 1.8, heavyBonus: 0.4 },
    q: { id: 'spearcharge', kind: 'dash', name: '一番槍', desc: '前へ8m 突撃する（無敵）', cd: 6, mult: 2.2, dist: 8, time: 0.26, width: 1.6, color: 0xef5350 },
    e: { id: 'sweepspear', kind: 'cone', name: '薙ぎ払い', desc: '槍で前方を大きく薙ぐ', cd: 5, mult: 2.0, range: 4.2, arc: 2.6, color: 0xe57373 },
    r: { id: 'tokinokoe', kind: 'teambuff', name: '鬨の声', desc: '全員 10秒間 攻撃力 +25%', buff: 'warcry', dur: 10, vals: { atkMul: 1.25 }, color: 0xd50000, msg: '鬨の声！ 攻撃力アップ' },
    trait: 'ボスが出てから15秒間 攻撃力 +40%（ボスごとに）',
    vanguard: { dur: 15, atkMul: 1.4 }, breakMul: 1,
    look: { armorColor: 0xb71c1c, swordColor: 0xeceff1, swordLen: 1.3, cape: 0xffd600, weapon: 'spear' },
  },
  conductor: {
    name: '指揮者', role: 'みんなの技を回す', color: '#ce93d8',
    power: 1.29, support: 2, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.45, speed: 24, mult: 0.75, color: 0xe1bee7, size: 0.24, range: 22 },
    q: { id: 'tempoup', kind: 'teambuff', name: 'アッチェレランド', desc: '周り10mの味方 8秒間 移動 +25%・攻撃力 +10%', cd: 13, radius: 10, buff: 'tempo', dur: 8, vals: { speedMul: 1.25, atkMul: 1.1 }, color: 0xce93d8, msg: 'テンポアップ！' },
    e: { id: 'crescendo', kind: 'teamgauge', name: 'クレッシェンド', desc: '周り10mの味方の必殺ゲージ +12', cd: 14, radius: 10, amount: 12, color: 0xba68c8 },
    r: { id: 'dacapo', kind: 'cdreset', name: 'ダ・カーポ', desc: '全員の Q・E のクールダウンをすぐ終わらせる', color: 0xab47bc },
    trait: '味方を支えるほど戦いが回る',
    breakMul: 1,
    look: { armorColor: 0x212121, swordColor: 0xfafafa, swordLen: 0.6, cape: 0x6a1b9a, weapon: 'staff' },
  },
  sacrifice: {
    name: '献身者', role: '身を削って仲間を起こす', color: '#ef9a9a',
    power: 1.13, support: 2.6, // 火力係数・支援係数（全技に一律で掛かる。docs/balance で調整）
    basic: { type: 'shot', cd: 0.5, speed: 22, mult: 0.8, color: 0xef9a9a, size: 0.26, range: 22 },
    q: { id: 'bloodward', kind: 'teambuff', name: '血の盾', desc: '周り8mの味方にバリア（最大 HP の 20%・6秒）', cd: 14, radius: 8, buff: 'barrier', dur: 6, vals: { shield: 0.2 }, color: 0xe57373, msg: '血の盾が張られた！' },
    e: { id: 'offering', kind: 'teamgauge', name: '捧げもの', desc: '周り10mの味方の必殺ゲージ +10', cd: 14, radius: 10, amount: 10, color: 0xef5350 },
    r: { id: 'lastrites', kind: 'reviveall', name: '身代わりの儀', desc: '自分の HP が 1 になる代わりに、倒れた仲間を全員 HP 30% で起こす（1回の挑戦で1度だけ）', hp: 0.3, oncePerRun: true, color: 0xd32f2f },
    trait: '回復はできないが、仲間を起こせる',
    breakMul: 1,
    look: { armorColor: 0x7f0000, swordColor: 0xef9a9a, swordLen: 0.9, cape: 0x3e0000, weapon: 'staff', hat: 0x7f0000 },
  },
};

export const JOB_ORDER = ['swordsman', 'knight', 'mage', 'priest', 'archer', 'ninja', 'bard', 'summoner',
  'lancer', 'monk', 'alchemist', 'berserker', 'chrono', 'gunner', 'warlock', 'reaper',
  'trapper', 'samurai', 'dancer', 'storm', 'barrier', 'thief', 'astrologer', 'spellblade',
  'dragonkin', 'jester', 'paladin', 'gunslinger', 'chainer', 'darkknight', 'shaman', 'whip',
  'shifter', 'gambler', 'bomber', 'souleater', 'mirror', 'gravity', 'speedster', 'cursed',
  'desperado', 'cook', 'drunkard', 'sniper', 'prophet', 'oni', 'ghost', 'twins',
  'machinegunner', 'flamer', 'rocketeer', 'medic', 'hammer', 'dualblade', 'shielder', 'knifer',
  'laser', 'cryo', 'asura', 'falconer', 'vampire', 'gunblade', 'javelin', 'maid',
  'mimic', 'phoenix', 'weather', 'assassin', 'engineer', 'dimension', 'onmyoji', 'hunter',
  'gladiator', 'elementalist', 'werewolf', 'fortress', 'healfist', 'sage', 'acrobat', 'driller',
  'absorber', 'reflector', 'drummer', 'charger', 'thornknight', 'splitter', 'boomeranger', 'shredder',
  'exorcist', 'stickybomber', 'bellringer', 'gardener', 'echomage', 'vanguard', 'conductor', 'sacrifice'];

/**
 * 基本ステータスはロールごとに共通（data/roles.js・docs/balance/policy.md）。
 * stats はここでロールの値から作る（職ごとの差は技と特性、火力係数 power・支援係数 support だけ）。
 * 特性の被ダメ軽減（重騎士の -25% など）は dmgTaken に書いてあるので、ロールの被ダメ倍率に掛け合わせる
 */
for (const id of JOB_ORDER) {
  const J = JOBS[id];
  if (!ROLES[id]) throw new Error(`職業 ${id} のロールが data/roles.js にない`);
  const rs = roleStats(id, J.basic.type);
  J.roleKey = ROLES[id];
  J.stats = { hp: rs.hp, atk: rs.atk, speed: rs.speed };
  if (rs.dmgTaken !== 1) J.dmgTaken = (J.dmgTaken ?? 1) * rs.dmgTaken;
}
/**
 * 必殺ゲージ：通常攻撃1ヒットの上がり幅（basicGauge）を職業ごとに決める
 * 毎秒のヒット数（近接＝コンボ1周のヒット数÷時間、飛び道具＝1回の弾数÷間隔）で割り、毎秒の上がり方を揃える。
 * 例：マシンガンナー 0.6／双剣士 2.9／剣士 6.0／ロケット兵 8.0。ブーメランは行き帰りで2回当たるので半分。
 * 職業の特色の「溜まりやすさ」（gaugeMul：盗賊・双剣士・ガンブレード）はこの上に掛かる。データに basicGauge を書けばそちらを優先
 */
for (const id of JOB_ORDER) {
  const J = JOBS[id];
  const b = J.basic;
  if (J.basicGauge !== undefined) continue;
  const hps = b.type === 'melee' ? b.combo.length / b.combo.reduce((a, c) => a + c.dur, 0) : (b.count || 1) / b.cd;
  let g = (b.type === 'melee' ? GAUGE.basicPerSecMelee : GAUGE.basicPerSecShot) / hps;
  if (b.boomerang) g *= 0.5;
  J.basicGauge = Math.round(Math.min(12, Math.max(0.3, g)) * 10) / 10;
}
export const DEFAULT_JOB = 'swordsman';

/**
 * 人数補正：敵（ボス・雑魚）の HP とブレイク値の上限に掛ける。どの人数でも撃破時間が揃うように、
 * 人数ごとの標準編成（STANDARD_PARTY）の火力の合計 ÷ 剣士1人の火力 で決めた表（docs/balance/policy.md・bosses.md）
 */
const RAID_SCALE_TABLE = [1, 1, 1.42, 2.37, 3.07, 4.07, 5.03, 5.72, 6.14];
export const RAID_SCALE = (n) => RAID_SCALE_TABLE[Math.min(8, Math.max(1, n))];
/** ステージ1（剣士固定）の敵 HP 倍率。ステータス統一の前と同じ手ごたえになる値 */
export const STAGE1_SCALE = 1.34;
/** 人数ごとの標準編成（計測と人数補正の基準） */
export const STANDARD_PARTY = [null,
  ['swordsman'],
  ['swordsman', 'priest'],
  ['swordsman', 'priest', 'mage'],
  ['swordsman', 'priest', 'mage', 'knight'],
  ['swordsman', 'priest', 'mage', 'knight', 'swordsman'],
  ['swordsman', 'priest', 'mage', 'knight', 'swordsman', 'mage'],
  ['swordsman', 'priest', 'mage', 'knight', 'swordsman', 'mage', 'knight'],
  ['swordsman', 'priest', 'mage', 'knight', 'swordsman', 'mage', 'knight', 'priest']];
/** 実戦で攻撃できている時間の割合の見積もり（避ける・追いかける・倒れるぶんを引く）。ボスの HP を決めるのに使う */
export const UPTIME = 0.55;
/** ひとりで挑むとき、敵の与ダメージに掛ける倍率（協力よりやや簡単に） */
export const SOLO_DAMAGE = 0.7;

/** 1ルームの最大人数（ルーム中継の上限も 8） */
export const MAX_RAID_PLAYERS = 8;

/** ダウンした味方の蘇生（近くに立っている秒数）と、蘇生直後の HP 割合 */
export const REVIVE = { time: 3, radius: 2.2, hp: 0.4 };
