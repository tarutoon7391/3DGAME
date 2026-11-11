// 武器データを書くための小さな部品（weapons_a.js・weapons_b.js から使う）
// 部品は [種類, 形の数値, 色, 位置, 回転, 拡大] の配列。組み立ては src/weaponmodel.js
export const PI = Math.PI;

const part = (kind, args, c, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => [kind, args, c, [x, y, z], [rx, ry, rz]];

/** 箱 */
export const B = (w, h, d, c, x, y, z, rx, ry, rz) => part('b', [w, h, d], c, x, y, z, rx, ry, rz);
/** 円柱（seg を少なくすると角柱。th0・thLen で扇形） */
export const C = (rt, rb, h, c, x, y, z, rx, ry, rz, seg = 8, th0 = 0, thLen = 0) =>
  part('c', thLen ? [rt, rb, h, seg, th0, thLen] : [rt, rb, h, seg], c, x, y, z, rx, ry, rz);
/** 球 */
export const S = (r, c, x, y, z) => part('s', [r], c, x, y, z);
/** 円すい（先は +Y） */
export const K = (r, h, c, x, y, z, rx, ry, rz, seg = 6) => part('k', [r, h, seg], c, x, y, z, rx, ry, rz);
/** 輪（XY 平面。arc で途中まで） */
export const T = (r, tube, c, x, y, z, rx, ry, rz, arc = 0) => part('t', arc ? [r, tube, 12, arc] : [r, tube, 12], c, x, y, z, rx, ry, rz);
/** 八面体（宝石・結晶） */
export const O = (r, c, x, y, z, rx, ry, rz) => part('o', [r], c, x, y, z, rx, ry, rz);
/** 光る色 */
export const G = (c) => ({ c });
/** 部品に拡大を付ける */
export const sc = (p, sx, sy, sz) => [...p.slice(0, 5), [sx, sy, sz]];
/** n 個並べる */
export const rep = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

/** 刃（断面がひし形。y0 から上へ len。taper で先を細く） */
export const blade = (len, w, th, c, y0 = 0.11, x = 0, z = 0, rz = 0, taper = 1) =>
  sc(part('c', [0.5 * taper, 0.5, 1, 4], c, x, y0 + len / 2, z, 0, 0, rz), w, len, th);
/** 刃先 */
export const tip = (w, th, len, c, y, x = 0, z = 0, rz = 0) => sc(part('k', [0.5, 1, 4], c, x, y + len / 2, z, 0, 0, rz), w, len, th);
/** 柄（y0 から上へ len） */
export const haft = (len, c = 'W', r = 0.017, y0 = -0.1) => C(r, r, len, c, 0, y0 + len / 2, 0);

/** 片手剣の基本形 */
export function sword({ len = 0.5, w = 0.07, th = 0.025, c = 'm', guard = 0.2, gc = 'au', grip = 'g', gl = 0.16, pom = 'au', tipLen = 0.09 } = {}) {
  return [
    C(0.02, 0.022, gl, grip, 0, 0.0, 0),
    B(guard, 0.03, 0.05, gc, 0, gl / 2 + 0.02, 0),
    blade(len, w, th, c, gl / 2 + 0.035),
    tip(w, th, tipLen, c, gl / 2 + 0.035 + len),
    S(0.028, pom, 0, -gl / 2 - 0.015, 0),
  ];
}

/** 杖の柄と石突き（先端の飾りは各職で付ける）。top は柄の上端の高さ */
export function staff(c = 'W', top = 0.7, bottom = -0.3, r = 0.018) {
  return [C(r, r * 1.1, top - bottom, c, 0, (top + bottom) / 2, 0), K(r * 1.2, 0.05, 'd', 0, bottom - 0.02, 0, PI)];
}
