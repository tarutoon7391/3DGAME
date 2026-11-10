// 動物：ニワトリ・ウシの見た目と歩き回り、エサやり・なでる・なつき度・翌朝の生産物
import * as THREE from 'three';
import { ANIMALS, AFFECTION, qualityOf } from './data/balance.js';
import { ITEMS, productId } from './data/items.js';
import { addItem } from './state.js';
import { PENS, mat } from './world.js';

const NAMES = { chicken: ['ピヨ', 'コッコ', 'タマ', 'ハナ'], cow: ['モー太', 'ミルク'] };

function part(parent, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function makeChicken() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  part(body, 0.4, 0.35, 0.5, 0xfafafa, 0, 0.38, 0);
  part(body, 0.25, 0.28, 0.25, 0xfafafa, 0, 0.62, 0.22);
  part(body, 0.08, 0.1, 0.16, 0xe53935, 0, 0.8, 0.22);
  part(body, 0.08, 0.06, 0.1, 0xffa000, 0, 0.6, 0.38);
  part(body, 0.2, 0.2, 0.12, 0xeeeeee, 0, 0.45, -0.28);
  part(g, 0.05, 0.22, 0.05, 0xffa000, -0.1, 0.11, 0);
  part(g, 0.05, 0.22, 0.05, 0xffa000, 0.1, 0.11, 0);
  g.userData.body = body;
  return g;
}

function makeCow() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  part(body, 0.8, 0.7, 1.4, 0xf5f5f5, 0, 0.95, 0);
  part(body, 0.82, 0.4, 0.5, 0x212121, 0, 1.05, 0.2);
  part(body, 0.5, 0.3, 0.4, 0x212121, 0.16, 1.15, -0.4);
  part(body, 0.5, 0.5, 0.55, 0xf5f5f5, 0, 1.15, 0.85);
  part(body, 0.4, 0.25, 0.2, 0xf8bbd0, 0, 1.0, 1.15);
  part(body, 0.08, 0.15, 0.08, 0xd7ccc8, -0.2, 1.45, 0.8);
  part(body, 0.08, 0.15, 0.08, 0xd7ccc8, 0.2, 1.45, 0.8);
  for (const [x, z] of [[-0.28, 0.5], [0.28, 0.5], [-0.28, -0.5], [0.28, -0.5]]) part(g, 0.16, 0.6, 0.16, 0xeeeeee, x, 0.3, z);
  g.userData.body = body;
  return g;
}

export function createAnimals(scene, state) {
  const group = new THREE.Group();
  scene.add(group);
  let live = []; // { a: 状態, mesh, tx, tz, wait }
  let productMeshes = [];
  const eggGeo = new THREE.SphereGeometry(0.11, 8, 6);
  eggGeo.scale(1, 1.3, 1);
  const milkGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.35, 8);
  const qualityMat = [mat(0xffffff), mat(0xffe082, { emissive: 0x6d4c00, emissiveIntensity: 0.3 }), mat(0xffd54f, { emissive: 0xff8f00, emissiveIntensity: 0.5 })];

  function pickTarget(l) {
    const p = PENS[l.a.type];
    l.tx = p.minX + 1 + Math.random() * (p.maxX - p.minX - 2);
    l.tz = p.minZ + 3.5 + Math.random() * (p.maxZ - p.minZ - 4.5);
    l.wait = 1 + Math.random() * 3;
  }

  /** 状態から作り直す（ロード・購入時） */
  function sync() {
    for (const l of live) group.remove(l.mesh);
    for (const m of productMeshes) group.remove(m);
    live = state.animals.map((a) => {
      const mesh = a.type === 'cow' ? makeCow() : makeChicken();
      mesh.position.set(a.x, 0, a.z);
      group.add(mesh);
      const l = { a, mesh, tx: a.x, tz: a.z, wait: Math.random() * 2, bob: Math.random() * 6 };
      return l;
    });
    productMeshes = state.products.map((p) => {
      const it = ITEMS[p.item];
      const m = new THREE.Mesh(it.base === 'milk' ? milkGeo : eggGeo, qualityMat[it.quality ?? 0]);
      m.position.set(p.x, it.base === 'milk' ? 0.18 : 0.13, p.z);
      m.castShadow = true;
      group.add(m);
      return m;
    });
  }

  function nearest(list, x, z, maxD, getPos, filter = null) {
    let best = null;
    let bd = maxD * maxD;
    list.forEach((o, i) => {
      if (filter && !filter(o)) return;
      const p = getPos(o);
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  return {
    sync,
    count: (type) => state.animals.filter((a) => a.type === type).length,
    /** 購入 */
    add(type) {
      const used = state.animals.filter((a) => a.type === type).map((a) => a.name);
      const name = NAMES[type].find((n) => !used.includes(n)) ?? ANIMALS[type].name;
      const p = PENS[type];
      state.animals.push({ type, name, aff: 0, fed: false, petted: false, x: p.maxX - 1.5, z: (p.gate[0] + p.gate[1]) / 2 });
      sync();
      return name;
    },
    /** 近くの動物（filter で条件を絞れる。例：まだエサをもらっていない子） */
    nearestAnimal(x, z, maxD, filter = null) {
      const i = nearest(live, x, z, maxD + 0.3, (l) => l.mesh.position, filter);
      return i === null ? null : live[i];
    },
    nearestProduct(x, z, maxD) {
      return nearest(productMeshes, x, z, maxD, (m) => m.position);
    },
    /** エサやり（その日まだなら true） */
    feed(l) {
      if (l.a.fed) return false;
      l.a.fed = true;
      l.a.aff = Math.min(100, l.a.aff + AFFECTION.feed);
      l.wait = 2;
      l.hop = 1;
      return true;
    },
    pet(l) {
      if (l.a.petted) return false;
      l.a.petted = true;
      l.a.aff = Math.min(100, l.a.aff + AFFECTION.pet);
      l.hop = 1;
      return true;
    },
    /** 生産物を拾う。拾ったアイテム id を返す */
    collect(i) {
      const p = state.products[i];
      if (!p) return null;
      addItem(state, p.item, 1);
      state.products.splice(i, 1);
      sync();
      return p.item;
    },
    productPos(i) { return productMeshes[i]?.position; },
    /** 翌朝：エサをもらった動物は生産物を出し、もらえなかった動物はなつき度が下がる */
    newDay() {
      let made = 0;
      let hungry = 0;
      for (const a of state.animals) {
        if (a.fed) {
          const base = ANIMALS[a.type].product;
          const ox = (Math.random() - 0.5) * 0.6;
          state.products.push({ item: productId(base, qualityOf(a.aff)), x: a.x + ox, z: a.z + 0.4 });
          made++;
        } else {
          a.aff = Math.max(0, a.aff + AFFECTION.hungry);
          hungry++;
        }
        a.fed = false;
        a.petted = false;
      }
      // 地面に残る生産物は増えすぎないように
      if (state.products.length > 20) state.products.splice(0, state.products.length - 20);
      sync();
      return { made, hungry };
    },
    update(dt, time) {
      for (const l of live) {
        const m = l.mesh;
        const dx = l.tx - m.position.x;
        const dz = l.tz - m.position.z;
        const d = Math.hypot(dx, dz);
        const speed = l.a.type === 'cow' ? 0.7 : 1.1;
        let moving = false;
        if (l.wait > 0) l.wait -= dt;
        else if (d > 0.1) {
          m.position.x += (dx / d) * speed * dt;
          m.position.z += (dz / d) * speed * dt;
          const target = Math.atan2(dx, dz);
          const diff = Math.atan2(Math.sin(target - m.rotation.y), Math.cos(target - m.rotation.y));
          m.rotation.y += diff * Math.min(1, dt * 5);
          moving = true;
        } else pickTarget(l);
        l.a.x = m.position.x;
        l.a.z = m.position.z;
        l.bob += dt * (moving ? 10 : 2);
        const body = m.userData.body;
        body.position.y = moving ? Math.abs(Math.sin(l.bob)) * 0.05 : 0;
        if (l.a.type === 'chicken' && !moving) body.rotation.x = Math.max(0, Math.sin(l.bob * 1.3)) * 0.4;
        if (l.hop > 0) {
          l.hop = Math.max(0, l.hop - dt * 2.5);
          m.position.y = Math.sin(l.hop * Math.PI) * 0.35;
        }
      }
      productMeshes.forEach((m, i) => { m.rotation.y = time + i; });
    },
  };
}
