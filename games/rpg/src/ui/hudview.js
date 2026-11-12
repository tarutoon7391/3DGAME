// HUD：HP・スタミナ・目標（左上 = shared の hud()）、
// スキル欄・ミニマップ・ボス HP・調べるの案内・エリア名・暗転（自前 DOM）
import { hud } from '/shared/ui.js';
import { STAMINA } from '../data/player.js';
import { GAUGE } from '../data/jobs.js';
import { nextSeal } from '../area.js';
import { VIEW } from '../data/view.js';
import { esc, angleDiff } from '../util.js';

function el(cls, parent = document.body, tag = 'div') {
  const e = document.createElement(tag);
  e.className = cls;
  parent.appendChild(e);
  return e;
}

export function createHudView(game) {
  const root = el('rpg-hud-root');
  const skills = el('rpg-skills', root);
  const prompt = el('rpg-prompt', root);
  const banner = el('rpg-banner', root);
  // ボスの HP バー（2体同時の部屋のために2本。2本目は1本目の下に出す）
  const bossBars = [0, 1].map((i) => {
    const bar = el('rpg-boss', root);
    bar.innerHTML = `<div class="rpg-boss-name"></div><div class="rpg-boss-track"><div class="rpg-boss-fill"></div></div><div class="rpg-brk" title="ブレイク"><div></div></div>`;
    if (i) bar.style.top = '66px';
    return { bar, fill: bar.querySelector('.rpg-boss-fill'), brk: bar.querySelector('.rpg-brk>div'), name: bar.querySelector('.rpg-boss-name') };
  });
  const party = el('rpg-party', root);
  let lastParty = '';
  const hint = el('rpg-hint', root);
  hint.textContent = 'クリックで視点操作（マウスでカメラ）';
  const fade = el('rpg-fade', document.body);
  // 一人称の見やすさ：照準・被弾の赤い縁・視界外からの攻撃方向・足元の予兆の警告
  const cross = el('rpg-cross', root);
  const vignette = el('rpg-vignette', root);
  const danger = el('rpg-danger', root);
  danger.innerHTML = '<span>⚠ 足元に攻撃の予兆！</span>';
  const markers = [0, 1, 2, 3].map(() => {
    const m = el('rpg-marker', root);
    m.innerHTML = '<i></i>';
    return { el: m, t: 0 };
  });
  let mNext = 0;
  let hurtT = 0;
  let fps = false;
  const mapWrap = el('rpg-map', root);
  const canvas = el('', mapWrap, 'canvas');
  const SIZE = 200;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g2 = canvas.getContext('2d');
  // 壁は動かないので、エリアごとに1回だけ下絵に描いておく
  const base = document.createElement('canvas');
  base.width = SIZE;
  base.height = SIZE;
  const b2 = base.getContext('2d');
  let baseWorld = null;
  root.style.display = 'none';

  let timer = 0;
  let lastSkills = '';
  let lastPrompt = null;
  let bannerT = 0;

  function bar(cur, max, color, w = 180, cls = '') {
    const r = Math.max(0, Math.min(1, cur / max));
    return `<div class="rpg-bar ${cls}" style="width:${w}px"><div style="width:${(r * 100).toFixed(1)}%;background:${color}"></div></div>`;
  }

  function goal() {
    const w = game.world;
    if (!w) return '';
    const list = w.def.bosses;
    if (list) {
      const bs = game.boss;
      if (!bs) return '';
      const tag = list.length > 1 ? `（${bs.idx + 1}/${list.length}）` : '';
      const alive = game.bosses.filter((b) => b.alive);
      if (bs.active) return `${alive.map((b) => b.name).join('・') || bs.name}を倒せ！${tag}`;
      return list.length > 1 ? `奥の部屋へ進め${tag}` : '最深部のボス部屋へ進め';
    }
    const s = nextSeal(game);
    if (!s) return '';
    if (s.done) return '結界はすべて消えた。北の出口へ！';
    return `結界 ${s.opened}/${s.total} 解除　次の結界の番人：あと ${s.left} 体`;
  }

  function drawHud() {
    const me = game.me();
    const tired = me.tired;
    const stColor = tired ? '#ff7043' : me.stamina < me.staminaMax * 0.3 ? '#ffca28' : '#ffee58';
    hud(`<div class="rpg-status">
      <div><b class="rpg-lv">${esc(game.world?.def.name || '')}</b><span class="rpg-area">${esc(me.job.name)}${me.shift ? `（変化師・あと ${Math.ceil(me.shift.t)} 秒で変化）` : ''}</span></div>
      <div class="rpg-row"><span>HP</span>${bar(me.hp, me.maxHp, me.hp / me.maxHp < 0.3 ? '#ff5252' : '#66bb6a')}<span>${Math.ceil(me.hp)}/${me.maxHp}</span></div>
      <div class="rpg-row"><span>ST</span>${bar(me.stamina, me.staminaMax, stColor, 180, tired ? 'tired' : '')}<span class="${tired ? 'rpg-tired' : ''}">${tired ? 'バテ！' : Math.floor(me.stamina)}</span></div>
      <div class="rpg-goal">◆ ${esc(goal())}</div>
    </div>`);

    const J = me.job;
    const full = me.gauge >= GAUGE.max;
    const cdSlot = (key, sk, cd) => `<div class="rpg-skill ${cd > 0 ? 'off' : ''}"><b>${key}</b><span>${esc(sk.name)}</span><small>CD ${sk.cd}秒</small>${cd > 0 ? `<i>${cd.toFixed(1)}</i>` : ''}</div>`;
    const usedR = J.r.oncePerRun && game.state.progress.usedOnce?.[J.r.id];
    const html = `${cdSlot('Q', J.q, me.cd.q)}${cdSlot('E', J.e, me.cd.e)}${J.c ? cdSlot('C', J.c, me.cd.c) : ''}
      ${usedR
        ? `<div class="rpg-skill off"><b>R</b><span>${esc(J.r.name)}</span><small>使用済み</small></div>`
        : `<div class="rpg-skill ${full ? 'ready' : 'off'}"><b>R</b><span>${esc(J.r.name)}</span><small>${full ? '撃てる！' : `${Math.floor(me.gauge)}%`}</small><div class="rpg-gauge" style="width:${Math.min(100, me.gauge)}%"></div></div>`}
      <div class="rpg-skill ${me.dodgeCd > 0 || tired ? 'off' : ''}"><b>Space</b><span>回避</span><small>ST${STAMINA.dodgeCost}</small></div>
      <div class="rpg-skill ${tired ? 'off' : ''} ${me.dashing ? 'on' : ''}"><b>Shift</b><span>ダッシュ</span><small>ST消費</small></div>`;
    if (html !== lastSkills) {
      lastSkills = html;
      skills.innerHTML = html;
    }
    // 協力プレイの仲間（自分以外）
    const others = game.players.filter((p) => p !== me);
    const ph = others.map((p) => `<div><b style="color:${p.job.color}">${esc(p.name || '仲間')}</b> ${esc(p.job.name)}
      ${p.downed ? '<span class="down">ダウン！ そばに立って蘇生</span>' : bar(p.hp, p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff5252' : '#66bb6a', 150)}</div>`).join('');
    if (ph !== lastParty) {
      lastParty = ph;
      party.innerHTML = ph;
    }
  }

  function mapper(w) {
    const b = w.def.bounds;
    const s = Math.min(SIZE / (b.maxX - b.minX), SIZE / (b.maxZ - b.minZ));
    const ox = (SIZE - (b.maxX - b.minX) * s) / 2;
    const oz = (SIZE - (b.maxZ - b.minZ) * s) / 2;
    return { s, X: (x) => ox + (x - b.minX) * s, Z: (z) => oz + (z - b.minZ) * s, b };
  }

  function drawBase(w) {
    baseWorld = w;
    const { s, X, Z, b } = mapper(w);
    b2.clearRect(0, 0, SIZE, SIZE);
    b2.fillStyle = w.def.dark ? 'rgba(40,34,48,.85)' : 'rgba(30,50,30,.82)';
    b2.fillRect(X(b.minX), Z(b.minZ), (b.maxX - b.minX) * s, (b.maxZ - b.minZ) * s);
    b2.fillStyle = 'rgba(215,215,200,.75)';
    for (const c of w.colliders) {
      if (c.seal || c.off) continue;
      b2.fillRect(X(c.minX), Z(c.minZ), Math.max(1, (c.maxX - c.minX) * s), Math.max(1, (c.maxZ - c.minZ) * s));
    }
  }

  function drawMap() {
    const w = game.world;
    if (!w) return;
    if (baseWorld !== w) drawBase(w);
    const { X, Z } = mapper(w);
    g2.clearRect(0, 0, SIZE, SIZE);
    g2.drawImage(base, 0, 0);
    // 結界（閉じているものだけ）
    g2.fillStyle = '#ff1744';
    for (const sl of w.extra.seals || []) {
      if (sl.open) continue;
      const c = sl.col;
      g2.fillRect(X(c.minX) - 1, Z(c.minZ) - 1, Math.max(3, X(c.maxX) - X(c.minX) + 2), Math.max(3, Z(c.maxZ) - Z(c.minZ) + 2));
    }
    // 出口
    for (const gt of w.gates) {
      g2.fillStyle = '#4fc3f7';
      g2.fillRect(X(gt.x) - 6, Z(gt.z) - 3, 12, 6);
    }
    for (const it of w.interactables) {
      if (!it.active) continue;
      g2.fillStyle = '#ffab40';
      g2.beginPath();
      g2.arc(X(it.x), Z(it.z), 2, 0, Math.PI * 2);
      g2.fill();
    }
    g2.fillStyle = '#ff5252';
    for (const e of game.enemies.list) {
      if (!e.alive) continue;
      g2.fillRect(X(e.pos.x) - 1.5, Z(e.pos.z) - 1.5, 3, 3);
    }
    for (const bs of game.bosses) {
      if (!bs.alive) continue;
      g2.fillStyle = '#d50000';
      g2.beginPath();
      g2.arc(X(bs.pos.x), Z(bs.pos.z), 5, 0, Math.PI * 2);
      g2.fill();
    }
    // 一人称：見ている範囲（扇）
    if (fps) {
      const me = game.me();
      const half = hfov() / 2;
      const a = -me.yaw + Math.PI; // キャンバスの回転（三角と同じ向き）
      g2.fillStyle = 'rgba(255,255,255,.16)';
      g2.beginPath();
      g2.moveTo(X(me.pos.x), Z(me.pos.z));
      g2.arc(X(me.pos.x), Z(me.pos.z), 26, a - Math.PI / 2 - half, a - Math.PI / 2 + half);
      g2.closePath();
      g2.fill();
    }
    // プレイヤー（向きつき三角）
    for (const p of game.players) {
      g2.save();
      g2.translate(X(p.pos.x), Z(p.pos.z));
      g2.rotate(-p.yaw + Math.PI);
      g2.fillStyle = p === game.me() ? '#ffffff' : '#80d8ff';
      g2.beginPath();
      g2.moveTo(0, -6);
      g2.lineTo(4, 4);
      g2.lineTo(-4, 4);
      g2.closePath();
      g2.fill();
      g2.restore();
    }
  }

  /** 横の視野角（ラジアン） */
  function hfov() {
    const c = game.camera;
    return 2 * Math.atan(Math.tan((c.fov * Math.PI) / 360) * c.aspect);
  }

  return {
    /** 一人称の表示（照準など）を出すか */
    setFps(v) {
      fps = v;
      cross.style.display = v ? 'block' : 'none';
      timer = 0;
    },
    /** 被弾：画面の縁を赤く。一人称で視界の外からなら方向マーカー（dirX,dirZ は攻撃してきた向き） */
    hurt(dirX, dirZ) {
      hurtT = VIEW.hurtFlash;
      if (!fps) return;
      const rel = angleDiff(game.cam.forwardYaw(), Math.atan2(dirX, dirZ));
      if (Math.abs(rel) < hfov() / 2 - 0.1) return;
      const m = markers[mNext];
      mNext = (mNext + 1) % markers.length;
      m.t = VIEW.hitMarker;
      m.el.style.transform = `translate(-50%,-50%) rotate(${(-rel * 180) / Math.PI}deg)`;
    },
    show(v) {
      root.style.display = v ? '' : 'none';
      game.plates?.show(v);
      if (!v) hud('');
    },
    update(dt) {
      timer -= dt;
      if (timer <= 0) {
        timer = 0.1;
        drawHud();
        drawMap();
      }
      const shown = game.bosses.filter((b) => b.active && b.alive);
      bossBars.forEach((ui, i) => {
        const bs = shown[i];
        ui.bar.style.display = bs ? 'block' : 'none';
        if (!bs) return;
        if (ui.name.textContent !== bs.name) ui.name.textContent = bs.name;
        ui.fill.style.width = `${(bs.hp / bs.maxHp) * 100}%`;
        ui.brk.style.width = `${bs.state === 'stun' ? 100 : Math.min(100, (bs.brk / bs.brkMax) * 100)}%`;
        ui.bar.classList.toggle('raged', bs.raged);
        ui.bar.classList.toggle('stun', bs.state === 'stun');
      });
      hint.style.display = game.input.mouse.locked || game.touch ? 'none' : 'block';
      // 被弾の縁・方向マーカー・足元の予兆の警告
      hurtT = Math.max(0, hurtT - dt);
      vignette.style.opacity = String(Math.min(1, hurtT / VIEW.hurtFlash) * 0.9);
      for (const m of markers) {
        if (m.t <= 0) { m.el.style.opacity = '0'; continue; }
        m.t -= dt;
        m.el.style.opacity = String(Math.min(1, m.t / 0.4));
      }
      const me = game.me();
      danger.style.display = fps && me.alive && game.fx.danger(me.pos.x, me.pos.z) ? 'flex' : 'none';
      if (bannerT > 0) {
        bannerT -= dt;
        banner.style.opacity = String(Math.min(1, bannerT));
      }
    },
    /** 画面下の案内。key を渡すとキーの札を付ける（看板は F、蘇生中などは null） */
    setPrompt(text, key = 'F') {
      const k = text + (key || '');
      if (k === lastPrompt) return;
      lastPrompt = k;
      prompt.style.display = text ? 'block' : 'none';
      prompt.innerHTML = text ? `${key ? `<b>${esc(key)}</b> ` : ''}${esc(text)}` : '';
    },
    banner(text) {
      banner.textContent = text;
      bannerT = 2.5;
      banner.style.opacity = '1';
    },
    /** 暗転（v: 0〜1） */
    fade(v) {
      fade.style.opacity = String(v);
    },
    refresh() {
      timer = 0;
      lastSkills = '';
    },
  };
}
