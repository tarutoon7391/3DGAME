// Tab メニュー：ステータス／装備／持ち物／クエスト
import { esc } from '../util.js';
import { WEAPONS, ARMORS, ITEMS } from '../data/items.js';
import { SKILLS, expToNext, MAX_LEVEL } from '../data/levels.js';
import { questList } from '../questlog.js';

const TABS = [['status', 'ステータス'], ['equip', '装備'], ['items', '持ち物'], ['quests', 'クエスト']];

export function openMenu(game, host, startTab = 'status') {
  let tab = startTab;
  const st = game.state;
  const pr = st.progress;

  function body() {
    const d = st.derived();
    if (tab === 'status') {
      const next = pr.level >= MAX_LEVEL ? '―' : `${Math.floor(pr.exp)} / ${expToNext(pr.level)}`;
      return `<table class="rpg-stat">
        <tr><td>レベル</td><td>${pr.level}</td><td>EXP</td><td>${next}</td></tr>
        <tr><td>HP</td><td>${Math.ceil(pr.hp)} / ${d.maxHp}</td><td>MP</td><td>${Math.floor(pr.mp)} / ${d.maxMp}</td></tr>
        <tr><td>攻撃</td><td>${d.atk}（素 ${d.baseAtk}＋武器 ${WEAPONS[pr.weapon].atk}）</td><td>防御</td><td>${d.def}（素 ${d.baseDef}＋防具 ${ARMORS[pr.armor].def}）</td></tr>
        <tr><td>所持金</td><td>${pr.gold}G</td><td>撃破数</td><td>${pr.stats.kills}</td></tr>
      </table>
      <h4>スキル</h4>
      <table>${Object.values(SKILLS).map((s) => `<tr><td>[${s.label}] ${esc(s.name)}</td><td>${esc(s.desc)}</td><td>MP ${s.mp}</td><td>CD ${s.cd}秒</td></tr>`).join('')}</table>`;
    }
    if (tab === 'equip') {
      const row = (id, def, kind, cur, stat) => `<tr><td>${cur ? '▶ ' : ''}${esc(def.name)}</td><td>${stat}</td>
        <td>${cur ? '<small>装備中</small>' : `<button class="rpg-btn" data-equip="${kind}:${id}">装備</button>`}</td></tr>`;
      return `<h4>武器</h4><table>${pr.weapons.map((id) => row(id, WEAPONS[id], 'weapon', pr.weapon === id, `攻撃 +${WEAPONS[id].atk}`)).join('')}</table>
        <h4>防具</h4><table>${pr.armors.map((id) => row(id, ARMORS[id], 'armor', pr.armor === id, `防御 +${ARMORS[id].def}`)).join('')}</table>`;
    }
    if (tab === 'items') {
      const rows = Object.entries(pr.items).filter(([, n]) => n > 0).map(([id, n]) => {
        const it = ITEMS[id];
        return `<tr><td>${esc(it.name)}</td><td>×${n}</td><td><small>${esc(it.desc)}</small></td>
          <td>${it.use ? `<button class="rpg-btn" data-use="${id}">使う${it.key ? `（${it.key}）` : ''}</button>` : ''}</td></tr>`;
      });
      return `<table>${rows.join('') || '<tr><td>何も持っていない</td></tr>'}</table>`;
    }
    return `<table>${questList(st).map((q) => `<tr><td>${esc(q.name)}</td><td><small>${esc(q.desc)}</small></td><td>${q.status}</td></tr>`).join('')}</table>`;
  }

  function render() {
    const el = host.show('rpg-window', `
      <h3>メニュー <span class="rpg-gold">${pr.gold}G</span></h3>
      <div class="rpg-tabs">${TABS.map(([id, label]) => `<button class="rpg-tab ${id === tab ? 'on' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>
      <div class="rpg-body">${body()}</div>
      <div class="rpg-foot"><small>← → でタブ切替／Tab・Esc で閉じる</small><button class="rpg-btn sub" data-close>閉じる</button></div>`, (e) => {
      if (e.code === 'Tab' || e.code === 'Escape') { e.preventDefault(); host.close(); }
      else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        const i = TABS.findIndex(([id]) => id === tab);
        tab = TABS[(i + (e.code === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
        game.sound.se('menu');
        render();
      }
    });
    el.addEventListener('click', (ev) => {
      const t = ev.target.closest('button');
      if (!t) return;
      if (t.dataset.close !== undefined) host.close();
      else if (t.dataset.tab) { tab = t.dataset.tab; game.sound.se('menu'); render(); }
      else if (t.dataset.equip) {
        const [kind, id] = t.dataset.equip.split(':');
        if (kind === 'weapon') pr.weapon = id;
        else pr.armor = id;
        game.onEquipChanged();
        game.sound.se('buy');
        render();
      } else if (t.dataset.use) {
        game.useItem(t.dataset.use);
        render();
      }
    });
  }
  render();
}
