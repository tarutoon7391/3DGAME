// パワーアップアイテム（連射強化・拡散弾・シールド）。InstancedMesh プール
import * as THREE from 'three';
import { InstPool } from './pool.js';

export const ITEM_KINDS = {
  rapid: { label: '連射強化', color: 0xffe14d },
  spread: { label: '拡散弾', color: 0x5dff8a },
  shield: { label: 'シールド', color: 0x4db8ff },
};

export function createItems(scene) {
  const pool = new InstPool(
    scene,
    new THREE.OctahedronGeometry(0.9, 0),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    24,
    () => ({ kind: 'rapid', t: 0 }),
  );
  // 外側のワイヤー枠（同じ行列を使う）
  const wire = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(1.5, 0),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.7, toneMapped: false }),
    24,
  );
  wire.frustumCulled = false;
  wire.setColorAt(0, new THREE.Color());
  wire.count = 0;
  scene.add(wire);

  function spawn(kind, pos) {
    const it = pool.spawn();
    if (!it) return;
    it.kind = kind;
    it.t = 0;
    it.pos.copy(pos);
    it.vel.set(0, 0, 10);
    it.color.setHex(ITEM_KINDS[kind].color);
  }

  /** 移動と取得判定。取ったら onPick(kind) */
  function update(dt, target, onPick) {
    const a = pool.alive;
    for (let i = 0; i < a.length; i++) {
      const it = a[i];
      if (!it.alive) continue;
      it.t += dt;
      it.rot.y += dt * 3;
      it.rot.x = Math.sin(it.t * 2) * 0.4;
      const dx = target.x - it.pos.x, dy = target.y - it.pos.y, dz = target.z - it.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      // 近づくと吸い寄せられる
      if (d2 < 140) {
        const d = Math.sqrt(d2) || 1;
        it.vel.set((dx / d) * 30, (dy / d) * 30, (dz / d) * 30);
      }
      it.pos.addScaledVector(it.vel, dt);
      if (d2 < 6.5) {
        pool.kill(it);
        onPick(it.kind);
      } else if (it.pos.z > 10) {
        pool.kill(it);
      }
    }
    pool.sync();
    wire.instanceMatrix.array.set(pool.mesh.instanceMatrix.array.subarray(0, pool.mesh.count * 16));
    wire.instanceColor.array.set(pool.mesh.instanceColor.array.subarray(0, pool.mesh.count * 3));
    wire.count = pool.mesh.count;
    wire.instanceMatrix.needsUpdate = true;
    wire.instanceColor.needsUpdate = true;
  }

  function clear() {
    pool.clear();
    wire.count = 0;
  }

  return { spawn, update, clear };
}
