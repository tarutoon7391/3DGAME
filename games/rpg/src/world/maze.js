// 迷路のステージ：シードから完全迷路（ループなし＝正解の道が1本）を作り、
// 壁（InstancedMesh）・結界・番人と雑魚の配置・まわりの木や岩を組み立てる
import * as THREE from 'three';
import { seeded } from '../util.js';

/**
 * 穴掘り法で迷路を作る。r=0 が北端。
 * hw[r*cols+c]：マス(c,r) の北側の壁（r=rows は南端）、vw[r*(cols+1)+c]：マス(c,r) の西側の壁（c=cols は東端）
 */
export function genMaze(cols, rows, seed, startC, startR) {
  const rnd = seeded(seed);
  const hw = new Uint8Array((rows + 1) * cols).fill(1);
  const vw = new Uint8Array(rows * (cols + 1)).fill(1);
  const seen = new Uint8Array(cols * rows);
  const stack = [[startC, startR]];
  seen[startR * cols + startC] = 1;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const opts = [];
    if (r > 0 && !seen[(r - 1) * cols + c]) opts.push(0);
    if (r < rows - 1 && !seen[(r + 1) * cols + c]) opts.push(1);
    if (c > 0 && !seen[r * cols + c - 1]) opts.push(2);
    if (c < cols - 1 && !seen[r * cols + c + 1]) opts.push(3);
    if (!opts.length) { stack.pop(); continue; }
    const k = opts[Math.floor(rnd() * opts.length)];
    let nc = c;
    let nr = r;
    if (k === 0) { hw[r * cols + c] = 0; nr--; }
    else if (k === 1) { hw[(r + 1) * cols + c] = 0; nr++; }
    else if (k === 2) { vw[r * (cols + 1) + c] = 0; nc--; }
    else { vw[r * (cols + 1) + c + 1] = 0; nc++; }
    seen[nr * cols + nc] = 1;
    stack.push([nc, nr]);
  }
  return { cols, rows, hw, vw, rnd };
}

/** 2マス間の最短路（マスの配列）。迷路は木構造なので1本に決まる */
function solve(m, sc, sr, ec, er) {
  const { cols, rows, hw, vw } = m;
  const prev = new Int32Array(cols * rows).fill(-1);
  const start = sr * cols + sc;
  prev[start] = start;
  const q = [start];
  while (q.length) {
    const i = q.shift();
    const c = i % cols;
    const r = (i - c) / cols;
    const nb = [];
    if (r > 0 && !hw[r * cols + c]) nb.push(i - cols);
    if (r < rows - 1 && !hw[(r + 1) * cols + c]) nb.push(i + cols);
    if (c > 0 && !vw[r * (cols + 1) + c]) nb.push(i - 1);
    if (c < cols - 1 && !vw[r * (cols + 1) + c + 1]) nb.push(i + 1);
    for (const n of nb) if (prev[n] < 0) { prev[n] = i; q.push(n); }
  }
  const path = [];
  for (let i = er * cols + ec; ; i = prev[i]) {
    path.push(i);
    if (i === start) break;
  }
  return path.reverse();
}

export function buildMaze(ctx) {
  const { def, group } = ctx;
  const { cols, rows, cell, wallT, seed, entryCol, exitCol } = def.maze;
  const H = def.wallH;
  const m = genMaze(cols, rows, seed, entryCol, rows - 1);
  const x0 = -(cols * cell) / 2;
  const z0 = -(rows * cell) / 2;
  const cx = (c) => x0 + (c + 0.5) * cell;
  const cz = (r) => z0 + (r + 0.5) * cell;
  m.hw[exitCol] = 0; // 出口（北端）を開ける

  // ---- 壁：同じ列の壁はつなげて1本の箱にする ----
  const walls = [];
  const addWall = (minX, maxX, minZ, maxZ) => {
    walls.push({ minX, maxX, minZ, maxZ });
    ctx.colliders.push({ minX, maxX, minZ, maxZ });
  };
  for (let r = 0; r <= rows; r++) {
    let run = -1;
    for (let c = 0; c <= cols; c++) {
      const on = c < cols && m.hw[r * cols + c];
      if (on && run < 0) run = c;
      if (!on && run >= 0) {
        const z = z0 + r * cell;
        addWall(x0 + run * cell - wallT / 2, x0 + c * cell + wallT / 2, z - wallT / 2, z + wallT / 2);
        run = -1;
      }
    }
  }
  for (let c = 0; c <= cols; c++) {
    let run = -1;
    for (let r = 0; r <= rows; r++) {
      const on = r < rows && m.vw[r * (cols + 1) + c];
      if (on && run < 0) run = r;
      if (!on && run >= 0) {
        const x = x0 + c * cell;
        addWall(x - wallT / 2, x + wallT / 2, z0 + run * cell - wallT / 2, z0 + r * cell + wallT / 2);
        run = -1;
      }
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const wallMesh = new THREE.InstancedMesh(boxGeo, ctx.mat(def.wall), walls.length);
  const capMesh = new THREE.InstancedMesh(boxGeo, ctx.mat(def.wallTop), walls.length);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  walls.forEach((w, i) => {
    const sx = w.maxX - w.minX;
    const sz = w.maxZ - w.minZ;
    wallMesh.setMatrixAt(i, mtx.compose(pos.set((w.minX + w.maxX) / 2, 0, (w.minZ + w.maxZ) / 2), q, scl.set(sx, H, sz)));
    capMesh.setMatrixAt(i, mtx.compose(pos.set((w.minX + w.maxX) / 2, H, (w.minZ + w.maxZ) / 2), q, scl.set(sx + 0.3, 0.25, sz + 0.3)));
  });
  wallMesh.castShadow = wallMesh.receiveShadow = true;
  capMesh.castShadow = true;
  group.add(wallMesh, capMesh);

  // ---- 正解ルート・結界・番人 ----
  const path = solve(m, entryCol, rows - 1, exitCol, 0);
  const onPath = new Set(path);
  const spawns = []; // [type, x, z, sealId]
  const seals = [];
  const sealCells = new Set();
  def.seals.forEach((sd, id) => {
    const k = Math.max(2, Math.min(path.length - 2, Math.round(sd.at * (path.length - 1))));
    const a = path[k];
    const b = path[k + 1];
    const ac = a % cols;
    const ar = (a - ac) / cols;
    const bc = b % cols;
    const br = (b - bc) / cols;
    // 2マスの境目をふさぐ
    const mx = (cx(ac) + cx(bc)) / 2;
    const mz = (cz(ar) + cz(br)) / 2;
    const alongX = ar === br; // 東西につながる境目なら壁は南北向き
    const half = cell / 2;
    const col = alongX
      ? { minX: mx - 0.4, maxX: mx + 0.4, minZ: mz - half, maxZ: mz + half }
      : { minX: mx - half, maxX: mx + half, minZ: mz - 0.4, maxZ: mz + 0.4 };
    col.seal = true; // ミニマップでは壁でなく結界として描く
    ctx.colliders.push(col);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(cell - wallT, H + 0.4), mat);
    plane.position.set(mx, (H + 0.4) / 2, mz);
    plane.rotation.y = alongX ? Math.PI / 2 : 0;
    group.add(plane);
    ctx.extraDispose.push(() => mat.dispose());
    const seal = { id, x: mx, z: mz, col, mat, plane, open: false, fade: 1, guards: [], alongX };
    seals.push(seal);
    sealCells.add(a);
    // 番人は結界の手前の2マスに分けて置く
    sd.guards.forEach((type, i) => {
      const gi = path[k - (i % 2)];
      const gc = gi % cols;
      const gr = (gi - gc) / cols;
      const off = (Math.floor(i / 2) - 0.5) * 1.6;
      spawns.push([type, cx(gc) + (alongX ? 0 : off), cz(gr) + (alongX ? off : 0), id]);
      sealCells.add(gi);
    });
  });

  // ---- うろつく雑魚：脇道を中心に、入口の近くと結界のマスは避ける ----
  const free = [];
  for (let i = 0; i < cols * rows; i++) {
    const pi = path.indexOf(i);
    if (sealCells.has(i) || (pi >= 0 && pi < 3)) continue;
    free.push({ i, w: onPath.has(i) ? 1 : 2.2 });
  }
  for (const type of def.roamers) {
    if (!free.length) break;
    let tot = free.reduce((s, f) => s + f.w, 0) * m.rnd();
    let k = 0;
    while (k < free.length - 1 && (tot -= free[k].w) > 0) k++;
    const { i } = free.splice(k, 1)[0];
    const c = i % cols;
    const r = (i - c) / cols;
    spawns.push([type, cx(c) + (m.rnd() - 0.5) * 2, cz(r) + (m.rnd() - 0.5) * 2, -1]);
  }

  ctx.extra.seals = seals;
  ctx.extra.spawns = spawns;
  ctx.extra.maze = { cols, rows, cell, x0, z0, path };
  ctx.updaters.push((dt, t) => {
    for (const s of seals) {
      if (s.open) {
        if (s.fade > 0) {
          s.fade = Math.max(0, s.fade - dt * 1.5);
          s.mat.opacity = 0.5 * s.fade;
          s.plane.scale.y = 0.2 + 0.8 * s.fade;
          if (s.fade <= 0) s.plane.visible = false;
        }
      } else s.mat.opacity = 0.42 + Math.sin(t * 4 + s.id) * 0.12;
    }
  });

  // ---- 入口の門柱（飾り。カメラの邪魔にならないよう横木は付けない） ----
  const ex = cx(entryCol);
  const ez = z0 + rows * cell;
  ctx.box(ex - 2, 0, ez, 0.8, H + 1, 0.8, 0x6d4c41);
  ctx.box(ex + 2, 0, ez, 0.8, H + 1, 0.8, 0x6d4c41);

  decorate(ctx, x0, z0, cols * cell, rows * cell);
}

/** 迷路の外側の木や岩（当たり判定なし。範囲の外なので歩けない） */
function decorate(ctx, x0, z0, w, d) {
  const { def } = ctx;
  const rnd = seeded(def.seed);
  const items = [];
  const n = def.trees || def.rocks || 0;
  for (let i = 0; i < n; i++) {
    const side = i % 4;
    const t = rnd();
    const o = 2 + rnd() * 14;
    let x;
    let z;
    if (side === 0) { x = x0 - 8 + t * (w + 16); z = z0 - 3 - o; }
    else if (side === 1) { x = x0 - 8 + t * (w + 16); z = z0 + d + o; }
    else if (side === 2) { x = x0 - o; z = z0 + t * d; }
    else { x = x0 + w + o; z = z0 + t * d; }
    items.push({ x, z, s: 1 + rnd() * 0.9, ry: rnd() * 6 });
  }
  if (def.trees) {
    const trunk = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6);
    trunk.translate(0, 0.8, 0);
    const leaf = new THREE.ConeGeometry(1.3, 2.8, 7);
    leaf.translate(0, 2.9, 0);
    ctx.instanced(trunk, ctx.mat(0x6d4c41), items);
    ctx.instanced(leaf, ctx.mat(0x2e7d32), items);
  } else {
    items.forEach((it) => { it.y = 0.3; it.sy = 0.7 + rnd() * 1.5; it.s *= 1.6; });
    ctx.instanced(new THREE.DodecahedronGeometry(1, 0), ctx.mat(0x8d6e63), items, { cast: true });
  }
}
