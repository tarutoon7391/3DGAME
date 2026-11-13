// 職業ごとの衣装スキン（周りから見える三人称の体だけ。一人称の腕と手に持つ武器は変えない）
// COSTUMES[職業id] = { body: 服の色（体と腕。被弾の赤い光る色はこの材質に乗る）, cape: マントの色（省くとなし）, pants, skin, build(h) }
// 中身は costumes_*.js の make(k, h)（k は costume_kit.js の道具）。髪とはちまきは衣装側で描くので、標準のものは付けない
import { box, cone, mat, part } from './models.js';
import { kit, metal } from './costume_kit.js';
import { COSTUMES_A } from './costumes_a.js';
import { COSTUMES_B } from './costumes_b.js';
import { COSTUMES_C } from './costumes_c.js';
import { COSTUMES_D } from './costumes_d.js';
import { COSTUMES_E } from './costumes_e.js';
import { COSTUMES_F } from './costumes_f.js';
import { COSTUMES_G } from './costumes_g.js';
import { COSTUMES_H } from './costumes_h.js';

const DEFS = {
  // 剣士：黄色の服に鉛色の軽い鎧。金髪
  swordsman: {
    body: 0xffff33,
    cape: 0xf2d22e,
    make(k, h) {
      const lead = metal(0x8c97a3); // 鉛色の鎧
      const leadDark = metal(0x5f6973);
      const gold = metal(0xffd23a);
      const hair = mat(0xf6d465); // 金髪
      const hairDark = mat(0xd9a93a);
      const leather = mat(0x6b4423);
      const tunic = mat(0xffff33);
      const R = h.root;
      // ---- 髪（金髪・前髪とはねた毛先） ----
      part(box(0.56, 0.16, 0.56), hair, 0, 2.13, -0.02, R);
      part(box(0.56, 0.4, 0.14), hair, 0, 1.94, -0.22, R); // 後ろ髪
      part(box(0.06, 0.28, 0.42), hair, -0.27, 1.96, -0.04, R); // もみあげ
      part(box(0.06, 0.28, 0.42), hair, 0.27, 1.96, -0.04, R);
      for (const [x, ry] of [[-0.16, 0.25], [0, 0], [0.16, -0.25]]) {
        const b = part(box(0.17, 0.13, 0.07), hair, x, 2.03, 0.24, R); // 前髪
        b.rotation.z = ry;
      }
      for (const [x, z, rz, rx] of [[-0.14, 0.05, 0.5, 0.2], [0.1, 0.1, -0.4, 0.3], [0, -0.12, 0.1, -0.5], [-0.2, -0.18, 0.7, -0.4], [0.2, -0.16, -0.7, -0.3]]) {
        const s = part(cone(0.09, 0.22, 4), x < 0 ? hair : hairDark, x, 2.25, z, R); // はねた毛
        s.rotation.set(rx, 0, rz);
      }
      part(box(0.5, 0.05, 0.06), gold, 0, 2.08, 0.255, R); // 金のサークレット
      part(box(0.08, 0.08, 0.02), metal(0x4fc3f7), 0, 2.08, 0.29, R); // 額の石
      // ---- 胴：鉛の胸当て・ベルト・腰の布 ----
      part(box(0.73, 0.4, 0.46), lead, 0, 1.38, 0, R);
      part(box(0.5, 0.06, 0.02), leadDark, 0, 1.3, 0.245, R); // 胸当ての段
      part(box(0.1, 0.36, 0.02), metal(0xffff33), 0, 1.38, 0.25, R); // 胸の黄色いライン
      part(box(0.74, 0.09, 0.47), leather, 0, 0.98, 0, R); // ベルト
      part(box(0.13, 0.11, 0.03), gold, 0, 0.98, 0.25, R); // バックル
      part(box(0.72, 0.26, 0.45), tunic, 0, 0.8, 0, R); // 腰の布（チュニックの裾）
      part(box(0.72, 0.04, 0.46), mat(0xc9a000), 0, 0.68, 0, R); // 裾のふち
      // ---- 肩当て・籠手（腕と一緒に動く） ----
      for (const arm of [h.armL, h.armR]) {
        part(box(0.32, 0.14, 0.32), lead, 0, 0.02, 0, arm);
        part(box(0.33, 0.04, 0.33), metal(0xffff33), 0, -0.06, 0, arm);
        part(box(0.23, 0.22, 0.25), lead, 0, -0.5, 0, arm);
      }
      // ---- すね当て・ブーツ（脚と一緒に動く） ----
      for (const leg of [h.legL, h.legR]) {
        if (!leg) continue;
        part(box(0.27, 0.3, 0.31), lead, 0, -0.56, 0.01, leg);
        part(box(0.12, 0.1, 0.03), metal(0xffff33), 0, -0.44, 0.17, leg); // ひざの金具
        part(box(0.27, 0.13, 0.36), leather, 0, -0.77, 0.03, leg);
      }
    },
  },
  ...COSTUMES_A,
  ...COSTUMES_B,
  ...COSTUMES_C,
  ...COSTUMES_D,
  ...COSTUMES_E,
  ...COSTUMES_F,
  ...COSTUMES_G,
  ...COSTUMES_H,
};

export const COSTUMES = {};
for (const [id, d] of Object.entries(DEFS)) {
  // build(h) → { ticks：毎フレーム動かす処理（浮かぶ小石・魂の炎など）, onShot：弾を撃ったとき（双子） }
  COSTUMES[id] = { ...d, build: (h) => { const k = kit(h); d.make(k, h); return { ticks: k.ticks, onShot: k.onShot }; } };
}
