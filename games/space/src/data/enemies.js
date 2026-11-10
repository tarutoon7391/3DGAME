// 敵の種類定義（処理は src/enemies.js）
// hp: 耐久 / radius: 当たり判定の球半径 / score: 撃破点 / speed: 前進速度（+z 方向＝自機へ向かう）
export const ENEMY_TYPES = {
  // 直進：まっすぐ突っ込んでくる。途中で1発だけ狙い撃つことがある
  straight: { hp: 2, radius: 1.7, score: 100, color: 0x7fd3ff, speed: 38, cap: 48 },
  // 蛇行：左右にうねりながら前進し、ときどき撃つ
  snake: { hp: 3, radius: 1.7, score: 150, color: 0x9dff7f, speed: 30, amp: 6, freq: 2.0, fireEvery: 2.4, cap: 48 },
  // 狙い撃ち：手前で停止して自機を狙って連射し、時間がたつと退却
  sniper: { hp: 7, radius: 1.9, score: 300, color: 0xffb84d, speed: 45, holdZ: -62, hold: 4.5, fireEvery: 1.1, cap: 16 },
  // 突撃：手前で止まって赤く点滅（予告）し、自機の位置めがけて突進
  rammer: { hp: 4, radius: 1.8, score: 200, color: 0xff5c7a, speed: 42, lockZ: -55, lockTime: 0.7, dash: 78, cap: 24 },
  // 隕石（破壊可）
  rock: { hp: 5, radius: 2.0, score: 50, color: 0x9a8064, speed: 26, size: 1.9, cap: 60 },
  // 隕石（破壊不可）：弾をはじく。避けるしかない
  ironRock: { hp: Infinity, radius: 3.0, score: 0, color: 0x59606e, speed: 22, size: 3.0, indestructible: true, cap: 16 },
};
