// 成長・スキル・プレイヤー挙動のデータ

export const MAX_LEVEL = 20;

/** 次のレベルまでに必要な EXP */
export function expToNext(lv) {
  return 15 + lv * lv * 10;
}

/** レベルごとの素の能力値（装備は別に加算） */
export function statsAt(lv) {
  return {
    maxHp: 80 + (lv - 1) * 16,
    maxMp: 30 + (lv - 1) * 5,
    atk: 5 + (lv - 1) * 2,
    def: 2 + (lv - 1),
  };
}

/** スキル2つ（MP 消費・クールダウン秒） */
export const SKILLS = {
  spin: { key: 'KeyQ', label: 'Q', name: '回転斬り', desc: '周囲の敵をまとめて斬る', mp: 10, cd: 4, mult: 1.7, radius: 3.8 },
  wave: { key: 'KeyE', label: 'E', name: '衝撃波', desc: '前方へ貫通する斬撃を飛ばす', mp: 16, cd: 6, mult: 2.4, speed: 20, range: 18, radius: 1.1 },
};

/** プレイヤーの動きの数値 */
export const PLAYER = {
  speed: 6.5,
  radius: 0.5,
  dodgeSpeed: 15,
  dodgeTime: 0.3,
  dodgeInvuln: 0.42, // 回避の無敵時間
  dodgeCd: 0.55,
  hurtInvuln: 0.7, // 被弾後の無敵時間
  attackRange: 2.7,
  attackArc: 2.2, // 攻撃の扇の角度（ラジアン）
  // 3段コンボ：dur 全体時間、hit 判定タイミング、mult 倍率
  combo: [
    { dur: 0.34, hit: 0.11, mult: 1.0 },
    { dur: 0.34, hit: 0.11, mult: 1.1 },
    { dur: 0.52, hit: 0.2, mult: 1.6 },
  ],
  comboWindow: 0.35, // 次の段を受け付ける猶予
  mpRegen: 1.2, // 毎秒の MP 自然回復
};

/** 全滅時に失うゴールドの割合 */
export const DEATH_GOLD_LOSS = 0.3;
