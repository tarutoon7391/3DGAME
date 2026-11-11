// 味方の技エフェクトの数値（処理は src/skillfx.js）。どれも見た目だけで、当たり判定や効果には関わらない

/** 1つ1つのエフェクトの長さ（秒） */
export const DUR = {
  slash: 0.28, // 扇の斬撃（技）
  swing: 0.2, // 通常攻撃の剣の軌跡
  spin: 0.34, // 回転斬り
  dash: 0.45, // 突進の残像
  beam: 0.3, // 光線
  powerUp: 0.75, // 自分を強化したときの光の柱
  pillar: 1.4, // 大きな光の柱（女神の祈り・全員蘇生）
  curse: 1.4, // ボスにかかる呪いの紋
  summon: 1.0, // 召喚陣
  crack: 1.3, // 着地のひび割れ
  hit: 0.22, // 当たったときの光
};

/** 当たったときの光の大きさ（m）。会心は大きく金色に */
export const HIT = { size: 1.1, critSize: 2.0, critColor: 0xffd740, max: 32 };

/** バフ中に足元に出る輪の色（効果の種類ごと） */
export const BUFF_COLOR = {
  atk: 0xff5252, // 攻撃力アップ
  def: 0x64b5f6, // 被ダメージ減少
  speed: 0x69f0ae, // 移動速度アップ
  regen: 0xb9f6ca, // 継続回復
  shield: 0x80d8ff, // バリア
  crit: 0xffd740, // 会心率アップ
  other: 0xe1bee7, // そのほか
};

/** 足元の輪を出さないバフ（中身が見た目に関係ないもの） */
export const BUFF_IGNORE = ['counter'];
