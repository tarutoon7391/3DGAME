// はじまりの村：家・店・宿屋・NPC・井戸・柵・木
import * as THREE from 'three';
import { NPCS } from '../data/dialogs.js';
import { makeNpc } from '../models.js';
import { seeded } from '../util.js';

export function buildVillage(ctx) {
  const { def, group } = ctx;
  const b = def.bounds;

  // 道（土）
  const path = ctx.mat(0xc8a96e);
  addFlat(group, new THREE.PlaneGeometry(4, 64), path, 0, 0, 0.01);
  addFlat(group, new THREE.PlaneGeometry(44, 3.5), path, 0, -3, 0.012);
  addFlat(group, new THREE.PlaneGeometry(32, 3.5), path, 0, 4.5, 0.011);
  // 広場
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(5.5, 20), ctx.mat(0xd8c08a));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.015, 0);
  plaza.receiveShadow = true;
  group.add(plaza);

  // 建物
  for (const bd of def.buildings) building(ctx, bd);

  // 井戸
  ctx.box(0, 0, 0, 2.2, 0.9, 2.2, 0x9e9e9e, { collide: true, low: true });
  ctx.box(0, 0.9, 0, 1.6, 0.05, 1.6, 0x1565c0);
  ctx.box(-0.9, 0.9, 0, 0.15, 1.6, 0.15, 0x6d4c41);
  ctx.box(0.9, 0.9, 0, 0.15, 1.6, 0.15, 0x6d4c41);
  ctx.box(0, 2.5, 0, 2.4, 0.5, 1.4, 0x8e3b2e);

  // 柵（境界）
  const posts = [];
  for (let x = b.minX; x <= b.maxX; x += 2) {
    if (Math.abs(x) > 3) posts.push({ x, z: b.minZ + 0.3 });
    posts.push({ x, z: b.maxZ - 0.3 });
  }
  for (let z = b.minZ; z <= b.maxZ; z += 2) {
    posts.push({ x: b.minX + 0.3, z });
    posts.push({ x: b.maxX - 0.3, z });
  }
  const postGeo = new THREE.BoxGeometry(0.25, 1.2, 0.25);
  postGeo.translate(0, 0.6, 0);
  ctx.instanced(postGeo, ctx.mat(0x8d6e63), posts);

  // 木（柵の外と村の端）
  const rnd = seeded(77);
  const trees = [];
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 36 + rnd() * 14;
    trees.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.9 + rnd() * 0.7, ry: rnd() * 6 });
  }
  for (const [x, z] of [[-27, -26], [27, -26], [-27, 26], [27, 26], [-26, 20], [26, -18], [-6, 26], [7, 25]]) {
    trees.push({ x, z, s: 1.1, ry: 0 });
    ctx.colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }
  addTrees(ctx, trees, 0x2e7d32);

  // 花壇
  const fl = [];
  for (let i = 0; i < 80; i++) {
    const x = (rnd() - 0.5) * 56;
    const z = (rnd() - 0.5) * 56;
    if (Math.abs(x) < 3 || Math.hypot(x, z) < 6) continue;
    fl.push({ x, z, y: 0.12, s: 0.6 + rnd() * 0.6 });
  }
  const flGeo = new THREE.IcosahedronGeometry(0.15, 0);
  ctx.instanced(flGeo, ctx.mat(0xf06292), fl.filter((_, i) => i % 2 === 0), { cast: false });
  ctx.instanced(flGeo, ctx.mat(0xffee58), fl.filter((_, i) => i % 2 === 1), { cast: false });

  // NPC
  ctx.extra.npcs = [];
  for (const n of def.npcs) {
    const d = NPCS[n.id];
    const m = makeNpc(d);
    m.group.position.set(n.x, 0, n.z);
    m.group.rotation.y = n.ry ?? 0;
    m.group.userData.keep = true; // 共有キャッシュなので dispose しない
    group.add(m.group);
    ctx.colliders.push({ minX: n.x - 0.4, maxX: n.x + 0.4, minZ: n.z - 0.4, maxZ: n.z + 0.4, low: true });
    const npc = { id: n.id, x: n.x, z: n.z, model: m, baseRy: n.ry ?? 0, phase: Math.random() * 6 };
    ctx.extra.npcs.push(npc);
    ctx.interactables.push({
      x: n.x, z: n.z, r: 2.4, label: `話す（${d.name}）`, active: true, npc: true,
      action: (game) => game.talkTo(n.id, npc),
    });
  }
  ctx.updaters.push((dt, t) => {
    for (const n of ctx.extra.npcs) {
      n.model.root.position.y = Math.abs(Math.sin(t * 2 + n.phase)) * 0.04;
      n.model.armL.rotation.x = Math.sin(t * 1.3 + n.phase) * 0.15;
    }
  });
}

function addFlat(group, geom, material, x, z, y) {
  const m = new THREE.Mesh(geom, material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  group.add(m);
  return m;
}

/** 家：壁・屋根（四角錐）・扉・窓・看板 */
function building(ctx, bd) {
  const { x, z, w, d, h } = bd;
  ctx.box(x, 0, z, w, h, d, bd.wall, { collide: true });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.7, 4), ctx.mat(bd.roof));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  roof.position.set(x, h + h * 0.35, z);
  roof.castShadow = true;
  ctx.group.add(roof);
  const sz = bd.door === 'n' ? -1 : 1;
  const fz = z + sz * (d / 2 + 0.03);
  ctx.box(x, 0, fz, 1.3, 2.2, 0.08, 0x5d4037, { cast: false });
  ctx.box(x - w / 3.2, 1.4, fz, 1, 0.9, 0.08, 0x90caf9, { cast: false, matOpts: { emissive: 0x335577 } });
  ctx.box(x + w / 3.2, 1.4, fz, 1, 0.9, 0.08, 0x90caf9, { cast: false, matOpts: { emissive: 0x335577 } });
  if (bd.sign) ctx.box(x, 2.5, fz + sz * 0.05, 2.2, 0.5, 0.08, 0x6d4c41, { cast: false });
}

/** 木：幹と葉を InstancedMesh で */
export function addTrees(ctx, items, leafColor) {
  const trunk = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6);
  trunk.translate(0, 0.8, 0);
  const leaf = new THREE.ConeGeometry(1.3, 2.8, 7);
  leaf.translate(0, 2.9, 0);
  ctx.instanced(trunk, ctx.mat(0x6d4c41), items);
  ctx.instanced(leaf, ctx.mat(leafColor), items);
}
