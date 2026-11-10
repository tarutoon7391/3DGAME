// 依頼ボード：納品クエストを常に3件そろえる
import { CROPS, CROP_IDS } from './data/crops.js';
import { ITEMS } from './data/items.js';
import { ANIMALS, QUEST_COUNT, QUEST_REWARD_RATE, questAmount } from './data/balance.js';
import { countBase, takeBase } from './state.js';

const CLIENTS = ['村長', 'パン屋', '食堂のおかみ', '八百屋', '学校の先生', '旅人', 'となりの農家'];

/** 今の農場で用意できる品目（解放済みの作物＋飼っている動物の生産物） */
function candidates(state) {
  const list = CROP_IDS.filter((id) => CROPS[id].level <= state.level);
  for (const [type, a] of Object.entries(ANIMALS)) {
    if (state.animals.some((x) => x.type === type)) list.push(a.product);
  }
  return list;
}

function makeQuest(state) {
  const pool = candidates(state).filter((b) => !state.quests.some((q) => q.base === b));
  const all = pool.length ? pool : candidates(state);
  const base = all[Math.floor(Math.random() * all.length)];
  const sell = ITEMS[base].sell;
  const amount = questAmount(sell, Math.random());
  const reward = Math.round((sell * amount * QUEST_REWARD_RATE) / 10) * 10;
  return {
    base,
    amount,
    reward,
    exp: 20 + Math.round(reward / 12),
    from: CLIENTS[Math.floor(Math.random() * CLIENTS.length)],
  };
}

/** 足りない分を補充（新規ゲームの1件目は必ずカブ） */
export function fillQuests(state) {
  while (state.quests.length < QUEST_COUNT) {
    if (state.questsDone === 0 && state.quests.length === 0) {
      state.quests.push({ base: 'turnip', amount: 3, reward: 220, exp: 40, from: '村長' });
    } else state.quests.push(makeQuest(state));
  }
}

/** 納品。成功で依頼オブジェクトを返す（その枠は新しい依頼に入れ替わる） */
export function deliver(state, index) {
  const q = state.quests[index];
  if (!q || !takeBase(state, q.base, q.amount)) return null;
  state.quests.splice(index, 1);
  state.questsDone += 1;
  fillQuests(state);
  return q;
}

export const questProgress = (state, q) => Math.min(q.amount, countBase(state, q.base));
