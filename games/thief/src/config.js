// 怪盗ナイトの定数（調整はここに集約）

export const T = 2; // 1タイルの一辺（ワールド単位）
export const WALL_H = 2.4; // 壁の高さ

// タイルのフラグ
export const SOLID = 1; // 通れない
export const OPAQUE = 2; // 視線を遮る
export const LOW = 4; // 低い障害物（しゃがむと陰に隠れられる）

// プレイヤー
export const PLAYER = {
  radius: 0.35,
  speed: { crouch: 1.6, walk: 3.0, run: 5.0 },
  // 足音の聞こえる半径（ワールド単位）と足音の間隔（秒）
  noise: { crouch: 0, walk: 3.2, run: 8.5 },
  stepInterval: { crouch: 0.55, walk: 0.42, run: 0.3 },
  // 見つかりやすさ（掛け算）
  vis: { crouch: 0.55, walk: 1.0, run: 1.25 },
  interactRange: 2.2,
};

// 警備員
export const GUARD = {
  radius: 0.38,
  speed: { patrol: 1.6, investigate: 2.5, chase: 4.0, search: 1.9 },
  viewRange: 8.5,
  viewHalf: (34 * Math.PI) / 180,
  nearSense: 1.3, // この距離なら背後でも気づく（しゃがみ以外）
  catchDist: 0.95,
  gaugeDecay: 0.22, // 見えていない時の警戒ゲージ減少/秒
  suspiciousAt: 0.25, // これを超えると調べに来る
  lostTime: 5.0, // 追跡中に見失ってから捜索へ移るまで
  searchTime: 6.5,
};

// 監視カメラ
export const CAM = {
  range: 7.5,
  half: (24 * Math.PI) / 180,
  fill: 0.9, // 警戒ゲージ上昇/秒（距離補正前）
  cooldown: 5,
};

export const ALARM_RADIUS = 20; // 警報で駆けつける警備員の範囲
export const SHADOW_VIS = 0.6; // 物陰タイルでの見つかりやすさ倍率
export const COVER_VIS = 0.45; // 展示台の陰でしゃがんでいる時の倍率

export const VIEW = { pitch: 0.98, minDist: 7, maxDist: 26, dist: 16, turn: 1.9 };
