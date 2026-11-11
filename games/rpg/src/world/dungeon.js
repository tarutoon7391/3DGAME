// 魔窟（1-3）：入口通路・大広間・ボス部屋。構造は旧仕様のまま（レバー・宝箱は撤去）
import * as THREE from 'three';

const WALL = 0x4a4452;
const WALL_H = 6;

export function buildDungeon(ctx) {
  const { def, group } = ctx;
  const b = def.bounds;

  // 外壁
  ctx.box(0, 0, b.minZ - 0.5, b.maxX - b.minX + 2, WALL_H, 1, WALL);
  ctx.box(b.minX - 0.5, 0, 0, 1, WALL_H, b.maxZ - b.minZ, WALL);
  ctx.box(b.maxX + 0.5, 0, 0, 1, WALL_H, b.maxZ - b.minZ, WALL);
  ctx.box(0, 0, b.maxZ + 0.5, b.maxX - b.minX + 2, WALL_H, 1, WALL); // 入口（戻るゲートは撤去）
  // 入口通路の両脇の岩盤
  for (const s of def.solids) {
    ctx.box((s.minX + s.maxX) / 2, 0, (s.minZ + s.maxZ) / 2, s.maxX - s.minX, WALL_H, s.maxZ - s.minZ, 0x3a3540, { collide: true });
  }
  // 柱
  for (const [x, z] of def.pillars) {
    ctx.box(x, 0, z, 1.8, WALL_H, 1.8, 0x5d5866, { collide: true });
    ctx.box(x, 0, z, 2.3, 0.4, 2.3, 0x6d6878);
  }
  // 床の模様（ボス部屋の魔法陣）
  const circle = new THREE.Mesh(new THREE.RingGeometry(9, 9.6, 40), ctx.mat(0x6a1b9a, { emissive: 0x4a148c, emissiveIntensity: 0.8 }));
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(def.bosses[0].x, 0.02, def.bosses[0].z);
  group.add(circle);
  const tiles = [];
  for (let x = b.minX + 2; x < b.maxX; x += 4) for (let z = b.minZ + 2; z < b.maxZ; z += 4) tiles.push({ x, z, y: 0.004, s: 1 });
  const tileGeo = new THREE.PlaneGeometry(3.8, 3.8);
  tileGeo.rotateX(-Math.PI / 2);
  ctx.instanced(tileGeo, ctx.mat(0x45404c), tiles, { cast: false, receive: true });

  // 仕切り壁と扉
  const dv = def.divider;
  const segW = b.maxX - dv.gap;
  ctx.box(-(dv.gap + segW / 2), 0, dv.z, segW, WALL_H, 1, WALL, { collide: true });
  ctx.box(dv.gap + segW / 2, 0, dv.z, segW, WALL_H, 1, WALL, { collide: true });
  ctx.box(0, 4.6, dv.z, dv.gap * 2, WALL_H - 4.6, 1, WALL);
  const door = ctx.box(0, 0, dv.z, dv.gap * 2, 4.6, 0.6, 0x6d4c41, { matOpts: { metalness: 0.3 } });
  const doorCol = { minX: -dv.gap, maxX: dv.gap, minZ: dv.z - 0.5, maxZ: dv.z + 0.5 };
  ctx.colliders.push(doorCol);
  let doorTarget = 1; // 0=閉 1=開（レバーは撤去したので最初から開いている。ボス部屋に入ると閉まる）
  let doorT = 1;
  doorCol.off = true;
  const extra = ctx.extra;
  extra.setDoor = (open, instant = false) => {
    doorTarget = open ? 1 : 0;
    if (instant) doorT = doorTarget;
    doorCol.off = open;
  };
  extra.doors = [extra.setDoor]; // ステージ2と同じ形（ボスの door 番号で開け閉め）
  ctx.updaters.push((dt) => {
    doorT += Math.sign(doorTarget - doorT) * Math.min(Math.abs(doorTarget - doorT), dt * 0.8);
    door.position.y = 2.3 - doorT * 4.5;
  });

  // 松明（点光源。影は落とさない）
  const flameMat = ctx.mat(0xffab40, { emissive: 0xff6d00, emissiveIntensity: 2 });
  const lights = [];
  for (const [x, z] of def.torches) {
    ctx.box(x, 0, z, 0.25, 2.2, 0.25, 0x5d4037);
    const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), flameMat);
    f.position.set(x, 2.45, z);
    group.add(f);
    const l = new THREE.PointLight(0xff9a3c, 22, 15, 1.4);
    l.position.set(x, 2.8, z);
    group.add(l);
    lights.push({ l, f, p: Math.random() * 10 });
  }
  ctx.updaters.push((dt, t) => {
    for (const o of lights) {
      o.l.intensity = 20 + Math.sin(t * 9 + o.p) * 3 + Math.sin(t * 23 + o.p) * 2;
      o.f.scale.y = 1 + Math.sin(t * 12 + o.p) * 0.2;
    }
  });
}
