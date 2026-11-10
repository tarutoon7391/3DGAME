// 怪盗（プレイヤー）：移動・走る／しゃがむ・足音・隠れる
import * as THREE from 'three';
import { PLAYER } from './config.js';

export function createPlayer(parent) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const suitMat = new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 0.6 });
  const capeMat = new THREE.MeshStandardMaterial({ color: 0x8e1b3a, roughness: 0.7, side: THREE.DoubleSide });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 10), suitMat);
  torso.position.y = 0.65;
  torso.castShadow = true;
  body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf1d2b6 }));
  head.position.y = 1.3;
  head.castShadow = true;
  body.add(head);
  const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.08, 14), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  mask.position.y = 1.33;
  body.add(mask);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.22, 12), suitMat);
  hat.position.y = 1.55;
  body.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 16), suitMat);
  brim.position.y = 1.45;
  body.add(brim);
  const cape = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 10, 1, true, Math.PI * 0.6, Math.PI * 0.8), capeMat);
  cape.position.y = 0.7;
  cape.castShadow = true;
  body.add(cape);
  // 壁の陰でも位置が分かる目印（深度無視）
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24),
    new THREE.MeshBasicMaterial({ color: 0xd28cff, depthTest: false, transparent: true, opacity: 0.85 }),
  );
  marker.position.y = 2.1;
  marker.renderOrder = 10;
  root.add(marker);
  parent.add(root);

  const p = {
    root,
    pos: root.position,
    angle: Math.PI / 2, // 向き（dir=(cos,sin)）
    mode: 'walk',
    moving: false,
    hidden: null, // 隠れているロッカー
    stepT: 0,
    reset(x, z) {
      root.position.set(x, 0, z);
      p.angle = Math.PI / 2;
      p.mode = 'walk';
      p.hidden = null;
      p.stepT = 0;
      root.visible = true;
      body.scale.set(1, 1, 1);
    },
    hide(locker) {
      p.hidden = locker;
      p.backPos = { x: root.position.x, z: root.position.z };
      root.visible = false;
    },
    unhide() {
      if (!p.hidden) return;
      root.position.x = p.backPos.x;
      root.position.z = p.backPos.z;
      p.hidden = null;
      root.visible = true;
    },
    /**
     * 意図（入力をデータ化したもの）で更新する。intent = { mx, mz（ワールド方向・長さ0か1）, run, crouch }
     * onStep(mode, x, z) は足音のたびに呼ばれる
     */
    update(dt, time, intent, grid, onStep) {
      marker.rotation.y = time * 2;
      marker.position.y = 2.1 + Math.sin(time * 4) * 0.08;
      if (p.hidden) return;
      const run = intent.run;
      const crouch = !run && intent.crouch;
      p.mode = run ? 'run' : crouch ? 'crouch' : 'walk';
      p.moving = intent.mx !== 0 || intent.mz !== 0;

      // しゃがみ姿勢
      const sy = crouch ? 0.68 : 1;
      body.scale.y += (sy - body.scale.y) * Math.min(1, dt * 12);

      if (p.moving) {
        const mx = intent.mx;
        const mz = intent.mz;
        const sp = PLAYER.speed[p.mode];
        grid.move(root.position, mx * sp * dt, mz * sp * dt, PLAYER.radius);
        // 向きをなめらかに合わせる
        const target = Math.atan2(mz, mx);
        let d = target - p.angle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        p.angle += d * Math.min(1, dt * 14);
        p.stepT -= dt;
        if (p.stepT <= 0) {
          p.stepT = PLAYER.stepInterval[p.mode];
          onStep(p.mode, root.position.x, root.position.z);
        }
        body.position.y = Math.abs(Math.sin(time * (run ? 16 : 10))) * (crouch ? 0.03 : 0.07);
      } else {
        p.stepT = Math.min(p.stepT, 0.1);
        body.position.y = 0;
      }
      body.rotation.y = Math.PI / 2 - p.angle;
      body.rotation.x = p.mode === 'run' && p.moving ? 0.18 : 0;
    },
  };
  return p;
}
