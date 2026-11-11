// 技の演出の部品（skillvis.js から使う）：光・まわりを回るマーク・画面に散るマーク・膜・網・投げる物・落ちてくる物
import * as THREE from 'three';
import { geo, glow, hotOf, ease, ringGeo } from './fxkit.js';
import { starTexture, glyphTexture, smokeTexture, petalTexture } from './fxtex.js';

const sprite = (map, color, opacity = 1, additive = true) => new THREE.SpriteMaterial({
  map, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});

export function createVisKit({ game, add, mesh, where, nearestBoss }) {
  const fx = () => game.skillFx;
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

  /** まわりを回るマーク・光（オーラ）。follow のまわりについていく */
  function orbit(follow, o) {
    const n = o.n ?? 8;
    const dur = o.dur ?? 3;
    const tex = o.glyph && !Array.isArray(o.glyph) ? glyphTexture(o.glyph) : o.glyph ? null : o.tex === 'smoke' ? smokeTexture() : o.tex === 'petal' ? petalTexture() : starTexture();
    const g = new THREE.Group();
    const parts = [];
    const mats = [];
    for (let i = 0; i < n; i++) {
      const m = sprite(Array.isArray(o.glyph) ? glyphTexture(o.glyph[i % o.glyph.length]) : tex, i % 3 ? o.color : hotOf(o.color, 0.35), 1, o.normal ? false : true); // glyph が配列なら1つずつ違うマーク
      const sp = new THREE.Sprite(m);
      g.add(sp);
      mats.push(m);
      parts.push({ sp, m, a: (i / n) * Math.PI * 2, h: Math.random(), ph: Math.random() * 6 });
    }
    const r = o.r ?? 1.2;
    const H = o.h ?? 2.2;
    const spin = o.spin ?? 1.5;
    add(g, dur, (k, dt) => {
      const pos = follow.pos;
      g.position.set(pos.x, (follow.model?.root?.position.y || 0) + (o.top ? (follow.hpY ?? 2.5) + 0.6 : 0), pos.z); // top：頭の上
      const fade = k < 0.08 ? k / 0.08 : k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
      for (const q of parts) {
        q.a += dt * spin;
        if (o.rise) q.h = (q.h + dt * o.rise) % 1;
        q.sp.position.set(Math.sin(q.a) * r, 0.3 + q.h * H + Math.sin(k * 8 + q.ph) * 0.1, Math.cos(q.a) * r);
        q.sp.scale.setScalar((o.size ?? 0.45) * (o.rise ? Math.sin(q.h * Math.PI) + 0.3 : 1));
        q.m.opacity = fade * (o.rise ? Math.sin(q.h * Math.PI) : 0.6 + 0.4 * Math.sin(k * 10 + q.ph)) * (o.opacity ?? 1);
      }
    }, mats);
  }

  /** 画面にマークを散らす（自分の画面だけ。r があれば、その範囲にいる人だけ） */
  function scatter(c, o) {
    if (typeof document === 'undefined') return;
    const me = game.me?.();
    if (!me) return;
    if (o.self && me !== c.p) return;
    if (me !== c.p && o.r && Math.hypot(me.pos.x - c.p.pos.x, me.pos.z - c.p.pos.z) > o.r) return;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;overflow:hidden';
    const items = [];
    for (let i = 0; i < (o.n ?? 14); i++) {
      const d = document.createElement('div');
      const s = 28 + Math.random() * 40;
      let x;
      let y;
      do {
        x = 4 + Math.random() * 88;
        y = 6 + Math.random() * 82;
      } while (Math.abs(x - 50) < 15 && Math.abs(y - 50) < 15);
      d.textContent = Array.isArray(o.glyph) ? o.glyph[i % o.glyph.length] : o.glyph;
      d.style.cssText = `position:absolute;left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;font:bold ${s.toFixed(0)}px "Segoe UI Symbol","Apple Symbols","Noto Sans Symbols2",sans-serif;color:${o.css};text-shadow:0 0 10px ${o.css},0 0 2px #fff;opacity:0`;
      box.appendChild(d);
      items.push({ d, delay: Math.random() * 0.35, rot: (Math.random() - 0.5) * 50 });
    }
    document.body.appendChild(box);
    add(new THREE.Group(), 1.6, (k) => {
      const t = k * 1.6;
      for (const q of items) {
        const u = Math.max(0, Math.min(1, (t - q.delay) / 1.15));
        q.d.style.opacity = (u <= 0 ? 0 : u < 0.15 ? u / 0.15 : u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1).toFixed(2);
        q.d.style.transform = `translateY(${(-u * 30).toFixed(0)}px) rotate(${(q.rot * u).toFixed(0)}deg) scale(${(u < 0.15 ? 0.4 + 4 * u : 1).toFixed(2)})`;
      }
      if (k >= 1) box.remove();
    }, []);
  }

  /** 半球の膜（守り・結界） */
  function dome(follow, o) {
    const g = new THREE.Group();
    const m = glow(o.color, 0.3);
    const m2 = glow(hotOf(o.color, 0.3), 0.8);
    const sh = mesh(geo('svDome', () => new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), m);
    const rim = mesh(ringGeo(), m2);
    rim.position.y = 0.08;
    g.add(sh, rim);
    const dur = o.dur ?? 1;
    add(g, dur, (k) => {
      g.position.set(follow.pos.x, 0, follow.pos.z);
      const t = k * dur;
      const s = (o.r ?? 2) * (0.3 + 0.7 * ease(Math.min(1, t / 0.25)));
      sh.scale.set(s, s * 0.9, s);
      rim.scale.set(s, 1, s);
      const fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      m.opacity = 0.25 * fade * (0.85 + 0.15 * Math.sin(t * 12));
      m2.opacity = 0.8 * fade;
    }, [m, m2]);
  }

  /** 網（投げ網）：ボスの上からかぶさる格子 */
  function net(c, o) {
    const b = c.target || nearestBoss(c.p);
    if (!b) return;
    const g = new THREE.Group();
    const m = new THREE.LineBasicMaterial({ color: o.color ?? 0xbcaaa4, transparent: true });
    const pts = [];
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const u = i / N - 0.5;
      pts.push(-0.5, 0, u, 0.5, 0, u, u, 0, -0.5, u, 0, 0.5);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(gg, m);
    g.add(lines);
    const dur = o.dur ?? 4;
    const fly = 0.3;
    const from = new THREE.Vector3(c.p.pos.x, 1.6, c.p.pos.z);
    add(g, dur + fly, (k) => {
      const t = k * (dur + fly);
      const R = (b.radius ?? 1.2) * 2.4;
      const H = b.hpY ?? 2.5;
      if (t < fly) {
        const u = t / fly;
        g.position.lerpVectors(from, new THREE.Vector3(b.pos.x, H + 1, b.pos.z), u);
        g.position.y += Math.sin(u * Math.PI) * 2;
        lines.scale.set(R * (0.3 + 0.7 * u), 1, R * (0.3 + 0.7 * u));
        lines.rotation.y = u * 4;
      } else {
        // かぶさって、ふちが垂れ下がる
        g.position.set(b.pos.x, H * 0.95, b.pos.z);
        lines.scale.set(R, 1, R);
        const sag = Math.min(1, (t - fly) / 0.2);
        const pos = gg.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pts[i * 3];
          const z = pts[i * 3 + 2];
          const e = Math.max(Math.abs(x), Math.abs(z)) * 2; // 0（まん中）〜1（ふち）
          pos.setY(i, -sag * e * e * H * 0.55);
        }
        pos.needsUpdate = true;
      }
      m.opacity = k > 0.92 ? 1 - (k - 0.92) / 0.08 : 1;
    }, [m, gg]);
  }

  /** 物を投げる（爆弾・瓶など）：手元から放物線で at へ */
  function lob(c, o) {
    const to = where(c, o.to ?? 'target');
    const m = sprite(o.glyph ? glyphTexture(o.glyph) : starTexture(), o.color, 1, !o.normal);
    const sp = new THREE.Sprite(m);
    const from = new THREE.Vector3(c.p.pos.x, 1.6, c.p.pos.z);
    const T = o.time ?? 0.45;
    add(sp, T, (k) => {
      sp.position.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * (o.arc ?? 2.5), from.z + (to.z - from.z) * k);
      sp.scale.setScalar(o.size ?? 0.8);
      m.rotation = k * 8;
    }, [m]);
  }

  /** 落ちてくる物（時間差の一撃）：rock 隕石 / bomb 爆弾 / spear 槍 / bird 鷹 / light 光 / shell 砲弾。land 秒後に着く */
  function fallers(z, o) {
    const n = o.n ?? 1;
    const total = Math.max(0.05, z.t) + 0.6;
    const fall = o.fall ?? 0.5;
    const g = new THREE.Group();
    const mats = [];
    const list = [];
    const dir = new THREE.Vector3(o.dx ?? 0.45, 1, o.dz ?? 0.25).normalize();
    for (let i = 0; i < n; i++) {
      const land = Math.max(0.05, z.t) - (n - 1 - i) * (o.gap ?? 0.08);
      const a = Math.random() * Math.PI * 2;
      const rr = (n > 1 ? 0.45 : 0.1) * z.r * Math.sqrt(Math.random());
      const hit = new THREE.Vector3(z.x + Math.sin(a) * rr, 0.2, z.z + Math.cos(a) * rr);
      const grp = new THREE.Group();
      let body;
      if (o.shape === 'spear') {
        const mS = new THREE.MeshLambertMaterial({ color: 0xd7ccc8, emissive: 0x3e2723, flatShading: true });
        body = new THREE.Group();
        const shaft = mesh(geo('svSpear', () => new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5)), mS);
        const tip = mesh(geo('svSpearTip', () => new THREE.ConeGeometry(0.14, 0.5, 4).rotateX(Math.PI).translate(0, -1.5, 0)), mS); // 穂先は下
        body.add(shaft, tip);
        mats.push(mS);
      } else if (o.shape === 'bomb' || o.shape === 'shell') {
        const mB = new THREE.MeshLambertMaterial({ color: o.shape === 'bomb' ? 0x263238 : 0x546e7a, emissive: 0x111111, flatShading: true });
        body = mesh(geo('svBomb', () => new THREE.SphereGeometry(0.4, 10, 8)), mB);
        mats.push(mB);
      } else if (o.shape === 'bird') {
        const mBi = sprite(glyphTexture('➶'), o.color ?? 0xbcaaa4, 1, false);
        body = new THREE.Sprite(mBi);
        body.scale.setScalar(1.6);
        mats.push(mBi);
      } else if (o.shape !== 'light') {
        const mR = new THREE.MeshLambertMaterial({ color: 0x5d4f6a, emissive: hotOf(z.color, 0.2), flatShading: true });
        body = mesh(geo('meteorRock', () => new THREE.IcosahedronGeometry(1, 0)), mR);
        body.scale.setScalar(o.size ?? 0.5);
        mats.push(mR);
      }
      if (body) grp.add(body);
      const mG = sprite(starTexture(), hotOf(z.color, 0.3));
      const halo = new THREE.Sprite(mG);
      halo.scale.setScalar(o.shape === 'light' ? 3 : 1.8);
      grp.add(halo);
      const mT = glow(z.color, 0.7);
      const trail = mesh(geo('meteorTrail', () => new THREE.ConeGeometry(1, 1, 10, 1, true).translate(0, 0.5, 0)), mT);
      trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      grp.add(trail);
      mats.push(mG, mT);
      g.add(grp);
      list.push({ grp, body, trail, land, hit, done: false });
    }
    const dist = o.height ?? 20;
    add(g, total, (k, dt) => {
      const t = k * total;
      for (const q of list) {
        const u = (t - (q.land - fall)) / fall;
        if (u < 0 || q.done) {
          q.grp.visible = false;
          continue;
        }
        if (u >= 1) {
          q.done = true;
          q.grp.visible = false;
          if (o.boom !== false) fx().explosion?.(q.hit.x, q.hit.z, o.boomR ?? Math.min(3, z.r * 0.7), z.color, !!o.big);
          flash(q.hit.x, 0.6, q.hit.z, 0xffffff, o.big ? 4 : 2.2, 0.25);
          continue;
        }
        q.grp.visible = true;
        q.grp.position.copy(q.hit).addScaledVector(dir, dist * (1 - u * u));
        if (q.body && o.shape === 'spear') q.body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        else if (q.body?.isMesh) q.body.rotation.x += dt * 6;
        const len = (o.big ? 6 : 3.5) * (0.5 + u);
        q.trail.scale.set(o.shape === 'light' ? 0.8 : 0.35, len, o.shape === 'light' ? 0.8 : 0.35);
      }
    }, mats);
  }

  return { flash, orbit, scatter, dome, net, lob, fallers };
}
