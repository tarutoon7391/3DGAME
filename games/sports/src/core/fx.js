// パーティクル（InstancedMesh のプール）。土ぼこり・紙吹雪・打撃の火花など
import * as THREE from 'three';

const MAX = 400;

export function createFx(scene) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);

  // 各粒の状態は型付き配列で持ち、毎フレーム new しない
  const p = new Float32Array(MAX * 3);
  const v = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const maxLife = new Float32Array(MAX);
  const size = new Float32Array(MAX);
  const grav = new Float32Array(MAX);
  const spin = new Float32Array(MAX);
  let alive = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const t = new THREE.Vector3();
  const c = new THREE.Color();

  /**
   * 粒を出す
   * @param {{x:number,y:number,z:number}} at
   * @param {{count?:number, color?:number|number[], speed?:number, up?:number, size?:number, life?:number, gravity?:number}} o
   */
  function burst(at, { count = 12, color = 0xffffff, speed = 3, up = 2, size: sz = 0.08, life: lf = 0.8, gravity = 9 } = {}) {
    const colors = Array.isArray(color) ? color : [color];
    for (let n = 0; n < count && alive < MAX; n++) {
      const i = alive++;
      p[i * 3] = at.x;
      p[i * 3 + 1] = at.y;
      p[i * 3 + 2] = at.z;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      v[i * 3] = Math.cos(a) * r;
      v[i * 3 + 1] = up * (0.4 + Math.random());
      v[i * 3 + 2] = Math.sin(a) * r;
      maxLife[i] = life[i] = lf * (0.6 + Math.random() * 0.6);
      size[i] = sz * (0.6 + Math.random() * 0.8);
      grav[i] = gravity;
      spin[i] = Math.random() * 10;
      c.setHex(colors[(Math.random() * colors.length) | 0]);
      mesh.setColorAt(i, c);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** 粒 i を最後の粒で上書きして詰める */
  function kill(i) {
    const j = --alive;
    if (i === j) return;
    for (let k = 0; k < 3; k++) {
      p[i * 3 + k] = p[j * 3 + k];
      v[i * 3 + k] = v[j * 3 + k];
    }
    life[i] = life[j];
    maxLife[i] = maxLife[j];
    size[i] = size[j];
    grav[i] = grav[j];
    spin[i] = spin[j];
    mesh.getColorAt(j, c);
    mesh.setColorAt(i, c);
  }

  function update(dt) {
    for (let i = alive - 1; i >= 0; i--) {
      life[i] -= dt;
      if (life[i] <= 0) {
        kill(i);
        continue;
      }
      v[i * 3 + 1] -= grav[i] * dt;
      p[i * 3] += v[i * 3] * dt;
      p[i * 3 + 1] += v[i * 3 + 1] * dt;
      p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (p[i * 3 + 1] < 0.02) {
        p[i * 3 + 1] = 0.02;
        v[i * 3 + 1] *= -0.3;
        v[i * 3] *= 0.7;
        v[i * 3 + 2] *= 0.7;
      }
    }
    for (let i = 0; i < alive; i++) {
      const k = life[i] / maxLife[i];
      const sc = size[i] * Math.min(1, k * 2.5);
      e.set(spin[i] * k, spin[i] * 1.3 * k, 0);
      q.setFromEuler(e);
      t.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      s.set(sc, sc, sc);
      m4.compose(t, q, s);
      mesh.setMatrixAt(i, m4);
    }
    mesh.count = alive;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function clear() {
    alive = 0;
    mesh.count = 0;
  }

  return { burst, update, clear, mesh };
}

/** 紙吹雪の色 */
export const CONFETTI = [0xff6b6b, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xf72585, 0xffffff];
