// 床に描く視野コーン（扇形）。各レイを壁で切るので「壁越しには見えない」が見た目でもわかる
import * as THREE from 'three';
import { OPAQUE } from './config.js';

const RAYS = 28;

export function createCone(parent, color, opacity = 0.22, y = 0.04) {
  const pos = new Float32Array((RAYS + 2) * 3);
  const idx = [];
  for (let i = 0; i < RAYS; i++) idx.push(0, i + 2, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  parent.add(mesh);

  return {
    mesh,
    mat,
    /** 原点 (x,z)・向き angle（dir=(cos,sin)）・半角・距離で更新。smokes は視界を遮る煙 */
    update(grid, x, z, angle, half, range, smokes) {
      pos[0] = x;
      pos[1] = y;
      pos[2] = z;
      for (let i = 0; i <= RAYS; i++) {
        const a = angle - half + (2 * half * i) / RAYS;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        let d = grid.raycast(x, z, dx, dz, range, OPAQUE);
        if (smokes) d = Math.min(d, smokes.rayBlock(x, z, dx, dz, d));
        const k = (i + 1) * 3;
        pos[k] = x + dx * d;
        pos[k + 1] = y;
        pos[k + 2] = z + dz * d;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
