// 小物ユーティリティ（乱数・当たり判定）

export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * 線分 a→b が球（中心 c・半径 r）に触れるか。高速な弾のすり抜け防止用
 * Vector3 を受け取るが new はしない
 */
export function segHitsSphere(a, b, c, r) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const fx = c.x - a.x, fy = c.y - a.y, fz = c.z - a.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  let t = len2 > 0 ? (fx * dx + fy * dy + fz * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = a.x + dx * t - c.x, py = a.y + dy * t - c.y, pz = a.z + dz * t - c.z;
  return px * px + py * py + pz * pz <= r * r;
}

/** 2点間距離の2乗 */
export function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/** 数値を 3 桁区切りに */
export const fmt = (n) => Math.floor(n).toLocaleString('ja-JP');
