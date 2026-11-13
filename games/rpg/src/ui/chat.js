// 協力プレイのチャット（ルームの準備画面と、遊んでいる間の両方で使う）
// ・同じルーム（net）の間は同じチャット。発言の記録もそのまま引き継ぐ
// ・準備画面：右の欄に記録・入力欄・定型文を置く（mountLobby）
// ・遊んでいる間：左に最近の発言が出て、しばらくすると薄くなる。PC は Enter、スマホは 💬 で入力（mountGame）
// メッセージは net の 'chat'（{ name, text, color }）。自分の発言は自分の画面にもすぐ出す
import { esc } from '../util.js';

const MAX_LEN = 60; // 1回の発言の長さ
const KEEP = 40; // 覚えておく発言の数
const SHOW_SEC = 10; // 遊んでいる間、発言が見えている秒数
const GAP_MS = 700; // 連投の間隔
export const QUICK = ['よろしく！', 'ありがとう！', 'ナイス！', '回復おねがい', '集まって！', 'ごめん！', '必殺技いくよ', 'おつかれさま'];

const chats = new WeakMap();

/**
 * net ごとのチャットを返す（なければ作る）
 * @param {object} net shared/net.js
 * @param {() => { name: string, color: string }} who 自分の名前と色（職業の色）
 */
export function getChat(net, who) {
  let c = chats.get(net);
  if (c) {
    c.who = who;
    return c;
  }
  c = createChat(net, who);
  chats.set(net, c);
  return c;
}

function createChat(net, who) {
  const log = []; // { name, text, color, at, mine }
  const views = new Set(); // 発言が増えたら描き直す画面
  let last = 0;
  const off = net.onMessage('chat', (d, from) => {
    if (!d || typeof d.text !== 'string') return;
    add({ name: String(d.name || '???').slice(0, 12), text: d.text.slice(0, MAX_LEN), color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#cfd8dc', mine: from === net.myId });
  });
  function add(m) {
    log.push({ ...m, at: performance.now() });
    while (log.length > KEEP) log.shift();
    for (const v of views) v();
  }
  const c = {
    who,
    log,
    /** 発言する（空・連投は無視）。送れたら true */
    send(text) {
      text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
      if (!text || !net.room) return false;
      const now = performance.now();
      if (now - last < GAP_MS) return false;
      last = now;
      const me = c.who();
      const msg = { name: me.name, text, color: me.color };
      net.send('chat', msg);
      add({ ...msg, mine: true });
      return true;
    },
    watch(fn) {
      views.add(fn);
      return () => views.delete(fn);
    },
    dispose() {
      off?.();
      views.clear();
      chats.delete(net);
    },
  };
  return c;
}

const line = (m) => `<div class="rpg-chat-line${m.mine ? ' mine' : ''}"><b style="color:${m.color}">${esc(m.name)}</b>${esc(m.text)}</div>`;

/** 定型文のボタン */
const quickHtml = () => `<div class="rpg-chat-quick">${QUICK.map((q) => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;

/**
 * 準備画面のチャット欄。描き直しで消えないよう、要素は1つだけ作って slot に入れ直す
 * @returns { el, attach(slot), destroy() }
 */
export function mountLobby(chat) {
  const el = document.createElement('div');
  el.className = 'rpg-chat-lobby rpg-sheet';
  el.innerHTML = `<div class="rpg-chat-head">チャット</div>
    <div class="rpg-chat-log"></div>
    <form class="rpg-chat-form"><input class="rpg-chat-in" maxlength="${MAX_LEN}" placeholder="メッセージ（Enter で送信）" enterkeyhint="send"><button type="submit" class="rpg-b rpg-b-sub">送信</button></form>
    ${quickHtml()}`;
  const logEl = el.querySelector('.rpg-chat-log');
  const input = el.querySelector('.rpg-chat-in');
  const draw = () => {
    logEl.innerHTML = chat.log.length ? chat.log.map(line).join('') : '<div class="rpg-chat-empty">まだ発言はありません</div>';
    logEl.scrollTop = logEl.scrollHeight;
  };
  const unwatch = chat.watch(draw);
  draw();
  el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (chat.send(input.value)) input.value = '';
  });
  el.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]');
    if (q) chat.send(q.dataset.q);
  });
  return {
    el,
    attach(slot) {
      if (!slot) return;
      const focused = document.activeElement === input;
      slot.replaceWith(el);
      draw();
      if (focused) input.focus();
    },
    destroy() {
      unwatch();
      el.remove();
    },
  };
}

/**
 * 遊んでいる間のチャット
 * @param {object} o { touch：スマホか, onOpen()：入力を始めた（ポインタロックを外す）, onClose()：入力をやめた }
 * @returns { open(), isOpen(), update(), destroy() }
 */
export function mountGame(chat, { touch, onOpen, onClose }) {
  const root = document.createElement('div');
  root.className = 'rpg-chat-game';
  root.innerHTML = `<div class="rpg-chat-log"></div>
    <form class="rpg-chat-bar" hidden>${quickHtml()}<div class="rpg-chat-row"><input class="rpg-chat-in" maxlength="${MAX_LEN}" placeholder="メッセージ（Enter で送信・Esc でやめる）" enterkeyhint="send"><button type="submit">送信</button>${touch ? '<button type="button" class="rpg-chat-x" data-x>✕</button>' : ''}</div></form>
    ${touch ? '' : '<div class="rpg-chat-hint">Enter：チャット</div>'}`;
  document.body.appendChild(root);
  // スマホの 💬（root は位置をずらしているので、ボタンは body に直接置く）
  const btn = touch ? document.createElement('button') : null;
  if (btn) {
    btn.type = 'button';
    btn.className = 'rpg-chat-btn';
    btn.setAttribute('aria-label', 'チャット');
    btn.textContent = '💬';
    btn.addEventListener('click', () => (opened ? close() : open()));
    document.body.appendChild(btn);
  }
  const logEl = root.querySelector('.rpg-chat-log');
  const bar = root.querySelector('.rpg-chat-bar');
  const input = root.querySelector('.rpg-chat-in');
  let opened = false;
  const draw = () => {
    const now = performance.now();
    // 入力中は最近の8件を全部、そうでなければ新しい発言だけ
    const list = opened ? chat.log.slice(-8) : chat.log.filter((m) => now - m.at < SHOW_SEC * 1000).slice(-5);
    logEl.innerHTML = list.map((m) => line(m).replace('class="rpg-chat-line', `style="opacity:${opened ? 1 : Math.min(1, (SHOW_SEC * 1000 - (now - m.at)) / 1500).toFixed(2)}" class="rpg-chat-line`)).join('');
  };
  const unwatch = chat.watch(draw);
  function open() {
    if (opened) return;
    opened = true;
    bar.hidden = false;
    root.classList.add('open');
    if (btn) btn.hidden = true;
    onOpen?.();
    draw();
    setTimeout(() => input.focus(), 0);
  }
  function close() {
    if (!opened) return;
    opened = false;
    bar.hidden = true;
    root.classList.remove('open');
    if (btn) btn.hidden = false;
    input.value = '';
    input.blur();
    draw();
    onClose?.();
  }
  bar.addEventListener('submit', (e) => {
    e.preventDefault();
    chat.send(input.value);
    close();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  root.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]');
    if (q) { chat.send(q.dataset.q); close(); }
    else if (e.target.closest('[data-x]')) close();
  });
  let tick = 0;
  return {
    open,
    close,
    isOpen: () => opened,
    /** 毎フレーム：古い発言を薄くする（0.25秒ごとに描き直す） */
    update(dt) {
      tick += dt;
      if (tick < 0.25) return;
      tick = 0;
      if (!opened) draw();
    },
    destroy() {
      unwatch();
      root.remove();
      btn?.remove();
    },
  };
}
