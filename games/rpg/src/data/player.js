// プレイヤーの能力・スタミナ・スキル・被ダメージのデータ（調整用の数値はここに集約）
// 育成はない。能力値は旧仕様の Lv4＋初期装備（木の剣・布の服）相当で固定

export const PLAYER = {
  maxHp: 120,
  atk: 15, // 旧 Lv4 の素の攻撃 11 ＋ 木の剣 4
  speed: 6.5,
  dashMul: 1.6, // Shift ダッシュ中の速度倍率
  tiredMul: 0.55, // バテ中の速度倍率
  radius: 0.5,
  dodgeSpeed: 15,
  dodgeTime: 0.3,
  dodgeInvuln: 0.42, // 回避の無敵時間
  dodgeCd: 0.55,
  hurtInvuln: 0.7, // 被弾後の無敵時間
  attackRange: 2.7,
  attackArc: 2.2, // 攻撃の扇の角度（ラジアン）
  heavyRangeBonus: 0.4, // 3段目の届く距離の上乗せ
  // 3段コンボ：dur 全体時間、hit 判定タイミング、mult 倍率
  combo: [
    { dur: 0.34, hit: 0.11, mult: 1.0 },
    { dur: 0.34, hit: 0.11, mult: 1.1 },
    { dur: 0.52, hit: 0.2, mult: 1.6 },
  ],
  critRate: 0.1,
  critMul: 1.5,
  // 見た目（装備は固定）
  look: { swordColor: 0x9c6b3c, swordLen: 1.0, armorColor: 0x5d7fa8 },
};

/** スタミナ：ダッシュと回避で減り、使わなければ回復。0 でバテ（満タンまで回避・ダッシュ不可） */
export const STAMINA = {
  max: 100,
  dashPerSec: 22, // ダッシュ中に毎秒減る量
  dodgeCost: 30, // 回避1回で減る量
  regenDelay: 0.6, // 使い終わってから回復が始まるまでの秒数
  regenPerSec: 30, // 通常の回復速度（毎秒）
  tiredRegenPerSec: 22, // バテ中の回復速度（毎秒）。100 なら約4.5秒で復帰
};

/** スキル2つ（MP なし。クールダウン秒だけ。旧仕様の約1.25倍） */
export const SKILLS = {
  spin: { key: 'KeyQ', label: 'Q', name: '回転斬り', desc: '周囲の敵をまとめて斬る', cd: 5, mult: 1.7, radius: 3.8, hitAt: 0.15, dur: 0.5 },
  wave: { key: 'KeyE', label: 'E', name: '衝撃波', desc: '前方へ貫通する斬撃を飛ばす', cd: 7.5, mult: 2.4, speed: 20, range: 18, radius: 1.1 },
};

/** 被ダメージ（プレイヤーの最大 HP に対する割合。防御力の計算はしない） */
export const HIT = {
  enemy: 1 / 4, // 雑魚の攻撃1発
  boss: 1 / 3, // ボスの攻撃1発
};
