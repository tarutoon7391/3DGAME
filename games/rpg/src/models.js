// ローポリのキャラクターモデル（プリミティブの組み合わせ）。正面は +Z
// geometry と共通 material はキャッシュして全体で使い回す（dispose しない）。
// 個体ごとに色を変える material（被弾フラッシュ・予備動作の発光用）は ownMat で作り、消すときに dispose する。
import * as THREE from 'three';

const geos = new Map();
const mats = new Map();

export function geo(key, make) {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}

export function mat(color, extra = null) {
  const key = color + (extra ? JSON.stringify(extra) : '');
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...(extra || {}) });
    mats.set(key, m);
  }
  return m;
}

export function ownMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true });
}

export const box = (w, h, d) => geo(`box${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
export const sphere = (r, w = 8, h = 6) => geo(`sph${r}_${w}_${h}`, () => new THREE.SphereGeometry(r, w, h));
export const cyl = (rt, rb, h, s = 8) => geo(`cyl${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const cone = (r, h, s = 6) => geo(`cone${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));

export function part(g, m, x = 0, y = 0, z = 0, parent = null) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  if (parent) parent.add(o);
  return o;
}

function pivot(parent, x, y, z) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  p.rotation.order = 'YXZ';
  parent.add(p);
  return p;
}

/** 人型。clothMat / skinMat を渡すと個体専用の色にできる */
export function humanoid({ skin = 0xf1c27d, cloth = 0x3366aa, pants = 0x2d2d3a, clothMat = null, skinMat = null, robe = false, eye = 0x111111 } = {}) {
  const group = new THREE.Group();
  const root = pivot(group, 0, 0, 0);
  const cm = clothMat || mat(cloth);
  const sm = skinMat || mat(skin);
  const torso = part(box(0.7, 0.75, 0.42), cm, 0, 1.2, 0, root);
  const head = part(box(0.5, 0.5, 0.5), sm, 0, 1.85, 0, root);
  const em = mat(eye);
  part(box(0.08, 0.1, 0.02), em, -0.12, 1.88, 0.26, root);
  part(box(0.08, 0.1, 0.02), em, 0.12, 1.88, 0.26, root);
  const armL = pivot(root, -0.47, 1.52, 0);
  const armR = pivot(root, 0.47, 1.52, 0);
  part(box(0.2, 0.62, 0.22), cm, 0, -0.3, 0, armL);
  part(box(0.2, 0.62, 0.22), cm, 0, -0.3, 0, armR);
  part(box(0.17, 0.15, 0.19), sm, 0, -0.68, 0, armL);
  part(box(0.17, 0.15, 0.19), sm, 0, -0.68, 0, armR);
  let legL = null;
  let legR = null;
  if (robe) {
    part(cone(0.55, 0.95, 6), cm, 0, 0.47, 0, root);
  } else {
    const pm = mat(pants);
    legL = pivot(root, -0.17, 0.82, 0);
    legR = pivot(root, 0.17, 0.82, 0);
    part(box(0.24, 0.82, 0.28), pm, 0, -0.41, 0, legL);
    part(box(0.24, 0.82, 0.28), pm, 0, -0.41, 0, legR);
  }
  return { group, root, torso, head, armL, armR, legL, legR };
}

/** 歩きアニメ（amount 0〜1）。右腕は攻撃側で上書きされる前提 */
export function animateWalk(m, phase, amount, withRightArm = true) {
  const s = Math.sin(phase) * 0.7 * amount;
  if (m.legL) {
    m.legL.rotation.x = s;
    m.legR.rotation.x = -s;
  }
  if (m.armL) m.armL.rotation.x = -s * 0.8;
  if (withRightArm && m.armR) m.armR.rotation.x = s * 0.8;
  m.root.position.y = Math.abs(Math.cos(phase)) * 0.06 * amount;
}

// ---------------- 主人公 ----------------
/** look: { swordColor, swordLen, armorColor }（装備は固定） */
export function makeHero(look) {
  const swordMat = new THREE.MeshStandardMaterial({ color: look.swordColor, metalness: 0.5, roughness: 0.35, flatShading: true, emissive: 0x000000 });
  const armorMat = new THREE.MeshStandardMaterial({ color: look.armorColor, roughness: 0.7, flatShading: true, emissive: 0x000000 });
  const h = humanoid({ clothMat: armorMat, pants: 0x3e2f23 });
  const hair = mat(0x5a3a1a);
  part(box(0.56, 0.16, 0.56), hair, 0, 2.13, -0.02, h.root);
  part(box(0.56, 0.32, 0.12), hair, 0, 1.96, -0.24, h.root);
  part(box(0.5, 0.06, 0.3), mat(0xb71c1c), 0, 2.02, 0.05, h.root); // はちまき
  // マント
  part(box(0.66, 0.9, 0.06), mat(0xb71c1c), 0, 1.1, -0.26, h.root);
  // 剣（右腕の延長方向に伸びる）
  const sword = new THREE.Group();
  sword.position.set(0, -0.72, 0);
  h.armR.add(sword);
  part(box(0.1, 0.22, 0.1), mat(0x4e342e), 0, -0.04, 0, sword);
  part(box(0.36, 0.06, 0.12), mat(0x8d6e63), 0, -0.16, 0, sword);
  const blade = part(box(0.08, 1, 0.18), swordMat, 0, -0.7, 0, sword);
  blade.scale.y = look.swordLen;
  blade.position.y = -0.2 - 0.5 * look.swordLen;
  // 盾
  part(box(0.08, 0.55, 0.46), armorMat, -0.14, -0.42, 0.05, h.armL);
  h.armR.rotation.x = -0.9;
  return { ...h, sword, blade, swordMat, armorMat };
}

// ---------------- 敵 ----------------
/** model 名から敵の形を作る。bodyMat は個体専用（dispose 対象） */
export function makeEnemyModel(model, color) {
  const bodyMat = ownMat(color);
  bodyMat.emissive = new THREE.Color(0x000000);
  let m;
  switch (model) {
    case 'slime': m = slime(bodyMat); break;
    case 'boar': m = boar(bodyMat); break;
    case 'golem': m = golem(bodyMat); break;
    case 'goblin': m = goblin(bodyMat); break;
    case 'skeleton': m = skeleton(bodyMat); break;
    case 'mage': m = mage(bodyMat); break;
    default: m = slime(bodyMat);
  }
  m.bodyMat = bodyMat;
  m.model = model;
  return m;
}

function slime(bm) {
  const group = new THREE.Group();
  const root = pivot(group, 0, 0, 0);
  const body = part(sphere(0.6, 10, 7), bm, 0, 0.45, 0, root);
  body.scale.set(1, 0.75, 1);
  const em = mat(0x111111);
  part(box(0.1, 0.16, 0.05), em, -0.18, 0.6, 0.5, root);
  part(box(0.1, 0.16, 0.05), em, 0.18, 0.6, 0.5, root);
  return { group, root, body };
}

function boar(bm) {
  const group = new THREE.Group();
  const root = pivot(group, 0, 0, 0);
  part(box(0.95, 0.75, 1.5), bm, 0, 0.85, 0, root);
  part(box(0.7, 0.6, 0.55), bm, 0, 0.85, 0.95, root);
  part(box(0.35, 0.28, 0.2), mat(0x5d4037), 0, 0.75, 1.3, root);
  const tusk = mat(0xfff8e1);
  part(box(0.08, 0.3, 0.08), tusk, -0.22, 0.75, 1.3, root).rotation.x = -0.5;
  part(box(0.08, 0.3, 0.08), tusk, 0.22, 0.75, 1.3, root).rotation.x = -0.5;
  part(box(0.1, 0.08, 0.04), mat(0xff1744), -0.2, 1.0, 1.23, root);
  part(box(0.1, 0.08, 0.04), mat(0xff1744), 0.2, 1.0, 1.23, root);
  part(box(0.5, 0.15, 0.9), mat(0x3e2723), 0, 1.28, -0.1, root); // たてがみ
  const legs = [];
  for (const [x, z] of [[-0.3, 0.5], [0.3, 0.5], [-0.3, -0.5], [0.3, -0.5]]) {
    const p = pivot(root, x, 0.5, z);
    part(box(0.2, 0.5, 0.2), mat(0x4e342e), 0, -0.25, 0, p);
    legs.push(p);
  }
  return { group, root, legs };
}

function golem(bm) {
  const h = humanoid({ clothMat: bm, skinMat: bm, pants: 0x546e7a, eye: 0xff6d00 });
  h.group.scale.setScalar(1.55);
  part(box(0.95, 0.35, 0.55), bm, 0, 1.62, 0, h.root); // 肩の岩
  part(box(0.3, 0.3, 0.3), bm, 0, -0.75, 0, h.armL);
  part(box(0.3, 0.3, 0.3), bm, 0, -0.75, 0, h.armR);
  return h;
}

function goblin(bm) {
  const h = humanoid({ clothMat: mat(0x6d4c41), skinMat: bm, pants: 0x4e342e, eye: 0xffeb3b });
  h.group.scale.setScalar(0.78);
  part(cone(0.1, 0.35, 4), bm, -0.3, 1.95, 0, h.root).rotation.z = 1.2; // 耳
  part(cone(0.1, 0.35, 4), bm, 0.3, 1.95, 0, h.root).rotation.z = -1.2;
  // 弓（左手）
  const bow = part(box(0.06, 1.1, 0.08), mat(0x6d4c41), 0, -0.7, 0.12, h.armL);
  bow.rotation.x = 0.1;
  h.armL.rotation.x = -1.2;
  return h;
}

function skeleton(bm) {
  const h = humanoid({ clothMat: bm, skinMat: bm, pants: 0xd7d3c0, eye: 0xff1744 });
  part(box(0.66, 0.14, 0.5), mat(0x424242), 0, 1.56, 0, h.root); // 肩当て
  const sword = part(box(0.08, 1.1, 0.14), mat(0x9e9e9e), 0, -1.2, 0, h.armR);
  sword.castShadow = true;
  part(box(0.07, 0.6, 0.5), mat(0x5d4037), -0.15, -0.4, 0.05, h.armL); // 木の盾
  h.armR.rotation.x = -0.6;
  return h;
}

function mage(bm) {
  const h = humanoid({ clothMat: bm, skin: 0xb0bec5, robe: true, eye: 0x76ff03 });
  part(cone(0.42, 0.8, 6), bm, 0, 2.42, 0, h.root); // とんがり帽子
  part(cyl(0.5, 0.5, 0.06, 8), bm, 0, 2.06, 0, h.root);
  const staff = part(box(0.08, 1.6, 0.08), mat(0x4e342e), 0, -0.5, 0.1, h.armR);
  staff.castShadow = true;
  const orb = part(sphere(0.16, 8, 6), mat(0xe1bee7, { emissive: 0x9c27b0, emissiveIntensity: 1 }), 0, 0.35, 0.1, h.armR);
  orb.castShadow = false;
  return h;
}

// ---------------- ボス ----------------
export function makeBossModel(color) {
  const bodyMat = ownMat(color);
  bodyMat.emissive = new THREE.Color(0x000000);
  const h = humanoid({ clothMat: bodyMat, skinMat: bodyMat, pants: 0x2b1b17, eye: 0xffea00 });
  h.group.scale.setScalar(2.5);
  const horn = mat(0xf5f0e1);
  const hl = part(cone(0.1, 0.5, 5), horn, -0.22, 2.25, 0, h.root);
  hl.rotation.z = 0.5;
  const hr = part(cone(0.1, 0.5, 5), horn, 0.22, 2.25, 0, h.root);
  hr.rotation.z = -0.5;
  part(box(0.9, 0.2, 0.55), mat(0x37474f), 0, 1.58, 0, h.root); // 肩鎧
  part(box(0.74, 0.18, 0.46), mat(0x37474f), 0, 0.88, 0, h.root); // 腰帯
  // 金棒（右手）
  const club = new THREE.Group();
  club.position.set(0, -0.7, 0);
  h.armR.add(club);
  part(cyl(0.05, 0.05, 0.4, 6), mat(0x4e342e), 0, -0.1, 0, club);
  part(cyl(0.16, 0.1, 1.0, 6), mat(0x455a64), 0, -0.75, 0, club);
  h.armR.rotation.x = -0.4;
  return { ...h, bodyMat, club };
}
