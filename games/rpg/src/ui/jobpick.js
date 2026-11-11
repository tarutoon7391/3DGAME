// 職業の選び直し（全滅したとき）。準備画面と同じ16職ずつのタブ（ui/jobgrid.js）で選ぶ
// seconds を渡すと残り時間を出し、時間切れで閉じる（協力プレイ：ホストの再開に合わせる）
import { JOBS } from '../data/jobs.js';
import { jobGridHtml, tabOf } from './jobgrid.js';
import { esc } from '../util.js';

/**
 * @param {object} o { current, title, seconds, onPick(job), onClose() }
 * @returns {{ close(): void }}
 */
export function openJobPicker({ current, title = '職業を選び直す', seconds = 0, onPick, onClose }) {
  let picked = current;
  let tab = tabOf(current);
  let left = seconds;
  let closed = false;
  const el = document.createElement('div');
  el.className = 'rpg-lobby rpg-jobpick';
  document.body.appendChild(el);

  function render() {
    const panel = el.querySelector('.rpg-lobby-panel');
    const keep = panel ? panel.scrollTop : 0;
    el.innerHTML = `<div class="rpg-lobby-panel">
      <h2>${esc(title)}</h2>
      <p class="rpg-small">いまの職業：<b style="color:${JOBS[picked].color}">${esc(JOBS[picked].name)}</b>
      ${seconds ? `　あと <b class="rpg-pick-left">${Math.ceil(left)}</b> 秒でやり直し（選ばなければ今の職業のまま）` : ''}</p>
      ${jobGridHtml(picked, tab)}
      ${seconds ? '' : '<div class="rpg-lobby-btns"><button type="button" class="g3-btn" data-act="ok">この職業でやり直す</button><button type="button" class="g3-btn sub" data-act="cancel">やめる</button></div>'}
    </div>`;
    el.querySelector('.rpg-lobby-panel').scrollTop = keep;
  }

  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) {
      tab = Number(t.dataset.tab);
      render();
      return;
    }
    const card = e.target.closest('[data-job]');
    if (card) {
      picked = card.dataset.job;
      onPick?.(picked, false);
      render();
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'ok') {
      onPick?.(picked, true); // 先に決定を伝える（閉じたときの「やめた」扱いにならないように）
      close();
    } else if (act === 'cancel') close();
  });

  let timer = null;
  if (seconds) {
    timer = setInterval(() => {
      left -= 0.25;
      const t = el.querySelector('.rpg-pick-left');
      if (t) t.textContent = String(Math.max(0, Math.ceil(left)));
      if (left <= 0) close();
    }, 250);
  }

  function close() {
    if (closed) return;
    closed = true;
    if (timer) clearInterval(timer);
    el.remove();
    onClose?.();
  }

  render();
  return { close };
}
