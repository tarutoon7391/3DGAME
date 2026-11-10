// HUD：HP・スタミナ・目標（左上 = shared の hud()）、
// スキル欄・ミニマップ・ボス HP・調べるの案内・エリア名・暗転（自前 DOM）
import { hud } from '/shared/ui.js';
import { SKILLS, STAMINA } from '../data/player.js';
import { BOSS } from '../data/enemies.js';
import { nextSeal } from '../area.js';
import { esc } from '../util.js';

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
  const bossBar = el('rpg-boss', root);
  bossBar.innerHTML = `<div class="rpg-boss-name">${esc(BOSS.name)}</div><div class="rpg-boss-track"><div class="rpg-boss-fill"></div></div>`;
  const bossFill = bossBar.querySelector('.rpg-boss-fill');
  const hint = el('rpg-hint', root);
  hint.textContent = 'クリックで視点操作（マウスでカメラ）';
  const fade = el('rpg-fade', document.body);
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
    if (w.def.boss) return game.boss?.active ? `${BOSS.name}を倒せ！` : '最深部のボス部屋へ進め';
    const s = nextSeal(game);
    if (!s) return '';
    if (s.done) return '結界はすべて消えた。北の出口へ！';
    return `結界 ${s.opened}/${s.total} 解除　次の結界の番人：あと ${s.left} 体`;
  }

  function drawHud() {
    const me = game.me();
    const tired = me.tired;
    const stColor = tired ? '#ff7043' : me.stamina < STAMINA.max * 0.3 ? '#ffca28' : '#ffee58';
    hud(`<div class="rpg-status">
      <div><b class="rpg-lv">${esc(game.world?.def.name || '')}</b></div>
      <div class="rpg-row"><span>HP</span>${bar(me.hp, me.maxHp, me.hp / me.maxHp < 0.3 ? '#ff5252' : '#66bb6a')}<span>${Math.ceil(me.hp)}/${me.maxHp}</span></div>
      <div class="rpg-row"><span>ST</span>${bar(me.stamina, STAMINA.max, stColor, 180, tired ? 'tired' : '')}<span class="${tired ? 'rpg-tired' : ''}">${tired ? 'バテ！' : Math.floor(me.stamina)}</span></div>
      <div class="rpg-goal">◆ ${esc(goal())}</div>
    </div>`);

    const sk = (id) => {
      const s = SKILLS[id];
      const cd = me.cd[id];
      return `<div class="rpg-skill ${cd > 0 ? 'off' : ''}"><b>${s.label}</b><span>${s.name}</span><small>CD ${s.cd}秒</small>${cd > 0 ? `<i>${cd.toFixed(1)}</i>` : ''}</div>`;
    };
    const html = `${sk('spin')}${sk('wave')}
      <div class="rpg-skill ${me.dodgeCd > 0 || tired ? 'off' : ''}"><b>Space</b><span>回避</span><small>ST${STAMINA.dodgeCost}</small></div>
      <div class="rpg-skill ${tired ? 'off' : ''} ${me.dashing ? 'on' : ''}"><b>Shift</b><span>ダッシュ</span><small>ST消費</small></div>`;
    if (html !== lastSkills) {
      lastSkills = html;
      skills.innerHTML = html;
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
    const bs = game.boss;
    if (bs && bs.alive) {
      g2.fillStyle = '#d50000';
      g2.beginPath();
      g2.arc(X(bs.pos.x), Z(bs.pos.z), 5, 0, Math.PI * 2);
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

  return {
    show(v) {
      root.style.display = v ? '' : 'none';
      if (!v) hud('');
    },
    update(dt) {
      timer -= dt;
      if (timer <= 0) {
        timer = 0.1;
        drawHud();
        drawMap();
      }
      const bs = game.boss;
      const showBoss = bs && bs.active && bs.alive;
      bossBar.style.display = showBoss ? 'block' : 'none';
      if (showBoss) {
        bossFill.style.width = `${(bs.hp / bs.maxHp) * 100}%`;
        bossBar.classList.toggle('raged', bs.raged);
      }
      hint.style.display = game.input.mouse.locked ? 'none' : 'block';
      if (bannerT > 0) {
        bannerT -= dt;
        banner.style.opacity = String(Math.min(1, bannerT));
      }
    },
    setPrompt(text) {
      if (text === lastPrompt) return;
      lastPrompt = text;
      prompt.style.display = text ? 'block' : 'none';
      prompt.innerHTML = text ? `<b>F</b> ${esc(text)}` : '';
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
