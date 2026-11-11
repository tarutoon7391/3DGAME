// ステージ2（レイド）の準備画面：名前・職業を選んで「ひとりで挑む」か、ルームを作る／合言葉で参加する
// ルームの中では参加者と職業の一覧を見せ、ホストが「出発」を押すと全員一斉に始まる
import { createNet } from '/shared/net.js';
import { JOBS, JOB_ORDER, MAX_RAID_PLAYERS, RAID_SCALE } from '../data/jobs.js';
import { esc } from '../util.js';

const MAX_PLAYERS = MAX_RAID_PLAYERS;

/**
 * @param {object} o
 *   settings: セーブの settings（name・job を読み書き）, save(): 設定を保存
 *   onSolo({job,name}), onStart({net, roster, step, area}), onBack()
 *   area: 挑むエリア（castle / abyss）。参加者はホストの 'start' に入っている area に従う
 */
export function openLobby({ settings, save, onSolo, onStart, onBack, area = 'castle', heading = 'ステージ2　冥王の城' }) {
  let job = JOBS[settings.job] ? settings.job : 'swordsman';
  let name = settings.name || `ぼうけんしゃ${Math.floor(Math.random() * 900 + 100)}`;
  let net = null;
  const info = new Map(); // id → { name, job }（ルーム内の職業）
  const offs = [];
  let closed = false;

  const el = document.createElement('div');
  el.className = 'rpg-lobby';
  document.body.appendChild(el);

  function jobCards() {
    return `<div class="rpg-jobs">${JOB_ORDER.map((id) => {
      const J = JOBS[id];
      return `<button type="button" class="rpg-job ${id === job ? 'sel' : ''}" data-job="${id}" style="--c:${J.color}">
        <b>${esc(J.name)}</b><span class="role">${esc(J.role)}</span>
        <span>HP ${J.stats.hp}・攻 ${J.stats.atk}・${J.basic.type === 'melee' ? '近接' : '飛び道具'}</span>
        <span><em>Q</em>${esc(J.q.name)}：${esc(J.q.desc)}</span>
        <span><em>E</em>${esc(J.e.name)}：${esc(J.e.desc)}</span>
        <span><em>R</em>${esc(J.r.name)}：${esc(J.r.desc)}</span>
        <span class="trait">特性：${esc(J.trait)}</span>
      </button>`;
    }).join('')}</div>`;
  }

  function render(msg = '') {
    if (closed) return;
    const inRoom = net?.room;
    let body;
    if (!inRoom) {
      body = `
        <div class="rpg-lobby-row">
          <label>名前 <input class="rpg-name" maxlength="12" value="${esc(name)}"></label>
        </div>
        ${jobCards()}
        <div class="rpg-lobby-btns">
          <button type="button" class="g3-btn" data-act="solo">ひとりで挑む</button>
          <button type="button" class="g3-btn" data-act="create">ルームを作る（最大${MAX_PLAYERS}人）</button>
          <span class="rpg-join"><input class="rpg-code" maxlength="12" placeholder="合言葉"><button type="button" class="g3-btn sub" data-act="join">参加する</button></span>
          <button type="button" class="g3-btn sub" data-act="back">タイトルへ戻る</button>
        </div>`;
    } else {
      const members = net.players.map((p) => {
        const i = info.get(p.id) || {};
        const J = JOBS[i.job] || null;
        return `<li>${p.id === net.room.hostId ? '👑 ' : ''}<b>${esc(i.name || p.name)}</b>${p.id === net.myId ? '（あなた）' : ''}　<span style="color:${J?.color || '#9fb1c2'}">${J ? esc(J.name) : '職業を選択中…'}</span></li>`;
      }).join('');
      body = `
        <div class="rpg-room">
          <div>合言葉 <b class="rpg-room-code">${esc(net.room.code)}</b>　（友達に伝えて「参加する」から入ってもらう）</div>
          <ul class="rpg-members">${members}</ul>
          <div class="rpg-small">${net.players.length}/${MAX_PLAYERS} 人。人数が多いほどボスの HP が増える（いまの人数で ${RAID_SCALE(net.players.length).toFixed(2)}倍。8人で ${RAID_SCALE(8).toFixed(2)}倍）</div>
        </div>
        ${jobCards()}
        <div class="rpg-lobby-btns">
          ${net.isHost ? '<button type="button" class="g3-btn" data-act="go">出発！</button>' : '<span class="rpg-small">ホストが「出発！」を押すのを待っています…</span>'}
          <button type="button" class="g3-btn sub" data-act="leave">ルームを出る</button>
        </div>`;
    }
    // 描き直してもスクロール位置が先頭に戻らないようにする（職業を選ぶたびに飛ばされないように）
    const oldPanel = el.querySelector('.rpg-lobby-panel');
    const keepPanel = oldPanel ? oldPanel.scrollTop : 0;
    const keepEl = el.scrollTop;
    el.innerHTML = `<div class="rpg-lobby-panel">
      <h2>${esc(heading)}　―　レイド（1〜${MAX_PLAYERS}人）</h2>
      <p class="rpg-small">職業を選んでください。左クリック：通常攻撃　Q・E：スキル　R：必殺技（攻撃を当てて溜める。近接ほど早く溜まる）<br>
      ボスは近接で殴るとブレイク値が溜まり、満タンで気絶（被ダメージ1.5倍）。倒れた味方はそばに立つと蘇生できる。</p>
      ${msg ? `<p class="rpg-lobby-msg">${esc(msg)}</p>` : ''}
      ${body}
    </div>`;
    el.querySelector('.rpg-lobby-panel').scrollTop = keepPanel;
    el.scrollTop = keepEl;
  }

  el.addEventListener('input', (e) => {
    if (e.target.classList.contains('rpg-name')) {
      name = e.target.value.trim().slice(0, 12) || name;
      settings.name = name;
      save();
    }
  });
  el.addEventListener('click', async (e) => {
    const card = e.target.closest('.rpg-job');
    if (card) {
      job = card.dataset.job;
      settings.job = job;
      save();
      if (net?.room) {
        info.set(net.myId, { name, job });
        net.send('lobby', { name, job });
      }
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
          render('合言葉を入れてください');
          return;
        }
        render(act === 'create' ? 'ルームを作っています…' : '参加しています…');
        net = createNet('rpg', { name });
        listen();
        if (act === 'create') await net.createRoom({ maxPlayers: MAX_PLAYERS });
        else await net.joinRoom(code);
        info.set(net.myId, { name, job });
        net.send('lobby', { name, job });
        render();
      } else if (act === 'leave') {
        leave();
        render('ルームを出ました');
      } else if (act === 'go') {
        if (!net?.isHost) return;
        const roster = net.players.map((p) => ({ id: p.id, name: info.get(p.id)?.name || p.name, job: info.get(p.id)?.job || 'swordsman' }));
        net.send('start', { roster, step: 0, area });
        startWith({ roster, step: 0, area });
      }
    } catch (err) {
      leave();
      render(`うまくいきませんでした：${err.message}`);
    }
  });

  function listen() {
    offs.push(net.onMessage('lobby', (d, from) => {
      info.set(from, d);
      render();
    }));
    offs.push(net.onRoomChange(() => render()));
    offs.push(net.onPlayerJoin(() => {
      // 新しく来た人に自分の職業を教える
      net.send('lobby', { name, job });
    }));
    offs.push(net.onMessage('start', (d) => startWith(d)));
    offs.push(net.onDisconnect(() => {
      if (closed) return;
      net = null;
      render('接続が切れました');
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
