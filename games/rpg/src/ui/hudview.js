// HUD：HP/MP バー・レベル・ゴールド・クエスト進行（左上 = shared の hud()）、
// スキル欄・ミニマップ・ボス HP・調べるの案内・エリア名・暗転（自前 DOM）
import { hud } from '/shared/ui.js';
import { SKILLS, expToNext, MAX_LEVEL } from '../data/levels.js';
import { BOSS } from '../data/enemies.js';
import { questLines } from '../questlog.js';
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
  const SIZE = 168;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g2 = canvas.getContext('2d');
  root.style.display = 'none';

  let timer = 0;
  let lastSkills = '';
  let lastPrompt = null;
  let bannerT = 0;

  function bar(cur, max, color, w = 180) {
    const r = Math.max(0, Math.min(1, cur / max));
    return `<div class="rpg-bar" style="width:${w}px"><div style="width:${(r * 100).toFixed(1)}%;background:${color}"></div></div>`;
  }

  function drawHud() {
    const st = game.state;
    const pr = st.progress;
    const d = st.derived();
    const expMax = pr.level >= MAX_LEVEL ? 1 : expToNext(pr.level);
    const ql = questLines(st)
      .map((q) => `<div class="rpg-q ${q.done ? 'done' : ''}">◆ ${esc(q.name)}：${esc(q.prog)}</div>`)
      .join('');
    hud(`<div class="rpg-status">
      <div><b class="rpg-lv">Lv ${pr.level}</b> <span class="rpg-area">${esc(game.world?.def.name || '')}</span></div>
      <div class="rpg-row"><span>HP</span>${bar(pr.hp, d.maxHp, pr.hp / d.maxHp < 0.3 ? '#ff5252' : '#66bb6a')}<span>${Math.ceil(pr.hp)}/${d.maxHp}</span></div>
      <div class="rpg-row"><span>MP</span>${bar(pr.mp, d.maxMp, '#42a5f5')}<span>${Math.floor(pr.mp)}/${d.maxMp}</span></div>
      <div class="rpg-row"><span>EX</span>${bar(pr.exp, expMax, '#ffca28', 120)}<span class="rpg-gold">${pr.gold} G</span></div>
      ${ql ? `<div class="rpg-quests"><div class="rpg-qtitle">クエスト</div>${ql}</div>` : ''}
    </div>`);

    const pl = game.me();
    const mpNow = pr.mp;
    const sk = (id) => {
      const s = SKILLS[id];
      const cd = pl.cd[id];
      const off = cd > 0 || mpNow < s.mp;
      return `<div class="rpg-skill ${off ? 'off' : ''}"><b>${s.label}</b><span>${s.name}</span><small>MP${s.mp}</small>${cd > 0 ? `<i>${cd.toFixed(1)}</i>` : ''}</div>`;
    };
    const html = `${sk('spin')}${sk('wave')}
      <div class="rpg-skill ${pl.dodgeCd > 0 ? 'off' : ''}"><b>Space</b><span>回避</span></div>
      <div class="rpg-skill ${st.count('potion') ? '' : 'off'}"><b>1</b><span>回復薬</span><small>×${st.count('potion')}</small></div>
      <div class="rpg-skill ${st.count('ether') ? '' : 'off'}"><b>2</b><span>魔力水</span><small>×${st.count('ether')}</small></div>`;
    if (html !== lastSkills) {
      lastSkills = html;
      skills.innerHTML = html;
    }
  }

  function drawMap() {
    const w = game.world;
    if (!w) return;
    const b = w.def.bounds;
    const sx = SIZE / (b.maxX - b.minX);
    const sz = SIZE / (b.maxZ - b.minZ);
    const s = Math.min(sx, sz);
    const ox = (SIZE - (b.maxX - b.minX) * s) / 2;
    const oz = (SIZE - (b.maxZ - b.minZ) * s) / 2;
    const X = (x) => ox + (x - b.minX) * s;
    const Z = (z) => oz + (z - b.minZ) * s;
    g2.clearRect(0, 0, SIZE, SIZE);
    g2.fillStyle = w.def.dark ? 'rgba(40,34,48,.85)' : 'rgba(40,70,40,.8)';
    g2.fillRect(X(b.minX), Z(b.minZ), (b.maxX - b.minX) * s, (b.maxZ - b.minZ) * s);
    g2.fillStyle = 'rgba(200,200,200,.55)';
    for (const c of w.colliders) {
      if (c.off) continue;
      g2.fillRect(X(c.minX), Z(c.minZ), Math.max(1, (c.maxX - c.minX) * s), Math.max(1, (c.maxZ - c.minZ) * s));
    }
    for (const gt of w.gates) {
      g2.fillStyle = gt.requires && !game.gateOpen(gt) ? '#ff5252' : '#4fc3f7';
      g2.fillRect(X(gt.x) - 5, Z(gt.z) - 3, 10, 6);
    }
    for (const it of w.interactables) {
      if (!it.active) continue;
      g2.fillStyle = it.npc ? '#ffee58' : it.herb ? '#76ff03' : '#ffab40';
      g2.beginPath();
      g2.arc(X(it.x), Z(it.z), it.npc ? 3 : 2, 0, Math.PI * 2);
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
      const px = X(p.pos.x);
      const pz = Z(p.pos.z);
      g2.save();
      g2.translate(px, pz);
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
