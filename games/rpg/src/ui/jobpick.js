// 職業の選び直し（全滅したとき）。準備画面と同じ16職ずつのタブ（ui/jobgrid.js）で選ぶ
// 協力プレイ（ready を渡す）：選んだら「準備OK」。全員そろうとホストが「再開」を押せる。時間制限はない
import { JOBS } from '../data/jobs.js';
import { jobGridHtml, tabOf } from './jobgrid.js';
import { esc } from '../util.js';

/**
 * @param {object} o { current, title, seconds, onPick(job), onClose(), ready }
 *   ready（協力プレイ）：{ isHost(), members() → [{ name, job, ready, me }], onReady(job, ready), onStart() }
 * @returns {{ close(): void, refresh(): void }}
 */
export function openJobPicker({ current, title = '職業を選び直す', seconds = 0, onPick, onClose, ready = null }) {
  let iAmReady = false;
  let picked = current;
  let tab = tabOf(current);
  let left = seconds;
  let closed = false;
  const el = document.createElement('div');
  el.className = 'rpg-lobby rpg-jobpick';
  document.body.appendChild(el);

  /** 協力プレイ：みんなの準備状態（準備OK の人は緑のチェック） */
  function readyHtml() {
    const list = ready.members();
    const n = list.filter((m) => m.ready).length;
    return `<div class="rpg-room"><span class="rpg-small">準備OK ${n}/${list.length}</span>
      <div class="rpg-members">${list.map((m) => `<span class="rpg-mem ${m.ready ? 'ready' : ''}"><b>${esc(m.name || '仲間')}</b>${m.me ? '（あなた）' : ''}
        <span style="color:${JOBS[m.job]?.color || '#9fb1c2'}">${esc(JOBS[m.job]?.name || '')}</span>${m.ready ? '<i class="rpg-check">✔</i>' : ''}</span>`).join('')}</div></div>`;
  }
  function readyBtns() {
    const all = ready.members().every((m) => m.ready);
    return `<div class="rpg-lobby-btns">
      <button type="button" class="g3-btn ${iAmReady ? 'sub' : ''}" data-act="ready">${iAmReady ? '準備OKを取り消す' : '準備OK'}</button>
      ${ready.isHost()
        ? `<button type="button" class="g3-btn" data-act="start" ${all ? '' : 'disabled'}>${all ? '再開！（部屋の前から）' : '全員の準備OKを待っています'}</button>`
        : `<span class="rpg-small">${all ? 'ホストの「再開」を待っています…' : '全員が準備OKするとホストが再開できます'}</span>`}
    </div>`;
  }

  function render() {
    const panel = el.querySelector('.rpg-lobby-panel');
    const keep = panel ? panel.scrollTop : 0;
    el.innerHTML = `<div class="rpg-lobby-panel">
      <h2>${esc(title)}</h2>
      <p class="rpg-small">いまの職業：<b style="color:${JOBS[picked].color}">${esc(JOBS[picked].name)}</b>
      ${seconds ? `　あと <b class="rpg-pick-left">${Math.ceil(left)}</b> 秒でやり直し（選ばなければ今の職業のまま）` : ''}</p>
      ${ready ? readyHtml() : ''}
      ${jobGridHtml(picked, tab)}
      ${ready ? readyBtns() : seconds ? '' : '<div class="rpg-lobby-btns"><button type="button" class="g3-btn" data-act="ok">この職業でやり直す</button><button type="button" class="g3-btn sub" data-act="cancel">やめる</button></div>'}
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
      if (ready) ready.onReady(picked, iAmReady); // 職業を変えたことも伝える
      render();
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (ready && act === 'ready') {
      iAmReady = !iAmReady;
      ready.onReady(picked, iAmReady);
      render();
      return;
    }
    if (ready && act === 'start') {
      if (ready.isHost() && ready.members().every((m) => m.ready)) ready.onStart();
      return;
    }
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
  return { close, refresh: () => { if (!closed) render(); } };
}
