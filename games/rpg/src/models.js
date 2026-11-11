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
/**
 * look: { swordColor, swordLen, armorColor, cape, weapon: sword|mace|staff|bow|dagger|lute, hat, mask, bigShield }
 * 職業（data/jobs.js）ごとに色と武器が変わる。swordMat・armorMat は個体ごと（dispose はしない：プレイヤーは数人だけ）
 */
export function makeHero(look) {
  const swordMat = new THREE.MeshStandardMaterial({ color: look.swordColor, metalness: 0.5, roughness: 0.35, flatShading: true, emissive: 0x000000 });
  const armorMat = new THREE.MeshStandardMaterial({ color: look.armorColor, roughness: 0.7, flatShading: true, emissive: 0x000000 });
  const h = humanoid({ clothMat: armorMat, pants: 0x3e2f23 });
  const hair = mat(0x5a3a1a);
  const cape = look.cape ?? 0xb71c1c;
  const weapon = look.weapon || 'sword';
  part(box(0.56, 0.16, 0.56), hair, 0, 2.13, -0.02, h.root);
  part(box(0.56, 0.32, 0.12), hair, 0, 1.96, -0.24, h.root);
  if (look.hat) {
    // とんがり帽子（魔法使い・僧侶など）
    part(box(0.7, 0.06, 0.7), mat(look.hat), 0, 2.2, 0, h.root);
    part(cone(0.3, 0.6, 6), mat(look.hat), 0, 2.52, 0, h.root);
  } else {
    part(box(0.5, 0.06, 0.3), mat(cape), 0, 2.02, 0.05, h.root); // はちまき
  }
  if (look.mask) part(box(0.52, 0.18, 0.06), mat(0x212121), 0, 1.78, 0.25, h.root); // 忍者の覆面
  // マント
  part(box(0.66, 0.9, 0.06), mat(cape), 0, 1.1, -0.26, h.root);
  // 武器（右腕の延長方向に伸びる）
  const sword = new THREE.Group();
  sword.position.set(0, -0.72, 0);
  h.armR.add(sword);
  let blade;
  if (weapon === 'staff') {
    blade = part(box(0.07, 1.6, 0.07), mat(0x6d4c41), 0, -0.5, 0, sword);
    part(sphere(0.16, 8, 6), swordMat, 0, -1.3, 0, sword);
    swordMat.emissive.setHex(0x000000);
  } else if (weapon === 'bow') {
    blade = part(box(0.06, 1.3, 0.06), swordMat, 0, -0.2, 0.12, sword);
    part(box(0.02, 1.2, 0.02), mat(0xeeeeee), 0, -0.2, 0.0, sword);
  } else if (weapon === 'lute') {
    blade = part(box(0.08, 0.6, 0.08), mat(0x6d4c41), 0, -0.3, 0, sword);
    part(box(0.36, 0.42, 0.14), swordMat, 0, -0.75, 0, sword);
  } else if (weapon === 'spear') {
    blade = part(box(0.07, 2.2, 0.07), mat(0x6d4c41), 0, -0.6, 0, sword);
    part(cone(0.1, 0.4, 4), swordMat, 0, -1.85, 0, sword).rotation.x = Math.PI;
  } else if (weapon === 'fist') {
    // 籠手（武器は持たない）
    blade = part(box(0.22, 0.22, 0.24), swordMat, 0, 0.05, 0, sword);
    part(box(0.22, 0.22, 0.24), swordMat, 0, -0.67, 0, h.armL);
  } else if (weapon === 'flask') {
    blade = part(box(0.06, 0.18, 0.06), mat(0xeeeeee), 0, -0.05, 0, sword);
    part(sphere(0.17, 8, 6), swordMat, 0, -0.28, 0, sword);
  } else if (weapon === 'axe') {
    blade = part(box(0.08, 1.4, 0.08), mat(0x5d4037), 0, -0.5, 0, sword);
    part(box(0.08, 0.5, 0.55), swordMat, 0, -1.05, 0.22, sword);
  } else if (weapon === 'gun') {
    blade = part(box(0.12, 1.1, 0.12), mat(0x424242), 0, -0.35, 0.05, sword);
    part(box(0.14, 0.3, 0.22), mat(0x6d4c41), 0, 0.15, 0.05, sword);
  } else if (weapon === 'scythe') {
    blade = part(box(0.07, 2.0, 0.07), mat(0x263238), 0, -0.5, 0, sword);
    part(box(0.9, 0.1, 0.05), swordMat, 0.38, -1.45, 0, sword).rotation.z = -0.35;
  } else if (weapon === 'mace') {
    part(box(0.1, 0.22, 0.1), mat(0x4e342e), 0, -0.04, 0, sword);
    blade = part(box(0.1, 0.8, 0.1), mat(0x546e7a), 0, -0.5, 0, sword);
    part(box(0.3, 0.3, 0.3), swordMat, 0, -0.95, 0, sword);
  } else {
    // 剣・短刀
    part(box(0.1, 0.22, 0.1), mat(0x4e342e), 0, -0.04, 0, sword);
    part(box(0.36, 0.06, 0.12), mat(0x8d6e63), 0, -0.16, 0, sword);
    blade = part(box(0.08, 1, 0.18), swordMat, 0, -0.7, 0, sword);
    blade.scale.y = look.swordLen;
    blade.position.y = -0.2 - 0.5 * look.swordLen;
  }
  // 盾（重騎士は大盾。飛び道具の職業は持たない）
  if (look.bigShield) part(box(0.1, 1.0, 0.7), armorMat, -0.16, -0.5, 0.05, h.armL);
  else if (weapon === 'sword' || weapon === 'mace' || weapon === 'spear') part(box(0.08, 0.55, 0.46), armorMat, -0.14, -0.42, 0.05, h.armL);
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
/**
 * ボスの形。look: { scale, horn, eye, weapon: club|sword|staff|scythe, metal }（省略時はガルドラ）
 * 武器は右腕の先に付く
 */
export function makeBossModel(color, look = {}) {
  if (look.monster) return makeMonsterModel(color, look);
  const { scale = 2.5, horn: hornColor = 0xf5f0e1, eye = 0xffea00, weapon = 'club', metal = 0x37474f } = look;
  const bodyMat = ownMat(color);
  bodyMat.emissive = new THREE.Color(0x000000);
  const h = humanoid({ clothMat: bodyMat, skinMat: bodyMat, pants: 0x2b1b17, eye });
  h.group.scale.setScalar(scale);
  const horn = mat(hornColor);
  const hl = part(cone(0.1, 0.5, 5), horn, -0.22, 2.25, 0, h.root);
  hl.rotation.z = 0.5;
  const hr = part(cone(0.1, 0.5, 5), horn, 0.22, 2.25, 0, h.root);
  hr.rotation.z = -0.5;
  part(box(0.9, 0.2, 0.55), mat(metal), 0, 1.58, 0, h.root); // 肩鎧
  part(box(0.74, 0.18, 0.46), mat(metal), 0, 0.88, 0, h.root); // 腰帯
  if (weapon === 'scythe') {
    // 冥王：角を1本増やしてマント
    const c = part(cone(0.08, 0.6, 5), horn, 0, 2.35, 0.05, h.root);
    c.rotation.x = -0.2;
    part(box(0.95, 1.3, 0.06), mat(0x1a0026), 0, 1.0, -0.28, h.root);
  }
  // 武器（右手）
  const wpn = new THREE.Group();
  wpn.position.set(0, -0.7, 0);
  h.armR.add(wpn);
  const glow = (c) => mat(c, { emissive: c, emissiveIntensity: 1.2 });
  if (weapon === 'sword') {
    part(box(0.3, 0.08, 0.12), mat(0x5d4037), 0, -0.05, 0, wpn);
    part(box(0.12, 1.5, 0.06), glow(0xff7043), 0, -0.85, 0, wpn);
  } else if (weapon === 'staff') {
    part(cyl(0.04, 0.04, 1.6, 6), mat(0x5d4037), 0, -0.3, 0, wpn);
    part(sphere(0.18, 8, 6), glow(0x80deea), 0, -1.15, 0, wpn);
  } else if (weapon === 'scythe') {
    part(cyl(0.04, 0.04, 1.8, 6), mat(0x212121), 0, -0.4, 0, wpn);
    const blade = part(box(0.9, 0.12, 0.05), glow(0xea80fc), 0.4, -1.25, 0, wpn);
    blade.rotation.z = -0.35;
  } else {
    // 金棒
    part(cyl(0.05, 0.05, 0.4, 6), mat(0x4e342e), 0, -0.1, 0, wpn);
    part(cyl(0.16, 0.1, 1.0, 6), mat(0x455a64), 0, -0.75, 0, wpn);
  }
  h.armR.rotation.x = -0.4;
  return { ...h, bodyMat, club: wpn };
}

// ---------------- モンスター（ステージ4：竜・獣・多頭の蛇） ----------------
/**
 * 人型ボスと同じ部品（root・armL・armR・legL・legR・bodyMat）を持たせて、boss.js の動きをそのまま使えるようにする
 *   dragon：armL/armR＝翼、legL/legR＝後ろ脚 / beast：armL/armR＝前脚（wings で翼も） / hydra：armL/armR＝左右の首
 * look: { monster, scale, horn, eye, belly, wings }
 */
export function makeMonsterModel(color, look = {}) {
  const { monster, scale = 2, horn: hornColor = 0xeeeeee, eye = 0xffea00, belly = 0xd7ccc8 } = look;
  const bodyMat = ownMat(color);
  bodyMat.emissive = new THREE.Color(0x000000);
  const group = new THREE.Group();
  const root = pivot(group, 0, 0, 0);
  const horn = mat(hornColor);
  const em = mat(eye, { emissive: eye, emissiveIntensity: 1.2 });
  const bel = mat(belly);
  const legs = (x, z, h, w) => {
    const pv = pivot(root, x, h, z);
    part(box(w, h, w * 1.1), bodyMat, 0, -h / 2, 0, pv);
    part(box(w * 1.3, 0.18, w * 1.6), horn, 0, -h + 0.05, 0.08, pv); // 爪
    return pv;
  };
  let armL;
  let armR;
  let legL;
  let legR;
  if (monster === 'hydra') {
    // 胴（丸い山）と3本の首。左右の首を armL / armR に
    part(box(2.4, 1.4, 2.6), bodyMat, 0, 0.9, 0, root);
    part(box(1.8, 0.5, 2.0), bel, 0, 0.35, 0.1, root);
    const neck = (pv, len) => {
      part(box(0.45, len, 0.45), bodyMat, 0, len / 2, 0, pv);
      const head = part(box(0.75, 0.55, 0.95), bodyMat, 0, len + 0.15, 0.25, pv);
      part(box(0.12, 0.12, 0.05), em, -0.2, len + 0.3, 0.73, pv);
      part(box(0.12, 0.12, 0.05), em, 0.2, len + 0.3, 0.73, pv);
      part(cone(0.08, 0.35, 4), horn, 0, len + 0.55, 0.05, pv);
      return head;
    };
    const mid = pivot(root, 0, 1.5, 0.6);
    neck(mid, 2.2);
    armL = pivot(root, -0.8, 1.4, 0.5);
    neck(armL, 1.7);
    armL.rotation.z = 0.35;
    armR = pivot(root, 0.8, 1.4, 0.5);
    neck(armR, 1.7);
    armR.rotation.z = -0.35;
    legL = legs(-0.8, -0.6, 0.5, 0.45);
    legR = legs(0.8, -0.6, 0.5, 0.45);
    part(box(0.5, 0.4, 1.6), bodyMat, 0, 0.6, -1.9, root); // しっぽ
  } else {
    const dragon = monster === 'dragon';
    // 胴・腹・首・頭・しっぽ（共通）
    part(box(1.4, 1.1, 2.6), bodyMat, 0, 1.7, 0, root);
    part(box(1.1, 0.4, 2.2), bel, 0, 1.15, 0.05, root);
    const neckLen = dragon ? 1.1 : 0.5;
    const nk = part(box(0.6, neckLen, 0.6), bodyMat, 0, 2.2 + neckLen / 2 - 0.2, 1.3, root);
    nk.rotation.x = 0.5;
    const hy = 2.3 + neckLen;
    part(box(0.8, 0.7, 1.1), bodyMat, 0, hy, 1.75, root); // 頭
    part(box(0.6, 0.3, 0.6), bodyMat, 0, hy - 0.2, 2.45, root); // 口先
    part(box(0.12, 0.12, 0.05), em, -0.25, hy + 0.12, 2.31, root);
    part(box(0.12, 0.12, 0.05), em, 0.25, hy + 0.12, 2.31, root);
    const hl = part(cone(0.1, 0.6, 5), horn, -0.25, hy + 0.5, 1.5, root);
    hl.rotation.x = -0.6;
    const hr = part(cone(0.1, 0.6, 5), horn, 0.25, hy + 0.5, 1.5, root);
    hr.rotation.x = -0.6;
    const tail = part(box(0.45, 0.4, 2.2), bodyMat, 0, 1.5, -2.2, root);
    tail.rotation.x = -0.2;
    part(cone(0.25, 0.6, 4), horn, 0, 1.25, -3.35, root).rotation.x = -Math.PI / 2;
    // 背中のとげ
    for (let i = 0; i < 4; i++) part(cone(0.12, 0.4, 4), horn, 0, 2.4, 0.9 - i * 0.6, root);
    legL = legs(-0.55, -0.8, 1.2, 0.42);
    legR = legs(0.55, -0.8, 1.2, 0.42);
    if (dragon || look.wings) {
      // 翼（肩から横へ広がる板）を armL / armR に
      const wing = (side) => {
        const pv = pivot(root, side * 0.6, 2.2, 0.3);
        const bone = part(box(2.8, 0.12, 0.2), bodyMat, side * 1.4, 0, 0, pv);
        bone.rotation.z = side * 0.25;
        const memb = part(box(2.6, 0.05, 1.6), mat(look.wingColor ?? 0x5d4037), side * 1.35, -0.1, -0.7, pv);
        memb.rotation.z = side * 0.25;
        return pv;
      };
      armL = wing(-1);
      armR = wing(1);
      // 竜の前脚は小さめ（動かない）
      if (dragon) {
        legs(-0.5, 0.8, 1.0, 0.36);
        legs(0.5, 0.8, 1.0, 0.36);
      } else {
        legs(-0.55, 0.85, 1.2, 0.42);
        legs(0.55, 0.85, 1.2, 0.42);
      }
    } else {
      // 獣：前脚を armL / armR に
      armL = legs(-0.55, 0.85, 1.2, 0.42);
      armR = legs(0.55, 0.85, 1.2, 0.42);
    }
    if (look.mane) part(box(1.6, 1.2, 0.6), mat(look.mane), 0, 2.2, 1.0, root); // たてがみ
  }
  group.scale.setScalar(scale);
  return { group, root, armL, armR, legL, legR, bodyMat };
}
