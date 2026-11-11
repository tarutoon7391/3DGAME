// 回復・強化のオーラとエリアの見た目（範囲がひと目でわかるように）
//   ・いつも出ているオーラ（僧侶・吟遊詩人の特性）… 持ち主の足元についていく
//   ・設置エリア（聖別・お弁当・トーテム・守護結界など）… jobs.js の addZone から zoneAdded(z) で登録
//   ・範囲回復・範囲強化を使った瞬間の波紋 … jobs.js の ringFx から pulse()
// 当たり判定や効果には関わらない（見た目だけ）。数値は src/data/auras.js
import * as THREE from 'three';
import { JOBS } from './data/jobs.js';
import { AURA_STYLE, PASSIVE_AURAS, PASSIVE_DIM, INSIDE_BOOST, BLINK_BEFORE_END, PULSE } from './data/auras.js';
import { fillTexture, wallTexture, patternTexture, emblemTexture } from './auratex.js';

let geos = null;
function sharedGeos() {
  if (geos) return geos;
  geos = {
    disc: new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    rim: new THREE.RingGeometry(0.965, 1, 72).rotateX(-Math.PI / 2),
    halo: new THREE.RingGeometry(1, 1.07, 72).rotateX(-Math.PI / 2),
    wall: new THREE.CylinderGeometry(1, 1, 1, 64, 1, true).translate(0, 0.5, 0),
  };
  return geos;
}

function glowMat(color, opacity, map = null, side = THREE.FrontSide) {
  return new THREE.MeshBasicMaterial({
    color, map, transparent: true, opacity, depthWrite: false, side,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2,
  });
}

/** 設置エリアをどの見た目にするか */
export function zoneType(z) {
  if (z.kind === 'aegis') return 'ward';
  if (z.heal) return 'heal';
  if (z.kind === 'totem' || z.buff) return 'buff';
  if (z.mult) return 'hazard';
  return 'ward';
}

/** 1つのエリアの見た目を作る。type：AURA_STYLE のキー、emblem：真ん中のマークを出すか、dim：明るさの倍率 */
function makeArea(parent, { type, color, r, emblem = true, dim = 1 }) {
  const st = AURA_STYLE[type] || AURA_STYLE.heal;
  const G = sharedGeos();
  const group = new THREE.Group();
  const fill = new THREE.Mesh(G.disc, glowMat(color, st.fill * dim, fillTexture()));
  const pattern = new THREE.Mesh(G.disc, glowMat(color, 0.75 * dim, patternTexture(st.pattern)));
  const rim = new THREE.Mesh(G.rim, glowMat(color, st.rim * dim));
  const halo = new THREE.Mesh(G.halo, glowMat(color, 0.2 * dim));
  const wall = new THREE.Mesh(G.wall, glowMat(color, 0.5 * dim, wallTexture(), THREE.DoubleSide));
  fill.position.y = 0.035;
  pattern.position.y = 0.045;
  rim.position.y = 0.055;
  halo.position.y = 0.05;
  for (const m of [fill, pattern, rim, halo]) m.scale.set(r, 1, r);
  wall.scale.set(r, st.wall, r);
  group.add(fill, pattern, rim, halo, wall);
  let sprite = null;
  if (emblem && st.emblem) {
    sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: emblemTexture(st.emblem), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.scale.setScalar(Math.min(1.4, 0.6 + r * 0.12));
    group.add(sprite);
  }
  for (const o of group.children) {
    o.renderOrder = 2;
    o.frustumCulled = false;
  }
  parent.add(group);
  const base = { fill: st.fill * dim, rim: st.rim * dim, pattern: 0.75 * dim, wall: 0.5 * dim, halo: 0.2 * dim };
  let age = Math.random() * 10;

  return {
    group,
    /** frac：残り時間の割合（1＝いっぱい）、left：残り秒、inside：自分が中にいるか */
    update(dt, x, z, { frac = 1, left = Infinity, inside = false } = {}) {
      age += dt;
      group.position.set(x, 0, z);
      pattern.rotation.y += st.spin * dt;
      let k = inside ? INSIDE_BOOST : 1;
      if (left < BLINK_BEFORE_END) k *= Math.sin(age * 20) > 0 ? 1 : 0.3; // もうすぐ消える
      const breathe = 0.85 + 0.15 * Math.sin(age * 3);
      fill.material.opacity = Math.min(1, base.fill * k * breathe);
      rim.material.opacity = Math.min(1, base.rim * k);
      halo.material.opacity = Math.min(1, base.halo * k * breathe);
      pattern.material.opacity = Math.min(1, base.pattern * k);
      wall.material.opacity = Math.min(1, base.wall * k * breathe);
      wall.scale.y = st.wall * (0.4 + 0.6 * frac); // 残り時間が減ると低くなる
      if (sprite) {
        sprite.position.y = 2.1 + Math.sin(age * 2.2) * 0.12;
        sprite.material.opacity = Math.min(1, 0.9 * k);
      }
    },
    remove() {
      parent.remove(group);
      for (const o of group.children) o.material.dispose(); // 形と模様は使い回すので消さない
    },
  };
}

export function createAuras(game) {
  const root = new THREE.Group();
  game.scene.add(root);
  const zoneAreas = new Set(); // { z, area, t0 }
  const passive = new Map(); // player → area
  const pulses = [];

  /** 自分（このブラウザのプレイヤー）が (x,z) から r 以内にいるか */
  const meInside = (x, z, r) => {
    const me = game.me?.();
    return !!me?.alive && (me.pos.x - x) ** 2 + (me.pos.z - z) ** 2 <= r * r;
  };

  return {
    /** 設置エリアを登録（jobs.js の addZone から）。z.aura.remove() で消える */
    zoneAdded(z) {
      if (z.kind !== 'field' && z.kind !== 'totem' && z.kind !== 'aegis') {
        game.skillFx?.zoneAdded(z); // メテオ・矢の雨・落雷は src/skillfx.js
        return;
      }
      if (z.skill === 'tempest') game.skillFx?.crackle?.(z); // 雷嵐：魔法陣にイナヅマが走る
      const type = zoneType(z);
      const color = z.kind === 'aegis' ? 0x90caf9 : z.color ?? 0xffffff;
      const area = makeArea(root, { type, color, r: z.r, emblem: type !== 'hazard' });
      if (z.kind !== 'aegis') z.mesh.visible = false; // 前の細い輪は隠す（トーテムの柱・結界のドームは残す）
      const rec = { z, area, type, t0: Math.max(0.01, z.t) };
      zoneAreas.add(rec);
      z.aura = {
        remove() {
          area.remove();
          zoneAreas.delete(rec);
        },
      };
      area.update(0, z.x, z.z);
    },

    /** 範囲回復・範囲強化を使った瞬間：中心から輪が広がって範囲の大きさを見せる */
    pulse(x, z, r, color = 0xffffff) {
      const G = sharedGeos();
      const g = new THREE.Group();
      const ring = new THREE.Mesh(G.rim, glowMat(color, 1));
      const fill = new THREE.Mesh(G.disc, glowMat(color, PULSE.fill, fillTexture()));
      const wall = new THREE.Mesh(G.wall, glowMat(color, 0.7, wallTexture(), THREE.DoubleSide));
      ring.position.y = 0.06;
      fill.position.y = 0.04;
      for (const o of [ring, fill, wall]) {
        o.renderOrder = 2;
        o.frustumCulled = false;
      }
      g.add(ring, fill, wall);
      g.position.set(x, 0, z);
      root.add(g);
      pulses.push({ g, ring, fill, wall, r, t: 0 });
    },

    update(dt) {
      // 設置エリア
      for (const rec of zoneAreas) {
        const { z } = rec;
        rec.area.update(dt, z.x, z.z, {
          frac: Math.max(0, Math.min(1, z.t / rec.t0)), left: z.t,
          inside: rec.type !== 'hazard' && meInside(z.x, z.z, z.r),
        });
      }
      // いつも出ているオーラ：持ち主についていく
      const seen = new Set();
      for (const p of game.players || []) {
        const def = PASSIVE_AURAS[p.jobId];
        const r = JOBS[p.jobId]?.auraRadius;
        if (!def || !r || !p.alive) continue;
        seen.add(p);
        let area = passive.get(p);
        if (!area) {
          area = makeArea(root, { type: def.type, color: def.color, r, emblem: false, dim: PASSIVE_DIM });
          passive.set(p, area);
        }
        area.update(dt, p.pos.x, p.pos.z, { inside: !p.remote ? false : meInside(p.pos.x, p.pos.z, r) });
      }
      for (const [p, area] of passive) {
        if (!seen.has(p)) {
          area.remove();
          passive.delete(p);
        }
      }
      // 波紋
      for (let i = pulses.length - 1; i >= 0; i--) {
        const s = pulses[i];
        s.t += dt;
        const k = Math.min(1, s.t / PULSE.grow);
        const e = 1 - (1 - k) * (1 - k);
        const rr = Math.max(0.2, s.r * e);
        s.ring.scale.set(rr, 1, rr);
        s.fill.scale.set(rr, 1, rr);
        s.wall.scale.set(rr, 1.2 * (1 - k * 0.4), rr);
        const fade = s.t < PULSE.grow ? 1 : Math.max(0, 1 - (s.t - PULSE.grow) / PULSE.hold);
        s.ring.material.opacity = fade;
        s.fill.material.opacity = PULSE.fill * fade;
        s.wall.material.opacity = 0.7 * fade;
        if (fade <= 0) {
          root.remove(s.g);
          for (const o of s.g.children) o.material.dispose();
          pulses.splice(i, 1);
        }
      }
    },

    /** 波紋と常時オーラを全部消す（設置エリアは jobs.js の clearJobZones で消える） */
    clear() {
      for (const s of pulses) {
        root.remove(s.g);
        for (const o of s.g.children) o.material.dispose();
      }
      pulses.length = 0;
      for (const area of passive.values()) area.remove();
      passive.clear();
    },
  };
}
