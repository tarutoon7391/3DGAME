// 職業16種のデータ（調整用の数値はここに集約）。処理は src/jobs.js
//
// 共通ルール：
//   通常攻撃（左クリック） … melee（近接コンボ）か shot（飛び道具）
//   Q・E スキル            … クールダウン制（それぞれ別の技）
//   R 必殺技               … 必殺ゲージ（0〜100）が満タンで撃てる。ゲージは攻撃を当てると溜まり、
//                            近接の通常攻撃がいちばん多く溜まる（gainMelee > gainShot）
//   ブレイク               … ボスに近接で当てるとブレイク値が溜まり、満タンでボスが気絶（被ダメ1.5倍）。
//                            飛び道具は breakShot 倍しか溜まらない。職業ごとに breakMul を掛ける
//
// stats.hp・atk・speed は剣士（旧仕様の固定能力）を基準にした値

export const GAUGE = {
  max: 100,
  gainMelee: 9, // 近接の通常攻撃1ヒット
  gainShot: 4, // 飛び道具の通常攻撃1ヒット
  gainSkill: 3, // Q・E スキル1ヒット
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
    e: { id: 'gale', name: '疾風突き', desc: '前方へ5m 踏み込んで突く', cd: 6, mult: 1.9, dist: 5, time: 0.18, width: 1.3 },
    r: { id: 'blade', name: '剣聖の一閃', desc: '前方へ巨大な斬撃を飛ばし、当たった敵をひるませる', mult: 4.5, range: 16, radius: 1.8 },
    trait: 'コンボ3段目が必ず会心。ブレイク値 1.3倍',
    breakMul: 1.3,
    look: { armorColor: 0x5d7fa8, swordColor: 0xcfd8dc, swordLen: 1.0, cape: 0xb71c1c, weapon: 'sword' },
  },
  knight: {
    name: '重騎士', role: '盾役（タンク）', color: '#90a4ae',
    stats: { hp: 210, atk: 13, speed: 5.7 },
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
    stats: { hp: 95, atk: 18, speed: 6.2 },
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
    stats: { hp: 115, atk: 11, speed: 6.4 },
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
    stats: { hp: 105, atk: 15, speed: 6.9 },
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
    stats: { hp: 100, atk: 13, speed: 7.6 },
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
    stats: { hp: 110, atk: 12, speed: 6.6 },
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
    stats: { hp: 100, atk: 12, speed: 6.4 },
    basic: { type: 'shot', cd: 0.55, speed: 20, mult: 0.75, color: 0x80cbc4, size: 0.28, range: 22 },
    q: { id: 'spirit', name: '精霊召喚', desc: 'その場に12秒間、ボスを撃ち続ける精霊を出す（最大2体）', cd: 9, dur: 12, every: 0.6, mult: 0.7, max: 2 },
    e: { id: 'detonate', name: '精霊爆破', desc: '自分の精霊をすべて爆発させる（1体ごとに範囲ダメージ）', cd: 10, mult: 2.6, radius: 3.5 },
    r: { id: 'golem', name: '岩巨人召喚', desc: 'ボスの狙いを引きつけ、殴りかかる岩巨人を12秒間出す', dur: 12, hp: 600, mult: 1.6 },
    trait: '召喚物がいる間、自分の被ダメージ -20%',
    summonGuard: 0.8, breakMul: 1,
    look: { armorColor: 0x00695c, swordColor: 0x80cbc4, swordLen: 0.9, cape: 0x004d40, weapon: 'staff', hat: 0x00695c },
  },

  // ---------------- 追加の8職 ----------------
  lancer: {
    name: '槍兵', role: '長いリーチの近接', color: '#ffab91',
    stats: { hp: 135, atk: 15, speed: 6.5 },
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
    stats: { hp: 125, atk: 12, speed: 7.0 },
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
    stats: { hp: 105, atk: 13, speed: 6.4 },
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
    stats: { hp: 160, atk: 17, speed: 6.3 },
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
    stats: { hp: 100, atk: 13, speed: 6.5 },
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
    stats: { hp: 105, atk: 16, speed: 6.3 },
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
    stats: { hp: 110, atk: 13, speed: 6.4 },
    // 当てた敵に短い呪い（継続ダメージ）を付ける
    basic: { type: 'shot', cd: 0.55, speed: 18, mult: 0.6, color: 0xce93d8, size: 0.3, range: 22, dot: { mult: 0.15, every: 0.5, dur: 3 } },
    q: { id: 'hex', name: '呪いの刻印', desc: '当てた敵に8秒間の強い呪い（0.5秒ごとにダメージ）', cd: 9, speed: 20, dot: { mult: 0.4, every: 0.5, dur: 8 } },
    e: { id: 'spread', name: '呪いの拡散', desc: '自分の呪いがかかった敵すべてに追加ダメージを与え、呪いを延長する', cd: 9, mult: 1.6, extend: 3 },
    r: { id: 'drain', name: '生命吸収', desc: '2秒間 前方の敵から命を吸い取り、味方全員を回復し続ける', dur: 2, every: 0.25, mult: 0.7, range: 14, heal: 0.04 },
    trait: '与えたダメージの 5% だけ HP 回復',
    lifesteal: 0.05, breakMul: 1,
    look: { armorColor: 0x311b92, swordColor: 0xce93d8, swordLen: 0.9, cape: 0x1a0026, weapon: 'staff', hat: 0x1a0026 },
  },
  reaper: {
    name: '処刑人', role: 'とどめ役', color: '#b0bec5',
    stats: { hp: 125, atk: 15, speed: 6.5 },
    // 大鎌：遅いが横に広い
    basic: { type: 'melee', combo: [{ dur: 0.48, hit: 0.2, mult: 1.25 }, { dur: 0.48, hit: 0.2, mult: 1.3 }, { dur: 0.65, hit: 0.28, mult: 2.0 }], range: 3.3, arc: 3.2, heavyBonus: 0.4 },
    q: { id: 'soulreap', name: '魂刈り', desc: '大きく薙ぎ払う。当てた数だけ必殺ゲージが大きく溜まる', cd: 7, mult: 2.0, range: 4.2, arc: 4.2, gauge: 14 },
    e: { id: 'scythethrow', name: '鎌投げ', desc: '大鎌を投げる。12m 先で戻ってきて往復で当たる（貫通）', cd: 6, mult: 1.3, speed: 22, range: 12 },
    r: { id: 'verdict', name: '死の宣告', desc: '前方の敵1体に、減っている HP が多いほど強い一撃（最大で通常の3倍以上）', mult: 3, missingMult: 9, range: 6 },
    trait: 'ボスの HP が 30% 以下なら攻撃力 +40%',
    executeAt: 0.3, executeBonus: 1.4, breakMul: 1,
    look: { armorColor: 0x263238, swordColor: 0xb0bec5, swordLen: 1.0, cape: 0x000000, weapon: 'scythe' },
  },
};

export const JOB_ORDER = ['swordsman', 'knight', 'mage', 'priest', 'archer', 'ninja', 'bard', 'summoner',
  'lancer', 'monk', 'alchemist', 'berserker', 'chrono', 'gunner', 'warlock', 'reaper'];
export const DEFAULT_JOB = 'swordsman';

/** レイドの人数補正：ボスの HP・ブレイク値の上限に掛ける（1人 1.0 → 4人 2.65 → 8人 4.85） */
export const RAID_SCALE = (n) => 1 + 0.55 * (Math.max(1, n) - 1);

/** 1ルームの最大人数（ルーム中継の上限も 8） */
export const MAX_RAID_PLAYERS = 8;

/** ダウンした味方の蘇生（近くに立っている秒数）と、蘇生直後の HP 割合 */
export const REVIVE = { time: 3, radius: 2.2, hp: 0.4 };
