// 衣装スキンの部品（costumes*.js から使う）。体の寸法は models.js の humanoid に合わせている
//   頭：x±0.25・y1.6〜2.1・z±0.25（顔は +Z）　胴：x±0.35・y0.83〜1.58・z±0.21
//   腕：肩（y1.52）から下へ 0.62、手は -0.68　脚：腰（y0.82）から下へ 0.82
import * as THREE from 'three';
import { box, cone, cyl, sphere, geo, mat, part } from './models.js';

/** 金属の材質（少し光る） */
export const metal = (c) => mat(c, { metalness: 0.55, roughness: 0.45 });
/** 光る材質（暗い所でも色が見える） */
export const glow = (c) => mat(c, { emissive: c, emissiveIntensity: 0.8 });

/**
 * 体 h に部品を付ける道具一式
 * 位置はどれも親（既定は胴の根元 h.root）から見た座標。色は数値か材質
 */
export function kit(h) {
  const R = h.root;
  const M = (c) => (typeof c === 'number' ? mat(c) : c);
  const ticks = [];
  const k = {
    R,
    ticks,
    /** 毎フレーム動かす処理を足す（fn(t)：t は秒） */
    tick(fn) { ticks.push(fn); },
    /** 弾を撃ったときに呼ばれる処理（fn(color)：弾の色。双子の色の切り替え） */
    onShot: null,
    /** 個体ごとの材質（色をあとで変えるもの） */
    own: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, flatShading: true }),
    arms: [h.armL, h.armR], // [左腕, 右腕（武器を持つ側）]
    /** 色以外も指定した材質（{ color, transparent, opacity, emissive … }） */
    mat: ({ color, ...rest }) => mat(color, rest),
    legs: [h.legL, h.legR].filter(Boolean),
    /** 箱 */
    b(w, hh, d, c, x = 0, y = 0, z = 0, parent = R, rx = 0, ry = 0, rz = 0) {
      const o = part(box(w, hh, d), M(c), x, y, z, parent);
      o.rotation.set(rx, ry, rz);
      return o;
    },
    /** 円すい */
    cn(r, hh, c, x = 0, y = 0, z = 0, parent = R, rx = 0, ry = 0, rz = 0, seg = 6) {
      const o = part(cone(r, hh, seg), M(c), x, y, z, parent);
      o.rotation.set(rx, ry, rz);
      return o;
    },
    /** 円柱（rt：上の半径, rb：下の半径） */
    cy(rt, rb, hh, c, x = 0, y = 0, z = 0, parent = R, rx = 0, ry = 0, rz = 0, seg = 8) {
      const o = part(cyl(rt, rb, hh, seg), M(c), x, y, z, parent);
      o.rotation.set(rx, ry, rz);
      return o;
    },
    /** 輪（ロープの束・腕輪など） */
    tor(r, tube, c, x = 0, y = 0, z = 0, parent = R, rx = 0, ry = 0, rz = 0) {
      const o = part(geo(`tor${r}_${tube}`, () => new THREE.TorusGeometry(r, tube, 5, 10)), M(c), x, y, z, parent);
      o.rotation.set(rx, ry, rz);
      return o;
    },
    /** 球 */
    sp(r, c, x = 0, y = 0, z = 0, parent = R) {
      return part(sphere(r, 8, 6), M(c), x, y, z, parent);
    },

    // ---------------- 髪 ----------------
    /**
     * style：short（短髪）, long（肩まで）, messy（ボサボサ）, spiky（逆立つ）, tied（後ろで束ねる）, bob（おかっぱ）
     */
    hair(c, style = 'short') {
      const m = M(c);
      if (style !== 'spiky') k.b(0.56, 0.14, 0.56, m, 0, 2.13, -0.02);
      if (style === 'short' || style === 'tied') {
        k.b(0.56, 0.32, 0.12, m, 0, 1.96, -0.24);
        k.b(0.56, 0.08, 0.1, m, 0, 2.06, 0.23); // 前髪
      }
      if (style === 'tied') {
        k.b(0.14, 0.12, 0.14, m, 0, 1.98, -0.34);
        k.b(0.11, 0.42, 0.1, m, 0, 1.72, -0.36, R, 0.15);
      }
      if (style === 'bob') {
        k.b(0.58, 0.42, 0.14, m, 0, 1.9, -0.23);
        k.b(0.07, 0.4, 0.46, m, -0.285, 1.91, -0.02);
        k.b(0.07, 0.4, 0.46, m, 0.285, 1.91, -0.02);
        k.b(0.56, 0.1, 0.1, m, 0, 2.05, 0.23);
      }
      if (style === 'long') {
        k.b(0.58, 0.72, 0.14, m, 0, 1.76, -0.23);
        k.b(0.07, 0.5, 0.4, m, -0.285, 1.86, -0.05);
        k.b(0.07, 0.5, 0.4, m, 0.285, 1.86, -0.05);
        k.b(0.56, 0.1, 0.1, m, 0, 2.05, 0.23);
      }
      if (style === 'messy' || style === 'spiky') {
        if (style === 'messy') k.b(0.58, 0.36, 0.14, m, 0, 1.95, -0.23);
        else k.b(0.56, 0.12, 0.56, m, 0, 2.12, -0.02);
        const up = style === 'spiky' ? 0.34 : 0.22;
        for (const [x, z, rz, rx] of [[-0.18, 0.12, 0.6, 0.3], [0, 0.14, 0, 0.45], [0.18, 0.12, -0.6, 0.3], [-0.2, -0.12, 0.7, -0.3], [0.04, -0.06, -0.1, -0.2], [0.2, -0.16, -0.7, -0.4], [-0.06, -0.22, 0.2, -0.7]]) {
          k.cn(0.1, up, m, x, 2.2 + up * 0.3, z, R, rx, 0, rz, 4);
        }
        k.b(0.56, 0.1, 0.08, m, 0, 2.05, 0.24); // 前髪
      }
    },

    // ---------------- 服 ----------------
    /** すそ（ローブ・スカート）。top から bottom まで。flare：すその広がり */
    skirt(c, top = 1.0, bottom = 0.12, flare = 0.12, front = true) {
      const hh = top - bottom;
      const o = k.cy(0.4, 0.4 + flare, hh, c, 0, bottom + hh / 2, 0, R, 0, Math.PI / 8);
      o.scale.z = 0.7;
      if (!front) o.position.z = -0.04;
      return o;
    },
    /** 腰巻き（前後の垂れ布） */
    loincloth(c, len = 0.45) {
      k.b(0.4, len, 0.04, c, 0, 0.92 - len / 2, 0.23);
      k.b(0.4, len, 0.04, c, 0, 0.92 - len / 2, -0.23);
    },
    /** ベルト（buckle：バックルの色） */
    belt(c, buckle = null, y = 0.98) {
      k.b(0.74, 0.09, 0.46, c, 0, y, 0);
      if (buckle != null) k.b(0.13, 0.11, 0.03, buckle, 0, y, 0.24);
    },
    /** 腕の袖をかぶせる（wide：先が広がった袖） */
    sleeves(c, wide = false, len = 0.5) {
      for (const a of k.arms) {
        k.b(0.24, len, 0.26, c, 0, -len / 2 + 0.02, 0, a);
        if (wide) k.b(0.3, 0.2, 0.32, c, 0, -len + 0.06, 0, a);
      }
    },
    /** 肩当て */
    pads(c, w = 0.32, hh = 0.14) {
      for (const a of k.arms) k.b(w, hh, w, c, 0, 0.02, 0, a);
    },
    /** 手袋・籠手（len：手首から上の長さ） */
    gloves(c, len = 0.2) {
      for (const a of k.arms) k.b(0.22, len, 0.24, c, 0, -0.62 + len / 2 - 0.02, 0, a);
    },
    /** ブーツ（hh：高さ） */
    boots(c, hh = 0.2) {
      for (const l of k.legs) k.b(0.27, hh, 0.33, c, 0, -0.82 + hh / 2, 0.02, l);
    },
    /** ズボンの上に巻くもの（脚絆・すね当てなど） */
    shins(c, top = -0.35, bottom = -0.72) {
      for (const l of k.legs) k.b(0.27, top - bottom, 0.31, c, 0, (top + bottom) / 2, 0.01, l);
    },
    /** 胴の上に重ねる板（胸当て・ベストなど） */
    chest(c, top = 1.58, bottom = 1.1, depth = 0.46) {
      return k.b(0.73, top - bottom, depth, c, 0, (top + bottom) / 2, 0);
    },
    /** 首巻き・マフラー */
    scarf(c, tail = 0.3) {
      k.b(0.56, 0.12, 0.5, c, 0, 1.6, 0);
      if (tail) k.b(0.14, tail, 0.06, c, 0.14, 1.55 - tail / 2, -0.26, R, 0.15);
    },
    /** 腰の小物入れ */
    pouch(c, x, y = 0.9, z = 0.2, s = 0.14) {
      return k.b(s, s, s * 0.8, c, x, y, z);
    },

    // ---------------- 頭 ----------------
    /** とんがり帽子 */
    wizardHat(c, band = null, tilt = -0.2) {
      k.cy(0.42, 0.42, 0.05, c, 0, 2.15, 0, R, 0, 0, 0, 10);
      const t = k.cn(0.28, 0.72, c, 0, 2.5, -0.04, R, tilt, 0, 0, 8);
      if (band != null) k.cy(0.29, 0.3, 0.07, band, 0, 2.2, 0, R, 0, 0, 0, 8);
      return t;
    },
    /** はちまき（tails：後ろの結び目の垂れ） */
    headband(c, tails = true) {
      k.b(0.54, 0.08, 0.54, c, 0, 2.0, 0);
      if (tails) {
        k.b(0.07, 0.24, 0.03, c, 0.06, 1.88, -0.29, R, 0.3, 0, 0.2);
        k.b(0.07, 0.2, 0.03, c, -0.06, 1.9, -0.29, R, 0.3, 0, -0.25);
      }
    },
    /** 顔の下半分を覆う布 */
    mask(c) {
      k.b(0.54, 0.2, 0.06, c, 0, 1.73, 0.26);
      k.b(0.06, 0.2, 0.5, c, -0.27, 1.73, 0);
      k.b(0.06, 0.2, 0.5, c, 0.27, 1.73, 0);
    },
    /** 頭巾・フード（open：顔の所を開ける） */
    hood(c, down = false) {
      if (down) {
        // 下ろしたフード（首の後ろにたまる）
        k.b(0.6, 0.22, 0.24, c, 0, 1.6, -0.24);
        return;
      }
      k.b(0.6, 0.14, 0.6, c, 0, 2.15, -0.02);
      k.b(0.6, 0.56, 0.12, c, 0, 1.86, -0.27);
      k.b(0.06, 0.5, 0.52, c, -0.3, 1.88, -0.02);
      k.b(0.06, 0.5, 0.52, c, 0.3, 1.88, -0.02);
    },
    /** 目（色を変える。光らせるなら glow を渡す） */
    eyes(c, y = 1.88) {
      k.b(0.09, 0.11, 0.02, c, -0.12, y, 0.262);
      k.b(0.09, 0.11, 0.02, c, 0.12, y, 0.262);
    },
  };
  return k;
}
