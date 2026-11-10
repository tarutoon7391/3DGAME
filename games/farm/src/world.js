// 静的なステージ：地面・木・家・ショップ・出荷箱・依頼ボード・井戸・動物の囲い
import * as THREE from 'three';

// ---- 配置（ワールド座標。1マス = 1） ----
export const FIELD_X0 = -6;
export const FIELD_Z0 = -3;
export const BOUNDS = { minX: -19, maxX: 15, minZ: -14, maxZ: 14 };
export const SPAWN = { x: -3, z: -8.2 };
export const PENS = {
  chicken: { minX: -17, maxX: -11, minZ: -6, maxZ: 1, gate: [-3.2, -1.6] },
  cow: { minX: -17, maxX: -11, minZ: 3, maxZ: 12, gate: [6.2, 7.8] },
};
const HOUSE = { minX: -5.5, maxX: -0.5, minZ: -11.5, maxZ: -7.5 };

const UP = new THREE.Vector3(0, 1, 0);
const matCache = new Map();
/** 色ごとに使い回すフラットシェーディングのマテリアル */
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...opts }));
  return matCache.get(key);
}

function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** ステージを作って scene に追加する */
export function createWorld(scene) {
  const colliders = [];
  const addCol = (minX, maxX, minZ, maxZ) => colliders.push({ minX, maxX, minZ, maxZ });
  const root = new THREE.Group();
  scene.add(root);

  // 地面
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0x7cb85a));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
  // 土の道（家 → 出荷箱 → ショップ）
  const pathMat = mat(0xc9a66b);
  for (const [x, z, w, d] of [[-3, -6.5, 1.6, 2.2], [3, -5.8, 13, 1.4], [9.2, -1, 1.4, 8.4]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pathMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.01, z);
    p.receiveShadow = true;
    root.add(p);
  }

  // ---- 家（正面が開いていて、屋根は近づくと透ける） ----
  const house = new THREE.Group();
  root.add(house);
  const hx = (HOUSE.minX + HOUSE.maxX) / 2;
  const hz = (HOUSE.minZ + HOUSE.maxZ) / 2;
  box(5, 2.4, 0.25, 0xb7835a, hx, 1.2, HOUSE.minZ, house);
  box(0.25, 2.4, 4, 0xb7835a, HOUSE.minX, 1.2, hz, house);
  box(0.25, 2.4, 4, 0xb7835a, HOUSE.maxX, 1.2, hz, house);
  box(1.2, 2.4, 0.25, 0xa7734a, HOUSE.minX + 0.6, 1.2, HOUSE.maxZ, house);
  box(1.2, 2.4, 0.25, 0xa7734a, HOUSE.maxX - 0.6, 1.2, HOUSE.maxZ, house);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 4), mat(0x8d6748));
  floor.position.set(hx, 0.05, hz);
  floor.receiveShadow = true;
  house.add(floor);
  // ベッド
  box(1.1, 0.4, 2, 0x6d4c41, -4.6, 0.3, -10.2, house);
  box(1, 0.15, 1.5, 0xe57373, -4.6, 0.55, -9.95, house);
  box(0.9, 0.18, 0.45, 0xffffff, -4.6, 0.58, -10.9, house);
  // テーブル
  box(1, 0.08, 0.8, 0x8d6e63, -1.6, 0.75, -10.6, house);
  box(0.1, 0.75, 0.1, 0x6d4c41, -1.6, 0.37, -10.6, house);
  // 屋根（三角柱）
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, flatShading: true, transparent: true });
  const roofGeo = new THREE.CylinderGeometry(1, 1, 5.6, 3, 1);
  roofGeo.rotateZ(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.scale.set(1, 1.4, 2.6);
  roof.position.set(hx, 3, hz);
  roof.castShadow = true;
  house.add(roof);
  addCol(HOUSE.minX - 0.15, HOUSE.maxX + 0.15, HOUSE.minZ - 0.15, HOUSE.minZ + 0.15);
  addCol(HOUSE.minX - 0.15, HOUSE.minX + 0.15, HOUSE.minZ, HOUSE.maxZ + 0.15);
  addCol(HOUSE.maxX - 0.15, HOUSE.maxX + 0.15, HOUSE.minZ, HOUSE.maxZ + 0.15);
  addCol(HOUSE.minX, HOUSE.minX + 1.2, HOUSE.maxZ - 0.15, HOUSE.maxZ + 0.15);
  addCol(HOUSE.maxX - 1.2, HOUSE.maxX, HOUSE.maxZ - 0.15, HOUSE.maxZ + 0.15);
  addCol(-5.2, -4.0, -11.3, -9.2); // ベッド
  addCol(-2.1, -1.1, -11.0, -10.2); // テーブル

  // ---- 出荷箱 ----
  box(1.3, 0.8, 0.9, 0x8d5a2b, 1.5, 0.4, -5, root);
  box(1.4, 0.12, 1.0, 0xa0693a, 1.5, 0.86, -5, root);
  addCol(0.8, 2.2, -5.5, -4.5);

  // ---- 依頼ボード ----
  box(0.15, 2, 0.15, 0x6d4c41, 4.1, 1, -8, root);
  box(0.15, 2, 0.15, 0x6d4c41, 5.9, 1, -8, root);
  box(2.1, 1.2, 0.1, 0xa1887f, 5, 1.4, -7.95, root);
  for (let i = 0; i < 3; i++) box(0.5, 0.6, 0.02, 0xfff8e1, 4.35 + i * 0.65, 1.4, -7.89, root);
  addCol(4, 6, -8.2, -7.8);

  // ---- ショップの屋台と店主 ----
  box(3.2, 1, 0.7, 0x8d6e63, 10, 0.5, -7.7, root);
  box(3.4, 0.1, 0.9, 0xbcaaa4, 10, 1.05, -7.7, root);
  for (const px of [8.5, 11.5]) for (const pz of [-7.4, -9.6]) box(0.12, 2.6, 0.12, 0x6d4c41, px, 1.3, pz, root);
  const awning = box(3.6, 0.15, 2.8, 0x43a047, 10, 2.65, -8.5, root);
  awning.rotation.x = -0.15;
  for (let i = 0; i < 4; i++) box(0.4, 0.3, 0.3, [0xe53935, 0xffb300, 0x8bc34a, 0xf57c00][i], 8.9 + i * 0.7, 1.25, -7.7, root);
  const npc = makePerson(0x1e88e5, 0xffcc80, 0x5d4037);
  npc.position.set(10, 0, -8.8);
  root.add(npc);
  addCol(8.3, 11.7, -9.8, -7.3);

  // ---- 井戸 ----
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.8, 10), mat(0x9e9e9e));
  well.position.set(9, 0.4, 3);
  well.castShadow = true;
  root.add(well);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.6, 10), mat(0x4fc3f7, { emissive: 0x0d47a1, emissiveIntensity: 0.3 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(9, 0.7, 3);
  root.add(water);
  box(0.1, 1.6, 0.1, 0x6d4c41, 8.3, 1.2, 3, root);
  box(0.1, 1.6, 0.1, 0x6d4c41, 9.7, 1.2, 3, root);
  box(1.8, 0.1, 1.2, 0x8d6e63, 9, 2.05, 3, root);
  addCol(8.2, 9.8, 2.2, 3.8);

  // ---- 動物の囲い（東側に入口） ----
  const posts = [];
  const rails = [];
  const fence = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= n; i++) posts.push([x1 + ((x2 - x1) * i) / n, z1 + ((z2 - z1) * i) / n]);
    rails.push([(x1 + x2) / 2, (z1 + z2) / 2, len, Math.atan2(x2 - x1, z2 - z1)]);
    addCol(Math.min(x1, x2) - 0.12, Math.max(x1, x2) + 0.12, Math.min(z1, z2) - 0.12, Math.max(z1, z2) + 0.12);
  };
  for (const [kind, p] of Object.entries(PENS)) {
    fence(p.minX, p.minZ, p.maxX, p.minZ);
    fence(p.minX, p.maxZ, p.maxX, p.maxZ);
    fence(p.minX, p.minZ, p.minX, p.maxZ);
    fence(p.maxX, p.minZ, p.maxX, p.gate[0]);
    fence(p.maxX, p.gate[1], p.maxX, p.maxZ);
    // 小屋
    const hut = new THREE.Group();
    const big = kind === 'cow';
    box(big ? 3 : 2.2, big ? 2.2 : 1.5, big ? 2.4 : 1.8, big ? 0xb71c1c : 0xffcc80, 0, big ? 1.1 : 0.75, 0, hut);
    const hr = box(big ? 3.4 : 2.6, 0.2, big ? 2.8 : 2.2, 0x5d4037, 0, big ? 2.3 : 1.6, 0, hut);
    hr.rotation.z = 0.1;
    hut.position.set(p.minX + 2, 0, p.minZ + 1.8);
    root.add(hut);
    const hw = big ? 1.5 : 1.1;
    const hd = big ? 1.2 : 0.9;
    addCol(p.minX + 2 - hw, p.minX + 2 + hw, p.minZ + 1.8 - hd, p.minZ + 1.8 + hd);
    // エサ箱
    box(1.6, 0.35, 0.5, 0x8d6e63, p.maxX - 1.5, 0.18, p.maxZ - 0.8, root);
  }
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1, 0.16), mat(0x8d6e63), posts.length);
  const railMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.1, 1), mat(0xa1887f), rails.length * 2);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  posts.forEach(([x, z], i) => postMesh.setMatrixAt(i, m4.makeTranslation(x, 0.5, z)));
  rails.forEach(([x, z, len, ang], i) => {
    q.setFromAxisAngle(UP, ang);
    for (let k = 0; k < 2; k++) {
      railMesh.setMatrixAt(i * 2 + k, m4.compose(v.set(x, 0.45 + k * 0.35, z), q, sc.set(1, 1, len)));
    }
  });
  postMesh.castShadow = railMesh.castShadow = true;
  root.add(postMesh, railMesh);

  // ---- 外周の木（InstancedMesh） ----
  const trees = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = BOUNDS.minX - 2; x <= BOUNDS.maxX + 2; x += 2.2) {
    trees.push([x + rnd() - 0.5, BOUNDS.minZ - 1.5 - rnd() * 2]);
    trees.push([x + rnd() - 0.5, BOUNDS.maxZ + 1.5 + rnd() * 2]);
  }
  for (let z = BOUNDS.minZ; z <= BOUNDS.maxZ; z += 2.2) {
    trees.push([BOUNDS.minX - 1.5 - rnd() * 2, z + rnd() - 0.5]);
    trees.push([BOUNDS.maxX + 1.5 + rnd() * 2, z + rnd() - 0.5]);
  }
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 26 + rnd() * 20;
    trees.push([Math.cos(a) * r - 2, Math.sin(a) * r]);
  }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 1.4, 6), mat(0x6d4c41), trees.length);
  const leafGeo = new THREE.IcosahedronGeometry(1, 0);
  const leaves = new THREE.InstancedMesh(leafGeo, mat(0xffffff), trees.length * 2);
  const col = new THREE.Color();
  trees.forEach(([x, z], i) => {
    const s = 0.8 + rnd() * 0.6;
    trunk.setMatrixAt(i, m4.compose(v.set(x, 0.7 * s, z), q.identity(), sc.set(s, s, s)));
    for (let k = 0; k < 2; k++) {
      const ls = s * (k ? 0.75 : 1.1);
      q.setFromAxisAngle(UP, rnd() * 3);
      leaves.setMatrixAt(i * 2 + k, m4.compose(v.set(x, (1.8 + k * 1) * s, z), q, sc.set(ls, ls * 1.1, ls)));
      leaves.setColorAt(i * 2 + k, col.setHSL(0.27 + rnd() * 0.08, 0.5, 0.3 + rnd() * 0.12));
    }
  });
  trunk.castShadow = leaves.castShadow = true;
  root.add(trunk, leaves);

  // ---- 草むら・花（InstancedMesh） ----
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.35, 4), mat(0xffffff), 260);
  let n = 0;
  while (n < 260) {
    const x = BOUNDS.minX + rnd() * (BOUNDS.maxX - BOUNDS.minX);
    const z = BOUNDS.minZ + rnd() * (BOUNDS.maxZ - BOUNDS.minZ);
    if (x > FIELD_X0 - 1 && x < FIELD_X0 + 13 && z > FIELD_Z0 - 1 && z < FIELD_Z0 + 13) continue;
    if (colliders.some((c) => x > c.minX - 0.5 && x < c.maxX + 0.5 && z > c.minZ - 0.5 && z < c.maxZ + 0.5)) continue;
    if (x > HOUSE.minX - 0.5 && x < HOUSE.maxX + 0.5 && z > HOUSE.minZ - 0.5 && z < HOUSE.maxZ + 0.5) continue;
    tufts.setMatrixAt(n, m4.makeTranslation(x, 0.17, z));
    const flower = rnd() < 0.15;
    tufts.setColorAt(n, flower ? col.setHSL(rnd(), 0.8, 0.65) : col.setHSL(0.28, 0.5, 0.35 + rnd() * 0.1));
    n++;
  }
  root.add(tufts);

  // ---- 夜の街灯 ----
  const lamps = [];
  for (const [x, z] of [[0.2, -7], [7.6, -6.6], [-10.2, 2]]) {
    box(0.12, 2.4, 0.12, 0x424242, x, 1.2, z, root);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd54f, emissiveIntensity: 0 }));
    bulb.position.set(x, 2.5, z);
    root.add(bulb);
    const light = new THREE.PointLight(0xffd180, 0, 9, 1.5);
    light.position.set(x, 2.3, z);
    root.add(light);
    lamps.push({ bulb, light });
    addCol(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
  }

  // ---- 調べられる場所 ----
  const interactables = [
    { id: 'bed', x: -4.6, z: -9.0, r: 1.4, label: '寝る（ベッド）' },
    { id: 'ship', x: 1.5, z: -4.3, r: 1.4, label: '出荷箱' },
    { id: 'board', x: 5, z: -7.3, r: 1.5, label: '依頼ボード' },
    { id: 'shop', x: 10, z: -6.7, r: 1.6, label: 'ショップ' },
    { id: 'well', x: 9, z: 3, r: 1.7, label: '井戸（水をくむ）' },
  ];

  return {
    colliders,
    interactables,
    npc,
    /** 毎フレーム：家の中に入ったら屋根を透かす、夜は街灯を点ける */
    update(px, pz, night, time) {
      const inside = px > HOUSE.minX - 0.5 && px < HOUSE.maxX + 0.5 && pz > HOUSE.minZ - 0.5 && pz < HOUSE.maxZ + 1.5;
      const target = inside ? 0.15 : 1;
      roofMat.opacity += (target - roofMat.opacity) * 0.15;
      roofMat.depthWrite = roofMat.opacity > 0.9;
      roof.castShadow = roofMat.opacity > 0.9;
      for (const l of lamps) {
        l.light.intensity = night * 6;
        l.bulb.material.emissiveIntensity = night * 2;
      }
      npc.rotation.y = Math.sin(time * 0.7) * 0.3;
    },
  };
}

/** 人型（胴・頭・帽子・腕・脚）。農夫と店主で共用 */
export function makePerson(bodyColor, skinColor, hatColor) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.7, 8), mat(bodyColor));
  body.position.y = 0.8;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(skinColor));
  head.position.y = 1.35;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12), mat(hatColor));
  brim.position.y = 1.5;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.2, 10), mat(hatColor));
  crown.position.y = 1.6;
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), mat(0x222222));
  eyes.position.set(0, 1.38, 0.2);
  const armGeo = new THREE.BoxGeometry(0.12, 0.55, 0.12);
  armGeo.translate(0, -0.25, 0);
  const armL = new THREE.Mesh(armGeo, mat(skinColor));
  armL.position.set(-0.34, 1.08, 0);
  const armR = new THREE.Mesh(armGeo, mat(skinColor));
  armR.position.set(0.34, 1.08, 0);
  const legGeo = new THREE.BoxGeometry(0.15, 0.45, 0.15);
  legGeo.translate(0, -0.22, 0);
  const legL = new THREE.Mesh(legGeo, mat(0x3e2723));
  legL.position.set(-0.13, 0.46, 0);
  const legR = new THREE.Mesh(legGeo, mat(0x3e2723));
  legR.position.set(0.13, 0.46, 0);
  g.add(body, head, brim, crown, eyes, armL, armR, legL, legR);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { armL, armR, legL, legR, body, head };
  return g;
}
