// 三人称カメラ：マウスで回転（ポインタロック中）、ホイールで距離。壁の手前に寄る簡易めり込み防止
import { clamp } from './util.js';

export function createCameraRig(camera) {
  const rig = {
    yaw: 0, // カメラはターゲットから (sin yaw, cos yaw) 方向の後ろにいる
    pitch: 0.42,
    dist: 8,
    curDist: 8,
    sens: 0.0026,
    /** 入力をデータで受け取る：{dx, dy, wheel} */
    input({ dx = 0, dy = 0, wheel = 0 }) {
      rig.yaw -= dx * rig.sens;
      rig.pitch = clamp(rig.pitch + dy * rig.sens, 0.08, 1.2);
      rig.dist = clamp(rig.dist + wheel * 0.8, 4, 14);
    },
    /** カメラの正面方向（地面上）のヨー。正面ベクトルは (sin, cos) */
    forwardYaw() {
      return Math.atan2(-Math.sin(rig.yaw), -Math.cos(rig.yaw));
    },
    /** スティック入力（右・前）を地面上のベクトルに */
    toWorld(right, fwd) {
      const fx = -Math.sin(rig.yaw);
      const fz = -Math.cos(rig.yaw);
      const rx = Math.cos(rig.yaw);
      const rz = -Math.sin(rig.yaw);
      return { x: rx * right + fx * fwd, z: rz * right + fz * fwd };
    },
    /** 背後に回り込む（エリア遷移時） */
    snapBehind(yaw) {
      rig.yaw = yaw + Math.PI;
    },
    update(dt, target, world, shake) {
      const tx = target.x;
      const ty = target.y + 1.6;
      const tz = target.z;
      const cp = Math.cos(rig.pitch);
      const dirX = Math.sin(rig.yaw) * cp;
      const dirY = Math.sin(rig.pitch);
      const dirZ = Math.cos(rig.yaw) * cp;
      // 壁に当たる手前まで縮める
      let want = rig.dist;
      for (let s = 0.6; s <= rig.dist; s += 0.4) {
        if (world && world.blocked(tx + dirX * s, tz + dirZ * s, true) && ty + dirY * s < 6.5) {
          want = Math.max(1.5, s - 0.5);
          break;
        }
      }
      rig.curDist += (want - rig.curDist) * Math.min(1, dt * (want < rig.curDist ? 20 : 5));
      const d = rig.curDist;
      camera.position.set(tx + dirX * d + shake.x, Math.max(0.4, ty + dirY * d) + shake.y, tz + dirZ * d + shake.z);
      camera.lookAt(tx + shake.x * 0.5, ty + shake.y * 0.5, tz + shake.z * 0.5);
    },
  };
  return rig;
}
