// 弾：敵の魔弾（InstancedMesh 1つで全部描く。弾幕でも描画は1回）、プレイヤーの飛び道具、斬撃の波（貫通）
// 協力プレイ：敵弾はホストから配られ、各自のブラウザで「自分に当たったか」だけを判定する（他の人の分身には当てない）
// プレイヤーの弾は撃った本人だけが当たり判定をする（local）。他の人の画面では見た目だけ
import * as THREE from 'three';
import { forEachTarget, strike, radiusHit } from './combat.js';
import { hurtPlayer } from './combat.js';
import { shotMult, addDot } from './jobs.js';
import { GAUGE } from './data/jobs.js';

const MAX_SHOTS = 360; // ステージ2の弾幕に足りる数
const MAX_PSHOTS = 120;

export function createProjectiles(game) {
  // ---------------- 敵弾 ----------------
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

  function drawShots() {
    let n = 0;
    for (const s of shots) {
      if (!s.active) continue;
      tmpObj.position.set(s.x, 1.1, s.z);
      tmpObj.rotation.set(0, s.spin, 0);
      tmpObj.scale.setScalar(1);
      tmpObj.updateMatrix();
      shotMesh.setMatrixAt(n, tmpObj.matrix);
      shotMesh.setColorAt(n, tmpColor.setHex(s.color));
      n++;
    }
    shotMesh.count = n;
    shotMesh.instanceMatrix.needsUpdate = true;
    if (shotMesh.instanceColor) shotMesh.instanceColor.needsUpdate = true;
  }
  function killShot(i) {
    shots[i].active = false;
    free.push(i);
  }

  // ---------------- プレイヤーの飛び道具 ----------------
  const pGeo = new THREE.OctahedronGeometry(1, 0);
  const pMesh = new THREE.InstancedMesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_PSHOTS);
  pMesh.frustumCulled = false;
  pMesh.count = 0;
  game.scene.add(pMesh);
  const pshots = [];

  /**
   * プレイヤーの弾。o: { speed, mult, color, size, range, pierce, explode（爆発半径）, wobble, local, gauge }
   * local でなければ見た目だけ（他の人の弾）
   */
  function playerShot(pl, x, z, yaw, o) {
    if (pshots.length >= MAX_PSHOTS) return;
    pshots.push({
      owner: pl, x: x + Math.sin(yaw) * 0.8, z: z + Math.cos(yaw) * 0.8, yaw,
      vx: Math.sin(yaw) * o.speed, vz: Math.cos(yaw) * o.speed, dist: 0, age: 0,
      range: o.range || 24, size: o.size || 0.3, color: o.color || 0xffffff, mult: o.mult || 1,
      pierce: !!o.pierce, explode: o.explode || 0, wobble: !!o.wobble, local: o.local !== false,
      gauge: o.gauge, hit: new Set(), onHit: o.onHit || null, dot: o.dot || null,
    });
  }

  function explodeAt(s) {
    game.fx.burst(s.x, 1, s.z, s.color, 30, { speed: 7, up: 4, life: 0.5, size: 0.2 });
    game.sound.se('slam');
    if (s.local) {
      radiusHit(game, s.owner, s.mult, s.explode, { color: s.color, gauge: GAUGE.gainSkill }, s.x, s.z);
      s.onHit?.(null, s);
    }
  }

  function updatePlayerShots(dt) {
    let n = 0;
    for (let i = pshots.length - 1; i >= 0; i--) {
      const s = pshots[i];
      s.age += dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.dist += Math.hypot(s.vx, s.vz) * dt;
      let dead = s.dist > s.range || game.world.blocked(s.x, s.z, true);
      if (!dead) {
        forEachTarget(game, (e) => {
          if (dead || s.hit.has(e)) return;
          if ((e.pos.x - s.x) ** 2 + (e.pos.z - s.z) ** 2 < (e.radius + s.size + 0.2) ** 2) {
            s.hit.add(e);
            if (s.explode) {
              dead = true;
              return;
            }
            if (s.local) {
              strike(game, s.owner, e, shotMult(s.owner, e, s.mult), { color: s.color, knock: 0.3, gauge: s.gauge });
              if (s.dot) addDot(game, s.owner, e, s.dot);
              s.onHit?.(e, s);
            }
            else game.fx.burst(s.x, 1, s.z, s.color, 4, { speed: 2, life: 0.25 });
            if (!s.pierce) dead = true;
          }
        });
      }
      if (dead) {
        if (s.explode) explodeAt(s);
        pshots.splice(i, 1);
        continue;
      }
      const y = 1.1 + (s.wobble ? Math.sin(s.age * 18) * 0.25 : 0);
      tmpObj.position.set(s.x, y, s.z);
      tmpObj.rotation.set(s.age * 9, s.yaw, 0);
      tmpObj.scale.set(s.size, s.size, s.size * (s.pierce ? 3 : 1.4));
      tmpObj.updateMatrix();
      pMesh.setMatrixAt(n, tmpObj.matrix);
      pMesh.setColorAt(n, tmpColor.setHex(s.color));
      n++;
    }
    pMesh.count = n;
    pMesh.instanceMatrix.needsUpdate = true;
    if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
  }

  // ---------------- 斬撃の波（剣士の E） ----------------
  const waveGeo = new THREE.TorusGeometry(1.1, 0.16, 4, 12, Math.PI);
  waveGeo.rotateX(Math.PI / 2); // 弧が +Z（進行方向）に膨らむ向き
  const waves = [];

  /** o: { mult, range, radius, scale, color, local, melee } */
  function playerWave(pl, yaw, o) {
    const mat = new THREE.MeshBasicMaterial({ color: o.color ?? 0x80d8ff, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(waveGeo, mat);
    mesh.scale.setScalar(o.scale || 1);
    mesh.rotation.y = yaw;
    game.scene.add(mesh);
    waves.push({
      mesh, mat, owner: pl, o, hit: new Set(), dist: 0,
      x: pl.pos.x + Math.sin(yaw) * 0.8, z: pl.pos.z + Math.cos(yaw) * 0.8,
      vx: Math.sin(yaw) * 20, vz: Math.cos(yaw) * 20,
    });
  }

  function update(dt) {
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      if (!s.active) continue;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      s.spin += dt * 8;
      let dead = s.life <= 0 || game.world.blocked(s.x, s.z, true) || (game.inAegis && game.inAegis(s.x, s.z));
      let hit = false;
      if (!dead) {
        // 当たり判定は自分（このブラウザで動かしているプレイヤー）だけ
        for (const p of game.players) {
          if (!p.alive || p.remote) continue;
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
    updatePlayerShots(dt);

    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.x += w.vx * dt;
      w.z += w.vz * dt;
      w.dist += 20 * dt;
      w.mesh.position.set(w.x, 1, w.z);
      forEachTarget(game, (e) => {
        if (w.hit.has(e)) return;
        if (Math.hypot(e.pos.x - w.x, e.pos.z - w.z) < w.o.radius + e.radius) {
          w.hit.add(e);
          if (w.o.local !== false) strike(game, w.owner, e, w.o.mult, { knock: 1.4, color: w.o.color, melee: !!w.o.melee, gauge: 0 });
        }
      });
      if (Math.random() < 0.6) game.fx.burst(w.x, 1, w.z, w.o.color ?? 0x80d8ff, 1, { speed: 1, up: 0.5, life: 0.3, grav: 0 });
      if (w.dist > w.o.range || game.world.blocked(w.x, w.z, true)) {
        game.scene.remove(w.mesh);
        w.mat.dispose();
        waves.splice(i, 1);
      }
    }
  }

  function clear() {
    shots.forEach((s, i) => { if (s.active) killShot(i); });
    drawShots();
    pshots.length = 0;
    pMesh.count = 0;
    for (const w of waves) {
      game.scene.remove(w.mesh);
      w.mat.dispose();
    }
    waves.length = 0;
  }

  /** 敵弾だけ消す（中ボス撃破時） */
  function clearEnemyShots() {
    shots.forEach((s, i) => { if (s.active) killShot(i); });
    drawShots();
  }

  return { enemyShot, playerShot, playerWave, update, clear, clearEnemyShots, activeEnemyShots: () => MAX_SHOTS - free.length };
}
