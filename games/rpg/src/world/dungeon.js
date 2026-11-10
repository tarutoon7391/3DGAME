// 魔窟：入口通路・大広間（レバー3つの仕掛け・宝箱）・ボス部屋
// 仕掛けの状態は game.state.progress.dungeon に持つ（セーブ対象）
import * as THREE from 'three';

const WALL = 0x4a4452;
const WALL_H = 6;

export function buildDungeon(ctx) {
  const { def, group, game } = ctx;
  const b = def.bounds;
  const prog = game.state.progress.dungeon;

  // 外壁
  ctx.box(0, 0, b.minZ - 0.5, b.maxX - b.minX + 2, WALL_H, 1, WALL);
  ctx.box(b.minX - 0.5, 0, 0, 1, WALL_H, b.maxZ - b.minZ, WALL);
  ctx.box(b.maxX + 0.5, 0, 0, 1, WALL_H, b.maxZ - b.minZ, WALL);
  ctx.box(-12, 0, b.maxZ + 0.5, 20, WALL_H, 1, WALL);
  ctx.box(12, 0, b.maxZ + 0.5, 20, WALL_H, 1, WALL);
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
  circle.position.set(def.boss.x, 0.02, def.boss.z);
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
  // 扉の上のランプ（レバーの状態）
  const lamps = [-1.6, 0, 1.6].map((x) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 1 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), m);
    mesh.position.set(x, 5.2, dv.z + 0.6);
    group.add(mesh);
    return m;
  });
  ctx.extraDispose = ctx.extraDispose || [];
  ctx.extraDispose.push(() => lamps.forEach((m) => m.dispose()));

  let doorTarget = 0; // 0=閉 1=開
  let doorT = 0;
  const extra = ctx.extra;
  extra.setDoor = (open, instant = false) => {
    doorTarget = open ? 1 : 0;
    if (instant) doorT = doorTarget;
    doorCol.off = open;
  };
  extra.refreshLamps = () => {
    prog.levers.forEach((on, i) => {
      lamps[i].color.setHex(on ? 0x00e676 : 0xff1744);
      lamps[i].emissive.setHex(on ? 0x00e676 : 0xff1744);
    });
  };
  extra.refreshLamps();
  extra.setDoor(prog.levers.every(Boolean), true);
  ctx.updaters.push((dt) => {
    doorT += Math.sign(doorTarget - doorT) * Math.min(Math.abs(doorTarget - doorT), dt * 0.8);
    door.position.y = 2.3 - doorT * 4.5;
  });

  // レバー
  const handles = def.levers.map(([x, z], i) => {
    const side = x < 0 ? 1 : -1; // 壁から内側へ
    ctx.box(x, 0, z, 0.5, 1.2, 1, 0x757575, { collide: true, low: true });
    const pivot = new THREE.Group();
    pivot.position.set(x + side * 0.3, 1.1, z);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), ctx.mat(0xffca28, { emissive: 0x664400 }));
    handle.position.y = 0.4;
    handle.castShadow = true;
    pivot.add(handle);
    pivot.rotation.x = prog.levers[i] ? 0.7 : -0.7;
    group.add(pivot);
    const it = {
      x, z, r: 2.2, label: 'レバーを動かす', active: !prog.levers[i],
      action: (g) => {
        if (prog.levers[i]) return;
        prog.levers[i] = true;
        it.active = false;
        pivot.rotation.x = 0.7;
        extra.refreshLamps();
        g.sound.se('lever');
        const n = prog.levers.filter(Boolean).length;
        if (n === 3) {
          extra.setDoor(true);
          g.sound.se('door');
          g.toast('ゴゴゴ……奥の扉が開いた！');
          g.fx.shake(0.4);
        } else {
          g.toast(`レバーを動かした（${n}/3）`);
        }
        g.autosave();
      },
    };
    ctx.interactables.push(it);
    return pivot;
  });
  extra.levers = handles;

  // 宝箱
  const c = def.chest;
  ctx.box(c.x, 0, c.z, 1.4, 0.8, 1, 0x8d6e63, { collide: true, low: true });
  const lid = ctx.box(c.x, 0.8, c.z, 1.45, 0.3, 1.05, 0xffb300, { matOpts: { metalness: 0.4 } });
  if (prog.chest) lid.rotation.z = 1.2;
  const chestIt = {
    x: c.x, z: c.z, r: 2.2, label: '宝箱を開ける', active: !prog.chest,
    action: (g) => {
      if (prog.chest) return;
      prog.chest = true;
      chestIt.active = false;
      lid.rotation.z = 1.2;
      lid.position.x -= 0.4;
      g.sound.se('chest');
      g.state.progress.gold += c.gold;
      for (const [id, n] of Object.entries(c.items)) g.state.addItem(id, n);
      g.toast(`宝箱から ${c.gold}G と 魔力水×2・回復薬×2 を手に入れた！`, 3000);
      g.autosave();
    },
  };
  ctx.interactables.push(chestIt);

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
