// ものまね師の必殺技「ものまね変身」：近くのボスをコピーして、そのボスの技を自分の技として撃つ
// ボスの技のデータ（data/enemies.js の patterns。台本 seq も、昔からの kind も）を、プレイヤーの攻撃に読み替える
// 当たり判定は自分のブラウザだけ（local）。見た目はボスと同じ bossVfx を全員の画面で出す
import { BOSSES } from './data/enemies.js';
import { strike, forEachTarget } from './combat.js';
import { angleDiff, yawTo } from './util.js';
import { GAUGE } from './data/jobs.js';

const SPEED = 0.6; // ボスより早く出す（予兆がいらないので）
const MULT = { hit: 1.8, zone: 1.7, shot: 0.7, wave: 1.5, line: 1.8, spin: 2.2 }; // 種類ごとの威力

/** そのボスの技の名前（必殺技は除く） */
export function copyMoves(key) {
  const P = BOSSES[key]?.patterns || {};
  return Object.keys(P).filter((n) => n !== 'ult' && !P[n].ult);
}

/** 一番近い戦闘中のボス */
export function nearestBoss(game, x, z) {
  let best = null;
  let bd = Infinity;
  for (const b of game.bosses) {
    if (!b.active || !b.alive) continue;
    const d = Math.hypot(b.pos.x - x, b.pos.z - z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/**
 * コピーした技を撃つ。d：{ x, z, yaw, bx, bz（狙うボス）, ck（ボスのキー）, cm（技の名前）}
 */
export function useCopiedMove(game, p, d, local) {
  const C = BOSSES[d.ck];
  const pat = C?.patterns?.[d.cm];
  if (!pat) return;
  const color = pat.color ?? C.color;
  const aim = d.bx !== undefined ? yawTo(d.x, d.z, d.bx, d.bz) : d.yaw;
  const tgt = d.bx !== undefined ? { x: d.bx, z: d.bz } : { x: d.x + Math.sin(aim) * 8, z: d.z + Math.cos(aim) * 8 };
  const me = () => ({ x: p.pos.x, z: p.pos.z });
  const later = (sec, fn) => (sec <= 0.01 ? fn() : setTimeout(() => { if (p.alive !== false) fn(); }, sec * 1000));
  const vfx = (type, o) => game.bossVfx?.play(type, o);
  p.yaw = aim;
  game.toastOnce(`ものまね：${C.name}の「${pat.name}」`, 1400);
  game.sound.se('windup');

  // ---- 当たり判定（自分だけ） ----
  const hitWhere = (test, mult, fx, fz) => {
    if (!local) return;
    forEachTarget(game, (e) => {
      if (test(e.pos.x, e.pos.z, e.radius)) strike(game, p, e, mult, { color, gauge: GAUGE.gainSkill, knock: 1.2 });
    });
  };
  const circle = (x, z, r, mult) => hitWhere((ex, ez, er) => Math.hypot(ex - x, ez - z) < r + er, mult);
  const sector = (x, z, yaw, r, arc, mult) => hitWhere((ex, ez, er) => {
    const dd = Math.hypot(ex - x, ez - z);
    return dd < r + er && (dd < er + 1 || Math.abs(angleDiff(yaw, yawTo(x, z, ex, ez))) < arc / 2 + 0.15);
  }, mult);
  const rect = (x, z, yaw, len, w, mult) => hitWhere((ex, ez, er) => {
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    const along = (ex - x) * s + (ez - z) * c;
    const side = (ex - x) * c - (ez - z) * s;
    return along > -er && along < len + er && Math.abs(side) < w / 2 + er;
  }, mult);
  const shots = (x, z, yaw, n, spread, speed, ring = false) => {
    for (let i = 0; i < n; i++) {
      const a = ring ? yaw + (i / n) * Math.PI * 2 : yaw + (i - (n - 1) / 2) * spread;
      game.projectiles.playerShot(p, x, z, a, { speed: Math.max(16, speed * 1.5), mult: MULT.shot, color, size: 0.32, range: 26, local });
    }
    game.sound.se('shoot');
  };
  const boom = (x, z, r, fx) => {
    vfx('impact', { x, z, r, color });
    if (fx) vfx(fx, { x, z, r, color });
    game.fx.burst(x, 0.5, z, color, 16, { speed: 6, up: 6, life: 0.6 });
    game.sound.se('slam');
  };

  if (pat.kind === 'seq') {
    for (const s of pat.steps) later(s.at * SPEED, () => step(s));
  } else legacy(pat.kind || d.cm, pat);

  /** 台本の1手を自分の攻撃に読み替える */
  function step(s) {
    const k = s.k ?? 1;
    const at = me();
    const yaw = aim + (s.a || 0);
    switch (s.do) {
      case 'hit': {
        // 置き場所：ボスの位置に出る技（標的の足元・各自の足元）はボスへ、それ以外は自分から
        const spots = [];
        if (s.o === 'tgt' || s.o === 'each' || s.o === 'rand') spots.push({ x: tgt.x, z: tgt.z, yaw });
        else if (s.o === 'fan') for (let i = 0; i < (s.n || 3); i++) spots.push({ ...at, yaw: yaw + (i - ((s.n || 3) - 1) / 2) * (s.spread || 0.5) });
        else if (s.o === 'grid') spots.push({ x: tgt.x - Math.sin(yaw) * 8, z: tgt.z - Math.cos(yaw) * 8, yaw });
        else spots.push({ x: at.x + Math.sin(yaw) * (s.dist || 0), z: at.z + Math.cos(yaw) * (s.dist || 0), yaw });
        for (const sp of spots) {
          const m = MULT.hit * k;
          if (s.shape === 'sector') sector(sp.x, sp.z, sp.yaw, s.r, s.arc, m);
          else if (s.shape === 'rect') rect(sp.x, sp.z, sp.yaw, s.len, s.w, MULT.line * k);
          else if (s.shape === 'donut') circle(sp.x, sp.z, s.rOut * 0.7, m);
          else circle(sp.x, sp.z, s.r, m);
          if (s.fx) {
            const fd = s.fxDist || 0;
            vfx(s.fx, { x: sp.x + Math.sin(sp.yaw) * fd, z: sp.z + Math.cos(sp.yaw) * fd, yaw: sp.yaw, r: s.r, arc: s.arc, len: s.len, w: s.w, color, dur: s.fxDur, dir: s.a ? Math.sign(s.a) : 1, ...s.fxd });
          }
          if (s.shape === 'circle' || s.shape === 'donut') vfx('impact', { x: sp.x, z: sp.z, r: s.r ?? s.rOut * 0.7, color });
        }
        game.fx.shake(0.3);
        game.sound.se(s.se || 'swing');
        break;
      }
      case 'zones': {
        const n = s.o === 'rand' ? Math.min(5, s.n || 3) : s.o === 'fan' ? s.n || 3 : 1;
        for (let i = 0; i < n; i++) {
          const ox = i ? (Math.random() - 0.5) * 6 : 0;
          const oz = i ? (Math.random() - 0.5) * 6 : 0;
          const x = tgt.x + ox;
          const z = tgt.z + oz;
          if (s.fx === 'meteor') vfx('meteor', { x, z, r: s.r, color, fall: 0.45 });
          later((s.fx === 'meteor' ? 0.45 : 0) + i * 0.1, () => {
            circle(x, z, s.r, MULT.zone * k);
            boom(x, z, s.r, s.fx === 'pillar' ? 'pillar' : null);
          });
        }
        break;
      }
      case 'shots': {
        const volleys = s.pat === 'spiral' ? 6 : s.volleys ?? s.waves ?? 1;
        for (let i = 0; i < volleys; i++) later(i * (s.gap ?? s.interval ?? 0.3) * SPEED, () => {
          const o = me();
          const y = yawTo(o.x, o.z, tgt.x, tgt.z) + (s.a || 0);
          if (s.pat === 'ring' || s.pat === 'spiral') shots(o.x, o.z, y + i * 0.2, Math.min(16, s.n || s.arms * 4 || 12), 0, s.speed, true);
          else shots(o.x, o.z, y, Math.min(9, s.n || 5), s.spread || 0.2, s.speed);
        });
        break;
      }
      case 'nova':
        for (let i = 0; i < (s.waves || 1); i++) later(i * (s.gap ?? 0.45) * SPEED, () => {
          const o = me();
          const r = Math.min(9, (s.max || 12) * 0.5);
          circle(o.x, o.z, r, MULT.wave * k);
          boom(o.x, o.z, r);
        });
        break;
      case 'mover': {
        const len = Math.min(22, s.len ?? 18);
        const y = yaw;
        const path = { x0: at.x, z0: at.z, x1: at.x + Math.sin(y) * len, z1: at.z + Math.cos(y) * len, speed: s.speed * 1.4, back: !!s.back };
        vfx(s.fx || 'twister', { ...path, r: s.r, color, life: (path.back ? 2 : 1) * len / path.speed, yaw: y });
        rect(at.x, at.z, y, len, s.r * 2 + 1, MULT.line * k);
        break;
      }
      case 'rot':
        vfx('rot', { x: at.x, z: at.z, a0: yaw, speed: s.speed * 1.5, arms: s.arms, arc: s.arc, len: Math.min(14, s.len), dur: Math.min(1.6, s.dur), color, colors: s.colors });
        circle(at.x, at.z, Math.min(14, s.len) * 0.8, MULT.spin * k);
        break;
      case 'move':
        // 跳躍・急降下・地中からの奇襲：ボスの足元に一撃。突進：ボスまでの直線を薙ぐ
        if (s.r) {
          vfx('pillar', { x: tgt.x, z: tgt.z, r: s.r * 0.8, color });
          circle(tgt.x, tgt.z, s.r, MULT.hit * k * 1.2);
          boom(tgt.x, tgt.z, s.r);
        } else if (s.m === 'dash') {
          const len = Math.min(16, Math.hypot(tgt.x - at.x, tgt.z - at.z) + 2);
          vfx('line', { x: at.x, z: at.z, yaw, len, w: s.w || 3, color, tall: 2 });
          rect(at.x, at.z, yaw, len, s.w || 3, MULT.line * k);
        }
        break;
      case 'vfx':
        if (s.type !== 'eye' && s.type !== 'beat') vfx(s.type, { x: at.x, z: at.z, y: 3, yaw, color, ...s.d });
        break;
      case 'heal':
        if (local) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.05);
        break;
      default: break; // 引き寄せ・壁・安全地帯などは真似しない
    }
  }

  /** 台本でない（昔からの）ボスの技 */
  function legacy(kind, q) {
    const at = me();
    switch (kind) {
      case 'sweep':
        sector(at.x, at.z, aim, q.range + 1, q.arc, MULT.hit);
        vfx('arc', { x: at.x, z: at.z, yaw: aim, r: q.range + 1, arc: q.arc, color });
        break;
      case 'slam': case 'stalker': case 'rain': case 'erupt':
        vfx('pillar', { x: tgt.x, z: tgt.z, r: 3, color });
        circle(tgt.x, tgt.z, Math.max(3.5, q.radius || 3), MULT.hit * 1.2);
        boom(tgt.x, tgt.z, Math.max(3.5, q.radius || 3));
        break;
      case 'ring': case 'spiral':
        for (let i = 0; i < 3; i++) later(i * 0.25, () => shots(p.pos.x, p.pos.z, aim + i * 0.2, 14, 0, q.speed || 9, true));
        break;
      case 'fan':
        for (let i = 0; i < 3; i++) later(i * 0.25, () => shots(p.pos.x, p.pos.z, yawTo(p.pos.x, p.pos.z, tgt.x, tgt.z), Math.min(9, q.count || 5), q.spread || 0.25, q.speed || 12));
        break;
      case 'beam': case 'charge': case 'wall': {
        const len = q.len || 18;
        vfx('line', { x: at.x, z: at.z, yaw: aim, len, w: q.width || 3, color, tall: 3 });
        rect(at.x, at.z, aim, len, q.width || 3, MULT.line * 1.2);
        break;
      }
      default: { // nova・donut・whirl・pull・teleport：自分の周り
        const r = 6;
        circle(at.x, at.z, r, MULT.wave * 1.3);
        boom(at.x, at.z, r, 'pillar');
      }
    }
    game.sound.se('swing');
  }
}
