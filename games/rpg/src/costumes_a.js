// 衣装スキン その1（魔法使い〜砲術士）。部品は costume_kit.js
// 各職業：{ body：服の色, cape：マント（なしは省く）, pants：ズボン, skin：肌, make(k) }
import { metal, glow } from './costume_kit.js';

const BROWN = 0x5a3a1a;
const LEATHER = 0x6b4423;
const GOLD = 0xffcc33;

export const COSTUMES_A = {
  // 魔法使い：ルーン刺繍のローブにマント、とんがり帽子、長い髪
  mage: {
    body: 0x64b5f6, cape: 0x1e4f8a, pants: 0x1e3550,
    make(k) {
      k.hair(0xd9dfe8, 'long');
      k.wizardHat(0x2f6fb0, 0x64b5f6);
      k.skirt(0x64b5f6, 1.0, 0.1, 0.16);
      k.b(0.6, 0.06, 0.2, 0x2f6fb0, 0, 0.13, 0.22); // すその縁
      k.sleeves(0x64b5f6, true, 0.52);
      k.belt(0x2f6fb0, GOLD);
      k.b(0.08, 0.86, 0.02, 0x2f6fb0, 0, 1.15, 0.23); // 前合わせ
      const rune = glow(0xbfe9ff);
      for (const [x, y] of [[-0.22, 0.3], [-0.08, 0.24], [0.08, 0.3], [0.22, 0.24], [-0.14, 1.36], [0.14, 1.36], [-0.14, 1.2], [0.14, 1.2]]) k.b(0.06, 0.06, 0.02, rune, x, y, y < 1 ? 0.27 : 0.225);
      for (const a of k.arms) k.b(0.32, 0.04, 0.34, rune, 0, -0.5, 0, a); // 袖のルーン
    },
  },
  // 僧侶：白いローブに金の刺繍、フードは下ろす、ロザリオ
  priest: {
    body: 0xf6f4ec, cape: 0xfff59d, pants: 0xe8e4d4,
    make(k) {
      k.hair(0x8a6a42, 'short');
      k.hood(0xf6f4ec, true);
      k.skirt(0xf6f4ec, 1.0, 0.1, 0.14);
      k.sleeves(0xf6f4ec, true, 0.52);
      const gold = metal(0xe6b422);
      k.b(0.6, 0.05, 0.2, gold, 0, 0.14, 0.22); // すその金刺繍
      k.b(0.08, 1.4, 0.02, 0xfff59d, -0.12, 0.85, 0.235); // 淡い黄色のストール
      k.b(0.08, 1.4, 0.02, 0xfff59d, 0.12, 0.85, 0.235);
      k.b(0.04, 0.16, 0.02, gold, -0.12, 0.3, 0.25); // ストールの金の十字
      k.b(0.04, 0.16, 0.02, gold, 0.12, 0.3, 0.25);
      k.belt(gold, null, 1.0);
      // ロザリオ：首の玉と胸の十字架
      for (let i = 0; i < 7; i++) {
        const t = (i / 6) * Math.PI;
        k.sp(0.035, 0x8d5a3b, Math.cos(t) * 0.18, 1.56 - Math.sin(t) * 0.16, 0.235);
      }
      k.b(0.05, 0.2, 0.03, gold, 0, 1.3, 0.24);
      k.b(0.14, 0.05, 0.03, gold, 0, 1.34, 0.24);
    },
  },
  // 弓使い：革の胸当てと緑のケープ、背中に矢筒
  archer: {
    body: 0x6f9e5c, cape: 0xa5d6a7, pants: 0x4a3a28,
    make(k) {
      k.hair(0x7a4f2a, 'tied');
      k.chest(LEATHER, 1.56, 1.06, 0.47);
      k.b(0.5, 0.05, 0.02, 0x4a2c16, 0, 1.3, 0.24);
      k.b(0.74, 0.18, 0.5, 0xa5d6a7, 0, 1.56, 0); // 肩のケープ
      k.b(0.24, 0.14, 0.04, 0xa5d6a7, 0, 1.48, 0.26, k.R, 0.3); // 前の垂れ
      k.belt(0x4a2c16, metal(0xb08d57));
      k.loincloth(0x6f9e5c, 0.3);
      k.gloves(LEATHER, 0.24);
      k.boots(LEATHER, 0.3);
      // 矢筒（背中・斜め）と矢羽
      const q = k.cy(0.1, 0.09, 0.72, 0x7a4a24, 0.12, 1.2, -0.36, k.R, 0, 0, -0.35);
      q.add(k.cy(0.11, 0.11, 0.05, metal(0xb08d57), 0, 0.33, 0, q));
      for (const [x, z] of [[-0.04, 0], [0.04, 0.03], [0, -0.04]]) k.b(0.03, 0.2, 0.06, 0xf2f2f2, x, 0.45, z, q);
    },
  },
  // 忍者：忍装束（覆面・頭巾）に手甲と脚絆
  ninja: {
    body: 0xb39ddb, pants: 0x8c75b8,
    make(k) {
      const dark = 0x3b2f52;
      k.hood(dark);
      k.mask(dark);
      k.b(0.7, 0.1, 0.06, dark, 0, 1.4, 0.21, k.R, 0, 0, 0.6); // 合わせの襟
      k.belt(dark, null, 0.98);
      k.b(0.08, 0.32, 0.04, dark, 0.2, 0.82, 0.22, k.R, 0, 0, 0.2); // 帯の垂れ
      k.gloves(dark, 0.32); // 手甲
      for (const a of k.arms) k.b(0.06, 0.06, 0.26, metal(0x8a8f99), 0, -0.4, 0, a);
      k.shins(dark, -0.4, -0.74); // 脚絆
      for (const l of k.legs) k.b(0.28, 0.04, 0.32, 0xffffff, 0, -0.5, 0.01, l);
      k.boots(0x2a2238, 0.1);
      k.b(0.6, 0.06, 0.2, dark, 0, 2.03, 0.18); // 額当ての布
      k.b(0.3, 0.07, 0.03, metal(0xa6acb6), 0, 2.03, 0.285); // 額当ての金具
    },
  },
  // 吟遊詩人：羽根付き帽子、ひらひら袖のチュニック、背中に小さなリュート
  bard: {
    body: 0xf48fb1, pants: 0x5a3a5a,
    make(k) {
      k.hair(0xe0b060, 'bob');
      k.cy(0.44, 0.44, 0.05, 0x7b2a4d, 0, 2.15, 0, k.R, -0.08, 0, 0.1, 10); // つば広帽
      k.cy(0.25, 0.3, 0.2, 0x7b2a4d, 0, 2.27, -0.02, k.R, -0.08, 0, 0.1);
      k.b(0.04, 0.5, 0.12, 0xfff3f8, 0.24, 2.42, -0.1, k.R, -0.6, 0, -0.5); // 羽根
      k.b(0.03, 0.3, 0.08, 0xf48fb1, 0.27, 2.36, -0.04, k.R, -0.6, 0, -0.6);
      k.skirt(0xf48fb1, 0.98, 0.58, 0.12); // チュニックのすそ
      k.b(0.6, 0.04, 0.2, 0xffffff, 0, 0.6, 0.22);
      k.belt(0x7b2a4d, GOLD);
      for (const a of k.arms) { // ひらひらの袖
        k.b(0.34, 0.24, 0.36, 0xf8bbd0, 0, -0.42, 0, a);
        k.b(0.38, 0.06, 0.4, 0xffffff, 0, -0.55, 0, a);
      }
      k.b(0.3, 0.14, 0.5, 0xffffff, 0, 1.56, 0); // 襟のひだ
      k.boots(0x6b3a4d, 0.3);
      // 背中の小さなリュート
      const body = k.sp(0.2, 0xc58a4a, -0.08, 1.15, -0.32);
      body.scale.set(1, 1.2, 0.45);
      k.b(0.06, 0.5, 0.05, 0x5a3a1a, 0.06, 1.45, -0.34, k.R, 0, 0, -0.45);
    },
  },
  // 召喚士：宝石飾りの長いローブ、腰に魔法陣の本、肩に小さな使い魔
  summoner: {
    body: 0x80cbc4, cape: 0x2f7a72, pants: 0x234a46,
    make(k) {
      k.hair(0x2b2b3a, 'long');
      k.skirt(0x80cbc4, 1.0, 0.06, 0.16);
      k.sleeves(0x80cbc4, true, 0.54);
      k.b(0.6, 0.06, 0.2, 0x2f7a72, 0, 0.1, 0.22);
      k.belt(0x2f7a72, null);
      const gems = [glow(0xe91e63), glow(0x7c4dff), glow(0x00e5ff)];
      [[0, 1.4], [-0.16, 0.98], [0.16, 0.98], [0, 0.98]].forEach(([x, y], i) => k.b(0.08, 0.08, 0.04, gems[i % 3], x, y, 0.25));
      [-0.2, 0, 0.2].forEach((x, i) => k.b(0.07, 0.07, 0.03, gems[i], x, 0.2, 0.27));
      // 腰の本（表紙に光る魔法陣）
      k.b(0.1, 0.3, 0.24, 0x4a2a5a, 0.4, 0.82, 0.04);
      k.cy(0.08, 0.08, 0.01, glow(0x80cbc4), 0.455, 0.82, 0.04, k.R, 0, 0, Math.PI / 2, 10);
      // 肩の使い魔（小さな羽のある生き物）
      const f = k.sp(0.1, 0xb2ebf2, 0.36, 1.72, 0);
      k.sp(0.03, 0x111111, 0.4, 1.74, 0.08);
      k.sp(0.03, 0x111111, 0.32, 1.74, 0.08);
      k.cn(0.04, 0.1, 0xb2ebf2, 0.4, 1.83, 0, k.R, 0, 0, -0.3, 4);
      k.cn(0.04, 0.1, 0xb2ebf2, 0.32, 1.83, 0, k.R, 0, 0, 0.3, 4);
      k.b(0.24, 0.08, 0.02, glow(0x80cbc4), 0.36, 1.74, -0.1, k.R, 0, 0, 0.2);
      f.scale.y = 0.9;
    },
  },
  // 槍兵：兜、軽い鎖かたびらに腰布
  lancer: {
    body: 0x9aa3ab, cape: 0xffab91, pants: 0x4a3a2a,
    make(k) {
      const iron = metal(0x8d969e);
      k.hair(BROWN, 'short');
      // 兜（鼻当てと羽根飾り）
      k.cy(0.31, 0.31, 0.3, iron, 0, 2.03, 0, k.R, 0, 0, 0, 8);
      k.cn(0.31, 0.22, iron, 0, 2.29, 0, k.R, 0, 0, 0, 8);
      k.b(0.06, 0.22, 0.04, iron, 0, 1.84, 0.31);
      k.b(0.06, 0.24, 0.3, 0xffab91, 0, 2.42, -0.02);
      // 鎖かたびら（細かい横線）と前の腰布
      for (let i = 0; i < 6; i++) k.b(0.72, 0.02, 0.44, metal(0x6d757d), 0, 0.92 + i * 0.11, 0);
      k.b(0.38, 0.62, 0.03, 0xffab91, 0, 1.24, 0.225); // 胸の前掛け
      k.b(0.38, 0.4, 0.03, 0xffab91, 0, 0.72, 0.23);
      k.b(0.38, 0.4, 0.03, 0xffab91, 0, 0.72, -0.23);
      k.belt(LEATHER, metal(0xc0c6cc));
      k.pads(iron, 0.3, 0.12);
      k.gloves(LEATHER, 0.22);
      k.boots(LEATHER, 0.32);
    },
  },
  // 格闘家：袖なしの道着、鉢巻き、拳にバンテージ
  monk: {
    body: 0xffcc80, pants: 0xf0b860,
    make(k) {
      const skin = 0xf1c27d;
      k.hair(0x1e1e1e, 'spiky');
      k.headband(0xd84315);
      for (const a of k.arms) k.b(0.21, 0.62, 0.23, skin, 0, -0.3, 0, a); // 袖なし（腕は素肌）
      k.b(0.06, 0.46, 0.04, 0xe0a050, -0.1, 1.38, 0.215, k.R, 0, 0, 0.45); // 道着の合わせ（V字）
      k.b(0.06, 0.46, 0.04, 0xe0a050, 0.1, 1.38, 0.215, k.R, 0, 0, -0.45);
      k.belt(0x222222, null);
      k.b(0.1, 0.3, 0.04, 0x222222, 0.14, 0.82, 0.23, k.R, 0, 0, 0.25);
      k.gloves(0xf5f5f5, 0.2); // バンテージ
      for (const a of k.arms) for (const y of [-0.55, -0.62, -0.69]) k.b(0.22, 0.02, 0.25, 0xd0d0d0, 0, y, 0, a);
      k.boots(skin, 0.06);
    },
  },
  // 錬金術師：ゴーグル、白衣のコート、腰にポーション瓶
  alchemist: {
    body: 0xc5e1a5, pants: 0x4a4a3a,
    make(k) {
      k.hair(0x8a5a2b, 'messy');
      // おでこのゴーグル
      const brass = metal(0xb08d57);
      k.b(0.56, 0.06, 0.56, LEATHER, 0, 2.02, 0);
      k.cy(0.09, 0.09, 0.06, brass, -0.12, 2.04, 0.27, k.R, Math.PI / 2);
      k.cy(0.09, 0.09, 0.06, brass, 0.12, 2.04, 0.27, k.R, Math.PI / 2);
      k.cy(0.07, 0.07, 0.02, glow(0x8bc34a), -0.12, 2.04, 0.3, k.R, Math.PI / 2);
      k.cy(0.07, 0.07, 0.02, glow(0x8bc34a), 0.12, 2.04, 0.3, k.R, Math.PI / 2);
      // 白衣（前が開いて中の黄緑のシャツが見える）
      const coat = 0xf4f4ee;
      k.b(0.26, 0.76, 0.46, coat, -0.24, 1.2, 0);
      k.b(0.26, 0.76, 0.46, coat, 0.24, 1.2, 0);
      k.b(0.74, 0.76, 0.2, coat, 0, 1.2, -0.14);
      k.b(0.3, 0.5, 0.42, coat, -0.22, 0.58, 0.02);
      k.b(0.3, 0.5, 0.42, coat, 0.22, 0.58, 0.02);
      k.b(0.74, 0.5, 0.18, coat, 0, 0.58, -0.14);
      k.sleeves(coat, false, 0.56);
      k.b(0.08, 0.08, 0.02, 0x8bc34a, 0.24, 1.3, 0.235); // 胸ポケットの印
      // 腰のポーション瓶
      k.belt(LEATHER, null, 0.92);
      [[0x4fc3f7, -0.24], [0xef5350, -0.06], [0xc5e1a5, 0.14]].forEach(([c, x]) => {
        k.sp(0.07, glow(c), x, 0.8, 0.27);
        k.b(0.04, 0.06, 0.04, 0x8d6e63, x, 0.89, 0.27);
      });
      k.boots(0x3a2a1a, 0.2);
    },
  },
  // 狂戦士：上半身ほぼ裸、獣の毛皮、傷だらけの肩当て、ボサボサの髪
  berserker: {
    body: 0xe2a877, pants: 0x3e2a1e,
    make(k) {
      k.hair(0x6a2a1a, 'messy');
      for (const a of k.arms) k.b(0.21, 0.62, 0.23, 0xe2a877, 0, -0.3, 0, a);
      // 傷（胸と腕）
      k.b(0.3, 0.03, 0.02, 0xa0524a, -0.08, 1.4, 0.215, k.R, 0, 0, 0.5);
      k.b(0.22, 0.03, 0.02, 0xa0524a, 0.12, 1.2, 0.215, k.R, 0, 0, -0.4);
      // 獣の毛皮（肩から背中）
      const fur = 0x7b5a3a;
      k.b(0.8, 0.16, 0.5, fur, 0, 1.52, -0.03);
      k.b(0.7, 0.6, 0.08, fur, 0, 1.3, -0.25);
      for (const x of [-0.3, -0.1, 0.1, 0.3]) k.cn(0.07, 0.16, 0xa07850, x, 1.0, -0.26, k.R, Math.PI, 0, 0, 4);
      k.sp(0.12, 0x5d4030, 0.32, 1.66, 0.12); // 獣の頭
      // 傷だらけの肩当て
      const iron = metal(0x7a7a7a);
      for (const a of k.arms) {
        k.b(0.34, 0.16, 0.34, iron, 0, 0.02, 0, a);
        k.b(0.2, 0.02, 0.02, 0x3a3a3a, 0, 0.04, 0.175, a, 0, 0, 0.4);
      }
      // 腰：薄い赤の腰布とベルト
      k.belt(LEATHER, metal(0x9e9e9e), 0.86);
      k.loincloth(0xef9a9a, 0.42);
      k.b(0.08, 0.04, 0.02, 0xc62828, -0.1, 1.86, 0.262); // 顔の隈取り
      k.b(0.08, 0.04, 0.02, 0xc62828, 0.14, 1.86, 0.262);
      k.boots(fur, 0.26);
    },
  },
  // 時魔導士：歯車模様のローブ、片目にモノクル、懐中時計
  chrono: {
    body: 0xb388ff, cape: 0x4a2f80, pants: 0x2e2050,
    make(k) {
      k.hair(0xe8e8f0, 'short');
      k.skirt(0xb388ff, 1.0, 0.1, 0.14);
      k.sleeves(0xb388ff, true, 0.52);
      const brass = metal(0xd4a440);
      // 歯車模様（前と背中）
      for (const [x, y, r] of [[-0.18, 0.5, 0.09], [0.12, 0.32, 0.12], [0.16, 1.32, 0.08], [-0.14, 1.18, 0.06]]) {
        const g = k.cy(r, r, 0.02, brass, x, y, y < 1 ? 0.27 : 0.22, k.R, Math.PI / 2, 0, 0, 8);
        g.add(k.cy(r * 0.4, r * 0.4, 0.03, 0xb388ff, 0, 0.005, 0, g, 0, 0, 0, 6));
      }
      k.cy(0.16, 0.16, 0.02, brass, 0, 1.3, -0.22, k.R, Math.PI / 2, 0, 0, 8);
      k.belt(0x4a2f80, brass);
      // モノクル（右目）
      k.cy(0.08, 0.08, 0.02, brass, 0.12, 1.88, 0.27, k.R, Math.PI / 2, 0, 0, 10);
      k.cy(0.06, 0.06, 0.02, glow(0xe1f5fe), 0.12, 1.88, 0.275, k.R, Math.PI / 2, 0, 0, 10);
      k.b(0.02, 0.22, 0.02, brass, 0.2, 1.76, 0.26);
      // 懐中時計（ベルトに鎖で下げる）
      k.b(0.02, 0.14, 0.02, brass, -0.2, 0.9, 0.25);
      const w = k.cy(0.09, 0.09, 0.04, brass, -0.2, 0.78, 0.26, k.R, Math.PI / 2, 0, 0, 12);
      w.add(k.cy(0.07, 0.07, 0.02, 0xfffde7, 0, 0.02, 0, w, 0, 0, 0, 12));
      k.b(0.07, 0.035, 0.12, brass, 0, 1.0, 0, w); // 竜頭
    },
  },
  // 砲術士：軍服風のジャケットにブーツ、耳当て付きの帽子、弾薬ベルト
  gunner: {
    body: 0xffd180, pants: 0x3e3a30,
    make(k) {
      k.hair(BROWN, 'short');
      // 耳当て付きの帽子
      const fur = 0x6b4a2b;
      k.b(0.6, 0.2, 0.6, 0x8a6a3a, 0, 2.18, 0);
      k.b(0.62, 0.08, 0.2, fur, 0, 2.08, 0.22);
      k.b(0.08, 0.3, 0.26, fur, -0.3, 1.9, 0);
      k.b(0.08, 0.3, 0.26, fur, 0.3, 1.9, 0);
      k.b(0.1, 0.08, 0.02, metal(0xc62828), 0, 2.2, 0.305);
      // 軍服：金ボタン、肩章、立ち襟
      k.b(0.5, 0.1, 0.46, 0xe0b060, 0, 1.6, 0);
      for (const y of [1.42, 1.26, 1.1]) for (const x of [-0.1, 0.1]) k.b(0.05, 0.05, 0.02, metal(GOLD), x, y, 0.22);
      k.pads(0xe0b060, 0.3, 0.08);
      for (const a of k.arms) k.b(0.31, 0.03, 0.31, metal(GOLD), 0, 0.07, 0, a);
      k.skirt(0xffd180, 0.98, 0.62, 0.06); // 上着のすそ
      k.belt(0x2a2a2a, metal(GOLD));
      // 弾薬ベルト（肩から斜めに）
      const band = k.b(0.12, 1.0, 0.48, 0x5d4030, 0, 1.22, 0, k.R, 0, 0, 0.62);
      for (let i = -3; i <= 3; i++) band.add(k.b(0.06, 0.05, 0.04, metal(0xd4a440), 0, i * 0.12, 0.25, band));
      k.boots(0x1e1e1e, 0.4);
      k.gloves(0x3a2a1a, 0.18);
    },
  },
};
