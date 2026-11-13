// 衣装スキン その4（韋駄天〜火炎放射兵）。部品は costume_kit.js
import { metal, glow } from './costume_kit.js';

const LEATHER = 0x6b4423;
const GOLD = 0xffcc33;
const SKIN = 0xf1c27d;

/** 腕を素肌にする（袖なし） */
const bareArms = (k, c = SKIN) => { for (const a of k.arms) k.b(0.21, 0.62, 0.23, c, 0, -0.3, 0, a); };

/** 布を巻いた包帯（白い帯を何本か） */
const wraps = (k, parent, y0, n, w = 0.23, d = 0.25) => {
  for (let i = 0; i < n; i++) k.b(w, 0.035, d, 0xf5f0e6, 0, y0 - i * 0.06, 0, parent, 0, 0, (i % 2 ? 0.08 : -0.08));
};

export const COSTUMES_D = {
  // 韋駄天：羽根付きのくつ、短パンに袖なしの軽い服、はちまき
  speedster: {
    body: 0xffff8d, pants: SKIN,
    make(k) {
      k.hair(0xff8f00, 'spiky');
      k.headband(0xff6f00);
      bareArms(k);
      for (const a of k.arms) k.b(0.22, 0.08, 0.24, 0xff6f00, 0, -0.56, 0, a); // リストバンド
      k.b(0.04, 0.6, 0.02, 0xff6f00, -0.14, 1.2, 0.215); // 服のライン
      k.b(0.04, 0.6, 0.02, 0xff6f00, 0.14, 1.2, 0.215);
      for (const l of k.legs) k.b(0.27, 0.32, 0.31, 0xff6f00, 0, -0.16, 0, l); // 短パン
      k.belt(0xff6f00, null, 0.86);
      // 羽根付きのくつ
      k.boots(0xffffff, 0.16);
      for (const l of k.legs) for (const s of [-1, 1]) {
        k.b(0.03, 0.12, 0.2, 0xfff9c4, s * 0.15, -0.66, -0.06, l, -0.5, 0, s * -0.3);
        k.b(0.03, 0.08, 0.14, 0xfff9c4, s * 0.15, -0.6, -0.12, l, -0.8, 0, s * -0.3);
      }
    },
  },
  // 呪いの騎士：ひびの入った鎧に黒い紋様、赤く光る目、体に巻き付いた鎖
  cursed: {
    body: 0x3a3a40, cape: 0x4a0000, pants: 0x222226,
    make(k) {
      const ar = metal(0x4a4a52);
      k.b(0.56, 0.56, 0.56, ar, 0, 1.86, 0); // 兜
      k.b(0.4, 0.05, 0.02, 0x111111, 0, 1.88, 0.285);
      k.eyes(glow(0xff1744), 1.88);
      k.b(0.08, 0.36, 0.04, 0xb71c1c, 0, 2.24, -0.04); // 兜の赤い飾り
      k.chest(ar, 1.58, 0.98, 0.48);
      k.pads(ar, 0.36, 0.16);
      k.gloves(ar, 0.3);
      k.shins(ar, -0.3, -0.72);
      k.boots(metal(0x2a2a30), 0.14);
      // ひびと黒い紋様
      const crack = 0x0d0d0d;
      for (const [x, y, r, l] of [[-0.16, 1.4, 0.7, 0.24], [-0.08, 1.3, -0.4, 0.16], [0.18, 1.18, 1.1, 0.2], [0.1, 1.46, -0.9, 0.12]]) k.b(l, 0.025, 0.02, crack, x, y, 0.245, k.R, 0, 0, r);
      k.b(0.14, 0.14, 0.02, 0xb71c1c, 0, 1.24, 0.25, k.R, 0, 0, Math.PI / 4); // 胸の呪いの印
      k.b(0.08, 0.08, 0.02, crack, 0, 1.24, 0.255, k.R, 0, 0, Math.PI / 4);
      // 体に巻き付いた鎖（肩から斜めに・腰）
      const iron = metal(0x8d9399);
      for (let i = 0; i < 8; i++) k.tor(0.05, 0.016, iron, -0.3 + i * 0.085, 1.56 - i * 0.09, 0.25, k.R, 0, i % 2 ? Math.PI / 2 : 0, 0.8);
      for (let i = 0; i < 8; i++) k.tor(0.05, 0.016, iron, -0.3 + i * 0.085, 1.56 - i * 0.09, -0.25, k.R, 0, i % 2 ? Math.PI / 2 : 0, 0.8);
      for (let i = 0; i < 7; i++) k.tor(0.05, 0.016, iron, -0.32 + i * 0.106, 0.92, 0.25, k.R, 0, i % 2 ? Math.PI / 2 : 0, 0);
    },
  },
  // 背水の剣士：包帯、ボロボロのマントと軽鎧（満身創痍）
  desperado: {
    body: 0x6d5a50, cape: null, pants: 0x3e2f28,
    make(k) {
      k.hair(0x3a2418, 'messy');
      const lt = metal(0x8a8f96);
      k.chest(lt, 1.56, 1.14, 0.46);
      k.b(0.2, 0.025, 0.02, 0x333333, -0.1, 1.4, 0.235, k.R, 0, 0, 0.5); // 鎧の傷
      k.pads(lt, 0.3, 0.12);
      k.belt(LEATHER, metal(0x9e9e9e));
      // ボロボロのマント（明るい赤、すそがギザギザで穴あき）
      const red = 0xff8a80;
      k.b(0.66, 0.66, 0.05, red, 0, 1.22, -0.27);
      for (const [x, l] of [[-0.25, 0.3], [-0.1, 0.18], [0.04, 0.34], [0.2, 0.22]]) k.b(0.14, l, 0.05, red, x, 0.89 - l / 2, -0.27, k.R, 0, 0, (x * 0.3));
      k.b(0.1, 0.1, 0.06, 0x3e2f28, 0.12, 1.3, -0.27); // 穴
      k.b(0.74, 0.12, 0.5, red, 0, 1.58, 0, k.R, 0, 0, 0.05);
      // 包帯（頭・腕・胴）
      k.b(0.54, 0.06, 0.54, 0xf5f0e6, 0, 2.0, 0, k.R, 0, 0, 0.12);
      k.b(0.1, 0.06, 0.02, 0xc62828, 0.12, 2.03, 0.27); // にじんだ血
      wraps(k, k.arms[0], -0.2, 4);
      wraps(k, k.arms[1], -0.42, 3);
      k.b(0.12, 0.1, 0.02, 0xf5f0e6, -0.18, 1.78, 0.255, k.R, 0, 0, 0.4); // ほほの絆創膏
      k.b(0.75, 0.06, 0.48, 0xf5f0e6, 0, 1.06, 0, k.R, 0, 0, -0.1);
      for (const l of k.legs) wraps(k, l, -0.3, 2, 0.26, 0.3);
      k.boots(0x3e2723, 0.26);
    },
  },
  // 料理人：コック帽、コックコートにエプロン、腰にお玉
  cook: {
    body: 0xfafafa, pants: 0x37474f,
    make(k) {
      k.hair(0x5a3a1a, 'short');
      k.cy(0.27, 0.27, 0.16, 0xffffff, 0, 2.18, 0, k.R, 0, 0, 0, 10); // コック帽
      k.cy(0.36, 0.28, 0.3, 0xffffff, 0, 2.42, 0, k.R, 0, 0, 0, 10);
      k.sp(0.2, 0xffffff, -0.14, 2.56, 0);
      k.sp(0.2, 0xffffff, 0.14, 2.56, 0);
      k.sp(0.2, 0xffffff, 0, 2.6, 0.08);
      k.b(0.52, 0.12, 0.48, 0xffcc80, 0, 1.6, 0); // 首のスカーフ
      k.cn(0.08, 0.14, 0xffcc80, 0, 1.5, 0.24, k.R, Math.PI, 0, 0, 4);
      for (const y of [1.42, 1.28, 1.14]) for (const x of [-0.12, 0.12]) k.sp(0.03, 0x9e9e9e, x, y, 0.22); // ダブルのボタン
      // エプロン（腰から膝下）
      k.b(0.6, 0.62, 0.03, 0xffcc80, 0, 0.66, 0.25);
      k.belt(0xffcc80, null, 0.98);
      k.b(0.2, 0.12, 0.03, 0xffb74d, 0, 0.8, 0.27); // ポケット
      // 腰のお玉
      k.b(0.03, 0.34, 0.03, metal(0xbdbdbd), 0.36, 0.86, 0.12, k.R, 0, 0, 0.15);
      k.sp(0.08, metal(0xbdbdbd), 0.33, 0.68, 0.12);
      k.boots(0x1a1a1a, 0.12);
    },
  },
  // 酔拳家：ゆるい中華風の服、ひょうたん、少し赤い顔
  drunkard: {
    body: 0xffab91, pants: 0x5d4037,
    make(k) {
      k.hair(0x2a2a2a, 'tied');
      k.b(0.1, 0.06, 0.02, 0xef5350, -0.16, 1.78, 0.255); // 赤いほほ
      k.b(0.1, 0.06, 0.02, 0xef5350, 0.16, 1.78, 0.255);
      k.b(0.18, 0.04, 0.02, 0xef5350, 0, 1.94, 0.255);
      // ゆるい服：立ち襟・飾りボタン・広い袖・腰の帯
      k.b(0.5, 0.1, 0.46, 0xff8a65, 0, 1.6, 0);
      k.b(0.06, 0.5, 0.02, 0xff8a65, 0.1, 1.34, 0.22, k.R, 0, 0, -0.2);
      for (const y of [1.44, 1.3, 1.16]) k.b(0.1, 0.03, 0.02, GOLD, 0.06, y, 0.225);
      for (const a of k.arms) k.b(0.32, 0.48, 0.34, 0xffab91, 0, -0.32, 0, a);
      k.skirt(0xffab91, 0.98, 0.58, 0.1);
      k.belt(0x8d3a1e, null, 0.96);
      k.b(0.1, 0.3, 0.03, 0x8d3a1e, -0.2, 0.8, 0.24, k.R, 0, 0, -0.15);
      for (const l of k.legs) k.b(0.3, 0.4, 0.33, 0x5d4037, 0, -0.42, 0, l); // ゆったりズボン
      k.boots(0x1a1a1a, 0.1);
      // ひょうたん（左腰）
      k.sp(0.12, 0xd4a440, 0.36, 0.76, 0.1);
      k.sp(0.08, 0xd4a440, 0.36, 0.92, 0.1);
      k.b(0.08, 0.02, 0.08, 0xc62828, 0.36, 0.86, 0.1);
      k.b(0.04, 0.06, 0.04, 0x5d4037, 0.36, 1.01, 0.1);
    },
  },
  // 狙撃手：草や葉っぱを付けた迷彩マント、双眼鏡
  sniper: {
    body: 0x6b7a4a, pants: 0x4a5236,
    make(k) {
      k.hair(0x4a3020, 'short');
      k.b(0.56, 0.14, 0.58, 0x556b2f, 0, 2.14, 0.02); // 帽子
      k.b(0.56, 0.03, 0.2, 0x556b2f, 0, 2.08, 0.32);
      // 迷彩マント（肩から背中、草と葉っぱ）
      const leaves = [0xa5d6a7, 0x689f38, 0x8bc34a, 0x556b2f];
      k.b(0.82, 0.24, 0.56, 0x6b7a4a, 0, 1.56, -0.02);
      k.b(0.76, 0.86, 0.08, 0x6b7a4a, 0, 1.12, -0.26);
      for (let i = 0; i < 18; i++) {
        const x = -0.34 + (i % 6) * 0.135;
        const y = 1.5 - Math.floor(i / 6) * 0.3;
        k.b(0.12, 0.06, 0.02, leaves[i % 4], x, y, -0.31, k.R, 0.2, 0, (i % 3 - 1) * 0.6);
      }
      for (let i = 0; i < 6; i++) k.b(0.12, 0.06, 0.02, leaves[i % 4], -0.3 + i * 0.12, 1.7, 0.1 * (i % 2 ? 1 : -1), k.R, 0.4, 0, (i % 3 - 1) * 0.7);
      for (const x of [-0.3, -0.12, 0.06, 0.24]) k.cn(0.05, 0.18, 0x689f38, x, 0.62, -0.28, k.R, Math.PI, 0, 0, 3);
      k.belt(LEATHER, null);
      // 胸の双眼鏡（首ひも）
      k.b(0.02, 0.3, 0.02, 0x3e2723, -0.12, 1.5, 0.23, k.R, 0, 0, -0.4);
      k.b(0.02, 0.3, 0.02, 0x3e2723, 0.12, 1.5, 0.23, k.R, 0, 0, 0.4);
      for (const x of [-0.07, 0.07]) k.cy(0.055, 0.055, 0.16, 0x263238, x, 1.32, 0.27, k.R, Math.PI / 2);
      k.b(0.06, 0.06, 0.08, 0x263238, 0, 1.32, 0.27);
      k.gloves(0x3e3a2a, 0.2);
      k.boots(0x3e2723, 0.32);
    },
  },
  // 予言者：目隠し、白いローブ、目の模様の首飾り
  prophet: {
    body: 0xfff9c4, pants: 0xf0ead0,
    make(k) {
      k.hair(0xfafafa, 'long');
      k.b(0.56, 0.12, 0.56, 0xf5f5f5, 0, 1.88, 0); // 目隠し
      k.b(0.08, 0.3, 0.03, 0xf5f5f5, 0.06, 1.74, -0.29, k.R, 0.2, 0, 0.2);
      k.skirt(0xfafafa, 1.0, 0.08, 0.16);
      k.sleeves(0xfafafa, true, 0.54);
      k.b(0.74, 0.7, 0.46, 0xfafafa, 0, 1.22, 0);
      k.b(0.6, 0.05, 0.2, 0xfff9c4, 0, 0.12, 0.22);
      k.belt(0xfff9c4, null);
      // 目の模様の首飾り
      k.b(0.02, 0.24, 0.02, metal(GOLD), -0.1, 1.5, 0.235, k.R, 0, 0, -0.45);
      k.b(0.02, 0.24, 0.02, metal(GOLD), 0.1, 1.5, 0.235, k.R, 0, 0, 0.45);
      const m = k.cy(0.11, 0.11, 0.03, metal(GOLD), 0, 1.32, 0.245, k.R, Math.PI / 2, 0, 0, 10);
      m.scale.z = 0.6;
      k.cy(0.07, 0.07, 0.035, 0xffffff, 0, 1.32, 0.25, k.R, Math.PI / 2, 0, 0, 10).scale.z = 0.6;
      k.sp(0.035, glow(0x4fc3f7), 0, 1.32, 0.27);
    },
  },
  // 鬼：角、虎柄の腰巻き、赤い肌（体の大きさはほかと同じ）
  oni: {
    body: 0xef5350, pants: 0xef5350, skin: 0xef5350,
    make(k) {
      k.hair(0x1a1a1a, 'messy');
      k.cn(0.07, 0.26, 0xfff3d0, -0.14, 2.3, 0.04, k.R, 0, 0, 0.2, 5); // 角
      k.cn(0.07, 0.26, 0xfff3d0, 0.14, 2.3, 0.04, k.R, 0, 0, -0.2, 5);
      k.eyes(0xffeb3b);
      k.cn(0.03, 0.06, 0xffffff, -0.08, 1.7, 0.255, k.R, Math.PI, 0, 0, 3); // 牙
      k.cn(0.03, 0.06, 0xffffff, 0.08, 1.7, 0.255, k.R, Math.PI, 0, 0, 3);
      // 虎柄の腰巻き
      const tg = 0xffb300;
      k.b(0.76, 0.34, 0.48, tg, 0, 0.82, 0);
      for (let i = 0; i < 6; i++) {
        const x = -0.3 + i * 0.12;
        k.b(0.04, 0.3, 0.02, 0x1a1a1a, x, 0.82, 0.245, k.R, 0, 0, 0.3);
        k.b(0.04, 0.3, 0.02, 0x1a1a1a, x, 0.82, -0.245, k.R, 0, 0, -0.3);
      }
      k.b(0.78, 0.06, 0.5, 0x5d4037, 0, 0.99, 0);
      for (const a of k.arms) k.tor(0.12, 0.03, metal(GOLD), 0, -0.5, 0, a, Math.PI / 2);
      k.boots(0x1a1a1a, 0.06);
    },
  },
  // 幽霊：額の三角の布、白い着物、足元が透けている
  ghost: {
    body: 0xf4f6f8, pants: 0xeceff1, skin: 0xdfe6ea,
    make(k) {
      k.hair(0x1a1a1a, 'long');
      k.cn(0.12, 0.16, 0xffffff, 0, 2.1, 0.27, k.R, 0, 0, Math.PI, 3); // 額の三角の布
      k.b(0.54, 0.03, 0.54, 0xffffff, 0, 2.06, 0);
      k.b(0.06, 0.4, 0.04, 0xbdbdbd, -0.1, 1.4, 0.215, k.R, 0, 0, -0.45); // 着物の合わせ（左前）
      for (const a of k.arms) k.b(0.32, 0.52, 0.34, 0xf4f6f8, 0, -0.3, 0, a);
      k.b(0.74, 0.08, 0.47, 0xb0bec5, 0, 1.0, 0);
      // すそはだんだん透ける
      const fade = (o) => k.mat({ color: 0xf4f6f8, transparent: true, opacity: o, depthWrite: false });
      k.skirt(fade(0.85), 0.98, 0.62, 0.06);
      k.skirt(fade(0.45), 0.62, 0.32, 0.12);
      k.skirt(fade(0.15), 0.32, 0.1, 0.18);
      const ghostLeg = k.mat({ color: 0xeceff1, transparent: true, opacity: 0.12, depthWrite: false });
      for (const l of k.legs) l.traverse((o) => { if (o.isMesh) o.material = ghostLeg; });
    },
  },
  // 双子：大きなリボン。ピンクの弾を撃つとピンク、水色の弾を撃つと水色に切り替わる
  twins: {
    body: 0xf48fb1, pants: 0x4a3a4a,
    make(k, h) {
      const PINK = 0xf48fb1;
      const BLUE = 0x81d4fa;
      const main = k.own(PINK); // 切り替わる色（リボン・服）
      const dark = k.own(0xc2185b);
      k.hair(0xf5deb3, 'bob');
      // 大きなリボン（頭の上）
      k.b(0.14, 0.14, 0.1, main, 0, 2.24, -0.06);
      k.b(0.3, 0.22, 0.06, main, -0.2, 2.28, -0.06, k.R, 0, 0, 0.35);
      k.b(0.3, 0.22, 0.06, main, 0.2, 2.28, -0.06, k.R, 0, 0, -0.35);
      k.b(0.08, 0.26, 0.04, dark, -0.08, 2.08, -0.12, k.R, 0, 0, 0.25);
      k.b(0.08, 0.26, 0.04, dark, 0.08, 2.08, -0.12, k.R, 0, 0, -0.25);
      // ワンピース（フリル・白い襟）
      k.skirt(main, 0.98, 0.5, 0.18);
      k.b(0.62, 0.05, 0.24, 0xffffff, 0, 0.52, 0.22);
      k.b(0.5, 0.1, 0.48, 0xffffff, 0, 1.58, 0);
      k.b(0.12, 0.1, 0.03, dark, 0, 1.46, 0.23);
      for (const a of k.arms) k.b(0.28, 0.16, 0.3, main, 0, -0.05, 0, a);
      k.belt(dark, null, 1.0);
      k.boots(0xffffff, 0.12);
      for (const l of k.legs) k.b(0.28, 0.06, 0.34, dark, 0, -0.72, 0.02, l);
      const set = (blue) => {
        h.torso.material.color.setHex(blue ? BLUE : PINK);
        main.color.setHex(blue ? BLUE : PINK);
        dark.color.setHex(blue ? 0x0277bd : 0xc2185b);
      };
      // 弾の色が青っぽければ水色、それ以外はピンク
      k.onShot = (color) => {
        if (color == null) return;
        set((color & 255) > ((color >> 16) & 255));
      };
    },
  },
  // マシンガンナー：タンクトップに迷彩パンツ、ヘッドセット、肩にかけた弾帯
  machinegunner: {
    body: 0xbdbdbd, pants: 0x556b2f,
    make(k) {
      k.hair(0x3a2a1a, 'short');
      bareArms(k);
      // ヘッドセット
      k.b(0.6, 0.05, 0.1, 0x212121, 0, 2.16, 0);
      for (const s of [-1, 1]) k.b(0.06, 0.16, 0.16, 0x212121, s * 0.28, 1.9, 0);
      k.b(0.02, 0.02, 0.24, 0x212121, 0.28, 1.78, 0.14, k.R, 0, -0.5, 0);
      k.sp(0.03, 0x424242, 0.2, 1.76, 0.27);
      // 迷彩パンツ
      const camo = [0x3e4a24, 0x8d7b4a, 0x2e3a1c];
      for (const l of k.legs) camo.forEach((c, i) => k.b(0.12, 0.12, 0.02, c, (i - 1) * 0.07, -0.2 - i * 0.18, 0.15, l));
      k.belt(0x3e2723, metal(0x9e9e9e), 0.86);
      // 弾帯（肩から斜めに、2本）
      for (const s of [-1, 1]) {
        const band = k.b(0.1, 1.0, 0.48, 0x5d4037, 0, 1.22, 0, k.R, 0, 0, s * 0.6);
        for (let i = -3; i <= 3; i++) k.b(0.05, 0.06, 0.03, metal(0xd4a440), 0, i * 0.12, 0.25, band);
      }
      k.gloves(0x212121, 0.14);
      k.boots(0x212121, 0.32);
    },
  },
  // 火炎放射兵：耐火服とガスマスク、背中の燃料タンク
  flamer: {
    body: 0xff7043, pants: 0xff7043,
    make(k) {
      const suit = 0xff7043;
      const silver = metal(0xb0bec5);
      // 耐火服のフード
      k.b(0.6, 0.6, 0.6, suit, 0, 1.88, -0.02);
      k.b(0.44, 0.24, 0.04, 0x263238, 0, 1.94, 0.29); // ゴーグル
      k.b(0.16, 0.12, 0.02, glow(0xffab40), -0.1, 1.94, 0.31);
      k.b(0.16, 0.12, 0.02, glow(0xffab40), 0.1, 1.94, 0.31);
      k.cy(0.1, 0.12, 0.14, 0x37474f, 0, 1.72, 0.33, k.R, Math.PI / 2); // ガスマスク
      for (const s of [-1, 1]) k.cy(0.07, 0.07, 0.12, 0x455a64, s * 0.16, 1.7, 0.3, k.R, Math.PI / 2, s * 0.6);
      // 銀の反射帯と手袋・ブーツ
      for (const y of [1.2, 0.95]) k.b(0.73, 0.06, 0.46, silver, 0, y, 0);
      for (const a of k.arms) k.b(0.23, 0.06, 0.25, silver, 0, -0.3, 0, a);
      k.gloves(silver, 0.2);
      k.boots(0x37474f, 0.3);
      // 背中の燃料タンク（2本）とホース
      for (const x of [-0.14, 0.14]) {
        k.cy(0.12, 0.12, 0.66, 0xd84315, x, 1.2, -0.36);
        k.sp(0.12, 0xd84315, x, 1.53, -0.36);
        k.cy(0.125, 0.125, 0.04, silver, x, 1.05, -0.36);
      }
      k.b(0.4, 0.06, 0.06, silver, 0, 1.3, -0.24);
      k.cy(0.035, 0.035, 0.7, 0x212121, -0.32, 1.0, -0.2, k.R, 0.4, 0, 0.3);
    },
  },
};
