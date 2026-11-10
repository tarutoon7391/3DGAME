// タイトル・メニュー背景：芝生の上に3競技の道具が浮かび、カメラがゆっくり回る
import * as THREE from 'three';
import { addLights, setSky } from './env.js';

export function createBackdrop(scene, director) {
  const group = new THREE.Group();
  addLights(group, { size: 12 });
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  // 芝の縞
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x4a9e44, roughness: 1 });
  for (let i = -4; i <= 4; i += 2) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4, 60), stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(i * 4, 0.01, 0);
    s.receiveShadow = true;
    group.add(s);
  }

  const items = [];
  // テニスボール
  const tb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 2), new THREE.MeshStandardMaterial({ color: 0xd9f048, roughness: 0.6 }));
  // 野球ボール（赤い縫い目）
  const bb = new THREE.Group();
  bb.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 2), new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.5 })));
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.035, 6, 32), new THREE.MeshStandardMaterial({ color: 0xd62828 }));
  seam.rotation.y = 0.6;
  bb.add(seam);
  // 的
  const tg = new THREE.Group();
  const ringColors = [0xffffff, 0x222222, 0x2b8cff, 0xff3b30, 0xffd60a];
  ringColors.forEach((c, i) => {
    const r = 1 - i * 0.2;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 32), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
    m.rotation.x = Math.PI / 2;
    m.position.z = i * 0.012;
    tg.add(m);
  });
  [[tb, -3.2], [bb, 0], [tg, 3.2]].forEach(([o, x], i) => {
    o.position.set(x, 2, 0);
    o.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    group.add(o);
    items.push({ o, phase: i * 2.1 });
  });
  scene.add(group);

  return {
    show(v) {
      group.visible = v;
      if (v) {
        setSky(scene, 0x8ec9ff, 30, 120);
        director.set([0, 3.5, 9], [0, 1.8, 0], { snap: true, speed: 3 });
      }
    },
    update(dt, time) {
      for (const it of items) {
        it.o.position.y = 2 + Math.sin(time * 1.4 + it.phase) * 0.35;
        it.o.rotation.y += dt * 0.8;
      }
      const a = Math.sin(time * 0.15) * 0.5;
      director.set([Math.sin(a) * 9, 3.5, Math.cos(a) * 9], [0, 1.8, 0]);
    },
  };
}
