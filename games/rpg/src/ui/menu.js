// タイトル → ステージ選択 の2画面（この先の職業選択は ui/lobby.js）
// 見た目は草原とダンジョンのレンガを組み合わせたレトロ調。文字の大きな所はドット文字（ui/pixelart.js）
// PC とスマホ（横持ち）で配置を変える。スタイルは src/ui/menu.css
import { pixelText, installTextures } from './pixelart.js';
import { esc } from '../util.js';

/** ステージごとの色（カードの帯） */
const THEME = {
  cave: { band: '#3f7d2a', icon: '🌲' },
  castle: { band: '#5b3a8a', icon: '🏰' },
  abyss: { band: '#24406e', icon: '🌀' },
  wilds: { band: '#b0662a', icon: '🐉' },
  dusk: { band: '#a8402f', icon: '🌅' },
  frost: { band: '#3a7fa6', icon: '❄️' },
};

let current = null;

/** いま出ているメニュー画面を閉じる */
export function closeMenu() {
  current?.remove();
  current = null;
  document.body.classList.remove('rpg-menu-on');
}

function open(cls, html) {
  closeMenu();
  installTextures();
  const el = document.createElement('div');
  el.className = `rpg-scr ${cls}`;
  el.innerHTML = html;
  document.body.appendChild(el);
  document.body.classList.add('rpg-menu-on');
  current = el;
  return el;
}

/** data-px="文字" の所にドット文字を入れる（data-px-size：元の大きさ, data-px-scale：拡大率, data-px-tone：色） */
export function fillPixelText(root) {
  const small = window.innerHeight < 520;
  const TONES = {
    gold: { top: '#fff6cf', bottom: '#ffbf2e', edge: '#3a1d0c' },
    cream: { top: '#ffffff', bottom: '#f3e3b5', edge: '#2c1a0e' },
    dark: { top: '#5a3418', bottom: '#3b2412', edge: '#f7ebc6', shadow: null },
  };
  for (const n of root.querySelectorAll('[data-px]')) {
    const px = Number(n.dataset.pxSize || 12);
    const sc = Number((small && n.dataset.pxScaleSm) || n.dataset.pxScale || 2);
    n.replaceChildren(pixelText(n.dataset.px, { px, scale: sc, ...(TONES[n.dataset.pxTone] || TONES.gold) }));
  }
}

/** 見出しの帯（左に戻るボタン、真ん中にドット文字の見出し） */
export function headerHtml(title, backLabel) {
  return `<header class="rpg-hdr">
    <button type="button" class="rpg-b rpg-b-back" data-act="back">◀ ${esc(backLabel)}</button>
    <h2 data-px="${esc(title)}" data-px-size="16" data-px-scale="2"></h2>
    <span class="rpg-hdr-pad"></span>
  </header>`;
}

/**
 * タイトル画面
 * @param {object} o { subtitle, onPlay(), onContinue?(), continueLabel, controls（操作説明の文） }
 */
export function openTitleMenu({ subtitle, onPlay, onContinue, continueLabel, controls }) {
  const el = open('rpg-title', `
    <div class="rpg-sky"><i class="c1"></i><i class="c2"></i><i class="c3"></i></div>
    <div class="rpg-hills"></div>
    <div class="rpg-ground"></div>
    <div class="rpg-title-body">
      <div class="rpg-logo">
        <div class="rpg-logo-sub" data-px="3D  RPG" data-px-size="10" data-px-scale="3" data-px-scale-sm="2" data-px-tone="cream"></div>
        <div class="rpg-logo-main" data-px="${esc(subtitle)}" data-px-size="20" data-px-scale="4" data-px-scale-sm="2"></div>
        <div class="rpg-logo-tag">育成も収集もない、ボス討伐アクション</div>
      </div>
      <nav class="rpg-title-menu">
        ${onContinue ? `<button type="button" class="rpg-b rpg-b-main" data-act="cont"><span data-px="つづきから" data-px-size="12" data-px-tone="cream"></span><small>${esc(continueLabel)}</small></button>` : ''}
        <button type="button" class="rpg-b ${onContinue ? 'rpg-b-sub' : 'rpg-b-main'}" data-act="play"><span data-px="ステージをえらぶ" data-px-size="12" data-px-tone="cream"></span></button>
        <button type="button" class="rpg-b rpg-b-sub" data-act="help"><span data-px="あそびかた" data-px-size="12" data-px-tone="cream"></span></button>
        <a class="rpg-b rpg-b-plain" href="/">ハブへ戻る</a>
      </nav>
    </div>
    <div class="rpg-help" hidden>
      <div class="rpg-sheet">
        <h3 data-px="あそびかた" data-px-size="12" data-px-tone="dark"></h3>
        <div class="rpg-help-text">${esc(controls)}</div>
        <button type="button" class="rpg-b rpg-b-main" data-act="close">とじる</button>
      </div>
    </div>`);
  fillPixelText(el);
  const help = el.querySelector('.rpg-help');
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'play') onPlay();
    else if (act === 'cont') { closeMenu(); onContinue(); }
    else if (act === 'help') help.hidden = false;
    else if (act === 'close' || e.target === help) help.hidden = true;
  });
}

/**
 * ステージ選択
 * @param {object} o { courses: [{ key, label, name, desc, multi, record }], onPick(course), onBack() }
 *   record：{ clears, best }（best は表示用の文字）
 */
export function openStageSelect({ courses, onPick, onBack }) {
  const cards = courses.map((c, i) => {
    const t = THEME[c.key] || THEME.cave;
    const rec = c.record.clears
      ? `<span class="rpg-rec ok">★ クリア ${c.record.clears}回　ベスト ${esc(c.record.best)}</span>`
      : '<span class="rpg-rec">未クリア</span>';
    return `<button type="button" class="rpg-stage" data-i="${i}" style="--band:${t.band}">
      <span class="rpg-stage-band"><span data-px="${esc(c.label)}" data-px-size="10" data-px-tone="cream"></span><i>${t.icon}</i></span>
      <span class="rpg-stage-name">${esc(c.name)}</span>
      <span class="rpg-stage-desc">${esc(c.desc)}</span>
      <span class="rpg-stage-foot"><span class="rpg-tag ${c.multi ? 'multi' : ''}">${c.multi ? '1〜8人' : 'ひとり'}</span>${rec}</span>
    </button>`;
  }).join('');
  const el = open('rpg-stages', `
    ${headerHtml('ステージをえらぶ', 'タイトル')}
    <main class="rpg-stage-grid">${cards}</main>`);
  fillPixelText(el);
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="back"]')) return onBack();
    const card = e.target.closest('[data-i]');
    if (card) onPick(courses[Number(card.dataset.i)]);
  });
}
