// 技の演出をレシピ（data/skillvis.js）から組み立てて出す。鎖鎌使いより後の職業の技はこれで動く
//   cast(p, sk, d) … 技を使った瞬間（jobs.js の run から。全員の画面で）
//   tick(p, sk, n, ticks) … 周囲攻撃の1回ごと / zone(z) … 置いたエリア・時間差の一撃の見た目
//   frames … バフ中の画面の縁の色（自分にかかっているバフ）
import * as THREE from 'three';
import { starTexture, glyphTexture, smokeTexture, petalTexture, shieldIconTexture, coinIconTexture, wingIconTexture } from './fxtex.js';
import { SKILL_VIS, BUFF_FRAMES } from './data/skillvis.js';
import { createVisKit } from './skillvis_kit.js';

const sprite = (map, color, opacity = 1, additive = true) => new THREE.SpriteMaterial({
  map, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});
const later = (sec, fn) => (sec > 0 ? setTimeout(fn, sec * 1000) : fn());

export function createSkillVis({ game, add, mesh, slash, column, slam, streak }) {
  const fx = () => game.skillFx;

  // ---------------- 場所 ----------------
  function nearestBoss(p, max = 30) {
    let best = null;
    let bd = max;
    for (const b of game.bosses || []) {
      if (!b.alive || b.active === false) continue;
      const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  /** at：self（足元）/ front（前 dist m）/ target（一番近いボス。いなければ前）/ aim（狙った場所） */
  function where(c, at = 'self', dist = 2.5) {
    const { p, d } = c;
    const yaw = c.yaw;
    if (at === 'target') {
      const b = c.target || nearestBoss(p);
      if (b) return { x: b.pos.x, z: b.pos.z, y: Math.min(2.6, (b.hpY ?? 2.5) * 0.55), obj: b };
      at = 'front';
      dist = 6;
    }
    if (at === 'aim' && d?.tx !== undefined) return { x: d.tx, z: d.tz, y: 1 };
    if (at === 'front') return { x: p.pos.x + Math.sin(yaw) * dist, z: p.pos.z + Math.cos(yaw) * dist, y: 1.2 };
    return { x: p.pos.x, z: p.pos.z, y: 1.2 };
  }

  const { flash, orbit, scatter, dome, net, lob, fallers } = createVisKit({ game, add, mesh, where, nearestBoss });

  // ---------------- エリアの見た目（置いている間ずっと） ----------------
  const zoneRecs = [];
  function zoneLoop(z, o) {
    zoneRecs.push({ z, o, cd: 0, t: 0 });
  }
  function updateZones(dt) {
    for (let i = zoneRecs.length - 1; i >= 0; i--) {
      const R = zoneRecs[i];
      const { z, o } = R;
      if (z.fake) z.t -= dt; // 技の一瞬だけの渦（吸い込みなど）
      if (z.removed || z.t <= 0) {
        zoneRecs.splice(i, 1);
        continue;
      }
      R.t += dt;
      R.cd -= dt;
      if (R.cd > 0) continue;
      R.cd = o.every ?? 0.15;
      const a = Math.random() * Math.PI * 2;
      const rr = z.r * Math.sqrt(Math.random()) * 0.92;
      const x = z.x + Math.sin(a) * rr;
      const zz = z.z + Math.cos(a) * rr;
      if (o.type === 'bolt') fx().bolt?.(x, zz, z.color, 0.6);
      else if (o.type === 'zap') fx().groundZap?.(x, zz, z.color);
      else if (o.type === 'fall') {
        // 上から降ってくるマーク（雨・ナイフ・花びら・雪）
        const m = sprite(o.glyph ? glyphTexture(o.glyph) : o.tex === 'petal' ? petalTexture() : starTexture(), o.color ?? z.color, 1, !o.normal);
        const sp = new THREE.Sprite(m);
        const h = o.h ?? 6;
        add(sp, o.life ?? 0.5, (k) => {
          sp.position.set(x, h * (1 - k) + 0.2, zz);
          sp.scale.setScalar(o.size ?? 0.6);
          m.rotation = o.spin ? k * o.spin : Math.PI;
          m.opacity = k > 0.85 ? (1 - k) / 0.15 : 1;
        }, [m]);
        if (o.splash) game.fx?.burst?.(x, 0.2, zz, o.color ?? z.color, 3, { speed: 2, up: 1.5, life: 0.3, size: 0.08 });
      } else if (o.type === 'rise') {
        // 地面から湧き上がるマーク（炎・回復・音符・泡）
        const m = sprite(o.glyph ? glyphTexture(o.glyph) : o.tex === 'smoke' ? smokeTexture() : o.tex === 'petal' ? petalTexture() : starTexture(), o.color ?? z.color, 1, !o.normal);
        const sp = new THREE.Sprite(m);
        add(sp, o.life ?? 1, (k) => {
          sp.position.set(x, 0.3 + k * (o.h ?? 2), zz);
          sp.scale.setScalar((o.size ?? 0.5) * (o.grow ? 0.5 + k * o.grow : 1));
          m.opacity = Math.sin(k * Math.PI) * (o.opacity ?? 1);
          m.rotation = k * (o.spin ?? 0);
        }, [m]);
      } else if (o.type === 'swirl') {
        // 中心へ吸い込まれる渦（ブラックホール・重力・大嵐）
        const m = sprite(o.tex === 'smoke' ? smokeTexture() : starTexture(), o.color ?? z.color, 1, !o.normal);
        const sp = new THREE.Sprite(m);
        const r0 = z.r;
        const a0 = a;
        const dir = o.out ? -1 : 1;
        add(sp, o.life ?? 0.9, (k) => {
          const rr2 = dir > 0 ? r0 * (1 - k) : r0 * k;
          const aa = a0 + k * (o.turn ?? 4);
          sp.position.set(z.x + Math.sin(aa) * rr2, (o.y ?? 0.4) + (o.lift ? k * o.lift : 0), z.z + Math.cos(aa) * rr2);
          sp.scale.setScalar((o.size ?? 0.6) * (dir > 0 ? 1 - k * 0.6 : 0.5 + k));
          m.opacity = Math.sin(k * Math.PI) * (o.opacity ?? 1);
        }, [m]);
      }
    }
  }

  // ---------------- レシピを実行 ----------------
  function step(c, s) {
    const [type, o = {}] = s;
    if (typeof o.at === 'number' && o.at > 0) return later(o.at, () => step(c, [type, { ...o, at: 0 }])); // at：何秒後に出すか
    const { p } = c;
    const col = o.color ?? c.sk.color ?? 0xffffff;
    switch (type) {
      case 'vm':
        p.vmAnim = { kind: o.kind, t: 0, dur: o.dur ?? 0.5, ...(o.extra || {}) };
        break;
      case 'slash': {
        const yaw = c.yaw + (o.yawOff ?? 0);
        const r = o.r ?? c.sk.range ?? c.sk.radius ?? 3.5;
        if (o.white !== false) slash(p.pos.x, p.pos.z, yaw, r * 0.92, o.arc ?? 2.4, 0xffffff, { y: o.y ?? 1.2, roll: o.roll ?? 0, dur: (o.dur ?? 0.3) * 0.85, sweep: o.sweep ?? 1 });
        slash(p.pos.x, p.pos.z, yaw, r, o.arc ?? 2.4, col, { y: o.y ?? 1.2, roll: o.roll ?? 0, dur: o.dur ?? 0.3, sweep: o.sweep ?? 1 });
        break;
      }
      case 'ring':
        fx().iconRing?.(p, o.r ?? c.sk.radius ?? 8, col, o.tex === 'shield' ? shieldIconTexture() : o.tex === 'coin' ? coinIconTexture() : o.tex === 'wing' ? wingIconTexture() : o.glyph ? glyphTexture(o.glyph) : starTexture(), o.n ?? 10, o.dur ?? 1.2, o.rise ?? 0.5);
        break;
      case 'song':
        fx().songRing?.(p.pos.x, p.pos.z, o.r ?? c.sk.radius ?? 10, col, o.mood ?? 'hype');
        break;
      case 'scatter':
        scatter(c, { ...o, r: o.r ?? c.sk.radius });
        break;
      case 'explode': {
        const n = o.n ?? 1;
        for (let i = 0; i < n; i++) {
          later((o.gap ?? 0.1) * i, () => {
            const w = where(c, o.where ?? 'self', o.dist);
            const a = Math.random() * Math.PI * 2;
            const sp = n > 1 ? (o.spread ?? 2) * Math.random() : 0;
            fx().explosion?.(w.x + Math.sin(a) * sp, w.z + Math.cos(a) * sp, o.r ?? 2.5, col, !!o.big);
          });
        }
        break;
      }
      case 'bolt': {
        const n = o.n ?? 1;
        for (let i = 0; i < n; i++) {
          later((o.gap ?? 0.07) * i, () => {
            const w = where(c, o.where ?? 'target');
            const a = Math.random() * Math.PI * 2;
            const sp = n > 1 ? (o.spread ?? 2.5) * Math.random() : 0;
            fx().bolt?.(w.x + Math.sin(a) * sp, w.z + Math.cos(a) * sp, col, o.size ?? 1);
          });
        }
        break;
      }
      case 'column': {
        const w = where(c, o.where ?? 'self', o.dist);
        column(w.x, w.z, o.r ?? 1.2, o.h ?? 5, col, o.dur ?? 0.6, o.where === 'self' || !o.where ? p : null, o.opacity ?? 0.6);
        break;
      }
      case 'slam': {
        const w = where(c, o.where ?? 'self', o.dist);
        slam(w.x, w.z, o.r ?? c.sk.radius ?? 3, col);
        break;
      }
      case 'flash': {
        const w = where(c, o.where ?? 'self', o.dist);
        flash(w.x, o.y ?? w.y ?? 1.2, w.z, col, o.size ?? 4, o.dur ?? 0.35);
        break;
      }
      case 'streak': {
        const w = where(c, o.where ?? 'target');
        streak(p.pos.x, p.pos.z, w.x, w.z, o.w ?? 0.7, col, o.dur ?? 0.3, o.y ?? 1.3);
        break;
      }
      case 'orbit': {
        const w = o.where === 'target' ? where(c, 'target').obj : p;
        if (w) orbit(w, { ...o, color: col, dur: o.dur ?? c.sk.dur ?? 3 });
        break;
      }
      case 'dome':
        dome(p, { ...o, color: col, r: o.r ?? 2, dur: o.dur ?? 1 });
        break;
      case 'burst': {
        const w = where(c, o.where ?? 'self', o.dist);
        game.fx?.burst?.(w.x, o.y ?? w.y ?? 1.2, w.z, col, o.n ?? 30, { speed: o.speed ?? 7, up: o.up ?? 4, life: o.life ?? 0.6, size: o.size ?? 0.16 });
        break;
      }
      case 'shake':
        game.fx?.shake?.(o.amt ?? 0.4);
        break;
      case 'confetti': {
        const w = where(c, o.where ?? 'self');
        fx().confetti?.(w.x, w.z, o.n ?? 80, o.h ?? 3, o.spread ?? 5);
        break;
      }
      case 'fire':
        fx().breath?.(p, { range: o.range ?? c.sk.range ?? 6, arc: o.arc ?? c.sk.arc ?? 1.2 });
        break;
      case 'bind': {
        const b = where(c, 'target').obj;
        if (b) fx().chainBind?.(p, b, o.dur ?? 4);
        break;
      }
      case 'net':
        net(c, { ...o, dur: o.dur ?? 4 });
        break;
      case 'skulls': {
        const b = where(c, 'target').obj;
        if (b) fx().skullSwarm?.(b, col);
        break;
      }
      case 'drain': {
        const b = where(c, 'target').obj;
        if (b) fx().drainWind?.(p, b, col);
        break;
      }
      case 'lob':
        lob(c, { ...o, color: col });
        break;
      case 'pillar': {
        const w = where(c, o.where ?? 'target', o.dist);
        column(w.x, w.z, o.r ?? 1.5, o.h ?? 9, col, o.dur ?? 0.5, null, 0.85);
        flash(w.x, 1, w.z, col, o.size ?? 6, 0.4);
        break;
      }
      case 'clock': {
        const b = where(c, 'target').obj;
        if (b) fx().clock?.(b, o.dur ?? 4, o.mode ?? 'slow');
        break;
      }
      case 'suck': {
        // まわりから吸い込む渦（dur 秒）
        const w = where(c, o.where ?? 'self');
        zoneLoop({ fake: true, x: w.x, z: w.z, r: o.r ?? c.sk.radius ?? 5, t: o.dur ?? 1, color: col }, { type: 'swirl', every: o.every ?? 0.03, turn: o.turn ?? 3, life: o.life ?? 0.6, size: o.size ?? 0.5, y: 1.2, out: !!o.out });
        break;
      }
      case 'shieldwall':
        fx().shieldWall?.(p, o.dur ?? c.sk.dur ?? 1, col);
        break;
      case 'rewind':
        if (p === game.me?.()) fx().rewindScreen?.();
        break;
      case 'whiteout':
        if (p === game.me?.()) {
          const el = document.createElement('div');
          el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:6;background:${o.css ?? '#fff'};opacity:0`;
          document.body.appendChild(el);
          add(new THREE.Group(), o.dur ?? 0.35, (k) => {
            el.style.opacity = ((k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8) * (o.max ?? 0.8)).toFixed(2);
            if (k >= 1) el.remove();
          }, []);
        }
        break;
      default:
        break;
    }
  }

  // ---------------- 画面の縁（バフ中） ----------------
  let frameT = 0;
  const frameEls = {};
  function updateFrames(dt) {
    if (typeof document === 'undefined') return;
    frameT += dt;
    const me = game.me?.();
    for (const [buff, css] of Object.entries(BUFF_FRAMES)) {
      const b = me?.alive ? me.buffs?.[buff] : null;
      if (!b && !frameEls[buff]) continue;
      let el = frameEls[buff];
      if (!el) {
        el = document.createElement('div');
        el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;transition:opacity .25s;box-sizing:border-box;box-shadow:inset 0 0 75px 16px rgba(${css},.5);border:4px solid rgba(${css},.75)`;
        document.body.appendChild(el);
        frameEls[buff] = el;
      }
      const on = b && b.t > 0;
      const blink = on && b.t < 1.5 ? (Math.sin(frameT * 18) > 0 ? 1 : 0.3) : 1;
      el.style.opacity = (on ? (0.75 + 0.25 * Math.sin(frameT * 3.5)) * blink : 0).toFixed(2);
    }
  }

  return {
    has: (id) => !!SKILL_VIS[id],
    /** 技を使った瞬間 */
    cast(p, sk, d) {
      const R = SKILL_VIS[sk?.id];
      if (!R?.cast) return;
      const c = { p, sk, d, yaw: d?.yaw ?? p.yaw };
      for (const s of R.cast) step(c, s);
    },
    /** 周囲攻撃の1回ごと。true を返すと、いつもの輪は出さない */
    tick(p, sk, n, ticks) {
      const R = SKILL_VIS[sk?.id];
      if (!R?.tick) return false;
      const c = { p, sk, yaw: p.yaw, n, ticks };
      const list = typeof R.tick === 'function' ? R.tick(n, ticks) : R.tick;
      for (const s of list) step(c, s);
      return !!R.noSpin;
    },
    /** エリア・時間差の一撃の見た目 */
    zone(z) {
      const R = SKILL_VIS[z.skill];
      if (!R?.zone) return;
      if (R.zone.fall) fallers(z, R.zone.fall);
      if (R.zone.loop) for (const o of [].concat(R.zone.loop)) zoneLoop(z, o);
    },
    /** 時間差の一撃が落ちた（レシピの land） */
    land(z) {
      const R = SKILL_VIS[z.skill];
      if (!R?.land) return;
      const c = { p: { pos: { x: z.x, z: z.z }, yaw: 0 }, sk: { color: z.color, radius: z.r }, yaw: 0 };
      for (const s of R.land) step(c, s);
    },
    /** 跳ぶ技の着地（レシピの landing） */
    landing(p, sk) {
      const R = SKILL_VIS[sk?.id];
      if (!R?.landing) return;
      const c = { p, sk, yaw: p.yaw };
      for (const s of R.landing) step(c, s);
    },
    /** 時間差の一撃：いつもの柱を出すか */
    hidesColumn: (id) => !!SKILL_VIS[id]?.zone?.fall,
    update(dt) {
      updateZones(dt);
      updateFrames(dt);
    },
  };
}
