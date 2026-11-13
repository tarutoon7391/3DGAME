// 職業のスキル（通常攻撃の飛び道具・Q・E）と、スキルが残す効果（隕石・矢の雨・結界など）
// 使った本人のブラウザでは当たり判定込みで実行し（local = true）、他の人のブラウザでは見た目だけ再生する（local = false）
// 味方への回復・強化は game.teamEffect（全員に配って各自が自分に適用）、ボスへの挑発・召喚は game.bossCommand（ホストが処理）
import * as THREE from 'three';
import { JOBS, JOB_ORDER, GAUGE } from './data/jobs.js';
import { radiusHit, strike, forEachTarget, meleeArc } from './combat.js';
import { angleDiff, yawTo } from './util.js';
import { CLOSE } from './data/player.js';
import { useCopiedMove, copyMoves, nearestBoss } from './jobs_copy.js';

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
  hayabusa(game, p, d, local) {
    // 隼斬り：前へ少しずつ踏み込みながら、右・左・縦の高速3連撃
    const q = JOBS.swordsman.q;
    startAction(p, 'cast', q.every * 3 + 0.12);
    p.yaw = d.yaw;
    for (let i = 0; i < 3; i++) {
      later(p, 0.05 + i * q.every, () => {
        const last = i === 2;
        if (local) {
          p.pos.x += Math.sin(d.yaw) * q.step;
          p.pos.z += Math.cos(d.yaw) * q.step;
          game.world.collide(p.pos, p.radius);
          meleeArc(game, p, d.yaw, last ? q.last : q.mult, q.range + (last ? 0.4 : 0), q.arc, { gauge: GAUGE.gainSkill, knock: last ? 1.5 : 0.6, color: 0x80d8ff });
        }
        p.yaw = d.yaw;
        game.skillFx?.swing(p, i, last, q.range + (last ? 0.4 : 0), q.arc, last ? 0xffffff : 0x80d8ff);
        const fx = p.pos.x + Math.sin(d.yaw) * 2;
        const fz = p.pos.z + Math.cos(d.yaw) * 2;
        game.fx.burst(fx, 1.2, fz, 0x80d8ff, last ? 22 : 10, { speed: last ? 9 : 6, up: 2, life: 0.35, size: 0.12, grav: 1 });
        game.sound.se(last ? 'crit' : 'swing');
        game.fx.shake(last ? 0.35 : 0.15);
      });
    }
  },
  sakura(game, p, d, local) {
    // 奥義・乱れ桜：一番近いボスへ一瞬で詰め寄り、桜吹雪の中で8連撃。最後の一撃は必ず会心
    const r = JOBS.swordsman.r;
    const hasBoss = d.bx !== undefined && Math.hypot(d.bx - d.x, d.bz - d.z) < r.reach + (d.br || 0);
    const yaw = hasBoss ? Math.atan2(d.bx - d.x, d.bz - d.z) : d.yaw;
    const gap = hasBoss ? Math.max(0, Math.hypot(d.bx - d.x, d.bz - d.z) - (d.br || 1) - 1.6) : 4;
    const dashT = 0.16;
    const flurry = r.every * r.hits + 0.25;
    if (local) p.invuln = Math.max(p.invuln, dashT + flurry + 0.3);
    p.yaw = yaw;
    if (gap > 0.3) {
      startAction(p, 'dash', dashT);
      p.dodgeX = Math.sin(yaw);
      p.dodgeZ = Math.cos(yaw);
      p.dashSpeed = gap / dashT;
      game.skillFx?.dash(p, yaw, gap, 1.6, r.color);
    }
    game.sound.se('spin');
    game.fx.burst(p.pos.x, 1.4, p.pos.z, r.color, 40, { speed: 6, up: 4, life: 0.8, size: 0.16, grav: 1 });
    const start = gap > 0.3 ? dashT : 0.02;
    later(p, start, () => startAction(p, 'cast', flurry));
    for (let i = 0; i < r.hits; i++) {
      later(p, start + 0.05 + i * r.every, () => {
        const last = i === r.hits - 1;
        p.yaw = yaw;
        const cx = p.pos.x + Math.sin(yaw) * 1.8;
        const cz = p.pos.z + Math.cos(yaw) * 1.8;
        if (local) meleeArc(game, p, yaw, last ? r.last : r.mult, 4.2, 2.6, { gauge: 0, crit: last, knock: last ? 2 : 0.3, color: r.color });
        game.skillFx?.swing(p, i, last, last ? 4.6 : 3.6, 2.4, last ? 0xffffff : i % 2 ? 0xf48fb1 : 0xffffff);
        // 桜の花びら
        game.fx.burst(cx, 1.6, cz, i % 2 ? 0xf8bbd0 : 0xfce4ec, last ? 60 : 14, { speed: last ? 10 : 5, up: 3, life: last ? 1.4 : 0.9, size: 0.16, grav: 1.2 });
        game.sound.se(last ? 'crit' : 'swing');
        game.fx.shake(last ? 0.9 : 0.18);
        if (last) {
          game.enemyFx?.impact(cx, cz, 5, r.color, 'default');
          if (local) game.fx.hitstop(0.18); // ひとりのときだけ一瞬止まる（協力プレイでは止めない）
        }
      });
    }
  },
  // ---- 重騎士 ----
  taunt(game, p, d, local) {
    const q = JOBS.knight.q;
    startAction(p, 'cast', 0.45);
    game.sound.se('roar');
    game.fx.burst(p.pos.x, 2, p.pos.z, 0xff7043, 30, { speed: 7, up: 3, life: 0.6 });
    game.skillFx?.powerUp(p, 0xff7043);
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
    game.skillFx?.pillar(p.pos.x, p.pos.z, 0xfff59d, 3);
    if (local) game.teamEffect({ kind: 'prayer', invuln: e.invuln });
  },
  // ---- 弓使い ----
  poisonarrow(game, p, d, local) {
    // 毒矢：貫通する緑の矢。当たった敵は毒で削れ続ける
    const q = JOBS.archer.q;
    p.waveT = 0.25;
    startAction(p, 'cast', 0.2);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { ...JOBS.archer.basic, speed: q.speed, mult: q.mult, size: q.size, range: q.range, color: q.color, dot: q.dot, local, gauge: GAUGE.gainSkill });
    game.fx.burst(p.pos.x + Math.sin(d.yaw) * 1.2, 1.4, p.pos.z + Math.cos(d.yaw) * 1.2, q.color, 12, { speed: 3, up: 2, life: 0.5 });
    game.sound.se('shoot');
  },
  arrowrain(game, p, d, local) {
    const e = JOBS.archer.r;
    startAction(p, 'cast', 0.4);
    game.sound.se('shoot');
    p.aimUpT = 0.45; // 一人称：弓を真上へ向けて放つ
    game.skillFx?.volleyUp(p); // 上へ放つ矢（少し遅れて降ってくる）
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
    game.skillFx?.powerUp(p, 0x7e57c2);
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
    game.skillFx?.songRing(d.x, d.z, q.radius, 0xf48fb1, 'lonely'); // 楽譜の輪（寂しげに）
    if (local) game.teamEffect({ kind: 'buff', name: 'courage', dur: q.dur, vals: { mul: q.atkMul }, x: d.x, z: d.z, r: q.radius, msg: '勇気の歌：攻撃力アップ！' });
  },
  gale(game, p, d, local) {
    const e = JOBS.bard.r;
    startAction(p, 'cast', 0.5);
    game.sound.se('seal');
    game.fx.burst(p.pos.x, 2, p.pos.z, 0xf48fb1, 50, { speed: 8, up: 4, life: 1 });
    game.skillFx?.songRing(p.pos.x, p.pos.z, 12, 0xf48fb1, 'hype'); // 楽譜の輪（盛り上がる）
    if (local) game.teamEffect({ kind: 'buff', name: 'gale', dur: e.dur, vals: { speedMul: e.speedMul, regen: e.regen }, msg: '疾風の旋律：スタミナ無限・足が速くなる！' });
  },
  // ---- 召喚士 ----
  spirit(game, p, d, local) {
    startAction(p, 'cast', 0.35);
    game.sound.se('seal');
    game.fx.burst(d.x, 1, d.z, 0x80cbc4, 20, { speed: 4, up: 4, life: 0.6 });
    game.skillFx?.summon(d.x, d.z, 0x80cbc4);
    if (local) game.bossCommand({ type: 'summon', kind: 'spirit', x: d.x, z: d.z, owner: p.id });
  },
  golem(game, p, d, local) {
    startAction(p, 'cast', 0.6);
    game.sound.se('slam');
    game.fx.burst(d.x, 1, d.z, 0xa1887f, 40, { speed: 6, up: 5, life: 0.8 });
    game.skillFx?.summon(d.x, d.z, 0xa1887f);
    if (local) game.bossCommand({ type: 'summon', kind: 'golem', x: d.x, z: d.z, owner: p.id });
  },

  // ---- 槍兵 ----
  lunge(game, p, d, local) {
    dashStrike(game, p, d, local, JOBS.lancer.q, 0xffab91);
  },
  skyfall(game, p, d, local) {
    // 天穿ち：真上へ跳び、空中で周りを8連撃（槍の閃光が四方へ走る）。最後はその場へ叩きつけて着地
    const e = JOBS.lancer.r;
    const total = e.rise + e.hits * e.every + 0.35;
    startAction(p, 'cast', total);
    p.yaw = d.yaw;
    if (local) p.invuln = Math.max(p.invuln, total + 0.2);
    game.sound.se('dodge');
    game.fx.burst(p.pos.x, 0.3, p.pos.z, 0xbcaaa4, 30, { speed: 6, up: 4, life: 0.5 });
    p.vmAnim = { kind: 'thrusts', t: 0, dur: total - 0.3, every: e.every, delay: e.rise }; // 一人称：槍の通常攻撃と同じ突き
    game.skillFx?.pillar?.(p.pos.x, p.pos.z, 0xffab91, 1.4); // 跳び上がる光の柱
    const x0 = p.pos.x;
    const z0 = p.pos.z;
    let n = 0;
    p.skillTick = () => {
      const t = p.actT;
      // 高さ：ぱっと上がって空中にとどまり、最後に一気に落ちる
      const fall = e.rise + e.hits * e.every;
      if (t < e.rise) p.model.root.position.y = e.height * (1 - (1 - t / e.rise) ** 2);
      else if (t < fall) p.model.root.position.y = e.height + Math.sin(t * 20) * 0.08;
      else p.model.root.position.y = Math.max(0, e.height * (1 - (t - fall) / 0.12));
      // 空中の連撃
      while (n < e.hits && t >= e.rise + n * e.every) {
        const i = n++;
        const a = d.yaw + (i % 2 ? 0.25 : -0.25) * ((i % 4) / 2); // 通常攻撃と同じく前へ突く（少しずつ角度を変える）
        const y = e.height * 0.7;
        p.yaw = d.yaw;
        game.skillFx?.swing({ ...p, yaw: a, pos: { x: p.pos.x, z: p.pos.z } }, i % 3, i % 3 === 2, e.radius, 0.9, i % 2 ? 0xffab91 : 0xffffff); // 槍の突きの軌跡
        for (let k = 0; k < 6; k++) {
          const r = 1 + k * (e.radius / 6);
          game.fx.burst(x0 + Math.sin(a) * r, Math.max(0.4, y - k * 0.6), z0 + Math.cos(a) * r, i % 2 ? 0xffab91 : 0xffe0b2, 2, { speed: 3, up: 0, life: 0.3, size: 0.14, grav: 0 });
        }
        if (i % 2 === 1) game.skillFx?.spin(x0, z0, e.radius, i % 4 === 1 ? 0xffab91 : 0xffffff); // 足元に大きな円の斬撃
        game.sound.se(i % 3 === 2 ? 'crit' : 'swing');
        game.fx.shake(0.12);
        if (local) radiusHit(game, p, e.mult, e.radius, { melee: true, gauge: 0, knock: 0.2, color: 0xffab91 }, x0, z0);
      }
      if (p.didSkill || t < fall + 0.12) return;
      // 着地：叩きつけて大きな衝撃
      p.didSkill = true;
      p.model.root.position.y = 0;
      game.fx.burst(x0, 0.5, z0, 0xffab91, 70, { speed: 12, up: 8, life: 0.9, size: 0.28 });
      game.fx.burst(x0, 0.5, z0, 0xffffff, 30, { speed: 8, up: 10, life: 0.6, size: 0.18 });
      game.skillFx?.slam(x0, z0, e.radius + 1, 0xffab91);
      game.skillFx?.pillar?.(x0, z0, 0xffab91, 2.5);
      game.enemyFx?.impact(x0, z0, e.radius + 1.5, 0xffab91, 'default');
      game.fx.shake(1.1);
      game.sound.se('slam');
      if (local) {
        radiusHit(game, p, e.last, e.radius + 0.5, { melee: true, gauge: 0, knock: 2.5, crit: true, color: 0xffab91 }, x0, z0);
        game.fx.hitstop(0.12);
      }
    };
  },
  // ---- 格闘家 ----
  kiblast(game, p, d, local) {
    const q = JOBS.monk.q;
    p.vmAnim = { kind: 'kiblast', t: 0, dur: 0.4 };
    game.skillFx?.hadouken(p, d.yaw, q.range, q.arc, 0xffcc80); // 両手から気の玉（波動拳）
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
    p.vmAnim = { kind: 'barrage', t: 0, dur: e.dur };
    if (local) p.invuln = Math.max(p.invuln, e.dur + 0.35); // 打っている間は無敵
    let tick = 0;
    let finished = false;
    game.sound.se('roar');
    p.skillTick = (dt) => {
      tick -= dt;
      if (p.actT < e.dur && tick <= 0) {
        tick = e.every;
        const a = p.yaw + (Math.random() - 0.5) * 0.8;
        game.fx.burst(p.pos.x + Math.sin(a) * 1.6, 1.2, p.pos.z + Math.cos(a) * 1.6, 0xffcc80, 3, { speed: 3, up: 1, life: 0.2, grav: 0 });
        game.skillFx?.fistShot(p, a, e.range + 1, 0xffcc80); // 拳の残像
        game.skillFx?.fistShot(p, p.yaw + (Math.random() - 0.5) * 0.6, e.range + 1, 0xffcc80);
        if (local) meleeArc(game, p, p.yaw, e.mult, e.range, 2, { gauge: 0 });
      } else if (p.actT >= e.dur && !finished) {
        finished = true;
        game.fx.shake(0.6);
        game.skillFx?.fistShot(p, p.yaw, e.range + 2, 0xffd740, true); // 最後の大きな一撃
        if (local) meleeArc(game, p, p.yaw, e.finish, e.range + 0.5, 2, { gauge: 0, knock: 3, crit: true });
      }
    };
  },
  // ---- 拳銃使い ----
  deadeye(game, p, d, local) {
    // デッドアイ：構える（撃つのは左クリック。player.js の updateDeadeye → fireDeadeye）
    game.sound.se('windup');
    game.fx.burst(p.pos.x, 1.6, p.pos.z, 0xff1744, 24, { speed: 3, up: 3, life: 0.6 });
    if (local) {
      p.deadeye = { t: 0 };
      p.buff('deadeye', 99); // ほかの人の画面にも構えているのを見せる（撃つと消す）
      game.toastOnce('デッドアイ：左クリックで撃つ（溜めるほど強い）', 1800);
    }
  },
  _deadeyefire(game, p, d, local) {
    // 6連射：撃つたびに一番近いボスへ向け直す。赤い弾が着弾で爆ぜる
    const r = JOBS.gunslinger.r;
    const k = Math.max(0, Math.min(1, d.k || 0));
    const mult = r.minMult + (r.maxMult - r.minMult) * k;
    for (let i = 0; i < r.count; i++) {
      later(p, i * r.every, () => {
        let yaw = p.yaw;
        let best = null;
        let bd = r.range;
        for (const b of game.bosses) {
          if (!b.active || !b.alive || b.hidden) continue;
          const dd = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
          if (dd < bd) { bd = dd; best = b; }
        }
        if (best) yaw = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z);
        p.yaw = yaw;
        p.waveT = 0.15;
        game.skillFx?.muzzle?.(p);
        game.projectiles.playerShot(p, p.pos.x, p.pos.z, yaw, { speed: r.speed, mult, color: r.color, size: r.size * (1 + k * 0.6), range: r.range, pop: true, local, gauge: 0 });
        game.fx.burst(p.pos.x + Math.sin(yaw) * 1.2, 1.4, p.pos.z + Math.cos(yaw) * 1.2, i % 2 ? 0xff1744 : 0xffd740, 10 + Math.round(k * 20), { speed: 6, up: 2, life: 0.3 });
        game.fx.shake(0.15 + k * 0.25);
        game.sound.se(i === r.count - 1 ? 'crit' : 'shoot');
      });
    }
  },
  // ---- 魔剣士 ----
  manablade(game, p, d, local) {
    // 魔刃一閃：魔力を込めた斬撃を飛ばす。魔力付与中は2倍で、紫に強く光る
    const e = JOBS.spellblade.e;
    const boosted = !!p.buffs.enchant;
    startAction(p, 'cast', 0.3);
    p.waveT = 0.4;
    p.vmAnim = { kind: 'iai', t: 0, dur: 0.35 };
    game.projectiles.playerWave(p, d.yaw, { mult: e.mult * (boosted ? e.enchantMul : 1), range: e.range, radius: e.radius, scale: e.scale * (boosted ? 1.35 : 1), color: boosted ? 0xb388ff : e.color, local, melee: false });
    game.fx.burst(p.pos.x + Math.sin(d.yaw) * 1.5, 1.3, p.pos.z + Math.cos(d.yaw) * 1.5, boosted ? 0xb388ff : e.color, boosted ? 40 : 20, { speed: 7, up: 3, life: 0.5 });
    game.sound.se('wave');
    game.fx.shake(boosted ? 0.4 : 0.2);
  },
  arcanewave(game, p, d, local) {
    // 魔剣解放：使える技（d.n 個）を待ち状態にするかわりに、その数だけ強く派手な魔力の刃
    const r = JOBS.spellblade.r;
    const n = Math.max(0, Math.min(3, d.n || 0));
    const col = [0x7c4dff, 0x651fff, 0xd500f9, 0xff4081][n];
    startAction(p, 'cast', 0.25 + r.windup);
    p.waveT = 0.25;
    game.skillFx?.arcaneStart?.(p, { windup: r.windup, color: col }, d.yaw);
    if (local) game.toastOnce(`魔剣解放！ 技を ${n} 個つぎ込んだ`, 1400);
    later(p, r.windup + 0.08, () => {
      game.projectiles.playerWave(p, d.yaw, { mult: r.mults[n], range: r.range, radius: 2.2 + n * 0.5, scale: 2.4 + n * 0.8, color: col, local, melee: false });
      // つぎ込んだ数だけ、左右に見た目だけの刃と光
      for (let i = 1; i <= n; i++) {
        for (const s of [-1, 1]) game.projectiles.playerWave(p, d.yaw + s * 0.12 * i, { mult: 0, range: r.range * 0.8, radius: 0, scale: 1.4 + n * 0.3, color: [0xb388ff, 0xea80fc, 0xffffff][i - 1], local: false });
      }
      game.fx.burst(p.pos.x + Math.sin(d.yaw) * 2, 1.6, p.pos.z + Math.cos(d.yaw) * 2, col, 40 + n * 30, { speed: 8 + n * 2, up: 4, life: 0.7 });
      if (n >= 2) game.bossVfx?.play('flash', { color: col, dur: 0.4 + n * 0.1, peak: 0.2 + n * 0.1 });
      game.fx.shake(0.5 + n * 0.2);
      game.sound.se(n >= 2 ? 'roar' : 'wave');
      game.sound.se('wave');
    });
  },
  // ---- 錬金術師 ----
  corrode(game, p, d, local) {
    const q = JOBS.alchemist.q;
    startAction(p, 'cast', 0.3);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: q.speed, mult: 0.8, color: 0x76ff03, size: 0.4, range: 22, local, gauge: GAUGE.gainSkill,
      onHit: (t) => {
        if (t) game.skillFx?.skullPop(t, 0x76ff03); // 腐食したところにドクロ
        if (t && game.bosses.includes(t)) game.bossCommand({ type: 'debuff', name: 'vuln', dur: q.dur, mul: q.mul, sub: t.sub });
      } });
    game.sound.se('shoot');
  },
  bigflask(game, p, d, local) {
    const e = JOBS.alchemist.r;
    startAction(p, 'cast', 0.4);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: e.speed, mult: e.mult, color: 0xffd740, size: 0.8, range: 22, explode: e.radius, local, // 大爆発フラスコ：黄色く光る巨大な瓶
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
    game.skillFx?.powerUp(p, 0xff1744);
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
        game.skillFx?.spin(p.pos.x, p.pos.z, e.radius, 0xb71c1c);
        if (local) radiusHit(game, p, e.mult, e.radius, { melee: true, gauge: 0, lifesteal: e.lifesteal, color: 0xb71c1c });
      }
    };
  },
  // ---- 時魔導士 ----
  slowfield(game, p, d, local) {
    const q = JOBS.chrono.q;
    startAction(p, 'cast', 0.4);
    game.sound.se('gate');
    for (const b of game.bosses) if (b.alive) { ringFx(game, b.pos.x, b.pos.z, b.radius + 2, 0xb388ff); game.skillFx?.clock(b, q.dur, 'slow'); } // 針がゆっくり回る時計
    if (local) game.bossCommand({ type: 'debuff', name: 'slow', dur: q.dur, mul: q.mul });
  },
  timestop(game, p, d, local) {
    const e = JOBS.chrono.r;
    startAction(p, 'cast', 0.5);
    game.sound.se('gate');
    game.fx.burst(p.pos.x, 2, p.pos.z, 0xb388ff, 50, { speed: 8, up: 4, life: 0.9 });
    game.skillFx?.timeStop(e.dur); // 画面が一瞬モノクロ・止まっている間ボスはモノクロ＋止まった時計
    if (local) game.bossCommand({ type: 'freeze', dur: e.dur, immune: e.immune });
  },
  // ---- 砲術士 ----
  cannon(game, p, d, local) {
    // 大砲（Q）：巨大な砲弾。着弾で爆発
    const e = JOBS.gunner.q;
    startAction(p, 'cast', 0.45);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: e.speed, mult: e.mult, color: 0xff6f00, size: 0.9, range: 34, explode: e.radius, local, gauge: GAUGE.gainSkill });
    game.fx.shake(0.5);
    game.sound.se('slam');
  },
  hanabi(game, p, d, local) {
    // 大花火（R）：花火玉を撃ち、着弾で大爆発。上空に色とりどりの花火が次々に開く（全員の画面で）
    const e = JOBS.gunner.r;
    startAction(p, 'cast', 0.5);
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: e.speed, mult: e.mult, color: 0xff4081, size: 1.1, range: 36, explode: e.radius, local, gauge: 0,
      onEnd: (x, z) => fireworks(game, x, z, e.radius) });
    game.fx.burst(p.pos.x + Math.sin(d.yaw) * 1.5, 1.4, p.pos.z + Math.cos(d.yaw) * 1.5, 0xffd740, 30, { speed: 8, up: 3, life: 0.5 });
    game.fx.shake(0.6);
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
      game.skillFx?.drainWind(p, t, 0xce93d8); // 相手から命を吸い込む紫の風
      if (local) {
        strike(game, p, t, e.mult, { gauge: 0, knock: 0, color: 0xce93d8 });
        game.teamEffect({ kind: 'heal', x: +p.pos.x.toFixed(1), z: +p.pos.z.toFixed(1), r: e.healRadius, amount: e.heal, quiet: true });
      }
    };
  },
  // ---- 処刑人 ----
  soulreap(game, p, d, local) {
    // 魂刈り：大鎌を大きく振りかぶってから（windup）、周りを広く刈る。当たれば必殺ゲージ +30%
    const q = JOBS.reaper.q;
    startAction(p, 'cast', q.windup + 0.45);
    p.vmAnim = { kind: 'iai', t: 0, dur: q.windup + 0.3 }; // 振り上げて溜めてから振る
    p.yaw = d.yaw;
    game.sound.se('windup');
    game.fx.burst(p.pos.x, 2.4, p.pos.z, 0x9e9e9e, 16, { speed: 2, up: 2, life: 0.4 });
    later(p, q.windup, () => {
      p.vmAnim = { kind: 'spinflip', t: 0, dur: 0.4 };
      game.sound.se('spin');
      game.fx.burst(p.pos.x, 1, p.pos.z, 0xb0bec5, 50, { speed: 12, up: 1, life: 0.5, size: 0.16, grav: 2 });
      game.skillFx?.slash(p.pos.x, p.pos.z, d.yaw, q.range, q.arc, 0xb0bec5);
      game.skillFx?.slash(p.pos.x, p.pos.z, d.yaw, q.range * 0.8, q.arc, 0x546e7a, { y: 1.5, dur: 0.4 });
      game.enemyFx?.impact(p.pos.x, p.pos.z, q.range, 0x90a4ae, 'default');
      game.fx.shake(0.5);
      if (local && meleeArc(game, p, d.yaw, q.mult, q.range, q.arc, { gauge: 0, knock: 1.5 }) > 0) p.addGauge(q.gauge / (p.job.gaugeMul || 1)); // 特性の倍率をかけずに +30%
    });
  },
  verdict(game, p, d, local) {
    const e = JOBS.reaper.r;
    startAction(p, 'cast', 0.5);
    p.vmAnim = { kind: 'frenzy', t: 0, dur: 0.45 };
    game.sound.se('roar');
    const t = frontTarget(game, p, e.range, 0.9);
    if (!t) {
      if (local) game.toastOnce('前に敵がいない！', 1000);
      return;
    }
    game.fx.burst(t.pos.x, (t.hpY || 2) * 0.6, t.pos.z, 0x000000, 50, { speed: 7, up: 6, life: 0.8, size: 0.3 });
    game.skillFx?.execute(p, t, 0xb0bec5);
    game.skillFx?.frenzy(p, t, 0xb0bec5); // 左右に高速で斬る軌跡
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
    // シールドバッシュ（盾を構えている間だけ）：前へ突撃し、最初にぶつかった相手で止まる。ボスなら動きと攻撃力を下げる
    const e = JOBS.knight.e;
    startAction(p, 'dash', e.time);
    p.dodgeX = Math.sin(d.yaw);
    p.dodgeZ = Math.cos(d.yaw);
    p.yaw = d.yaw;
    p.dashSpeed = e.dist / e.time;
    game.skillFx?.dash(p, d.yaw, e.dist, e.width, 0x80d8ff);
    game.skillFx?.shieldWall(p, e.time, 0x80d8ff); // 盾を構えて水色の壁ごと突撃
    if (local) p.invuln = Math.max(p.invuln, e.time + 0.1);
    game.sound.se('spin');
    let done = false;
    p.skillTick = () => {
      game.fx.burst(p.pos.x, 1, p.pos.z, 0x80d8ff, 3, { speed: 2, up: 1, life: 0.3 });
      if (done || !local) return;
      forEachTarget(game, (t) => {
        if (done || Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) > t.radius + e.width) return;
        done = true;
        strike(game, p, t, e.mult, { melee: true, gauge: GAUGE.gainSkill, brkMul: e.brkMul, knock: 2, color: 0x80d8ff });
        if (game.bosses.includes(t)) for (const db of e.hitDebuffs) game.bossCommand({ type: 'debuff', ...db, sub: t.sub });
        p.actT = p.actDur; // ぶつかったら止まる
        game.fx.burst(t.pos.x, 1.5, t.pos.z, 0xffffff, 40, { speed: 8, up: 4, life: 0.5 });
        game.fx.shake(0.6);
        game.sound.se('slam');
        game.raid?.sendSkill(p, '_bashhit', { x: +t.pos.x.toFixed(2), z: +t.pos.z.toFixed(2) });
      });
    };
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
    game.skillFx?.dissonance(p, d.yaw, e.range, e.arc); // 歪んだ暗い旋律を飛ばす
    startAction(p, 'cast', 0.3);
    game.sound.se('wave');
    for (let i = 0; i < 16; i++) {
      const a = d.yaw + (Math.random() - 0.5) * e.arc;
      const r = Math.random() * e.range;
      game.fx.burst(p.pos.x + Math.sin(a) * r, 1.2, p.pos.z + Math.cos(a) * r, 0xf48fb1, 2, { speed: 2, up: 1, life: 0.35, grav: 0 });
    }
    if (local) meleeArc(game, p, d.yaw, e.mult, e.range, e.arc, { gauge: GAUGE.gainSkill, brkMul: e.brkMul, knock: 1.5 });
  },
  healspirit(game, p, d, local) {
    // 癒しの精霊：HP の減った味方へ回復の球を飛ばす緑の精霊（ホストが動かす）
    startAction(p, 'cast', 0.35);
    game.sound.se('seal');
    game.fx.burst(d.x, 1, d.z, 0x69f0ae, 24, { speed: 4, up: 4, life: 0.7 });
    game.skillFx?.summon(d.x, d.z, 0x69f0ae);
    if (local) game.bossCommand({ type: 'summon', kind: 'healspirit', x: d.x, z: d.z, owner: p.id });
  },
  spearthrow(game, p, d, local) {
    // 槍投げ：狙った方へ貫通する槍を投げる
    const e = JOBS.lancer.e;
    startAction(p, 'cast', 0.3);
    p.waveT = 0.3;
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: e.speed, mult: e.mult, size: e.size, range: e.range, color: e.color, pierce: true, look: 'javelin', local, gauge: GAUGE.gainSkill });
    game.sound.se('swing');
    game.fx.shake(0.15);
  },
  uppercut(game, p, d, local) {
    const e = JOBS.monk.e;
    startAction(p, 'cast', e.time);
    p.vmAnim = { kind: 'uppercut', t: 0, dur: e.time };
    if (local) p.invuln = Math.max(p.invuln, e.time + 0.1);
    game.sound.se('swing');
    p.skillTick = () => {
      p.model.root.position.y = Math.sin(Math.min(1, p.actT / e.time) * Math.PI) * 2.6;
      if (p.didSkill || p.actT < e.time * 0.3) return;
      p.didSkill = true;
      game.fx.burst(p.pos.x, 1.5, p.pos.z, 0xffcc80, 30, { speed: 4, up: 9, life: 0.6 });
      game.skillFx?.slash(p.pos.x, p.pos.z, p.yaw, e.radius + 0.5, 2.6, 0xffcc80, { roll: Math.PI / 2, dur: 0.35 });
      if (local) radiusHit(game, p, e.mult, e.radius, { melee: true, gauge: GAUGE.gainSkill, knock: 1.5, color: 0xffcc80, brkMul: e.brkMul });
    };
  },
  triflask(game, p, d, local) {
    const e = JOBS.alchemist.e;
    startAction(p, 'cast', 0.3);
    for (let i = 0; i < e.count; i++) {
      const a = d.yaw + (i - (e.count - 1) / 2) * e.spread;
      game.projectiles.playerShot(p, d.x, d.z, a, { speed: e.speed, mult: e.mult, color: 0xff5252, size: 0.32, range: 16, explode: e.radius, local }); // 赤く光る瓶
    }
    game.sound.se('shoot');
  },
  earthsplit(game, p, d, local) {
    const e = JOBS.berserker.e;
    startAction(p, 'cast', e.count * e.every + 0.2);
    p.vmAnim = { kind: 'bigchop', t: 0, dur: 0.4 };
    game.skillFx?.slam(d.x + Math.sin(d.yaw) * 1.4, d.z + Math.cos(d.yaw) * 1.4, 3, 0xa1887f, 0.18); // 振り下ろした地面の地ならし
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
      game.skillFx?.slam(x, z, e.radius, 0x8d6e63);
      game.fx.shake(0.2);
      if (local) radiusHit(game, p, e.mult, e.radius, { melee: true, gauge: GAUGE.gainSkill, color: 0x8d6e63 }, x, z);
    };
  },
  rewind(game, p, d, local) {
    const e = JOBS.chrono.e;
    startAction(p, 'cast', 0.35);
    game.sound.se('gate');
    game.fx.burst(p.pos.x, 1.4, p.pos.z, 0xb388ff, 30, { speed: 3, up: 3, life: 0.7 });
    game.skillFx?.powerUp(p, 0xb388ff);
    if (local) game.skillFx?.rewindScreen(); // 画面の縁に逆回りの時計
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
      game.skillFx?.skullSwarm(o.target, 0x7b1fa2); // 体のまわりをドクロがもやのように飛ぶ
    }
    if (!hit.size) game.toastOnce('呪いのかかった敵がいない（通常攻撃や Q で呪ってから）', 1400);
  },
  scythethrow(game, p, d, local) {
    const e = JOBS.reaper.e;
    startAction(p, 'cast', 0.3);
    const o = { speed: e.speed, mult: e.mult, color: 0xb0bec5, size: e.size, range: e.range, pierce: true, local, gauge: GAUGE.gainSkill }; // 見た目も当たりも大きい鎌
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

/** 大花火の見た目：着弾点の上空に色とりどりの花火が時間差で開く */
const HANABI_COLORS = [0xff1744, 0xffea00, 0x00e5ff, 0x76ff03, 0xd500f9, 0xff9100, 0xffffff];
function fireworks(game, x, z, r) {
  game.skillFx?.explosion?.(x, z, r, 0xff4081, true);
  game.enemyFx?.impact(x, z, r + 1, 0xffd740, 'default');
  game.fx.shake(1);
  for (let i = 0; i < 9; i++) {
    setTimeout(() => {
      const c = HANABI_COLORS[i % HANABI_COLORS.length];
      const a = Math.random() * Math.PI * 2;
      const rr = i === 0 ? 0 : 1 + Math.random() * r;
      const fx = x + Math.sin(a) * rr;
      const fz = z + Math.cos(a) * rr;
      const fy = 5 + Math.random() * 4;
      // 打ち上がる筋と、丸く開く花
      game.fx.burst(fx, 1, fz, c, 6, { speed: 1, up: 14, life: 0.35, size: 0.12, grav: 0 });
      setTimeout(() => {
        game.fx.burst(fx, fy, fz, c, 60, { speed: 9, up: 2, life: 1.1, size: 0.2, grav: 2.5 });
        game.fx.burst(fx, fy, fz, 0xffffff, 16, { speed: 4, up: 1, life: 0.6, size: 0.14, grav: 1 });
        game.sound.se(i % 2 ? 'crit' : 'slam');
      }, 220);
    }, i * 120);
  }
}

/** sec 秒後に fn（他の人の分身でも動く。倒れていたらやめる） */
function later(p, sec, fn) {
  setTimeout(() => { if (p.alive !== false) fn(); }, sec * 1000);
}

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
  if (intent.moveX || intent.moveZ) d.myaw = +Math.atan2(intent.moveX, intent.moveZ).toFixed(3); // 動いている向き（ローリング用）
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
  for (const k of ['q', 'e', 'c', 'r']) if (J[k]?.id === id) return J[k];
  return null;
}

/** 技を実行する。専用の処理（SKILLS）が無ければ、データの kind に応じた汎用処理（GENERIC） */
function run(game, p, id, d, local) {
  const sk = findSkill(p, id);
  if (SKILLS[id]) SKILLS[id](game, p, d, local);
  else if (sk && GENERIC[sk.kind]) GENERIC[sk.kind](game, p, d, local, sk);
  if (sk) game.skillFx?.skillCast?.(p, sk, d); // 技ごとの演出（data/skillvis.js のレシピ）
  if (sk?.after || (sk?.debuffs && sk.kind !== 'debuff')) afterSkill(game, p, d, local, sk);
}

/** 技のあとに足す動き（data/jobs_c.js の after）：回避の移動・無敵・待ち時間短縮・必殺ゲージ・HP を払う・気づかれない */
function afterSkill(game, p, d, local, sk) {
  const a = sk.after || {};
  if (a.dodge) {
    const y = a.dodge === 'back' ? d.yaw + Math.PI : d.myaw ?? d.yaw + Math.PI;
    p.action = 'dodge';
    p.actT = 0;
    p.dodgeX = Math.sin(y);
    p.dodgeZ = Math.cos(y);
  }
  if (!local) return;
  if (a.invuln) p.invuln = Math.max(p.invuln, a.invuln + (a.dodge && p.job.closeFighter ? CLOSE.dodgeInvulnAdd : 0)); // 近接職の回避つきの技は無敵が少し長い
  if (a.cdCut) for (const [k, v] of Object.entries(a.cdCut)) if (p.cd[k] !== undefined) p.cd[k] = Math.max(0, p.cd[k] - v);
  if (a.gauge) p.addGauge(a.gauge);
  if (a.hpCost) p.hp = Math.max(1, p.hp - p.maxHp * a.hpCost);
  if (a.unseen) game.bossCommand({ type: 'unseen', id: p.id, dur: a.unseen });
  if (sk.debuffs && sk.kind !== 'debuff') for (const db of sk.debuffs) game.bossCommand({ type: 'debuff', ...db });
}

function cast(game, p, id, d) {
  const sk = findSkill(p, id);
  // 結界師の転送結界：印が残っていれば（20秒以内）そこへ戻る。無ければ今の場所に印
  if (sk?.kind === 'recall') {
    const m = p.recallMark;
    if (m && performance.now() - m.at < 20000) {
      d.rc = { x: m.x, z: m.z };
      p.recallMark = null;
    } else {
      p.recallMark = { x: d.x, z: d.z, at: performance.now() };
      p.cdOverride = 1; // 印を置いただけなら待ち時間はほぼ無し
    }
  }
  if (sk?.kind === 'heartBoom' && p.swapMark) d.hb = { x: p.swapMark.x, z: p.swapMark.z }; // 双子：場のハート
  // 双子の入れ替わり：前に使った場所と、今回の色（0 青・1 ピンク）を d に入れて、全員で同じ動きにする
  if (sk?.swap) {
    d.sw = p.swapMark || null;
    d.sc = (p.swapN || 0) % 2;
    p.swapMark = { x: d.x, z: d.z };
    p.swapN = (p.swapN || 0) + 1;
  }
  // 格闘家の追撃：直前の技（Q・E・R）が終わる前でなければ出せない
  if (sk?.kind === 'followup') {
    const f = p.chainFrom;
    if (!f || f.left <= 0) {
      game.toastOnce('追撃は Q・E・R の技が終わる前に押す', 1400);
      return false;
    }
    p.chainFrom = null;
    Object.assign(d, { fu: f.id, yaw: f.yaw, x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), fy: +(p.model.root.position.y || 0).toFixed(2) });
  }
  // 魔剣士の魔剣解放：いま使える Q・E・C の数を数え、すべて待ち状態にする（数だけ強くなる）
  if (id === 'arcanewave') {
    let n = 0;
    for (const k of ['q', 'e', 'c']) {
      if (!p.job[k] || p.cd[k] > 0) continue;
      n++;
      p.cd[k] = p.job[k].cd * (p.job.cdMul || 1);
    }
    d.n = n;
  }
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
  // 格闘家：Q・E・R を使ったら、その技が終わるまで（少し猶予つき）追撃を受け付ける
  if (p.job.c?.kind === 'followup' && sk && (sk === p.job.q || sk === p.job.e || sk === p.job.r) && p.job.followups?.[id]) {
    p.chainFrom = { id, yaw: d.yaw, left: (p.actDur || 0.4) + 0.3 }; // left：受け付ける残り秒（ゲームの時間で減る）
  }
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

/** C スキル（3つ目の通常技。クールダウン制） */
export function castC(game, p, intent) {
  const c = p.job.c;
  if (!c) return false;
  const d = skillData(game, p, intent, c.dist || 2);
  if (c.back) {
    // 棒高跳び：狙いと逆（後ろ）へ
    d.tx = 2 * d.x - d.tx;
    d.tz = 2 * d.z - d.tz;
  }
  return cast(game, p, c.id, d);
}

/** R 必殺技（必殺ゲージ） */
export function castR(game, p, intent) {
  const r = p.job.r;
  return cast(game, p, r.id, skillData(game, p, intent, r.dist || 3));
}

/** デッドアイを撃つ（溜めの割合 k）。自分で撃って、ほかの人にも見せる */
export function fireDeadeye(game, p, k) {
  const d = { k: +k.toFixed(3) };
  SKILLS._deadeyefire(game, p, d, true);
  game.raid?.sendSkill(p, '_deadeyefire', d);
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
    // 双子の入れ替わり：前に使った場所（d.sw）があれば、そこまで斬り抜ける。色は青・ピンクで交互（d.sc）
    if (sk.swap) {
      const color = d.sc ? 0xff80ab : 0x64b5f6;
      if (d.sw) {
        const dist = Math.hypot(d.sw.x - d.x, d.sw.z - d.z);
        if (dist > 0.5) {
          dd = { ...d, yaw: Math.atan2(d.sw.x - d.x, d.sw.z - d.z) };
          sk = { ...sk, dist, time: Math.min(0.6, Math.max(0.2, dist / 30)) };
        }
      }
      game.skillFx?.twinSwap?.(p, d, color, sk); // ハートの演出・場にハートを置く
      dashStrike(game, p, dd, local, sk, color, { brkMul: sk.brkMul, knock: sk.knock });
      return;
    }
    if (sk.toBoss && d.bx !== undefined) {
      // 鎖でボスへ飛びつく：ボスの手前まで
      const dist = Math.max(1.5, Math.hypot(d.bx - d.x, d.bz - d.z) - (d.br || 1.5) - 0.8);
      dd = { ...d, yaw: Math.atan2(d.bx - d.x, d.bz - d.z) };
      sk = { ...sk, dist: Math.min(sk.dist, dist) };
      game.skillFx?.grappleFx?.(p, d, sk); // 鎖を飛ばし、斜め上へ飛び上がって鎖を振り下ろす
    }
    dashStrike(game, p, dd, local, sk, sk.color ?? 0xffffff, { brkMul: sk.brkMul, knock: sk.knock });
  },
  burst(game, p, d, local, sk) {
    const ticks = sk.ticks || 1;
    const windup = sk.windup || 0; // 斬り始める前の溜め（燕返し）
    const lastGap = sk.lastGap || 0; // 最後の一撃の前の溜め
    startAction(p, sk.anim || 'spin', windup + (ticks > 1 ? ticks * sk.every + lastGap + 0.15 : 0.45));
    let n = 0;
    let tick = windup;
    game.sound.se('spin');
    game.skillFx?.burstStart(p, sk); // 技ごとの演出（src/skillfx.js）
    p.skillTick = (dt) => {
      tick -= dt;
      if (n >= ticks || tick > 0) return;
      tick = (sk.every || 0.2) + (n === ticks - 2 ? lastGap : 0);
      n++;
      game.fx.burst(p.pos.x, 1, p.pos.z, sk.color, 24, { speed: 8, up: 1.5, life: 0.4, size: 0.15, grav: 2 });
      game.skillFx?.burstTick(p, sk, n, ticks);
      if (local) radiusHit(game, p, sk.mult, sk.radius, { melee: sk.melee !== false, gauge: GAUGE.gainSkill, color: sk.color, brkMul: sk.brkMul, knock: sk.knock ?? 1.2, crit: !!sk.crit }); // crit：必ず会心（燕返し）
      // 爆弾魔の自爆：撃ち終わったら自分の HP が残りわずかになる
      if (local && sk.selfHpTo && n >= ticks) {
        p.hp = Math.min(p.hp, sk.selfHpTo);
        game.fx.burst(p.pos.x, 1, p.pos.z, 0x212121, 30, { speed: 5, up: 5, life: 0.8 });
      }
    };
    if (!local) {
      game.fx.burst(p.pos.x, 1, p.pos.z, sk.color, 24, { speed: 8, up: 1.5, life: 0.4, size: 0.15, grav: 2 });
      if (sk.id === 'wardburst') setTimeout(() => game.skillFx?.wardShatter?.(p, sk), windup * 1000); // 結界の衝撃：張ったバリアが砕ける
      else if (sk.id === 'bigbang') game.skillFx?.bigBang?.(p, sk);
      else if (sk.id === 'holysmite') setTimeout(() => game.skillFx?.smiteHit?.(p, sk), windup * 1000);
      else if (!game.skillFx?.visTicks?.(p, sk, windup)) game.skillFx?.spin(p.pos.x, p.pos.z, sk.radius, sk.color);
    }
  },
  cone(game, p, d, local, sk) {
    startAction(p, 'cast', 0.3);
    game.sound.se(sk.sound || 'swing');
    game.skillFx?.coneFx(p, d.yaw, sk); // 扇の斬撃（居合は縦斬り）
    for (let i = 0; i < 16; i++) {
      const a = d.yaw + (Math.random() - 0.5) * sk.arc;
      const r = Math.random() * sk.range;
      game.fx.burst(p.pos.x + Math.sin(a) * r, 1.1, p.pos.z + Math.cos(a) * r, sk.color, 2, { speed: 2.5, up: 1, life: 0.35, grav: 0 });
    }
    // 盗む：誰かに当たったら、自分の画面に上矢印（盗んだ印）
    if (local && sk.id === 'steal') {
      let got = false;
      forEachTarget(game, (e) => {
        const dx = e.pos.x - p.pos.x;
        const dz = e.pos.z - p.pos.z;
        if (Math.hypot(dx, dz) > sk.range + e.radius) return;
        const da = Math.atan2(Math.sin(Math.atan2(dx, dz) - d.yaw), Math.cos(Math.atan2(dx, dz) - d.yaw));
        if (Math.abs(da) <= sk.arc / 2 + 0.3) got = true;
      });
      if (got) game.skillFx?.stealArrows?.();
    }
    if (local) {
      meleeArc(game, p, d.yaw, sk.mult, sk.range, sk.arc, { melee: sk.melee !== false, gauge: sk.gaugeSelf ?? GAUGE.gainSkill, brkMul: sk.brkMul, knock: sk.knock ?? 1.2, color: sk.color, crit: sk.crit, lifesteal: sk.lifesteal });
      if (sk.dot) forEachTarget(game, (e) => {
        if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) <= sk.range + e.radius) addDot(game, p, e, sk.dot);
      });
    }
  },
  shots(game, p, d, local, sk) {
    const wind = sk.windup || 0; // 魔剣解放：剣を掲げて魔力を溜めてから撃つ
    startAction(p, 'cast', 0.25 + wind);
    p.waveT = 0.25;
    const n = sk.count || 1;
    // aim：一番近いボスへ自動で狙う（拳銃使いの必殺技）
    let yaw = d.yaw;
    if (sk.aim && d.bx !== undefined) yaw = Math.atan2(d.bx - d.x, d.bz - d.z);
    const fire = (i) => {
      const base = sk.follow ? p.yaw : yaw; // follow：撃つたびに今向いている方向へ（ガトリング）
      const a = base + (i - (n - 1) / 2) * (sk.spread || 0) + (sk.jitter ? (Math.random() - 0.5) * sk.jitter : 0);
      game.skillFx?.muzzle?.(p); // 拳銃：銃口が光る
      const o = { pop: sk.pop, speed: sk.speed || 22, mult: sk.mult, color: sk.colors ? sk.colors[i % sk.colors.length] : sk.color, size: sk.size || 0.3, range: sk.range || 24, pierce: sk.pierce, explode: sk.explode, dot: sk.dot, split: sk.split, boomerang: sk.boomerang, local, gauge: sk.gaugeSelf ?? GAUGE.gainSkill, zap: !!sk.chain };
      if (sk.debuff) o.onHit = (t) => { if (t && game.bosses.includes(t)) game.bossCommand({ type: 'debuff', ...sk.debuff, sub: t.sub }); };
      if (sk.chain) o.onHit = chainHit(game, p, sk.chain, sk.color);
      if (sk.orbit) o.orbit = { ...sk.orbit, phase: (i / n) * Math.PI * 2 }; // ジャグリング爆弾：3つが輪になって回る
      // landZone：狙った場所まで飛び、当たるか落ちた所にエリアを広げる（ナパーム）
      if (sk.landZone) {
        o.range = Math.max(4, Math.min(sk.range || 18, Math.hypot(d.tx - d.x, d.tz - d.z) || 8));
        const Z = sk.landZone;
        o.onEnd = (x, z) => {
          game.skillFx?.explosion?.(x, z, Z.radius * 0.6, sk.color, false);
          addZone(game, { kind: 'field', x, z, r: Z.radius, t: Z.dur, every: Z.every, tick: Z.every, mult: Z.mult, color: sk.color, owner: p.id, local, p, skill: sk.id });
        };
      }
      game.projectiles.playerShot(p, p.pos.x, p.pos.z, a, o);
    };
    if (wind) {
      game.skillFx?.arcaneStart?.(p, sk, yaw);
      const go = () => { for (let i = 0; i < n; i++) fire(i); game.sound.se(sk.sound || 'shoot'); };
      if (local) p.pending.push({ t: wind + 0.08, fn: go });
      else setTimeout(go, (wind + 0.08) * 1000); // ほかの人の画面（pending は自分のだけ進む）
    } else if (sk.waves) {
      // ハトの群れ：count 方向へ同時に、waves 回続けて
      const go = () => { for (let i = 0; i < n; i++) fire(i); game.sound.se('shoot'); };
      go();
      for (let w = 1; w < sk.waves; w++) {
        if (local) p.pending.push({ t: w * sk.every, fn: go });
        else setTimeout(go, w * sk.every * 1000);
      }
    } else if (sk.every) {
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
    // rise：翼撃。その場でゆっくり舞い上がってから（rise 秒）、狙った場所へ斜めに急降下する
    const rise = sk.rise || 0;
    p.dashSpeed = rise ? 0 : len / sk.time;
    if (local) p.invuln = Math.max(p.invuln, sk.time + 0.2);
    game.sound.se('dodge');
    game.skillFx?.leapFx?.(p, sk); // 翼撃：竜の翼が生えて2回羽ばたく
    p.skillTick = () => {
      const H = sk.height || 3.5;
      if (rise) {
        const t = p.actT;
        if (t < rise) p.model.root.position.y = H * (1 - (1 - t / rise) ** 2);
        else {
          p.dashSpeed = len / Math.max(0.05, sk.time - rise);
          p.model.root.position.y = H * Math.max(0, 1 - (t - rise) / (sk.time - rise));
        }
      } else p.model.root.position.y = Math.sin(Math.min(1, p.actT / sk.time) * Math.PI) * H;
      if (p.didSkill || p.actT < sk.time * 0.9) return;
      p.didSkill = true;
      p.model.root.position.y = 0;
      game.fx.burst(p.pos.x, 0.5, p.pos.z, sk.color, 45, { speed: 10, up: 6, life: 0.7, size: 0.25 });
      game.skillFx?.slam(p.pos.x, p.pos.z, sk.radius || 2, sk.color);
      game.skillFx?.leapLand?.(p, sk); // 竜の姿なら炎の輪
      game.fx.shake(0.7);
      game.sound.se('slam');
      // 威力の無い跳ぶ技（棒高跳びなど）は着地で攻撃しない（以前は威力が無いまま当たってボスの HP が壊れていた）
      if (local && sk.mult && sk.radius) radiusHit(game, p, sk.mult, sk.radius, { melee: true, gauge: GAUGE.gainSkill, knock: 2, color: sk.color, brkMul: sk.brkMul });
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
    const toss = count > 1 && sk.zone === 'trap'; // 罠の大地：腕を4回振り上げてばらまく（見た目）
    if (toss) p.vmAnim = { kind: 'toss4', t: 0, dur: 1.2 };
    for (let i = 0; i < count; i++) {
      // 複数置くときは輪の形にばらす（罠の大地など）
      const a = (i / count) * Math.PI * 2;
      const off = count > 1 ? sk.scatter || 4 : 0;
      const appear = toss ? 0.15 + Math.floor((i * 4) / count) * 0.28 + 0.4 : 0; // 投げた罠が地面に落ちるまで
      if (toss) game.skillFx?.toss(p, at.x + Math.sin(a) * off, at.z + Math.cos(a) * off, appear - 0.4, sk.color);
      addZone(game, {
        appear,
        kind: sk.zone, x: at.x + Math.sin(a) * off, z: at.z + Math.cos(a) * off, r: sk.radius, t: sk.dur + i * (sk.stagger || 0), delay: sk.delay, // stagger：次々に落ちる（流星群）
        hits: sk.hits || 1, hitGap: sk.hitGap || 0.1, // hits：同じ場所に何回当たるか（流れ星）
        every: sk.every, tick: sk.every || 0, mult: (sk.mult || 0) * (sk.zone === 'trap' ? p.job.trapBonus || 1 : 1), color: sk.color,
        trigger: sk.trigger, buff: sk.buff, debuff: sk.debuff, heal: sk.heal, owner: p.id, local, p,
        range: sk.range, explode: sk.explode, endBurst: sk.endBurst, skill: sk.id,
      });
    }
  },
  teambuff(game, p, d, local, sk) {
    startAction(p, 'cast', 0.4);
    game.sound.se('seal');
    ringFx(game, d.x, d.z, sk.radius || 3, sk.color);
    game.skillFx?.teamBuffFx(p, sk); // 技ごとの演出（情熱のサンバ：踊って音符のオーラ）
    if (local) game.teamEffect({ kind: 'buff', name: sk.buff, dur: sk.dur, vals: sk.vals, x: d.x, z: d.z, r: sk.radius || 0, msg: sk.msg });
  },
  selfbuff(game, p, d, local, sk) {
    startAction(p, 'cast', 0.35);
    game.sound.se(sk.sound || 'seal');
    game.fx.burst(p.pos.x, 1.4, p.pos.z, sk.color, 36, { speed: 5, up: 4, life: 0.7 });
    if (!game.skillFx?.selfBuffFx?.(p, sk)) game.skillFx?.powerUp(p, sk.color); // 煙玉は地面へ叩きつけて煙
    // 竜化：空から雷が降って周りを打つ（雷の光の中で竜に変わる）
    // ローリング：ふつうの回避と同じように転がって動く（動いていなければ後ろへ）
    if (sk.move) {
      const y = d.myaw ?? p.yaw + Math.PI;
      p.rollMul = sk.moveMul || 1; // ローリング：回避より遠くへ
      p.action = 'dodge';
      p.actT = 0;
      p.dodgeX = Math.sin(y);
      p.dodgeZ = Math.cos(y);
    }
    if (sk.unseen && local) game.bossCommand({ type: 'unseen', id: p.id, dur: sk.unseen }); // ポルターガイスト：敵に気づかれない
    if (sk.strike && local) radiusHit(game, p, sk.strike.mult, sk.strike.radius, { gauge: GAUGE.gainSkill, knock: 1.5, color: 0xfff176 });
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
    game.skillFx?.teamHealFx?.(p, sk); // くす玉：赤十字の緑の帯が広がる
    if (local) game.teamEffect({ kind: 'heal', x: d.x, z: d.z, r: sk.radius, amount: sk.amount, ...(sk.selfMul !== undefined ? { from: p.id, selfMul: sk.selfMul } : {}) });
  },
  teamgauge(game, p, d, local, sk) {
    startAction(p, 'cast', 0.4);
    game.sound.se('seal');
    game.fx.burst(p.pos.x, 2, p.pos.z, sk.color, 50, { speed: 7, up: 5, life: 0.9 });
    if (!game.skillFx?.teamGaugeFx?.(p, sk)) game.skillFx?.powerUp(p, sk.color, true); // 大盤振る舞いはコインをばらまく
    if (local) {
      game.teamEffect({ kind: 'gauge', amount: sk.amount, x: d.x, z: d.z, r: sk.radius || 0, from: p.id });
      if (sk.self) p.addGauge(sk.self);
    }
  },
  debuff(game, p, d, local, sk) {
    startAction(p, 'cast', 0.4);
    game.sound.se('gate');
    for (const b of game.bosses) {
      if (!b.alive) continue;
      ringFx(game, b.pos.x, b.pos.z, b.radius + 2, sk.color);
      if (sk.id === 'chainbind') game.skillFx?.chainBind?.(p, b, sk.debuffs[0]?.dur || 5); // 鎖を飛ばして体に巻きつける
      else game.skillFx?.curse(b, sk.color);
    }
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
        game.skillFx?.beam(p.pos.x, p.pos.z, a, sk.len, sk.width, sk.color);
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
    game.skillFx?.powerUp(p, sk.color, true);
    if (local) game.teamEffect({ kind: 'cdreset' });
  },
  reviveall(game, p, d, local, sk) {
    // 献身者：自分の HP を 1 にして、倒れた仲間を全員起こす
    startAction(p, 'cast', 0.6);
    game.sound.se('seal');
    game.fx.burst(p.pos.x, 1.5, p.pos.z, sk.color, 60, { speed: 7, up: 6, life: 1 });
    game.skillFx?.pillar(p.pos.x, p.pos.z, sk.color, 3);
    if (local) {
      p.hp = 1;
      game.teamEffect({ kind: 'reviveall', hp: sk.hp });
    }
  },
  absorb(game, p, d, local, sk) {
    // 吸収術士：周りの敵弾を吸い込み、1発ごとに必殺ゲージと HP に変える
    startAction(p, 'cast', 0.35);
    game.sound.se('seal');
    const n = game.eraser.erase(p.pos.x, p.pos.z, sk.radius);
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
    const n = game.eraser.erase(p.pos.x, p.pos.z, sk.radius);
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
      game.skillFx?.beam(p.pos.x, p.pos.z, Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z), Math.hypot(best.pos.x - p.pos.x, best.pos.z - p.pos.z), 0.9, sk.color);
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
    const n = game.eraser.erase(p.pos.x, p.pos.z, sk.radius);
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
    // ものまね保存：さっき借りた技をもう一度
    // ものまね変身中（R）：コピーしたボスの技を撃つ
    if (d.cm === undefined && local && p.buffs.copyboss) {
      const list = copyMoves(p.buffs.copyboss.key);
      if (list.length) {
        d.ck = p.buffs.copyboss.key;
        d.cm = list[Math.floor(Math.random() * list.length)];
      }
    }
    if (d.cm !== undefined) {
      useCopiedMove(game, p, d, local);
      return;
    }
    if (d.mimic === undefined && local && p.buffs.mimickeep && p.lastMimic) {
      d.mimic = p.lastMimic;
      delete p.buffs.mimickeep;
    }
    if (d.mimic === undefined) {
      const pool = JOB_ORDER.filter((j) => j !== p.jobId && JOBS[j].q.kind !== 'mimic');
      d.mimic = pool[Math.floor(Math.random() * pool.length)];
    }
    const src = JOBS[d.mimic];
    if (!src) return;
    p.lastMimic = d.mimic;
    game.toastOnce(`ものまね：${src.name}の「${src.q.name}」`, 1400);
    if (SKILLS[src.q.id]) SKILLS[src.q.id](game, p, d, local);
    else if (GENERIC[src.q.kind]) GENERIC[src.q.kind](game, p, d, local, src.q);
  },
  recoil(game, p, d, local, sk) {
    // 反動跳び：前へ砲弾を撃ち、反動で後ろへ大きく跳ぶ（跳ぶ間は無敵）
    game.projectiles.playerShot(p, d.x, d.z, d.yaw, { speed: sk.speed, mult: sk.mult, color: sk.color, size: sk.size, range: 28, explode: sk.explode, local, gauge: GAUGE.gainSkill });
    game.fx.burst(p.pos.x + Math.sin(d.yaw) * 1.4, 1.3, p.pos.z + Math.cos(d.yaw) * 1.4, sk.color, 30, { speed: 8, up: 3, life: 0.4 });
    game.fx.shake(0.4);
    game.sound.se('slam');
    const back = d.yaw + Math.PI;
    startAction(p, 'dash', sk.time);
    p.dodgeX = Math.sin(back);
    p.dodgeZ = Math.cos(back);
    p.yaw = d.yaw; // 前を向いたまま後ろへ飛ぶ
    p.dashSpeed = sk.dist / sk.time;
    if (local) p.invuln = Math.max(p.invuln, sk.time + 0.15);
    p.skillTick = () => {
      p.model.root.position.y = Math.sin(Math.min(1, p.actT / sk.time) * Math.PI) * sk.height;
      if (p.actT >= sk.time - 0.02) p.model.root.position.y = 0;
    };
  },
  followup(game, p, d, local, sk) {
    // 格闘家の追撃：d.fu（直前の技）ごとに派生
    const F = p.job.followups?.[d.fu];
    if (!F) return;
    const col = 0xffab40;
    game.toastOnce(F.name, 1000);
    if (d.fu === 'kiblast') {
      // 気功突進：気の玉と同じ速さで前へ突っ込み（無敵）、着弾点（前にいる敵の手前か、射程の端）で一撃。着いてから0.5秒も無敵
      const range = p.job.q.range;
      let dist = range;
      forEachTarget(game, (e) => {
        const dx = e.pos.x - d.x;
        const dz = e.pos.z - d.z;
        const along = dx * Math.sin(d.yaw) + dz * Math.cos(d.yaw);
        const side = Math.abs(dx * Math.cos(d.yaw) - dz * Math.sin(d.yaw));
        if (along > 0 && side < e.radius + 1 && along - e.radius - 1 < dist) dist = Math.max(0.5, along - e.radius - 1);
      });
      const t = Math.max(0.08, (dist / (range + 0.5)) * 0.42); // 気の玉は 0.42 秒で射程の端まで飛ぶ
      startAction(p, 'dash', t);
      p.dodgeX = Math.sin(d.yaw);
      p.dodgeZ = Math.cos(d.yaw);
      p.yaw = d.yaw;
      p.dashSpeed = dist / t;
      if (local) p.invuln = Math.max(p.invuln, t + F.after);
      game.skillFx?.dash(p, d.yaw, dist, 1.4, col);
      game.skillFx?.hadouken(p, d.yaw, dist, 0.6, col);
      game.sound.se('spin');
      const arrive = () => {
        p.vmAnim = { kind: 'kiblast', t: 0, dur: 0.35 };
        const x = p.pos.x + Math.sin(d.yaw) * 1.2;
        const z = p.pos.z + Math.cos(d.yaw) * 1.2;
        game.fx.burst(x, 1.2, z, col, 40, { speed: 9, up: 4, life: 0.5 });
        game.enemyFx?.impact(x, z, F.radius, col, 'default');
        game.fx.shake(0.6);
        game.sound.se('slam');
        if (local) {
          radiusHit(game, p, F.mult, F.radius, { melee: true, gauge: GAUGE.gainSkill, knock: 2, color: col }, x, z);
          p.invuln = Math.max(p.invuln, F.after);
        }
      };
      // 自分は突進の最後のフレームで（ゲームの時間で）、ほかの人の分身は時計で
      if (local) {
        let done = false;
        p.skillTick = () => {
          if (done || p.actT < p.actDur - 1e-4) return;
          done = true;
          arrive();
        };
      } else later(p, t, arrive);
    } else if (d.fu === 'uppercut') {
      // かかと落とし：空中から前へ振り下ろす。ブレイク値が溜まりやすい。出している間と着地後0.5秒は無敵
      startAction(p, 'cast', F.time + 0.1);
      p.vmAnim = { kind: 'bigchop', t: 0, dur: F.time + 0.1 };
      const y0 = Math.max(1.2, d.fy || 0);
      if (local) p.invuln = Math.max(p.invuln, F.time + F.after + 0.1);
      game.sound.se('swing');
      p.skillTick = (dt = 1 / 60) => {
        const k = Math.min(1, p.actT / F.time);
        // 少し上がってから一気に落ちる
        p.model.root.position.y = k < 0.35 ? y0 + 0.8 * Math.sin((k / 0.35) * Math.PI / 2) : (y0 + 0.8) * (1 - (k - 0.35) / 0.65);
        if (local && k < 1) {
          p.pos.x += Math.sin(d.yaw) * (F.dist / F.time) * dt;
          p.pos.z += Math.cos(d.yaw) * (F.dist / F.time) * dt;
          game.world.collide(p.pos, p.radius);
        }
        if (p.didSkill || k < 1) return;
        p.didSkill = true;
        p.model.root.position.y = 0;
        const x = p.pos.x + Math.sin(d.yaw) * 1.2;
        const z = p.pos.z + Math.cos(d.yaw) * 1.2;
        game.fx.burst(x, 0.4, z, col, 50, { speed: 10, up: 6, life: 0.7, size: 0.24 });
        game.skillFx?.slam(x, z, F.radius, col);
        game.enemyFx?.impact(x, z, F.radius + 0.5, col, 'default');
        game.fx.shake(0.9);
        game.sound.se('slam');
        if (local) {
          radiusHit(game, p, F.mult, F.radius, { melee: true, gauge: GAUGE.gainSkill, knock: 1, brkMul: F.brkMul, color: col }, x, z);
          p.invuln = Math.max(p.invuln, F.after);
        }
      };
    } else if (d.fu === 'barrage') {
      // 気功波三連：大きく強い気の玉を3連発（派手に）
      startAction(p, 'cast', F.every * F.count + 0.2);
      for (let i = 0; i < F.count; i++) {
        later(p, i * F.every, () => {
          p.vmAnim = { kind: 'kiblast', t: 0, dur: 0.3 };
          const yaw = d.yaw;
          game.skillFx?.hadouken(p, yaw, 9, 0.8, i === F.count - 1 ? 0xffd740 : col);
          game.projectiles.playerShot(p, p.pos.x, p.pos.z, yaw, { speed: F.speed, mult: F.mult, size: F.size * (i === F.count - 1 ? 1.3 : 1), range: F.range, explode: F.explode, color: i === F.count - 1 ? 0xffd740 : col, local, gauge: 0 });
          game.fx.burst(p.pos.x + Math.sin(yaw) * 1.5, 1.3, p.pos.z + Math.cos(yaw) * 1.5, col, 30, { speed: 7, up: 3, life: 0.5 });
          game.fx.shake(0.35);
          game.sound.se('wave');
        });
      }
    }
  },
  copyboss(game, p, d, local, sk) {
    // ものまね師の必殺技：一番近いボスをコピー。dur 秒間 Q・E がそのボスの技になり、すぐに1つ撃つ
    if (d.ck === undefined) {
      const b = nearestBoss(game, d.x, d.z);
      if (b) {
        d.ck = b.key;
        const list = copyMoves(b.key);
        d.cm = list[Math.floor(Math.random() * list.length)];
      }
    }
    if (!d.ck) {
      game.toastOnce('コピーできるボスがいない', 1400);
      return;
    }
    p.buff('copyboss', sk.dur, { key: d.ck });
    game.fx.burst(p.pos.x, 1.6, p.pos.z, sk.color, 50, { speed: 6, up: 5, life: 0.9 });
    game.skillFx?.powerUp(p, sk.color, true);
    game.sound.se('gate');
    if (local) {
      game.toast(`ものまね変身！ ${sk.dur}秒間 Q・E がボスの技になる`, 2200);
      p.cd.q = 0;
      p.cd.e = 0;
    }
    if (d.cm) useCopiedMove(game, p, d, local);
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
    game.skillFx?.blink(d.x, d.z, d.tx, d.tz, sk.color);
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
    game.skillFx?.blink(d.x, d.z, d.bx ?? d.tx, d.bz ?? d.tz, 0x7e57c2);
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
    game.skillFx?.curse(best, 0xff1744);
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
    game.skillFx?.counterFx(p, sk); // 見切り：刀を鞘に納めて構える
    if (local) p.buff('counter', sk.dur, { mult: sk.mult, range: sk.range });
  },
  random(game, p, d, local, sk) {
    // 道化師：候補のうち1つ（何が出たかは d.pick で他の人にも同じものを見せる）
    if (d.pick === undefined) d.pick = Math.floor(Math.random() * sk.pool.length);
    // ギャンブラーのダブルアップ：次の効果を2回（ハズレも）
    if (local && d.double === undefined && p.buffs.doubleup && (sk.id === 'dice' || sk.id === 'cardtrick')) {
      d.double = true;
      delete p.buffs.doubleup;
    }
    const one = sk.pool[d.pick];
    game.toastOnce(`${sk.name}：${one.name}！${d.double ? '（ダブルアップで2倍）' : ''}`, 1400);
    if (sk.id === 'card') game.skillFx?.cardFx?.(p, one); // 星のカード：出たマークを画面に散らす
    game.skillFx?.randomFx?.(p, sk, one); // 手品：帽子から取り出す／大道芸：両手を上げて紙吹雪
    GENERIC[one.kind](game, p, d, local, one);
    if (d.double) GENERIC[one.kind](game, p, d, local, one);
  },
  // ---------------- C キーの技（data/jobs_c.js）で使う汎用処理 ----------------
  recall(game, p, d, local, sk) {
    // 結界師の転送結界：1回目で印を置き、2回目（20秒以内）でそこへ戻る。d.rc：戻り先
    startAction(p, 'cast', 0.25);
    game.sound.se('gate');
    if (d.rc) {
      game.skillFx?.blink(d.x, d.z, d.rc.x, d.rc.z, sk.color);
      if (local) {
        p.pos.x = d.rc.x;
        p.pos.z = d.rc.z;
        game.world.collide(p.pos, p.radius);
        p.invuln = Math.max(p.invuln, 0.4);
      }
    } else ringFx(game, d.x, d.z, 2.5, sk.color);
  },
  moveZones(game, p, d, local, sk) {
    // 祈祷師・機工士：置いたものを足元へ / 予言者：予言の一撃をボスの足元へ
    startAction(p, 'cast', 0.3);
    game.sound.se('seal');
    const to = sk.to === 'boss' && d.bx !== undefined ? { x: d.bx, z: d.bz } : { x: d.x, z: d.z };
    let n = 0;
    for (const z of zones) {
      if (z.kind !== sk.zoneKind || z.owner !== p.id) continue;
      game.fx.burst(z.x, 1, z.z, sk.color, 12, { speed: 3, up: 2, life: 0.4 });
      z.x = to.x + (n % 3 - 1) * 1.2;
      z.z = to.z + (Math.floor(n / 3) - 0.5) * 1.2;
      if (z.mesh) z.mesh.position.set(z.x, z.mesh.position.y, z.z);
      game.fx.burst(z.x, 1, z.z, sk.color, 12, { speed: 3, up: 2, life: 0.4 });
      n++;
    }
    if (local && !n) game.toastOnce('動かせるものが置かれていない', 1000);
  },
  dropZone(game, p, d, local, sk) {
    // 陰陽師の札返し：一番古い札を1枚回収
    startAction(p, 'cast', 0.25);
    const i = zones.findIndex((z) => z.kind === sk.zoneKind && z.owner === p.id);
    if (i >= 0) {
      game.fx.burst(zones[i].x, 1.2, zones[i].z, sk.color, 14, { speed: 3, up: 2, life: 0.4 });
      removeZone(i);
    } else if (local) game.toastOnce('回収できる札が無い', 1000);
  },
  detonate(game, p, d, local, sk) {
    // 吸着爆弾魔の一斉起爆：貼った爆弾を今すぐ爆発（時間切れの処理で爆発する）
    startAction(p, 'cast', 0.2);
    let n = 0;
    for (const z of zones) if (z.kind === sk.zoneKind && z.owner === p.id) { z.t = Math.min(z.t, 0.01); n++; }
    if (local && !n) game.toastOnce('貼った爆弾が無い', 1000);
  },
  bloom(game, p, d, local, sk) {
    // 庭師の水やり：自分の花をすぐに咲かせる（時間切れで咲く）
    startAction(p, 'cast', 0.3);
    let n = 0;
    for (const z of zones) if (z.owner === p.id && z.endBurst) { z.t = Math.min(z.t, 0.01); n++; }
    if (local && !n) game.toastOnce('咲かせる花が無い', 1000);
  },
  heartBoom(game, p, d, local, sk) {
    // 双子のハート爆破：場に置いたハートの所で爆発（d.hb：ハートの場所）
    startAction(p, 'cast', 0.25);
    if (!d.hb) {
      if (local) game.toastOnce('場にハートが無い（入れ替わりで置ける）', 1200);
      return;
    }
    game.skillFx?.explosion?.(d.hb.x, d.hb.z, sk.radius, sk.color, true);
    if (local) radiusHit(game, p, sk.mult, sk.radius, { gauge: GAUGE.gainSkill, color: sk.color, knock: 1.5, melee: false }, d.hb.x, d.hb.z);
  },
  firewall(game, p, d, local, sk) {
    // 火炎放射兵の炎の壁：前に横長の炎（小さなエリアを横に並べる）
    startAction(p, 'cast', 0.35);
    game.sound.se('seal');
    const n = 5;
    for (let i = 0; i < n; i++) {
      const side = (i - (n - 1) / 2) * (sk.width / (n - 1));
      const x = d.x + Math.sin(d.yaw) * sk.dist - Math.cos(d.yaw) * side;
      const z = d.z + Math.cos(d.yaw) * sk.dist + Math.sin(d.yaw) * side;
      addZone(game, { kind: 'field', x, z, r: 1.4, t: sk.dur, every: sk.every, tick: sk.every, mult: sk.mult, color: sk.color, owner: p.id, local, p, skill: 'napalm' });
    }
  },
  reviveShot(game, p, d, local, sk) {
    // 衛生兵の蘇生ショット：一番近い倒れた仲間を起こす
    startAction(p, 'cast', 0.3);
    if (!local) return;
    let best = null;
    let bd = sk.range;
    for (const o of game.players) {
      if (o === p || !o.downed) continue;
      const dd = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
      if (dd < bd) { bd = dd; best = o; }
    }
    if (!best) {
      game.toastOnce('近くに倒れた仲間がいない', 1200);
      p.cdOverride = 1; // 外したときは待ち時間をほぼかけない
      return;
    }
    game.skillFx?.beam(p.pos.x, p.pos.z, Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z), bd, 0.5, sk.color);
    game.teamEffect({ kind: 'revive', id: best.id });
    game.toast(`${best.name || '仲間'}を蘇生ショットで起こした！`, 1600);
  },
  shiftHold(game, p, d, local, sk) {
    // 変化師：今の職業を延ばす
    startAction(p, 'cast', 0.3);
    if (local && p.shift) {
      p.shift.t += sk.add;
      game.toastOnce(`変化を ${sk.add} 秒 延ばした（あと ${Math.ceil(p.shift.t)} 秒）`, 1400);
    }
  },
  cycleSkip(game, p, d, local, sk) {
    // 精霊術士：次の属性を1つ飛ばす
    startAction(p, 'cast', 0.25);
    const pool = p.job.q.pool || [];
    if (local && pool.length) {
      p.cycleIdx = ((p.cycleIdx ?? -1) + 1) % pool.length;
      game.toastOnce(`次の属性：${pool[(p.cycleIdx + 1) % pool.length].name}`, 1200);
    }
  },
};

/** 雷の連鎖：当たった相手の近くの別の敵にも 60% で飛ぶ */
function chainHit(game, p, ch, color) {
  return (t) => {
    if (!t) return;
    forEachTarget(game, (e) => {
      if (e === t || Math.hypot(e.pos.x - t.pos.x, e.pos.z - t.pos.z) > ch.range) return;
      strike(game, p, e, ch.mult, { gauge: 1, knock: 0, color });
    });
  };
}

/** 通常攻撃（飛び道具） */
export function basicShot(game, p, yaw) {
  const b = p.job.basic;
  const d = { x: p.pos.x, z: p.pos.z, yaw, still: p.still > 0.3 };
  // 双子：場に出ているハートじゃない方の色（ハートが無ければ青）。tc：1 ならピンク
  if (p.job.e?.swap) d.tc = (p.swapN || 0) % 2;
  shoot(game, p, d, true);
  game.raid?.sendSkill(p, '_shot', d);
}
function shoot(game, p, d, local) {
  const b = p.job.basic;
  const mult = b.mult * (d.still && p.job.stillBonus ? p.job.stillBonus : 1);
  // 双子：通常攻撃が2発（count・spread）
  const n = b.count || 1;
  const o = { ...b, mult, local, gauge: p.job.basicGauge, basic: true }; // 通常攻撃：ゲージは職業ごとの basicGauge
  if (d.tc !== undefined) o.color = d.tc ? 0xff80ab : 0x64b5f6; // 双子の弾の色（入れ替わりのハートと逆）
  if (b.debuff) o.onHit = (t) => { if (t && game.bosses.includes(t)) game.bossCommand({ type: 'debuff', ...b.debuff, sub: t.sub }); };
  game.skillFx?.muzzle?.(p); // 拳銃：銃口が光る
  for (let i = 0; i < n; i++) {
    const jit = b.jitter ? (Math.random() - 0.5) * b.jitter : 0; // マシンガン：少しばらける
    game.projectiles.playerShot(p, d.x, d.z, d.yaw + (i - (n - 1) / 2) * (b.spread || 0) + jit, o);
  }
  game.sound.se('shoot');
}
SKILLS._bashhit = (game, p, d) => {
  game.fx.burst(d.x, 1.5, d.z, 0xffffff, 40, { speed: 8, up: 4, life: 0.5 });
  game.sound.se('slam');
};
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
  game.skillFx?.dash(p, d.yaw, q.dist, q.width || 1.4, color); // 技エフェクト（src/skillfx.js）
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
    z.mesh.scale.setScalar(1.4);
    // 感知範囲の輪（ここにボスが入ると爆発）
    geoCache.mineRing ||= new THREE.RingGeometry(0.93, 1, 40).rotateX(-Math.PI / 2);
    z.ringMat = new THREE.MeshBasicMaterial({ color: 0xff6f00, transparent: true, opacity: 0.35, depthWrite: false });
    const ring = new THREE.Mesh(geoCache.mineRing, z.ringMat);
    ring.scale.setScalar(z.trigger / 1.4);
    ring.position.y = -0.06;
    z.mesh.add(ring);
  } else if (z.kind === 'aegis') {
    game.eraser?.erase(z.x, z.z, z.r); // 張った瞬間、中にある敵の攻撃を消す（src/erase.js）
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
  z.removed = true;
  z.aura?.remove();
  zoneGroup.remove(z.mesh);
  z.mat.dispose();
  z.ringMat?.dispose();
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
        game.skillFx?.slam(z.x, z.z, z.r, 0xff7043);
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
        // 雷嵐：中にいる敵の足元から小さな雷がはじける（見た目だけ。全員の画面で）
        if (z.skill === 'tempest') forEachTarget(game, (e) => {
          if (Math.hypot(e.pos.x - z.x, e.pos.z - z.z) <= z.r + (e.radius || 0)) game.skillFx?.groundZap?.(e.pos.x, e.pos.z, z.color);
        });
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
        game.skillFx?.strikeHit?.(z); // 落雷：空から本物の稲妻
        game.skillFx?.slam(z.x, z.z, z.r, z.color);
        game.fx.shake(0.6);
        game.sound.se('slam');
        if (z.local) radiusHit(game, z.p, z.mult, z.r, { color: z.color, knock: 1.5, gauge: GAUGE.gainSkill }, z.x, z.z);
        if (--z.hits > 0) z.t = z.hitGap; // まだ落ちてくる（流れ星は3つ）
        else removeZone(i);
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
    game.skillFx?.slam(z.x, z.z, z.r, z.color);
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
