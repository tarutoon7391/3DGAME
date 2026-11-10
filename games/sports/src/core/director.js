// カメラ演出：目標位置・注視点へのなめらかな追従、画面揺れ、FOV 変化
import * as THREE from 'three';

export function createDirector(camera) {
  const pos = new THREE.Vector3().copy(camera.position);
  const look = new THREE.Vector3(0, 0, -1);
  const targetPos = new THREE.Vector3().copy(pos);
  const targetLook = new THREE.Vector3().copy(look);
  const shakeOff = new THREE.Vector3();
  let stiffness = 6; // 大きいほど速く追従
  let shake = 0;
  let fov = camera.fov;
  let targetFov = camera.fov;

  return {
    /**
     * 目標を設定
     * @param {THREE.Vector3|number[]} p カメラ位置
     * @param {THREE.Vector3|number[]} l 注視点
     * @param {{snap?:boolean, speed?:number}} [o] snap: 即座に移動
     */
    set(p, l, { snap = false, speed } = {}) {
      Array.isArray(p) ? targetPos.set(p[0], p[1], p[2]) : targetPos.copy(p);
      Array.isArray(l) ? targetLook.set(l[0], l[1], l[2]) : targetLook.copy(l);
      if (speed !== undefined) stiffness = speed;
      if (snap) {
        pos.copy(targetPos);
        look.copy(targetLook);
      }
    },
    setFov(v, snap = false) {
      targetFov = v;
      if (snap) fov = v;
    },
    /** 画面揺れ（強さ m 程度） */
    shake(amount) {
      shake = Math.max(shake, amount);
    },
    update(dt) {
      const k = 1 - Math.exp(-stiffness * dt);
      pos.lerp(targetPos, k);
      look.lerp(targetLook, k);
      shake = Math.max(0, shake - dt * 1.8);
      shakeOff.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      camera.position.copy(pos).add(shakeOff);
      camera.lookAt(look);
      fov += (targetFov - fov) * (1 - Math.exp(-8 * dt));
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
    reset() {
      shake = 0;
      stiffness = 6;
      targetFov = 60;
    },
  };
}
