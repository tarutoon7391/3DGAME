// 畑：マスの状態変更（耕す・水やり・種まき・収穫・成長）と InstancedMesh での描画
import * as THREE from 'three';
import { CROPS } from './data/crops.js';
import { GRID, fieldSize, addItem } from './state.js';
import { FIELD_X0, FIELD_Z0, mat } from './world.js';

const N = GRID * GRID;
const COL = {
  grass: new THREE.Color(0x93c96b),
  dry: new THREE.Color(0xa0703f),
  wet: new THREE.Color(0x5b3a20),
  mound: new THREE.Color(0x7a5230),
};

/** 作物の成長段階 0:種 1:芽 2:成長中 3:収穫可 */
export function stageOf(tile) {
  const c = CROPS[tile.c];
  if (!c) return -1;
  if (tile.g >= c.days) return 3;
  if (tile.g <= 0) return 0;
  return tile.g / c.days < 0.5 ? 1 : 2;
}

export function createField(scene, state) {
  const soil = new THREE.InstancedMesh(new THREE.BoxGeometry(0.94, 0.08, 0.94), mat(0xffffff), N);
  const mound = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x7a5230), N);
  const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 0), mat(0xffffff), N * 2);
  const stalk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 1, 5), mat(0x689f38), N);
  const fruit = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 1), mat(0xffffff), N * 3);
  for (const m of [soil, mound, leaf, stalk, fruit]) {
    m.castShadow = m !== soil;
    m.receiveShadow = true;
    m.count = 0;
    scene.add(m);
  }
  soil.castShadow = false;
  // 色バッファを確保
  soil.setColorAt(0, COL.grass);
  leaf.setColorAt(0, COL.grass);
  fruit.setColorAt(0, COL.grass);

  // 畑の枠（木の縁）
  const borderMat = mat(0x8d6e63);
  const borders = [0, 1, 2, 3].map(() => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 0.18, 0.12), borderMat);
    b.castShadow = b.receiveShadow = true;
    scene.add(b);
    return b;
  });

  // 狙っているマスのカーソル
  const cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  const cursorGeo = new THREE.PlaneGeometry(0.96, 0.96);
  cursorGeo.rotateX(-Math.PI / 2);
  const cursor = new THREE.InstancedMesh(cursorGeo, cursorMat, 9);
  cursor.count = 0;
  cursor.renderOrder = 2;
  scene.add(cursor);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  let dirty = true;

  const hash = (i) => {
    const x = Math.sin(i * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  const cx = (i) => FIELD_X0 + i + 0.5;
  const cz = (j) => FIELD_Z0 + j + 0.5;

  function put(mesh, idx, x, y, z, sx, sy, sz, rot = 0, color = null) {
    e.set(0, rot, 0);
    q.setFromEuler(e);
    mesh.setMatrixAt(idx, m4.compose(p.set(x, y, z), q, s.set(sx, sy, sz)));
    if (color) mesh.setColorAt(idx, color);
  }

  /** 状態から全インスタンスを組み直す（変化があったときだけ） */
  function rebuild() {
    const size = fieldSize(state);
    let ns = 0, nm = 0, nl = 0, nt = 0, nf = 0;
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const idx = j * GRID + i;
        const t = state.tiles[idx];
        const x = cx(i);
        const z = cz(j);
        put(soil, ns++, x, t.t ? 0.03 : 0.0, z, 1, t.t ? 1 : 0.4, 1, 0, t.t ? (t.w ? COL.wet : COL.dry) : COL.grass);
        const st = stageOf(t);
        if (st < 0) continue;
        const crop = CROPS[t.c];
        const r = hash(idx) * Math.PI * 2;
        const lc = c.set(crop.leaf);
        if (st === 0) {
          put(mound, nm++, x, 0.06, z, 1, 1, 1, r);
          continue;
        }
        if (st === 1) {
          put(leaf, nl++, x, 0.15, z, 0.35, 0.5, 0.35, r, lc);
          continue;
        }
        const mature = st === 3;
        switch (crop.shape) {
          case 'root':
            put(leaf, nl++, x, 0.3, z, mature ? 0.8 : 0.6, mature ? 0.9 : 0.7, mature ? 0.8 : 0.6, r, lc);
            if (mature) put(fruit, nf++, x, 0.12, z, 1.1, 0.9, 1.1, r, c.set(crop.fruit));
            break;
          case 'bush':
            put(stalk, nt++, x, 0.3, z, 1, 0.6, 1, r);
            put(leaf, nl++, x, 0.55, z, 0.95, 1.1, 0.95, r, lc);
            put(leaf, nl++, x, 0.25, z, 0.7, 0.6, 0.7, r + 1, lc);
            if (mature) {
              for (let k = 0; k < 3; k++) {
                const a = r + (k * Math.PI * 2) / 3;
                put(fruit, nf++, x + Math.cos(a) * 0.25, 0.35 + k * 0.12, z + Math.sin(a) * 0.25, 0.6, 0.6, 0.6, 0, c.set(crop.fruit));
              }
            }
            break;
          case 'tall': {
            const h = mature ? 1.5 : 0.9;
            put(stalk, nt++, x, h / 2, z, 1.3, h, 1.3, r);
            put(leaf, nl++, x, h * 0.35, z, 0.75, 0.8, 0.75, r, lc);
            put(leaf, nl++, x, h * 0.75, z, 0.55, 0.7, 0.55, r + 1, lc);
            if (mature) put(fruit, nf++, x + 0.12, h * 0.6, z, 0.55, 1.4, 0.55, 0, c.set(crop.fruit));
            break;
          }
          case 'big':
            put(leaf, nl++, x - 0.15, 0.15, z + 0.1, 0.9, 0.45, 0.9, r, lc);
            put(leaf, nl++, x + 0.2, 0.15, z - 0.15, 0.7, 0.4, 0.7, r + 1, lc);
            if (mature) put(fruit, nf++, x, 0.24, z, 1.7, crop === CROPS.pumpkin ? 1.15 : 1.5, 1.7, r, c.set(crop.fruit));
            else put(fruit, nf++, x, 0.12, z, 0.6, 0.55, 0.6, r, c.set(crop.leaf).multiplyScalar(1.2));
            break;
        }
      }
    }
    soil.count = ns; mound.count = nm; leaf.count = nl; stalk.count = nt; fruit.count = nf;
    for (const m of [soil, mound, leaf, stalk, fruit]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // 枠
    const w = size;
    const x0 = FIELD_X0;
    const z0 = FIELD_Z0;
    borders[0].position.set(x0 + w / 2, 0.09, z0 - 0.06); borders[0].scale.set(w + 0.24, 1, 1); borders[0].rotation.y = 0;
    borders[1].position.set(x0 + w / 2, 0.09, z0 + w + 0.06); borders[1].scale.set(w + 0.24, 1, 1); borders[1].rotation.y = 0;
    borders[2].position.set(x0 - 0.06, 0.09, z0 + w / 2); borders[2].scale.set(w + 0.24, 1, 1); borders[2].rotation.y = Math.PI / 2;
    borders[3].position.set(x0 + w + 0.06, 0.09, z0 + w / 2); borders[3].scale.set(w + 0.24, 1, 1); borders[3].rotation.y = Math.PI / 2;
    dirty = false;
  }

  /** ワールド座標 → マス（畑の外なら null） */
  function tileAt(x, z) {
    const i = Math.floor(x - FIELD_X0);
    const j = Math.floor(z - FIELD_Z0);
    const size = fieldSize(state);
    if (i < 0 || j < 0 || i >= size || j >= size) return null;
    return { i, j };
  }

  /** 道具レベルに応じた対象マス（前方1 / 前方3 / 前方3×3） */
  function targetTiles(i, j, dx, dz, lv) {
    const out = [];
    const size = fieldSize(state);
    const add = (a, b) => { if (a >= 0 && b >= 0 && a < size && b < size) out.push({ i: a, j: b }); };
    if (lv <= 1) add(i, j);
    else if (lv === 2) for (let f = 0; f < 3; f++) add(i + dx * f, j + dz * f);
    else for (let f = 0; f < 3; f++) for (let sd = -1; sd <= 1; sd++) add(i + dx * f + dz * sd, j + dz * f + dx * sd);
    return out;
  }

  const tile = ({ i, j }) => state.tiles[j * GRID + i];

  return {
    tileAt,
    targetTiles,
    tile,
    center: ({ i, j }, out) => out.set(cx(i), 0, cz(j)),
    markDirty() { dirty = true; },
    /** カーソル表示（tiles が空なら隠す）。ok で色を変える */
    showCursor(tiles, ok) {
      cursor.count = tiles.length;
      tiles.forEach((t, k) => cursor.setMatrixAt(k, m4.makeTranslation(cx(t.i), 0.1, cz(t.j))));
      cursor.instanceMatrix.needsUpdate = true;
      cursorMat.color.setHex(ok ? 0xfff59d : 0xffffff);
      cursorMat.opacity = ok ? 0.45 : 0.18;
    },
    update(time) {
      if (dirty) rebuild();
      cursorMat.opacity *= 0.98 + Math.sin(time * 6) * 0.02;
    },

    // ---- 操作（変化したマス数などを返す） ----
    till(tiles, rain) {
      let n = 0;
      for (const t of tiles.map(tile)) {
        if (t.t === 0) { t.t = 1; t.w = rain ? 1 : 0; n++; }
      }
      if (n) dirty = true;
      return n;
    },
    water(tiles, amount) {
      let n = 0;
      for (const t of tiles.map(tile)) {
        if (n >= amount) break;
        if (t.t === 1 && !t.w) { t.w = 1; n++; }
      }
      if (n) dirty = true;
      return n;
    },
    plant(pos, cropId) {
      const t = tile(pos);
      if (t.t !== 1 || t.c) return false;
      t.c = cropId;
      t.g = 0;
      dirty = true;
      return true;
    },
    /** 収穫できれば作物 id を返す */
    harvest(pos) {
      const t = tile(pos);
      if (stageOf(t) !== 3) return null;
      const crop = CROPS[t.c];
      const id = t.c;
      addItem(state, id, 1);
      if (crop.regrow) t.g = crop.days - crop.regrow;
      else { t.c = null; t.g = 0; }
      dirty = true;
      return id;
    },
    remove(pos) {
      const t = tile(pos);
      if (!t.c) return false;
      t.c = null;
      t.g = 0;
      dirty = true;
      return true;
    },
    /** 翌朝の処理：水をやった作物だけ成長。雨なら耕したマスは全部濡れる */
    newDay(rain) {
      const size = fieldSize(state);
      let grown = 0;
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          const t = state.tiles[j * GRID + i];
          if (t.c && t.w && t.g < CROPS[t.c].days) { t.g++; grown++; }
          t.w = t.t && rain ? 1 : 0;
        }
      }
      dirty = true;
      return grown;
    },
  };
}
