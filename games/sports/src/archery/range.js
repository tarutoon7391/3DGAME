// アーチェリー場：芝のレーン・的・吹き流し・木・一人称の弓・矢
import * as THREE from 'three';
import { addLights } from '../core/env.js';

export const TARGET_R = 0.8; // 的の半径（10 リング）
export const TARGET_Y = 1.3;
export const EYE = new THREE.Vector3(0, 1.6, 0);

export function buildRange(group) {
  addLights(group, { size: 30, sunPos: [-10, 30, -5], target: [0, 0, -20] });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 160), new THREE.MeshStandardMaterial({ color: 0x4f9a3e, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -50;
  ground.receiveShadow = true;
  group.add(ground);
  // レーン（明るい芝）と距離ライン
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(8, 60), new THREE.MeshStandardMaterial({ color: 0x5fae4a, roughness: 1 }));
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.005, -28);
  lane.receiveShadow = true;
  group.add(lane);
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
  for (let z = 5; z <= 50; z += 5) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(8, z % 10 === 0 ? 0.12 : 0.05), white);
    l.rotation.x = -Math.PI / 2;
    l.position.set(0, 0.01, -z);
    group.add(l);
  }
  // 射場の床
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 2), new THREE.MeshStandardMaterial({ color: 0x9c7a54 }));
  deck.position.set(0, 0.05, 0.3);
  deck.receiveShadow = true;
  group.add(deck);

  // 木（InstancedMesh）
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
  trunkGeo.translate(0, 1, 0);
  const leafGeo = new THREE.ConeGeometry(1.6, 4, 7);
  leafGeo.translate(0, 3.8, 0);
  const N = 60;
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6b4423 }), N);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x2d6a4f, flatShading: true }), N);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (9 + Math.random() * 25);
    const z = 5 - Math.random() * 110;
    const s = 0.8 + Math.random() * 0.8;
    m4.makeScale(s, s, s);
    m4.setPosition(x, 0, z);
    trunks.setMatrixAt(i, m4);
    leaves.setMatrixAt(i, m4);
  }
  trunks.castShadow = leaves.castShadow = true;
  group.add(trunks, leaves);
  // 奥の土手
  const berm = new THREE.Mesh(new THREE.BoxGeometry(40, 5, 4), new THREE.MeshStandardMaterial({ color: 0x3e7d34, roughness: 1 }));
  berm.position.set(0, 2.5, -60);
  group.add(berm);

  // 的
  const target = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.1, 0.4), new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 1 }));
  stand.position.set(0, TARGET_Y, -0.22);
  stand.castShadow = stand.receiveShadow = true;
  target.add(stand);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x6b4423 });
  [-0.8, 0.8].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), legMat);
    leg.position.set(x, 1.1, -0.5);
    leg.rotation.x = -0.2;
    leg.castShadow = true;
    target.add(leg);
  });
  const ringColors = [0xffffff, 0xffffff, 0x222222, 0x222222, 0x2b8cff, 0x2b8cff, 0xff3b30, 0xff3b30, 0xffd60a, 0xffd60a];
  for (let i = 0; i < 10; i++) {
    const r = TARGET_R * (1 - i / 10);
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshStandardMaterial({ color: ringColors[i], roughness: 0.8 }));
    m.position.set(0, TARGET_Y, 0.001 + i * 0.001);
    m.receiveShadow = true;
    target.add(m);
  }
  const x = new THREE.Mesh(new THREE.CircleGeometry(0.012, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  x.position.set(0, TARGET_Y, 0.013);
  target.add(x);
  group.add(target);

  // 吹き流し（風向き）
  const flags = [];
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xff7b00, side: THREE.DoubleSide });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
  [[-4.5, -8], [4.5, -20], [-4.5, -32], [4.5, -44]].forEach(([fx, fz]) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4, 6), poleMat);
    pole.position.set(fx, 2, fz);
    pole.castShadow = true;
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.4, 8, 1, true), flagMat);
    flag.geometry.rotateZ(Math.PI / 2); // 先端を -x に
    flag.geometry.translate(-0.7, 0, 0);
    const pivot = new THREE.Group();
    pivot.position.set(fx, 3.8, fz);
    pivot.add(flag);
    group.add(pole, pivot);
    flags.push(pivot);
  });

  return { target, flags };
}

/** 矢（シャフト＋矢じり＋羽根）。+Z 向きが先端 */
export function makeArrowMesh(color = 0x2f81f7) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 5), new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
  shaft.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 6), new THREE.MeshStandardMaterial({ color: 0x9e9e9e, metalness: 0.6 }));
  head.rotation.x = Math.PI / 2;
  head.position.z = 0.4;
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.05, 0.12), new THREE.MeshStandardMaterial({ color }));
  fl.position.z = -0.32;
  const fl2 = fl.clone();
  fl2.rotation.z = Math.PI / 2;
  g.add(shaft, head, fl, fl2);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** 一人称の弓（弧＋弦）。弦は引き具合で変形させる */
export function makeBow() {
  const g = new THREE.Group();
  const limb = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.014, 6, 24, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6 }),
  );
  // 弧の中央を +x に合わせてから +z（前方）へ向ける
  limb.rotation.set(0, -Math.PI / 2, -Math.PI * 0.31);
  limb.position.z = -0.42;
  g.add(limb);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.04), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  grip.position.set(0, 0, 0.13);
  g.add(grip);
  // 弦（3点の折れ線）
  const pos = new Float32Array(9);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const string = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xeeeeee }));
  g.add(string);
  const nocked = makeArrowMesh(0xffd166);
  g.add(nocked);
  function setDraw(d) {
    const tipY = 0.45;
    const tipZ = -0.11;
    const back = tipZ - d * 0.35;
    pos.set([0, tipY, tipZ, 0, 0, back, 0, -tipY, tipZ]);
    geo.attributes.position.needsUpdate = true;
    nocked.position.z = back + 0.375;
  }
  setDraw(0);
  return { group: g, setDraw, nocked };
}
