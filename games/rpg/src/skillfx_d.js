// 技エフェクト（その4）：雷術士・結界師・盗賊の技。skillfx.js から呼ぶ
//   bolt 空から落ちる稲妻 / groundZap 足元から小さな雷 / zapHit 連鎖雷が当たってスパーク → 近くの敵へ雷が走る
//   crackle 魔法陣にイナヅマが走る（落雷・雷嵐） / teamBuffD 守りの結界・大結界（盾マークの輪＋画面の枠）
//   wardStart・wardShatter 結界の衝撃（バリアを張って破裂させる） / stealArrows 盗み成功の上矢印
//   selfBuffFx 煙玉（地面へ叩きつけて煙）/ teamGaugeFx 大盤振る舞い（コインの輪とばらまき）/ updateD 画面の枠
import * as THREE from 'three';
import { geo, glow, hotOf, ease, ringGeo } from './fxkit.js';
import { shieldIconTexture, coinIconTexture, smokeTexture, starTexture } from './fxtex.js';

const sprite = (map, color, opacity = 1, additive = true) => new THREE.SpriteMaterial({
  map, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});
const V3 = THREE.Vector3;

/** ぎざぎざの折れ線：from → to を segs 個に分け、途中の点を amp だけ横へずらす */
function jag(from, to, segs, amp) {
  const pts = [from.clone()];
  for (let i = 1; i < segs; i++) {
    const p = from.clone().lerp(to, i / segs);
    p.x += (Math.random() - 0.5) * 2 * amp;
    p.y += (Math.random() - 0.5) * amp * 0.6;
    p.z += (Math.random() - 0.5) * 2 * amp;
    pts.push(p);
  }
  pts.push(to.clone());
  return pts;
}
/** 折れ線を、どこから見ても見える十字の帯にする（線ごとに作る。消えるときに dispose） */
function stripGeo(lines, w) {
  const pos = [];
  const quad = (a, b, ox, oy, oz) => {
    pos.push(a.x - ox, a.y - oy, a.z - oz, a.x + ox, a.y + oy, a.z + oz, b.x + ox, b.y + oy, b.z + oz);
    pos.push(a.x - ox, a.y - oy, a.z - oz, b.x + ox, b.y + oy, b.z + oz, b.x - ox, b.y - oy, b.z - oz);
  };
  const d = new V3();
  const s1 = new V3();
  const s2 = new V3();
  for (const { pts, w: lw = 1 } of lines) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      d.subVectors(b, a).normalize();
      s1.set(0, 1, 0).cross(d);
      if (s1.lengthSq() < 1e-4) s1.set(1, 0, 0);
      s1.normalize();
      s2.crossVectors(d, s1).normalize();
      const ww = (w * lw) / 2;
      quad(a, b, s1.x * ww, s1.y * ww, s1.z * ww);
      quad(a, b, s2.x * ww, s2.y * ww, s2.z * ww);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

export function createSkillFxD({ game, root, add, mesh }) {
  const fx = () => game.skillFx;

  /** 稲妻を1本出す：lines（折れ線と太さ）を色の太い帯＋白い芯で描き、ちらつきながら消える */
  function lightning(lines, color, dur, w) {
    const g = new THREE.Group();
    const gOuter = stripGeo(lines, w);
    const gCore = stripGeo(lines, w * 0.32);
    const mO = glow(color, 1);
    const mC = glow(0xffffff, 1);
    g.add(new THREE.Mesh(gOuter, mO), new THREE.Mesh(gCore, mC));
    g.traverse((o) => {
      o.frustumCulled = false;
      o.renderOrder = 4;
    });
    add(g, dur, (k) => {
      const f = (1 - k) * (Math.sin(k * 70) > -0.3 ? 1 : 0.35); // ちらつく
      mO.opacity = 0.9 * f;
      mC.opacity = f;
    }, [mO, mC, gOuter, gCore]);
    return g;
  }
  /** まぶしい光の玉（当たった所のスパーク） */
  function flash(x, y, z, color, size, dur) {
    const m = sprite(starTexture(), color);
    const sp = new THREE.Sprite(m);
    sp.position.set(x, y, z);
    add(sp, dur, (k) => {
      sp.scale.setScalar(size * (0.6 + 0.8 * ease(Math.min(1, k * 3))));
      m.opacity = 1 - k;
      m.rotation = k * 2;
    }, [m]);
  }

  /** 空から稲妻が落ちる（落雷）。枝わかれつき */
  function bolt(x, z, color, size = 1) {
    const top = new V3(x + (Math.random() - 0.5) * 3, 22, z + (Math.random() - 0.5) * 3);
    const main = jag(top, new V3(x, 0, z), 14, 0.9 * size);
    const lines = [{ pts: main, w: 1 }];
    for (let b = 0; b < 3; b++) {
      const from = main[3 + Math.floor(Math.random() * 8)];
      const to = from.clone().add(new V3((Math.random() - 0.5) * 6, -3 - Math.random() * 4, (Math.random() - 0.5) * 6));
      lines.push({ pts: jag(from, to, 5, 0.5), w: 0.45 });
    }
    // 地面で放射状に散る小さな雷
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 2 * size;
      lines.push({ pts: jag(new V3(x, 0.1, z), new V3(x + Math.sin(a) * r, 0.15, z + Math.cos(a) * r), 4, 0.35), w: 0.35 });
    }
    lightning(lines, color, 0.45, 0.55 * size);
    flash(x, 0.8, z, color, 7 * size, 0.4);
    flash(x, 0.8, z, 0xffffff, 3.5 * size, 0.25);
  }

  /** 足元から小さな雷がはじける（雷嵐を踏んでいる敵） */
  function groundZap(x, z, color) {
    const lines = [];
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const base = new V3(x + Math.sin(a) * 0.6, 0.05, z + Math.cos(a) * 0.6);
      lines.push({ pts: jag(base, base.clone().add(new V3((Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8)), 5, 0.3), w: i ? 0.6 : 1 });
    }
    lightning(lines, color, 0.22, 0.22);
    flash(x, 0.3, z, color, 2, 0.22);
  }

  /** 連鎖雷が当たった：その敵の所でスパークしながら弾け、近くの敵へ雷が走る（見た目だけ。全員の画面で出す） */
  function zapHit(t, color, range = 8) {
    const y = Math.min(2.2, (t.hpY ?? 2.5) * 0.55);
    const c = new V3(t.pos.x, y, t.pos.z);
    const lines = [];
    for (let i = 0; i < 9; i++) {
      const d = new V3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(1.2 + Math.random() * 1.6 + (t.radius ?? 1) * 0.5);
      lines.push({ pts: jag(c, c.clone().add(d), 4, 0.3), w: 0.5 + Math.random() * 0.5 });
    }
    lightning(lines, color, 0.3, 0.3);
    flash(c.x, c.y, c.z, color, 4.5, 0.35);
    flash(c.x, c.y, c.z, 0xffffff, 2.2, 0.2);
    game.fx?.burst(c.x, c.y, c.z, color, 22, { speed: 9, up: 3, life: 0.35, size: 0.12, grav: 4 });
    // 近くの敵へ走る雷
    const others = [...(game.bosses || []), ...(game.enemies?.list || [])];
    for (const e of others) {
      if (!e || e === t || e.alive === false || e.active === false || !e.pos) continue;
      if (Math.hypot(e.pos.x - t.pos.x, e.pos.z - t.pos.z) > range) continue;
      const to = new V3(e.pos.x, Math.min(2.2, (e.hpY ?? 2.5) * 0.55), e.pos.z);
      lightning([{ pts: jag(c, to, 9, 0.5), w: 1 }], color, 0.3, 0.3);
      flash(to.x, to.y, to.z, color, 3, 0.3);
    }
  }

  /** 魔法陣にイナヅマが走る（落雷の予告・雷嵐）。z が消えるまで続く */
  const crackles = [];
  function crackle(z) {
    crackles.push({ z, cd: 0 });
  }
  function updateCrackles(dt) {
    for (let i = crackles.length - 1; i >= 0; i--) {
      const c = crackles[i];
      if (c.z.t <= 0 || c.z.removed) {
        crackles.splice(i, 1);
        continue;
      }
      c.cd -= dt;
      if (c.cd > 0) continue;
      c.cd = 0.07 + Math.random() * 0.08;
      const z = c.z;
      // 輪の上の2点を、地面すれすれのぎざぎざで結ぶ
      const a = Math.random() * Math.PI * 2;
      const b = a + (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 1.6);
      const r1 = z.r * (0.35 + Math.random() * 0.65);
      const r2 = z.r * (0.35 + Math.random() * 0.65);
      const p1 = new V3(z.x + Math.sin(a) * r1, 0.12, z.z + Math.cos(a) * r1);
      const p2 = new V3(z.x + Math.sin(b) * r2, 0.12, z.z + Math.cos(b) * r2);
      const pts = jag(p1, p2, 6, 0.35);
      for (const p of pts) p.y = 0.12 + Math.random() * 0.15;
      lightning([{ pts, w: 1 }], z.color, 0.14, 0.12);
    }
  }

  // ---------------- 画面の枠（バリア・煙玉） ----------------
  let frameT = 0;
  const frames = {};
  function frameEl(key, css) {
    if (frames[key]) return frames[key];
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;transition:opacity .25s;box-sizing:border-box;' + css;
    document.body.appendChild(el);
    frames[key] = el;
    return el;
  }
  function smokeFrame() {
    if (frames.smoke) return frames.smoke;
    const el = frameEl('smoke', 'overflow:hidden;box-shadow:inset 0 0 70px 18px rgba(120,120,120,.5)');
    // 縁に沿って灰色のもやを並べ、ゆっくり漂わせる
    el.puffs = [];
    for (let i = 0; i < 22; i++) {
      const d = document.createElement('div');
      const side = i % 4;
      const u = (Math.floor(i / 4) + 0.5) / 6;
      const s = 110 + Math.random() * 90;
      d.style.cssText = `position:absolute;width:${s}px;height:${s}px;border-radius:50%;background:radial-gradient(circle,rgba(170,170,170,.6),rgba(140,140,140,0) 70%);filter:blur(6px)`;
      el.appendChild(d);
      el.puffs.push({ d, side, u, s, ph: Math.random() * 6 });
    }
    return el;
  }
  function updateFrames(dt) {
    if (typeof document === 'undefined') return;
    frameT += dt;
    const me = game.me?.();
    const alive = !!me?.alive;
    const blink = (b) => (b.t < 1.5 ? (Math.sin(frameT * 18) > 0 ? 1 : 0.3) : 1); // もうすぐ切れる
    // バリア：守りの結界は薄い水色、大結界は青に近い水色
    const bar = alive ? me.buffs?.barrier : null;
    if (bar || frames.ward || frames.great) {
      const big = !!bar?.big;
      const w = frameEl('ward', 'box-shadow:inset 0 0 70px 14px rgba(128,216,255,.5);border:4px solid rgba(160,230,255,.7)');
      const gr = frameEl('great', 'box-shadow:inset 0 0 90px 22px rgba(41,150,255,.6);border:5px solid rgba(64,170,255,.85)');
      const o = bar && bar.t > 0 ? (0.75 + 0.25 * Math.sin(frameT * 3)) * blink(bar) : 0;
      w.style.opacity = (big ? 0 : o).toFixed(2);
      gr.style.opacity = (big ? o : 0).toFixed(2);
    }
    // 煙玉：縁に灰色のもやが漂う
    const sm = alive ? me.buffs?.smoke : null;
    if (sm || frames.smoke) {
      const el = smokeFrame();
      const o = sm && sm.t > 0 ? blink(sm) : 0;
      el.style.opacity = o.toFixed(2);
      if (o > 0) {
        const W = innerWidth;
        const H = innerHeight;
        for (const p of el.puffs) {
          const drift = Math.sin(frameT * 0.8 + p.ph) * 40;
          const out = -p.s * 0.6 + Math.sin(frameT * 1.3 + p.ph) * 10;
          let x;
          let y;
          if (p.side === 0) { x = p.u * W + drift - p.s / 2; y = out; }
          else if (p.side === 1) { x = p.u * W + drift - p.s / 2; y = H - p.s - out; }
          else if (p.side === 2) { x = out; y = p.u * H + drift - p.s / 2; }
          else { x = W - p.s - out; y = p.u * H + drift - p.s / 2; }
          p.d.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`;
        }
      }
    }
  }

  /** 盾（コイン）のマークを並べた輪が、足元から広がる */
  function iconRing(p, r, color, tex, n, dur, rise = 0) {
    const g = new THREE.Group();
    g.position.set(p.pos.x, 0, p.pos.z);
    const mR = glow(color, 1);
    const ring = mesh(ringGeo(), mR);
    ring.position.y = 0.1;
    const mR2 = glow(hotOf(color, 0.4), 0.6);
    const ring2 = mesh(ringGeo(), mR2);
    ring2.position.y = 0.14;
    g.add(ring, ring2);
    const icons = [];
    const mats = [mR, mR2];
    for (let i = 0; i < n; i++) {
      const m = sprite(tex, i % 2 ? color : hotOf(color, 0.3));
      const sp = new THREE.Sprite(m);
      g.add(sp);
      mats.push(m);
      icons.push({ sp, m, a: (i / n) * Math.PI * 2 });
    }
    add(g, dur, (k, dt) => {
      const e = ease(Math.min(1, k / 0.6));
      const rr = 0.6 + (r - 0.6) * e;
      const fade = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
      ring.scale.set(rr, 1, rr);
      ring2.scale.set(rr * 0.9, 1, rr * 0.9);
      mR.opacity = fade;
      mR2.opacity = 0.6 * fade;
      for (const o of icons) {
        o.a += dt * 0.6;
        o.sp.position.set(Math.sin(o.a) * rr, 0.9 + rise * k + Math.sin(k * 10 + o.a) * 0.1, Math.cos(o.a) * rr);
        o.sp.scale.setScalar(0.9 + 0.3 * (1 - e) + r * 0.03);
        o.m.opacity = fade;
      }
    }, mats);
  }

  /** 自分の周りの半球のバリア（六角の模様）。grow 秒でふくらむ */
  function dome(p, r, color, dur, grow, follow = true) {
    const g = new THREE.Group();
    g.position.set(p.pos.x, 0, p.pos.z);
    const m = glow(color, 0.5);
    const m2 = glow(hotOf(color, 0.35), 0.8);
    const sh = mesh(geo('wdome', () => new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)), m);
    const rim = mesh(ringGeo(), m2);
    rim.position.y = 0.08;
    g.add(sh, rim);
    add(g, dur, (k) => {
      if (follow) g.position.set(p.pos.x, 0, p.pos.z);
      const t = k * dur;
      const s = r * (0.3 + 0.7 * ease(Math.min(1, t / grow)));
      sh.scale.set(s, s * 0.9, s);
      rim.scale.set(s, 1, s);
      const pulse = 0.85 + 0.15 * Math.sin(t * 14);
      const fade = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      m.opacity = 0.32 * pulse * fade;
      m2.opacity = 0.9 * fade;
    }, [m, m2]);
  }

  /** バリアが砕ける：破片が外へ飛び、衝撃の輪が広がる */
  function shatter(x, z, r, color, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const m = glow(hotOf(color, 0.3), 1);
    const shards = [];
    const n = Math.round(26 * scale);
    for (let i = 0; i < n; i++) {
      const s = mesh(geo('wshard', () => new THREE.TetrahedronGeometry(0.28, 0)), m);
      const a = Math.random() * Math.PI * 2;
      const el = Math.random() * 1.2;
      const dir = new V3(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el));
      s.position.copy(dir).multiplyScalar(r * 0.9);
      s.position.y += 0.3;
      g.add(s);
      shards.push({ s, v: dir.multiplyScalar(9 + Math.random() * 7), w: new V3(Math.random() * 9, Math.random() * 9, 0) });
    }
    const mW = glow(color, 1);
    const wave = mesh(ringGeo(), mW);
    wave.position.y = 0.12;
    g.add(wave);
    add(g, 0.6, (k, dt) => {
      for (const o of shards) {
        o.v.y -= 18 * dt;
        o.s.position.addScaledVector(o.v, dt);
        o.s.rotation.x += o.w.x * dt;
        o.s.rotation.y += o.w.y * dt;
        o.s.scale.setScalar(1 - k * 0.8);
      }
      m.opacity = 1 - k;
      const rr = r * (0.8 + 1.4 * ease(k)) * scale;
      wave.scale.set(rr, 1, rr);
      mW.opacity = 1 - k;
    }, [m, mW]);
    flash(x, 1.2, z, 0xffffff, 6 * scale, 0.3);
    flash(x, 1.2, z, color, 9 * scale, 0.45);
    game.fx?.shake?.(0.45 * scale);
  }

  /** 盗み成功：金色の上矢印が画面にちらほら浮かぶ（自分の画面だけ） */
  function stealArrows() {
    if (typeof document === 'undefined') return;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;overflow:hidden';
    const items = [];
    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div');
      const s = 34 + Math.random() * 30;
      d.innerHTML = `<svg width="${s}" height="${s * 1.3}" viewBox="0 0 40 52"><path d="M20 2 L38 24 L27 24 L27 50 L13 50 L13 24 L2 24 Z" fill="#ffd54f" stroke="#fff8e1" stroke-width="3" stroke-linejoin="round"/></svg>`;
      d.style.cssText = `position:absolute;left:${(10 + Math.random() * 80).toFixed(1)}%;top:${(45 + Math.random() * 35).toFixed(1)}%;filter:drop-shadow(0 0 8px rgba(255,213,79,.9));opacity:0`;
      box.appendChild(d);
      items.push({ d, delay: Math.random() * 0.35 });
    }
    document.body.appendChild(box);
    add(new THREE.Group(), 1.2, (k) => {
      const t = k * 1.2;
      for (const o of items) {
        const u = Math.max(0, Math.min(1, (t - o.delay) / 0.8));
        o.d.style.opacity = (u <= 0 ? 0 : u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8).toFixed(2);
        o.d.style.transform = `translateY(${(-u * 140).toFixed(0)}px)`;
      }
      if (k >= 1) box.remove();
    }, []);
  }

  /** 煙玉：足元で灰色の煙がもくもく広がる */
  function smokePuff(p) {
    const g = new THREE.Group();
    g.position.set(p.pos.x, 0, p.pos.z);
    const puffs = [];
    const mats = [];
    for (let i = 0; i < 18; i++) {
      const m = sprite(smokeTexture(), i % 3 ? 0x9e9e9e : 0xbdbdbd, 0.9, false);
      const sp = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2;
      g.add(sp);
      mats.push(m);
      puffs.push({ sp, m, a, r: 0.5 + Math.random() * 2.5, h: Math.random() * 1.6, s: 1.6 + Math.random() * 1.5 });
    }
    add(g, 1.6, (k) => {
      const e = ease(Math.min(1, k * 2.2));
      for (const o of puffs) {
        o.sp.position.set(Math.sin(o.a) * o.r * e, 0.5 + o.h * e + k * 0.8, Math.cos(o.a) * o.r * e);
        o.sp.scale.setScalar(o.s * (0.5 + e));
        o.m.opacity = 0.85 * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
        o.m.rotation = o.a + k;
      }
    }, mats);
    game.fx?.burst(p.pos.x, 0.3, p.pos.z, 0xe0e0e0, 18, { speed: 6, up: 2, life: 0.35, size: 0.14, grav: 3 });
  }

  /** 大盤振る舞い：両手を振り上げるたびにコインがばらまかれる */
  function coins(p, dur) {
    const n = 30;
    const mC = new THREE.MeshLambertMaterial({ color: 0xffca28, emissive: 0x8d6200, flatShading: true });
    const coinGeo = geo('coin', () => new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12).rotateX(Math.PI / 2));
    const im = new THREE.InstancedMesh(coinGeo, mC, n);
    im.frustumCulled = false;
    const seeds = Array.from({ length: n }, (_, i) => ({
      t0: 0.15 + Math.floor(i / (n / 3)) * 0.35 + Math.random() * 0.1, // 3回に分けて投げる
      a: Math.random() * Math.PI * 2, v: 3 + Math.random() * 4, up: 7 + Math.random() * 4, sp: 8 + Math.random() * 10,
    }));
    const tmp = new THREE.Object3D();
    const g = new THREE.Group();
    g.add(im);
    g.position.set(p.pos.x, 0, p.pos.z);
    add(g, dur, (k) => {
      const t = k * dur;
      seeds.forEach((s, i) => {
        const u = t - s.t0;
        if (u < 0) {
          tmp.scale.setScalar(0.001);
        } else {
          const y = 2.2 + s.up * u - 9 * u * u;
          tmp.position.set(Math.sin(s.a) * s.v * u, Math.max(0.05, y), Math.cos(s.a) * s.v * u);
          tmp.rotation.set(s.sp * u, s.a, 0);
          tmp.scale.setScalar(y < 0.05 ? Math.max(0.001, 1 - (u - 1) * 2) : 1);
        }
        tmp.updateMatrix();
        im.setMatrixAt(i, tmp.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    }, [mC, im]);
    for (let i = 0; i < 3; i++) {
      setTimeout(() => game.fx?.burst(p.pos.x, 2.3, p.pos.z, 0xffd54f, 14, { speed: 4, up: 5, life: 0.6, size: 0.12, grav: 6 }), (0.15 + i * 0.35) * 1000);
    }
  }

  return {
    bolt,
    groundZap,
    zapHit,
    crackle,
    /** 時間差の一撃が落ちたとき（落雷は空から本物の稲妻） */
    strikeHit(z) {
      if (z.skill === 'thunder') bolt(z.x, z.z, z.color, 1.1);
    },
    /** 守りの結界・大結界：盾マークの輪が広がる（大結界は大きく、自分の周りに大きなバリア） */
    teamBuffD(p, sk) {
      if (sk.id === 'ward') {
        iconRing(p, sk.radius || 8, 0x80d8ff, shieldIconTexture(), 8, 1.0);
        dome(p, 1.6, 0x80d8ff, 0.8, 0.25);
      } else if (sk.id === 'greatward') {
        iconRing(p, 16, 0x40a4ff, shieldIconTexture(), 14, 1.5, 1.2);
        iconRing(p, 9, 0x80d8ff, shieldIconTexture(), 8, 1.2);
        dome(p, 3.2, 0x40a4ff, 1.4, 0.4);
        game.fx?.shake?.(0.3);
      }
    },
    /** 結界の衝撃：杖をそのまま地面へ落とす動き＋自分の周りにバリアがふくらむ */
    wardStart(p, sk) {
      const w = sk.windup || 0.35;
      p.vmAnim = { kind: 'plant', t: 0, dur: w + 0.3, hit: w };
      dome(p, sk.radius * 0.45, sk.color, w + 0.02, w * 0.85);
    },
    /** 結界の衝撃：バリアが砕けて、その破裂で周りを攻撃 */
    wardShatter(p, sk) {
      shatter(p.pos.x, p.pos.z, sk.radius * 0.45, sk.color, 1);
      fx().slam?.(p.pos.x, p.pos.z, sk.radius, sk.color);
    },
    stealArrows,
    /** 自分強化の技ごとの見た目。true を返すと、いつもの光の柱は出さない */
    selfBuffFx(p, sk) {
      if (sk.id !== 'smoke') return false;
      p.vmAnim = { kind: 'throwdown', t: 0, dur: 0.45 };
      setTimeout(() => smokePuff(p), 160);
      return true;
    },
    /** ゲージ配りの技ごとの見た目。true を返すと、いつもの光の柱は出さない */
    teamGaugeFx(p, sk) {
      if (sk.id !== 'bounty') return false;
      p.vmAnim = { kind: 'cheer', t: 0, dur: 1.15 };
      iconRing(p, 7, 0xffd54f, coinIconTexture(), 10, 1.4, 0.6);
      coins(p, 2.0);
      return true;
    },
    updateD(dt) {
      updateCrackles(dt);
      updateFrames(dt);
    },
  };
}
