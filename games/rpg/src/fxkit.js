// 技エフェクトの共通の部品（形の使い回し・光る材質・色の計算）。skillfx.js・skillfx_b.js から使う
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const geoCache = new Map();
export function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}
/** 扇形（XZ 平面、+Z 向きが真ん中）。UV は平面のままなので、放射状の模様がそのまま乗る */
export const sectorGeo = (arc) => geo('sec' + arc.toFixed(2), () => new THREE.CircleGeometry(1, 40, -Math.PI / 2 - arc / 2, arc).rotateX(-Math.PI / 2));
export const discGeo = () => geo('disc', () => new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2));
export const columnGeo = () => geo('col', () => new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0));
export const beamGeo = () => geo('beam', () => new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5));
export const ribbonGeo = () => geo('rib', () => new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0)); // +X へ 0..1
export const ringGeo = () => geo('ring', () => new THREE.RingGeometry(0.93, 1, 56).rotateX(-Math.PI / 2));

export function glow(color, opacity = 1, map = null) {
  return new THREE.MeshBasicMaterial({
    color, map, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2,
  });
}
/** 矢（矢じり・羽根つき）。+Y 向き、長さ約 1.5m。色は頂点色 */
export function arrowGeo() {
  return geo('arrow', () => {
    const parts = [];
    const paint = (g, hex) => {
      g = g.index ? g.toNonIndexed() : g;
      const c = new THREE.Color(hex);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      g.deleteAttribute('uv');
      parts.push(g);
    };
    paint(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5), 0x8d6e63);
    paint(new THREE.ConeGeometry(0.1, 0.3, 4).translate(0, 0.8, 0), 0xcfd8dc);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      paint(new THREE.BoxGeometry(0.012, 0.28, 0.15).translate(0, -0.5, 0.08).rotateY(a), 0xa5d6a7);
    }
    paint(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6).translate(0, -0.64, 0), 0x4e342e);
    return mergeGeometries(parts, false);
  });
}


export const hotOf = (color, k = 0.5) => new THREE.Color(color).lerp(new THREE.Color(0xffffff), k).getHex();
export const ease = (k) => 1 - (1 - k) * (1 - k);
