// 弾：自機弾・敵弾ともに InstancedMesh プールで管理（敵弾は最大 600 発）
import * as THREE from 'three';
import { InstPool } from './pool.js';

const PLAYER_CAP = 320;
const ENEMY_CAP = 600;

export function createBullets(scene) {
  // 自機弾：細長いカプセル（+z 方向を速度に合わせる）
  const pg = new THREE.CapsuleGeometry(0.16, 1.8, 2, 6);
  pg.rotateX(Math.PI / 2);
  const player = new InstPool(scene, pg, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), PLAYER_CAP, () => ({
    prev: new THREE.Vector3(),
    life: 0,
    dmg: 1,
  }));

  // 敵弾：芯の球＋同じ位置に大きめの加算合成の光輪
  const enemy = new InstPool(scene, new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), ENEMY_CAP, () => ({
    life: 0,
  }));
  const halo = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.85, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    ENEMY_CAP,
  );
  halo.frustumCulled = false;
  halo.setColorAt(0, new THREE.Color(1, 1, 1));
  halo.count = 0;
  scene.add(halo);

  /** 自機弾を撃つ（dx,dy,dz は正規化済みの向き） */
  function firePlayer(x, y, z, dx, dy, dz, speed, color, dmg = 1) {
    const b = player.spawn();
    if (!b) return;
    b.pos.set(x, y, z);
    b.prev.copy(b.pos);
    b.vel.set(dx, dy, dz).multiplyScalar(speed);
    b.alignToVel = true;
    b.life = 1.4;
    b.dmg = dmg;
    b.color.setHex(color);
  }

  /** 敵弾を撃つ（向きは正規化していなくてよい） */
  function fireEnemy(x, y, z, dx, dy, dz, speed, color = 0xff4fa0) {
    const b = enemy.spawn();
    if (!b) return;
    const len = Math.hypot(dx, dy, dz) || 1;
    b.pos.set(x, y, z);
    b.vel.set(dx / len, dy / len, dz / len).multiplyScalar(speed);
    b.life = 9;
    b.color.setHex(color);
  }

  function update(dt) {
    const pa = player.alive;
    for (let i = 0; i < pa.length; i++) {
      const b = pa[i];
      if (!b.alive) continue;
      b.prev.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      b.life -= dt;
      if (b.life <= 0 || b.pos.z < -280) player.kill(b);
    }
    const ea = enemy.alive;
    for (let i = 0; i < ea.length; i++) {
      const b = ea[i];
      if (!b.alive) continue;
      b.pos.addScaledVector(b.vel, dt);
      b.life -= dt;
      const p = b.pos;
      if (b.life <= 0 || p.z > 6 || p.x > 80 || p.x < -80 || p.y > 60 || p.y < -60) enemy.kill(b);
    }
    sync();
  }

  function sync() {
    player.sync();
    enemy.sync();
    // 光輪は芯と同じ行列・色を使う（スケールはジオメトリ側で大きくしてある）
    halo.instanceMatrix.array.set(enemy.mesh.instanceMatrix.array.subarray(0, enemy.mesh.count * 16));
    halo.instanceColor.array.set(enemy.mesh.instanceColor.array.subarray(0, enemy.mesh.count * 3));
    halo.count = enemy.mesh.count;
    halo.instanceMatrix.needsUpdate = true;
    halo.instanceColor.needsUpdate = true;
  }

  /** 敵弾を全部消す。each(pos) は消える弾ごとに呼ばれる（演出用）。消した数を返す */
  function clearEnemy(each) {
    const ea = enemy.alive;
    let n = 0;
    for (let i = 0; i < ea.length; i++) {
      if (!ea[i].alive) continue;
      if (each) each(ea[i].pos);
      ea[i].alive = false;
      n++;
    }
    sync();
    return n;
  }

  function clearAll() {
    player.clear();
    clearEnemy();
  }

  return { player, enemy, firePlayer, fireEnemy, update, clearEnemy, clearAll };
}
