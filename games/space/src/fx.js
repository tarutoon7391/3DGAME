// 演出：星のパーティクル背景・スピード線・爆発パーティクル・エンジン噴射の粒・画面揺れ
import * as THREE from 'three';
import { InstPool } from './pool.js';
import { rand, TAU } from './util.js';

const STAR_N = 1400;
const LINE_N = 60;
const PARTICLE_CAP = 1800;

export function createFx(scene) {
  // ---- 星（Points）。z 方向へ流し、手前に来たら奥へ戻す ----
  const starPos = new Float32Array(STAR_N * 3);
  for (let i = 0; i < STAR_N; i++) {
    starPos[i * 3] = rand(-160, 160);
    starPos[i * 3 + 1] = rand(-100, 100);
    starPos[i * 3 + 2] = rand(-420, 20);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe9ff, size: 0.7, sizeAttenuation: true, fog: false }));
  stars.frustumCulled = false;
  scene.add(stars);

  // ---- スピード線（速度に応じて伸びる細い棒） ----
  const lineMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.06, 0.06, 1),
    new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.3, fog: false, depthWrite: false }),
    LINE_N,
  );
  lineMesh.frustumCulled = false;
  scene.add(lineMesh);
  const lines = [];
  for (let i = 0; i < LINE_N; i++) {
    const a = rand(0, TAU), r = rand(14, 45);
    lines.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.65, z: rand(-300, 20) });
  }
  const dummy = new THREE.Object3D();

  // ---- 爆発などのパーティクル（加算合成の小さな箱） ----
  const parts = new InstPool(
    scene,
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }),
    PARTICLE_CAP,
    () => ({ life: 0, max: 1, size: 1, drag: 1, base: new THREE.Color(), spin: 0 }),
  );

  let shakeAmt = 0;
  const shakeOff = new THREE.Vector3();

  function emit(x, y, z, vx, vy, vz, color, size, life, drag = 1.5) {
    const p = parts.spawn();
    if (!p) return;
    p.pos.set(x, y, z);
    p.vel.set(vx, vy, vz);
    p.base.setHex(color);
    p.color.copy(p.base);
    p.size = size;
    p.life = p.max = life;
    p.drag = drag;
    p.spin = rand(-8, 8);
    p.rot.set(rand(0, TAU), rand(0, TAU), 0);
  }

  /** 爆発：pos から球状に count 個飛ばす。白っぽい芯と指定色を混ぜる */
  function explode(pos, color, count = 24, speed = 18, size = 0.7, life = 0.8) {
    for (let i = 0; i < count; i++) {
      // 球面上のランダムな向き
      const u = rand(-1, 1), a = rand(0, TAU), s = Math.sqrt(1 - u * u);
      const sp = speed * rand(0.25, 1);
      const c = i % 4 === 0 ? 0xfff2c0 : i % 3 === 0 ? 0xff8a30 : color;
      emit(pos.x, pos.y, pos.z, s * Math.cos(a) * sp, s * Math.sin(a) * sp, u * sp, c, size * rand(0.6, 1.3), life * rand(0.6, 1.2));
    }
  }

  /** 小さな火花（被弾・はじき） */
  function spark(pos, color = 0xffffff, count = 5) {
    explode(pos, color, count, 10, 0.3, 0.25);
  }

  /** エンジン噴射の粒（後方 +z へ流れる） */
  function trail(x, y, z, boost) {
    emit(x + rand(-0.15, 0.15), y + rand(-0.15, 0.15), z, rand(-0.6, 0.6), rand(-0.6, 0.6), boost ? 40 : 22, boost ? 0x9fdcff : 0xff9a3c, boost ? 0.3 : 0.2, 0.18, 0.5);
  }

  /** 画面揺れ（強い方を採用） */
  function shake(a) {
    shakeAmt = Math.max(shakeAmt, a);
  }

  /** 毎フレーム。speed は前進速度（背景の流れる速さ） */
  function update(dt, speed) {
    // 星
    const d = speed * dt;
    for (let i = 2; i < starPos.length; i += 3) {
      starPos[i] += d;
      if (starPos[i] > 20) starPos[i] -= 440;
    }
    starGeo.attributes.position.needsUpdate = true;

    // スピード線
    const len = Math.max(0.5, speed * 0.12);
    for (let i = 0; i < LINE_N; i++) {
      const l = lines[i];
      l.z += d * 1.2;
      if (l.z > 20) l.z -= 320;
      dummy.position.set(l.x, l.y, l.z);
      dummy.scale.set(1, 1, len);
      dummy.updateMatrix();
      lineMesh.setMatrixAt(i, dummy.matrix);
    }
    lineMesh.instanceMatrix.needsUpdate = true;
    lineMesh.material.opacity = Math.min(0.55, 0.12 + speed * 0.0025);

    // パーティクル
    const a = parts.alive;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        parts.kill(p);
        continue;
      }
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      p.pos.z += speed * 0.15 * dt;
      p.rot.x += p.spin * dt;
      p.rot.y += p.spin * 0.7 * dt;
      const f = p.life / p.max;
      p.scale.setScalar(p.size * (0.3 + 0.7 * f));
      p.color.copy(p.base).multiplyScalar(f);
    }
    parts.sync();

    // 画面揺れ（減衰）
    shakeAmt = Math.max(0, shakeAmt - dt * 2.2);
    const s = shakeAmt * shakeAmt;
    shakeOff.set(rand(-1, 1) * s, rand(-1, 1) * s, 0);
  }

  function clear() {
    parts.clear();
    shakeAmt = 0;
    shakeOff.set(0, 0, 0);
  }

  /** 星空の表示切替（母艦内部では消す） */
  function setStars(on) {
    stars.visible = on;
  }

  return { setStars, explode, spark, trail, shake, update, clear, shakeOff };
}
