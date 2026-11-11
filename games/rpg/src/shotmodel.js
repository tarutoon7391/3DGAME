// プレイヤーの弾の見た目。形ごとに、色の層ごとに InstancedMesh を1つ作り、同じ形の弾はまとめて1回で描く
// 形のデータは src/data/shots_a.js・shots_b.js、どの弾にどの形を使うかは src/data/shots_map.js
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SHOTS_A } from './data/shots_a.js';
import { SHOTS_B } from './data/shots_b.js';

export const SHOT_LOOKS = { ...SHOTS_A, ...SHOTS_B };

const NAMED = { w: 0x8d6e63, W: 0x6d4c41, d: 0x37474f, s: 0xb0bec5, au: 0xffc107, wh: 0xeceff1, k: 0x212121, red: 0xc62828 };

function partGeo(kind, a) {
  if (kind === 'b') return new THREE.BoxGeometry(a[0], a[1], a[2]);
  if (kind === 'c') return new THREE.CylinderGeometry(a[0], a[1], a[2], a[3] || 8, 1, false, a[4] || 0, a[5] || Math.PI * 2);
  if (kind === 's') return new THREE.SphereGeometry(a[0], 10, 7);
  if (kind === 'k') return new THREE.ConeGeometry(a[0], a[1], a[2] || 6);
  if (kind === 't') return new THREE.TorusGeometry(a[0], a[1], 6, a[2] || 12, a[3] || Math.PI * 2);
  return new THREE.OctahedronGeometry(a[0], 0);
}

const tmpObj = new THREE.Object3D();
/**
 * 形の部品を色の層ごとにまとめる。戻り値：[{ key, geo, glow, tint, color }]
 * key：'t'（弾の色）・'tg'（弾の色で光る）・'c<色>'・'g<色>'（その色で光る）
 */
export function buildShotLayers(spec) {
  const groups = new Map();
  for (const [kind, args, c, pos, rot, scl] of spec.parts) {
    const g = partGeo(kind, args);
    tmpObj.position.set(pos[0], pos[1], pos[2]);
    tmpObj.rotation.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    if (scl) tmpObj.scale.set(scl[0], scl[1], scl[2]);
    else tmpObj.scale.set(1, 1, 1);
    tmpObj.updateMatrix();
    g.applyMatrix4(tmpObj.matrix);
    const geo = g.index ? g.toNonIndexed() : g;
    if (geo !== g) g.dispose();
    let key;
    let layer;
    if (c === 't' || c === 'tg') {
      key = c;
      layer = { tint: true, glow: c === 'tg' };
    } else {
      const glow = typeof c === 'object' && c !== null;
      const col = glow ? c.c : typeof c === 'string' ? NAMED[c] ?? 0xff00ff : c;
      key = (glow ? 'g' : 'c') + col;
      layer = { tint: false, glow, color: col };
    }
    if (!groups.has(key)) groups.set(key, { key, ...layer, geos: [] });
    groups.get(key).geos.push(geo);
  }
  const out = [];
  // 光る層（半透明）は後に描く
  for (const gr of [...groups.values()].sort((a, b) => a.glow - b.glow)) {
    const geo = mergeGeometries(gr.geos, false);
    gr.geos.forEach((g) => g.dispose());
    out.push({ key: gr.key, geo, glow: gr.glow, tint: gr.tint, color: gr.color });
  }
  return out;
}

/** 層の材質。弾の色の層は白にして、インスタンスの色で塗る */
export function shotMaterial(layer) {
  if (layer.glow) {
    return new THREE.MeshBasicMaterial({
      color: layer.tint ? 0xffffff : layer.color, transparent: true, opacity: layer.tint ? 0.24 : 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
  }
  return new THREE.MeshLambertMaterial({
    color: layer.tint ? 0xffffff : layer.color, flatShading: true,
    emissive: layer.tint ? 0x404040 : new THREE.Color(layer.color).multiplyScalar(0.35),
  });
}

/**
 * 弾を描く係（プレイヤーの弾・敵の弾）。毎フレーム begin() → add() を弾の数だけ → end()
 * @param {THREE.Scene} scene
 * @param {number} max 1つの形あたりの最大数
 * @param {object} extra 追加の形（敵の弾など）。同じ名前ならこちらが優先
 */
export function createShotRenderer(scene, max, extra = null) {
  const looks = new Map(); // 名前 → { spec, layers: [{ mesh, tint }], n }
  const tmpColor = new THREE.Color();
  const obj = new THREE.Object3D();
  obj.rotation.order = 'YXZ'; // 向き（Y）→ 縦回り（X）→ 進む向きを軸に回る（Z）

  function getLook(name) {
    let L = looks.get(name);
    if (L) return L;
    const spec = extra?.[name] || SHOT_LOOKS[name] || SHOT_LOOKS.orb;
    const layers = buildShotLayers(spec).map((ly) => {
      const mesh = new THREE.InstancedMesh(ly.geo, shotMaterial(ly), max);
      mesh.frustumCulled = false;
      mesh.count = 0;
      if (ly.tint) mesh.setColorAt(0, tmpColor.setHex(0xffffff)); // instanceColor を作っておく
      scene.add(mesh);
      return { mesh, tint: ly.tint };
    });
    L = { spec, layers, n: 0 };
    looks.set(name, L);
    return L;
  }

  return {
    begin() {
      for (const L of looks.values()) L.n = 0;
    },
    /** name：形、(x,y,z)：位置、yaw：進む向き、age：飛んでいる秒数（回転用）、size：弾の大きさ、color：弾の色 */
    add(name, x, y, z, yaw, age, size, color) {
      const L = getLook(name);
      if (L.n >= max) return;
      const [axis, sp] = L.spec.spin || ['none', 0];
      obj.position.set(x, y, z);
      obj.rotation.set(axis === 'tumble' ? age * sp : 0, yaw + (axis === 'spin' ? age * sp : 0), axis === 'roll' ? age * sp : 0);
      obj.scale.setScalar(size * (L.spec.scale || 1));
      obj.updateMatrix();
      tmpColor.setHex(color);
      for (const ly of L.layers) {
        ly.mesh.setMatrixAt(L.n, obj.matrix);
        if (ly.tint) ly.mesh.setColorAt(L.n, tmpColor);
      }
      L.n++;
    },
    end() {
      for (const L of looks.values()) {
        for (const ly of L.layers) {
          ly.mesh.count = L.n;
          ly.mesh.visible = L.n > 0;
          ly.mesh.instanceMatrix.needsUpdate = true;
          if (ly.mesh.instanceColor) ly.mesh.instanceColor.needsUpdate = true;
        }
      }
    },
    /** 使う形を先に作っておく（撃った瞬間のカクつき防止） */
    warm(names) {
      names.forEach(getLook);
    },
  };
}
