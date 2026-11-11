// 弾：敵の魔弾（InstancedMesh 1つで全部描く。弾幕でも描画は1回）と、プレイヤーの衝撃波（貫通）
import * as THREE from 'three';
import { SKILLS } from './data/player.js';
import { hurtPlayer, forEachTarget, strike } from './combat.js';

const MAX_SHOTS = 360; // ステージ4の弾幕に足りる数

export function createProjectiles(game) {
  const shotGeo = new THREE.IcosahedronGeometry(0.28, 0);
  const shotMesh = new THREE.InstancedMesh(shotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_SHOTS);
  shotMesh.frustumCulled = false; // 弾は部屋じゅうに散るので個別の判定はしない
  shotMesh.count = 0;
  game.scene.add(shotMesh);
  const tmpColor = new THREE.Color();
  const tmpObj = new THREE.Object3D();
  const shots = [];
  for (let i = 0; i < MAX_SHOTS; i++) shots.push({ active: false, x: 0, z: 0, vx: 0, vz: 0, life: 0, frac: 0, color: 0, spin: 0 });
  /** 空き番号の山（find で毎回探さない） */
  const free = [];
  for (let i = MAX_SHOTS - 1; i >= 0; i--) free.push(i);

  /** 敵の弾（yaw 方向へ直進）。frac は当たったときに削る最大 HP の割合 */
  function enemyShot(x, z, yaw, speed, frac, color = 0xffa726) {
    if (!free.length) return;
    const s = shots[free.pop()];
    s.active = true;
    s.x = x;
    s.z = z;
    s.vx = Math.sin(yaw) * speed;
    s.vz = Math.cos(yaw) * speed;
    s.life = 4;
    s.frac = frac;
    s.color = color;
    s.spin = Math.random() * 6;
  }

  /** 生きている弾を詰めて InstancedMesh に書き込む */
  function drawShots() {
    let n = 0;
    for (const s of shots) {
      if (!s.active) continue;
      tmpObj.position.set(s.x, 1.1, s.z);
      tmpObj.rotation.set(0, s.spin, 0);
      tmpObj.updateMatrix();
      shotMesh.setMatrixAt(n, tmpObj.matrix);
      shotMesh.setColorAt(n, tmpColor.setHex(s.color));
      n++;
    }
    shotMesh.count = n;
    shotMesh.instanceMatrix.needsUpdate = true;
    if (shotMesh.instanceColor) shotMesh.instanceColor.needsUpdate = true;
  }
  /** 弾を消す（i は shots の番号） */
  function killShot(i) {
    shots[i].active = false;
    free.push(i);
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
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      if (!s.active) continue;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      s.spin += dt * 8;
      let dead = s.life <= 0 || game.world.blocked(s.x, s.z, true);
      let hit = false;
      if (!dead) {
        for (const p of game.players) {
          if (!p.alive) continue;
          if ((p.pos.x - s.x) ** 2 + (p.pos.z - s.z) ** 2 < (p.radius + 0.3) ** 2) {
            if (hurtPlayer(game, p, s.frac, s.x - s.vx, s.z - s.vz)) dead = hit = true;
          }
        }
      }
      if (dead) {
        killShot(i);
        // 弾幕が壁で一斉に消えるとパーティクルが多すぎるので、壁で消えるときは間引く
        if (hit || Math.random() < 0.25) game.fx.burst(s.x, 1.1, s.z, s.color, 5, { speed: 2, up: 2, life: 0.3 });
      }
    }
    drawShots();
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
    shots.forEach((s, i) => { if (s.active) killShot(i); });
    drawShots();
    waves.forEach((w) => { w.active = false; w.mesh.visible = false; });
  }

  return { enemyShot, playerWave, update, clear };
}
