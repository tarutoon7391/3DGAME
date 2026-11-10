// ガジェット：おとりコイン（落ちた音で警備員を誘導）と煙玉（数秒間視界を遮る）
import * as THREE from 'three';
import { OPAQUE } from './config.js';

const SMOKE_R = 2.4;
const SMOKE_TIME = 6;
const COIN_RANGE = 8;
const COIN_FLIGHT = 0.6;

export function createGadgets(parent) {
  // コイン（プール）
  const coinGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 12);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0x6a4a00, metalness: 0.9, roughness: 0.3 });
  const coins = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.visible = false;
    parent.add(m);
    coins.push({ m, active: false, landed: false, t: 0, sx: 0, sz: 0, ex: 0, ez: 0, life: 0 });
  }

  // 煙（プール）
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const smokes = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0, depthWrite: false, roughness: 1 });
    const g = new THREE.Group();
    const puffs = [];
    for (let k = 0; k < 8; k++) {
      const m = new THREE.Mesh(puffGeo, mat);
      const a = (k / 8) * Math.PI * 2;
      m.userData.off = [Math.cos(a) * 1.1 * (k % 2 ? 1 : 0.5), 0.6 + (k % 3) * 0.45, Math.sin(a) * 1.1 * (k % 2 ? 1 : 0.5)];
      g.add(m);
      puffs.push(m);
    }
    g.visible = false;
    parent.add(g);
    smokes.push({ g, mat, puffs, active: false, t: 0, x: 0, z: 0 });
  }

  const api = {
    /** 状態（JSON 化できる値だけ） */
    snapshot() {
      return {
        coins: coins.filter((c) => c.active).map((c) => ({ x: c.ex, z: c.ez, t: c.t, landed: c.landed })),
        smokes: smokes.filter((s) => s.active).map((s) => ({ x: s.x, z: s.z, t: s.t })),
      };
    },
    /** 向き angle に投げる。着地点を返す */
    throwCoin(grid, x, z, angle) {
      const c = coins.find((o) => !o.active) || coins[0];
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const d = Math.max(0.5, grid.raycast(x, z, dx, dz, COIN_RANGE, OPAQUE | 1) - 0.4);
      Object.assign(c, { active: true, landed: false, t: 0, sx: x, sz: z, ex: x + dx * d, ez: z + dz * d, life: 0 });
      c.m.visible = true;
      return c;
    },
    dropSmoke(x, z) {
      const s = smokes.find((o) => !o.active) || smokes[0];
      Object.assign(s, { active: true, t: 0, x, z });
      s.g.position.set(x, 0, z);
      s.g.visible = true;
    },
    /** 煙の中にいるか */
    inSmoke(x, z) {
      for (const s of smokes) {
        if (s.active && (x - s.x) ** 2 + (z - s.z) ** 2 < SMOKE_R * SMOKE_R) return true;
      }
      return false;
    },
    /** レイが煙に入るまでの距離（入らなければ maxD） */
    rayBlock(x, z, dx, dz, maxD) {
      let best = maxD;
      for (const s of smokes) {
        if (!s.active) continue;
        const ox = s.x - x;
        const oz = s.z - z;
        const tc = ox * dx + oz * dz;
        const d2 = ox * ox + oz * oz - tc * tc;
        if (d2 > SMOKE_R * SMOKE_R) continue;
        const th = Math.sqrt(SMOKE_R * SMOKE_R - d2);
        const t0 = Math.max(0, tc - th);
        if (tc + th > 0 && t0 < best) best = t0;
      }
      return best;
    },
    /** 2点間が煙で遮られているか */
    blocks(ax, az, bx, bz) {
      const d = Math.hypot(bx - ax, bz - az);
      if (d < 1e-6) return false;
      return api.rayBlock(ax, az, (bx - ax) / d, (bz - az) / d, d) < d;
    },
    /** onLand(x,z) はコインが着地した時に1回呼ばれる */
    update(dt, time, onLand) {
      for (const c of coins) {
        if (!c.active) continue;
        if (!c.landed) {
          c.t += dt;
          const k = Math.min(1, c.t / COIN_FLIGHT);
          c.m.position.set(c.sx + (c.ex - c.sx) * k, 1.2 + Math.sin(k * Math.PI) * 2 - k * 1.15, c.sz + (c.ez - c.sz) * k);
          c.m.rotation.x = time * 20;
          if (k >= 1) {
            c.landed = true;
            c.m.position.y = 0.03;
            c.m.rotation.x = 0;
            onLand(c.ex, c.ez);
          }
        } else {
          c.life += dt;
          if (c.life > 8) { c.active = false; c.m.visible = false; }
        }
      }
      for (const s of smokes) {
        if (!s.active) continue;
        s.t += dt;
        const k = s.t / SMOKE_TIME;
        if (k >= 1) { s.active = false; s.g.visible = false; continue; }
        const grow = Math.min(1, s.t * 3);
        s.mat.opacity = 0.85 * Math.min(1, (1 - k) * 4);
        s.puffs.forEach((m, i) => {
          const o = m.userData.off;
          const sc = (0.9 + 0.25 * Math.sin(time * 1.5 + i)) * grow * (SMOKE_R / 1.9);
          m.scale.setScalar(sc);
          m.position.set(o[0] * grow * 1.3, o[1] + s.t * 0.05, o[2] * grow * 1.3);
        });
      }
    },
  };
  return api;
}
