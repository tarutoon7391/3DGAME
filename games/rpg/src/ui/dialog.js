// 会話ウィンドウ・選択肢・ショップ（自前の DOM モーダル）。開いている間はゲームが止まる
import { esc } from '../util.js';
import { lookup, sellPrice, SHOP_STOCK, WEAPONS, ARMORS, ITEMS } from '../data/items.js';

/** モーダルの土台：開閉とキー入力の付け外し */
export function createModalHost(game) {
  let el = null;
  let keyFn = null;
  const host = {
    get open() { return !!el; },
    show(className, html, onKey) {
      host.close(true);
      el = document.createElement('div');
      el.className = 'rpg-modal ' + className;
      el.innerHTML = html;
      document.body.appendChild(el);
      keyFn = (e) => {
        if (e.repeat) return;
        onKey?.(e);
      };
      window.addEventListener('keydown', keyFn);
      game.onModalOpen();
      return el;
    },
    close(silent = false) {
      if (!el) return;
      el.remove();
      el = null;
      window.removeEventListener('keydown', keyFn);
      keyFn = null;
      if (!silent) game.onModalClose();
    },
    get el() { return el; },
  };
  return host;
}

export function createDialog(game, host) {
  /** 会話：lines を1行ずつ。終わったら after() */
  function talk(name, lines, after) {
    let i = 0;
    const render = () => {
      game.sound.se('talk');
      const el = host.show('rpg-talk', `
        <div class="rpg-talk-name">${esc(name)}</div>
        <div class="rpg-talk-text">${esc(lines[i])}</div>
        <div class="rpg-talk-next">${i < lines.length - 1 ? '▼ F / Space / クリックで次へ' : '▼ F / Space / クリックで閉じる'}</div>`, (e) => {
        if (['KeyF', 'Space', 'Enter'].includes(e.code)) { e.preventDefault(); next(); }
        else if (e.code === 'Escape') { i = lines.length - 1; next(); }
      });
      el.addEventListener('click', next);
    };
    const next = () => {
      if (!host.open) return; // 二重に閉じない
      i++;
      if (i >= lines.length) {
        host.close();
        after?.();
      } else render();
    };
    render();
  }

  /** 選択肢つきの文 */
  function choice(name, text, options) {
    const el = host.show('rpg-talk', `
      <div class="rpg-talk-name">${esc(name)}</div>
      <div class="rpg-talk-text">${esc(text)}</div>
      <div class="rpg-choices"></div>`, (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) pick(options[n - 1]);
      else if (e.code === 'Escape') pick(options[options.length - 1]);
    });
    const box = el.querySelector('.rpg-choices');
    options.forEach((o, k) => {
      const b = document.createElement('button');
      b.className = 'rpg-btn';
      b.textContent = `${k + 1}. ${o.label}`;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); pick(o); });
      box.appendChild(b);
    });
    function pick(o) {
      host.close();
      o.onClick?.();
    }
  }

  /** ショップ（買う・売る） */
  function shop(name) {
    const st = game.state;
    const pr = st.progress;
    const owned = (id) => pr.weapons.includes(id) || pr.armors.includes(id);
    const desc = (id) => {
      const f = lookup(id);
      if (f.kind === 'weapon') return `攻撃 +${f.def.atk}`;
      if (f.kind === 'armor') return `防御 +${f.def.def}`;
      return f.def.desc;
    };
    function sellables() {
      const out = [];
      for (const [id, n] of Object.entries(pr.items)) if (n > 0 && sellPrice(id) > 0) out.push({ id, n, name: ITEMS[id].name });
      for (const id of pr.weapons) if (id !== pr.weapon && sellPrice(id) > 0) out.push({ id, n: 1, name: WEAPONS[id].name });
      for (const id of pr.armors) if (id !== pr.armor && sellPrice(id) > 0) out.push({ id, n: 1, name: ARMORS[id].name });
      return out;
    }
    function render() {
      const buy = SHOP_STOCK.map((id) => {
        const f = lookup(id);
        const have = f.kind === 'item' ? `所持 ${st.count(id)}` : owned(id) ? '所持済み' : '';
        const dis = (f.kind !== 'item' && owned(id)) || pr.gold < f.def.price ? 'disabled' : '';
        return `<tr><td>${esc(f.def.name)}<small>${esc(desc(id))}</small></td><td>${f.def.price}G</td><td><small>${have}</small></td>
          <td><button class="rpg-btn" data-buy="${id}" ${dis}>買う</button></td></tr>`;
      }).join('');
      const sl = sellables();
      const sell = sl.length
        ? sl.map((s) => `<tr><td>${esc(s.name)}<small>×${s.n}</small></td><td>${sellPrice(s.id)}G</td><td></td><td><button class="rpg-btn sub" data-sell="${s.id}">売る</button></td></tr>`).join('')
        : '<tr><td colspan="4"><small>売れる物がない（装備中の物は売れない）</small></td></tr>';
      const el = host.show('rpg-window', `
        <h3>${esc(name)} の店 <span class="rpg-gold">所持金 ${pr.gold}G</span></h3>
        <div class="rpg-cols">
          <div><h4>買う</h4><table>${buy}</table></div>
          <div><h4>売る</h4><table>${sell}</table></div>
        </div>
        <div class="rpg-foot"><small>買った装備は Tab メニューの「装備」で付け替えできます（買うと自動で装備）</small>
        <button class="rpg-btn sub" data-close>閉じる（Esc）</button></div>`, (e) => {
        if (e.code === 'Escape' || e.code === 'KeyF') host.close();
      });
      el.addEventListener('click', (ev) => {
        const t = ev.target.closest('button');
        if (!t) return;
        if (t.dataset.close !== undefined) host.close();
        else if (t.dataset.buy) buyItem(t.dataset.buy);
        else if (t.dataset.sell) sellItem(t.dataset.sell);
      });
    }
    function buyItem(id) {
      const f = lookup(id);
      if (pr.gold < f.def.price) { game.sound.se('error'); return; }
      pr.gold -= f.def.price;
      if (f.kind === 'item') st.addItem(id, 1);
      else if (f.kind === 'weapon') { pr.weapons.push(id); pr.weapon = id; }
      else { pr.armors.push(id); pr.armor = id; }
      game.onEquipChanged();
      game.sound.se('buy');
      render();
    }
    function sellItem(id) {
      const f = lookup(id);
      const price = sellPrice(id);
      if (f.kind === 'item') { if (!st.removeItem(id, 1)) return; }
      else if (f.kind === 'weapon') pr.weapons.splice(pr.weapons.indexOf(id), 1);
      else pr.armors.splice(pr.armors.indexOf(id), 1);
      pr.gold += price;
      game.sound.se('coin');
      render();
    }
    render();
  }

  return { talk, choice, shop };
}
