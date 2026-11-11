// 職業ごとの手持ち武器（一人称ビューモデル用）。形は src/data/weapons_a〜d.js のデータで、
// ここはデータ（プリミティブの部品の並び）から THREE.Group を組み立てるだけ。
//
// 座標の約束（1 = 1m。ビューモデルの剣は刃 0.5m くらい）
//   hold 'up'  … 握りが原点、武器は +Y へ伸びる（剣・杖・槍など。手で立てて持つ）
//   hold 'aim' … 握りが原点、銃口・先端は -Z（前）へ向く（銃・弓・投げ物など）
//   hold 'fist'… 手（原点）にかぶせる籠手・爪など
// 色の指定：'m' 職業の武器色（look.swordColor）／'a' 職業の色（job.color）／'r' 防具色（look.armorColor）
//   'g' 握り革／'w' 木／'W' 濃い木／'d' 黒鉄／'s' 鋼／'au' 金／'wh' 白／'k' 黒／'red' 赤
//   数値はそのままの色。G(色) は光る部品（宝石・刃の魔力など）
import * as THREE from 'three';
import { WEAPONS_A } from './data/weapons_a.js';
import { WEAPONS_B } from './data/weapons_b.js';
import { WEAPONS_C } from './data/weapons_c.js';
import { WEAPONS_D } from './data/weapons_d.js';

/** 職業 id → 武器の形（全96職。足りない職は剣士の剣） */
export const WEAPONS = { ...WEAPONS_A, ...WEAPONS_B, ...WEAPONS_C, ...WEAPONS_D };

const NAMED = {
  g: 0x4e342e, w: 0x8d6e63, W: 0x6d4c41, d: 0x37474f, s: 0xb0bec5, au: 0xffc107,
  wh: 0xeceff1, k: 0x212121, red: 0xc62828,
};

/** 持ち方ごとの、手に対する武器の向き（ビューモデル用） */
export const HOLD_ROT = {
  up: [0.45, 0, 0.3], // 少し前と内側へ傾けて立てる（旧仕様の剣と同じ）
  aim: [0.04, 0.06, 0], // 前へ向けて構える
  fist: [0.15, 0, 0],
};
/** 持ち方ごとの、手に対する武器の位置（銃などは手前に引き寄せて大きく見せる） */
export const HOLD_POS = {
  up: [0, 0, 0],
  aim: [-0.08, 0.13, 0.24],
  fist: [-0.02, 0.14, 0.02],
};

const geoCache = new Map();
function geo(kind, a) {
  const key = kind + a.join(',');
  let g = geoCache.get(key);
  if (g) return g;
  if (kind === 'b') g = new THREE.BoxGeometry(a[0], a[1], a[2]);
  else if (kind === 'c') g = new THREE.CylinderGeometry(a[0], a[1], a[2], a[3] || 8, 1, false, a[4] || 0, a[5] || Math.PI * 2);
  else if (kind === 's') g = new THREE.SphereGeometry(a[0], a[1] || 8, a[2] || 6);
  else if (kind === 'k') g = new THREE.ConeGeometry(a[0], a[1], a[2] || 6);
  else if (kind === 't') g = new THREE.TorusGeometry(a[0], a[1], 6, a[2] || 12, a[3] || Math.PI * 2);
  else if (kind === 'o') g = new THREE.OctahedronGeometry(a[0], 0);
  geoCache.set(key, g);
  return g;
}

/**
 * 武器を組み立てる
 * @param {string} id 職業 id
 * @param {{metal:number, accent:number, armor:number}} colors
 * @param {(color:number, extra:object)=>THREE.Material} makeMat 材質の作り方（ビューモデルは描画順の都合で専用）
 * @returns {{ group: THREE.Group, hold: string, flashMats: THREE.Material[], mats: THREE.Material[] }}
 *   flashMats … 攻撃のときに光らせる材質（金属・刃）
 */
export function buildWeapon(id, colors, makeMat) {
  const spec = WEAPONS[id] || WEAPONS.swordsman;
  const group = new THREE.Group();
  const mats = [];
  const flashMats = [];
  const matCache = new Map();
  const resolve = (c) => {
    if (c === 'm') return colors.metal;
    if (c === 'a') return colors.accent;
    if (c === 'r') return colors.armor;
    if (typeof c === 'string') return NAMED[c] ?? 0xff00ff;
    return c;
  };
  const getMat = (c) => {
    const glow = typeof c === 'object' && c !== null;
    const col = resolve(glow ? c.c : c);
    const key = (glow ? 'G' : '') + col;
    let m = matCache.get(key);
    if (m) return m;
    const metal = c === 'm' || c === 's' || c === 'd' || c === 'au';
    const extra = glow
      ? { emissive: col, emissiveIntensity: 0.7, roughness: 0.4 }
      : metal ? { metalness: 0.55, roughness: 0.35, emissive: 0x000000 } : { emissive: 0x000000 };
    m = makeMat(col, extra);
    matCache.set(key, m);
    mats.push(m);
    if (metal || c === 'a') flashMats.push(m);
    return m;
  };
  for (const [kind, args, c, pos, rot, scl] of spec.parts) {
    const mesh = new THREE.Mesh(geo(kind, args), getMat(c));
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    if (scl) mesh.scale.set(scl[0], scl[1], scl[2]);
    group.add(mesh);
  }
  if (spec.scale) group.scale.setScalar(spec.scale);
  return { group, hold: spec.hold || 'up', rot: spec.rot, pos: spec.pos, flashMats, mats };
}
