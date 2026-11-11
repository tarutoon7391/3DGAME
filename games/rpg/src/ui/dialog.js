// 会話ウィンドウ（看板の文。自前の DOM モーダル）。開いている間はゲームが止まる
import { esc } from '../util.js';

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

/** 「次へ／閉じる」の案内。スマホはタップ、PC はキーとクリック */
function touchHint(what) {
  return document.body.classList.contains('rpg-touch-on') ? `▼ タップで${what}` : `▼ F / Space / クリックで${what}`;
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
        <div class="rpg-talk-next">${touchHint(i < lines.length - 1 ? '次へ' : '閉じる')}</div>`, (e) => {
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

  return { talk };
}
