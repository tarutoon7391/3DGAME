// ゲーム状態（セーブ対象）の生成と所持品の操作
import { CAN_CAPACITY, FIELD_SIZES, STAMINA_MAX, START, expForLevel } from './data/balance.js';
import { ITEMS } from './data/items.js';

export const SAVE_VERSION = 1;
export const GRID = FIELD_SIZES[FIELD_SIZES.length - 1]; // 畑の最大一辺（タイル配列は常にこのサイズ）

/** 空のタイル（t:耕した, w:濡れている, c:作物id, g:育った日数） */
export const emptyTile = () => ({ t: 0, w: 0, c: null, g: 0 });

/** 新規ゲームの状態 */
export function newState() {
  return {
    v: SAVE_VERSION,
    day: 1,
    time: 0,
    weather: 'sunny',
    money: START.money,
    stamina: STAMINA_MAX,
    exp: 0,
    level: 1,
    cleared: false,
    items: { ...START.items },
    ship: {},
    tools: { hoe: 1, can: 1 },
    water: CAN_CAPACITY[0],
    tool: 0,
    seed: 'turnip',
    fieldLevel: 0,
    tiles: Array.from({ length: GRID * GRID }, emptyTile),
    animals: [],
    products: [],
    quests: [],
    totalShipped: 0,
    questsDone: 0,
  };
}

/** 読み込んだデータが使えるか（壊れていたら null） */
export function validate(data) {
  if (!data || data.v !== SAVE_VERSION || !Array.isArray(data.tiles) || data.tiles.length !== GRID * GRID) return null;
  const base = newState();
  return { ...base, ...data, tools: { ...base.tools, ...data.tools } };
}

export const fieldSize = (s) => FIELD_SIZES[s.fieldLevel];
export const count = (s, id) => s.items[id] ?? 0;

export function addItem(s, id, n = 1) {
  s.items[id] = count(s, id) + n;
}

/** n 個減らす。足りなければ false */
export function takeItem(s, id, n = 1) {
  if (count(s, id) < n) return false;
  s.items[id] -= n;
  if (s.items[id] <= 0) delete s.items[id];
  return true;
}

/** base（種類）単位の所持数（品質違いを合算） */
export function countBase(s, base) {
  let n = 0;
  for (const [id, c] of Object.entries(s.items)) if (ITEMS[id]?.base === base) n += c;
  return n;
}

/** base 単位で n 個減らす（品質の低い順に消費） */
export function takeBase(s, base, n) {
  if (countBase(s, base) < n) return false;
  const ids = Object.keys(s.items)
    .filter((id) => ITEMS[id]?.base === base)
    .sort((a, b) => (ITEMS[a].quality ?? 0) - (ITEMS[b].quality ?? 0));
  for (const id of ids) {
    const k = Math.min(n, s.items[id]);
    takeItem(s, id, k);
    n -= k;
    if (n <= 0) break;
  }
  return true;
}

/** EXP を加算し、上がったレベルの配列を返す */
export function addExp(s, n) {
  s.exp += Math.max(0, Math.floor(n));
  const ups = [];
  while (s.exp >= expForLevel(s.level + 1)) {
    s.level += 1;
    ups.push(s.level);
  }
  return ups;
}
