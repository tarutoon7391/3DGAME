// 斜め見下ろしの三人称カメラ（Q/E 回転・ホイールでズーム）
import { VIEW } from './config.js';

export function createView(camera) {
  const st = { yaw: 0, dist: VIEW.dist, tx: 0, tz: 0, curDist: VIEW.dist };

  return {
    get yaw() { return st.yaw; },
    /** 移動の基準：前方ベクトル (fx,fz) と右ベクトル (rx,rz) */
    axes() {
      const s = Math.sin(st.yaw);
      const c = Math.cos(st.yaw);
      return { fx: -s, fz: -c, rx: c, rz: -s };
    },
    snap(x, z) {
      st.tx = x;
      st.tz = z;
      st.yaw = 0;
      st.dist = st.curDist = VIEW.dist;
    },
    update(dt, input, x, z, shake) {
      if (input.isDown('KeyQ')) st.yaw -= VIEW.turn * dt;
      if (input.isDown('KeyE')) st.yaw += VIEW.turn * dt;
      if (input.mouse.wheel) st.dist = Math.min(VIEW.maxDist, Math.max(VIEW.minDist, st.dist + input.mouse.wheel * 1.2));
      st.curDist += (st.dist - st.curDist) * Math.min(1, dt * 8);
      const k = Math.min(1, dt * 6);
      st.tx += (x - st.tx) * k;
      st.tz += (z - st.tz) * k;
      const h = Math.sin(VIEW.pitch) * st.curDist;
      const flat = Math.cos(VIEW.pitch) * st.curDist;
      camera.position.set(st.tx + Math.sin(st.yaw) * flat + shake.x, h + shake.y, st.tz + Math.cos(st.yaw) * flat + shake.z);
      camera.lookAt(st.tx, 0.5, st.tz);
    },
  };
}
