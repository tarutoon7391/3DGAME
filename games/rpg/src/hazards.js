// ボスが出す「場の仕掛け」：すき間のある炎の壁・ドーナツ型の範囲・引き寄せの渦
// 壁と引き寄せは弾と同じく、各自のブラウザで「自分のプレイヤー」にだけ効かせる（ホストからは出現の合図だけ届く）
// ドーナツは見た目だけ（当たり判定はホストのボスがする）
import * as THREE from 'three';
import { hurtPlayer } from './combat.js';

export function createHazards(game) {
  const walls = [];
  const donuts = [];
  let pull = null; // { x, z, strength, t }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  /**
   * 炎の壁：(x,z) から yaw の方向へ進む。進む向きに垂直な長い壁で、gapC（横のずれ）に幅 gapW のすき間がある
   * d: { x, z, yaw, wait（動き出すまで）, speed, max（進む距離）, thick, gapC, gapW, frac, color }
   */
  function wall(d) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.75, depthWrite: false });
    const L = 40;
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(boxGeo, mat);
      // 横方向（ローカル x）にすき間の外側へ L だけ伸ばす
      m.scale.set(L, 3, d.thick);
      m.position.set(d.gapC + s * (d.gapW / 2 + L / 2), 1.5, 0);
      group.add(m);
    }
    group.rotation.y = d.yaw;
    game.scene.add(group);
    walls.push({ ...d, off: 0, hit: new Set(), group, mat, age: 0 });
  }

  /** ドーナツ型の範囲（rIn より内側は安全）。dur 秒だけ見せる */
  function donut(d) {
    const geo = new THREE.RingGeometry(d.rIn, d.rOut, 48).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(d.x, 0.05, d.z);
    const safeGeo = new THREE.RingGeometry(Math.max(0.1, d.rIn - 0.25), d.rIn, 48).rotateX(-Math.PI / 2);
    const safeMat = new THREE.MeshBasicMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.8, depthWrite: false });
    const safe = new THREE.Mesh(safeGeo, safeMat);
    safe.position.set(d.x, 0.06, d.z);
    game.scene.add(mesh, safe);
    donuts.push({ mesh, safe, geo, mat, safeGeo, safeMat, t: d.dur, age: 0 });
  }

  /** 引き寄せの渦：t 秒間、自分のプレイヤーを (x,z) へ引っぱる */
  function startPull(d) {
    pull = { ...d };
  }

  function update(dt) {
    const locals = game.players.filter((p) => p.alive && !p.remote);
    for (let i = walls.length - 1; i >= 0; i--) {
      const w = walls[i];
      w.age += dt;
      if (w.wait > 0) {
        w.wait -= dt;
        w.mat.opacity = 0.35 + 0.3 * Math.abs(Math.sin(w.age * 10));
      } else {
        w.mat.opacity = 0.75;
        w.off += w.speed * dt;
      }
      const s = Math.sin(w.yaw);
      const c = Math.cos(w.yaw);
      w.group.position.set(w.x + s * w.off, 0, w.z + c * w.off);
      if (w.wait <= 0) {
        for (const p of locals) {
          if (w.hit.has(p)) continue;
          const dx = p.pos.x - w.x;
          const dz = p.pos.z - w.z;
          const along = dx * s + dz * c;
          const side = dx * c - dz * s;
          if (Math.abs(along - w.off) < w.thick / 2 + p.radius && Math.abs(side - w.gapC) > w.gapW / 2 - p.radius * 0.5) {
            w.hit.add(p);
            hurtPlayer(game, p, w.frac, p.pos.x - s, p.pos.z - c);
          }
        }
        if (Math.random() < 0.5) game.fx.burst(w.group.position.x, 0.5, w.group.position.z, w.color, 2, { speed: 2, up: 3, life: 0.4 });
      }
      if (w.off > w.max) {
        game.scene.remove(w.group);
        w.mat.dispose();
        walls.splice(i, 1);
      }
    }
    for (let i = donuts.length - 1; i >= 0; i--) {
      const d = donuts[i];
      d.t -= dt;
      d.age += dt;
      d.mat.opacity = 0.25 + 0.2 * Math.abs(Math.sin(d.age * 8));
      if (d.t <= 0) removeDonut(i);
    }
    if (pull) {
      pull.t -= dt;
      for (const p of locals) {
        const dx = pull.x - p.pos.x;
        const dz = pull.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.6) {
          p.pos.x += (dx / d) * pull.strength * dt;
          p.pos.z += (dz / d) * pull.strength * dt;
          game.world.collide(p.pos, p.radius);
        }
      }
      if (Math.random() < 0.7) {
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 9;
        game.fx.burst(pull.x + Math.sin(a) * r, 0.4, pull.z + Math.cos(a) * r, pull.color ?? 0x80deea, 1, { speed: 1, up: 1, life: 0.5, grav: 0 });
      }
      if (pull.t <= 0) pull = null;
    }
  }

  function removeDonut(i) {
    const d = donuts[i];
    game.scene.remove(d.mesh, d.safe);
    d.geo.dispose();
    d.mat.dispose();
    d.safeGeo.dispose();
    d.safeMat.dispose();
    donuts.splice(i, 1);
  }

  function clear() {
    for (const w of walls) {
      game.scene.remove(w.group);
      w.mat.dispose();
    }
    walls.length = 0;
    for (let i = donuts.length - 1; i >= 0; i--) removeDonut(i);
    pull = null;
  }

  return { wall, donut, startPull, update, clear, get pulling() { return !!pull; } };
}
