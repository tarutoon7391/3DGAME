// 怪盗ナイト独自の画面要素：操作ヒント・警報の赤フラッシュ・ステージ選択画面
import { initUI } from '/shared/ui.js';

const CSS = `
.g3-panel h1,.g3-panel h2{color:#f0f4f8}
.th-hint{position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:12;pointer-events:none;
  padding:6px 14px;border-radius:8px;background:#000a;color:#ffe9a8;font:600 15px system-ui,sans-serif;display:none}
.th-vignette{position:fixed;inset:0;z-index:9;pointer-events:none;opacity:0;box-shadow:inset 0 0 160px 40px #ff1020;transition:opacity .15s}
.th-stages{display:flex;flex-direction:column;gap:10px;margin:0 0 16px;text-align:left}
.th-stage{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;cursor:pointer;font:inherit;text-align:left}
.th-stage:hover,.th-stage:focus{border-color:#d28cff;outline:none}
.th-stage .no{font-size:1.4rem;font-weight:700;color:#d28cff;width:1.6em}
.th-stage .nm{flex:1}
.th-stage .nm small{display:block;color:#8b949e}
.th-stage .rk{font-size:1.6rem;font-weight:800;width:1.4em;text-align:center}
.th-rank-S{color:#ffd54f}.th-rank-A{color:#ff8a65}.th-rank-B{color:#4fc3f7}.th-rank-C{color:#9e9e9e}
.th-bar{display:inline-block;width:110px;height:8px;border-radius:4px;background:#ffffff22;vertical-align:middle;overflow:hidden}
.th-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffe082,#ff3030)}
`;

let hintEl = null;
let vigEl = null;
let menuEl = null;
let vig = 0;

function ensure() {
  if (hintEl) return;
  initUI();
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  hintEl = document.createElement('div');
  hintEl.className = 'th-hint';
  document.body.appendChild(hintEl);
  vigEl = document.createElement('div');
  vigEl.className = 'th-vignette';
  document.body.appendChild(vigEl);
}

let lastHint = null;
/** 画面下の操作ヒント（空文字で消す） */
export function setHint(text) {
  ensure();
  if (text === lastHint) return;
  lastHint = text;
  hintEl.textContent = text;
  hintEl.style.display = text ? 'block' : 'none';
}

/** 警報の赤フラッシュ（秒） */
export function flashAlarm(sec = 2) {
  ensure();
  vig = Math.max(vig, sec);
}
export function updateScreens(dt, time, chasing) {
  ensure();
  vig = Math.max(0, vig - dt);
  const o = vig > 0 ? 0.35 + 0.35 * Math.abs(Math.sin(time * 8)) : chasing ? 0.18 + 0.12 * Math.abs(Math.sin(time * 4)) : 0;
  const s = o.toFixed(2);
  if (vigEl.style.opacity !== s) vigEl.style.opacity = s;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/**
 * ステージ選択画面
 * @param {{stages:object[], best:object, onSelect:(i:number)=>void, onBack?:()=>void}} o
 */
export function showStageSelect({ stages, best, onSelect, onBack }) {
  ensure();
  closeStageSelect();
  menuEl = document.createElement('div');
  menuEl.className = 'g3-overlay';
  const panel = document.createElement('div');
  panel.className = 'g3-panel';
  panel.innerHTML = '<h2>ステージ選択</h2><p>お宝を盗んで出口から脱出せよ</p>';
  const list = document.createElement('div');
  list.className = 'th-stages';
  stages.forEach((st, i) => {
    const b = best[i + 1];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'th-stage';
    btn.innerHTML = `<span class="no">${i + 1}</span><span class="nm">${esc(st.name)}<small>${esc(st.sub || '')}${
      b ? `　ベスト ${fmtTime(b.time)}・発見 ${b.found}・回収 ${b.rate}%` : '　未クリア'
    }</small></span><span class="rk ${b ? 'th-rank-' + b.rank : ''}">${b ? b.rank : '-'}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeStageSelect();
      onSelect(i);
    });
    list.appendChild(btn);
  });
  panel.appendChild(list);
  if (onBack) {
    const row = document.createElement('div');
    row.className = 'g3-btns';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'g3-btn sub';
    back.textContent = 'タイトルへ';
    back.addEventListener('click', (e) => { e.stopPropagation(); closeStageSelect(); onBack(); });
    row.appendChild(back);
    panel.appendChild(row);
  }
  menuEl.appendChild(panel);
  document.body.appendChild(menuEl);
  list.querySelector('button')?.focus();
}

export function closeStageSelect() {
  if (menuEl) menuEl.remove();
  menuEl = null;
}
