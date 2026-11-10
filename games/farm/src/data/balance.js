// バランス数値：時間・スタミナ・道具・農場レベル・ショップ・動物・依頼
import { CROPS, CROP_IDS, seedId } from './crops.js';

// ---- 時間 ----
export const DAY_START_HOUR = 6;   // 起床 6:00
export const DAY_END_HOUR = 26;    // 翌 2:00 で力尽きる
export const DAY_SECONDS = 300;    // 1日 = 現実の 5 分
export const HOUR_SECONDS = DAY_SECONDS / (DAY_END_HOUR - DAY_START_HOUR);
export const RAIN_CHANCE = 0.3;

// ---- プレイヤー ----
export const STAMINA_MAX = 100;
export const PASSOUT_STAMINA = 0.5; // 力尽きた翌朝の回復率
export const WALK_SPEED = 4.2;
export const TIRED_SPEED = 2.4;

// ---- 道具 ----
// 1 クワ / 2 ジョウロ / 3 タネ / 4 カマ / 5 エサ
export const TOOLS = [
  { id: 'hoe', name: 'クワ', icon: '⛏️', cost: [2, 4, 6] },
  { id: 'can', name: 'ジョウロ', icon: '🚿', cost: [1, 2, 4] },
  { id: 'seed', name: 'タネ', icon: '🌱', cost: [0, 0, 0] },
  { id: 'sickle', name: 'カマ', icon: '🔪', cost: [1, 1, 1] },
  { id: 'feed', name: 'エサ', icon: '🌾', cost: [0, 0, 0] },
];
// 道具レベル別：1 = 1マス、2 = 前方3マス、3 = 前方3×3
export const TOOL_LEVEL_NAMES = ['ふつう', '銅', '金'];
export const CAN_CAPACITY = [20, 40, 70];

// ---- 農場レベル（累計EXPのしきい値。index = レベル-1） ----
export const LEVEL_EXP = [0, 80, 280, 650, 1300];
export const CLEAR_LEVEL = 5;
/** レベル lv に必要な累計EXP（5以降は 1300 から +900 ずつ） */
export function expForLevel(lv) {
  if (lv <= LEVEL_EXP.length) return LEVEL_EXP[lv - 1];
  return LEVEL_EXP[LEVEL_EXP.length - 1] + (lv - LEVEL_EXP.length) * 900;
}
export const SHIP_EXP_RATE = 0.25; // 出荷額 × この率 が EXP

// ---- 畑 ----
export const FIELD_SIZES = [6, 8, 10, 12];

// ---- 動物 ----
export const ANIMALS = {
  chicken: { name: 'ニワトリ', price: 500, level: 2, max: 4, product: 'egg' },
  cow: { name: 'ウシ', price: 1500, level: 3, max: 2, product: 'milk' },
};
export const AFFECTION = { feed: 4, pet: 3, hungry: -8, good: 30, best: 70 };
/** なつき度 → 品質（0〜2） */
export const qualityOf = (aff) => (aff >= AFFECTION.best ? 2 : aff >= AFFECTION.good ? 1 : 0);

// ---- ショップ ----
// kind: item=アイテム購入 / tool=道具強化 / expand=畑の拡張 / animal=動物
export function shopEntries() {
  const list = [];
  for (const id of CROP_IDS) {
    const c = CROPS[id];
    list.push({ kind: 'item', item: seedId(id), price: c.seedPrice, level: c.level, desc: `${c.days}日で収穫・${c.sell}G${c.regrow ? `・${c.regrow}日ごとに再収穫` : ''}` });
  }
  list.push({ kind: 'item', item: 'onigiri', price: 60, level: 1, desc: 'スタミナ +35' });
  list.push({ kind: 'item', item: 'bento', price: 180, level: 3, desc: 'スタミナ +80' });
  list.push({ kind: 'item', item: 'feed', price: 10, level: 2, desc: '動物のエサ（1日1回）' });
  list.push({ kind: 'tool', tool: 'hoe', lv: 2, price: 600, level: 2, desc: '前方3マスを一度に耕す' });
  list.push({ kind: 'tool', tool: 'can', lv: 2, price: 600, level: 2, desc: '前方3マスに水やり・容量40' });
  list.push({ kind: 'tool', tool: 'hoe', lv: 3, price: 2500, level: 4, desc: '前方3×3マスを耕す' });
  list.push({ kind: 'tool', tool: 'can', lv: 3, price: 2500, level: 4, desc: '前方3×3マスに水やり・容量70' });
  list.push({ kind: 'expand', size: 1, price: 800, level: 2, desc: '畑を 8×8 に広げる' });
  list.push({ kind: 'expand', size: 2, price: 2000, level: 3, desc: '畑を 10×10 に広げる' });
  list.push({ kind: 'expand', size: 3, price: 4000, level: 4, desc: '畑を 12×12 に広げる' });
  list.push({ kind: 'animal', animal: 'chicken', price: ANIMALS.chicken.price, level: ANIMALS.chicken.level, desc: '毎日エサで卵を産む（飼料5つ付き）' });
  list.push({ kind: 'animal', animal: 'cow', price: ANIMALS.cow.price, level: ANIMALS.cow.level, desc: '毎日エサで牛乳が取れる（飼料5つ付き）' });
  return list;
}

// ---- 依頼 ----
export const QUEST_COUNT = 3;
export const QUEST_REWARD_RATE = 1.6; // 報酬 = 売値 × 個数 × 率
/** 依頼の個数レンジ（売値が高いほど少ない） */
export function questAmount(sell, rnd) {
  const max = sell <= 60 ? 6 : sell <= 150 ? 4 : sell <= 250 ? 3 : 2;
  const min = sell <= 60 ? 3 : 1;
  return min + Math.floor(rnd * (max - min + 1));
}

// ---- 新規ゲームの初期状態 ----
export const START = {
  money: 300,
  items: { seed_turnip: 12, seed_potato: 4, onigiri: 2 },
};
