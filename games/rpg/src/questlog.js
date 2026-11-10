// クエスト進行と NPC 会話の分岐（データは data/quests.js・data/dialogs.js）
import { QUESTS, QUEST_ORDER } from './data/quests.js';
import { TALK } from './data/dialogs.js';
import { ITEMS } from './data/items.js';

/** 収集クエストの素材がそろっているか */
function gatherReady(state) {
  const q = QUESTS.gather;
  return Object.entries(q.needs).every(([id, n]) => state.count(id) >= n);
}

/** status を最新化（収集は所持数で決まる） */
export function refreshQuests(state) {
  const g = state.progress.quests.gather;
  if (g.status === 'active' || g.status === 'done') g.status = gatherReady(state) ? 'done' : 'active';
}

/** 敵撃破時 */
export function onKill(game, areaId) {
  const q = game.state.progress.quests.hunt;
  if (q.status === 'active' && areaId === QUESTS.hunt.area) {
    q.count++;
    if (q.count >= QUESTS.hunt.count) {
      q.status = 'done';
      game.toast('クエスト達成！ 村長に報告しよう');
      game.sound.se('quest');
    }
  }
}

/** 報酬を渡して cleared にする */
function giveReward(game, id) {
  const st = game.state;
  const r = QUESTS[id].reward;
  st.progress.quests[id].status = 'cleared';
  st.progress.gold += r.gold;
  const names = [];
  for (const [it, n] of Object.entries(r.items || {})) {
    st.addItem(it, n);
    names.push(`${ITEMS[it].name}×${n}`);
  }
  game.toast(`報酬：${r.gold}G・${r.exp}EXP${names.length ? '・' + names.join('・') : ''}`, 3000);
  game.sound.se('quest');
  game.giveExp(r.exp);
}

function accept(game, id) {
  game.state.progress.quests[id].status = 'active';
  game.state.progress.quests[id].count = 0;
  refreshQuests(game.state);
  game.toast(`クエスト受注：${QUESTS[id].name}`);
  game.sound.se('quest');
}

/**
 * NPC に話しかけたときの会話内容と、会話後の処理を返す。
 * @returns {{lines:string[], after?:Function}}
 */
export function talkFor(game, npcId) {
  const st = game.state;
  const qs = st.progress.quests;
  refreshQuests(st);
  const T = TALK[npcId];
  if (npcId === 'chief') {
    if (qs.hunt.status === 'none') return { lines: T.hunt_none, after: () => accept(game, 'hunt') };
    if (qs.hunt.status === 'active') return { lines: T.hunt_active };
    if (qs.hunt.status === 'done') {
      return {
        lines: [...T.hunt_done, ...T.boss_none],
        after: () => {
          giveReward(game, 'hunt');
          accept(game, 'boss');
        },
      };
    }
    if (qs.boss.status === 'cleared') return { lines: T.all_clear };
    return { lines: T.boss_active };
  }
  if (npcId === 'healer') {
    const g = qs.gather;
    if (g.status === 'none') return { lines: T.gather_none, after: () => accept(game, 'gather') };
    if (g.status === 'active') return { lines: T.gather_active };
    if (g.status === 'done') {
      return {
        lines: T.gather_done,
        after: () => {
          for (const [id, n] of Object.entries(QUESTS.gather.needs)) st.removeItem(id, n);
          giveReward(game, 'gather');
        },
      };
    }
    return { lines: T.cleared };
  }
  return { lines: T.default };
}

/** HUD 用の進行表示（HTML 断片の配列） */
export function questLines(state) {
  refreshQuests(state);
  const out = [];
  for (const id of QUEST_ORDER) {
    const q = QUESTS[id];
    const s = state.progress.quests[id];
    if (s.status === 'none' || s.status === 'cleared') continue;
    let prog = '';
    if (q.type === 'kill') prog = s.status === 'done' ? '報告しよう' : `${s.count}/${q.count}`;
    else if (q.type === 'collect') {
      prog = s.status === 'done' ? '報告しよう' : Object.entries(q.needs).map(([it, n]) => `${ITEMS[it].name}${Math.min(state.count(it), n)}/${n}`).join(' ');
    } else prog = '魔窟の最深部へ';
    out.push({ name: q.name, prog, done: s.status === 'done' });
  }
  return out;
}

/** メニュー用：全クエストの状態 */
export function questList(state) {
  refreshQuests(state);
  const label = { none: '未受注', active: '進行中', done: '報告待ち', cleared: '達成' };
  return QUEST_ORDER.map((id) => ({ id, name: QUESTS[id].name, desc: QUESTS[id].desc, status: label[state.progress.quests[id].status] }));
}
