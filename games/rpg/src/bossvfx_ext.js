// ボスの技の見た目（ステージ7〜9 で増えた分）。src/bossvfx.js の T に足す
//   pool … しばらく残る溜まり（溶岩・渦潮・虚無）。縁が脈打ち、泡（火の粉）が上がる
//   orbs … 撃った場所のまわりを回る光球（位置は bossmoves_ext.js の orbPos と同じ式）
import * as THREE from 'three';
import { glow, ringGeo, hotOf } from './fxkit.js';
import { orbPos } from './bossmoves_ext.js';

/** h：{ add, burst, disc, G } … bossvfx.js の道具 */
export function extraBossVfx(h) {
  const { add, burst, disc, G } = h;
  const ball = () => G('extBall', () => new THREE.IcosahedronGeometry(1, 1));
  return {
    pool(d) {
      const g = new THREE.Group();
      const m = glow(d.color, 0.0);
      const core = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0, depthWrite: false });
      const rimM = glow(hotOf(d.color, 0.5), 0);
      const base = new THREE.Mesh(disc(), core);
      const shine = new THREE.Mesh(disc(), m);
      const rim = new THREE.Mesh(ringGeo(), rimM);
      base.position.y = 0.03;
      shine.position.y = 0.05;
      rim.position.y = 0.06;
      g.add(base, shine, rim);
      g.position.set(d.x, 0, d.z);
      g.scale.setScalar(d.r);
      const dur = d.dur ?? 5;
      const kind = d.kind || 'lava';
      return add(g, dur, (k, t) => {
        const on = Math.min(1, t / 0.3) * Math.min(1, (dur - t) / 0.5);
        core.opacity = 0.55 * on;
        m.opacity = (0.25 + 0.15 * Math.sin(t * 6)) * on;
        rimM.opacity = (0.6 + 0.3 * Math.sin(t * 9)) * on;
        if (kind === 'whirl') shine.rotation.y += 0.08; // 渦：回る
        else shine.scale.setScalar(0.85 + 0.1 * Math.sin(t * 4));
        if (Math.random() < 0.35 * on) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.random() * d.r * 0.85;
          burst(d.x + Math.sin(a) * rr, 0.2, d.z + Math.cos(a) * rr, d.color, 1, { speed: 1, up: kind === 'void' ? 1 : 4, life: 0.6, grav: kind === 'void' ? 0 : undefined });
        }
      }, [m, core, rimM]);
    },

    orbs(d) {
      const g = new THREE.Group();
      const m = glow(d.color, 0.9);
      const m2 = glow(hotOf(d.color, 0.6), 0.5);
      const list = [];
      for (let i = 0; i < d.n; i++) {
        const o = new THREE.Mesh(ball(), m);
        const halo = new THREE.Mesh(ball(), m2);
        o.scale.setScalar(d.r * 0.7);
        o.add(halo);
        halo.scale.setScalar(1.6);
        g.add(o);
        list.push(o);
      }
      return add(g, d.dur, (k, t) => {
        const on = Math.min(1, t / 0.2) * Math.min(1, (d.dur - t) / 0.25);
        m.opacity = 0.9 * on;
        m2.opacity = 0.45 * on;
        list.forEach((o, i) => {
          const p = orbPos(d, i, t);
          o.position.set(p.x, 1.2 + Math.sin(t * 5 + i) * 0.2, p.z);
          if (Math.random() < 0.15) burst(p.x, 1.2, p.z, d.color, 1, { speed: 0.5, up: 0.5, life: 0.35, grav: 0 });
        });
      }, [m, m2]);
    },
  };
}
