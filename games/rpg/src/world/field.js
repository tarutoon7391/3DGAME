// 風の草原：木・岩・草むら・薬草（採集）。敵の配置は data/areas.js
import * as THREE from 'three';
import { seeded } from '../util.js';
import { addTrees } from './village.js';

export function buildField(ctx) {
  const { def, group } = ctx;
  const b = def.bounds;
  const rnd = seeded(def.seed);

  // 避ける場所（道・ゲート・敵の初期位置・薬草）
  const avoid = [];
  (def.enemies || []).forEach(([, x, z]) => avoid.push([x, z, 3]));
  (def.herbs || []).forEach(([x, z]) => avoid.push([x, z, 2.5]));
  (def.gates || []).forEach((g) => avoid.push([g.x, g.z, 8]));
  (def.signs || []).forEach((s) => avoid.push([s.x, s.z, 3]));
  const free = (x, z, pad = 0) => Math.abs(x) > 4 && avoid.every(([ax, az, r]) => Math.hypot(x - ax, z - az) > r + pad);

  // 道
  const road = new THREE.Mesh(new THREE.PlaneGeometry(5, 100), ctx.mat(0xbfa76f));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  road.receiveShadow = true;
  group.add(road);
  // 草の濃淡パッチ
  const patches = [];
  for (let i = 0; i < 26; i++) patches.push({ x: (rnd() - 0.5) * 96, z: (rnd() - 0.5) * 96, y: 0.005, s: 3 + rnd() * 6 });
  const patchGeo = new THREE.CircleGeometry(1, 10);
  patchGeo.rotateX(-Math.PI / 2);
  ctx.instanced(patchGeo, ctx.mat(0x689f38), patches, { cast: false, receive: true });

  // 木（当たり判定あり）
  const trees = [];
  let guard = 0;
  while (trees.length < def.trees && guard++ < 2000) {
    const x = (rnd() - 0.5) * (b.maxX - b.minX - 4);
    const z = (rnd() - 0.5) * (b.maxZ - b.minZ - 4);
    if (!free(x, z, 1) || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4)) continue;
    const s = 0.9 + rnd() * 0.8;
    trees.push({ x, z, s, ry: rnd() * 6 });
    ctx.colliders.push({ minX: x - 0.45 * s, maxX: x + 0.45 * s, minZ: z - 0.45 * s, maxZ: z + 0.45 * s });
  }
  // 境界の外側の森
  for (let i = 0; i < 110; i++) {
    const side = i % 4;
    const t = (rnd() - 0.5) * 120;
    const o = 53 + rnd() * 10;
    const x = side === 0 ? t : side === 1 ? t : side === 2 ? -o : o;
    const z = side === 0 ? -o : side === 1 ? o : t;
    if (Math.abs(x) < 6 && Math.abs(z) > 45) continue; // ゲートの前は空ける
    trees.push({ x, z, s: 1.2 + rnd() * 0.8, ry: rnd() * 6 });
  }
  addTrees(ctx, trees, 0x388e3c);

  // 岩
  const rocks = [];
  guard = 0;
  while (rocks.length < def.rocks && guard++ < 1000) {
    const x = (rnd() - 0.5) * 94;
    const z = (rnd() - 0.5) * 94;
    if (!free(x, z, 1) || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2.5)) continue;
    const s = 0.7 + rnd() * 1.1;
    rocks.push({ x, z, y: 0.3 * s, s, ry: rnd() * 6, sy: 0.7 });
    ctx.colliders.push({ minX: x - 0.8 * s, maxX: x + 0.8 * s, minZ: z - 0.8 * s, maxZ: z + 0.8 * s, low: s < 1.2 });
  }
  ctx.instanced(new THREE.DodecahedronGeometry(1, 0), ctx.mat(0x8d8d8d), rocks, { cast: true, receive: true });

  // 草むら（見た目だけ）
  const tufts = [];
  for (let i = 0; i < 500; i++) {
    const x = (rnd() - 0.5) * 98;
    const z = (rnd() - 0.5) * 98;
    if (Math.abs(x) < 3) continue;
    tufts.push({ x, z, s: 0.5 + rnd() * 0.6, ry: rnd() * 6 });
  }
  const tuftGeo = new THREE.ConeGeometry(0.18, 0.6, 3);
  tuftGeo.translate(0, 0.3, 0);
  ctx.instanced(tuftGeo, ctx.mat(0x9ccc65), tufts, { cast: false });
  // 花
  const flowers = tufts.filter((_, i) => i % 7 === 0).map((t) => ({ x: t.x + 0.3, z: t.z, y: 0.35, s: 1 }));
  ctx.instanced(new THREE.IcosahedronGeometry(0.12, 0), ctx.mat(0xfff59d), flowers, { cast: false });

  // 薬草（光る草。F で摘む）
  const herbMat = ctx.mat(0x76ff03, { emissive: 0x33aa00, emissiveIntensity: 0.8 });
  const herbGeo = new THREE.OctahedronGeometry(0.28, 0);
  ctx.extra.herbs = [];
  for (const [x, z] of def.herbs) {
    const m = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const leaf = new THREE.Mesh(herbGeo, herbMat);
      leaf.position.set(Math.cos(k * 2.1) * 0.2, 0.3, Math.sin(k * 2.1) * 0.2);
      leaf.scale.set(0.6, 1.4, 0.6);
      leaf.rotation.z = Math.cos(k * 2.1) * 0.4;
      m.add(leaf);
    }
    m.position.set(x, 0, z);
    group.add(m);
    const herb = { x, z, mesh: m, taken: false };
    ctx.extra.herbs.push(herb);
    const it = {
      x, z, r: 1.8, label: '摘む（薬草）', active: true, herb: true,
      action: (game) => {
        if (herb.taken) return;
        herb.taken = true;
        it.active = false;
        m.visible = false;
        game.collectItem('herb', 1, x, z);
      },
    };
    ctx.interactables.push(it);
  }
  ctx.updaters.push((dt, t) => {
    for (const h of ctx.extra.herbs) if (!h.taken) h.mesh.rotation.y = t * 0.8 + h.x;
  });
}
