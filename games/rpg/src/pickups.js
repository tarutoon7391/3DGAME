// ドロップ品（ゴールド・アイテム）。近づくと吸い寄せられて拾える
import * as THREE from 'three';
import { rand } from './util.js';

const COLORS = { potion: 0xff5252, ether: 0x448aff, herb: 0x76ff03, fang: 0xfff3e0, bone: 0xd7ccc8 };

export function createPickups(game) {
  const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.07, 10);
  coinGeo.rotateZ(Math.PI / 2);
  const bagGeo = new THREE.OctahedronGeometry(0.25, 0);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0x8a6d00, metalness: 0.6, roughness: 0.3 });
  const mats = {};
  const list = [];

  function spawn(id, amount, x, z) {
    let m;
    if (id === 'gold') m = new THREE.Mesh(coinGeo, coinMat);
    else {
      if (!mats[id]) mats[id] = new THREE.MeshStandardMaterial({ color: COLORS[id] || 0xffffff, emissive: COLORS[id] || 0xffffff, emissiveIntensity: 0.35, flatShading: true });
      m = new THREE.Mesh(bagGeo, mats[id]);
    }
    m.castShadow = true;
    m.position.set(x, 0.5, z);
    game.scene.add(m);
    list.push({ id, amount, mesh: m, vx: rand(-2, 2), vz: rand(-2, 2), vy: 4, t: 0 });
  }

  function take(pk, pl) {
    game.scene.remove(pk.mesh);
    if (pk.id === 'gold') {
      game.state.progress.gold += pk.amount;
      game.sound.se('coin');
      game.fx.text(pl.pos.x, 2.2, pl.pos.z, `+${pk.amount}G`, '#ffd54f');
    } else {
      game.collectItem(pk.id, pk.amount, pl.pos.x, pl.pos.z);
    }
  }

  function update(dt, time) {
    for (let i = list.length - 1; i >= 0; i--) {
      const pk = list[i];
      pk.t += dt;
      const m = pk.mesh;
      if (pk.vy !== 0 || m.position.y > 0.4) {
        pk.vy -= 15 * dt;
        m.position.x += pk.vx * dt;
        m.position.z += pk.vz * dt;
        m.position.y += pk.vy * dt;
        if (m.position.y <= 0.4) { m.position.y = 0.4; pk.vy = 0; }
      } else {
        m.position.y = 0.4 + Math.sin(time * 4 + i) * 0.08;
      }
      m.rotation.y += dt * 3;
      // 一番近いプレイヤーへ吸い寄せ
      let best = null;
      let bd = 9;
      for (const p of game.players) {
        if (!p.alive) continue;
        const d = (p.pos.x - m.position.x) ** 2 + (p.pos.z - m.position.z) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      if (best && pk.t > 0.4) {
        const d = Math.sqrt(bd);
        if (d < 0.7) {
          take(pk, best);
          list.splice(i, 1);
          continue;
        }
        const sp = 10 * dt / d;
        m.position.x += (best.pos.x - m.position.x) * Math.min(1, sp);
        m.position.z += (best.pos.z - m.position.z) * Math.min(1, sp);
      }
      if (pk.t > 40) {
        game.scene.remove(m);
        list.splice(i, 1);
      }
    }
  }

  function clear() {
    list.forEach((pk) => game.scene.remove(pk.mesh));
    list.length = 0;
  }

  return { spawn, update, clear };
}
