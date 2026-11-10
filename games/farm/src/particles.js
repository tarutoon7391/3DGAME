// パーティクル：土ぼこり・水しぶき・収穫のきらめき・ハート（InstancedMesh のプール）
import * as THREE from 'three';

const MAX = 240;

export function createParticles(scene) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
  mesh.frustumCulled = false;
  mesh.setColorAt(0, new THREE.Color());
  mesh.count = 0;
  scene.add(mesh);
  // 各粒の状態（固定長配列を使い回す）
  const P = Array.from({ length: MAX }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 9, s: 1, color: new THREE.Color() }));
  let cursor = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();

  return {
    /** opts: { n, speed, up, gravity, life, size } */
    burst(x, y, z, color, { n = 10, speed = 1.5, up = 2, gravity = 9, life = 0.6, size = 1 } = {}) {
      for (let k = 0; k < n; k++) {
        const p = P[cursor];
        cursor = (cursor + 1) % MAX;
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.4 + Math.random() * 0.6);
        Object.assign(p, { life: life * (0.7 + Math.random() * 0.6), x, y, z, vx: Math.cos(a) * sp, vy: up * (0.5 + Math.random() * 0.8), vz: Math.sin(a) * sp, g: gravity, s: size });
        p.max = p.life;
        p.color.set(color);
      }
    },
    update(dt) {
      let n = 0;
      for (const p of P) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.vy -= p.g * dt;
        p.x += p.vx * dt;
        p.y = Math.max(0.03, p.y + p.vy * dt);
        p.z += p.vz * dt;
        const s = p.s * Math.max(0, p.life / p.max);
        mesh.setMatrixAt(n, m4.compose(v.set(p.x, p.y, p.z), q, sc.set(s, s, s)));
        mesh.setColorAt(n, p.color);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
