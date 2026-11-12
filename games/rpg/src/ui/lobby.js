// ステージ2・3（レイド）の準備画面：名前・職業を選んで「ひとりで挑む」か、ルームを作る／合言葉で参加する
// ルームの中では参加者・職業・準備完了の一覧を見せ、全員が「準備完了」を押すとホストが「出発！」できる
// 職業は16職ずつのタブに分けて（ui/jobgrid.js）、スクロールしなくても全部見えるようにしている
import { createNet } from '/shared/net.js';
import { JOBS, MAX_RAID_PLAYERS, RAID_SCALE } from '../data/jobs.js';
import { jobGridHtml, tabOf } from './jobgrid.js';
import { esc } from '../util.js';

const MAX_PLAYERS = MAX_RAID_PLAYERS;

/**
 * @param {object} o
 *   settings: セーブの settings（name・job を読み書き）, save(): 設定を保存
 *   onSolo({job,name}), onStart({net, roster, step, area}), onBack()
 *   area: 挑むエリア（castle / abyss）。headingOf(area)：そのエリアの見出し
 *   ルームは作った人（ホスト）のステージのもの。別のステージの準備画面から合言葉で入ると、ホストのステージに切り替わる
 */
export function openLobby({ settings, save, onSolo, onStart, onBack, area = 'castle', heading = 'ステージ2　冥王の城', headingOf = null }) {
  let job = JOBS[settings.job] ? settings.job : 'swordsman';
  let tab = tabOf(job);
  let name = settings.name || `ぼうけんしゃ${Math.floor(Math.random() * 900 + 100)}`;
  let ready = false;
  let net = null;
  const info = new Map(); // id → { name, job, ready }（ルーム内の職業と準備完了）
  const offs = [];
  let closed = false;
  let msg = '';

  const el = document.createElement('div');
  el.className = 'rpg-lobby';
  document.body.appendChild(el);

  const allReady = () => !!net?.room && net.players.every((p) => info.get(p.id)?.ready);
  // 自分の職業・準備完了を配る。ホストはルームのステージ（area）も一緒に配る
  const announce = () => {
    info.set(net.myId, { name, job, ready });
    net.send('lobby', { name, job, ready, area: net.isHost ? area : undefined });
  };
  /** ホストのステージに合わせる（ステージ2 の画面からステージ3 のルームに入った、など） */
  function matchHostArea(hostArea) {
    if (!hostArea || hostArea === area) return;
    area = hostArea;
    heading = headingOf?.(area) || heading;
    msg = `このルームは「${heading}」です。ステージをホストに合わせました`;
  }

  function render() {
    if (closed) return;
    const inRoom = net?.room;
    let top;
    let btns;
    if (!inRoom) {
      top = `<div class="rpg-lobby-row"><label>名前 <input class="rpg-name" maxlength="12" value="${esc(name)}"></label></div>`;
      btns = `
        <button type="button" class="g3-btn" data-act="solo">ひとりで挑む</button>
        <button type="button" class="g3-btn" data-act="create">ルームを作る（最大${MAX_PLAYERS}人）</button>
        <span class="rpg-join"><input class="rpg-code" maxlength="12" placeholder="合言葉"><button type="button" class="g3-btn sub" data-act="join">参加する</button></span>
        <button type="button" class="g3-btn sub" data-act="back">タイトルへ戻る</button>`;
    } else {
      // 参加者は小さな札で横に並べる（8人でも高さを取らない）。準備完了の人には緑のチェック
      const members = net.players.map((p) => {
        const i = info.get(p.id) || {};
        const J = JOBS[i.job] || null;
        return `<span class="rpg-mem ${i.ready ? 'ready' : ''}">${p.id === net.room.hostId ? '👑' : ''}<b>${esc(i.name || p.name)}</b>${p.id === net.myId ? '（あなた）' : ''}
          <span style="color:${J?.color || '#9fb1c2'}">${J ? esc(J.name) : '選択中…'}</span>${i.ready ? '<i class="rpg-check">✔</i>' : ''}</span>`;
      }).join('');
      const nReady = net.players.filter((p) => info.get(p.id)?.ready).length;
      top = `<div class="rpg-room">
          <div>合言葉 <b class="rpg-room-code">${esc(net.room.code)}</b>　<span class="rpg-small">${net.players.length}/${MAX_PLAYERS} 人・ボス HP ×${RAID_SCALE(net.players.length).toFixed(2)}　準備完了 ${nReady}/${net.players.length}</span></div>
          <div class="rpg-members">${members}</div>
        </div>`;
      btns = `
        <button type="button" class="g3-btn ${ready ? 'sub' : ''}" data-act="ready">${ready ? '準備完了を取り消す' : '準備完了'}</button>
        ${net.isHost
          ? `<button type="button" class="g3-btn" data-act="go" ${allReady() ? '' : 'disabled'}>${allReady() ? '出発！' : '全員の準備完了を待っています'}</button>`
          : `<span class="rpg-small">${allReady() ? 'ホストの「出発！」を待っています…' : '全員が準備完了するとホストが出発できます'}</span>`}
        <button type="button" class="g3-btn sub" data-act="leave">ルームを出る</button>`;
    }
    el.innerHTML = `<div class="rpg-lobby-panel">
      <h2>${esc(heading)}　―　レイド（1〜${MAX_PLAYERS}人）</h2>
      <p class="rpg-small">${document.body.classList.contains('rpg-touch-on') ? '攻撃ボタン' : '左クリック'}：通常攻撃（長押しで連続）　Q・E・C：スキル　R：必殺技（攻撃を当てて溜める。近接ほど早く溜まる）。ボスは近接で殴るとブレイク（気絶）する。倒れた味方はそばに立つと蘇生。</p>
      ${msg ? `<p class="rpg-lobby-msg">${esc(msg)}</p>` : ''}
      ${top}
      ${jobGridHtml(job, tab)}
      <div class="rpg-lobby-btns">${btns}</div>
    </div>`;
  }

  el.addEventListener('input', (e) => {
    if (e.target.classList.contains('rpg-name')) {
      name = e.target.value.trim().slice(0, 12) || name;
      settings.name = name;
      save();
    }
  });
  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) {
      tab = Number(t.dataset.tab);
      render();
      return;
    }
    const card = e.target.closest('[data-job]');
    if (card) {
      job = card.dataset.job;
      settings.job = job;
      save();
      if (net?.room) announce();
      render();
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    try {
      if (act === 'solo') {
        close();
        onSolo({ job, name });
      } else if (act === 'back') {
        close();
        onBack();
      } else if (act === 'create' || act === 'join') {
        const code = el.querySelector('.rpg-code')?.value.trim();
        if (act === 'join' && !code) {
          msg = '合言葉を入れてください';
          render();
          return;
        }
        msg = act === 'create' ? 'ルームを作っています…' : '参加しています…';
        render();
        net = createNet('rpg', { name });
        listen();
        if (act === 'create') await net.createRoom({ maxPlayers: MAX_PLAYERS });
        else await net.joinRoom(code);
        ready = false;
        msg = '';
        announce();
        render();
      } else if (act === 'ready') {
        ready = !ready;
        announce();
        render();
      } else if (act === 'leave') {
        leave();
        msg = 'ルームを出ました';
        render();
      } else if (act === 'go') {
        if (!net?.isHost || !allReady()) return;
        const roster = net.players.map((p) => ({ id: p.id, name: info.get(p.id)?.name || p.name, job: info.get(p.id)?.job || 'swordsman' }));
        net.send('start', { roster, step: 0, area });
        startWith({ roster, step: 0, area });
      }
    } catch (err) {
      leave();
      msg = `うまくいきませんでした：${err.message}`;
      render();
    }
  });

  function listen() {
    offs.push(net.onMessage('lobby', (d, from) => {
      info.set(from, d);
      if (from === net.room?.hostId) matchHostArea(d.area);
      render();
    }));
    offs.push(net.onRoomChange(() => render()));
    offs.push(net.onPlayerJoin(() => {
      // 新しく来た人に自分の職業と準備完了（ホストはステージも）を教える
      net.send('lobby', { name, job, ready, area: net.isHost ? area : undefined });
    }));
    offs.push(net.onMessage('start', (d) => startWith(d)));
    offs.push(net.onDisconnect(() => {
      if (closed) return;
      net = null;
      msg = '接続が切れました';
      render();
    }));
  }

  function startWith(d) {
    if (closed) return;
    const n = net;
    close(false);
    onStart({ net: n, roster: d.roster, step: d.step || 0, area: d.area || area });
  }

  function leave() {
    offs.forEach((f) => f());
    offs.length = 0;
    info.clear();
    ready = false;
    net?.leaveRoom();
    net = null;
  }

  function close(leaveRoom = true) {
    if (closed) return;
    closed = true;
    offs.forEach((f) => f());
    offs.length = 0;
    if (leaveRoom && net) net.leaveRoom();
    el.remove();
  }

  render();
  return { close };
}
