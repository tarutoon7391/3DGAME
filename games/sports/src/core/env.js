// 競技場の共通部品：ライト・空・人物モデル・観客・後片付け（dispose）
import * as THREE from 'three';

/** 環境光と太陽光（影つき）を group に追加して返す */
export function addLights(group, { size = 30, sunPos = [12, 25, 10], target = [0, 0, 0], intensity = 2.2 } = {}) {
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3d5a2a, 0.9);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3dd, intensity);
  sun.position.set(...sunPos);
  sun.target.position.set(...target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -size;
  cam.right = size;
  cam.top = size;
  cam.bottom = -size;
  cam.near = 1;
  cam.far = 150;
  sun.shadow.bias = -0.0005;
  group.add(sun, sun.target);
  return { hemi, sun };
}

/** 空の色とフォグ */
export function setSky(scene, color = 0x8ec9ff, near = 60, far = 220) {
  scene.background = new THREE.Color(color);
  scene.fog = new THREE.Fog(color, near, far);
}

/** group 以下の geometry / material を全部 dispose してシーンから外す */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
  root.removeFromParent();
}

/**
 * ローポリの人物（胴体・頭・腕）を作る。足元が原点、-Z が正面。
 * @returns {{root:THREE.Group, body:THREE.Mesh, armR:THREE.Group, armL:THREE.Group}}
 */
export function makeFigure({ color = 0x2f81f7, skin = 0xf1c27d, hat = null, height = 1.75 } = {}) {
  const root = new THREE.Group();
  const s = height / 1.75;
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8, flatShading: true });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.9, flatShading: true });

  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.13 * s, 0.8 * s, 6), legMat);
  legs.position.y = 0.4 * s;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.2 * s, 0.6 * s, 7), bodyMat);
  body.position.y = 1.1 * s;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 * s, 0), skinMat);
  head.position.y = 1.57 * s;
  root.add(legs, body, head);
  if (hat !== null) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 0.1 * s, 8),
      new THREE.MeshStandardMaterial({ color: hat, flatShading: true }),
    );
    cap.position.y = 1.7 * s;
    root.add(cap);
  }
  const armGeo = new THREE.BoxGeometry(0.1 * s, 0.55 * s, 0.1 * s);
  armGeo.translate(0, -0.25 * s, 0); // 肩を回転軸に
  const mkArm = (x) => {
    const g = new THREE.Group();
    g.position.set(x * s, 1.36 * s, 0);
    const a = new THREE.Mesh(armGeo, skinMat);
    a.castShadow = true;
    g.add(a);
    root.add(g);
    return g;
  };
  const armR = mkArm(0.3);
  const armL = mkArm(-0.3);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { root, body, armR, armL, head };
}

/**
 * 観客席（InstancedMesh）。中心 cx,cz から見て矩形の外周に並べる
 * @param {THREE.Group} group
 * @param {{halfX:number, halfZ:number, rows?:number, gap?:number, sides?:string[]}} o
 */
export function addCrowd(group, { halfX, halfZ, rows = 4, gap = 1.0, sides = ['n', 's', 'e', 'w'] }) {
  const spots = [];
  for (let r = 0; r < rows; r++) {
    const ox = halfX + r * gap;
    const oz = halfZ + r * gap;
    const h = r * 0.6;
    if (sides.includes('e') || sides.includes('w')) {
      for (let z = -oz; z <= oz; z += 0.9) {
        if (sides.includes('e')) spots.push([ox, h, z, -Math.PI / 2]);
        if (sides.includes('w')) spots.push([-ox, h, z, Math.PI / 2]);
      }
    }
    for (let x = -ox; x <= ox; x += 0.9) {
      if (sides.includes('n')) spots.push([x, h, -oz, 0]);
      if (sides.includes('s')) spots.push([x, h, oz, Math.PI]);
    }
  }
  // 段（スタンド）
  const standMat = new THREE.MeshStandardMaterial({ color: 0x59606b, roughness: 1 });
  for (let r = 0; r < rows; r++) {
    const ox = halfX + r * gap;
    const oz = halfZ + r * gap;
    const h = r * 0.6;
    const mk = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h + 0.3, d), standMat);
      m.position.set(x, (h + 0.3) / 2 - 0.15, z);
      m.receiveShadow = true;
      group.add(m);
    };
    if (sides.includes('e')) mk(gap, oz * 2 + gap, ox, 0);
    if (sides.includes('w')) mk(gap, oz * 2 + gap, -ox, 0);
    if (sides.includes('n')) mk(ox * 2 + gap, gap, 0, -oz);
    if (sides.includes('s')) mk(ox * 2 + gap, gap, 0, oz);
  }
  const geo = new THREE.CapsuleGeometry(0.22, 0.45, 2, 6);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const m4 = new THREE.Matrix4();
  const c = new THREE.Color();
  const palette = [0xe63946, 0xf1faee, 0xa8dadc, 0x457b9d, 0xffb703, 0x8ecae6, 0x2a9d8f, 0xe76f51, 0x9b5de5];
  spots.forEach((sp, i) => {
    m4.makeRotationY(sp[3]);
    m4.setPosition(sp[0], sp[1] + 0.15, sp[2]);
    mesh.setMatrixAt(i, m4);
    mesh.setColorAt(i, c.setHex(palette[(Math.random() * palette.length) | 0]));
  });
  group.add(mesh);
  const base = spots.map((sp) => sp[1] + 0.15);
  const phase = spots.map(() => Math.random() * Math.PI * 2);
  let excite = 0;
  return {
    mesh,
    /** 歓声で観客を跳ねさせる */
    cheer(v = 1) {
      excite = Math.max(excite, v);
    },
    update(dt, time) {
      if (excite <= 0) return;
      excite = Math.max(0, excite - dt * 0.6);
      for (let i = 0; i < spots.length; i++) {
        const sp = spots[i];
        const jump = Math.max(0, Math.sin(time * 12 + phase[i])) * 0.3 * Math.min(1, excite);
        m4.makeRotationY(sp[3]);
        m4.setPosition(sp[0], base[i] + jump, sp[2]);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** 地面の丸い影（ボールの位置が分かりやすいように） */
export function makeBlobShadow(radius = 0.12) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}
