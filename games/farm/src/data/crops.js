// 作物データ（バランス数値はここに集約）
// days: 種まきから収穫までの日数（水やりした日だけ1日進む）
// regrow: 収穫後に再収穫できるまでの日数（何度も収穫できるタイプのみ）
// shape: 見た目の型（root=根菜 / bush=実のなる株 / tall=背の高い穂 / big=大玉）
export const CROPS = {
  turnip: {
    name: 'カブ', icon: '🥬', seedPrice: 20, days: 2, sell: 45, eat: 10, level: 1,
    shape: 'root', fruit: 0xf4eef7, leaf: 0x66bb4a,
  },
  potato: {
    name: 'ジャガイモ', icon: '🥔', seedPrice: 30, days: 3, sell: 80, eat: 15, level: 1,
    shape: 'root', fruit: 0xc69a5c, leaf: 0x4f9a3e,
  },
  tomato: {
    name: 'トマト', icon: '🍅', seedPrice: 60, days: 4, regrow: 2, sell: 45, eat: 8, level: 2,
    shape: 'bush', fruit: 0xe53935, leaf: 0x3d8b37,
  },
  corn: {
    name: 'トウモロコシ', icon: '🌽', seedPrice: 80, days: 5, sell: 190, eat: 20, level: 3,
    shape: 'tall', fruit: 0xf4d03f, leaf: 0x7cb342,
  },
  pumpkin: {
    name: 'カボチャ', icon: '🎃', seedPrice: 120, days: 6, sell: 360, eat: 25, level: 4,
    shape: 'big', fruit: 0xf57c00, leaf: 0x558b2f,
  },
  melon: {
    name: 'メロン', icon: '🍈', seedPrice: 180, days: 7, sell: 560, eat: 30, level: 5,
    shape: 'big', fruit: 0xa5d66b, leaf: 0x4caf50,
  },
};

export const CROP_IDS = Object.keys(CROPS);

/** 種アイテムの id（例 seed_turnip） */
export const seedId = (cropId) => `seed_${cropId}`;
