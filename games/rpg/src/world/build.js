// エリアの共通組み立て：地面・ゲート・看板・当たり判定・破棄
// エリア固有の形は maze.js（ステージ1・2）/ dungeon.js（ステージ3）/ castle.js（ステージ4）が ctx に追加する
import * as THREE from 'three';
import { AREAS } from '../data/areas.js';
import { SIGNS } from '../data/dialogs.js';
import { clamp } from '../util.js';
import { buildMaze } from './maze.js';
import { buildDungeon } from './dungeon.js';
import { buildCastle } from './castle.js';
import { createGrid } from './grid.js';

/**
 * エリアを作って scene に追加する。
 * @returns world：collide / blocked / update / dispose と、interactables・colliders などのデータ
 */
export function createWorld(areaId, game) {
  const def = AREAS[areaId];
  const group = new THREE.Group();
  const matCache = new Map();
  const ctx = {
    id: areaId,
    def,
    game,
    group,
    colliders: [], // { minX, maxX, minZ, maxZ, off?, low? }  low は低い障害物（カメラは通す）
    interactables: [], // { x, z, r, label, action(game), active }
    updaters: [], // (dt, time) => void
    gates: [], // { ...gateDef, portalMat }
    extra: {}, // エリア固有の状態（ダンジョンの扉・迷路の結界など）
    extraDispose: [], // エリア破棄時に呼ぶ後片付け
    /** エリア内で使い回す material（dispose はエリア破棄時にまとめて） */
    mat(color, opts = null) {
      const key = color + (opts ? JSON.stringify(opts) : '');
      let m = matCache.get(key);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...(opts || {}) });
        matCache.set(key, m);
      }
      return m;
    },
    /** 箱を置く（中心 x,z、底面 y）。collide で当たり判定を追加 */
    box(x, y, z, w, h, d, color, { collide = false, cast = true, receive = true, low = false, matOpts = null } = {}) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ctx.mat(color, matOpts));
      mesh.position.set(x, y + h / 2, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      group.add(mesh);
      if (collide) ctx.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, low });
      return mesh;
    },
    /** 同じ形を大量に置く（InstancedMesh）。items: [{x,y,z,s,ry,sy}] */
    instanced(geometry, material, items, { cast = true, receive = false } = {}) {
      const im = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
      const o = new THREE.Object3D();
      items.forEach((it, i) => {
        o.position.set(it.x, it.y ?? 0, it.z);
        o.rotation.set(0, it.ry ?? 0, 0);
        const s = it.s ?? 1;
        o.scale.set(s, s * (it.sy ?? 1), s);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      });
      im.count = items.length;
      im.castShadow = cast;
      im.receiveShadow = receive;
      group.add(im);
      return im;
    },
  };

  buildGround(ctx);
  if (def.maze) buildMaze(ctx);
  else if (def.castle) buildCastle(ctx);
  else buildDungeon(ctx);
  (def.gates || []).forEach((g) => buildGate(ctx, g));
  (def.signs || []).forEach((s) => buildSign(ctx, s.x === undefined ? { ...s, x: def.spawn.x + s.dx, z: def.spawn.z + s.dz } : s));

  game.scene.add(group);
  const b = def.bounds;
  const grid = createGrid(b, ctx.colliders);

  /** 円（半径 r）を壁の外へ押し出す。p は x,z を持つ（Vector3 可） */
  function collide(p, r) {
    p.x = clamp(p.x, b.minX + r, b.maxX - r);
    p.z = clamp(p.z, b.minZ + r, b.maxZ - r);
    grid.each(p.x - r, p.z - r, p.x + r, p.z + r, (c) => {
      if (c.off) return;
      const nx = clamp(p.x, c.minX, c.maxX);
      const nz = clamp(p.z, c.minZ, c.maxZ);
      const dx = p.x - nx;
      const dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) return;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * r;
        p.z = nz + (dz / d) * r;
      } else {
        // 中心が箱の中：一番近い辺へ出す
        const l = p.x - c.minX;
        const rr = c.maxX - p.x;
        const t = p.z - c.minZ;
        const bt = c.maxZ - p.z;
        const m = Math.min(l, rr, t, bt);
        if (m === l) p.x = c.minX - r;
        else if (m === rr) p.x = c.maxX + r;
        else if (m === t) p.z = c.minZ - r;
        else p.z = c.maxZ + r;
      }
    });
  }

  /** 点が壁の中か（弾・カメラ用）。ignoreLow で低い障害物を無視 */
  function blocked(x, z, ignoreLow = false) {
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return true;
    const list = grid.at(x, z);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.off || (ignoreLow && c.low)) continue;
      if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    }
    return false;
  }

  /** a から b が壁にさえぎられずに見えるか（0.5m 刻みで調べる） */
  function sight(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / 0.5);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      if (blocked(ax + (bx - ax) * k, az + (bz - az) * k, true)) return false;
    }
    return true;
  }

  function update(dt, time) {
    for (const u of ctx.updaters) u(dt, time);
  }

  function dispose() {
    game.scene.remove(group);
    const geos = new Set();
    (function walk(o) {
      if (o.userData.keep) return; // 共有キャッシュを使うモデル（NPC など）
      if (o.geometry) geos.add(o.geometry);
      if (o.isInstancedMesh) o.dispose(); // インスタンス行列のバッファも解放
      if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
      o.children.forEach(walk);
    })(group);
    geos.forEach((g) => g.dispose());
    matCache.forEach((m) => m.dispose());
    ctx.extraDispose.forEach((fn) => fn());
  }

  return {
    id: areaId,
    def,
    group,
    colliders: ctx.colliders,
    interactables: ctx.interactables,
    gates: ctx.gates,
    extra: ctx.extra,
    wallH: def.wallH ?? 6,
    collide,
    blocked,
    sight,
    update,
    dispose,
  };
}

function buildGround(ctx) {
  const { def, group } = ctx;
  const b = def.bounds;
  const w = b.maxX - b.minX + 80;
  const d = b.maxZ - b.minZ + 80;
  const g = new THREE.PlaneGeometry(w, d, 1, 1);
  const ground = new THREE.Mesh(g, ctx.mat(def.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  ground.receiveShadow = true;
  group.add(ground);
}

function buildGate(ctx, g) {
  const dark = ctx.def.dark;
  const stone = dark ? 0x5d5866 : 0x9e9e9e;
  const w = 4.4;
  ctx.box(g.x - w / 2, 0, g.z, 0.8, 4.2, 0.8, stone, { collide: true });
  ctx.box(g.x + w / 2, 0, g.z, 0.8, 4.2, 0.8, stone, { collide: true });
  ctx.box(g.x, 4.2, g.z, w + 1.4, 0.7, 1, stone);
  const portalMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.8, 4.1), portalMat);
  portal.position.set(g.x, 2.05, g.z);
  ctx.group.add(portal);
  ctx.extraDispose.push(() => portalMat.dispose());
  // ゲート名の光る足元
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 24), portalMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(g.x, 0.03, g.z);
  ctx.group.add(ring);
  const gate = { ...g, portalMat, portal };
  ctx.gates.push(gate);
  ctx.updaters.push((dt, t) => {
    portalMat.opacity = 0.3 + Math.sin(t * 3) * 0.12;
  });
}

function buildSign(ctx, s) {
  ctx.box(s.x, 0, s.z, 0.15, 1.2, 0.15, 0x6d4c41, { collide: true, low: true });
  ctx.box(s.x, 1.0, s.z, 1.2, 0.6, 0.1, 0xa1887f);
  ctx.interactables.push({
    x: s.x, z: s.z, r: 2, label: '調べる', active: true,
    action: (game) => game.ui.dialog.talk('看板', SIGNS[s.key]),
  });
}
