// 頭上の名前と HP バー（HTML を画面上の位置に重ねる）
//   ・近くの味方（自分以外・NEAR m 以内）：名前・職業の色・HP バー。倒れていたら「ダウン」
//   ・回復ができる職業（JOBS の healer）で遊んでいるときは、HP が PINCH 以下の味方を赤く光らせる
//   ・戦闘中のボス：名前と HP バー（2体同時の部屋は2体とも）
import * as THREE from 'three';
import { esc } from '../util.js';

const NEAR = 30; // 味方の名前を出す距離
const PINCH = 0.35; // ピンチとみなす HP の割合

export function createNameplates(game) {
  const layer = document.createElement('div');
  layer.className = 'rpg-plates';
  document.body.appendChild(layer);
  const plates = new Map(); // key → { el, name, fill, last }
  const v = new THREE.Vector3();
  let visible = true;

  function plate(key, boss) {
    let p = plates.get(key);
    if (!p) {
      const el = document.createElement('div');
      el.className = boss ? 'rpg-plate boss' : 'rpg-plate';
      el.innerHTML = '<div class="nm"></div><div class="bar"><div></div></div>';
      layer.appendChild(el);
      p = { el, name: el.querySelector('.nm'), fill: el.querySelector('.bar>div'), last: '' };
      plates.set(key, p);
    }
    p.seen = true;
    return p;
  }

  function place(p, x, y, z, clampTop = false) {
    v.set(x, y, z).project(game.camera);
    // カメラの後ろや左右の画面外なら出さない
    if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || (!clampTop && v.y > 1.2)) {
      p.el.style.display = 'none';
      return false;
    }
    // 大きなボスは頭の上が画面の上にはみ出すので、はみ出す分は上端に寄せる
    let sy = ((1 - v.y) / 2) * innerHeight;
    if (clampTop) sy = Math.max(sy, 64);
    p.el.style.display = 'block';
    p.el.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${sy}px) translate(-50%, -100%)`;
    return true;
  }

  function update() {
    for (const p of plates.values()) p.seen = false;
    const me = game.me();
    if (visible && game.playing && me) {
      const healer = !!me.job.healer;
      // 味方
      for (const o of game.players) {
        if (o === me) continue;
        if (Math.hypot(o.pos.x - me.pos.x, o.pos.z - me.pos.z) > NEAR) continue;
        const p = plate('p:' + o.id, false);
        if (!place(p, o.pos.x, 2.75, o.pos.z)) continue;
        const ratio = Math.max(0, o.hp / o.maxHp);
        const pinch = healer && (o.downed || ratio <= PINCH);
        const label = `${o.name || '仲間'}|${o.job.name}|${o.downed ? 1 : 0}`;
        if (p.last !== label) {
          p.last = label;
          p.name.innerHTML = `<b style="color:${o.job.color}">${esc(o.name || '仲間')}</b> <small>${esc(o.job.name)}</small>${o.downed ? ' <span class="dn">ダウン</span>' : ''}`;
        }
        p.fill.style.width = `${(ratio * 100).toFixed(0)}%`;
        p.fill.style.background = ratio < 0.3 ? '#ff5252' : '#66bb6a';
        p.el.classList.toggle('pinch', pinch);
      }
      // ボス
      for (const b of game.bosses) {
        if (!b.active || !b.alive) continue;
        const p = plate(`b:${b.idx}:${b.sub}`, true);
        if (!place(p, b.pos.x, b.pos.y + b.hpY + 0.9, b.pos.z, true)) continue;
        if (p.last !== b.name) {
          p.last = b.name;
          p.name.textContent = b.name;
        }
        p.fill.style.width = `${((b.hp / b.maxHp) * 100).toFixed(1)}%`;
        p.el.classList.toggle('stun', b.state === 'stun');
      }
    }
    // 今回使わなかった札は消す
    for (const [k, p] of plates) {
      if (p.seen) continue;
      p.el.remove();
      plates.delete(k);
    }
  }

  return {
    update,
    show(on) {
      visible = on;
      layer.style.display = on ? 'block' : 'none';
    },
  };
}
