// 衣装スキン その7（人狼〜分裂射手）。部品は costume_kit.js
import { metal, glow } from './costume_kit.js';

const LEATHER = 0x6b4423;
const GOLD = 0xffcc33;
const SKIN = 0xf1c27d;

/** 矢筒（背中・斜め） */
export function quiver(k, body, rim, feather) {
  const q = k.cy(0.1, 0.09, 0.72, body, 0.12, 1.2, -0.36, k.R, 0, 0, -0.35);
  q.add(k.cy(0.11, 0.11, 0.05, rim, 0, 0.33, 0, q));
  for (const [x, z] of [[-0.04, 0], [0.04, 0.03], [0, -0.04]]) k.b(0.03, 0.2, 0.06, feather, x, 0.45, z, q);
  return q;
}

export const COSTUMES_G = {
  // 人狼：狼の耳、破れたシャツとズボン、鋭い爪
  werewolf: {
    body: 0xd7c4a8, pants: 0x4a5a6a,
    make(k) {
      const fur = 0xa1887f;
      k.hair(0x6d4c41, 'messy');
      for (const s of [-1, 1]) { // 狼の耳
        k.cn(0.1, 0.24, fur, s * 0.18, 2.3, -0.02, k.R, 0, 0, -s * 0.2, 4);
        k.cn(0.05, 0.14, 0xffccbc, s * 0.18, 2.28, 0.03, k.R, 0, 0, -s * 0.2, 4);
      }
      k.b(0.2, 0.06, 0.02, 0x3e2723, 0, 1.94, 0.255); // 太いまゆ
      k.b(0.4, 0.14, 0.06, fur, 0, 1.68, 0.24); // ほほのけもの毛
      // 破れたシャツ（すそと袖がギザギザ、胸元から毛）
      for (let i = 0; i < 6; i++) k.cn(0.06, 0.14, 0xd7c4a8, -0.3 + i * 0.12, 0.8, 0.2, k.R, Math.PI, 0, 0, 4);
      k.b(0.24, 0.3, 0.02, fur, 0, 1.42, 0.215);
      k.b(0.1, 0.12, 0.01, 0x8d7b6a, 0.18, 1.1, 0.215); // 破れ穴
      for (const a of k.arms) {
        k.b(0.21, 0.3, 0.23, fur, 0, -0.46, 0, a); // 毛深い腕
        for (const x of [-0.06, 0, 0.06]) k.cn(0.025, 0.1, 0xfafafa, x, -0.8, 0.08, a, Math.PI, 0, 0, 3); // 爪
      }
      // 破れたズボン（すそがギザギザ）と素足
      for (const l of k.legs) {
        for (const x of [-0.08, 0.04]) k.cn(0.05, 0.12, 0x4a5a6a, x, -0.62, 0.15, l, Math.PI, 0, 0, 4);
        k.b(0.25, 0.14, 0.29, fur, 0, -0.74, 0.01, l);
      }
      k.belt(0x3e2723, metal(0x9e9e9e), 0.86);
      k.b(0.14, 0.32, 0.12, fur, 0, 0.66, -0.3, k.R, -0.5); // しっぽ
    },
  },
  // 要塞兵：大きな肩当て、分厚い鉄の鎧（機械っぽく）
  fortress: {
    body: 0x78909c, pants: 0x455a64,
    make(k) {
      const iron = metal(0x90a4ae);
      const dark = metal(0x546e7a);
      // 兜（のぞき窓とランプ）
      k.b(0.6, 0.6, 0.6, iron, 0, 1.88, 0);
      k.b(0.44, 0.08, 0.02, 0x111111, 0, 1.9, 0.305);
      k.cy(0.06, 0.06, 0.04, glow(0xffee58), 0, 2.14, 0.3, k.R, Math.PI / 2);
      k.b(0.08, 0.2, 0.14, dark, 0, 2.24, -0.04); // アンテナの台
      k.b(0.02, 0.3, 0.02, dark, 0.2, 2.3, -0.2);
      // 分厚い胴（リベットと排気口）
      k.b(0.82, 0.74, 0.56, iron, 0, 1.24, 0);
      for (const x of [-0.3, 0.3]) for (const y of [1.52, 0.98]) k.sp(0.03, dark, x, y, 0.285);
      for (let i = 0; i < 3; i++) k.b(0.3, 0.04, 0.02, 0x263238, 0, 1.34 - i * 0.08, 0.285);
      k.cy(0.07, 0.07, 0.3, dark, -0.2, 1.4, -0.32); // 背中の排気筒
      k.cy(0.07, 0.07, 0.3, dark, 0.2, 1.4, -0.32);
      // 大きな肩当て
      for (const a of k.arms) {
        k.b(0.5, 0.3, 0.5, iron, 0, 0.06, 0, a);
        k.b(0.52, 0.06, 0.52, 0xffb300, 0, -0.06, 0, a);
        k.sp(0.04, dark, 0, 0.2, 0.25, a);
      }
      k.gloves(dark, 0.36);
      k.shins(iron, -0.1, -0.7);
      k.boots(dark, 0.18);
    },
  },
  // 治癒拳士：十字の刺繍が入った道着、緑の帯
  healfist: {
    body: 0xf5f5f0, pants: 0xf5f5f0,
    make(k) {
      const green = 0xa5d6a7;
      k.hair(0x3e2723, 'tied');
      k.b(0.06, 0.46, 0.04, 0xd0d0c8, -0.1, 1.38, 0.215, k.R, 0, 0, 0.45);
      k.b(0.06, 0.46, 0.04, 0xd0d0c8, 0.1, 1.38, 0.215, k.R, 0, 0, -0.45);
      // 十字の刺繍（胸と背中）
      k.b(0.05, 0.16, 0.02, green, 0.2, 1.38, 0.22);
      k.b(0.16, 0.05, 0.02, green, 0.2, 1.38, 0.22);
      k.b(0.1, 0.36, 0.02, green, 0, 1.26, -0.22);
      k.b(0.3, 0.1, 0.02, green, 0, 1.32, -0.22);
      for (const a of k.arms) k.b(0.23, 0.05, 0.25, green, 0, -0.42, 0, a); // 袖口
      // 緑の帯
      k.belt(0x43a047, null);
      k.b(0.1, 0.34, 0.04, 0x43a047, 0.14, 0.82, 0.24, k.R, 0, 0, 0.25);
      k.b(0.1, 0.3, 0.04, 0x43a047, 0.04, 0.84, 0.24, k.R, 0, 0, -0.2);
      k.gloves(0xfafafa, 0.18);
      k.boots(SKIN, 0.06);
    },
  },
  // 賢者：分厚い本、ゆったりした白いローブ、長いひげ
  sage: {
    body: 0xfafafa, pants: 0xeeeeee,
    make(k) {
      k.hair(0xeeeeee, 'long');
      // 長いひげ
      k.b(0.44, 0.24, 0.08, 0xf5f5f5, 0, 1.68, 0.26);
      k.cn(0.2, 0.5, 0xf5f5f5, 0, 1.36, 0.28, k.R, Math.PI, 0, 0, 4).scale.z = 0.4;
      k.b(0.24, 0.05, 0.03, 0xf5f5f5, 0, 1.78, 0.27); // 口ひげ
      k.skirt(0xfafafa, 1.0, 0.06, 0.2);
      k.sleeves(0xfafafa, true, 0.54);
      k.b(0.6, 0.06, 0.2, 0xfff59d, 0, 0.1, 0.24);
      for (const a of k.arms) k.b(0.32, 0.04, 0.34, 0xfff59d, 0, -0.5, 0, a);
      k.b(0.1, 1.4, 0.02, 0xfff59d, 0, 0.84, 0.235); // 前のライン
      k.belt(0xfff59d, metal(GOLD));
      // 分厚い本（左手に抱える）
      const L = k.arms[0];
      k.b(0.14, 0.42, 0.34, 0x6a3a1a, 0.02, -0.66, 0.1, L);
      k.b(0.12, 0.38, 0.3, 0xfff8e1, 0.0, -0.66, 0.1, L);
      k.b(0.15, 0.06, 0.35, metal(GOLD), 0.02, -0.56, 0.1, L);
      k.b(0.15, 0.06, 0.35, metal(GOLD), 0.02, -0.76, 0.1, L);
    },
  },
  // 曲芸師：星柄のサーカス衣装、腰に下げた輪っか
  acrobat: {
    body: 0xffd54f, pants: 0xffd54f,
    make(k) {
      k.hair(0xd84315, 'bob');
      // 星柄（赤い星）
      const star = 0xd32f2f;
      for (const [x, y, z] of [[-0.18, 1.4, 0.215], [0.16, 1.2, 0.215], [-0.06, 1.0, 0.215], [0.14, 1.42, -0.215], [-0.14, 1.06, -0.215]]) k.cy(0.06, 0.06, 0.02, star, x, y, z, k.R, Math.PI / 2, 0, 0, 5);
      for (const l of k.legs) k.cy(0.05, 0.05, 0.02, star, 0, -0.3, 0.145, l, Math.PI / 2, 0, 0, 5);
      // 肩と腰のフリル、首の襟
      for (const a of k.arms) k.b(0.3, 0.12, 0.32, 0xd32f2f, 0, -0.02, 0, a);
      k.b(0.5, 0.1, 0.48, 0xd32f2f, 0, 1.6, 0);
      k.skirt(0xd32f2f, 0.98, 0.78, 0.18);
      k.belt(0x1a237e, metal(GOLD), 0.98);
      // 腰に下げた輪っか（2つ）
      k.tor(0.22, 0.025, 0x1e88e5, 0.38, 0.82, 0.02, k.R, 0, Math.PI / 2, 0);
      k.tor(0.18, 0.025, 0xfafafa, 0.42, 0.8, 0.02, k.R, 0, Math.PI / 2, 0);
      k.boots(0x1a237e, 0.16);
      k.cn(0.06, 0.12, 0xd32f2f, 0, 2.3, 0, k.R, 0, 0, 0, 5); // 頭のポンポン
    },
  },
  // ドリル使い：安全ヘルメット、泥だらけの作業ツナギ
  driller: {
    body: 0xbdbdbd, pants: 0xbdbdbd,
    make(k) {
      k.hair(0x3e2723, 'short');
      // 安全ヘルメット（黄色・ライト付き）
      const hat = 0xfdd835;
      k.sp(0.32, hat, 0, 2.12, 0).scale.y = 0.65;
      k.cy(0.36, 0.36, 0.03, hat, 0, 2.06, 0.03, k.R, 0, 0, 0, 12);
      k.b(0.06, 0.14, 0.5, 0xf9a825, 0, 2.24, 0);
      k.cy(0.05, 0.05, 0.05, glow(0xfff9c4), 0, 2.12, 0.31, k.R, Math.PI / 2);
      // ツナギ（胸ポケット・ひざ当て）と泥
      k.b(0.2, 0.16, 0.03, 0x9e9e9e, -0.16, 1.38, 0.22);
      for (const l of k.legs) k.b(0.28, 0.14, 0.31, 0x9e9e9e, 0, -0.42, 0.01, l);
      const mud = 0x6d4c41;
      for (const [x, y, z, w] of [[-0.2, 1.06, 0.215, 0.18], [0.16, 1.24, 0.215, 0.12], [0.1, 0.94, -0.215, 0.2], [-0.16, 1.44, -0.215, 0.14]]) k.b(w, w * 0.7, 0.01, mud, x, y, z);
      for (const l of k.legs) k.b(0.26, 0.2, 0.31, mud, 0, -0.66, 0.01, l);
      k.b(0.08, 0.06, 0.01, mud, -0.12, 1.8, 0.255); // 顔の泥
      k.belt(0x3e2723, metal(0x9e9e9e));
      k.gloves(0xfdd835, 0.2);
      k.boots(0x3e2723, 0.22);
    },
  },
  // 吸収術士：胸の宝石、渦巻き模様の黒いローブ
  absorber: {
    body: 0x1e2226, pants: 0x14171a,
    make(k) {
      k.hood(0x1e2226);
      k.eyes(glow(0x80cbc4));
      k.skirt(0x1e2226, 1.0, 0.08, 0.16);
      k.sleeves(0x1e2226, true, 0.54);
      // 渦巻き模様（青緑の輪を重ねる）
      const tl = glow(0x4db6ac);
      for (const [x, y, z] of [[-0.14, 0.5, 0.29], [0.16, 0.3, 0.3], [0, 1.24, -0.22]]) {
        for (let i = 0; i < 3; i++) k.tor(0.04 + i * 0.04, 0.008, tl, x, y, z, k.R, 0, 0, i);
      }
      for (const a of k.arms) k.tor(0.13, 0.012, tl, 0, -0.5, 0, a, Math.PI / 2);
      // 胸の宝石
      k.cy(0.13, 0.13, 0.03, metal(0x37474f), 0, 1.32, 0.22, k.R, Math.PI / 2, 0, 0, 8);
      const gem = k.sp(0.1, k.mat({ color: 0x80cbc4, emissive: 0x26a69a, emissiveIntensity: 1 }), 0, 1.32, 0.25);
      gem.scale.z = 0.6;
      k.belt(0x37474f, tl);
      k.tick((t) => gem.scale.setScalar(1 + Math.sin(t * 3) * 0.08));
    },
  },
  // 反射術士：ピカピカの籠手、光沢のあるメタリックなスーツ
  reflector: {
    body: 0xb3e5fc, pants: 0x90c8e0,
    make(k) {
      const chrome = k.mat({ color: 0xe1f5fe, metalness: 1, roughness: 0.08 });
      const blue = k.mat({ color: 0xb3e5fc, metalness: 0.8, roughness: 0.15 });
      k.hair(0xeceff1, 'short');
      k.b(0.5, 0.06, 0.06, chrome, 0, 2.02, 0.25); // 額の板
      k.chest(blue, 1.58, 1.0, 0.47);
      k.b(0.3, 0.3, 0.02, chrome, 0, 1.32, 0.245, k.R, 0, 0, Math.PI / 4); // 胸の菱形
      k.pads(chrome, 0.3, 0.1);
      // ピカピカの籠手（大きめ）
      for (const a of k.arms) {
        k.b(0.28, 0.36, 0.3, chrome, 0, -0.5, 0, a);
        k.b(0.3, 0.04, 0.32, glow(0x80d8ff), 0, -0.34, 0, a);
      }
      k.belt(chrome, glow(0x80d8ff));
      k.shins(blue, -0.36, -0.72);
      k.boots(chrome, 0.14);
    },
  },
  // 太鼓叩き：ねじり鉢巻き、法被に短パン（お祭り）
  drummer: {
    body: 0xffeb3b, pants: SKIN,
    make(k) {
      k.hair(0x1a1a1a, 'spiky');
      // ねじり鉢巻き（2色をねじったように斜めの区切り）
      k.b(0.56, 0.1, 0.56, 0xfafafa, 0, 2.0, 0);
      for (let i = 0; i < 6; i++) k.b(0.04, 0.11, 0.02, 0xd32f2f, -0.25 + i * 0.1, 2.0, 0.285, k.R, 0, 0, 0.5);
      k.b(0.16, 0.12, 0.12, 0xfafafa, 0.14, 2.02, 0.26); // 前の結び目
      // 法被（襟と背中の紋）
      k.b(0.12, 0.8, 0.04, 0xd32f2f, -0.16, 1.2, 0.22);
      k.b(0.12, 0.8, 0.04, 0xd32f2f, 0.16, 1.2, 0.22);
      k.cy(0.18, 0.18, 0.02, 0xd32f2f, 0, 1.3, -0.22, k.R, Math.PI / 2, 0, 0, 12);
      k.cy(0.12, 0.12, 0.022, 0xfafafa, 0, 1.3, -0.225, k.R, Math.PI / 2, 0, 0, 12);
      k.b(0.04, 0.16, 0.024, 0xd32f2f, 0, 1.3, -0.23); // 「祭」の代わりの模様
      for (const a of k.arms) k.b(0.3, 0.36, 0.32, 0xffeb3b, 0, -0.2, 0, a);
      for (const a of k.arms) k.b(0.21, 0.26, 0.23, SKIN, 0, -0.5, 0, a);
      k.skirt(0xffeb3b, 0.98, 0.7, 0.06);
      k.b(0.6, 0.04, 0.2, 0xd32f2f, 0, 0.72, 0.23);
      k.belt(0xd32f2f, null, 0.92);
      for (const l of k.legs) k.b(0.27, 0.24, 0.31, 0x1a237e, 0, -0.12, 0, l); // 短パン
      k.boots(0xfafafa, 0.1); // 足袋
    },
  },
  // 溜め斬り士：片目の眼帯、着流し（どっしり構えた浪人）
  charger: {
    body: 0xffab40, pants: 0xffab40,
    make(k) {
      k.hair(0x1a1a1a, 'tied');
      k.b(0.2, 0.12, 0.03, 0x1a1a1a, 0, 2.18, 0.08); // ぼさぼさの前髪
      k.b(0.3, 0.06, 0.04, 0x3e2723, 0, 1.68, 0.24); // 無精ひげ
      // 片目の眼帯（左目）とひも
      k.b(0.14, 0.12, 0.03, 0x1a1a1a, 0.12, 1.88, 0.265);
      k.b(0.56, 0.025, 0.56, 0x1a1a1a, 0, 1.94, 0, k.R, 0, 0, -0.2);
      // 着流し（一枚の着物、合わせ・広い袖・長いすそ）
      k.b(0.06, 0.6, 0.04, 0xc77c1e, -0.08, 1.3, 0.215, k.R, 0, 0, -0.35);
      for (const a of k.arms) k.b(0.32, 0.5, 0.34, 0xffab40, 0, -0.3, 0, a);
      k.skirt(0xffab40, 0.98, 0.16, 0.08);
      k.b(0.06, 0.8, 0.02, 0xc77c1e, 0.1, 0.56, 0.3);
      k.belt(0x3e2723, null, 0.98);
      k.b(0.6, 0.06, 0.2, 0xc77c1e, 0, 0.2, 0.25);
      // 腰の鞘と草履
      k.b(0.08, 0.9, 0.08, 0x3e2723, 0.32, 0.88, 0.1, k.R, 1.1, 0, 0.15);
      k.boots(0xfafafa, 0.06);
    },
  },
  // 棘の騎士：棘付きの肩当て、いばらのツタが巻き付いた鎧
  thornknight: {
    body: 0x2e4a2a, pants: 0x1e3220,
    make(k) {
      const ar = metal(0x3e5a36);
      k.hair(0x2e3a1e, 'short');
      k.chest(ar, 1.58, 1.0, 0.48);
      k.gloves(ar, 0.3);
      k.shins(ar, -0.3, -0.72);
      k.boots(metal(0x2a3a24), 0.14);
      // 棘付きの肩当て
      for (const a of k.arms) {
        k.b(0.36, 0.18, 0.36, ar, 0, 0.04, 0, a);
        for (const [x, z] of [[0, 0], [-0.1, 0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, -0.1]]) k.cn(0.04, 0.16, 0xc5e1a5, x, 0.2, z, a, 0, 0, 0, 4);
      }
      // いばらのツタ（緑の茎と小さな棘、赤い花）
      const vine = 0x8bc34a;
      const ring = (y, z0) => {
        for (let i = 0; i < 6; i++) {
          const x = -0.3 + i * 0.12;
          k.b(0.14, 0.04, 0.03, vine, x, y + Math.sin(i * 1.5) * 0.05, z0, k.R, 0, 0, (i % 2 ? 0.4 : -0.4));
          k.cn(0.02, 0.06, 0xdcedc8, x, y + 0.05, z0 + 0.01, k.R, 0, 0, i % 2 ? 0.6 : -0.6, 3);
        }
      };
      ring(1.4, 0.255);
      ring(1.1, 0.255);
      ring(1.3, -0.255);
      for (const l of k.legs) k.b(0.29, 0.04, 0.33, vine, 0, -0.5, 0.01, l, 0, 0, 0.3);
      k.sp(0.05, 0xd32f2f, 0.18, 1.44, 0.27);
      k.sp(0.04, 0xd32f2f, -0.2, 1.12, 0.27);
      k.belt(vine, metal(0xc5e1a5));
    },
  },
  // 分裂射手：ポップな色の狩人服、矢筒
  splitter: {
    body: 0xff80ab, pants: 0x4dd0e1,
    make(k) {
      k.hair(0xffeb3b, 'tied');
      // 羽根付きの帽子（ポップな色）
      k.b(0.56, 0.12, 0.6, 0x7c4dff, 0, 2.14, 0.02);
      k.cn(0.3, 0.2, 0x7c4dff, 0, 2.26, 0, k.R, 0, 0, 0, 4);
      k.b(0.03, 0.3, 0.08, 0xffeb3b, 0.24, 2.3, -0.08, k.R, -0.4, 0, -0.4);
      // 狩人服：水色の胸当て、黄色のベルト、ギザギザのすそ
      k.chest(0x4dd0e1, 1.5, 1.08, 0.46);
      k.b(0.5, 0.05, 0.02, 0xffeb3b, 0, 1.3, 0.235);
      k.belt(0xffeb3b, glow(0xff4081));
      for (let i = 0; i < 6; i++) k.cn(0.06, 0.14, i % 2 ? 0xff80ab : 0x7c4dff, -0.3 + i * 0.12, 0.84, 0.2, k.R, Math.PI, 0, 0, 4);
      k.gloves(0x7c4dff, 0.22);
      k.boots(0xffeb3b, 0.3);
      quiver(k, 0x7c4dff, metal(0xffeb3b), 0xff80ab);
    },
  },
};
