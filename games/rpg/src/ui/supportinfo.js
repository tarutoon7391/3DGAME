// 回復・強化の技が「いま撃ったら何人に届くか」：スキル欄の上に人数を出し、届く仲間の足元に輪を出す
// 対象は一度きりで効く回復・強化だけ（置いておく回復の場・数秒かけて回復する技は除く）
import * as THREE from 'three';
import { GAUGE } from '../data/jobs.js';

/** 専用の処理（SKILLS）の技で、一度きりの回復・強化のもの：id → { type, r（0 は全員） } */
const BY_ID = {
  heal: (sk) => ({ type: 'heal', r: sk.radius }), // 僧侶の癒しの光
  prayer: () => ({ type: 'heal', r: 0 }), // 女神の祈り
  courage: (sk) => ({ type: 'buff', r: sk.radius }), // 勇気の歌
  gale: () => ({ type: 'buff', r: 0 }), // 疾風の旋律
  sanctuary: (sk) => ({ type: 'buff', r: sk.radius }), // 聖なる守り
};

/** 技が一度きりの回復・強化なら { type: 'heal' | 'buff', r }、違えば null */
export function supportOf(sk) {
  if (!sk) return null;
  if (BY_ID[sk.id]) return BY_ID[sk.id](sk);
  switch (sk.kind) {
    case 'teamheal': return { type: 'heal', r: sk.radius || 0 };
    case 'teambuff':
    case 'teamgauge': return { type: 'buff', r: sk.radius || 0 };
    case 'cleanse': return sk.team ? { type: 'buff', r: sk.radius || 0 } : null;
    case 'cdreset': return { type: 'buff', r: 0 };
    default: return null;
  }
}

/** me のまわり（r 以内。0 なら全員）にいる、生きている仲間（自分も含む） */
export function inRange(game, me, r) {
  return game.players.filter((p) => p.alive && !p.downed && (!r || Math.hypot(p.pos.x - me.pos.x, p.pos.z - me.pos.z) <= r));
}

/** スキル欄に付ける札（人数）。回復・強化の技でなければ '' */
export function supportBadge(game, me, sk) {
  const s = supportOf(sk);
  if (!s) return '';
  const n = inRange(game, me, s.r).length;
  return `<em class="rpg-who ${s.type}">${s.type === 'heal' ? '✚' : '▲'}${n}人</em>`;
}

/** 届く仲間の足元の輪（使える回復・強化の技があるときだけ。回復は緑・強化は黄） */
export function createSupportMarks(game) {
  const geo = new THREE.RingGeometry(0.75, 0.95, 32).rotateX(-Math.PI / 2);
  const mats = {
    heal: new THREE.MeshBasicMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.85, depthWrite: false }),
    buff: new THREE.MeshBasicMaterial({ color: 0xffee58, transparent: true, opacity: 0.85, depthWrite: false }),
  };
  const rings = [];
  return {
    update() {
      const me = game.me();
      const want = new Map(); // 仲間 → 'heal' | 'buff'
      if (me?.alive && game.playing) {
        const J = me.job;
        for (const k of ['q', 'e', 'c', 'r']) {
          const sk = J[k];
          const s = supportOf(sk);
          if (!s) continue;
          const ready = k === 'r' ? me.gauge >= GAUGE.max : (me.cd[k] ?? 0) <= 0;
          if (!ready) continue;
          for (const p of inRange(game, me, s.r)) if (p !== me && want.get(p) !== 'heal') want.set(p, s.type);
        }
      }
      let i = 0;
      const t = performance.now() / 1000;
      for (const [p, type] of want) {
        let m = rings[i];
        if (!m) {
          m = new THREE.Mesh(geo, mats.heal);
          m.renderOrder = 3;
          game.scene.add(m);
          rings.push(m);
        }
        m.material = mats[type];
        m.visible = true;
        m.position.set(p.pos.x, 0.08, p.pos.z);
        m.scale.setScalar(1 + 0.08 * Math.sin(t * 6));
        i++;
      }
      for (; i < rings.length; i++) rings[i].visible = false;
    },
  };
}
