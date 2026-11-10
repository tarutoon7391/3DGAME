// 雑魚敵と隕石：種類ごとに InstancedMesh プール。行動は種類ごとの関数
import * as THREE from 'three';
import { InstPool } from './pool.js';
import { merge } from './env.js';
import { ENEMY_TYPES } from './data/enemies.js';
import { rand, TAU } from './util.js';

// ---- 見た目（+z が自機の方向＝機首） ----
const GEOS = {
  straight() {
    const body = new THREE.ConeGeometry(0.9, 3, 6);
    body.rotateX(Math.PI / 2);
    const wing = new THREE.BoxGeometry(4, 0.15, 1.2);
    wing.translate(0, 0, -0.6);
    const fin = new THREE.BoxGeometry(0.15, 1.2, 1);
    fin.translate(0, 0.5, -1);
    return merge([body, wing, fin]);
  },
  snake() {
    const body = new THREE.OctahedronGeometry(1.2, 0);
    body.scale(1, 0.5, 1.4);
    const l = new THREE.ConeGeometry(0.4, 1.8, 4);
    l.rotateX(-Math.PI / 2);
    const r = l.clone();
    l.translate(-1.5, 0, -0.5);
    r.translate(1.5, 0, -0.5);
    return merge([body, l, r]);
  },
  sniper() {
    const body = new THREE.SphereGeometry(1.2, 10, 8);
    const barrel = new THREE.CylinderGeometry(0.25, 0.3, 2.4, 6);
    barrel.rotateX(Math.PI / 2);
    barrel.translate(0, 0, 1.7);
    const ring = new THREE.TorusGeometry(1.7, 0.18, 4, 12);
    return merge([body, barrel, ring]);
  },
  rammer() {
    const body = new THREE.ConeGeometry(1, 4, 5);
    body.rotateX(Math.PI / 2);
    const s1 = new THREE.ConeGeometry(0.35, 1.6, 4);
    s1.rotateZ(Math.PI / 2);
    const s2 = s1.clone();
    s1.translate(-1.2, 0, -0.8);
    s2.rotateZ(Math.PI);
    s2.translate(1.2, 0, -0.8);
    return merge([body, s1, s2]);
  },
  rock: () => new THREE.IcosahedronGeometry(1, 0),
  ironRock: () => new THREE.DodecahedronGeometry(1, 0),
};

const tmp = new THREE.Vector3();
const WHITE = 0xffffff;

// ---- 行動（e: 敵、c: ゲーム側の文脈） ----
const BEHAVE = {
  straight(e, dt, c) {
    e.vel.set(e.drift, 0, e.def.speed);
    if (e.state === 0 && e.pos.z > -70) {
      e.state = 1;
      if (Math.random() < 0.45 * c.diff.fire) c.fireAimed(e.pos, 0.9, 0, 1, 0x7fd3ff);
    }
  },
  snake(e, dt, c) {
    const d = e.def;
    e.vel.set(Math.cos(e.t * d.freq + e.phase) * d.amp * d.freq, 0, d.speed);
    e.fireT -= dt;
    if (e.fireT <= 0 && e.pos.z < -25 && e.pos.z > -140) {
      e.fireT = d.fireEvery / c.diff.fire;
      c.fireAimed(e.pos, 0.9, 0, 1, 0x9dff7f);
    }
  },
  sniper(e, dt, c) {
    const d = e.def;
    if (e.state === 0) {
      // 減速しながら停止位置へ
      e.vel.set(0, 0, Math.max(5, (d.holdZ - e.pos.z) * 1.8));
      if (e.pos.z >= d.holdZ - 0.5) {
        e.state = 1;
        e.st = 0;
      }
    } else if (e.state === 1) {
      e.st += dt;
      e.vel.set(Math.sin(e.t * 1.3 + e.phase) * 2, Math.cos(e.t) * 1.2, 0);
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = d.fireEvery / c.diff.fire;
        c.fireAimed(e.pos, 1, c.diff.level >= 2 ? 0.1 : 0, c.diff.level >= 2 ? 3 : 1, 0xffb84d);
      }
      if (e.st > d.hold) e.state = 2;
    } else {
      e.vel.set(0, 6, -50); // 奥へ退却
    }
    // 自機の方を向く
    tmp.copy(c.target).sub(e.pos);
    if (e.state < 2) e.vel.addScaledVector(tmp.normalize(), 0.001);
  },
  rammer(e, dt, c) {
    const d = e.def;
    if (e.state === 0) {
      e.vel.set(0, 0, d.speed);
      if (e.pos.z >= d.lockZ) {
        e.state = 1;
        e.st = 0;
        c.sfx.lock();
      }
    } else if (e.state === 1) {
      // 予告：止まって赤く点滅
      e.st += dt;
      tmp.copy(c.target).sub(e.pos).normalize();
      e.vel.copy(tmp).multiplyScalar(0.001);
      if (e.st > d.lockTime) {
        e.state = 2;
        e.vel.copy(tmp).multiplyScalar(d.dash);
      }
    }
  },
  rock(e, dt) {
    e.rot.x += e.spin.x * dt;
    e.rot.y += e.spin.y * dt;
  },
  ironRock(e, dt) {
    e.rot.x += e.spin.x * dt;
    e.rot.y += e.spin.y * dt;
  },
};

export function createEnemies(scene) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, metalness: 0.3, roughness: 0.6, emissive: 0x151515 });
  const pools = {};
  const list = [];
  for (const key of Object.keys(ENEMY_TYPES)) {
    const def = ENEMY_TYPES[key];
    const m = key === 'ironRock' ? new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, metalness: 0.8, roughness: 0.35 }) : mat.clone();
    const pool = new InstPool(scene, GEOS[key](), m, def.cap, () => ({
      type: key, def, hp: 0, t: 0, state: 0, st: 0, phase: 0, fireT: 0, flash: 0,
      group: null, drift: 0, radius: 1, spin: new THREE.Vector3(),
    }));
    pool.mesh.castShadow = true;
    pools[key] = pool;
    list.push(pool);
  }
  mat.dispose();

  /** 敵を出す。group は編隊（全滅でアイテムを落とす判定用） */
  function spawn(type, x, y, z, group = null) {
    const pool = pools[type];
    const e = pool && pool.spawn();
    if (!e) return null;
    const d = e.def;
    e.hp = d.hp;
    e.t = 0;
    e.state = 0;
    e.st = 0;
    e.phase = rand(0, TAU);
    e.fireT = rand(0.6, 1.6);
    e.flash = 0;
    e.group = group;
    e.drift = 0;
    e.radius = d.radius;
    e.pos.set(x, y, z);
    e.color.setHex(d.color);
    if (d.size) {
      // 隕石：大きさ・回転・漂いをランダムに
      const s = d.size * rand(0.85, 1.35);
      e.scale.setScalar(s);
      e.radius = d.radius * (s / d.size);
      e.spin.set(rand(-1.5, 1.5), rand(-1.5, 1.5), 0);
      e.rot.set(rand(0, TAU), rand(0, TAU), 0);
      e.vel.set(rand(-2, 2), rand(-1.5, 1.5), d.speed);
    } else {
      e.alignToVel = true;
      e.vel.set(0, 0, d.speed);
      if (type === 'straight') e.drift = -x * 0.08;
    }
    return e;
  }

  /** 全敵の更新。c = { diff, target(自機位置), fireAimed, sfx } */
  function update(dt, c) {
    for (let p = 0; p < list.length; p++) {
      const pool = list[p];
      const a = pool.alive;
      for (let i = 0; i < a.length; i++) {
        const e = a[i];
        if (!e.alive) continue;
        e.t += dt;
        BEHAVE[e.type](e, dt, c);
        e.pos.addScaledVector(e.vel, dt);
        // 色：被弾の白フラッシュ／突撃の予告点滅
        if (e.flash > 0) {
          e.flash -= dt;
          e.color.setHex(WHITE);
        } else if (e.type === 'rammer' && e.state === 1) {
          e.color.setHex(Math.floor(e.st * 14) % 2 ? 0xff1030 : WHITE);
        } else {
          e.color.setHex(e.def.color);
        }
        const q = e.pos;
        if (q.z > 16 || q.z < -240 || Math.abs(q.x) > 70 || Math.abs(q.y) > 50) pool.kill(e);
      }
      pool.sync();
    }
  }

  /** 画面内の敵すべてに fn(e) */
  function forEach(fn) {
    for (let p = 0; p < list.length; p++) {
      const a = list[p].alive;
      for (let i = 0; i < a.length; i++) if (a[i].alive) fn(a[i]);
    }
  }

  function clear() {
    list.forEach((p) => p.clear());
  }

  function kill(e) {
    pools[e.type].kill(e);
  }

  return { spawn, update, forEach, clear, kill, list };
}
