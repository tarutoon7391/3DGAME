// ステージの見た目と静的オブジェクト（床・壁・展示台・お宝・扉・ロッカー・圧力床・出口・照明）を作る
import * as THREE from 'three';
import { T, WALL_H, SOLID, OPAQUE } from './config.js';
import { Grid } from './grid.js';

const _m = new THREE.Matrix4();
const _c = new THREE.Color();

/** マテリアル／ジオメトリを group ごと破棄 */
export function disposeGroup(group) {
  const seen = new Set();
  group.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (!seen.has(m) && !m.userData.shared) { seen.add(m); m.dispose(); }
  });
  group.removeFromParent();
}

export function buildLevel(scene, stage) {
  const grid = new Grid(stage.map);
  const group = new THREE.Group();
  scene.add(group);
  const W = grid.w * T;
  const H = grid.h * T;
  const cx = (c) => c * T + T / 2;

  // ---- 床（タイルごとに色を変える InstancedMesh）
  const floorTiles = [];
  for (let r = 0; r < grid.h; r++) for (let c = 0; c < grid.w; c++) if (grid.ch(c, r) !== '#') floorTiles.push([c, r]);
  const floorGeo = new THREE.PlaneGeometry(T, T).rotateX(-Math.PI / 2);
  const floor = new THREE.InstancedMesh(floorGeo, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 }), floorTiles.length);
  floorTiles.forEach(([c, r], i) => {
    _m.makeTranslation(cx(c), 0, cx(r));
    floor.setMatrixAt(i, _m);
    const ch = grid.ch(c, r);
    if (ch === ',') _c.setHex(0x16141c);
    else if (ch === 'X') _c.setHex(0x1f5a3a);
    else _c.setHex((c + r) % 2 ? 0x5a5064 : 0x4b4256);
    floor.setColorAt(i, _c);
  });
  floor.receiveShadow = true;
  group.add(floor);

  // ---- 壁（床に接するものだけ）
  const walls = [];
  for (let r = 0; r < grid.h; r++) {
    for (let c = 0; c < grid.w; c++) {
      if (grid.ch(c, r) !== '#') continue;
      let edge = false;
      for (let oz = -1; oz <= 1 && !edge; oz++) for (let ox = -1; ox <= 1; ox++) {
        const n = grid.ch(c + ox, r + oz);
        if (n !== '#' && !(c + ox < 0 || r + oz < 0 || c + ox >= grid.w || r + oz >= grid.h)) { edge = true; break; }
      }
      if (edge) walls.push([c, r]);
    }
  }
  const wallMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(T, WALL_H, T),
    new THREE.MeshStandardMaterial({ color: 0x5b5470, roughness: 0.9 }),
    walls.length,
  );
  walls.forEach(([c, r], i) => {
    _m.makeTranslation(cx(c), WALL_H / 2, cx(r));
    wallMesh.setMatrixAt(i, _m);
    _c.setHex((c * 7 + r * 3) % 5 ? 0x5b5470 : 0x544c68);
    wallMesh.setColorAt(i, _c);
  });
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  group.add(wallMesh);
  // 壁の上端の縁取り（見下ろしで部屋の形を読みやすく）
  const trim = new THREE.InstancedMesh(
    new THREE.BoxGeometry(T, 0.06, T),
    new THREE.MeshBasicMaterial({ color: 0x3a3450 }),
    walls.length,
  );
  walls.forEach(([c, r], i) => { _m.makeTranslation(cx(c), WALL_H + 0.03, cx(r)); trim.setMatrixAt(i, _m); });
  group.add(trim);

  // ---- 展示台（S）：台座は InstancedMesh、上に彫像
  const peds = grid.find('S');
  const pedMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(T * 0.8, 0.9, T * 0.8),
    new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.7 }),
    Math.max(1, peds.length),
  );
  pedMesh.count = peds.length;
  const statueMat = new THREE.MeshStandardMaterial({ color: 0xb0a890, roughness: 0.5, metalness: 0.2 });
  const statueGeos = [new THREE.SphereGeometry(0.4, 10, 8), new THREE.ConeGeometry(0.38, 1.0, 6), new THREE.TorusKnotGeometry(0.28, 0.09, 40, 6)];
  peds.forEach(({ c, r }, i) => {
    _m.makeTranslation(cx(c), 0.45, cx(r));
    pedMesh.setMatrixAt(i, _m);
    const s = new THREE.Mesh(statueGeos[(c + r) % statueGeos.length], statueMat);
    s.position.set(cx(c), 1.35, cx(r));
    s.castShadow = true;
    group.add(s);
  });
  pedMesh.castShadow = true;
  pedMesh.receiveShadow = true;
  group.add(pedMesh);

  // ---- お宝（T=メイン、t=サブ）
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x2b2633, roughness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false });
  const subColors = [0x4fc3f7, 0xef5350, 0xffb74d, 0x81c784, 0xba68c8];
  const subGeos = [new THREE.DodecahedronGeometry(0.28), new THREE.ConeGeometry(0.25, 0.55, 5), new THREE.TorusGeometry(0.22, 0.08, 6, 12)];
  const treasures = [];
  let subIdx = 0;
  for (const { c, r, ch } of grid.find('Tt')) {
    const main = ch === 'T';
    const base = new THREE.Mesh(new THREE.BoxGeometry(T * 0.7, 1.0, T * 0.7), caseMat);
    base.position.set(cx(c), 0.5, cx(r));
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const color = main ? 0xffd54f : subColors[subIdx % subColors.length];
    const gemMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.25 });
    const gem = new THREE.Mesh(main ? new THREE.OctahedronGeometry(0.42) : subGeos[subIdx % subGeos.length], gemMat);
    gem.position.set(cx(c), main ? 1.55 : 1.35, cx(r));
    gem.castShadow = true;
    group.add(gem);
    if (main) {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(T * 0.62, 1.1, T * 0.62), glassMat);
      glass.position.set(cx(c), 1.55, cx(r));
      group.add(glass);
      gem.userData.glass = glass;
    }
    const name = main ? stage.treasureNames?.main || 'お宝' : stage.treasureNames?.sub?.[subIdx] || `サブのお宝${subIdx + 1}`;
    if (!main) subIdx++;
    treasures.push({ main, name, c, r, x: cx(c), z: cx(r), gem, taken: false, color });
  }

  // ---- カードキー
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0xffc107, emissiveIntensity: 0.8 });
  const keys = grid.find('K').map(({ c, r }) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.05), keyMat);
    mesh.position.set(cx(c), 0.9, cx(r));
    group.add(mesh);
    return { c, r, x: cx(c), z: cx(r), mesh, taken: false };
  });

  // ---- 扉（o=普通、D=鍵付き）：開くとシャッターのように沈む
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x7a4e2d, roughness: 0.8 });
  const lockMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, emissive: 0x3a2a00, roughness: 0.5, metalness: 0.4 });
  const doors = grid.find('oD').map(({ c, r, ch }) => {
    const locked = ch === 'D';
    // 左右が壁なら x 方向に伸びる扉
    const alongX = !!(grid.flag(c - 1, r) & SOLID) && !!(grid.flag(c + 1, r) & SOLID);
    const geo = alongX ? new THREE.BoxGeometry(T, WALL_H, 0.3) : new THREE.BoxGeometry(0.3, WALL_H, T);
    const mesh = new THREE.Mesh(geo, locked ? lockMat : doorMat);
    mesh.position.set(cx(c), WALL_H / 2, cx(r));
    mesh.castShadow = true;
    group.add(mesh);
    return { c, r, x: cx(c), z: cx(r), locked, open: false, mesh, k: 1 };
  });

  // ---- ロッカー（L）：隣接する床の方を向く
  const lockerMat = new THREE.MeshStandardMaterial({ color: 0x4f6b5f, roughness: 0.6, metalness: 0.5 });
  const slitMat = new THREE.MeshBasicMaterial({ color: 0x0b0d10 });
  const lockers = grid.find('L').map(({ c, r }) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(T * 0.8, 2.1, T * 0.8), lockerMat);
    body.position.y = 1.05;
    body.castShadow = true;
    g.add(body);
    let face = [0, 1];
    for (const d of [[0, 1], [1, 0], [-1, 0], [0, -1]]) if (!(grid.flag(c + d[0], r + d[1]) & SOLID)) { face = d; break; }
    for (let i = 0; i < 3; i++) {
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.02), slitMat);
      slit.position.set(0, 1.6 + i * 0.12, T * 0.4 + 0.01);
      g.add(slit);
    }
    g.position.set(cx(c), 0, cx(r));
    g.rotation.y = Math.atan2(face[0], face[1]);
    group.add(g);
    return { c, r, x: cx(c), z: cx(r), mesh: g, front: { x: cx(c + face[0]), z: cx(r + face[1]) } };
  });

  // ---- 圧力床（=）
  const plateGeo = new THREE.BoxGeometry(T * 0.9, 0.06, T * 0.9);
  const plates = grid.find('=').map(({ c, r }) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a1e22, emissive: 0x400808, roughness: 0.4 });
    const mesh = new THREE.Mesh(plateGeo, mat);
    mesh.position.set(cx(c), 0.03, cx(r));
    mesh.receiveShadow = true;
    group.add(mesh);
    return { c, r, x: cx(c), z: cx(r), mesh, flash: 0, armed: true };
  });

  // ---- 出口（X）
  const exitTile = grid.find('X')[0];
  const exit = { x: cx(exitTile.c), z: cx(exitTile.r), c: exitTile.c, r: exitTile.r };
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x4cff9a, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3, 16, 1, true), beamMat);
  beam.position.set(exit.x, 1.5, exit.z);
  group.add(beam);
  const exitLight = new THREE.PointLight(0x4cff9a, 4, 6, 1.5);
  exitLight.position.set(exit.x, 1.2, exit.z);
  group.add(exitLight);

  // ---- 照明：暗い館内のスポットライト
  const litTiles = new Uint8Array(grid.w * grid.h);
  for (const [lc, lr] of stage.lights || []) {
    const sp = new THREE.SpotLight(0xffe2b8, 55, 14, 0.5, 0.55, 1.6);
    sp.position.set(cx(lc), 6, cx(lr));
    sp.target.position.set(cx(lc), 0, cx(lr));
    group.add(sp, sp.target);
    for (let r = lr - 1; r <= lr + 1; r++) for (let c = lc - 1; c <= lc + 1; c++) {
      if (c >= 0 && r >= 0 && c < grid.w && r < grid.h) litTiles[r * grid.w + c] = 1;
    }
    // 照明器具（天井の目印）
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.12, 8), new THREE.MeshBasicMaterial({ color: 0xc8b890 }));
    lamp.position.set(cx(lc), WALL_H + 0.6, cx(lr));
    group.add(lamp);
  }

  const start = grid.find('P')[0];

  return {
    group,
    grid,
    stage,
    size: { w: W, h: H },
    start: { x: cx(start.c), z: cx(start.r) },
    exit,
    treasures,
    keys,
    doors,
    lockers,
    plates,
    beamMat,
    /** 警備員の通行判定（普通の扉は閉じていても開けて通る） */
    guardWalk: (c, r) => !(grid.flag(c, r) & SOLID) || grid.ch(c, r) === 'o',
    isLit(x, z) {
      const c = Math.floor(x / T);
      const r = Math.floor(z / T);
      return c >= 0 && r >= 0 && c < grid.w && r < grid.h && litTiles[r * grid.w + c] === 1;
    },
    isShadow(x, z) {
      return grid.ch(Math.floor(x / T), Math.floor(z / T)) === ',';
    },
    doorAt(c, r) {
      return doors.find((d) => d.c === c && d.r === r) || null;
    },
    setDoor(door, open) {
      door.open = open;
      grid.setFlag(door.c, door.r, open ? 0 : SOLID | OPAQUE);
    },
    update(dt, time, mainTaken) {
      for (const d of doors) {
        d.k += ((d.open ? 0.04 : 1) - d.k) * Math.min(1, dt * 10);
        d.mesh.scale.y = d.k;
        d.mesh.position.y = (WALL_H * d.k) / 2;
      }
      for (const t of treasures) {
        if (t.taken) continue;
        t.gem.rotation.y = time * (t.main ? 1.2 : 0.9);
        t.gem.position.y = (t.main ? 1.55 : 1.35) + Math.sin(time * 2 + t.c) * 0.06;
      }
      for (const k of keys) if (!k.taken) { k.mesh.rotation.y = time * 2; k.mesh.position.y = 0.9 + Math.sin(time * 3) * 0.1; }
      for (const p of plates) {
        p.flash = Math.max(0, p.flash - dt);
        p.mesh.material.emissive.setHex(p.flash > 0 && Math.floor(p.flash * 8) % 2 ? 0xff2020 : 0x400808);
      }
      beamMat.opacity = mainTaken ? 0.25 + Math.sin(time * 5) * 0.1 : 0.08;
      exitLight.intensity = mainTaken ? 8 : 2.5;
    },
    dispose() {
      disposeGroup(group);
    },
  };
}
