// 竜人の竜化：プレイヤーの体を赤い竜に置きかえる（skillfx_f.js から使う。全員の画面で同じように動く）
//   start(p, dur) … appear 秒後に竜が現れ、dur 秒たつとゆっくり縮んで人の姿に戻る
//   flap(p, sec) … 翼撃のあいだ大きく羽ばたく / headOf(p) … 口の位置（竜の息吹の出どころ）
import * as THREE from 'three';
import { makeMonsterModel } from './models.js';

const SCALE = 1.25; // 敵の竜（1.7〜2.9）より少し小さめ
const APPEAR = 0.35; // 雷の光で見えないうちに変わる
const BACK = 1.6; // 元に戻るのにかける秒

export function createDragonForms(game) {
  const recs = new Map(); // player → rec

  function start(p, dur) {
    const old = recs.get(p);
    if (old) {
      old.dur = old.t + dur; // かけ直しは延長
      return;
    }
    const m = makeMonsterModel(0xc62828, { monster: 'dragon', scale: SCALE, horn: 0xffe0b2, eye: 0xffea00, belly: 0xffab91, wingColor: 0x7f1d1d });
    m.group.visible = false;
    m.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    p.model.group.add(m.group);
    recs.set(p, { p, m, t: 0, dur, flapT: 0, lx: p.pos.x, lz: p.pos.z, walk: 0, model: p.model });
  }

  function end(rec) {
    rec.m.group.parent?.remove(rec.m.group);
    rec.m.bodyMat.dispose();
    rec.p.model.root.visible = true;
    rec.p.model.root.scale.setScalar(1);
    rec.p.dragon = false;
    rec.p.camLift = 0;
    recs.delete(rec.p);
  }

  function update(dt) {
    for (const rec of [...recs.values()]) {
      const { p, m } = rec;
      rec.t += dt;
      const t = rec.t;
      if (t < APPEAR) continue;
      const hero = p.model.root;
      // 動いた量（歩きの脚の振り）
      const mv = Math.hypot(p.pos.x - rec.lx, p.pos.z - rec.lz) / Math.max(dt, 1e-3);
      rec.lx = p.pos.x;
      rec.lz = p.pos.z;
      rec.walk += dt * Math.min(12, mv * 1.2);
      let s; // 竜の大きさ（0〜1）
      if (t < rec.dur) {
        s = Math.min(1, 0.55 + (t - APPEAR) * 3); // 雷の中から一気に現れる
        hero.visible = false;
        p.dragon = true;
      } else {
        // ゆっくり縮んで人の姿に戻る
        const k = Math.min(1, (t - rec.dur) / BACK);
        s = 1 - k * 0.85;
        hero.visible = k > 0.35;
        hero.scale.setScalar(0.3 + 0.7 * Math.max(0, (k - 0.35) / 0.65));
        p.dragon = k < 0.5;
        if (Math.random() < 0.5) game.fx?.burst?.(p.pos.x, 1 + Math.random() * 2, p.pos.z, 0xff5722, 2, { speed: 2, up: 2, life: 0.5, size: 0.14 });
        if (k >= 1) {
          end(rec);
          continue;
        }
      }
      m.group.visible = true;
      m.group.scale.setScalar(s);
      m.group.position.y = hero.position.y; // 翼撃で飛んでいる高さ
      // 翼：ふだんはゆったり、翼撃のあいだは大きく
      rec.flapT = Math.max(0, rec.flapT - dt);
      const big = rec.flapT > 0;
      const fa = big ? 0.75 * Math.sin(t * 6.3) : 0.18 * Math.sin(t * 2.5);
      m.armL.rotation.z = 0.15 + fa;
      m.armR.rotation.z = -0.15 - fa;
      const leg = Math.sin(rec.walk) * 0.5 * Math.min(1, mv / 3);
      m.legL.rotation.x = leg;
      m.legR.rotation.x = -leg;
      m.root.position.y = Math.abs(Math.sin(rec.walk)) * 0.06 * Math.min(1, mv / 3);
      // 一人称の視点を竜の高さへ
      p.camLift = (p.camLift || 0) + ((p.dragon ? 1.9 * s : 0) - (p.camLift || 0)) * Math.min(1, dt * 4);
    }
  }

  return {
    start,
    update,
    active: (p) => recs.has(p) && !!p.dragon,
    /** 翼撃のあいだ大きく羽ばたく */
    flap(p, sec) {
      const r = recs.get(p);
      if (r) r.flapT = sec;
    },
    /** 竜の口の位置（息吹の出どころ） */
    mouth(p) {
      const f = 3.0 * SCALE * 0.82;
      return { x: p.pos.x + Math.sin(p.yaw) * f, y: 3.9 * SCALE * 0.82 + (p.model?.root?.position.y || 0), z: p.pos.z + Math.cos(p.yaw) * f };
    },
    clear() {
      for (const r of [...recs.values()]) end(r);
    },
  };
}
