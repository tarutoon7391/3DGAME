// 競技選択メニュー・難易度選択（shared/ui.js のスタイル g3-* を流用した独自オーバーレイ）
import { initUI } from '/shared/ui.js';
import { SPORTS } from './records.js';
import { DIFFICULTIES, DIFF_KEYS } from './difficulty.js';

const STYLE = `
.sp-menu .g3-panel{max-width:min(640px,94vw)}
.sp-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:0 0 16px}
.sp-card{font:inherit;text-align:left;padding:14px 16px;border-radius:10px;border:1px solid #30363d;background:#0d1117;color:#f0f4f8;cursor:pointer}
.sp-card:hover,.sp-card:focus{border-color:#58a6ff;outline:none;filter:brightness(1.15)}
.sp-card b{display:block;font-size:1.25rem;margin-bottom:4px}
.sp-card span{display:block;font-size:.82rem;color:#9fb1c2;line-height:1.45}
.sp-card em{display:block;font-style:normal;font-size:.8rem;color:#ffd166;margin-top:6px}
.sp-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:0 0 14px}
.sp-row .g3-btn.on{background:#1f6feb;border-color:#58a6ff;color:#fff}
.sp-label{font-size:.85rem;color:#9fb1c2;margin:0 0 6px}
`;

const SPORT_DESC = {
  tennis: '後方視点。WASD 移動・Space ショット・Shift ロブ。3ゲーム先取',
  baseball: '打撃と投球の対決。マウスでバット／コースを選ぶ。3イニング制',
  archery: '一人称。長押しで引き絞り、風と重力を読んで射る。5射×3ラウンド',
};

let el = null;
let styled = false;

function ensureStyle() {
  initUI();
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = STYLE;
  document.head.appendChild(s);
}

function open(html) {
  ensureStyle();
  closeMenu();
  el = document.createElement('div');
  el.className = 'g3-overlay sp-menu';
  el.innerHTML = `<div class="g3-panel">${html}</div>`;
  document.body.appendChild(el);
  return el;
}

function btn(label, onClick, cls = 'g3-btn') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.innerHTML = label;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

export function closeMenu() {
  if (el) el.remove();
  el = null;
}

export function isMenuOpen() {
  return !!el;
}

/** 競技選択。records は createRecords() の戻り値 */
export function showSportMenu({ records, onPick }) {
  const root = open('<h2>競技をえらぶ</h2><div class="sp-cards"></div><p class="sp-label">M：ミュート切替　Esc：試合中ポーズ</p>');
  const cards = root.querySelector('.sp-cards');
  for (const key of Object.keys(SPORTS)) {
    const c = btn(
      `<b>${SPORTS[key].label}</b><span>${SPORT_DESC[key]}</span><em>${records.summary(key)}</em>`,
      () => onPick(key),
      'sp-card',
    );
    cards.appendChild(c);
  }
  cards.firstChild?.focus();
}

/**
 * 難易度選択（アーチェリーは対戦モードも選ぶ）
 * @param {{sport:string, current:string, onPick:(diff:string, mode:string)=>void, onBack:()=>void}} o
 */
export function showDifficulty({ sport, current, onPick, onBack }) {
  const isArch = sport === 'archery';
  let mode = 'cpu';
  const root = open(
    `<h2>${SPORTS[sport].label}</h2>` +
      (isArch ? '<p class="sp-label">対戦モード</p><div class="sp-row sp-mode"></div>' : '') +
      '<p class="sp-label sp-dlabel">CPU の強さ</p><div class="sp-row sp-diff"></div><div class="g3-btns sp-back"></div>',
  );
  if (isArch) {
    const row = root.querySelector('.sp-mode');
    const dlabel = root.querySelector('.sp-dlabel');
    const mk = (m, label) => {
      const b = btn(label, () => {
        mode = m;
        row.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        dlabel.textContent = m === 'cpu' ? 'CPU の強さ' : '風の強さ（難易度）';
      }, 'g3-btn sub' + (m === mode ? ' on' : ''));
      row.appendChild(b);
    };
    mk('cpu', 'CPU と対戦');
    mk('pvp', '2人で交代プレイ');
  }
  const diffRow = root.querySelector('.sp-diff');
  for (const k of DIFF_KEYS) {
    const b = btn(DIFFICULTIES[k].label, () => onPick(k, mode), k === current ? 'g3-btn' : 'g3-btn sub');
    diffRow.appendChild(b);
    if (k === current) setTimeout(() => b.focus(), 0);
  }
  root.querySelector('.sp-back').appendChild(btn('← 競技選択へ', onBack, 'g3-btn sub'));
}
