// ボス「魔窟の主ガルドラ」：薙ぎ払い／魔弾の輪／跳躍叩きつけ。HP 50% で怒り（速く・連携・手下召喚）
import { BOSS } from './data/enemies.js';
import { makeBossModel } from './models.js';
import { angleDiff, lerpAngle, yawTo, rand } from './util.js';
import { hurtPlayer, nearestPlayer } from './combat.js';
import { HIT } from './data/player.js';

export function createBoss(game, x, z) {
  const m = makeBossModel(BOSS.color);
  m.group.position.set(x, 0, z);
  m.group.rotation.y = 0;
  game.scene.add(m.group);
  const P = BOSS.patterns;

  const b = {
    model: m,
    pos: m.group.position,
    radius: BOSS.radius,
    defense: BOSS.def,
    hpY: BOSS.hpY,
    hp: BOSS.hp,
    maxHp: BOSS.hp,
    alive: true,
    active: false, // 戦闘開始まで false（攻撃も当たらない）
    raged: false,
    state: 'sleep',
    t: 0,
    yaw: 0,
    pattern: null,
    tele: null,
    jump: null,
    flash: 0,
    summonT: 0,
    lastPattern: '',
    takeHit(g, dmg) {
      if (b.state === 'rage') dmg = 0; // 怒りの咆哮中は無敵
      b.hp = Math.max(0, b.hp - dmg);
      b.flash = 0.1;
      if (b.hp <= 0 && b.alive) die();
      else if (!b.raged && b.hp <= BOSS.hp * BOSS.rage.at) enrage();
    },
    /** 戦闘開始（ボス部屋に入った） */
    wake() {
      if (b.active) return;
      b.active = true;
      b.state = 'intro';
      b.t = 0;
      game.sound.se('roar');
      game.fx.shake(0.8);
    },
    update,
    dispose() {
      if (b.tele) b.tele.end();
      game.scene.remove(m.group);
      m.bodyMat.dispose();
    },
  };

  const wm = () => (b.raged ? BOSS.rage.windupMul : 1);
  const sm = () => (b.raged ? BOSS.rage.speedMul : 1);

  function enrage() {
    b.raged = true;
    if (b.tele) b.tele.end();
    b.tele = null;
    b.jump = null;
    b.pos.y = 0;
    b.state = 'rage';
    b.t = 0;
    b.summonT = 3;
    game.sound.se('roar');
    game.fx.shake(1);
    game.toast(`${BOSS.name}が怒り狂った！ 攻撃が激しくなる！`, 3000);
  }

  function die() {
    b.alive = false;
    b.state = 'dead';
    b.t = 0;
    if (b.tele) b.tele.end();
    b.tele = null;
    b.pos.y = 0;
    game.sound.se('roar');
    game.fx.shake(1.2);
  }

  function choose(tgt) {
    const d = Math.hypot(tgt.pos.x - b.pos.x, tgt.pos.z - b.pos.z);
    let pick;
    if (d < P.sweep.range + 1) pick = Math.random() < 0.6 ? 'sweep' : Math.random() < 0.5 ? 'slam' : 'ring';
    else pick = Math.random() < 0.5 ? 'ring' : 'slam';
    if (pick === b.lastPattern && Math.random() < 0.6) pick = pick === 'ring' ? 'slam' : 'ring';
    b.lastPattern = pick;
    return pick;
  }

  function startPattern(name, tgt) {
    b.pattern = name;
    b.state = 'windup';
    b.t = 0;
    b.yaw = yawTo(b.pos.x, b.pos.z, tgt.pos.x, tgt.pos.z);
    const p = P[name];
    game.sound.se('windup');
    if (name === 'sweep') {
      b.tele = game.fx.telegraph('sector', { x: b.pos.x, z: b.pos.z, r: p.range + 0.5, arc: p.arc, angle: b.yaw, dur: p.windup * wm() });
    } else if (name === 'slam') {
      b.jump = { sx: b.pos.x, sz: b.pos.z, tx: tgt.pos.x, tz: tgt.pos.z };
      b.tele = game.fx.telegraph('circle', { x: tgt.pos.x, z: tgt.pos.z, r: p.radius, dur: (p.windup + p.air) * wm() });
    } else {
      b.tele = game.fx.telegraph('circle', { x: b.pos.x, z: b.pos.z, r: 3, dur: p.windup * wm() });
    }
  }

  function ring(cx, cz, count, offset) {
    const p = P.ring;
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2;
      game.projectiles.enemyShot(cx + Math.sin(a) * 2, cz + Math.cos(a) * 2, a, p.speed * (b.raged ? p.rageSpeedMul : 1), HIT.boss, p.color);
    }
    game.sound.se('shoot');
  }

  function execute(tgt) {
    const name = b.pattern;
    const p = P[name];
    if (name === 'sweep') {
      for (const pl of game.players) {
        const d = Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z);
        const ang = Math.abs(angleDiff(b.yaw, yawTo(b.pos.x, b.pos.z, pl.pos.x, pl.pos.z)));
        if (d < p.range + 0.5 + pl.radius && (ang < p.arc / 2 || d < b.radius + 0.5)) hurtPlayer(game, pl, HIT.boss, b.pos.x, b.pos.z);
      }
      game.fx.shake(0.4);
      game.sound.se('swing');
      for (let i = -3; i <= 3; i++) {
        const a = b.yaw + (i / 3) * (p.arc / 2);
        game.fx.burst(b.pos.x + Math.sin(a) * p.range * 0.8, 0.6, b.pos.z + Math.cos(a) * p.range * 0.8, 0xffcc80, 3, { speed: 3, life: 0.4 });
      }
      b.state = 'act';
      b.t = 0;
    } else if (name === 'ring') {
      ring(b.pos.x, b.pos.z, p.count, rand(0, 1));
      if (b.raged) b.pending = p.secondWave; // 時間差でもう1波
      b.state = 'act';
      b.t = 0;
    }
  }

  function update(dt) {
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    const tgt = nearestPlayer(game, b.pos.x, b.pos.z);
    let walking = false;

    switch (b.state) {
      case 'sleep':
        m.root.rotation.x = 0.1;
        break;
      case 'intro':
      case 'rage':
        m.armL.rotation.set(-2.6, 0, 0.4);
        m.armR.rotation.set(-2.6, 0, -0.4);
        if (Math.random() < 0.4) game.fx.burst(b.pos.x, 3, b.pos.z, b.raged ? 0xff1744 : 0xffab40, 2, { speed: 5, up: 3, life: 0.6 });
        if (b.t > 1.6) { b.state = 'rest'; b.t = 0.6; }
        break;
      case 'rest':
      case 'move':
        if (!tgt) break;
        {
          const toT = yawTo(b.pos.x, b.pos.z, tgt.pos.x, tgt.pos.z);
          b.yaw = lerpAngle(b.yaw, toT, Math.min(1, dt * 4));
          const d = Math.hypot(tgt.pos.x - b.pos.x, tgt.pos.z - b.pos.z);
          if (d > 4) {
            b.pos.x += Math.sin(b.yaw) * BOSS.speed * sm() * dt;
            b.pos.z += Math.cos(b.yaw) * BOSS.speed * sm() * dt;
            walking = true;
          }
          if (b.restDur == null) b.restDur = rand(BOSS.restMin, BOSS.restMax) / sm();
          if (b.t > b.restDur + 0.3) {
            b.restDur = null;
            startPattern(choose(tgt), tgt);
          }
        }
        // 怒り中は手下を呼ぶ
        if (b.raged) {
          b.summonT -= dt;
          if (b.summonT <= 0 && game.enemies.aliveCount() < BOSS.rage.summonMax) {
            b.summonT = BOSS.rage.summonEvery;
            for (const s of [-1, 1]) {
              const ex = b.pos.x + s * BOSS.rage.summonOffset[0];
              const ez = b.pos.z + BOSS.rage.summonOffset[1];
              game.enemies.spawn(BOSS.rage.summon, ex, ez).state = 'chase';
              game.fx.burst(ex, 1, ez, 0x7e57c2, 20, { speed: 4, up: 4, life: 0.6 });
            }
            game.toast('ガルドラが手下を呼んだ！');
          }
        }
        break;
      case 'windup': {
        const p = P[b.pattern];
        const dur = p.windup * wm();
        if (b.pattern === 'sweep') {
          if (tgt && b.t < dur * 0.4) {
            b.yaw = lerpAngle(b.yaw, yawTo(b.pos.x, b.pos.z, tgt.pos.x, tgt.pos.z), Math.min(1, dt * 3));
            b.tele?.follow(b.pos.x, b.pos.z, b.yaw);
          }
          m.armR.rotation.set(-Math.PI / 2, 1.5, 0);
          m.root.rotation.y = 0.5;
          if (b.t >= dur) { b.tele?.end(); b.tele = null; execute(tgt); }
        } else if (b.pattern === 'ring') {
          m.armL.rotation.set(-2.8, 0, 0.3);
          m.armR.rotation.set(-2.8, 0, -0.3);
          if (b.t >= dur) { b.tele?.end(); b.tele = null; execute(tgt); }
        } else {
          // 跳躍：しゃがんでから飛ぶ
          const j = b.jump;
          if (b.t < dur) {
            m.root.position.y = -0.15;
            m.armR.rotation.set(-2.9, 0, 0);
          } else {
            const k = Math.min(1, (b.t - dur) / (p.air * wm()));
            b.pos.x = j.sx + (j.tx - j.sx) * k;
            b.pos.z = j.sz + (j.tz - j.sz) * k;
            b.pos.y = Math.sin(k * Math.PI) * p.height;
            b.yaw = yawTo(j.sx, j.sz, j.tx, j.tz);
            if (k >= 1) {
              b.pos.y = 0;
              b.tele?.end();
              b.tele = null;
              for (const pl of game.players) {
                if (Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z) < p.radius + pl.radius) hurtPlayer(game, pl, HIT.boss, b.pos.x, b.pos.z);
              }
              game.fx.shake(1);
              game.sound.se('slam');
              game.fx.burst(b.pos.x, 0.3, b.pos.z, 0xa1887f, 40, { speed: 10, up: 5, life: 0.8, size: 0.25 });
              if (b.raged) ring(b.pos.x, b.pos.z, p.rageRing, rand(0, 1));
              b.state = 'act';
              b.t = 0;
            }
          }
        }
        break;
      }
      case 'act':
        if (b.pending !== undefined && b.pending !== null) {
          b.pending -= dt;
          if (b.pending <= 0) {
            b.pending = null;
            ring(b.pos.x, b.pos.z, P.ring.count, Math.PI / P.ring.count);
          }
        }
        m.armR.rotation.set(-0.5, -0.8, 0);
        m.root.rotation.y = -0.3;
        if (b.t > 0.6) { b.state = 'rest'; b.t = 0; }
        break;
      case 'dead':
        m.root.rotation.x = Math.min(1.5, b.t * 1.2);
        m.group.position.y = -Math.max(0, b.t - 1.2) * 0.8;
        if (Math.random() < 0.5) game.fx.burst(b.pos.x + rand(-2, 2), rand(1, 4), b.pos.z + rand(-2, 2), 0xff6e40, 3, { speed: 3, up: 4, life: 0.7 });
        if (b.t > 2.4 && !b.reported) {
          b.reported = true;
          game.onBossDefeated();
        }
        break;
      default:
        break;
    }

    if (b.state !== 'dead' && b.pos.y === 0) game.world.collide(b.pos, b.radius);
    m.group.rotation.y = b.yaw;
    // 歩き・待機の姿勢
    if (b.state === 'rest' || b.state === 'move') {
      const ph = b.t * 6;
      const s = walking ? Math.sin(ph) * 0.5 : 0;
      m.legL.rotation.x = s;
      m.legR.rotation.x = -s;
      m.armL.rotation.set(-s * 0.6, 0, 0);
      m.armR.rotation.set(-0.4 + s * 0.4, 0, 0);
      m.root.rotation.y = 0;
      m.root.position.y = 0;
    }
    const glow = b.state === 'windup' ? 0.5 + 0.5 * Math.sin(b.t * 25) : b.raged ? 0.25 : 0;
    m.bodyMat.emissive.setRGB(b.flash > 0 ? 1 : glow, b.flash > 0 ? 1 : 0, b.flash > 0 ? 1 : 0);
  }

  return b;
}
