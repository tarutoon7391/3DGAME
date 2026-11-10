// 各メニューの中身：ショップ・出荷箱・依頼ボード・持ち物・就寝確認
import { CROPS } from './data/crops.js';
import { ITEMS, baseName } from './data/items.js';
import { ANIMALS, FIELD_SIZES, STAMINA_MAX, TOOL_LEVEL_NAMES, CAN_CAPACITY, TOOLS, shopEntries } from './data/balance.js';
import { addItem, count, takeItem } from './state.js';
import { deliver, questProgress } from './quests.js';
import { escHtml } from './panel.js';

const SHOP = shopEntries();
const btn = (label, act, arg = '', disabled = false, cls = '') =>
  `<button class="fm-btn ${cls}" data-act="${act}" data-arg="${escHtml(arg)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const row = (icon, title, sub, buttons, locked = false) =>
  `<div class="fm-row${locked ? ' locked' : ''}"><div class="fm-ico">${icon}</div><div class="fm-main"><b>${title}</b><span>${sub}</span></div>${buttons}</div>`;

/**
 * @param {object} ctx { state, sfx, toast, addExp, animals, field, sleep, setTool }
 */
export function createMenus(panels, ctx) {
  const { state, sfx } = ctx;
  let shopTab = 'seed';

  function entryInfo(e) {
    switch (e.kind) {
      case 'item': return { icon: ITEMS[e.item].icon, name: ITEMS[e.item].name, done: false };
      case 'tool': {
        const t = TOOLS.find((x) => x.id === e.tool);
        return { icon: t.icon, name: `${t.name}（${TOOL_LEVEL_NAMES[e.lv - 1]}）`, done: state.tools[e.tool] >= e.lv, need: state.tools[e.tool] < e.lv - 1 };
      }
      case 'expand': return { icon: '🧱', name: `畑の拡張 ${FIELD_SIZES[e.size]}×${FIELD_SIZES[e.size]}`, done: state.fieldLevel >= e.size, need: state.fieldLevel < e.size - 1 };
      case 'animal': {
        const n = ctx.animals.count(e.animal);
        return { icon: e.animal === 'cow' ? '🐄' : '🐔', name: `${ANIMALS[e.animal].name}（${n}/${ANIMALS[e.animal].max}）`, done: n >= ANIMALS[e.animal].max };
      }
    }
    return null;
  }

  function buy(i, qty) {
    const e = SHOP[i];
    const price = e.price * qty;
    if (state.level < e.level || state.money < price) { sfx.ng(); return; }
    const info = entryInfo(e);
    if (info.done || info.need) { sfx.ng(); return; }
    state.money -= price;
    switch (e.kind) {
      case 'item': addItem(state, e.item, qty); break;
      case 'tool':
        state.tools[e.tool] = e.lv;
        if (e.tool === 'can') state.water = CAN_CAPACITY[e.lv - 1];
        ctx.toast(`${info.name}に強化した！`);
        break;
      case 'expand':
        state.fieldLevel = e.size;
        ctx.field.markDirty();
        ctx.toast(`畑が ${FIELD_SIZES[e.size]}×${FIELD_SIZES[e.size]} に広がった！`);
        break;
      case 'animal': {
        const name = ctx.animals.add(e.animal);
        addItem(state, 'feed', 5);
        ctx.toast(`${ANIMALS[e.animal].name}の「${name}」がやってきた！（飼料+5）`);
        break;
      }
    }
    sfx.coin();
  }

  const shop = {
    head: () => ({ title: '🏪 よろず屋', sub: `所持金 ${state.money}G` }),
    render() {
      const tabs = [['seed', 'タネ・食べ物'], ['tool', '道具・畑'], ['animal', '動物']]
        .map(([k, l]) => `<button class="fm-tab ${shopTab === k ? 'on' : ''}" data-act="tab" data-arg="${k}">${l}</button>`).join('');
      const rows = SHOP.map((e, i) => ({ e, i })).filter(({ e }) => (shopTab === 'seed' ? e.kind === 'item' : shopTab === 'tool' ? e.kind === 'tool' || e.kind === 'expand' : e.kind === 'animal'))
        .map(({ e, i }) => {
          const info = entryInfo(e);
          const locked = state.level < e.level;
          let buttons;
          if (locked) buttons = `<span class="fm-note">農場Lv${e.level}で解放</span>`;
          else if (info.done) buttons = '<span class="fm-note">購入済み</span>';
          else if (info.need) buttons = '<span class="fm-note">前の段階が必要</span>';
          else if (e.kind === 'item') buttons = btn(`${e.price}G`, 'buy', `${i}:1`, state.money < e.price) + btn('×5', 'buy', `${i}:5`, state.money < e.price * 5);
          else buttons = btn(`${e.price}G`, 'buy', `${i}:1`, state.money < e.price, 'go');
          const have = e.kind === 'item' ? `（所持 ${count(state, e.item)}）` : '';
          return row(info.icon, info.name + have, e.desc, buttons, locked);
        }).join('');
      return `<div class="fm-tabs">${tabs}</div>${rows}`;
    },
    onAct(act, arg) {
      if (act === 'tab') shopTab = arg;
      if (act === 'buy') { const [i, q] = arg.split(':').map(Number); buy(i, q); }
    },
  };

  const sellable = () => Object.keys(state.items).filter((id) => ITEMS[id]?.sell > 0);
  const shipTotal = () => Object.entries(state.ship).reduce((s, [id, n]) => s + ITEMS[id].sell * n, 0);
  function ship(id, n) {
    if (!takeItem(state, id, n)) return;
    state.ship[id] = (state.ship[id] ?? 0) + n;
    sfx.coin();
  }
  const shipping = {
    head: () => ({ title: '📦 出荷箱', sub: `明日の朝 ${shipTotal()}G 入金` }),
    render() {
      const inBox = Object.entries(state.ship).map(([id, n]) => `${ITEMS[id].icon}${ITEMS[id].name}×${n}`).join('　') || 'まだ何も入っていない';
      const items = sellable();
      const rows = items.map((id) => {
        const it = ITEMS[id];
        const n = count(state, id);
        return row(it.icon, `${it.name} ×${n}`, `1個 ${it.sell}G`, btn('1個', 'one', id) + btn('全部', 'all', id, false, 'go'));
      }).join('');
      return `<p class="fm-note">箱の中：${inBox}</p>${items.length ? btn('作物と畜産物を全部出荷', 'everything', '', false, 'go') : ''}${rows || '<p class="fm-note">出荷できる物を持っていない。収穫してから来よう。</p>'}`;
    },
    onAct(act, arg) {
      if (act === 'one') ship(arg, 1);
      if (act === 'all') ship(arg, count(state, arg));
      if (act === 'everything') for (const id of sellable()) ship(id, count(state, id));
    },
  };

  const board = {
    head: () => ({ title: '📋 依頼ボード', sub: `達成 ${state.questsDone} 件` }),
    render() {
      return '<p class="fm-note">品物を持ってきて納品すると、報酬と農場EXPがもらえる。</p>' + state.quests.map((q, i) => {
        const have = questProgress(state, q);
        const it = ITEMS[q.base];
        return row(it.icon, `${baseName(q.base)}を ${q.amount} 個（${have}/${q.amount}）`, `依頼主：${q.from}　報酬 ${q.reward}G・EXP ${q.exp}`, btn('納品', 'deliver', String(i), have < q.amount, 'go'));
      }).join('');
    },
    onAct(act, arg) {
      if (act !== 'deliver') return;
      const q = deliver(state, Number(arg));
      if (!q) { sfx.ng(); return; }
      state.money += q.reward;
      sfx.coin();
      ctx.toast(`依頼達成！ ${q.reward}G と EXP ${q.exp} を受け取った`);
      ctx.addExp(q.exp);
    },
  };

  const inventory = {
    head: () => ({ title: '🎒 持ち物', sub: `所持金 ${state.money}G` }),
    render() {
      const tools = TOOLS.map((t) => `${t.icon}${t.name}${state.tools[t.id] ? `（${TOOL_LEVEL_NAMES[state.tools[t.id] - 1]}）` : ''}`).join('　');
      const ids = Object.keys(state.items).sort((a, b) => (ITEMS[a].kind > ITEMS[b].kind ? 1 : -1));
      const rows = ids.map((id) => {
        const it = ITEMS[id];
        let b = '';
        if (it.kind === 'seed') b += btn(state.seed === it.crop ? '選択中' : 'えらぶ', 'seed', it.crop, state.seed === it.crop, 'go');
        if (it.eat) b += btn(`食べる +${it.eat}`, 'eat', id, state.stamina >= STAMINA_MAX);
        let sub = it.kind === 'seed' ? `${CROPS[it.crop].days}日で収穫` : it.sell ? `売値 ${it.sell}G` : '';
        if (it.kind === 'feed') sub = '道具「エサ」で動物に与える';
        return row(it.icon, `${it.name} ×${state.items[id]}`, sub, b);
      }).join('');
      return `<p class="fm-note">道具：${tools}</p><p class="fm-note">スタミナ ${Math.round(state.stamina)}/${STAMINA_MAX}・出荷総額 ${state.totalShipped}G</p>${rows || '<p class="fm-note">何も持っていない</p>'}`;
    },
    onAct(act, arg) {
      if (act === 'seed') { state.seed = arg; ctx.setTool(2); sfx.open(); }
      if (act === 'eat') {
        const it = ITEMS[arg];
        if (!takeItem(state, arg, 1)) return;
        state.stamina = Math.min(STAMINA_MAX, state.stamina + it.eat);
        sfx.eat();
        ctx.toast(`${it.name}を食べた（スタミナ +${it.eat}）`);
      }
    },
  };

  const sleepConfirm = {
    head: () => ({ title: '🛏️ ベッド', sub: '' }),
    render() {
      const unwatered = ctx.unwateredCount();
      const warn = state.weather !== 'rain' && unwatered > 0 ? `<p class="fm-note">⚠ 水をやっていない作物が ${unwatered} マスある</p>` : '';
      const hungry = state.animals.filter((a) => !a.fed).length;
      const warn2 = hungry ? `<p class="fm-note">⚠ エサをもらっていない動物が ${hungry} 匹いる</p>` : '';
      return `<p>寝て次の日にしますか？（自動セーブされます）</p>${warn}${warn2}<div style="display:flex;gap:8px;justify-content:center;margin:10px 0">${btn('寝る', 'sleep', '', false, 'go')}${btn('まだ起きている', 'close')}</div>`;
    },
    onAct(act) {
      if (act === 'sleep') { panels.close(); ctx.sleep(false); }
    },
  };

  return {
    open(kind) {
      const spec = { shop, ship: shipping, board, inventory, bed: sleepConfirm }[kind];
      if (!spec) return;
      sfx.open();
      panels.open(spec);
    },
  };
}
