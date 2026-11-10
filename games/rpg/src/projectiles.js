// 弾：敵の魔弾（オブジェクトプール）と、プレイヤーの衝撃波（貫通）
import * as THREE from 'three';
import { SKILLS } from './data/levels.js';
import { hurtPlayer, forEachTarget, strike } from './combat.js';

const MAX_SHOTS = 120;

export function createProjectiles(game) {
  const shotGeo = new THREE.IcosahedronGeometry(0.28, 0);
  const shotMats = new Map();
  const shots = [];
  for (let i = 0; i < MAX_SHOTS; i++) {
    const m = new THREE.Mesh(shotGeo, shotMat(0xffa726));
    m.visible = false;
    game.scene.add(m);
    shots.push({ mesh: m, active: false, x: 0, z: 0, vx: 0, vz: 0, life: 0, atk: 0, mult: 1 });
  }
  function shotMat(color) {
    let m = shotMats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color });
      shotMats.set(color, m);
    }
    return m;
  }

  /** 敵の弾（yaw 方向へ直進） */
  function enemyShot(x, z, yaw, speed, atk, color = 0xffa726, mult = 1) {
    const s = shots.find((o) => !o.active);
    if (!s) return;
    s.active = true;
    s.x = x;
    s.z = z;
    s.vx = Math.sin(yaw) * speed;
    s.vz = Math.cos(yaw) * speed;
    s.life = 4;
    s.atk = atk;
    s.mult = mult;
    s.color = color;
    s.mesh.material = shotMat(color);
    s.mesh.visible = true;
    s.mesh.position.set(x, 1.1, z);
  }

  // 衝撃波（三日月形の板）
  const waveGeo = new THREE.TorusGeometry(1.1, 0.16, 4, 12, Math.PI);
  waveGeo.rotateX(Math.PI / 2); // 弧が +Z（進行方向）に膨らむ向き
  const waveMat = new THREE.MeshBasicMaterial({ color: 0x80d8ff, transparent: true, opacity: 0.85 });
  const waves = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(waveGeo, waveMat);
    m.visible = false;
    game.scene.add(m);
    waves.push({ mesh: m, active: false, hit: new Set() });
  }

  function playerWave(pl, yaw) {
    const w = waves.find((o) => !o.active);
    if (!w) return;
    const sk = SKILLS.wave;
    w.active = true;
    w.owner = pl;
    w.x = pl.pos.x + Math.sin(yaw) * 0.8;
    w.z = pl.pos.z + Math.cos(yaw) * 0.8;
    w.vx = Math.sin(yaw) * sk.speed;
    w.vz = Math.cos(yaw) * sk.speed;
    w.dist = 0;
    w.hit.clear();
    w.mesh.visible = true;
    w.mesh.rotation.y = yaw;
    w.mesh.position.set(w.x, 1, w.z);
  }

  function update(dt) {
    for (const s of shots) {
      if (!s.active) continue;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      s.mesh.position.set(s.x, 1.1, s.z);
      s.mesh.rotation.y += dt * 8;
      let dead = s.life <= 0 || game.world.blocked(s.x, s.z, true);
      if (!dead) {
        for (const p of game.players) {
          if (!p.alive) continue;
          if ((p.pos.x - s.x) ** 2 + (p.pos.z - s.z) ** 2 < (p.radius + 0.3) ** 2) {
            if (hurtPlayer(game, p, s.atk, s.mult, s.x - s.vx, s.z - s.vz)) dead = true;
          }
        }
      }
      if (dead) {
        s.active = false;
        s.mesh.visible = false;
        game.fx.burst(s.x, 1.1, s.z, s.color, 5, { speed: 2, up: 2, life: 0.3 });
      }
    }
    const sk = SKILLS.wave;
    for (const w of waves) {
      if (!w.active) continue;
      w.x += w.vx * dt;
      w.z += w.vz * dt;
      w.dist += sk.speed * dt;
      w.mesh.position.set(w.x, 1, w.z);
      forEachTarget(game, (e) => {
        if (w.hit.has(e)) return;
        if (Math.hypot(e.pos.x - w.x, e.pos.z - w.z) < sk.radius + e.radius) {
          w.hit.add(e);
          strike(game, w.owner, e, sk.mult, { knock: 1.4, color: 0x80d8ff });
        }
      });
      if (Math.random() < 0.6) game.fx.burst(w.x, 1, w.z, 0x80d8ff, 1, { speed: 1, up: 0.5, life: 0.3, grav: 0 });
      if (w.dist > sk.range || game.world.blocked(w.x, w.z, true)) {
        w.active = false;
        w.mesh.visible = false;
      }
    }
  }

  function clear() {
    shots.forEach((s) => { s.active = false; s.mesh.visible = false; });
    waves.forEach((w) => { w.active = false; w.mesh.visible = false; });
  }

  return { enemyShot, playerWave, update, clear };
}
