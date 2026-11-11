// ボス連戦の城（ステージ2 冥王の城・ステージ3 深淵の回廊）：入口通路 → ボスの間が扉で区切られて一直線に並ぶ
import * as THREE from 'three';

// 色はエリア定義の palette で変えられる（ステージ2 の冥王の城が既定）
const DEFAULT_PALETTE = {
  wall: 0x3a2d48, trim: 0x6a4f80, rock: 0x2b2236, pillar: 0x4a3b5a, tileA: 0x352a40, tileB: 0x2a2233,
  flame: 0xe040fb, flameGlow: 0xaa00ff, light: 0xc77dff, carpet: 0x6d0f1f,
};

export function buildCastle(ctx) {
  const { def, group } = ctx;
  const b = def.bounds;
  const H = def.wallH;
  const C = { ...DEFAULT_PALETTE, ...(def.palette || {}) };
  const WALL = C.wall;
  const TRIM = C.trim;

  // 外壁
  ctx.box(0, 0, b.minZ - 0.5, b.maxX - b.minX + 2, H, 1, WALL);
  ctx.box(b.minX - 0.5, 0, (b.minZ + b.maxZ) / 2, 1, H, b.maxZ - b.minZ, WALL);
  ctx.box(b.maxX + 0.5, 0, (b.minZ + b.maxZ) / 2, 1, H, b.maxZ - b.minZ, WALL);
  ctx.box(0, 0, b.maxZ + 0.5, b.maxX - b.minX + 2, H, 1, WALL);
  // 入口通路の両脇
  for (const s of def.solids) {
    ctx.box((s.minX + s.maxX) / 2, 0, (s.minZ + s.maxZ) / 2, s.maxX - s.minX, H, s.maxZ - s.minZ, C.rock, { collide: true });
  }
  // 柱
  for (const [x, z] of def.pillars) {
    ctx.box(x, 0, z, 1.8, H, 1.8, C.pillar, { collide: true });
    ctx.box(x, 0, z, 2.4, 0.4, 2.4, TRIM);
    ctx.box(x, H - 0.4, z, 2.4, 0.4, 2.4, TRIM);
  }
  // 床：市松模様のタイル（InstancedMesh 2色）
  const tilesA = [];
  const tilesB = [];
  for (let x = b.minX + 2, i = 0; x < b.maxX; x += 4, i++) {
    for (let z = b.minZ + 2, j = 0; z < b.maxZ; z += 4, j++) ((i + j) % 2 ? tilesA : tilesB).push({ x, z, y: 0.004, s: 1 });
  }
  const tileGeo = new THREE.PlaneGeometry(3.9, 3.9);
  tileGeo.rotateX(-Math.PI / 2);
  ctx.instanced(tileGeo, ctx.mat(C.tileA), tilesA, { cast: false, receive: true });
  ctx.instanced(tileGeo.clone(), ctx.mat(C.tileB), tilesB, { cast: false, receive: true });
  // 冥王の間への赤い絨毯
  // 最後の部屋への絨毯（def.carpet { z, len } で位置と長さ）
  const cp = def.carpet || { z: -56, len: 40 };
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4, cp.len), ctx.mat(C.carpet));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.01, cp.z);
  carpet.receiveShadow = true;
  group.add(carpet);

  // ボスの魔法陣（ボスごとの色）
  const circles = [];
  for (const bd of def.bosses) {
    const mm = ctx.mat(bd.circle, { emissive: bd.circle, emissiveIntensity: 0.8 });
    const outer = new THREE.Mesh(new THREE.RingGeometry(8, 8.6, 40), mm);
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(bd.x, 0.02, bd.z);
    const inner = new THREE.Mesh(new THREE.RingGeometry(4, 4.3, 6), mm);
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(bd.x, 0.02, bd.z);
    group.add(outer, inner);
    circles.push(inner);
  }
  ctx.updaters.push((dt) => {
    for (const c of circles) c.rotation.z += dt * 0.4;
  });

  // 仕切り壁と扉。extra.doors[i](open, instant) で開け閉め
  const extra = ctx.extra;
  extra.doors = def.doors.map((dv, i) => {
    const segW = b.maxX - dv.gap;
    if (i > 0) {
      // 入口の仕切り（i=0）は通路の岩盤がふさいでいるので、扉の上の梁だけ
      ctx.box(-(dv.gap + segW / 2), 0, dv.z, segW, H, 1, WALL, { collide: true });
      ctx.box(dv.gap + segW / 2, 0, dv.z, segW, H, 1, WALL, { collide: true });
    } else {
      ctx.box(-(dv.gap + 1), 0, dv.z, 2, H, 1, WALL, { collide: true });
      ctx.box(dv.gap + 1, 0, dv.z, 2, H, 1, WALL, { collide: true });
    }
    ctx.box(0, 4.6, dv.z, dv.gap * 2, H - 4.6, 1, WALL);
    const door = ctx.box(0, 0, dv.z, dv.gap * 2, 4.6, 0.6, 0x4e342e, { matOpts: { metalness: 0.4 } });
    const col = { minX: -dv.gap, maxX: dv.gap, minZ: dv.z - 0.5, maxZ: dv.z + 0.5 };
    ctx.colliders.push(col);
    const st = { target: i === 0 ? 1 : 0, t: i === 0 ? 1 : 0 };
    col.off = i === 0;
    door.position.y = 2.3 - st.t * 4.5;
    ctx.updaters.push((dt) => {
      st.t += Math.sign(st.target - st.t) * Math.min(Math.abs(st.target - st.t), dt * 0.8);
      door.position.y = 2.3 - st.t * 4.5;
    });
    return (open, instant = false) => {
      st.target = open ? 1 : 0;
      if (instant) st.t = st.target;
      col.off = open;
    };
  });

  // 松明（紫の炎。影は落とさない）
  const flameMat = ctx.mat(C.flame, { emissive: C.flameGlow, emissiveIntensity: 2 });
  const lights = [];
  for (const [x, z] of def.torches) {
    ctx.box(x, 0, z, 0.25, 2.2, 0.25, 0x37273f);
    const f = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), flameMat);
    f.position.set(x, 2.45, z);
    group.add(f);
    const l = new THREE.PointLight(C.light, 24, 16, 1.4);
    l.position.set(x, 2.8, z);
    group.add(l);
    lights.push({ l, f, p: Math.random() * 10 });
  }
  ctx.updaters.push((dt, t) => {
    for (const o of lights) {
      o.l.intensity = 22 + Math.sin(t * 9 + o.p) * 3 + Math.sin(t * 23 + o.p) * 2;
      o.f.scale.y = 1 + Math.sin(t * 12 + o.p) * 0.2;
    }
  });
}
