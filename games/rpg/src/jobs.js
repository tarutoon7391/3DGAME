// 職業のスキル（通常攻撃の飛び道具・Q・E）と、スキルが残す効果（隕石・矢の雨・結界など）
// 使った本人のブラウザでは当たり判定込みで実行し（local = true）、他の人のブラウザでは見た目だけ再生する（local = false）
// 味方への回復・強化は game.teamEffect（全員に配って各自が自分に適用）、ボスへの挑発・召喚は game.bossCommand（ホストが処理）
import * as THREE from 'three';
import { JOBS, GAUGE } from './data/jobs.js';
import { radiusHit, strike, forEachTarget, meleeArc } from './combat.js';
import { angleDiff, yawTo } from './util.js';

const fwd = (yaw, d) => [Math.sin(yaw) * d, Math.cos(yaw) * d];

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
        game.teamEffect({ kind: 'heal', amount: e.heal, quiet: true });
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
  gale(game, p, d, local) {
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
  spread(game, p, d, local) {
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
  return { x: p.pos.x, z: p.pos.z, yaw, tx: p.pos.x + ox, tz: p.pos.z + oz, still: p.still > 0.3 };
}

function cast(game, p, id, d) {
  SKILLS[id](game, p, d, true);
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
  if (SKILLS[id]) SKILLS[id](game, p, d, false);
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
  game.projectiles.playerShot(p, d.x, d.z, d.yaw, { ...b, mult, local });
  game.sound.se('shoot');
}
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
  if (!zoneGroup) {
    zoneGroup = new THREE.Group();
    game.scene.add(zoneGroup);
  }
  z.age = 0;
  if (z.kind === 'mine') {
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
}

function removeZone(i) {
  const z = zones[i];
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
