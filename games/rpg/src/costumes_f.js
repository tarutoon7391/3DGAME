// 衣装スキン その6（投槍兵〜精霊術士）。部品は costume_kit.js
import { metal, glow } from './costume_kit.js';

const LEATHER = 0x6b4423;
const GOLD = 0xffcc33;
const SKIN = 0xf1c27d;

/** サンダル（足の甲と、すねに巻いたひも） */
const sandals = (k, c = 0x8d6e63) => {
  for (const l of k.legs) {
    k.b(0.27, 0.05, 0.36, c, 0, -0.8, 0.03, l);
    for (const y of [-0.7, -0.6, -0.5]) k.b(0.27, 0.025, 0.31, c, 0, y, 0.01, l, 0, 0, (y * 10) % 2 ? 0.1 : -0.1);
  }
};

export const COSTUMES_F = {
  // 投槍兵：羽根飾りの兜、古代ギリシャ風の軽装
  javelin: {
    body: 0xffe0b2, pants: SKIN,
    make(k) {
      const bronze = metal(0xc58a3a);
      // 兜（頬当てと、前から後ろへの羽根飾り）
      k.b(0.56, 0.3, 0.56, bronze, 0, 2.02, 0);
      for (const s of [-1, 1]) k.b(0.06, 0.26, 0.3, bronze, s * 0.27, 1.82, 0.08);
      k.b(0.04, 0.18, 0.04, bronze, 0, 1.86, 0.28);
      k.b(0.1, 0.24, 0.64, 0xe64a19, 0, 2.3, -0.04);
      k.b(0.08, 0.1, 0.58, 0xff8a65, 0, 2.44, -0.06);
      // キトン（短いすそ）と革のベルト
      k.skirt(0xffe0b2, 0.98, 0.5, 0.12);
      k.b(0.08, 0.86, 0.46, LEATHER, 0, 1.22, 0, k.R, 0, 0, 0.55);
      k.b(0.6, 0.04, 0.2, 0xe64a19, 0, 0.53, 0.22); // すその模様
      k.belt(LEATHER, bronze);
      for (const a of k.arms) k.b(0.21, 0.42, 0.23, SKIN, 0, -0.4, 0, a);
      k.gloves(bronze, 0.18);
      k.shins(bronze, -0.38, -0.7);
      sandals(k);
    },
  },
  // メイド：ヘッドドレス、クラシックなメイド服
  maid: {
    body: 0xf8bbd0, pants: 0x1a1a1a,
    make(k) {
      k.hair(0x3e2723, 'bob');
      // ヘッドドレス（白いフリルのカチューシャ）
      k.b(0.56, 0.1, 0.12, 0xffffff, 0, 2.16, 0.08);
      for (let i = 0; i < 5; i++) k.cn(0.05, 0.08, 0xffffff, -0.2 + i * 0.1, 2.24, 0.08, k.R, 0, 0, 0, 4);
      k.b(0.1, 0.06, 0.06, 0xf06292, 0.24, 2.16, 0.1);
      // ワンピース（長いすそ）とエプロン、白い襟
      k.skirt(0xf8bbd0, 0.98, 0.22, 0.2);
      k.b(0.5, 0.1, 0.48, 0xffffff, 0, 1.6, 0);
      k.b(0.14, 0.1, 0.03, 0xf06292, 0, 1.5, 0.235); // 胸のリボン
      k.b(0.44, 0.5, 0.02, 0xffffff, 0, 1.26, 0.225); // エプロンの胸当て
      k.b(0.54, 0.6, 0.03, 0xffffff, 0, 0.64, 0.33, k.R, 0.14);
      for (let i = 0; i < 6; i++) k.cn(0.05, 0.06, 0xffffff, -0.25 + i * 0.1, 0.32, 0.37, k.R, Math.PI, 0, 0, 4);
      k.b(0.3, 0.16, 0.08, 0xffffff, 0, 0.96, -0.26); // 後ろの結び目
      k.belt(0xffffff, null, 0.98);
      for (const a of k.arms) {
        k.b(0.3, 0.18, 0.32, 0xf8bbd0, 0, -0.06, 0, a); // ふくらんだ肩
        k.b(0.24, 0.06, 0.26, 0xffffff, 0, -0.58, 0, a); // 白い袖口
      }
      k.boots(0x1a1a1a, 0.14);
    },
  },
  // ものまね師：ベレー帽、パントマイム風の白黒ボーダーにサスペンダー
  mimic: {
    body: 0xfafafa, pants: 0x1a1a1a, skin: 0xfafafa,
    make(k) {
      k.hair(0x1a1a1a, 'short');
      const beret = k.cy(0.32, 0.3, 0.1, 0x1a1a1a, 0.04, 2.16, 0, k.R, 0, 0, 0.2, 12); // ベレー帽
      beret.scale.z = 0.95;
      k.b(0.03, 0.06, 0.03, 0x1a1a1a, 0.08, 2.24, 0);
      // 白塗りの顔（目の下の黒い印と赤い口）
      k.b(0.03, 0.1, 0.01, 0x111111, -0.12, 1.98, 0.255);
      k.b(0.03, 0.1, 0.01, 0x111111, 0.12, 1.98, 0.255);
      k.b(0.04, 0.06, 0.01, 0x111111, 0.12, 1.78, 0.255);
      k.b(0.14, 0.04, 0.01, 0xd32f2f, 0, 1.7, 0.255);
      // 白黒のボーダー
      for (let i = 0; i < 5; i++) k.b(0.72, 0.06, 0.44, 0x1a1a1a, 0, 0.94 + i * 0.13, 0);
      for (const a of k.arms) for (let i = 0; i < 4; i++) k.b(0.21, 0.06, 0.23, 0x1a1a1a, 0, -0.1 - i * 0.13, 0, a);
      // サスペンダー（淡いオレンジ）
      for (const x of [-0.16, 0.16]) {
        k.b(0.06, 0.74, 0.47, 0xffe0b2, x, 1.2, 0);
        k.b(0.07, 0.07, 0.02, metal(GOLD), x, 0.98, 0.24);
      }
      k.gloves(0xffffff, 0.16);
      k.boots(0x1a1a1a, 0.12);
    },
  },
  // 不死鳥使い：炎の羽根飾り、赤と金の羽根でできたマント
  phoenix: {
    body: 0xff8a65, pants: 0x6a2a1a,
    make(k) {
      k.hair(0xbf360c, 'short');
      // 炎の羽根飾り（頭の後ろに光る羽根）
      const fl = [glow(0xffd54f), glow(0xff7043), glow(0xffab40)];
      [-0.5, -0.2, 0.1, 0.4].forEach((r, i) => k.b(0.05, 0.36, 0.03, fl[i % 3], -0.04 + i * 0.03, 2.28, -0.2, k.R, -0.4, 0, r));
      k.sp(0.06, glow(0xffeb3b), 0, 2.14, -0.22);
      // 羽根のマント（赤と金を重ねる）
      const cols = [0xd84315, 0xffb300, 0xff5722];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
        const x = -0.32 + c * 0.16;
        k.cn(0.1, 0.34, cols[(r + c) % 3], x, 1.5 - r * 0.22, -0.27 - r * 0.02, k.R, Math.PI, 0, 0, 4).scale.z = 0.3;
      }
      for (const s of [-1, 1]) k.cn(0.12, 0.36, 0xffb300, s * 0.4, 1.5, -0.12, k.R, Math.PI, 0, s * 0.3, 4).scale.z = 0.3;
      k.b(0.62, 0.12, 0.48, 0xffb300, 0, 1.6, 0);
      k.b(0.12, 0.3, 0.02, 0xffd54f, 0, 1.26, 0.215, k.R, 0, 0, Math.PI / 4); // 胸の炎の印
      k.belt(0x6a2a1a, metal(GOLD));
      k.loincloth(0xd84315, 0.34);
      k.boots(0x4e1a0a, 0.26);
    },
  },
  // 天候術士：雲と雷の模様の雨合羽風ローブ、傘（背中）
  weather: {
    body: 0x90caf9, pants: 0x37474f,
    make(k) {
      k.hair(0x5d4037, 'short');
      // 雨合羽のフードとローブ
      k.b(0.6, 0.12, 0.6, 0x90caf9, 0, 2.18, 0);
      k.b(0.6, 0.48, 0.12, 0x90caf9, 0, 1.92, -0.27);
      k.b(0.64, 0.04, 0.2, 0x64a8e0, 0, 2.12, 0.3);
      k.skirt(0x90caf9, 1.0, 0.24, 0.16);
      k.sleeves(0x90caf9, false, 0.56);
      for (const y of [1.42, 1.22, 1.02]) k.b(0.06, 0.06, 0.03, 0xffeb3b, 0.08, y, 0.22);
      // 雲（白い丸の集まり）と雷（黄色のジグザグ）
      for (const [x, y, z] of [[-0.16, 0.6, 0.29], [0.12, 1.34, -0.22]]) for (const [dx, dy, r] of [[-0.06, 0, 0.06], [0.03, 0.02, 0.08], [0.11, 0, 0.05]]) k.sp(r, 0xffffff, x + dx, y + dy, z);
      for (const [x, y, z] of [[0.18, 0.4, 0.3], [-0.14, 1.1, -0.22]]) {
        k.b(0.04, 0.14, 0.02, glow(0xffeb3b), x, y + 0.06, z, k.R, 0, 0, 0.5);
        k.b(0.04, 0.14, 0.02, glow(0xffeb3b), x + 0.03, y - 0.06, z, k.R, 0, 0, -0.5);
      }
      k.belt(0x1e5a8a, null);
      k.boots(0xffeb3b, 0.3); // 長ぐつ
      // 背中の傘（閉じて斜めにさす）
      const u = k.cn(0.14, 0.9, 0x1565c0, 0.1, 1.24, -0.34, k.R, 0, 0, -0.3, 8);
      u.add(k.b(0.03, 0.3, 0.03, 0x5d4037, 0, 0.56, 0, u));
      u.add(k.b(0.12, 0.03, 0.03, 0x5d4037, 0.05, 0.7, 0, u));
    },
  },
  // 暗殺者：深いフード、黒い服、口元を布で隠す
  assassin: {
    body: 0x2a2a2e, pants: 0x1e1e22,
    make(k) {
      const g = 0x616161;
      // 深いフード（前へせり出す）
      k.hood(g);
      k.b(0.62, 0.14, 0.2, g, 0, 2.12, 0.3, k.R, 0.3);
      k.b(0.08, 0.4, 0.14, g, -0.3, 1.94, 0.28);
      k.b(0.08, 0.4, 0.14, g, 0.3, 1.94, 0.28);
      k.mask(0x1a1a1a);
      k.b(0.82, 0.22, 0.54, g, 0, 1.56, 0); // 肩の布
      k.b(0.74, 0.5, 0.06, g, 0, 1.3, -0.25);
      // 黒い服：斜めのベルトと短剣の鞘
      k.b(0.08, 0.86, 0.46, 0x111111, 0, 1.22, 0, k.R, 0, 0, -0.55);
      k.belt(0x111111, metal(0x9e9e9e));
      k.b(0.06, 0.34, 0.06, 0x111111, 0.3, 0.8, 0.2, k.R, 0, 0, 0.3);
      k.gloves(0x111111, 0.3);
      k.shins(0x111111, -0.4, -0.74);
      k.boots(0x0d0d0d, 0.1);
    },
  },
  // 機工士：ツナギに工具ベルト、頭にゴーグル、スパナ
  engineer: {
    body: 0xffb74d, pants: 0xffb74d,
    make(k) {
      k.hair(0x3e2723, 'messy');
      const brass = metal(0xb08d57);
      k.b(0.58, 0.06, 0.58, LEATHER, 0, 2.06, 0); // おでこのゴーグル
      for (const x of [-0.12, 0.12]) {
        k.cy(0.09, 0.09, 0.06, brass, x, 2.08, 0.28, k.R, Math.PI / 2);
        k.cy(0.07, 0.07, 0.02, glow(0x4fc3f7), x, 2.08, 0.31, k.R, Math.PI / 2);
      }
      // ツナギ（胸当て・肩ひも・ひざ当て）とよごれ
      k.b(0.08, 0.3, 0.02, 0xe08a2a, -0.18, 1.48, 0.215);
      k.b(0.08, 0.3, 0.02, 0xe08a2a, 0.18, 1.48, 0.215);
      k.b(0.4, 0.3, 0.03, 0xe08a2a, 0, 1.2, 0.22);
      for (const l of k.legs) k.b(0.28, 0.14, 0.31, 0xe08a2a, 0, -0.4, 0.01, l);
      k.b(0.12, 0.08, 0.01, 0x5d4037, 0.16, 1.0, 0.215);
      // 工具ベルトとスパナ
      k.belt(0x3e2723, metal(0x9e9e9e), 0.96);
      k.b(0.12, 0.14, 0.08, LEATHER, -0.22, 0.86, 0.25);
      k.b(0.04, 0.12, 0.04, 0xd32f2f, -0.26, 0.98, 0.25); // ドライバー
      k.b(0.05, 0.34, 0.03, metal(0x9e9e9e), 0.26, 0.82, 0.26, k.R, 0, 0, 0.2); // スパナ
      k.tor(0.06, 0.02, metal(0x9e9e9e), 0.22, 0.66, 0.26, k.R);
      k.tor(0.06, 0.02, metal(0x9e9e9e), 0.3, 0.98, 0.26, k.R);
      k.gloves(0x5d4037, 0.18);
      k.boots(0x3e2723, 0.24);
    },
  },
  // 次元術士：星空のような模様のローブ、そばに浮かぶ小さなワープホール
  dimension: {
    body: 0x2a1f5a, pants: 0x1a1240,
    make(k) {
      k.hair(0xb388ff, 'long');
      const robe = 0x2a1f5a;
      k.skirt(robe, 1.0, 0.08, 0.16);
      k.sleeves(robe, true, 0.54);
      k.b(0.6, 0.06, 0.2, 0xb388ff, 0, 0.12, 0.22);
      for (const a of k.arms) k.b(0.32, 0.04, 0.34, 0xb388ff, 0, -0.5, 0, a);
      // 星空（小さな光る点）
      const st = [glow(0xffffff), glow(0xb388ff), glow(0x80d8ff)];
      for (let i = 0; i < 16; i++) {
        const x = ((i * 37) % 60) / 100 - 0.3;
        const y = 0.3 + ((i * 53) % 120) / 100;
        k.b(0.035, 0.035, 0.02, st[i % 3], x, y, y < 1 ? 0.27 : (i % 2 ? 0.215 : -0.215));
      }
      k.belt(0xb388ff, glow(0xea80fc));
      // そばに浮かぶワープホール（回る輪と暗い中心）
      const hole = k.tor(0.2, 0.04, glow(0xb388ff), 0.72, 1.3, 0.1, k.R, 0, Math.PI / 2, 0);
      const core = k.cy(0.17, 0.17, 0.02, 0x0d0620, 0.72, 1.3, 0.1, k.R, 0, 0, Math.PI / 2, 14);
      const ring2 = k.tor(0.13, 0.015, glow(0x80d8ff), 0.72, 1.3, 0.1, k.R, 0, Math.PI / 2, 0);
      k.tick((t) => {
        const y = 1.3 + Math.sin(t * 2) * 0.06;
        hole.position.y = core.position.y = ring2.position.y = y;
        hole.rotation.z = t * 1.5;
        ring2.rotation.z = -t * 2.4;
        const s = 1 + Math.sin(t * 3) * 0.06;
        hole.scale.setScalar(s);
      });
    },
  },
  // 陰陽師：烏帽子、白い狩衣（平安装束）
  onmyoji: {
    body: 0xfff8e1, pants: 0x9575cd,
    make(k) {
      k.hair(0x1a1a1a, 'short');
      // 烏帽子（黒く高い帽子）
      k.b(0.4, 0.5, 0.4, 0x1a1a1a, 0, 2.36, -0.04, k.R, -0.15);
      k.b(0.38, 0.14, 0.2, 0x1a1a1a, 0, 2.62, -0.14, k.R, -0.5);
      k.b(0.02, 0.24, 0.02, 0xfff8e1, -0.2, 1.88, 0.18, k.R, 0, 0, 0.2); // あごひも
      k.b(0.02, 0.24, 0.02, 0xfff8e1, 0.2, 1.88, 0.18, k.R, 0, 0, -0.2);
      // 狩衣：丸い襟、大きな袖、前と後ろの垂れ
      k.b(0.56, 0.12, 0.5, 0xfff8e1, 0, 1.6, 0);
      k.cy(0.2, 0.2, 0.02, 0xd7ccb0, 0, 1.58, 0.21, k.R, Math.PI / 2, 0, 0, 10);
      for (const a of k.arms) {
        k.b(0.38, 0.6, 0.4, 0xfff8e1, 0, -0.34, 0, a);
        k.b(0.39, 0.04, 0.41, 0xd32f2f, 0, -0.62, 0, a); // 袖のくくり紐
      }
      k.b(0.6, 0.62, 0.04, 0xfff8e1, 0, 0.6, 0.23);
      k.b(0.6, 0.72, 0.04, 0xfff8e1, 0, 0.56, -0.23);
      k.belt(0xd7ccb0, null, 0.96);
      // 指貫（紫の袴、すそをしぼる）
      for (const l of k.legs) k.b(0.32, 0.52, 0.34, 0x9575cd, 0, -0.42, 0, l);
      k.boots(0x1a1a1a, 0.1);
      // 胸の五芒星
      k.cy(0.07, 0.07, 0.02, glow(0x7e57c2), 0, 1.3, 0.22, k.R, Math.PI / 2, 0, 0, 5);
    },
  },
  // 狩人：獣の牙のネックレス、毛皮のベスト、革のブーツ
  hunter: {
    body: 0xa5d6a7, pants: 0x4a3a28,
    make(k) {
      k.hair(0x6a4426, 'messy');
      // 毛皮のベスト（ふさふさのふち）
      const fur = 0x8d6e63;
      k.b(0.24, 0.66, 0.47, fur, -0.26, 1.24, 0);
      k.b(0.24, 0.66, 0.47, fur, 0.26, 1.24, 0);
      k.b(0.76, 0.66, 0.2, fur, 0, 1.24, -0.14);
      for (let i = 0; i < 6; i++) k.cn(0.05, 0.1, 0xbcaaa4, -0.3 + i * 0.12, 0.88, 0.2, k.R, Math.PI, 0, 0, 4);
      k.b(0.8, 0.12, 0.52, 0xbcaaa4, 0, 1.58, 0);
      // 獣の牙のネックレス
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (0.15 + i * 0.175);
        k.cn(0.03, 0.1, 0xfff8e1, Math.cos(a) * 0.16, 1.54 - Math.sin(a) * 0.1, 0.235, k.R, Math.PI, 0, (i - 2) * 0.25, 4);
      }
      k.belt(LEATHER, metal(0x9e9e9e));
      k.b(0.14, 0.14, 0.08, LEATHER, 0.24, 0.86, 0.24);
      k.gloves(LEATHER, 0.22);
      k.boots(0x5d4037, 0.38); // 革のブーツ
      for (const l of k.legs) k.b(0.29, 0.06, 0.35, fur, 0, -0.44, 0.02, l);
    },
  },
  // 剣闘士：片腕の籠手、古代ローマ風の腰布とサンダル
  gladiator: {
    body: SKIN, pants: SKIN,
    make(k) {
      k.hair(0x3e2723, 'short');
      bareArmsF(k);
      // 胸の革ベルト（片側）と腹の帯
      k.b(0.1, 0.9, 0.46, LEATHER, 0, 1.22, 0, k.R, 0, 0, 0.6);
      k.b(0.76, 0.2, 0.48, 0x8d5a2a, 0, 1.0, 0);
      k.b(0.14, 0.12, 0.03, metal(GOLD), 0, 1.0, 0.25);
      // 片腕の籠手（左腕、輪を重ねる）
      const iron = metal(0xb0bec5);
      for (let i = 0; i < 6; i++) k.b(0.26, 0.09, 0.28, iron, 0, -0.06 - i * 0.1, 0, k.arms[0], 0, 0, (i % 2 ? 0.06 : -0.06));
      k.b(0.34, 0.16, 0.34, iron, 0, 0.04, 0, k.arms[0]);
      // ローマ風の腰布（前後の布と短冊）
      k.b(0.4, 0.4, 0.04, 0xffcc80, 0, 0.66, 0.24);
      k.b(0.4, 0.4, 0.04, 0xffcc80, 0, 0.66, -0.24);
      for (let i = 0; i < 6; i++) k.b(0.1, 0.3, 0.03, LEATHER, -0.3 + i * 0.12, 0.74, 0.26 + (i % 2) * 0.01);
      sandals(k);
    },
  },
  // 精霊術士：火・水・風・土の4色のローブ、周りを飛ぶ小さな精霊
  elementalist: {
    body: 0x80cbc4, pants: 0x2f6a64,
    make(k) {
      k.hair(0x2f6a64, 'long');
      k.skirt(0x80cbc4, 1.0, 0.1, 0.16);
      k.sleeves(0x80cbc4, true, 0.52);
      // 4色の帯（すそ・胸・袖）
      const four = [0xef5350, 0x42a5f5, 0x9ccc65, 0x8d6e63];
      four.forEach((c, i) => {
        k.b(0.16, 0.08, 0.02, c, -0.24 + i * 0.16, 0.16, 0.27);
        k.b(0.16, 0.08, 0.02, c, -0.24 + i * 0.16, 0.16, -0.27);
        k.b(0.14, 0.06, 0.02, c, -0.21 + i * 0.14, 1.44, 0.215);
      });
      k.b(0.33, 0.06, 0.35, four[0], 0, -0.5, 0, k.arms[0]);
      k.b(0.33, 0.06, 0.35, four[1], 0, -0.5, 0, k.arms[1]);
      k.belt(0x2f6a64, glow(0x80cbc4));
      // 周りを飛ぶ小さな精霊（4色の光の玉）
      const sp = four.map((c) => k.sp(0.07, glow(c)));
      k.tick((t) => sp.forEach((s, i) => {
        const a = t * 1.3 + (i * Math.PI) / 2;
        s.position.set(Math.cos(a) * 0.6, 1.5 + Math.sin(t * 2.5 + i) * 0.15, Math.sin(a) * 0.5);
      }));
    },
  },
};

/** 腕を素肌にする */
function bareArmsF(k) { for (const a of k.arms) k.b(0.21, 0.62, 0.23, SKIN, 0, -0.3, 0, a); }
