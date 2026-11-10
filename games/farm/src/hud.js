// HUD の文字列づくり（左上の情報・左下の道具バー）と序盤のガイド
import { CROPS, seedId } from './data/crops.js';
import { ITEMS } from './data/items.js';
import { TOOLS, STAMINA_MAX, CAN_CAPACITY, TOOL_LEVEL_NAMES, expForLevel } from './data/balance.js';
import { GRID, count, fieldSize } from './state.js';
import { questProgress } from './quests.js';
import { stageOf } from './field.js';

function forTiles(state, fn) {
  const size = fieldSize(state);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) fn(state.tiles[j * GRID + i]);
}

export function unwateredCount(state) {
  let n = 0;
  forTiles(state, (t) => { if (t.c && !t.w && stageOf(t) < 3) n++; });
  return n;
}

/** 序盤（最初の出荷まで）の「次にやること」 */
export function nextGoal(state) {
  if (state.totalShipped > 0 || state.day > 6) return '';
  let tilled = 0, planted = 0, dry = 0, mature = 0;
  forTiles(state, (t) => {
    if (t.t) tilled++;
    if (t.c) { planted++; if (stageOf(t) === 3) mature++; else if (!t.w) dry++; }
  });
  const sellable = Object.keys(state.items).some((id) => ITEMS[id]?.sell > 0);
  if (Object.keys(state.ship).length) return '寝ると翌朝に売上が入る（ベッドで E）';
  if (sellable) return '出荷箱の前で E を押して出荷しよう';
  if (mature) return '育った作物の前で F を押して収穫しよう';
  if (!tilled) return '畑（木の枠の中）で 1:クワ を使って耕そう（F）';
  if (!planted) return '3:タネ に持ち替えて、耕したマスに種をまこう';
  if (dry && state.weather !== 'rain') return '2:ジョウロ で水やり（空になったら井戸で F）';
  return '今日の作業はおしまい。家のベッドで E を押して寝よう';
}

const WEATHER = { sunny: '☀ 晴れ', rain: '☔ 雨' };

export function buildHud(state, hour, goal) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 6) * 10;
  const clock = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const st = Math.round(state.stamina);
  const stCol = st > 50 ? '#7bd36b' : st > 20 ? '#ffca28' : '#ef5350';
  const need = expForLevel(state.level + 1);
  const quests = state.quests.map((q) => {
    const have = questProgress(state, q);
    return `<div class="fm-q">${have >= q.amount ? '✅' : '・'}${ITEMS[q.base].icon}${ITEMS[q.base].name} ${have}/${q.amount}（${q.reward}G）</div>`;
  }).join('');
  return `<b>📅 ${state.day}日目　${clock}　${WEATHER[state.weather]}</b><br>`
    + `💰 <b>${state.money}G</b>　🌾 農場Lv${state.level}（EXP ${state.exp}/${need}）<br>`
    + `⚡ スタミナ <span class="fm-stam"><i style="width:${(st / STAMINA_MAX) * 100}%;background:${stCol}"></i></span> ${st}<br>`
    + `<div style="margin-top:4px">📋 依頼（ボードで納品）</div>${quests}`
    + (goal ? `<div style="margin-top:6px;color:#ffe082">👉 ${goal}</div>` : '');
}

export function buildHotbar(state) {
  return TOOLS.map((t, i) => {
    let sub = t.name;
    if (t.id === 'hoe') sub += `<br>${TOOL_LEVEL_NAMES[state.tools.hoe - 1]}`;
    if (t.id === 'can') sub = `ジョウロ<br>💧${state.water}/${CAN_CAPACITY[state.tools.can - 1]}`;
    if (t.id === 'seed') sub = `${CROPS[state.seed].name}<br>×${count(state, seedId(state.seed))}`;
    if (t.id === 'feed') sub = `エサ<br>×${count(state, 'feed')}`;
    const icon = t.id === 'seed' ? CROPS[state.seed].icon : t.icon;
    return `<div class="fm-slot${state.tool === i ? ' on' : ''}"><span class="k">${i + 1}</span><span class="i">${icon}</span>${sub}</div>`;
  }).join('');
}
