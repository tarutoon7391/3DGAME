// 衣装スキン その9（職業 97〜114：城壁騎士〜賞金稼ぎ）。部品は costume_kit.js
import { metal, glow } from './costume_kit.js';

const GOLD = 0xffcc33;
const LEATHER = 0x6b4423;

export const COSTUMES_I = {
  // 城壁騎士：石積みのような角ばった鎧と、城壁の胸壁を模した兜
  rampart: {
    body: 0x8d6e63, cape: 0x4e342e, pants: 0x5d4037,
    make(k) {
      const stone = metal(0xa1887f);
      const dark = metal(0x6d4c41);
      k.b(0.6, 0.56, 0.6, stone, 0, 1.86, 0);
      k.b(0.46, 0.06, 0.02, 0x1a1a1a, 0, 1.88, 0.305);
      for (const x of [-0.22, 0, 0.22]) k.b(0.14, 0.14, 0.62, stone, x, 2.2, 0); // 兜の胸壁
      k.b(0.84, 0.76, 0.54, stone, 0, 1.22, 0);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) k.b(0.24, 0.02, 0.02, dark, -0.26 + j * 0.26 + (i % 2) * 0.13, 1.44 - i * 0.2, 0.275); // 石積みの目地
      for (const a of k.arms) {
        k.b(0.48, 0.26, 0.48, stone, 0, 0.04, 0, a);
        for (const x of [-0.14, 0.14]) k.b(0.12, 0.1, 0.48, stone, x, 0.2, 0, a);
      }
      k.belt(dark, GOLD);
      k.gloves(dark, 0.3);
      k.shins(stone, -0.1, -0.7);
      k.boots(dark, 0.18);
    },
  },
  // 甲羅闘士：背中の大きな亀甲と、緑の道着
  turtle: {
    body: 0x388e3c, pants: 0x1b5e20,
    make(k) {
      k.hair(0x212121, 'spiky');
      k.headband(0x81c784);
      // 背中の甲羅（六角の板を並べる）
      k.b(0.86, 0.9, 0.24, 0x2e7d32, 0, 1.22, -0.3);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) k.cy(0.12, 0.13, 0.04, 0x66bb6a, -0.2 + i * 0.2, 1.42 - j * 0.34, -0.43, k.R, Math.PI / 2, 0, 0, 6);
      k.b(0.9, 0.06, 0.28, 0xc8e6c9, 0, 0.78, -0.3);
      // 胸当て（腹甲）
      k.b(0.5, 0.6, 0.04, 0xfff59d, 0, 1.2, 0.225);
      for (let i = 0; i < 3; i++) k.b(0.46, 0.02, 0.02, 0xcaa83c, 0, 1.38 - i * 0.16, 0.25);
      k.belt(0x1b5e20);
      k.gloves(0x2e7d32, 0.24);
      k.boots(0x1b5e20, 0.16);
    },
  },
  // 僧兵：白い頭巾（裹頭）と黒い法衣、袈裟
  sohei: {
    body: 0x212121, pants: 0x212121,
    make(k) {
      k.hood(0xfafafa);
      k.b(0.5, 0.18, 0.06, 0xfafafa, 0, 1.7, 0.25); // 口元を覆う布
      k.sleeves(0x212121, true, 0.56);
      k.skirt(0x212121, 0.98, 0.1, 0.14);
      // 袈裟（斜めの布）
      k.b(0.16, 0.9, 0.03, 0xffb74d, 0.04, 1.22, 0.225, k.R, 0, 0, -0.6);
      k.b(0.16, 0.9, 0.03, 0xffb74d, 0.04, 1.22, -0.225, k.R, 0, 0, -0.6);
      k.belt(0xffb74d, null, 0.96);
      for (let i = 0; i < 8; i++) k.sp(0.035, 0x5d4037, Math.cos(i * 0.8) * 0.3, 1.5 - Math.abs(Math.sin(i * 0.8)) * 0.05, 0.24); // 数珠
      k.gloves(0xfafafa, 0.14);
      k.boots(0x5d4037, 0.14);
    },
  },
  // 鎖の番人：鉄仮面と、体に巻いた鎖
  warden: {
    body: 0x455a64, cape: 0x263238, pants: 0x37474f,
    make(k) {
      const iron = metal(0x78909c);
      k.b(0.58, 0.58, 0.58, iron, 0, 1.86, 0);
      for (let i = 0; i < 4; i++) k.b(0.03, 0.3, 0.02, 0x111111, -0.15 + i * 0.1, 1.86, 0.295); // 格子の面
      k.chest(iron, 1.58, 1.0, 0.5);
      // 体に巻いた鎖
      for (let i = 0; i < 8; i++) k.tor(0.05, 0.014, 0x90a4ae, -0.32 + i * 0.09, 1.5 - i * 0.07, 0.27, k.R, 0, i % 2 ? Math.PI / 2 : 0, 0);
      k.pads(iron);
      for (let i = 0; i < 3; i++) k.tor(0.13, 0.016, 0x90a4ae, 0, -0.3 - i * 0.08, 0, k.arms[0], Math.PI / 2); // 左腕に巻いた鎖
      k.belt(0x263238, iron);
      k.gloves(0x263238, 0.3);
      k.boots(0x263238, 0.18);
    },
  },
  // 薬草師：つば広の帽子と前掛け、腰の薬草袋
  herbalist: {
    body: 0x689f38, pants: 0x5d4037,
    make(k) {
      k.hair(0x8d6e63, 'bob');
      k.cy(0.48, 0.48, 0.04, 0x8d6e63, 0, 2.14, 0, k.R, 0, 0, 0, 12);
      k.cy(0.27, 0.29, 0.2, 0x8d6e63, 0, 2.25, 0, k.R, 0, 0, 0, 10);
      k.b(0.28, 0.06, 0.02, 0x9ccc65, 0.12, 2.2, 0.26); // 帽子に挿した葉
      k.b(0.5, 0.8, 0.03, 0xf5f0e6, 0, 0.98, 0.23); // 前掛け
      k.b(0.2, 0.12, 0.02, 0x9ccc65, 0, 1.0, 0.25);
      k.belt(LEATHER);
      for (const x of [-0.3, 0.3]) k.pouch(0x8d6e63, x, 0.9, 0.22, 0.13);
      k.sleeves(0x689f38, false, 0.44);
      k.boots(LEATHER, 0.16);
    },
  },
  // 泉の巫女：白衣に緋袴、水色の髪飾り
  shrine: {
    body: 0xfafafa, pants: 0xc62828,
    make(k) {
      k.hair(0x212121, 'long');
      k.b(0.5, 0.06, 0.06, 0x81d4fa, 0, 2.1, 0.22); // 水引の髪飾り
      k.sp(0.06, glow(0x81d4fa), 0.22, 2.06, 0.18);
      k.sleeves(0xfafafa, true, 0.58);
      k.skirt(0xc62828, 0.98, 0.04, 0.14);
      k.b(0.1, 0.4, 0.02, 0xfafafa, 0, 1.4, 0.225, k.R, 0, 0, 0.5); // 白衣の合わせ
      k.belt(0xc62828, null, 0.98);
      k.boots(0xfafafa, 0.12);
    },
  },
  // 天使：白い衣と光輪、背中の翼
  angel: {
    body: 0xfafafa, cape: 0xfffde7, pants: 0xfafafa,
    make(k) {
      k.hair(0xffe082, 'long');
      const halo = k.tor(0.22, 0.03, glow(0xfff59d), 0, 2.36, 0, k.R, Math.PI / 2);
      k.tick((t) => { halo.position.y = 2.36 + Math.sin(t * 2) * 0.03; });
      // 翼（重ねた羽根の板）
      for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) k.b(0.5 - i * 0.08, 0.14, 0.04, 0xffffff, sd * (0.42 + i * 0.12), 1.5 - i * 0.12, -0.32, k.R, 0, -sd * 0.3, sd * (0.4 + i * 0.15));
      k.skirt(0xfafafa, 1.0, 0.04, 0.16);
      k.sleeves(0xfafafa, true, 0.5);
      k.belt(GOLD, null, 1.0);
      k.boots(0xfff8e1, 0.12);
    },
  },
  // ドルイド：葉の冠と苔色の外套、枝の肩飾り
  druid: {
    body: 0x558b2f, cape: 0x33691e, pants: 0x3e2723,
    make(k) {
      k.hair(0x6d4c41, 'long');
      for (let i = 0; i < 7; i++) k.b(0.1, 0.12, 0.03, 0x8bc34a, Math.cos(i * 0.9) * 0.27, 2.16, Math.sin(i * 0.9) * 0.27, k.R, 0, -i * 0.9, 0.5); // 葉の冠
      k.hood(0x33691e, true);
      k.sleeves(0x558b2f, true, 0.52);
      k.skirt(0x33691e, 0.98, 0.1, 0.14);
      for (const a of k.arms) k.cy(0.02, 0.03, 0.4, 0x6d4c41, 0.1, 0.16, 0, a, 0, 0, -0.6, 5); // 肩の枝
      k.belt(0x6d4c41, 0x8bc34a);
      k.boots(0x3e2723, 0.16);
    },
  },
  // 軍師：紺の道服と綸巾（頭巾）
  tactician: {
    body: 0x283593, pants: 0x1a237e,
    make(k) {
      k.hair(0x212121, 'tied');
      k.b(0.4, 0.22, 0.4, 0x1a237e, 0, 2.2, -0.02); // 綸巾
      k.b(0.04, 0.3, 0.2, 0x1a237e, 0, 2.2, -0.24);
      k.sleeves(0x283593, true, 0.6);
      k.skirt(0x283593, 1.0, 0.02, 0.12);
      k.b(0.3, 0.9, 0.02, 0xfafafa, 0, 1.0, 0.225); // 白い前身頃
      k.belt(0xffd54f, null, 1.0);
      k.boots(0x212121, 0.12);
    },
  },
  // 鍛冶師：革の前掛けと腕抜き、頭のゴーグル
  smith: {
    body: 0x8d6e63, pants: 0x4e342e,
    make(k) {
      k.hair(0x3e2723, 'short');
      k.b(0.56, 0.08, 0.56, 0x212121, 0, 1.96, 0); // ゴーグルのバンド
      for (const x of [-0.12, 0.12]) k.cy(0.07, 0.07, 0.05, glow(0xff8a65), x, 1.98, 0.28, k.R, Math.PI / 2);
      k.b(0.6, 0.95, 0.04, LEATHER, 0, 1.08, 0.235); // 革の前掛け
      k.b(0.3, 0.14, 0.02, 0x4e342e, 0, 1.0, 0.26);
      for (const a of k.arms) k.b(0.26, 0.3, 0.27, LEATHER, 0, -0.45, 0, a);
      k.belt(0x3e2723, metal(0x9e9e9e));
      k.boots(0x3e2723, 0.2);
    },
  },
  // 応援団：長ラン（学ラン）とたすき、はちまき
  cheer: {
    body: 0x212121, pants: 0x212121,
    make(k) {
      k.hair(0x212121, 'spiky');
      k.headband(0xd32f2f);
      k.b(0.76, 1.1, 0.48, 0x212121, 0, 1.02, 0); // 長ラン
      for (let i = 0; i < 5; i++) k.sp(0.03, metal(GOLD), 0, 1.5 - i * 0.14, 0.245);
      k.b(0.14, 1.0, 0.03, 0xffca28, 0, 1.2, 0.245, k.R, 0, 0, 0.6); // たすき
      k.b(0.14, 1.0, 0.03, 0xffca28, 0, 1.2, -0.245, k.R, 0, 0, 0.6);
      k.gloves(0xfafafa, 0.14);
      k.boots(0x212121, 0.14);
    },
  },
  // 風水師：黒い道士帽と青緑の道服、八卦の胸飾り
  geomancer: {
    body: 0x00695c, pants: 0x004d40,
    make(k) {
      k.hair(0x212121, 'tied');
      k.b(0.4, 0.14, 0.4, 0x212121, 0, 2.18, 0);
      k.b(0.2, 0.1, 0.2, 0x212121, 0, 2.3, 0);
      k.sleeves(0x00695c, true, 0.58);
      k.skirt(0x00695c, 1.0, 0.04, 0.12);
      k.cy(0.14, 0.14, 0.03, 0xfafafa, 0, 1.3, 0.225, k.R, Math.PI / 2, 0, 0, 8); // 八卦
      k.cy(0.06, 0.06, 0.035, 0x212121, 0, 1.3, 0.23, k.R, Math.PI / 2, 0, 0, 12);
      k.belt(0xffd54f, null, 1.0);
      k.boots(0x212121, 0.12);
    },
  },
  // 呪術師：紫のフードと骨の飾り
  hexer: {
    body: 0x4a148c, cape: 0x311b92, pants: 0x311b92,
    make(k) {
      k.hood(0x4a148c);
      k.eyes(glow(0xea80fc));
      k.sleeves(0x4a148c, true, 0.6);
      k.skirt(0x4a148c, 0.98, 0.04, 0.16);
      for (let i = 0; i < 5; i++) k.b(0.04, 0.12, 0.04, 0xeeeeee, -0.2 + i * 0.1, 1.5, 0.24); // 骨の首飾り
      k.sp(0.07, 0xeeeeee, 0, 1.36, 0.25);
      k.belt(0x212121, glow(0xab47bc));
      k.boots(0x212121, 0.14);
    },
  },
  // 毒使い：口元のマスクと緑の外套、腰の小瓶
  poisoner: {
    body: 0x33691e, cape: 0x1b5e20, pants: 0x212121,
    make(k) {
      k.hair(0x1b5e20, 'messy');
      k.mask(0x212121);
      k.cy(0.06, 0.06, 0.08, 0x424242, 0.16, 1.72, 0.3, k.R, Math.PI / 2); // 吸収缶
      k.cy(0.06, 0.06, 0.08, 0x424242, -0.16, 1.72, 0.3, k.R, Math.PI / 2);
      k.chest(0x2e7d32);
      k.belt(0x212121);
      for (let i = 0; i < 4; i++) k.cy(0.04, 0.04, 0.12, glow(0x76ff03), -0.24 + i * 0.16, 0.86, 0.24);
      k.gloves(0x212121, 0.24);
      k.boots(0x212121, 0.18);
    },
  },
  // 影縫い：黒装束と灰の覆面、背中の針
  binder: {
    body: 0x212121, pants: 0x212121,
    make(k) {
      k.hair(0x212121, 'tied');
      k.mask(0x455a64);
      k.scarf(0x455a64, 0.4);
      for (let i = 0; i < 5; i++) k.b(0.02, 0.5, 0.02, metal(0x90a4ae), -0.16 + i * 0.08, 1.4, -0.26, k.R, 0, 0, (i - 2) * 0.12); // 背中の針
      k.belt(0x455a64);
      k.gloves(0x37474f, 0.26);
      k.shins(0x37474f, -0.3, -0.72);
      k.boots(0x212121, 0.14);
    },
  },
  // 人形使い：黒いシルクハットと燕尾服、指から伸びる糸
  puppeteer: {
    body: 0x880e4f, pants: 0x212121,
    make(k) {
      k.hair(0xf8bbd0, 'bob');
      k.cy(0.32, 0.32, 0.04, 0x212121, 0, 2.14, 0, k.R, 0, 0, 0, 12);
      k.cy(0.2, 0.22, 0.34, 0x212121, 0, 2.32, 0, k.R, 0, 0, 0, 10);
      k.b(0.46, 0.06, 0.46, 0xf06292, 0, 2.18, 0);
      k.b(0.3, 0.6, 0.02, 0xfafafa, 0, 1.28, 0.215);
      for (const x of [-0.15, 0.15]) k.b(0.3, 0.7, 0.04, 0x880e4f, x, 0.6, -0.23, k.R, -0.08); // 燕尾
      k.cn(0.06, 0.1, 0xf06292, 0, 1.54, 0.23, k.R, 0, 0, Math.PI / 2, 4);
      for (const a of k.arms) for (let i = 0; i < 3; i++) k.b(0.006, 0.7, 0.006, glow(0xf8bbd0), -0.04 + i * 0.04, -1.0, 0.04, a);
      k.gloves(0xfafafa, 0.14);
      k.boots(0x212121, 0.14);
    },
  },
  // 天邪鬼：赤い羽織と片角の面
  contrarian: {
    body: 0xb71c1c, pants: 0x212121,
    make(k) {
      k.hair(0x212121, 'messy');
      k.cn(0.07, 0.24, 0xfff8e1, 0.16, 2.24, 0.04, k.R, 0, 0, -0.3, 5); // 片方だけの角
      k.b(0.3, 0.3, 0.04, 0xfafafa, -0.1, 1.86, 0.27, k.R, 0, 0.2, 0); // 半分の面
      k.b(0.06, 0.04, 0.02, 0xd32f2f, -0.14, 1.9, 0.295);
      k.b(0.8, 0.9, 0.5, 0xb71c1c, 0, 1.12, 0); // 羽織
      k.b(0.1, 0.9, 0.02, 0x212121, -0.08, 1.12, 0.255);
      k.b(0.1, 0.9, 0.02, 0x212121, 0.08, 1.12, 0.255);
      k.sleeves(0xb71c1c, true, 0.5);
      k.belt(0x212121);
      k.boots(0x212121, 0.14);
    },
  },
  // 賞金稼ぎ：つば広の帽子、ポンチョ、弾帯
  bounty: {
    body: 0x8d6e63, pants: 0x5d4037,
    make(k) {
      k.hair(0x3e2723, 'messy');
      k.cy(0.5, 0.5, 0.04, LEATHER, 0, 2.12, 0, k.R, 0, 0, 0, 12);
      k.cy(0.24, 0.27, 0.22, LEATHER, 0, 2.24, 0, k.R, 0, 0, 0, 10);
      k.b(0.5, 0.05, 0.5, 0x3e2723, 0, 2.17, 0);
      k.b(0.9, 0.5, 0.56, 0xa1887f, 0, 1.36, 0); // ポンチョ
      for (let i = 0; i < 6; i++) k.b(0.12, 0.04, 0.58, 0x6d4c41, -0.3 + i * 0.12, 1.15, 0);
      k.b(0.1, 0.9, 0.03, 0x3e2723, 0, 1.2, 0.25, k.R, 0, 0, 0.55); // 弾帯
      for (let i = 0; i < 6; i++) k.b(0.03, 0.08, 0.03, metal(GOLD), -0.16 + i * 0.07, 1.48 - i * 0.1, 0.27, k.R, 0, 0, 0.55);
      k.belt(0x3e2723, metal(GOLD));
      k.boots(0x3e2723, 0.22);
    },
  },
};
