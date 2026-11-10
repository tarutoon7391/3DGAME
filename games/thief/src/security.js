// 警備設備：監視カメラ（首振り・視野表示）とレーザー（常時／点滅／移動）
import * as THREE from 'three';
import { T, CAM, PLAYER } from './config.js';
import { createCone } from './cone.js';

const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createCameras(parent, level, smokes) {
  const { grid } = level;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd0d4dc, metalness: 0.5, roughness: 0.4 });
  const list = (level.stage.cameras || []).map((def) => {
    const x = grid.center(def.at[0]);
    const z = grid.center(def.at[1]);
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.6), bodyMat);
    box.position.z = 0.2;
    g.add(box);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2040 }));
    lamp.position.set(0, 0.16, 0.35);
    g.add(lamp);
    g.position.set(x, 2.2, z);
    parent.add(g);
    const cone = createCone(parent, 0xff4060, 0.15, 0.05);
    return { def, x, z, g, lamp, cone, s: { angle: def.dir * DEG, gauge: 0, cool: 0 } };
  });

  return {
    list,
    /** onAlarm(x,z) は警戒ゲージ満タンで呼ばれる */
    update(dt, time, players, visOf, onAlarm) {
      for (const cam of list) {
        const { def, s } = cam;
        s.cool = Math.max(0, s.cool - dt);
        if (s.cool <= 0) s.angle = def.dir * DEG + Math.sin(time * def.speed) * def.sweep * DEG;
        let seen = null;
        let best = 0;
        for (const pl of players) {
          if (pl.hidden) continue;
          const dx = pl.pos.x - cam.x;
          const dz = pl.pos.z - cam.z;
          const d = Math.hypot(dx, dz);
          if (d > CAM.range || Math.abs(wrap(Math.atan2(dz, dx) - s.angle)) > CAM.half) continue;
          if (smokes.blocks(cam.x, cam.z, pl.pos.x, pl.pos.z)) continue;
          if (!grid.los(cam.x, cam.z, pl.pos.x, pl.pos.z, pl.mode === 'crouch')) continue;
          const v = visOf(pl) * (0.6 + 1.6 * (1 - d / CAM.range));
          if (v > best) { best = v; seen = pl; }
        }
        if (seen && s.cool <= 0) {
          s.gauge = Math.min(1, s.gauge + CAM.fill * best * dt);
          if (s.gauge >= 1) {
            s.cool = CAM.cooldown;
            s.gauge = 0;
            onAlarm(seen.pos.x, seen.pos.z);
          }
        } else s.gauge = Math.max(0, s.gauge - 0.3 * dt);

        cam.g.rotation.y = Math.PI / 2 - s.angle;
        const alarm = s.cool > 0;
        cam.cone.mat.opacity = alarm ? (Math.floor(time * 8) % 2 ? 0.35 : 0.1) : 0.12 + s.gauge * 0.25;
        cam.cone.mat.color.setHex(s.gauge > 0.02 || alarm ? 0xff1030 : 0xff6080);
        cam.lamp.visible = alarm ? Math.floor(time * 8) % 2 === 0 : Math.floor(time * 1.5) % 2 === 0;
        cam.cone.update(grid, cam.x, cam.z, s.angle, CAM.half, CAM.range, smokes);
      }
    },
  };
}

export function createLasers(parent, level) {
  const { grid } = level;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x30343c, metalness: 0.7, roughness: 0.3 });
  const postGeo = new THREE.BoxGeometry(0.22, 1.3, 0.22);
  const beamGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6).rotateZ(Math.PI / 2); // x 方向に長さ1
  const glowGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 8).rotateZ(Math.PI / 2);
  const list = (level.stage.lasers || []).map((def) => {
    let ax = grid.center(def.from[0]);
    let az = grid.center(def.from[1]);
    let bx = grid.center(def.to[0]);
    let bz = grid.center(def.to[1]);
    const len0 = Math.hypot(bx - ax, bz - az) || 1;
    const ux = (bx - ax) / len0;
    const uz = (bz - az) / len0;
    // 両端を半タイル延長して壁に届かせる（少しだけ手前で止める）
    ax -= ux * (T / 2 - 0.12);
    az -= uz * (T / 2 - 0.12);
    bx += ux * (T / 2 - 0.12);
    bz += uz * (T / 2 - 0.12);
    const len = Math.hypot(bx - ax, bz - az);
    const g = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const h of [0.45, 1.0]) {
      const b = new THREE.Mesh(beamGeo, beamMat);
      b.scale.x = len;
      b.position.y = h;
      const gl = new THREE.Mesh(glowGeo, glowMat);
      gl.scale.x = len;
      gl.position.y = h;
      g.add(b, gl);
    }
    const p1 = new THREE.Mesh(postGeo, postMat);
    const p2 = new THREE.Mesh(postGeo, postMat);
    p1.position.set(-len / 2, 0.65, 0);
    p2.position.set(len / 2, 0.65, 0);
    g.add(p1, p2);
    g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
    g.rotation.y = -Math.atan2(bz - az, bx - ax);
    parent.add(g);
    const pts = { ax, az, bx, bz };
    return { def, g, base: { x: g.position.x, z: g.position.z }, pts, beamMat, glowMat, s: { on: true, ox: 0, oz: 0, cool: 0 } };
  });

  return {
    list,
    /** onTrip(x,z) はプレイヤーが触れた時に呼ばれる */
    update(dt, time, players, onTrip) {
      for (const L of list) {
        const { def, s } = L;
        s.cool = Math.max(0, s.cool - dt);
        if (def.mode === 'blink') {
          const per = (def.on ?? 1.5) + (def.off ?? 1);
          s.on = (time + (def.phase ?? 0)) % per < (def.on ?? 1.5);
        } else s.on = true;
        if (def.mode === 'move') {
          const o = Math.sin(time * (def.speed ?? 1)) * (def.range ?? 2);
          s.ox = def.axis === 'z' ? 0 : o;
          s.oz = def.axis === 'z' ? o : 0;
        }
        L.g.position.set(L.base.x + s.ox, 0, L.base.z + s.oz);
        // 点滅中は柱だけ残してビームを消す
        L.g.children.forEach((c, i) => { if (i < 4) c.visible = s.on; });
        L.glowMat.opacity = s.cool > 0 ? 0.6 : 0.22 + Math.sin(time * 12) * 0.05;
        if (!s.on || s.cool > 0) continue;
        const ax = L.pts.ax + s.ox;
        const az = L.pts.az + s.oz;
        const bx = L.pts.bx + s.ox;
        const bz = L.pts.bz + s.oz;
        for (const pl of players) {
          if (pl.hidden) continue;
          if (segDist(pl.pos.x, pl.pos.z, ax, az, bx, bz) < PLAYER.radius + 0.04) {
            s.cool = 3;
            onTrip(pl.pos.x, pl.pos.z);
            break;
          }
        }
      }
    },
  };
}

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const l2 = vx * vx + vz * vz;
  let t = l2 > 0 ? ((px - ax) * vx + (pz - az) * vz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}
