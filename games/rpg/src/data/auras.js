// 回復・強化のオーラとエリアの見た目（調整用の数値）。処理は src/auras.js、模様は src/auratex.js
//
// 1つのエリアは次の重ね合わせ
//   塗り   … 地面の円（中心は薄く、縁ほど濃い）
//   縁     … 範囲の境目のくっきりした線
//   光の壁 … 縁から立ち上がる低い光（一人称でも範囲の境目が見える）。残り時間が減ると低くなる
//   模様   … 縁の内側をゆっくり回る模様（種類ごとに違う：回復＝十字、強化＝山形、守り＝六角…）
//   マーク … 真ん中に浮かぶ看板（設置エリアだけ。何のエリアか遠くからわかる）

/** 種類ごとの見た目 */
export const AURA_STYLE = {
  // 回復（聖別・お弁当・野戦病院・知恵の泉・花壇・僧侶のオーラ）
  heal: { pattern: 'cross', emblem: 'plus', fill: 0.3, rim: 0.95, wall: 0.7, spin: 0.25 },
  // 強化（トーテム）
  buff: { pattern: 'chevron', emblem: 'arrow', fill: 0.26, rim: 0.95, wall: 0.8, spin: 0.35 },
  // 守り（鏡の盾・鏡の世界・守護結界）
  ward: { pattern: 'hex', emblem: 'shield', fill: 0.24, rim: 1.0, wall: 1.0, spin: 0.15 },
  // 敵だけに効く攻撃エリア（雷嵐・ナパーム・氷原など）。味方用より控えめで、模様はとげ
  hazard: { pattern: 'spike', emblem: null, fill: 0.2, rim: 0.85, wall: 0.45, spin: -0.5 },
  // スキルの回転が速くなる（吟遊詩人のオーラ）
  tempo: { pattern: 'note', emblem: 'note', fill: 0.18, rim: 0.85, wall: 0.5, spin: 0.4 },
};

/** いつも出ているオーラ（職業の特性）。範囲は data/jobs.js の auraRadius */
export const PASSIVE_AURAS = {
  priest: { type: 'heal', color: 0xfff59d }, // 周囲6mの味方は毎秒 HP 回復
  bard: { type: 'tempo', color: 0xf48fb1 }, // 周囲8mの味方の Q が早く戻る
};

/** 常時オーラは設置エリアより控えめに（ずっと出ているので） */
export const PASSIVE_DIM = 0.45;

/** 自分が味方のエリアの中にいるとき、塗りと縁をこの倍だけ明るく（入っているのがわかる） */
export const INSIDE_BOOST = 1.7;

/** 残り何秒から点滅して「もうすぐ消える」を知らせるか */
export const BLINK_BEFORE_END = 1.5;

/** 範囲回復・範囲強化を使った瞬間の波紋（輪が広がって範囲の大きさを見せる） */
export const PULSE = { grow: 0.3, hold: 0.45, fill: 0.35 };
