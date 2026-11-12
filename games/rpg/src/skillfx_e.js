// 技エフェクト（その5）：侍の見切り・占星術師・魔剣士。skillfx.js から呼ぶ
//   counterHit 見切り成功（鞘から右へ抜き斬り） / meteors 流れ星・流星群（光る隕石が降る）
//   cardFx 星のカード（出たカードのマークを画面に散らす） / enchantFx 魔力付与（剣を掲げる）
//   arcaneStart 魔剣解放（剣を掲げて魔力を溜め、紫の巨大な剣の残影で斬り下ろす）
import * as THREE from 'three';
import { geo, glow, hotOf, ease, ringGeo } from './fxkit.js';
import { starTexture } from './fxtex.js';

const sprite = (map, color, opacity = 1) => new THREE.SpriteMaterial({
  map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
});

/** 星のカードのマーク（SVG）。太陽・月・風・星 */
const CARD_ICONS = {
  sun: '<svg viewBox="0 0 64 64"><g stroke="#ffb300" stroke-width="5" stroke-linecap="round">'
    + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
      const r = (a * Math.PI) / 180;
      return `<line x1="${32 + Math.cos(r) * 20}" y1="${32 + Math.sin(r) * 20}" x2="${32 + Math.cos(r) * 29}" y2="${32 + Math.sin(r) * 29}"/>`;
    }).join('') + '</g><circle cx="32" cy="32" r="14" fill="#ffd54f" stroke="#fff8e1" stroke-width="3"/></svg>',
  moon: '<svg viewBox="0 0 64 64"><path d="M40 6 A26 26 0 1 0 58 44 A20 20 0 1 1 40 6 Z" fill="#bbdefb" stroke="#e3f2fd" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="40" r="3" fill="#90caf9"/><circle cx="18" cy="28" r="2" fill="#90caf9"/></svg>',
  wind: '<svg viewBox="0 0 64 64" fill="none" stroke="#a5d6a7" stroke-width="5" stroke-linecap="round"><path d="M6 24 H40 A8 8 0 1 0 32 16"/><path d="M6 36 H50 A8 8 0 1 1 42 44"/><path d="M12 48 H28"/></svg>',
  star: '<svg viewBox="0 0 64 64"><path d="M32 4 L40 24 L61 25 L44 38 L50 59 L32 47 L14 59 L20 38 L3 25 L24 24 Z" fill="#fff59d" stroke="#fffde7" stroke-width="3" stroke-linejoin="round"/></svg>',
};
const CARD_GLOW = { sun: '255,213,79', moon: '144,202,249', wind: '165,214,167', star: '255,245,157' };
function cardKind(name) {
  if (name.startsWith('太陽')) return 'sun';
  if (name.startsWith('月')) return 'moon';
  if (name.startsWith('風')) return 'wind';
  return 'star';
}

/** 剣のかたち（+Y が切っ先。長さ 1、XY 面） */
function bladeGeo() {
  return geo('phantomBlade', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.07, 0.1);
    s.lineTo(0.07, 0.1);
    s.lineTo(0.07, 0.86);
    s.lineTo(0, 1);
    s.lineTo(-0.07, 0.86);
    s.closePath();
    const blade = new THREE.ShapeGeometry(s);
    const guard = new THREE.PlaneGeometry(0.3, 0.035).translate(0, 0.08, 0);
    const grip = new THREE.PlaneGeometry(0.035, 0.08).translate(0, 0.03, 0);
    const parts = [blade, guard, grip].map((g) => g.toNonIndexed());
    const pos = [];
    for (const g of parts) pos.push(...g.attributes.position.array);
    // 横からも見えるように、Y 軸で 90° 回した面も足す
    const n = pos.length;
    for (let i = 0; i < n; i += 3) pos.push(0, pos[i + 1], pos[i]);
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return out;
  });
}

export function createSkillFxE({ game, root, add, mesh, slash, streak, column }) {
  /** まぶしい光の玉 */
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
  /** 画面いっぱいの一閃（DOM。自分の画面だけ） */
  function screenSlash(color = '255,255,255', angle = -12) {
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;overflow:hidden';
    const line = document.createElement('div');
    line.style.cssText = `position:absolute;left:-10%;top:50%;width:120%;height:10px;transform:rotate(${angle}deg) scaleX(0);transform-origin:left center;`
      + `background:linear-gradient(90deg,rgba(${color},0),rgba(255,255,255,1) 70%,rgba(${color},0));box-shadow:0 0 24px 8px rgba(${color},.8)`;
    const flashEl = document.createElement('div');
    flashEl.style.cssText = `position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,0) 40%,rgba(${color},.5));opacity:0`;
    el.append(flashEl, line);
    document.body.appendChild(el);
    add(new THREE.Group(), 0.5, (k) => {
      const s = Math.min(1, k / 0.25);
      line.style.transform = `rotate(${angle}deg) scaleX(${ease(s).toFixed(3)})`;
      line.style.opacity = (k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6).toFixed(2);
      flashEl.style.opacity = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85).toFixed(2);
      if (k >= 1) el.remove();
    }, []);
  }

  // ---------------- 流れ星・流星群：光る隕石が降ってくる ----------------
  function meteors(z) {
    const big = z.skill === 'meteorshower';
    const n = 3; // 流れ星は1か所に3つ。流星群は6か所×3つ
    const fall = big ? 0.5 : 0.55;
    const total = Math.max(0.05, z.t) + 0.9 + (big ? 0 : 0.2);
    const g = new THREE.Group();
    const mats = [];
    const list = [];
    const dir = new THREE.Vector3(0.55, 1, 0.3).normalize();
    for (let i = 0; i < n; i++) {
      // 流れ星は3つが1つずつ当たる（jobs.js の hits・hitGap）ので、1つ目が当たる時刻から順に落ちる
      const land = big ? Math.max(0.05, z.t) - (n - 1 - i) * 0.12 - Math.random() * 0.06 : Math.max(0.05, z.t) + i * (z.hitGap || 0.09);
      const a = Math.random() * Math.PI * 2;
      const rr = (big ? 0.4 : 0.3) * z.r * Math.sqrt(Math.random()) * (i === n - 1 ? 0.3 : 1);
      const hit = new THREE.Vector3(z.x + Math.sin(a) * rr, 0.2, z.z + Math.cos(a) * rr);
      const size = big ? 0.55 + Math.random() * 0.2 : 0.28 + Math.random() * 0.08;
      const color = big ? (i % 2 ? z.color : 0xff8a65) : z.color;
      const mRock = new THREE.MeshLambertMaterial({ color: 0x5d4f6a, emissive: hotOf(color, 0.25), flatShading: true });
      const rock = mesh(geo('meteorRock', () => new THREE.IcosahedronGeometry(1, 0)), mRock);
      rock.scale.setScalar(size);
      const mG = sprite(starTexture(), hotOf(color, 0.4));
      const halo = new THREE.Sprite(mG);
      const mT = glow(color, 0.8);
      const trailGeo = geo('meteorTrail', () => new THREE.ConeGeometry(1, 1, 10, 1, true).translate(0, 0.5, 0)); // 太い底が原点（隕石側）、とがった先が +Y
      const trail = mesh(trailGeo, mT);
      const mT2 = glow(0xffffff, 0.8);
      const core = mesh(trailGeo, mT2);
      const grp = new THREE.Group();
      grp.add(rock, halo, trail, core);
      g.add(grp);
      mats.push(mRock, mG, mT, mT2);
      list.push({ grp, rock, halo, mG, trail, core, mT, mT2, land, hit, size, color, done: false, spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0) });
    }
    const dist = big ? 24 : 18;
    const qTrail = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); // 尾は来た方向（空）へ伸ばす
    add(g, total, (k, dt) => {
      const t = k * total;
      for (const o of list) {
        const u = (t - (o.land - fall)) / fall; // 0→1 で地面に着く
        if (u < 0 || o.done) {
          o.grp.visible = false;
          continue;
        }
        if (u >= 1) {
          o.done = true;
          o.grp.visible = false;
          // 着弾：光って弾け、小さなクレーターの輪
          flash(o.hit.x, 0.6, o.hit.z, o.color, big ? 7 : 3.5, big ? 0.5 : 0.35);
          flash(o.hit.x, 0.6, o.hit.z, 0xffffff, big ? 3.5 : 1.8, 0.25);
          game.fx?.burst?.(o.hit.x, 0.4, o.hit.z, o.color, big ? 30 : 14, { speed: big ? 10 : 6, up: big ? 8 : 5, life: 0.6, size: big ? 0.22 : 0.14 });
          crater(o.hit.x, o.hit.z, big ? 2.6 : 1.4, o.color);
          if (big) game.fx?.shake?.(0.35);
          continue;
        }
        o.grp.visible = true;
        const e = u * u; // だんだん速く
        o.grp.position.copy(o.hit).addScaledVector(dir, dist * (1 - e));
        o.rock.rotation.x += o.spin.x * dt;
        o.rock.rotation.y += o.spin.y * dt;
        o.halo.scale.setScalar(o.size * (big ? 6 : 5) * (0.9 + 0.2 * Math.sin(t * 40)));
        const len = (big ? 7 : 4) * (0.5 + u);
        o.trail.quaternion.copy(qTrail);
        o.trail.scale.set(o.size * 0.9, len, o.size * 0.9);
        o.core.quaternion.copy(o.trail.quaternion);
        o.core.scale.set(o.size * 0.35, len * 0.7, o.size * 0.35);
        o.mT.opacity = 0.75;
        o.mT2.opacity = 0.7;
      }
    }, mats);
  }
  function crater(x, z, r, color) {
    const m = glow(color, 1);
    const ring = mesh(ringGeo(), m);
    ring.position.set(x, 0.1, z);
    add(ring, 0.5, (k) => {
      const s = r * (0.4 + 0.8 * ease(k));
      ring.scale.set(s, 1, s);
      m.opacity = 1 - k;
    }, [m]);
  }

  // ---------------- 魔剣解放：紫の巨大な剣の残影 ----------------
  function phantomSwing(p, yaw, color, len) {
    const g = new THREE.Group();
    g.position.set(p.pos.x + Math.sin(yaw) * 0.6 + Math.cos(yaw) * -0.35, 1.2, p.pos.z + Math.cos(yaw) * 0.6 - Math.sin(yaw) * -0.35);
    g.rotation.y = yaw;
    const n = 5; // 本体＋残影
    const blades = [];
    const mats = [];
    for (let i = 0; i < n; i++) {
      const m = glow(i ? color : hotOf(color, 0.45), i ? 0.5 / i : 0.95);
      const piv = new THREE.Group();
      const b = mesh(bladeGeo(), m);
      b.scale.set(len * 1.3, len, len * 1.3);
      piv.add(b);
      g.add(piv);
      mats.push(m);
      blades.push({ piv, m, lag: i * 0.03 });
    }
    const D = 0.7;
    add(g, D, (k) => {
      const t = k * D;
      for (const o of blades) {
        const u = Math.min(1, Math.max(0, (t - o.lag) / 0.18));
        o.piv.rotation.x = -0.2 + 1.75 * ease(u); // 真上から前の地面へ
        const fade = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.4;
        o.m.opacity = (o.lag ? 0.55 - o.lag * 4 : 0.95) * Math.max(0, fade);
      }
    }, mats);
  }

  return {
    /** 見切り成功：左下の鞘から右へ思い切り抜き斬る。派手な一閃 */
    counterHit(pl, target) {
      pl.vmAnim = { kind: 'drawcut', t: 0, dur: 0.6 };
      const yaw = target ? Math.atan2(target.pos.x - pl.pos.x, target.pos.z - pl.pos.z) : pl.yaw;
      slash(pl.pos.x, pl.pos.z, yaw, 6, 2.6, 0xffffff, { y: 1.3, roll: 0.15, dur: 0.3, sweep: -2.2 });
      slash(pl.pos.x, pl.pos.z, yaw, 7, 2.4, 0xff5252, { y: 1.25, roll: 0.1, dur: 0.38, sweep: -2.0 });
      if (target) {
        streak(pl.pos.x, pl.pos.z, target.pos.x, target.pos.z, 0.9, 0xffffff, 0.3, 1.4);
        const h = Math.min(2.4, (target.hpY ?? 2.5) * 0.55);
        flash(target.pos.x, h, target.pos.z, 0xff5252, 8, 0.45);
        flash(target.pos.x, h, target.pos.z, 0xffffff, 4, 0.3);
        game.enemyFx?.impact?.(target.pos.x, target.pos.z, 3, 0xffffff, 'default');
      }
      game.fx?.burst?.(pl.pos.x, 1.3, pl.pos.z, 0xffffff, 40, { speed: 12, up: 3, life: 0.45, size: 0.14 });
      game.fx?.shake?.(0.7);
      screenSlash('255,82,82', -14);
    },
    meteors,
    /** 星のカード：出たカードのマークを画面に散らす（近くにいる自分の画面） */
    cardFx(p, one) {
      if (typeof document === 'undefined' || !one) return;
      const me = game.me?.();
      if (!me || (me !== p && Math.hypot(me.pos.x - p.pos.x, me.pos.z - p.pos.z) > (one.radius || 9))) return;
      const kind = cardKind(one.name);
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;overflow:hidden';
      const items = [];
      for (let i = 0; i < 16; i++) {
        const d = document.createElement('div');
        const s = 36 + Math.random() * 44;
        d.innerHTML = CARD_ICONS[kind];
        const sv = d.firstChild;
        sv.setAttribute('width', s);
        sv.setAttribute('height', s);
        // 画面のまん中を少し空けて散らす
        let x;
        let y;
        do {
          x = 4 + Math.random() * 88;
          y = 6 + Math.random() * 82;
        } while (Math.abs(x - 50) < 16 && Math.abs(y - 50) < 16);
        d.style.cssText = `position:absolute;left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;filter:drop-shadow(0 0 10px rgba(${CARD_GLOW[kind]},.95));opacity:0`;
        box.appendChild(d);
        items.push({ d, delay: Math.random() * 0.4, rot: (Math.random() - 0.5) * 60 });
      }
      document.body.appendChild(box);
      add(new THREE.Group(), 1.8, (k) => {
        const t = k * 1.8;
        for (const o of items) {
          const u = Math.max(0, Math.min(1, (t - o.delay) / 1.3));
          o.d.style.opacity = (u <= 0 ? 0 : u < 0.15 ? u / 0.15 : u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1).toFixed(2);
          const sc = u < 0.15 ? 0.4 + 4 * u : 1;
          o.d.style.transform = `translateY(${(-u * 30).toFixed(0)}px) rotate(${(o.rot * u).toFixed(0)}deg) scale(${sc.toFixed(2)})`;
        }
        if (k >= 1) box.remove();
      }, []);
    },
    /** 魔力付与：剣を真上に掲げる（オーラは viewmodel が効果中ずっと出す） */
    enchantFx(p) {
      p.vmAnim = { kind: 'raise', t: 0, dur: 0.8 };
    },
    /** 魔剣解放：剣を掲げて w 秒 魔力を溜め、紫の巨大な剣の残影で斬り下ろす */
    arcaneStart(p, sk, yaw) {
      const w = sk.windup || 1;
      p.vmAnim = { kind: 'arcane', t: 0, dur: w + 0.5, w };
      const color = sk.color;
      // 溜め：紫の光が渦を巻いて剣（頭の上）へ集まる
      const g = new THREE.Group();
      const parts = [];
      const mats = [];
      for (let i = 0; i < 26; i++) {
        const m = sprite(starTexture(), i % 3 ? color : 0xe1d0ff);
        const sp = new THREE.Sprite(m);
        g.add(sp);
        mats.push(m);
        parts.push({ sp, m, a: Math.random() * 6.28, r: 2 + Math.random() * 2.5, h: Math.random() * 2.5, ph: Math.random() });
      }
      const mOrb = sprite(starTexture(), hotOf(color, 0.4));
      const orb = new THREE.Sprite(mOrb);
      g.add(orb);
      mats.push(mOrb);
      add(g, w, (k, dt) => {
        g.position.set(p.pos.x, 0, p.pos.z);
        for (const o of parts) {
          const u = (k * 1.6 + o.ph) % 1;
          o.a += dt * 5;
          const rr = o.r * (1 - u);
          o.sp.position.set(Math.sin(o.a) * rr, 2.8 + (o.h - 1) * (1 - u), Math.cos(o.a) * rr);
          o.sp.scale.setScalar(0.35 + 0.3 * u);
          o.m.opacity = Math.sin(u * Math.PI);
        }
        orb.position.set(0, 2.9, 0);
        orb.scale.setScalar(0.6 + 2.4 * k + 0.3 * Math.sin(k * 60));
        mOrb.opacity = 0.5 + 0.5 * k;
      }, mats);
      column(p.pos.x, p.pos.z, 1.2, 4, color, w, p, 0.4);
      // 斬り下ろし：巨大な紫の剣の残影
      setTimeout(() => {
        phantomSwing(p, yaw, color, 9);
        slash(p.pos.x, p.pos.z, yaw, 9, 1.3, color, { y: 1.4, roll: Math.PI / 2, dur: 0.45, sweep: 1.2 });
        const fx = p.pos.x + Math.sin(yaw) * 7;
        const fz = p.pos.z + Math.cos(yaw) * 7;
        flash(fx, 0.6, fz, color, 9, 0.5);
        flash(fx, 0.6, fz, 0xffffff, 4, 0.3);
        crater(fx, fz, 4, color);
        game.fx?.burst?.(fx, 0.5, fz, color, 45, { speed: 11, up: 8, life: 0.7, size: 0.22 });
        game.fx?.shake?.(0.8);
        if (p === game.me?.()) screenSlash('124,77,255', 78);
      }, w * 1000);
    },
  };
}
