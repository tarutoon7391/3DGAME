// 職業のスキル（通常攻撃の飛び道具・Q・E）と、スキルが残す効果（隕石・矢の雨・結界など）
// 使った本人のブラウザでは当たり判定込みで実行し（local = true）、他の人のブラウザでは見た目だけ再生する（local = false）
// 味方への回復・強化は game.teamEffect（全員に配って各自が自分に適用）、ボスへの挑発・召喚は game.bossCommand（ホストが処理）
import * as THREE from 'three';
import { JOBS, JOB_ORDER, GAUGE } from './data/jobs.js';
import { radiusHit, strike, forEachTarget, meleeArc } from './combat.js';
import { angleDiff, yawTo } from './util.js';

const fwd = (yaw, d) => [Math.sin(yaw) * d, Math.cos(yaw) * d];

/**
 * 支援係数（職業データの support）を味方への効果に掛ける
 * 回復量・継続回復・バリア・必殺ゲージ配りは量に、攻撃力アップ・被ダメ軽減は「1 からの差」に掛ける
 */
export function scaleVals(v, s = 1) {
  if (!v || s === 1) return v;
  const o = { ...v };
  const up = (x) => 1 + (x - 1) * s; // 1.3 → 1 + 0.3s
  const down = (x) => 1 - (1 - x) * s; // 0.7 → 1 - 0.3s
  if (o.atkMul) o.atkMul = up(o.atkMul);
  if (o.mul) o.mul = o.mul > 1 ? up(o.mul) : down(o.mul);
  if (o.dmgMul && o.dmgMul < 1) o.dmgMul = down(o.dmgMul);
  if (o.regen) o.regen *= s;
  if (o.shield) o.shield *= s;
  if (o.critAdd) o.critAdd *= s;
  return o;
}
export function scaleSupport(eff, s = 1) {
  if (!eff || s === 1) return eff;
  const e = { ...eff };
  if ((e.kind === 'heal' || e.kind === 'gauge') && e.amount !== undefined) e.amount *= s;
  if (e.vals) e.vals = scaleVals(e.vals, s);
  return e;
}

/** スキル本体。run(game, p, d, local)。d はデータ（位置・向きなど。ネットで送れる形） */
const SKILLS = {
  // ---- 剣士 ----
  spin(game, p, d, local) {
    const q = JOBS.swordsman.q;
    startAction(p, 'spin', 0.5);
    game.sound.se('spin');
    p.skillTick = () => {
      if (p.didSkill || p.actT < 0.15) return;
      p.didSkill = true;
      if (local) radiusHit(game, p, q.mult, q.radius, { melee: true, gauge: GAUGE.gainSkill });
      game.fx.burst(p.pos.x, 1, p.pos.z, 0x80d8ff, 30, { speed: 9, up: 1.5, life: 0.45, size: 0.14, grav: 2 });
      game.fx.shake(0.25);
    };
  },
  blade(game, p, d, local) {
    const e = JOBS.swordsman.r;
    p.waveT = 0.4;
    game.projectiles.playerWave(p, d.yaw, { mult: e.mult, range: e.range, radius: e.radius, scale: 1.8, color: 0xffe082, local, melee: true });
    game.sound.se('wave');
    game.fx.shake(0.3);
  },
  // ---- 重騎士 ----
  taunt(game, p, d, local) {
    const q = JOBS.knight.q;
    startAction(p, 'cast', 0.45);
    game.sound.se('roar');
    game.fx.burst(p.pos.x, 2, p.pos.z, 0xff7043, 30, { speed: 7, up: 3, life: 0.6 });
    if (local) {
      p.buff('taunt', q.dur);
      game.bossCommand({ type: 'taunt', id: p.id, dur: q.dur });
      game.toastOnce('ボスの狙いを引きつけた！（被ダメージ半減）', 1600);
    }
  },
  aegis(game, p, d) {
    const e = JOBS.knight.r;
    game.sound.se('seal');
    addZone(game, { kind: 'aegis', x: d.x, z: d.z, r: e.radius, t: e.dur, owner: p.id });
  },
  // ---- 魔法使い ----
  fireball(game, p, d, local) {
    const q = JOBS.mage.q;
    startAction(p, 'cast', 0.3);
    p.waveT = 0.3;
    const mult = q.mult * (d.still ? JOBS.mage.stillBonus : 1);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: q.speed, mult, color: 0xff7043, size: 0.55, range: 24, explode: q.radius, local });
    game.sound.se('shoot');
  },
  meteor(game, p, d, local) {
    const e = JOBS.mage.r;
    startAction(p, 'cast', 0.5);
    game.sound.se('windup');
    addZone(game, { kind: 'meteor', x: d.tx, z: d.tz, r: e.radius, t: e.delay, delay: e.delay, owner: p.id, local, mult: e.mult, p });
  },
  // ---- 僧侶 ----
  heal(game, p, d, local) {
    const q = JOBS.priest.q;
    startAction(p, 'cast', 0.4);
    game.sound.se('seal');
    ringFx(game, d.x, d.z, q.radius, 0xfff59d);
    if (local) game.teamEffect({ kind: 'heal', x: d.x, z: d.z, r: q.radius, amount: q.amount });
  },
  prayer(game, p, d, local) {
    const e = JOBS.priest.r;
    startAction(p, 'cast', 0.6);
    game.sound.se('seal');
    game.fx.burst(p.pos.x, 3, p.pos.z, 0xfff59d, 60, { speed: 8, up: 8, life: 1.2 });
    if (local) game.teamEffect({ kind: 'prayer', invuln: e.invuln });
  },
  // ---- 弓使い ----
  spread(game, p, d, local) {
    const q = JOBS.archer.q;
    p.waveT = 0.25;
    startAction(p, 'cast', 0.2);
    for (let i = 0; i < q.count; i++) {
      const a = d.yaw + (i - (q.count - 1) / 2) * q.spread;
      game.projectiles.playerShot(p, d.x, d.z, a, { ...JOBS.archer.basic, mult: q.mult, local, gauge: GAUGE.gainSkill });
    }
    game.sound.se('shoot');
  },
  arrowrain(game, p, d, local) {
    const e = JOBS.archer.r;
    startAction(p, 'cast', 0.4);
    game.sound.se('shoot');
    addZone(game, { kind: 'arrowrain', x: d.tx, z: d.tz, r: e.radius, t: e.dur, every: e.every, tick: 0, mult: e.mult, owner: p.id, local, p });
  },
  // ---- 忍者 ----
  shadowstep(game, p, d, local) {
    dashStrike(game, p, d, local, JOBS.ninja.q, 0xb39ddb);
  },
  clone(game, p, d, local) {
    const e = JOBS.ninja.r;
    game.sound.se('seal');
    game.fx.burst(p.pos.x, 1.2, p.pos.z, 0x7e57c2, 40, { speed: 5, up: 3, life: 0.7 });
    if (local) {
      p.buff('clone', e.dur, { cloneMult: e.cloneMult, speedMul: e.speedMul });
      game.toastOnce('影分身！ 攻撃のたびに分身が追い打ち', 1600);
    }
  },
  // ---- 吟遊詩人 ----
  courage(game, p, d, local) {
    const q = JOBS.bard.q;
    startAction(p, 'cast', 0.4);
    game.sound.se('seal');
    ringFx(game, d.x, d.z, q.radius, 0xf48fb1);
    if (local) game.teamEffect({ kind: 'buff', name: 'courage', dur: q.dur, vals: { mul: q.atkMul }, x: d.x, z: d.z, r: q.radius, msg: '勇気の歌：攻撃力アップ！' });
  },
  gale(game, p, d, local) {
    const e = JOBS.bard.r;
    startAction(p, 'cast', 0.5);
    game.sound.se('seal');
    game.fx.burst(p.pos.x, 2, p.pos.z, 0xf48fb1, 50, { speed: 8, up: 4, life: 1 });
    if (local) game.teamEffect({ kind: 'buff', name: 'gale', dur: e.dur, vals: { speedMul: e.speedMul, regen: e.regen }, msg: '疾風の旋律：スタミナ無限・足が速くなる！' });
  },
  // ---- 召喚士 ----
  spirit(game, p, d, local) {
    startAction(p, 'cast', 0.35);
    game.sound.se('seal');
    game.fx.burst(d.x, 1, d.z, 0x80cbc4, 20, { speed: 4, up: 4, life: 0.6 });
    if (local) game.bossCommand({ type: 'summon', kind: 'spirit', x: d.x, z: d.z, owner: p.id });
  },
  golem(game, p, d, local) {
    startAction(p, 'cast', 0.6);
    game.sound.se('slam');
    game.fx.burst(d.x, 1, d.z, 0xa1887f, 40, { speed: 6, up: 5, life: 0.8 });
    if (local) game.bossCommand({ type: 'summon', kind: 'golem', x: d.x, z: d.z, owner: p.id });
  },

  // ---- 槍兵 ----
  lunge(game, p, d, local) {
    dashStrike(game, p, d, local, JOBS.lancer.q, 0xffab91);
  },
  skyfall(game, p, d, local) {
    const e = JOBS.lancer.r;
    startAction(p, 'dash', e.time);
    const dx = d.tx - p.pos.x;
    const dz = d.tz - p.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    p.dodgeX = dx / len;
    p.dodgeZ = dz / len;
    p.yaw = d.yaw;
    p.dashSpeed = len / e.time;
    if (local) p.invuln = Math.max(p.invuln, e.time + 0.2);
    game.sound.se('dodge');
    p.skillTick = () => {
      p.model.root.position.y = Math.sin(Math.min(1, p.actT / e.time) * Math.PI) * 4;
      if (p.didSkill || p.actT < e.time * 0.9) return;
      p.didSkill = true;
      p.model.root.position.y = 0;
      game.fx.burst(p.pos.x, 0.5, p.pos.z, 0xffab91, 50, { speed: 10, up: 6, life: 0.7, size: 0.25 });
      game.fx.shake(0.9);
      game.sound.se('slam');
      if (local) radiusHit(game, p, e.mult, e.radius, { melee: true, gauge: 0, knock: 2, color: 0xffab91 });
    };
  },
  // ---- 格闘家 ----
  kiblast(game, p, d, local) {
    const q = JOBS.monk.q;
    startAction(p, 'cast', 0.3);
    game.sound.se('wave');
    for (let i = 0; i < 18; i++) {
      const a = d.yaw + (Math.random() - 0.5) * q.arc;
      const r = Math.random() * q.range;
      game.fx.burst(p.pos.x + Math.sin(a) * r, 1, p.pos.z + Math.cos(a) * r, 0xffcc80, 2, { speed: 3, up: 1, life: 0.35, grav: 0 });
    }
    if (local) meleeArc(game, p, d.yaw, q.mult, q.range, q.arc, { knock: 2.5, gauge: GAUGE.gainSkill });
  },
  barrage(game, p, d, local) {
    const e = JOBS.monk.r;
    startAction(p, 'cast', e.dur + 0.3);
    p.yaw = d.yaw;
    let tick = 0;
    let finished = false;
    game.sound.se('roar');
    p.skillTick = (dt) => {
      tick -= dt;
      if (p.actT < e.dur && tick <= 0) {
        tick = e.every;
        const a = p.yaw + (Math.random() - 0.5) * 0.8;
        game.fx.burst(p.pos.x + Math.sin(a) * 1.6, 1.2, p.pos.z + Math.cos(a) * 1.6, 0xffcc80, 3, { speed: 3, up: 1, life: 0.2, grav: 0 });
        if (local) meleeArc(game, p, p.yaw, e.mult, e.range, 2, { gauge: 0 });
      } else if (p.actT >= e.dur && !finished) {
        finished = true;
        game.fx.shake(0.6);
        if (local) meleeArc(game, p, p.yaw, e.finish, e.range + 0.5, 2, { gauge: 0, knock: 3, crit: true });
      }
    };
  },
  // ---- 錬金術師 ----
  corrode(game, p, d, local) {
    const q = JOBS.alchemist.q;
    startAction(p, 'cast', 0.3);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: q.speed, mult: 0.8, color: 0x76ff03, size: 0.4, range: 22, local, gauge: GAUGE.gainSkill,
      onHit: (t) => { if (t && game.bosses.includes(t)) game.bossCommand({ type: 'debuff', name: 'vuln', dur: q.dur, mul: q.mul, sub: t.sub }); } });
    game.sound.se('shoot');
  },
  bigflask(game, p, d, local) {
    const e = JOBS.alchemist.r;
    startAction(p, 'cast', 0.4);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: e.speed, mult: e.mult, color: 0x76ff03, size: 0.8, range: 22, explode: e.radius, local,
      onHit: (t, s) => {
        for (const b of game.bosses) {
          if (b.active && b.alive && Math.hypot(b.pos.x - s.x, b.pos.z - s.z) <= e.radius + b.radius) game.bossCommand({ type: 'debuff', name: 'vuln', dur: e.dur, mul: e.mul, sub: b.sub });
        }
      } });
    game.sound.se('shoot');
  },
  // ---- 狂戦士 ----
  warcry(game, p, d, local) {
    const q = JOBS.berserker.q;
    startAction(p, 'cast', 0.45);
    game.sound.se('roar');
    game.fx.burst(p.pos.x, 1.6, p.pos.z, 0xff1744, 40, { speed: 6, up: 4, life: 0.7 });
    if (local) {
      p.buff('warcry', q.dur, { atkMul: q.atkMul, dmgMul: q.dmgMul });
      game.toastOnce('怒号！ 攻撃力アップ（被ダメージも増える）', 1600);
    }
  },
  bloodstorm(game, p, d, local) {
    const e = JOBS.berserker.r;
    startAction(p, 'spin', e.hits * e.every + 0.15);
    let tick = 0;
    let n = 0;
    game.sound.se('spin');
    p.skillTick = (dt) => {
      tick -= dt;
      if (n < e.hits && tick <= 0) {
        tick = e.every;
        n++;
        game.fx.burst(p.pos.x, 1, p.pos.z, 0xb71c1c, 25, { speed: 8, up: 1.5, life: 0.4, size: 0.16, grav: 2 });
        if (local) radiusHit(game, p, e.mult, e.radius, { melee: true, gauge: 0, lifesteal: e.lifesteal, color: 0xb71c1c });
      }
    };
  },
  // ---- 時魔導士 ----
  slowfield(game, p, d, local) {
    const q = JOBS.chrono.q;
    startAction(p, 'cast', 0.4);
    game.sound.se('gate');
    for (const b of game.bosses) if (b.alive) ringFx(game, b.pos.x, b.pos.z, b.radius + 2, 0xb388ff);
    if (local) game.bossCommand({ type: 'debuff', name: 'slow', dur: q.dur, mul: q.mul });
  },
  timestop(game, p, d, local) {
    const e = JOBS.chrono.r;
    startAction(p, 'cast', 0.5);
    game.sound.se('gate');
    game.fx.burst(p.pos.x, 2, p.pos.z, 0xb388ff, 50, { speed: 8, up: 4, life: 0.9 });
    if (local) game.bossCommand({ type: 'freeze', dur: e.dur, immune: e.immune });
  },
  // ---- 砲術士 ----
  buckshot(game, p, d, local) {
    const q = JOBS.gunner.q;
    startAction(p, 'cast', 0.25);
    p.waveT = 0.25;
    for (let i = 0; i < q.count; i++) {
      const a = d.yaw + (i - (q.count - 1) / 2) * q.spread + (Math.random() - 0.5) * 0.04;
      game.projectiles.playerShot(p, d.x, d.z, a, { speed: q.speed, mult: q.mult, color: 0xffd180, size: 0.16, range: q.range, local, gauge: GAUGE.gainSkill });
    }
    game.fx.shake(0.2);
    game.sound.se('slam');
  },
  cannon(game, p, d, local) {
    const e = JOBS.gunner.r;
    startAction(p, 'cast', 0.45);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: e.speed, mult: e.mult, color: 0xff6f00, size: 0.9, range: 34, explode: e.radius, local });
    game.fx.shake(0.5);
    game.sound.se('slam');
  },
  // ---- 呪術師 ----
  hex(game, p, d, local) {
    const q = JOBS.warlock.q;
    startAction(p, 'cast', 0.3);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: q.speed, mult: 0.5, color: 0x7b1fa2, size: 0.45, range: 24, local, gauge: GAUGE.gainSkill, dot: q.dot });
    game.sound.se('shoot');
  },
  drain(game, p, d, local) {
    const e = JOBS.warlock.r;
    startAction(p, 'cast', e.dur);
    p.yaw = d.yaw;
    let tick = 0;
    game.sound.se('seal');
    p.skillTick = (dt) => {
      tick -= dt;
      if (tick > 0) return;
      tick = e.every;
      const t = frontTarget(game, p, e.range, 0.7);
      if (!t) return;
      // 命を吸う線
      for (let k = 0.15; k < 1; k += 0.17) game.fx.burst(t.pos.x + (p.pos.x - t.pos.x) * k, 1.4, t.pos.z + (p.pos.z - t.pos.z) * k, 0xce93d8, 1, { speed: 0.5, up: 0.3, life: 0.3, grav: 0 });
      if (local) {
        strike(game, p, t, e.mult, { gauge: 0, knock: 0, color: 0xce93d8 });
        game.teamEffect({ kind: 'heal', x: +p.pos.x.toFixed(1), z: +p.pos.z.toFixed(1), r: e.healRadius, amount: e.heal, quiet: true });
      }
    };
  },
  // ---- 処刑人 ----
  soulreap(game, p, d, local) {
    const q = JOBS.reaper.q;
    startAction(p, 'spin', 0.45);
    game.sound.se('spin');
    game.fx.burst(p.pos.x, 1, p.pos.z, 0xb0bec5, 30, { speed: 9, up: 1, life: 0.4, size: 0.14, grav: 2 });
    if (local) meleeArc(game, p, d.yaw, q.mult, q.range, q.arc, { gauge: q.gauge });
  },
  verdict(game, p, d, local) {
    const e = JOBS.reaper.r;
    startAction(p, 'cast', 0.5);
    game.sound.se('roar');
    const t = frontTarget(game, p, e.range, 0.9);
    if (!t) {
      if (local) game.toastOnce('前に敵がいない！', 1000);
      return;
    }
    game.fx.burst(t.pos.x, (t.hpY || 2) * 0.6, t.pos.z, 0x000000, 50, { speed: 7, up: 6, life: 0.8, size: 0.3 });
    game.fx.shake(0.9);
    if (local) {
      const missing = t.maxHp ? 1 - t.hp / t.maxHp : 0;
      strike(game, p, t, e.mult + e.missingMult * missing, { melee: true, gauge: 0, crit: true, knock: 2, color: 0xb0bec5 });
    }
  },

  // ================= E スキル（クールダウン制。職業ごとに Q とも R とも違う技） =================
  galethrust(game, p, d, local) {
    dashStrike(game, p, d, local, JOBS.swordsman.e, 0xcfd8dc);
  },
  bash(game, p, d, local) {
    const e = JOBS.knight.e;
    dashStrike(game, p, d, local, e, 0x90a4ae, { brkMul: e.brkMul, knock: 2 });
  },
  icelance(game, p, d, local) {
    const e = JOBS.mage.e;
    startAction(p, 'cast', 0.25);
    p.waveT = 0.25;
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: e.speed, mult: e.mult * (d.still ? JOBS.mage.stillBonus : 1), color: 0x80deea, size: 0.3, range: e.range, pierce: true, local, gauge: GAUGE.gainSkill });
    game.sound.se('wave');
  },
  sanctuary(game, p, d, local) {
    const e = JOBS.priest.e;
    startAction(p, 'cast', 0.4);
    game.sound.se('seal');
    ringFx(game, d.x, d.z, e.radius, 0x90caf9);
    if (local) game.teamEffect({ kind: 'buff', name: 'sanctuary', dur: e.dur, vals: { mul: e.mul }, x: d.x, z: d.z, r: e.radius, msg: '聖なる守り：被ダメージ減少！' });
  },
  backshot(game, p, d, local) {
    const e = JOBS.archer.e;
    startAction(p, 'dash', e.time);
    p.dodgeX = -Math.sin(d.yaw);
    p.dodgeZ = -Math.cos(d.yaw);
    p.yaw = d.yaw;
    p.dashSpeed = e.dist / e.time;
    if (local) p.invuln = Math.max(p.invuln, e.time + 0.1);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { ...JOBS.archer.basic, mult: e.mult, size: 0.3, local, gauge: GAUGE.gainSkill });
    game.sound.se('dodge');
  },
  shuriken(game, p, d, local) {
    const e = JOBS.ninja.e;
    startAction(p, 'cast', 0.2);
    for (let i = 0; i < e.count; i++) {
      const a = d.yaw + (i - (e.count - 1) / 2) * e.spread;
      game.projectiles.playerShot(p, d.x, d.z, a, { speed: e.speed, mult: e.mult, color: 0xb0bec5, size: 0.25, range: 20, pierce: true, local, gauge: GAUGE.gainSkill });
    }
    game.sound.se('shoot');
  },
  dissonance(game, p, d, local) {
    const e = JOBS.bard.e;
    startAction(p, 'cast', 0.3);
    game.sound.se('wave');
    for (let i = 0; i < 16; i++) {
      const a = d.yaw + (Math.random() - 0.5) * e.arc;
      const r = Math.random() * e.range;
      game.fx.burst(p.pos.x + Math.sin(a) * r, 1.2, p.pos.z + Math.cos(a) * r, 0xf48fb1, 2, { speed: 2, up: 1, life: 0.35, grav: 0 });
    }
    if (local) meleeArc(game, p, d.yaw, e.mult, e.range, e.arc, { gauge: GAUGE.gainSkill, brkMul: e.brkMul, knock: 1.5 });
  },
  detonate(game, p, d, local) {
    const e = JOBS.summoner.e;
    startAction(p, 'cast', 0.3);
    game.sound.se('slam');
    if (local) {
      if (game.allies && !game.allies.count(p.id, 'spirit')) game.toastOnce('爆発させる精霊がいない（Q で精霊を出してから）', 1400);
      game.bossCommand({ type: 'detonate', owner: p.id, mult: e.mult, radius: e.radius });
    }
  },
  whirlspear(game, p, d, local) {
    const e = JOBS.lancer.e;
    startAction(p, 'spin', 0.45);
    game.sound.se('spin');
    game.fx.burst(p.pos.x, 1, p.pos.z, 0xffab91, 26, { speed: 9, up: 1.2, life: 0.4, size: 0.14, grav: 2 });
    if (local) radiusHit(game, p, e.mult, e.radius, { melee: true, gauge: GAUGE.gainSkill, color: 0xffab91 });
  },
  uppercut(game, p, d, local) {
    const e = JOBS.monk.e;
    startAction(p, 'cast', e.time);
    if (local) p.invuln = Math.max(p.invuln, e.time + 0.1);
    game.sound.se('swing');
    p.skillTick = () => {
      p.model.root.position.y = Math.sin(Math.min(1, p.actT / e.time) * Math.PI) * 1.6;
      if (p.didSkill || p.actT < e.time * 0.3) return;
      p.didSkill = true;
      game.fx.burst(p.pos.x, 1.5, p.pos.z, 0xffcc80, 30, { speed: 4, up: 9, life: 0.6 });
      if (local) radiusHit(game, p, e.mult, e.radius, { melee: true, gauge: GAUGE.gainSkill, knock: 1.5, color: 0xffcc80 });
    };
  },
  triflask(game, p, d, local) {
    const e = JOBS.alchemist.e;
    startAction(p, 'cast', 0.3);
    for (let i = 0; i < e.count; i++) {
      const a = d.yaw + (i - (e.count - 1) / 2) * e.spread;
      game.projectiles.playerShot(p, d.x, d.z, a, { speed: e.speed, mult: e.mult, color: 0xaed581, size: 0.32, range: 16, explode: e.radius, local });
    }
    game.sound.se('shoot');
  },
  earthsplit(game, p, d, local) {
    const e = JOBS.berserker.e;
    startAction(p, 'cast', e.count * e.every + 0.2);
    let n = 0;
    let tick = 0;
    game.sound.se('slam');
    p.skillTick = (dt) => {
      tick -= dt;
      if (n >= e.count || tick > 0) return;
      tick = e.every;
      n++;
      const x = d.x + Math.sin(d.yaw) * (1 + n * e.step);
      const z = d.z + Math.cos(d.yaw) * (1 + n * e.step);
      game.fx.burst(x, 0.4, z, 0x8d6e63, 18, { speed: 5, up: 7, life: 0.5, size: 0.22 });
      game.fx.shake(0.2);
      if (local) radiusHit(game, p, e.mult, e.radius, { melee: true, gauge: GAUGE.gainSkill, color: 0x8d6e63 }, x, z);
    };
  },
  rewind(game, p, d, local) {
    const e = JOBS.chrono.e;
    startAction(p, 'cast', 0.35);
    game.sound.se('gate');
    game.fx.burst(p.pos.x, 1.4, p.pos.z, 0xb388ff, 30, { speed: 3, up: 3, life: 0.7 });
    if (!local) return;
    // 3秒前の HP（記録が無ければ今の HP）
    const past = p.hpAgo?.(e.back) ?? p.hp;
    if (past > p.hp) {
      game.toastOnce(`巻き戻し！ HP ${Math.round(p.hp)} → ${Math.round(past)}`, 1400);
      p.hp = Math.min(p.maxHp, past);
    } else game.toastOnce('巻き戻し：3秒前より HP は減っていない', 1400);
  },
  mine(game, p, d, local) {
    const e = JOBS.gunner.e;
    startAction(p, 'cast', 0.3);
    game.sound.se('windup');
    addZone(game, { kind: 'mine', x: d.x, z: d.z, r: e.radius, trigger: e.trigger, t: e.dur, mult: e.mult, owner: p.id, local, p });
  },
  cursespread(game, p, d, local) {
    const e = JOBS.warlock.e;
    startAction(p, 'cast', 0.35);
    game.sound.se('seal');
    if (!local) return;
    // 自分の呪いがかかっている敵に追加ダメージ＋呪いの延長
    const hit = new Set();
    for (const o of dots) {
      if (o.p !== p || !o.target.alive || hit.has(o.target)) continue;
      hit.add(o.target);
      o.left += e.extend;
      strike(game, p, o.target, e.mult, { gauge: GAUGE.gainSkill, color: 0x7b1fa2 });
      game.fx.burst(o.target.pos.x, (o.target.hpY || 2) * 0.6, o.target.pos.z, 0x7b1fa2, 30, { speed: 5, up: 4, life: 0.6 });
    }
    if (!hit.size) game.toastOnce('呪いのかかった敵がいない（通常攻撃や Q で呪ってから）', 1400);
  },
  scythethrow(game, p, d, local) {
    const e = JOBS.reaper.e;
    startAction(p, 'cast', 0.3);
    const o = { speed: e.speed, mult: e.mult, color: 0xb0bec5, size: 0.6, range: e.range, pierce: true, local, gauge: GAUGE.gainSkill };
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, o);
    // 先まで飛んだら投げた人の方へ戻ってくる
    const fx = d.x + Math.sin(d.yaw) * (e.range + 0.8);
    const fz = d.z + Math.cos(d.yaw) * (e.range + 0.8);
    p.pending.push({ t: e.range / e.speed, fn: () => {
      const back = Math.atan2(p.pos.x - fx, p.pos.z - fz);
      game.projectiles.playerShot(p, fx - Math.sin(back) * 0.8, fz - Math.cos(back) * 0.8, back, { ...o, range: Math.hypot(p.pos.x - fx, p.pos.z - fz) });
    } });
    game.sound.se('spin');
  },
};

function startAction(p, action, dur) {
  p.action = action;
  p.actT = 0;
  p.actDur = dur;
  p.didSkill = false;
  p.skillTick = null;
  p.actId = (p.actId || 0) + 1;
}

/** スキルを使うときのデータ（位置・向き・狙う場所） */
function skillData(game, p, intent, dist = 0) {
  const yaw = intent.aimYaw;
  const [ox, oz] = fwd(yaw, dist);
  const d = { x: p.pos.x, z: p.pos.z, yaw, tx: p.pos.x + ox, tz: p.pos.z + oz, still: p.still > 0.3 };
  // 一番近い戦闘中のボス（鎖で飛びつく・自動で狙う技用）
  let best = null;
  let bd = Infinity;
  for (const b of game.bosses) {
    if (!b.active || !b.alive) continue;
    const dd = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
    if (dd < bd) { bd = dd; best = b; }
  }
  if (best) Object.assign(d, { bx: +best.pos.x.toFixed(2), bz: +best.pos.z.toFixed(2), br: best.radius, byaw: +best.yaw.toFixed(3) });
  return d;
}

/** 職業データからスキル定義を探す（汎用の型で動かす技用） */
function findSkill(p, id) {
  const J = p.job;
  for (const k of ['q', 'e', 'r']) if (J[k]?.id === id) return J[k];
  return null;
}

/** 技を実行する。専用の処理（SKILLS）が無ければ、データの kind に応じた汎用処理（GENERIC） */
function run(game, p, id, d, local) {
  if (SKILLS[id]) return SKILLS[id](game, p, d, local);
  const sk = findSkill(p, id);
  if (sk && GENERIC[sk.kind]) GENERIC[sk.kind](game, p, d, local, sk);
}

function cast(game, p, id, d) {
  const sk = findSkill(p, id);
  // 暗黒騎士：HP を払って撃つ技（足りなければ撃てない）
  if (sk?.hpCost) {
    const cost = p.maxHp * sk.hpCost;
    if (p.hp <= cost + 1) {
      game.toastOnce('HP が足りない', 1000);
      return false;
    }
    p.hp -= cost;
    if (p.job.hpCostGauge) p.addGauge(sk.hpCost * 100 * p.job.hpCostGauge);
    game.fx.burst(p.pos.x, 1.2, p.pos.z, 0x880e4f, 14, { speed: 3, up: 3, life: 0.5 });
  }
  run(game, p, id, d, true);
  // 残響術士：汎用の型の技は、少し遅れて威力を下げてもう一度出る
  const echo = p.job.echo;
  if (echo && sk?.kind && GENERIC[sk.kind]) {
    const weak = { ...sk, mult: (sk.mult || 0) * echo.mult, amount: (sk.amount || 0) * echo.mult };
    p.pending.push({ t: echo.delay, fn: () => {
      if (!p.alive) return;
      game.fx.burst(p.pos.x, 2, p.pos.z, 0xb39ddb, 16, { speed: 3, up: 3, life: 0.5 });
      GENERIC[sk.kind](game, p, { ...d, x: p.pos.x, z: p.pos.z }, true, weak);
      game.raid?.sendSkill(p, id, d);
    } });
  }
  // 魔剣士：スキルを使うたびに必殺ゲージ
  if (p.job.gaugeOnSkill && sk && sk !== p.job.r) p.addGauge(p.job.gaugeOnSkill);
  game.raid?.sendSkill(p, id, d);
  return true;
}

/** Q スキル */
export function castQ(game, p, intent) {
  const q = p.job.q;
  // 精霊は最大 q.max 体。超えたら古いものから消える（ホストの handleCommand）
  return cast(game, p, q.id, skillData(game, p, intent, 2));
}

/** E スキル（クールダウン制） */
export function castE(game, p, intent) {
  const e = p.job.e;
  return cast(game, p, e.id, skillData(game, p, intent, e.dist || 2));
}

/** R 必殺技（必殺ゲージ） */
export function castR(game, p, intent) {
  const r = p.job.r;
  return cast(game, p, r.id, skillData(game, p, intent, r.dist || 3));
}

/** 他の人のスキルを見た目だけ再生する */
export function playRemoteSkill(game, p, id, d) {
  run(game, p, id, d, false);
}

/**
 * 汎用の技の型（データの kind で選ぶ）。新しい職業はほとんどこれの組み合わせで作っている
 *   dash 前方へ突進して通り道を斬る（toBoss でボスへ飛びつく） / burst 自分の周りに範囲攻撃（ticks で連続）
 *   cone 前方の扇に攻撃 / shots 飛び道具（count・spread・explode・pierce・dot・debuff・chain）
 *   leap 跳んで着地点に範囲攻撃 / zone 地面に置く効果（field 継続ダメージ・strike 時間差の一撃・totem 味方強化・trap 罠）
 *   teambuff 味方を強化（vals.shield ならバリア） / selfbuff 自分を強化 / teamheal 範囲回復 / teamgauge 必殺ゲージを配る
 *   debuff ボスを弱体化 / counter 見切りの構え / random 候補からランダムに1つ（道化師）
 */
const GENERIC = {
  dash(game, p, d, local, sk) {
    let dd = d;
    if (sk.toBoss && d.bx !== undefined) {
      // 鎖でボスへ飛びつく：ボスの手前まで
      const dist = Math.max(1.5, Math.hypot(d.bx - d.x, d.bz - d.z) - (d.br || 1.5) - 0.8);
      dd = { ...d, yaw: Math.atan2(d.bx - d.x, d.bz - d.z) };
      sk = { ...sk, dist: Math.min(sk.dist, dist) };
      for (let k = 0; k < 1; k += 0.1) game.fx.burst(d.x + (d.bx - d.x) * k, 1.2, d.z + (d.bz - d.z) * k, 0x9e9e9e, 1, { speed: 0.5, up: 0.5, life: 0.3, grav: 0 });
    }
    dashStrike(game, p, dd, local, sk, sk.color ?? 0xffffff, { brkMul: sk.brkMul, knock: sk.knock });
  },
  burst(game, p, d, local, sk) {
    const ticks = sk.ticks || 1;
    startAction(p, sk.anim || 'spin', ticks > 1 ? ticks * sk.every + 0.15 : 0.45);
    let n = 0;
    let tick = 0;
    game.sound.se('spin');
    p.skillTick = (dt) => {
      tick -= dt;
      if (n >= ticks || tick > 0) return;
      tick = sk.every || 0.2;
      n++;
      game.fx.burst(p.pos.x, 1, p.pos.z, sk.color, 24, { speed: 8, up: 1.5, life: 0.4, size: 0.15, grav: 2 });
      if (local) radiusHit(game, p, sk.mult, sk.radius, { melee: sk.melee !== false, gauge: GAUGE.gainSkill, color: sk.color, brkMul: sk.brkMul, knock: sk.knock ?? 1.2 });
      // 爆弾魔の自爆：撃ち終わったら自分の HP が残りわずかになる
      if (local && sk.selfHpTo && n >= ticks) {
        p.hp = Math.min(p.hp, sk.selfHpTo);
        game.fx.burst(p.pos.x, 1, p.pos.z, 0x212121, 30, { speed: 5, up: 5, life: 0.8 });
      }
    };
    if (!local) game.fx.burst(p.pos.x, 1, p.pos.z, sk.color, 24, { speed: 8, up: 1.5, life: 0.4, size: 0.15, grav: 2 });
  },
  cone(game, p, d, local, sk) {
    startAction(p, 'cast', 0.3);
    game.sound.se(sk.sound || 'swing');
    for (let i = 0; i < 16; i++) {
      const a = d.yaw + (Math.random() - 0.5) * sk.arc;
      const r = Math.random() * sk.range;
      game.fx.burst(p.pos.x + Math.sin(a) * r, 1.1, p.pos.z + Math.cos(a) * r, sk.color, 2, { speed: 2.5, up: 1, life: 0.35, grav: 0 });
    }
    if (local) {
      meleeArc(game, p, d.yaw, sk.mult, sk.range, sk.arc, { melee: sk.melee !== false, gauge: sk.gaugeSelf ?? GAUGE.gainSkill, brkMul: sk.brkMul, knock: sk.knock ?? 1.2, color: sk.color, crit: sk.crit, lifesteal: sk.lifesteal });
      if (sk.dot) forEachTarget(game, (e) => {
        if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) <= sk.range + e.radius) addDot(game, p, e, sk.dot);
      });
    }
  },
  shots(game, p, d, local, sk) {
    startAction(p, 'cast', 0.25);
    p.waveT = 0.25;
    const n = sk.count || 1;
    // aim：一番近いボスへ自動で狙う（拳銃使いの必殺技）
    let yaw = d.yaw;
    if (sk.aim && d.bx !== undefined) yaw = Math.atan2(d.bx - d.x, d.bz - d.z);
    const fire = (i) => {
      const a = yaw + (i - (n - 1) / 2) * (sk.spread || 0) + (sk.jitter ? (Math.random() - 0.5) * sk.jitter : 0);
      const o = { speed: sk.speed || 22, mult: sk.mult, color: sk.color, size: sk.size || 0.3, range: sk.range || 24, pierce: sk.pierce, explode: sk.explode, dot: sk.dot, split: sk.split, boomerang: sk.boomerang, local, gauge: sk.gaugeSelf ?? GAUGE.gainSkill };
      if (sk.debuff) o.onHit = (t) => { if (t && game.bosses.includes(t)) game.bossCommand({ type: 'debuff', ...sk.debuff, sub: t.sub }); };
      if (sk.chain) o.onHit = chainHit(game, p, sk.chain, sk.color);
      game.projectiles.playerShot(p, p.pos.x, p.pos.z, a, o);
    };
    if (sk.every) {
      // 連射：少しずつ間をあけて撃つ
      for (let i = 0; i < n; i++) p.pending.push({ t: i * sk.every, fn: () => { fire(i); game.sound.se('shoot'); } });
    } else {
      for (let i = 0; i < n; i++) fire(i);
      game.sound.se(sk.sound || 'shoot');
    }
  },
  leap(game, p, d, local, sk) {
    startAction(p, 'dash', sk.time);
    const dx = d.tx - p.pos.x;
    const dz = d.tz - p.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    p.dodgeX = dx / len;
    p.dodgeZ = dz / len;
    p.yaw = d.yaw;
    p.dashSpeed = len / sk.time;
    if (local) p.invuln = Math.max(p.invuln, sk.time + 0.2);
    game.sound.se('dodge');
    p.skillTick = () => {
      p.model.root.position.y = Math.sin(Math.min(1, p.actT / sk.time) * Math.PI) * (sk.height || 3.5);
      if (p.didSkill || p.actT < sk.time * 0.9) return;
      p.didSkill = true;
      p.model.root.position.y = 0;
      game.fx.burst(p.pos.x, 0.5, p.pos.z, sk.color, 45, { speed: 10, up: 6, life: 0.7, size: 0.25 });
      game.fx.shake(0.7);
      game.sound.se('slam');
      if (local) radiusHit(game, p, sk.mult, sk.radius, { melee: true, gauge: GAUGE.gainSkill, knock: 2, color: sk.color, brkMul: sk.brkMul });
    };
  },
  zone(game, p, d, local, sk) {
    startAction(p, 'cast', 0.35);
    game.sound.se(sk.zone === 'trap' ? 'windup' : 'seal');
    // at：self（足元）/ aim（狙った場所）/ boss（一番近いボスの足元。いなければ狙った場所）
    const at = sk.at === 'boss' && d.bx !== undefined ? { x: d.bx, z: d.bz } : sk.at === 'aim' || sk.at === 'boss' ? { x: d.tx, z: d.tz } : { x: d.x, z: d.z };
    // 重力術師：その場所へボスを引き寄せる
    if (sk.pullBoss && local) game.bossCommand({ type: 'pull', x: at.x, z: at.z, dist: sk.pullBoss, r: sk.pullRange || 30 });
    const count = sk.count || 1;
    if (sk.zone === 'talisman') {
      addZone(game, { kind: 'talisman', x: at.x, z: at.z, r: sk.radius, t: sk.dur, mult: sk.mult, color: sk.color, owner: p.id, local, p, need: sk.need || 3 });
      const mine = zones.filter((z) => z.kind === 'talisman' && z.owner === p.id);
      if (mine.length >= (sk.need || 3)) detonateTalismans(game, p.id);
      return;
    }
    for (let i = 0; i < count; i++) {
      // 複数置くときは輪の形にばらす（罠の大地など）
      const a = (i / count) * Math.PI * 2;
      const off = count > 1 ? sk.scatter || 4 : 0;
      addZone(game, {
        kind: sk.zone, x: at.x + Math.sin(a) * off, z: at.z + Math.cos(a) * off, r: sk.radius, t: sk.dur, delay: sk.delay,
        every: sk.every, tick: sk.every || 0, mult: (sk.mult || 0) * (sk.zone === 'trap' ? p.job.trapBonus || 1 : 1), color: sk.color,
        trigger: sk.trigger, buff: sk.buff, debuff: sk.debuff, heal: sk.heal, owner: p.id, local, p,
        range: sk.range, explode: sk.explode, endBurst: sk.endBurst,
      });
    }
  },
  teambuff(game, p, d, local, sk) {
    startAction(p, 'cast', 0.4);
    game.sound.se('seal');
    ringFx(game, d.x, d.z, sk.radius || 3, sk.color);
    if (local) game.teamEffect({ kind: 'buff', name: sk.buff, dur: sk.dur, vals: sk.vals, x: d.x, z: d.z, r: sk.radius || 0, msg: sk.msg });
  },
  selfbuff(game, p, d, local, sk) {
    startAction(p, 'cast', 0.35);
    game.sound.se(sk.sound || 'seal');
    game.fx.burst(p.pos.x, 1.4, p.pos.z, sk.color, 36, { speed: 5, up: 4, life: 0.7 });
    if (local) {
      p.buff(sk.buff, sk.dur, { ...sk.vals });
      if (sk.invuln) p.invuln = Math.max(p.invuln, sk.invuln);
      if (sk.taunt) game.bossCommand({ type: 'taunt', id: p.id, dur: sk.taunt }); // 棘の鎧：ボスに狙われる
      if (sk.msg) game.toastOnce(sk.msg, 1600);
    }
  },
  teamheal(game, p, d, local, sk) {
    startAction(p, 'cast', 0.4);
    game.sound.se('seal');
    ringFx(game, d.x, d.z, sk.radius, sk.color);
    if (local) game.teamEffect({ kind: 'heal', x: d.x, z: d.z, r: sk.radius, amount: sk.amount });
  },
  teamgauge(game, p, d, local, sk) {
    startAction(p, 'cast', 0.4);
    game.sound.se('seal');
    game.fx.burst(p.pos.x, 2, p.pos.z, sk.color, 50, { speed: 7, up: 5, life: 0.9 });
    if (local) {
      game.teamEffect({ kind: 'gauge', amount: sk.amount, x: d.x, z: d.z, r: sk.radius || 0, from: p.id });
      if (sk.self) p.addGauge(sk.self);
    }
  },
  debuff(game, p, d, local, sk) {
    startAction(p, 'cast', 0.4);
    game.sound.se('gate');
    for (const b of game.bosses) if (b.alive) ringFx(game, b.pos.x, b.pos.z, b.radius + 2, sk.color);
    if (local) for (const db of sk.debuffs) game.bossCommand({ type: 'debuff', ...db });
  },
  beam(game, p, d, local, sk) {
    // 光線：前方 len m・幅 width の一直線に、ticks 回（every 秒ごと）即着弾。fan があれば扇状に何本も
    const ticks = sk.ticks || 1;
    startAction(p, 'cast', ticks > 1 ? ticks * sk.every + 0.1 : 0.3);
    p.waveT = 0.3;
    const lines = sk.fan ? Array.from({ length: sk.fan }, (_, i) => d.yaw + (i - (sk.fan - 1) / 2) * (sk.fanSpread || 0.25)) : [d.yaw];
    let n = 0;
    let tick = 0;
    game.sound.se('wave');
    const fire = () => {
      for (const a of lines) {
        const s0 = Math.sin(a);
        const c0 = Math.cos(a);
        for (let k = 1; k < sk.len; k += 1.2) {
          const x = p.pos.x + s0 * k;
          const z = p.pos.z + c0 * k;
          if (game.world.blocked(x, z, true)) break;
          game.fx.burst(x, 1.2, z, sk.color, 1, { speed: 0.5, up: 0.3, life: 0.25, size: 0.2, grav: 0 });
        }
        if (!local) continue;
        forEachTarget(game, (e) => {
          const dx = e.pos.x - p.pos.x;
          const dz = e.pos.z - p.pos.z;
          const along = dx * s0 + dz * c0;
          const side = Math.abs(dx * c0 - dz * s0);
          if (along > 0 && along < sk.len + e.radius && side < sk.width / 2 + e.radius) strike(game, p, e, sk.mult, { gauge: sk.gaugeSelf ?? GAUGE.gainSkill, knock: 0.3, color: sk.color, brkMul: sk.brkMul });
        });
      }
    };
    p.skillTick = (dt) => {
      tick -= dt;
      if (n >= ticks || tick > 0) return;
      tick = sk.every || 0.2;
      n++;
      fire();
    };
  },
  cdreset(game, p, d, local, sk) {
    // 指揮者：全員の Q・E をすぐ使えるように
    startAction(p, 'cast', 0.5);
    game.sound.se('seal');
    ringFx(game, p.pos.x, p.pos.z, 12, sk.color);
    game.fx.burst(p.pos.x, 2.4, p.pos.z, sk.color, 40, { speed: 6, up: 5, life: 0.8 });
    if (local) game.teamEffect({ kind: 'cdreset' });
  },
  reviveall(game, p, d, local, sk) {
    // 献身者：自分の HP を 1 にして、倒れた仲間を全員起こす
    startAction(p, 'cast', 0.6);
    game.sound.se('seal');
    game.fx.burst(p.pos.x, 1.5, p.pos.z, sk.color, 60, { speed: 7, up: 6, life: 1 });
    if (local) {
      p.hp = 1;
      game.teamEffect({ kind: 'reviveall', hp: sk.hp });
    }
  },
  absorb(game, p, d, local, sk) {
    // 吸収術士：周りの敵弾を吸い込み、1発ごとに必殺ゲージと HP に変える
    startAction(p, 'cast', 0.35);
    game.sound.se('seal');
    const n = game.projectiles.clearShotsNear(p.pos.x, p.pos.z, sk.radius);
    ringFx(game, p.pos.x, p.pos.z, sk.radius, sk.color);
    if (local && n) {
      p.addGauge(Math.min(sk.gaugeMax ?? Infinity, n * sk.gaugePer));
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * sk.healPer * n);
      game.toastOnce(`敵弾を ${n} 個 吸収！`, 1200);
    }
  },
  reflect(game, p, d, local, sk) {
    // 反射術士：周りの敵弾をはね返し、数に応じて一番近い敵にダメージ
    startAction(p, 'cast', 0.35);
    game.sound.se('wave');
    const n = game.projectiles.clearShotsNear(p.pos.x, p.pos.z, sk.radius);
    ringFx(game, p.pos.x, p.pos.z, sk.radius, sk.color);
    if (!local) return;
    let best = null;
    let bd = 40;
    forEachTarget(game, (e) => {
      const dd = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      if (dd < bd) { bd = dd; best = e; }
    });
    if (best) {
      const mult = sk.base + Math.min(sk.cap, n) * sk.per;
      for (let k = 0; k < 1; k += 0.15) game.fx.burst(p.pos.x + (best.pos.x - p.pos.x) * k, 1.4, p.pos.z + (best.pos.z - p.pos.z) * k, sk.color, 2, { speed: 1, up: 0.5, life: 0.3, grav: 0 });
      strike(game, p, best, mult, { gauge: GAUGE.gainSkill, color: sk.color, knock: 0.5 });
      if (n) game.toastOnce(`敵弾を ${n} 個 はね返した！`, 1200);
    }
  },
  bell(game, p, d, local, sk) {
    // 鐘撞き：鐘を鳴らして敵弾を遅くする（弾は各自のブラウザにあるので、見た人のブラウザでもそれぞれ遅くなる）
    startAction(p, 'cast', 0.4);
    game.sound.se('seal');
    game.projectiles.slowShots(sk.mul, sk.dur);
    ringFx(game, p.pos.x, p.pos.z, 10, sk.color);
    if (local && sk.mult) radiusHit(game, p, sk.mult, sk.radius || 4, { gauge: GAUGE.gainSkill, color: sk.color, melee: false });
    game.toastOnce(`鐘の音：${sk.dur}秒間 敵弾が遅くなる`, 1400);
  },
  sticky(game, p, d, local, sk) {
    // 吸着爆弾：一番近いボスに貼り付いて、時間差で爆発（ボスが動いてもついていく）
    startAction(p, 'cast', 0.3);
    game.sound.se('windup');
    const n = sk.count || 1;
    for (let k = 0; k < n; k++) {
      let best = null;
      let bd = sk.range || 18;
      for (const b of game.bosses) {
        if (!b.active || !b.alive) continue;
        const dd = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
        if (dd < bd) { bd = dd; best = b; }
      }
      if (!best) {
        if (local && k === 0) game.toastOnce('貼り付ける相手が近くにいない', 1000);
        return;
      }
      const a = (k / n) * Math.PI * 2;
      addZone(game, { kind: 'sticky', target: best, ox: Math.sin(a) * best.radius * 0.6, oz: Math.cos(a) * best.radius * 0.6, x: best.pos.x, z: best.pos.z, r: sk.radius, t: sk.delay + k * 0.25, mult: sk.mult, color: sk.color, owner: p.id, local, p });
    }
  },
  cleanse(game, p, d, local, sk) {
    // メイドのお掃除：周りの敵弾を一瞬で消す（弾は各自のブラウザにあるので、見た人のブラウザでもそれぞれ消える）
    startAction(p, 'spin', 0.4);
    game.sound.se('seal');
    const n = game.projectiles.clearShotsNear(p.pos.x, p.pos.z, sk.radius);
    ringFx(game, p.pos.x, p.pos.z, sk.radius, sk.color);
    if (local) {
      if (sk.mult) radiusHit(game, p, sk.mult, sk.radius * 0.6, { gauge: GAUGE.gainSkill, color: sk.color, melee: false });
      if (n) game.toastOnce(`お掃除！ 敵弾を ${n} 個 消した`, 1200);
      if (sk.team) game.teamEffect({ kind: 'buff', name: sk.team.name, dur: sk.team.dur, vals: sk.team.vals, x: p.pos.x, z: p.pos.z, r: sk.radius, msg: sk.team.msg });
    }
  },
  mimic(game, p, d, local, sk) {
    // ものまね師：ランダムな職業の Q を借りて使う（何を借りたかは d.mimic で他の人にも同じものを見せる）
    // d.pick は借りた技の側（精霊術士の属性・道化師の手品など）が使うので、ものまね師は別の名前で持つ
    if (d.mimic === undefined) {
      const pool = JOB_ORDER.filter((j) => j !== p.jobId && JOBS[j].q.kind !== 'mimic');
      d.mimic = pool[Math.floor(Math.random() * pool.length)];
    }
    const src = JOBS[d.mimic];
    if (!src) return;
    game.toastOnce(`ものまね：${src.name}の「${src.q.name}」`, 1400);
    if (SKILLS[src.q.id]) SKILLS[src.q.id](game, p, d, local);
    else if (GENERIC[src.q.kind]) GENERIC[src.q.kind](game, p, d, local, src.q);
  },
  cycle(game, p, d, local, sk) {
    // 精霊術士：使うたびに順番に属性が変わる（炎→氷→雷→…）
    if (d.pick === undefined) {
      p.cycleIdx = ((p.cycleIdx ?? -1) + 1) % sk.pool.length;
      d.pick = p.cycleIdx;
    }
    const one = sk.pool[d.pick];
    game.toastOnce(`${sk.name}：${one.name}`, 1200);
    GENERIC[one.kind](game, p, d, local, one);
  },
  blink(game, p, d, local, sk) {
    // 次元術士：狙った場所へ一瞬で移動（壁は越えない）。着いた場所で周りを打つ
    startAction(p, 'cast', 0.2);
    game.fx.burst(d.x, 1.2, d.z, sk.color, 30, { speed: 5, up: 3, life: 0.5 });
    game.sound.se('gate');
    if (!local) return;
    p.pos.x = d.tx;
    p.pos.z = d.tz;
    game.world.collide(p.pos, p.radius);
    p.invuln = Math.max(p.invuln, 0.5);
    game.fx.burst(p.pos.x, 1.2, p.pos.z, sk.color, 30, { speed: 5, up: 3, life: 0.5 });
    if (sk.mult) radiusHit(game, p, sk.mult, sk.radius, { gauge: GAUGE.gainSkill, color: sk.color, melee: false });
  },
  blinkbehind(game, p, d, local, sk) {
    // 暗殺者：一番近いボスの背後へ回り込む（いなければ前へ跳ぶ）
    startAction(p, 'cast', 0.25);
    game.sound.se('gate');
    game.fx.burst(d.x, 1.2, d.z, 0x424242, 30, { speed: 4, up: 3, life: 0.5 });
    if (!local) return;
    if (d.bx !== undefined) {
      const back = (d.byaw || 0) + Math.PI;
      p.pos.x = d.bx + Math.sin(back) * ((d.br || 1.5) + 1.4);
      p.pos.z = d.bz + Math.cos(back) * ((d.br || 1.5) + 1.4);
      p.yaw = Math.atan2(d.bx - p.pos.x, d.bz - p.pos.z);
    } else {
      p.pos.x = d.tx;
      p.pos.z = d.tz;
    }
    game.world.collide(p.pos, p.radius);
    p.invuln = Math.max(p.invuln, 0.6);
    if (sk.mult) meleeArc(game, p, p.yaw, sk.mult, 3.2, 1.6, { gauge: GAUGE.gainSkill, crit: sk.crit, color: 0x424242 });
  },
  mark(game, p, d, local, sk) {
    // 狩人の印：一番近いボスに印。sk.dur 秒間、自分の攻撃が強くなる
    startAction(p, 'cast', 0.25);
    game.sound.se('windup');
    if (!local) return;
    let best = null;
    let bd = Infinity;
    for (const b of game.bosses) {
      if (!b.active || !b.alive) continue;
      const dd = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      if (dd < bd) { bd = dd; best = b; }
    }
    if (!best) {
      game.toastOnce('印を付ける相手がいない', 1000);
      return;
    }
    p.mark = { target: best, t: sk.dur };
    game.fx.burst(best.pos.x, best.hpY, best.pos.z, 0xff1744, 30, { speed: 3, up: 2, life: 0.8 });
    game.toastOnce(`${best.name}に印を付けた（${sk.dur}秒）`, 1400);
  },
  selfhurt(game, p, d, local, sk) {
    // ギャンブラーの外れ：自分が痛い
    startAction(p, 'cast', 0.3);
    game.sound.se('hurt');
    game.fx.burst(p.pos.x, 1.4, p.pos.z, 0x9e9e9e, 20, { speed: 3, up: 3, life: 0.5 });
    if (local) p.hp = Math.max(1, p.hp - p.maxHp * sk.frac);
  },
  counter(game, p, d, local, sk) {
    startAction(p, 'cast', sk.dur);
    game.sound.se('windup');
    game.fx.burst(p.pos.x, 1.2, p.pos.z, 0xffffff, 16, { speed: 2, up: 1, life: 0.5 });
    if (local) p.buff('counter', sk.dur, { mult: sk.mult, range: sk.range });
  },
  random(game, p, d, local, sk) {
    // 道化師：候補のうち1つ（何が出たかは d.pick で他の人にも同じものを見せる）
    if (d.pick === undefined) d.pick = Math.floor(Math.random() * sk.pool.length);
    const one = sk.pool[d.pick];
    game.toastOnce(`${sk.name}：${one.name}！`, 1400);
    GENERIC[one.kind](game, p, d, local, one);
  },
};

/** 雷の連鎖：当たった相手の近くの別の敵にも 60% で飛ぶ */
function chainHit(game, p, ch, color) {
  return (t) => {
    if (!t) return;
    forEachTarget(game, (e) => {
      if (e === t || Math.hypot(e.pos.x - t.pos.x, e.pos.z - t.pos.z) > ch.range) return;
      for (let k = 0; k < 1; k += 0.2) game.fx.burst(t.pos.x + (e.pos.x - t.pos.x) * k, 1.6, t.pos.z + (e.pos.z - t.pos.z) * k, color, 1, { speed: 0.5, up: 0.5, life: 0.25, grav: 0 });
      strike(game, p, e, ch.mult, { gauge: 1, knock: 0, color });
    });
  };
}

/** 通常攻撃（飛び道具） */
export function basicShot(game, p, yaw) {
  const b = p.job.basic;
  const d = { x: p.pos.x, z: p.pos.z, yaw, still: p.still > 0.3 };
  shoot(game, p, d, true);
  game.raid?.sendSkill(p, '_shot', d);
}
function shoot(game, p, d, local) {
  const b = p.job.basic;
  const mult = b.mult * (d.still && p.job.stillBonus ? p.job.stillBonus : 1);
  // 双子：通常攻撃が2発（count・spread）
  const n = b.count || 1;
  const o = { ...b, mult, local, gauge: p.job.basicGauge, basic: true }; // 通常攻撃：ゲージは職業ごとの basicGauge
  if (b.debuff) o.onHit = (t) => { if (t && game.bosses.includes(t)) game.bossCommand({ type: 'debuff', ...b.debuff, sub: t.sub }); };
  for (let i = 0; i < n; i++) {
    const jit = b.jitter ? (Math.random() - 0.5) * b.jitter : 0; // マシンガン：少しばらける
    game.projectiles.playerShot(p, d.x, d.z, d.yaw + (i - (n - 1) / 2) * (b.spread || 0) + jit, o);
  }
  game.sound.se('shoot');
}
SKILLS._dodgeblast = (game, p, d) => {
  game.fx.burst(d.x, 0.8, d.z, 0xffd54f, 24, { speed: 6, up: 4, life: 0.5 });
};
SKILLS._shot = (game, p, d, local) => {
  p.waveT = 0.25;
  shoot(game, p, d, local);
};


/** 前方（角度 halfArc 以内）で一番近い攻撃対象 */
function frontTarget(game, p, range, halfArc) {
  let best = null;
  let bd = Infinity;
  forEachTarget(game, (e) => {
    const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
    if (d > range + e.radius || d >= bd) return;
    if (d > e.radius + 0.5 && Math.abs(angleDiff(p.yaw, yawTo(p.pos.x, p.pos.z, e.pos.x, e.pos.z))) > halfArc) return;
    bd = d;
    best = e;
  });
  return best;
}

/** まっすぐ駆け抜けて通り道を斬る（忍者の瞬影斬・槍兵の突進突き） */
function dashStrike(game, p, d, local, q, color, extra = {}) {
  extra = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined));
  startAction(p, 'dash', q.time);
  p.dodgeX = Math.sin(d.yaw);
  p.dodgeZ = Math.cos(d.yaw);
  p.yaw = d.yaw;
  p.dashSpeed = q.dist / q.time;
  if (local) p.invuln = Math.max(p.invuln, q.time + 0.15);
  const hit = new Set();
  game.sound.se('spin');
  p.skillTick = () => {
    game.fx.burst(p.pos.x, 1, p.pos.z, color, 3, { speed: 2, up: 1, life: 0.3 });
    if (!local) return;
    forEachTarget(game, (e) => {
      if (hit.has(e)) return;
      if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < e.radius + q.width) {
        hit.add(e);
        strike(game, p, e, q.mult, { melee: true, gauge: GAUGE.gainSkill, color, ...extra });
      }
    });
  };
}

// ---------------- 継続ダメージ（呪術師の呪い） ----------------
const dots = [];
/** target に呪いを付ける（同じ人の同じ強さの呪いは時間を延ばすだけ） */
export function addDot(game, p, target, dot) {
  const old = dots.find((o) => o.p === p && o.target === target && o.mult === dot.mult);
  if (old) {
    old.left = dot.dur;
    return;
  }
  dots.push({ p, target, mult: dot.mult, every: dot.every, t: dot.every, left: dot.dur });
}
function updateDots(game, dt) {
  for (let i = dots.length - 1; i >= 0; i--) {
    const o = dots[i];
    o.left -= dt;
    o.t -= dt;
    if (!o.target.alive || o.left <= 0) {
      dots.splice(i, 1);
      continue;
    }
    if (o.t <= 0) {
      o.t = o.every;
      strike(game, o.p, o.target, o.mult, { gauge: 1, knock: 0, color: 0x7b1fa2 });
      game.fx.burst(o.target.pos.x, (o.target.hpY || 2) * 0.7, o.target.pos.z, 0x7b1fa2, 4, { speed: 1.5, up: 2, life: 0.4 });
    }
  }
}

// ---------------- スキルが残す効果（隕石・矢の雨・結界） ----------------

const zones = [];
let zoneGroup = null;
const geoCache = {};

function addZone(game, z) {
  // 支援係数：置いた人の職業の support を、回復の場・トーテムの効き目に掛ける
  const sup = z.p?.job?.support ?? 1;
  if (sup !== 1) {
    if (z.heal) z.heal *= sup;
    if (z.buff?.vals) z.buff = { ...z.buff, vals: scaleVals(z.buff.vals, sup) };
  }
  if (!zoneGroup) {
    zoneGroup = new THREE.Group();
    game.scene.add(zoneGroup);
  }
  z.age = 0;
  if (z.kind === 'sticky') {
    geoCache.sticky ||= new THREE.SphereGeometry(0.35, 8, 6);
    z.mat = new THREE.MeshBasicMaterial({ color: z.color });
    z.mesh = new THREE.Mesh(geoCache.sticky, z.mat);
    z.mesh.position.y = 2;
  } else if (z.kind === 'turret' || z.kind === 'talisman') {
    geoCache.turret ||= new THREE.CylinderGeometry(0.35, 0.5, 1.2, 8);
    geoCache.talisman ||= new THREE.BoxGeometry(0.5, 0.8, 0.06);
    z.mat = new THREE.MeshBasicMaterial({ color: z.color });
    z.mesh = new THREE.Mesh(z.kind === 'turret' ? geoCache.turret : geoCache.talisman, z.mat);
    z.mesh.position.y = z.kind === 'turret' ? 0.6 : 1.2;
    z.cd = 0;
  } else if (z.kind === 'field' || z.kind === 'strike' || z.kind === 'totem') {
    geoCache.ring ||= new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2);
    z.mat = new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.7, depthWrite: false });
    z.mesh = new THREE.Mesh(geoCache.ring, z.mat);
    z.mesh.scale.setScalar(z.r);
    z.mesh.position.y = 0.06;
    if (z.kind === 'totem') {
      geoCache.totem ||= new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6);
      z.rockMat = new THREE.MeshBasicMaterial({ color: z.color });
      z.rock = new THREE.Mesh(geoCache.totem, z.rockMat);
      z.rock.position.set(z.x, 1.1, z.z);
      zoneGroup.add(z.rock);
    }
  } else if (z.kind === 'trap') {
    geoCache.trap ||= new THREE.CylinderGeometry(0.6, 0.6, 0.12, 8);
    z.mat = new THREE.MeshBasicMaterial({ color: z.color });
    z.mesh = new THREE.Mesh(geoCache.trap, z.mat);
    z.mesh.position.y = 0.07;
  } else if (z.kind === 'mine') {
    geoCache.mine ||= new THREE.CylinderGeometry(0.45, 0.55, 0.25, 10);
    z.mat = new THREE.MeshBasicMaterial({ color: 0xff6f00 });
    z.mesh = new THREE.Mesh(geoCache.mine, z.mat);
    z.mesh.position.y = 0.13;
  } else if (z.kind === 'aegis') {
    geoCache.dome ||= new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    z.mat = new THREE.MeshBasicMaterial({ color: 0x90caf9, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    z.mesh = new THREE.Mesh(geoCache.dome, z.mat);
    z.mesh.scale.setScalar(z.r);
  } else {
    geoCache.ring ||= new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2);
    const color = z.kind === 'meteor' ? 0x64b5f6 : 0xc5e1a5;
    z.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false });
    z.mesh = new THREE.Mesh(geoCache.ring, z.mat);
    z.mesh.scale.setScalar(z.r);
    z.mesh.position.y = 0.06;
    if (z.kind === 'meteor') {
      geoCache.rock ||= new THREE.IcosahedronGeometry(1.4, 0);
      z.rockMat = new THREE.MeshBasicMaterial({ color: 0xff7043 });
      z.rock = new THREE.Mesh(geoCache.rock, z.rockMat);
      zoneGroup.add(z.rock);
    }
  }
  z.mesh.position.x = z.x;
  z.mesh.position.z = z.z;
  zoneGroup.add(z.mesh);
  zones.push(z);
  game.auras?.zoneAdded(z); // 範囲の見た目（src/auras.js）
}

function removeZone(i) {
  const z = zones[i];
  z.aura?.remove();
  zoneGroup.remove(z.mesh);
  z.mat.dispose();
  if (z.rock) {
    zoneGroup.remove(z.rock);
    z.rockMat.dispose();
  }
  zones.splice(i, 1);
}

/** 毎フレーム（ホスト・参加者とも） */
export function updateJobZones(game, dt) {
  updateDots(game, dt);
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.t -= dt;
    z.age += dt;
    if (z.kind === 'meteor') {
      const k = Math.min(1, z.age / z.delay);
      z.rock.position.set(z.x - 8 * (1 - k), 18 * (1 - k) + 0.5, z.z);
      z.mat.opacity = 0.4 + 0.4 * Math.sin(z.age * 20);
      if (z.t <= 0) {
        game.fx.burst(z.x, 0.5, z.z, 0xff7043, 70, { speed: 12, up: 8, life: 0.9, size: 0.3 });
        game.fx.shake(0.8);
        game.sound.se('slam');
        if (z.local) radiusHit(game, z.p, z.mult, z.r, { color: 0xff7043, knock: 2, gauge: 0 }, z.x, z.z);
        removeZone(i);
      }
    } else if (z.kind === 'arrowrain') {
      z.tick -= dt;
      if (Math.random() < 0.8) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * z.r;
        game.fx.burst(z.x + Math.sin(a) * r, 0.2, z.z + Math.cos(a) * r, 0xc5e1a5, 2, { speed: 1, up: 1, life: 0.25 });
      }
      if (z.tick <= 0) {
        z.tick = z.every;
        if (z.local) radiusHit(game, z.p, z.mult, z.r, { color: 0xc5e1a5, knock: 0.2, gauge: 1 }, z.x, z.z);
      }
      if (z.t <= 0) removeZone(i);
    } else if (z.kind === 'field') {
      // 継続ダメージ（と、heal があれば中の味方の回復）
      z.mat.opacity = 0.45 + 0.25 * Math.sin(z.age * 6);
      if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * z.r;
        game.fx.burst(z.x + Math.sin(a) * r, 0.3, z.z + Math.cos(a) * r, z.color, 1, { speed: 1, up: 2, life: 0.4 });
      }
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = z.every;
        if (z.local && z.mult) radiusHit(game, z.p, z.mult, z.r, { gauge: 1, knock: 0.2, color: z.color }, z.x, z.z);
        if (z.heal) {
          const me = game.me();
          if (me?.alive && Math.hypot(me.pos.x - z.x, me.pos.z - z.z) <= z.r) me.hp = Math.min(me.maxHp, me.hp + me.maxHp * z.heal);
        }
      }
      if (z.t <= 0) {
        // 庭師：花が咲き終わると爆発する
        if (z.endBurst) {
          game.fx.burst(z.x, 0.8, z.z, z.color, 45, { speed: 8, up: 7, life: 0.7, size: 0.26 });
          game.sound.se('slam');
          if (z.local) radiusHit(game, z.p, z.endBurst, z.r, { color: z.color, knock: 1, gauge: GAUGE.gainSkill }, z.x, z.z);
        }
        removeZone(i);
      }
    } else if (z.kind === 'strike') {
      // 時間差の一撃（落雷・流星など）
      z.mat.opacity = 0.4 + 0.4 * Math.sin(z.age * 20);
      if (z.t <= 0) {
        game.fx.burst(z.x, 0.6, z.z, z.color, 50, { speed: 10, up: 9, life: 0.7, size: 0.26 });
        game.fx.shake(0.6);
        game.sound.se('slam');
        if (z.local) radiusHit(game, z.p, z.mult, z.r, { color: z.color, knock: 1.5, gauge: GAUGE.gainSkill }, z.x, z.z);
        removeZone(i);
      }
    } else if (z.kind === 'totem') {
      // トーテム：近くにいる自分を強化し続ける（各自のブラウザで自分に）
      z.mat.opacity = 0.35 + 0.2 * Math.sin(z.age * 3);
      z.rock.rotation.y += dt;
      const me = game.me();
      if (me?.alive && Math.hypot(me.pos.x - z.x, me.pos.z - z.z) <= z.r && z.buff) me.buff(z.buff.name, 0.6, { ...z.buff.vals });
      if (z.t <= 0) removeZone(i);
    } else if (z.kind === 'trap') {
      // 罠：ボスが踏むと発動（ダメージ＋弱体化）。当たり判定は置いた本人だけ
      z.mat.color.setHex(Math.floor(z.age * 2) % 2 ? z.color : 0x212121);
      let hit = null;
      for (const b of game.bosses) if (b.active && b.alive && Math.hypot(b.pos.x - z.x, b.pos.z - z.z) < z.trigger + b.radius) hit = b;
      if (hit || z.t <= 0) {
        if (hit) {
          game.fx.burst(z.x, 0.5, z.z, z.color, 40, { speed: 8, up: 6, life: 0.6, size: 0.24 });
          game.sound.se('slam');
          if (z.local) {
            radiusHit(game, z.p, z.mult, z.r, { color: z.color, knock: 0.5, gauge: GAUGE.gainSkill, brkMul: 2 }, z.x, z.z);
            if (z.debuff) game.bossCommand({ type: 'debuff', ...z.debuff, sub: hit.sub });
          }
        }
        removeZone(i);
      }
    } else if (z.kind === 'sticky') {
      // ボスについていく。時間が来たら爆発
      if (z.target?.alive) {
        z.x = z.target.pos.x + z.ox;
        z.z = z.target.pos.z + z.oz;
      }
      z.mesh.position.set(z.x, 1.5 + z.target?.hpY * 0.3 || 2, z.z);
      z.mat.color.setHex(Math.floor(z.age * 6) % 2 ? z.color : 0xffffff);
      if (z.t <= 0) {
        game.fx.burst(z.x, 1.5, z.z, z.color, 40, { speed: 9, up: 6, life: 0.6, size: 0.26 });
        game.sound.se('slam');
        if (z.local) radiusHit(game, z.p, z.mult, z.r, { color: z.color, knock: 1, gauge: GAUGE.gainSkill }, z.x, z.z);
        removeZone(i);
      }
    } else if (z.kind === 'turret') {
      // 機工士のタレット：一番近い敵へ自動で撃つ（当たり判定は置いた本人だけ）
      z.mesh.rotation.y += dt * 2;
      z.cd -= dt;
      if (z.cd <= 0) {
        z.cd = z.every;
        let best = null;
        let bd = z.range || 22;
        forEachTarget(game, (e) => {
          const dd = Math.hypot(e.pos.x - z.x, e.pos.z - z.z);
          if (dd < bd) { bd = dd; best = e; }
        });
        if (best) game.projectiles.playerShot(z.p, z.x, z.z, Math.atan2(best.pos.x - z.x, best.pos.z - z.z), { speed: 30, mult: z.mult, color: z.color, size: 0.22, range: 26, explode: z.explode, local: z.local, gauge: 0 });
      }
      if (z.t <= 0) removeZone(i);
    } else if (z.kind === 'talisman') {
      z.mesh.rotation.y += dt * 1.5;
      z.mesh.position.y = 1.2 + Math.sin(z.age * 3) * 0.15;
      if (z.t <= 0) removeZone(i);
    } else if (z.kind === 'mine') {
      z.mat.color.setHex(Math.floor(z.age * 4) % 2 ? 0xff6f00 : 0xffd180);
      // ボスが近づくか、時間が来たら爆発（当たり判定は置いた本人だけ）
      let boom = z.t <= 0;
      for (const b of game.bosses) if (b.active && b.alive && Math.hypot(b.pos.x - z.x, b.pos.z - z.z) < z.trigger + b.radius) boom = true;
      if (boom) {
        game.fx.burst(z.x, 0.5, z.z, 0xff6f00, 50, { speed: 10, up: 7, life: 0.7, size: 0.28 });
        game.fx.shake(0.6);
        game.sound.se('slam');
        if (z.local) radiusHit(game, z.p, z.mult, z.r, { color: 0xff6f00, knock: 2, gauge: GAUGE.gainSkill }, z.x, z.z);
        removeZone(i);
      }
    } else if (z.kind === 'aegis') {
      z.mat.opacity = 0.18 + 0.06 * Math.sin(z.age * 4) + (z.t < 1.5 ? 0.1 * Math.sin(z.age * 30) : 0);
      if (z.t <= 0) removeZone(i);
    }
  }
}

/** 陰陽師：その人の札をすべて爆発させる（札の数だけ大爆発） */
function detonateTalismans(game, owner) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (z.kind !== 'talisman' || z.owner !== owner) continue;
    game.fx.burst(z.x, 1, z.z, z.color, 50, { speed: 9, up: 8, life: 0.8, size: 0.28 });
    if (z.local) radiusHit(game, z.p, z.mult, z.r, { color: z.color, knock: 1.5, gauge: GAUGE.gainSkill, brkMul: 1.5 }, z.x, z.z);
    removeZone(i);
  }
  game.fx.shake(0.8);
  game.sound.se('slam');
  game.toastOnce('札がそろった！ 一斉に爆発！', 1200);
}

/** (x,z) が重騎士の守護結界の中か（敵弾を消す・被ダメ半減） */
export function inAegis(x, z) {
  for (const o of zones) {
    if (o.kind === 'aegis' && (x - o.x) ** 2 + (z - o.z) ** 2 < o.r * o.r) return true;
  }
  return false;
}

export function clearJobZones() {
  dots.length = 0;
  for (let i = zones.length - 1; i >= 0; i--) removeZone(i);
}

/** 地面に広がる輪（回復・強化の範囲表示） */
function ringFx(game, x, z, r, color) {
  game.auras?.pulse(x, z, r, color); // 範囲の大きさがわかる波紋（src/auras.js）
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    game.fx.burst(x + Math.sin(a) * r, 0.3, z + Math.cos(a) * r, color, 1, { speed: 0.5, up: 2, life: 0.6, grav: 0 });
  }
  game.fx.burst(x, 1, z, color, 20, { speed: 3, up: 3, life: 0.7 });
}

/** 遠くから当てたときの倍率など、飛び道具が当たったときの補正（projectiles.js から） */
export function shotMult(p, target, mult) {
  const J = p.job;
  if (J.farBonus && Math.hypot(target.pos.x - p.pos.x, target.pos.z - p.pos.z) >= J.farDist) return mult * J.farBonus;
  return mult;
}

export { angleDiff, yawTo };
