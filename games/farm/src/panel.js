// 農場ゲーム専用の DOM UI：メニューパネル（店・出荷・依頼・持ち物）、道具バー、操作ヒント
const STYLE = `
.fm-panel-wrap{position:fixed;inset:0;z-index:15;display:flex;align-items:center;justify-content:center;background:#0006;font-family:system-ui,"Segoe UI","Hiragino Sans","Yu Gothic UI",sans-serif}
.fm-panel{width:min(620px,94vw);max-height:84vh;display:flex;flex-direction:column;background:#fdf6e3;color:#3e2b1c;border:3px solid #8d6e63;border-radius:14px;box-shadow:0 10px 40px #0008}
.fm-head{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#8d6e63;color:#fff;border-radius:10px 10px 0 0}
.fm-head h3{margin:0;font-size:1.15rem}
.fm-head small{opacity:.85}
.fm-body{overflow:auto;padding:10px 14px}
.fm-row{display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px dashed #d7c4a8}
.fm-row:last-child{border-bottom:0}
.fm-ico{font-size:1.5rem;width:2rem;text-align:center}
.fm-main{flex:1;min-width:0}
.fm-main b{display:block}
.fm-main span{font-size:.85rem;color:#7b5e45}
.fm-row.locked{opacity:.45}
.fm-btn{font:inherit;font-size:.9rem;padding:5px 12px;border-radius:7px;border:1px solid #6d4c41;background:#a1887f;color:#fff;cursor:pointer;white-space:nowrap}
.fm-btn:hover:not(:disabled){filter:brightness(1.12)}
.fm-btn:disabled{opacity:.4;cursor:default}
.fm-btn.go{background:#43a047;border-color:#2e7d32}
.fm-note{font-size:.88rem;color:#7b5e45;margin:4px 0 8px}
.fm-tabs{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.fm-tab{font:inherit;font-size:.85rem;padding:4px 10px;border-radius:14px;border:1px solid #a1887f;background:#fff;color:#5d4037;cursor:pointer}
.fm-tab.on{background:#8d6e63;color:#fff}
.fm-bar{position:fixed;left:12px;bottom:12px;z-index:12;display:flex;gap:6px;pointer-events:none;font-family:system-ui,sans-serif}
.fm-slot{width:62px;height:62px;border-radius:10px;background:#000a;border:2px solid #fff3;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;position:relative;text-align:center;line-height:1.15}
.fm-slot .k{position:absolute;left:4px;top:2px;font-size:10px;opacity:.7}
.fm-slot .i{font-size:22px}
.fm-slot.on{border-color:#ffd54f;background:#5d4037d0;transform:translateY(-4px)}
.fm-hint{position:fixed;right:12px;bottom:12px;z-index:12;pointer-events:none;font:14px system-ui,sans-serif;color:#fff;background:#000a;padding:8px 12px;border-radius:8px;white-space:pre-line;text-align:right}
.fm-hint:empty{display:none}
.fm-stam{display:inline-block;width:110px;height:10px;background:#0008;border-radius:5px;vertical-align:middle;overflow:hidden;border:1px solid #fff5}
.fm-stam i{display:block;height:100%}
.fm-q{font-size:13px;opacity:.95}
`;

let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = STYLE;
  document.head.appendChild(s);
}

/**
 * パネルを1つだけ開く。render() が返す HTML の data-act / data-arg を持つ要素がクリックされると onAct(act, arg) が呼ばれ、再描画される
 */
export function createPanels() {
  ensureStyle();
  let wrap = null;
  let cur = null;

  function draw() {
    if (!wrap || !cur) return;
    const { title, sub } = cur.head();
    wrap.innerHTML = `<div class="fm-panel"><div class="fm-head"><h3>${title}</h3><small>${sub ?? ''}</small><button class="fm-btn" data-act="close">閉じる [Esc]</button></div><div class="fm-body">${cur.render()}</div></div>`;
  }

  return {
    open(spec) {
      this.close();
      cur = spec;
      wrap = document.createElement('div');
      wrap.className = 'fm-panel-wrap';
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) { this.close(); return; }
        const el = e.target.closest('[data-act]');
        if (!el || el.disabled) return;
        const act = el.dataset.act;
        if (act === 'close') { this.close(); return; }
        cur.onAct(act, el.dataset.arg);
        if (cur) draw();
      });
      document.body.appendChild(wrap);
      draw();
    },
    close() {
      if (wrap) wrap.remove();
      const was = cur;
      wrap = null;
      cur = null;
      was?.onClose?.();
    },
    isOpen: () => !!cur,
    refresh: draw,
  };
}

/** 道具バー（左下） */
export function createHotbar() {
  ensureStyle();
  const el = document.createElement('div');
  el.className = 'fm-bar';
  document.body.appendChild(el);
  let last = '';
  return {
    set(html) {
      if (html === last) return;
      last = html;
      el.innerHTML = html;
    },
    show(v) { el.style.display = v ? 'flex' : 'none'; },
  };
}

/** 操作ヒント（右下） */
export function createHint() {
  ensureStyle();
  const el = document.createElement('div');
  el.className = 'fm-hint';
  document.body.appendChild(el);
  let last = '';
  return {
    set(text) {
      if (text === last) return;
      last = text;
      el.textContent = text;
    },
  };
}

export const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
