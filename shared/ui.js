// 共通UI：タイトル・HUD・ポーズ・リザルト・トースト・ハブへ戻る（凍結対象の契約）
// DOM オーバーレイで実装。スタイルは初回 import 時に1回だけ注入する。

const STYLE = `
.g3-layer{position:fixed;inset:0;pointer-events:none;z-index:10;font-family:system-ui,"Segoe UI","Hiragino Sans","Yu Gothic UI",sans-serif;color:#f0f4f8}
.g3-hud{position:fixed;left:12px;top:12px;z-index:11;pointer-events:none;font-size:15px;line-height:1.5;text-shadow:0 1px 3px #000c}
.g3-overlay{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:#05080dcc;pointer-events:auto}
.g3-panel{max-width:min(560px,92vw);padding:28px 32px;background:#161b22f2;border:1px solid #30363d;border-radius:14px;text-align:center;box-shadow:0 10px 40px #0008}
.g3-panel h1{margin:0 0 12px;font-size:2rem}
.g3-panel h2{margin:0 0 12px;font-size:1.6rem}
.g3-panel p{margin:0 0 12px;color:#c9d1d9;line-height:1.6}
.g3-controls{white-space:pre-line;text-align:left;font-size:.92rem;color:#9fb1c2;background:#0d1117;border-radius:8px;padding:10px 14px;margin:0 0 16px}
.g3-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.g3-btn{font:inherit;font-size:1rem;padding:10px 22px;border-radius:8px;border:1px solid #58a6ff;background:#1f6feb;color:#fff;cursor:pointer}
.g3-btn.sub{background:transparent;color:#c9d1d9;border-color:#30363d}
.g3-btn:hover{filter:brightness(1.15)}
.g3-home{position:fixed;right:12px;top:12px;z-index:30;pointer-events:auto;font:13px system-ui,sans-serif;padding:6px 12px;border-radius:6px;border:1px solid #30363d;background:#0d1117cc;color:#c9d1d9;text-decoration:none}
.g3-home:hover{border-color:#58a6ff;color:#fff}
.g3-toasts{position:fixed;left:50%;bottom:48px;transform:translateX(-50%);z-index:25;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
.g3-toast{padding:8px 16px;border-radius:8px;background:#000b;color:#fff;font-size:15px;transition:opacity .3s}
`;

let root = null;
let hudEl = null;
let toastsEl = null;
let overlayEl = null;
let pauseEl = null;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 初回呼び出し時にスタイルと常設要素（ハブへ戻る・HUD・トースト）を作る */
function ensureRoot() {
  if (root) return;
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  root = document.createElement('div');
  root.className = 'g3-layer';
  document.body.appendChild(root);

  hudEl = document.createElement('div');
  hudEl.className = 'g3-hud';
  root.appendChild(hudEl);

  toastsEl = document.createElement('div');
  toastsEl.className = 'g3-toasts';
  root.appendChild(toastsEl);

  const home = document.createElement('a');
  home.className = 'g3-home';
  home.href = '/';
  home.textContent = '← ハブへ戻る';
  document.body.appendChild(home);
}

function button(label, onClick, sub = false) {
  const b = document.createElement('button');
  b.className = 'g3-btn' + (sub ? ' sub' : '');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick?.(e);
  });
  return b;
}

function openOverlay(innerHtml, buttons) {
  ensureRoot();
  closeOverlay();
  overlayEl = document.createElement('div');
  overlayEl.className = 'g3-overlay';
  const panel = document.createElement('div');
  panel.className = 'g3-panel';
  panel.innerHTML = innerHtml;
  const row = document.createElement('div');
  row.className = 'g3-btns';
  buttons.forEach((b) => row.appendChild(b));
  panel.appendChild(row);
  overlayEl.appendChild(panel);
  document.body.appendChild(overlayEl);
  buttons[0]?.focus();
  return overlayEl;
}

function closeOverlay() {
  if (overlayEl) overlayEl.remove();
  overlayEl = null;
}

/** 常設の「ハブへ戻る」ボタン等を今すぐ出す（どの関数を呼んでも自動で出る） */
export function initUI() {
  ensureRoot();
}

/**
 * タイトル画面（操作説明つき）。
 * @param {{title:string, desc?:string, controls?:string, onStart:Function,
 *          onContinue?:Function, startLabel?:string, continueLabel?:string}} o
 *   onContinue を渡すと「つづきから」ボタンが出る。controls は改行区切りで複数行可
 * @returns {() => void} 閉じる関数
 */
export function showTitle({ title, desc = '', controls = '', onStart, onContinue, startLabel = 'はじめる', continueLabel = 'つづきから' }) {
  const btns = [];
  if (onContinue) btns.push(button(continueLabel, () => { closeOverlay(); onContinue(); }));
  btns.push(button(startLabel, () => { closeOverlay(); onStart?.(); }, !!onContinue));
  openOverlay(
    `<h1>${esc(title)}</h1>` +
      (desc ? `<p>${esc(desc)}</p>` : '') +
      (controls ? `<div class="g3-controls">${esc(controls)}</div>` : ''),
    btns,
  );
  return closeOverlay;
}

/** HUD（左上）の中身を HTML で差し替える。空文字で消える。毎フレーム呼ぶ場合は内容が変わった時だけ呼ぶこと */
let lastHud = null;
export function hud(html) {
  ensureRoot();
  if (html === lastHud) return;
  lastHud = html;
  hudEl.innerHTML = html ?? '';
}

/**
 * ポーズ画面。Esc の検知はゲーム側で行い、これを呼ぶ。
 * @param {{onResume?:Function, onRetry?:Function, extra?:string}} [o]
 * @returns {() => void} 閉じる関数（hidePause と同じ）
 */
export function showPause({ onResume, onRetry, extra = '' } = {}) {
  ensureRoot();
  const btns = [button('つづける', () => { hidePause(); onResume?.(); })];
  if (onRetry) btns.push(button('最初から', () => { hidePause(); onRetry(); }, true));
  btns.push(button('ハブへ戻る', () => { location.href = '/'; }, true));
  pauseEl = openOverlay(`<h2>ポーズ</h2>${extra ? `<p>${esc(extra)}</p>` : '<p>Esc でもつづけられます</p>'}`, btns);
  return hidePause;
}

/** ポーズ画面を閉じる */
export function hidePause() {
  if (pauseEl && pauseEl === overlayEl) closeOverlay();
  pauseEl = null;
}

/** ポーズ画面が出ているか */
export function isPaused() {
  return !!pauseEl && pauseEl === overlayEl;
}

/**
 * リザルト画面。
 * @param {{title:string, lines?:string[], onRetry?:Function, retryLabel?:string, extraButtons?:{label:string,onClick:Function}[]}} o
 * @returns {() => void} 閉じる関数
 */
export function showResult({ title, lines = [], onRetry, retryLabel = 'もう一度', extraButtons = [] }) {
  const btns = [];
  if (onRetry) btns.push(button(retryLabel, () => { closeOverlay(); onRetry(); }));
  extraButtons.forEach((b) => btns.push(button(b.label, () => { closeOverlay(); b.onClick?.(); }, true)));
  btns.push(button('ハブへ戻る', () => { location.href = '/'; }, true));
  openOverlay(`<h2>${esc(title)}</h2>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}`, btns);
  return closeOverlay;
}

/** 画面下に短いメッセージを出す */
export function toast(msg, ms = 2000) {
  ensureRoot();
  const t = document.createElement('div');
  t.className = 'g3-toast';
  t.textContent = msg;
  toastsEl.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, ms);
  setTimeout(() => t.remove(), ms + 350);
}

/** タイトル・ポーズ・リザルトのどれかが表示中か */
export function isOverlayOpen() {
  return !!overlayEl;
}

/** 表示中のオーバーレイ（タイトル・ポーズ・リザルト）を閉じる */
export function closeAll() {
  closeOverlay();
  pauseEl = null;
}
