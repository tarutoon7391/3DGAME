// プレイヤー：見た目・移動・当たり判定・道具の振りアニメ
import * as THREE from 'three';
import { makePerson, mat, BOUNDS } from './world.js';

const RADIUS = 0.32;

export function createPlayer(scene, colliders) {
  const mesh = makePerson(0x3f6fb5, 0xffcc80, 0xe8c26a);
  scene.add(mesh);
  const { armL, armR, legL, legR, body } = mesh.userData;

  // 手に持つ道具（道具ごとに形を切り替える）
  const held = new THREE.Group();
  armR.add(held);
  held.position.set(0, -0.5, 0.05);
  const toolMeshes = [
    // クワ
    group([[0.05, 0.05, 0.9, 0x8d6e63, 0, 0, 0.3], [0.25, 0.05, 0.12, 0x90a4ae, 0, 0, 0.75]]),
    // ジョウロ
    group([[0.25, 0.25, 0.3, 0x4fc3f7, 0, -0.1, 0.1], [0.05, 0.05, 0.3, 0x4fc3f7, 0, 0, 0.35]]),
    // タネ袋
    group([[0.22, 0.28, 0.18, 0xd7ccc8, 0, -0.1, 0.1]]),
    // カマ
    group([[0.05, 0.05, 0.4, 0x8d6e63, 0, 0, 0.15], [0.05, 0.3, 0.06, 0xcfd8dc, 0, 0.12, 0.35]]),
    // エサ
    group([[0.3, 0.2, 0.25, 0xffe082, 0, -0.1, 0.1]]),
  ];
  toolMeshes.forEach((m) => held.add(m));

  const pos = mesh.position;
  pos.set(0, 0, 0);
  let facing = 0; // ラジアン（0 = +z 向き）
  let walkT = 0;
  let swingT = 0;
  const dir = new THREE.Vector2();

  function resolve() {
    pos.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, pos.x));
    pos.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, pos.z));
    for (const c of colliders) {
      const nx = Math.min(c.maxX, Math.max(c.minX, pos.x));
      const nz = Math.min(c.maxZ, Math.max(c.minZ, pos.z));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < RADIUS * RADIUS) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * RADIUS;
          pos.z = nz + (dz / d) * RADIUS;
        } else {
          // 中心が箱の中：一番近い辺へ押し出す
          const push = [[c.minX - RADIUS - pos.x, 0], [c.maxX + RADIUS - pos.x, 0], [0, c.minZ - RADIUS - pos.z], [0, c.maxZ + RADIUS - pos.z]]
            .sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]))[0];
          pos.x += push[0];
          pos.z += push[1];
        }
      }
    }
  }

  return {
    mesh,
    pos,
    get facing() { return facing; },
    setPose(x, z, f = 0) {
      pos.set(x, 0, z);
      facing = f;
      mesh.rotation.y = f;
    },
    /** 入力ベクトル (mx, mz)（画面基準で正規化済み）で移動 */
    update(dt, mx, mz, speed) {
      dir.set(mx, mz);
      const moving = dir.lengthSq() > 0.01;
      if (moving) {
        dir.normalize();
        pos.x += dir.x * speed * dt;
        pos.z += dir.y * speed * dt;
        resolve();
        const target = Math.atan2(dir.x, dir.y);
        let diff = target - facing;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        facing += diff * Math.min(1, dt * 14);
        walkT += dt * speed * 2.2;
      } else {
        walkT += (Math.round(walkT / Math.PI) * Math.PI - walkT) * Math.min(1, dt * 10);
      }
      mesh.rotation.y = facing;
      const sw = Math.sin(walkT);
      legL.rotation.x = sw * 0.6;
      legR.rotation.x = -sw * 0.6;
      armL.rotation.x = -sw * 0.5;
      body.position.y = 0.8 + Math.abs(Math.cos(walkT)) * 0.04;
      // 道具の振り
      if (swingT > 0) {
        swingT = Math.max(0, swingT - dt * 3.5);
        const p = 1 - swingT;
        armR.rotation.x = -2.2 * Math.sin(Math.min(1, p * 1.6) * Math.PI) - 0.2;
      } else {
        armR.rotation.x = sw * 0.5 - 0.3;
      }
      return moving;
    },
    swing() { swingT = 1; },
    setTool(i) { toolMeshes.forEach((m, k) => { m.visible = k === i; }); },
  };
}

function group(parts) {
  const g = new THREE.Group();
  for (const [w, h, d, color, x, y, z] of parts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  }
  g.rotation.x = Math.PI / 2;
  return g;
}
