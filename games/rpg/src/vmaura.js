// 一人称の武器にまとわせる魔力のオーラ（魔剣士の魔力付与の間ずっと）。viewmodel.js から使う
import * as THREE from 'three';
import { starTexture } from './fxtex.js';

const N = 26;

/** A：腕（twist に武器が付いている）。order：描く順番 */
export function createBladeAura(A, order) {
  const g = new THREE.Group();
  g.visible = false;
  A.twist.add(g);
  const mats = [];
  const parts = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.SpriteMaterial({ map: starTexture(), color: i % 3 ? 0x9c6bff : 0xe1d0ff, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const sp = new THREE.Sprite(m);
    sp.renderOrder = order + 2;
    g.add(sp);
    mats.push(m);
    parts.push({ sp, m, u: Math.random(), v: Math.random(), w: Math.random(), ph: Math.random() * 6, life: Math.random() });
  }
  let bb = null; // 武器の大きさ（twist から見た箱）
  let forWeapon = null;
  let t = 0;
  const inv = new THREE.Matrix4();
  function measure() {
    forWeapon = A.weapon?.group || null;
    if (!forWeapon) return;
    A.twist.updateMatrixWorld(true);
    inv.copy(A.twist.matrixWorld).invert();
    bb = new THREE.Box3();
    forWeapon.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      bb.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
    });
  }
  return {
    /** on：オーラを出すか。dt：経過秒 */
    update(dt, on) {
      g.visible = on;
      if (!on) return;
      if (A.weapon?.group !== forWeapon || !bb) measure();
      if (!bb) return;
      t += dt;
      for (const o of parts) {
        o.life += dt * (0.9 + o.w);
        if (o.life >= 1) {
          o.life -= 1;
          o.u = Math.random();
          o.v = Math.random();
          o.w = Math.random();
        }
        // 武器の箱の中から湧いて、少し外へ流れて消える
        o.sp.position.set(
          bb.min.x + (bb.max.x - bb.min.x) * o.u + Math.sin(o.ph + t * 3) * 0.02,
          bb.min.y + (bb.max.y - bb.min.y) * o.v + o.life * 0.06,
          bb.min.z + (bb.max.z - bb.min.z) * o.w,
        );
        o.sp.scale.setScalar(0.04 + 0.07 * Math.sin(o.life * Math.PI));
        o.m.opacity = Math.sin(o.life * Math.PI);
      }
    },
    dispose() {
      A.twist.remove(g);
      mats.forEach((m) => m.dispose());
    },
  };
}
