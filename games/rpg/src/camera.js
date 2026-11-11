// カメラ：一人称（既定）と三人称を切り替える。どちらも入力は {dx, dy, wheel} のデータで受け取る
// ヨーはゲーム共通の向き（正面ベクトルが (sin, cos)）。三人称はキャラの後ろから、一人称は目の高さから見る
import { clamp } from './util.js';
import { VIEW } from './data/view.js';

export function createCameraRig(camera) {
  camera.rotation.order = 'YXZ';
  const rig = {
    mode: VIEW.defaultMode,
    // 一人称
    yaw: Math.PI, // 向いている方向
    look: 0, // 上下（正で上）
    bobT: 0,
    bobAmp: 0,
    eyeDip: 0,
    // 三人称（カメラはターゲットから見て yaw+π の方向の後ろ）
    tps: { pitch: 0.42, dist: 8, curDist: 8 },
    lastDx: 0,
    lastDy: 0,

    get fps() { return rig.mode === 'fps'; },

    /** 視点を切り替える（向きは引き継ぐ） */
    setMode(mode) {
      rig.mode = mode;
      camera.fov = mode === 'fps' ? VIEW.fov : VIEW.tpsFov;
      camera.near = mode === 'fps' ? VIEW.near : 0.1;
      camera.updateProjectionMatrix();
    },
    /** 三人称の見下ろし角（迷路では高め） */
    setTpsPitch(p) { rig.tps.pitch = p; },

    input({ dx = 0, dy = 0, wheel = 0 }) {
      rig.lastDx = dx;
      rig.lastDy = dy;
      if (rig.fps) {
        rig.yaw -= dx * VIEW.sens;
        rig.look = clamp(rig.look - dy * VIEW.sens, -VIEW.pitchLimit, VIEW.pitchLimit);
      } else {
        rig.yaw -= dx * VIEW.tpsSens;
        rig.tps.pitch = clamp(rig.tps.pitch + dy * VIEW.tpsSens, 0.08, 1.2);
        rig.tps.dist = clamp(rig.tps.dist + wheel * 0.8, 4, 14);
      }
    },
    /** 正面方向（地面上）のヨー */
    forwardYaw() { return rig.yaw; },
    /** 入力（右・前）を地面上のベクトルに */
    toWorld(right, fwd) {
      const s = Math.sin(rig.yaw);
      const c = Math.cos(rig.yaw);
      return { x: s * fwd - c * right, z: c * fwd + s * right };
    },
    /** yaw の方向を向く（エリア開始時） */
    snapBehind(yaw) {
      rig.yaw = yaw;
      rig.look = 0;
    },

    /**
     * @param me プレイヤー（pos・moving・dashing・action など）
     * @param shake 画面揺れのずれ（Vector3）
     */
    update(dt, me, world, shake) {
      if (rig.fps) updateFps(dt, me, shake);
      else updateTps(dt, me.pos, world, shake);
    },
  };

  function updateFps(dt, me, shake) {
    // 歩くと少し上下に揺れる（VIEW.bob = 0 で無し）
    const amp = me.walking ? (me.dashing ? VIEW.bobDash : VIEW.bob) : 0;
    rig.bobAmp += (amp - rig.bobAmp) * Math.min(1, dt * 8);
    const bob = Math.sin(me.walkPhase) * rig.bobAmp;
    const dip = !me.alive ? VIEW.eyeHeight - 0.35 : me.action === 'dodge' ? VIEW.dodgeDip : 0; // やられたら倒れ込む
    rig.eyeDip += (dip - rig.eyeDip) * Math.min(1, dt * (me.alive ? 14 : 3));
    const k = VIEW.fpsShake;
    camera.position.set(
      me.pos.x + shake.x * k,
      me.pos.y + VIEW.eyeHeight + bob - rig.eyeDip + shake.y * k + (me.model?.root?.position.y || 0), // 跳ぶ技（天穿ち・昇竜拳など）は視点も上がる
      me.pos.z + shake.z * k,
    );
    camera.rotation.set(rig.look, rig.yaw + Math.PI, me.alive ? 0 : Math.min(0.5, rig.eyeDip * 0.4));
  }

  function updateTps(dt, target, world, shake) {
    const t = rig.tps;
    const tx = target.x;
    const ty = target.y + 1.6;
    const tz = target.z;
    const back = rig.yaw + Math.PI;
    const cp = Math.cos(t.pitch);
    const dirX = Math.sin(back) * cp;
    const dirY = Math.sin(t.pitch);
    const dirZ = Math.cos(back) * cp;
    // 壁に当たる手前まで縮める
    let want = t.dist;
    for (let s = 0.6; s <= t.dist; s += 0.4) {
      if (world && world.blocked(tx + dirX * s, tz + dirZ * s, true) && ty + dirY * s < world.wallH + 0.5) {
        want = Math.max(1.5, s - 0.5);
        break;
      }
    }
    t.curDist += (want - t.curDist) * Math.min(1, dt * (want < t.curDist ? 20 : 5));
    const d = t.curDist;
    camera.position.set(tx + dirX * d + shake.x, Math.max(0.4, ty + dirY * d) + shake.y, tz + dirZ * d + shake.z);
    camera.lookAt(tx + shake.x * 0.5, ty + shake.y * 0.5, tz + shake.z * 0.5);
  }

  rig.setMode(rig.mode);
  return rig;
}
