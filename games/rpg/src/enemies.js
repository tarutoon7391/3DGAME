// 雑魚敵：近接・遠距離・突進の3系統AI。予備動作（赤く光る＋地面の予兆）を見せてから攻撃する
import { ENEMIES } from './data/enemies.js';
import { makeEnemyModel, animateWalk } from './models.js';
import { angleDiff, lerpAngle, yawTo, rand, randInt } from './util.js';
import { hurtPlayer, nearestPlayer } from './combat.js';
import { createBars } from './ui/bars.js';
import { onKill } from './questlog.js';

export function createEnemies(game) {
  const list = [];
  const bars = createBars(game.scene);

  function spawn(type, x, z) {
    const def = ENEMIES[type];
    const m = makeEnemyModel(def.model, def.color);
    m.group.position.set(x, 0, z);
    game.scene.add(m.group);
    const e = {
      type, def, model: m, pos: m.group.position,
      yaw: rand(0, Math.PI * 2), hp: def.hp, maxHp: def.hp, defense: def.def,
      radius: def.radius, hpY: def.hpY, alive: true, removed: false,
      state: 'idle', t: rand(0, 2), home: { x, z }, target: null,
      cd: rand(0.5, 1.5), flash: 0, kx: 0, kz: 0, tele: null, dirX: 0, dirZ: 0, hitDone: false,
      wander: { x, z }, phase: rand(0, 6), deadT: 0, baseScale: m.group.scale.x,
      bar: bars.add(def.hpY),
      takeHit(g, dmg, dx, dz, knock) {
        e.hp -= dmg;
        e.flash = 0.12;
        const heavy = def.model === 'golem' ? 0.25 : 1;
        if (e.state !== 'charge') {
          e.kx += dx * 6 * knock * heavy;
          e.kz += dz * 6 * knock * heavy;
        }
        if (e.state === 'idle') e.state = 'chase';
        if (e.hp <= 0) kill(e);
      },
    };
    list.push(e);
    return e;
  }

  function kill(e) {
    e.alive = false;
    e.hp = 0;
    e.state = 'dead';
    e.deadT = 0;
    if (e.tele) e.tele.end();
    e.tele = null;
    const d = e.def;
    game.fx.burst(e.pos.x, 0.8, e.pos.z, d.color, 22, { speed: 6, up: 5, life: 0.7, size: 0.2 });
    game.sound.se('die');
    const pr = game.state.progress;
    pr.stats.kills++;
    game.giveExp(d.exp);
    game.fx.text(e.pos.x, d.hpY + 0.4, e.pos.z, `+${d.exp} EXP`, '#b9f6ca');
    game.pickups.spawn('gold', randInt(d.gold[0], d.gold[1]), e.pos.x, e.pos.z);
    for (const [id, ch] of d.drops) if (Math.random() < ch) game.pickups.spawn(id, 1, e.pos.x + rand(-0.6, 0.6), e.pos.z + rand(-0.6, 0.6));
    onKill(game, game.world.id);
  }

  function removeModel(e) {
    if (e.removed) return;
    e.removed = true;
    game.scene.remove(e.model.group);
    e.model.bodyMat.dispose();
    bars.remove(e.bar);
  }

  function clear() {
    for (const e of list) {
      if (e.tele) e.tele.end();
      removeModel(e);
    }
    list.length = 0;
  }

  function face(e, yaw, rate, dt) {
    e.yaw = lerpAngle(e.yaw, yaw, Math.min(1, rate * dt));
  }

  function move(e, dirYaw, speed, dt) {
    e.pos.x += Math.sin(dirYaw) * speed * dt;
    e.pos.z += Math.cos(dirYaw) * speed * dt;
  }

  function startWindup(e, tgt) {
    const d = e.def;
    e.state = 'windup';
    e.t = 0;
    e.yaw = yawTo(e.pos.x, e.pos.z, tgt.pos.x, tgt.pos.z);
    game.sound.se('windup');
    if (d.ai === 'melee') {
      e.tele = game.fx.telegraph('sector', { x: e.pos.x, z: e.pos.z, r: d.range + 0.5, arc: 1.8, angle: e.yaw, dur: d.windup });
    } else if (d.ai === 'ranged') {
      e.tele = game.fx.telegraph('rect', { x: e.pos.x, z: e.pos.z, len: 12, width: 0.5, angle: e.yaw, dur: d.windup });
    } else {
      e.dirX = Math.sin(e.yaw);
      e.dirZ = Math.cos(e.yaw);
      e.tele = game.fx.telegraph('rect', { x: e.pos.x, z: e.pos.z, len: d.chargeSpeed * d.chargeTime + 1, width: e.radius * 2.2, angle: e.yaw, dur: d.windup });
    }
  }

  function updateOne(e, dt, time) {
    const d = e.def;
    e.t += dt;
    e.cd -= dt;
    // 標的の選択（近い順。離れすぎたら諦めて帰る）
    const engaged = e.state !== 'idle';
    const tgt = nearestPlayer(game, e.pos.x, e.pos.z, engaged ? d.aggro * 1.8 : d.aggro);
    const homeD = Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z);
    if ((!tgt || homeD > 28) && (e.state === 'chase')) e.state = 'idle';
    if (tgt && e.state === 'idle' && homeD < 28) e.state = 'chase';

    let walking = false;
    const dist = tgt ? Math.hypot(tgt.pos.x - e.pos.x, tgt.pos.z - e.pos.z) : 99;
    const toT = tgt ? yawTo(e.pos.x, e.pos.z, tgt.pos.x, tgt.pos.z) : 0;

    switch (e.state) {
      case 'idle': {
        // 家の周りをうろつく
        if (e.t > 3) {
          e.t = 0;
          e.wander.x = e.home.x + rand(-4, 4);
          e.wander.z = e.home.z + rand(-4, 4);
        }
        const wd = Math.hypot(e.wander.x - e.pos.x, e.wander.z - e.pos.z);
        if (wd > 0.5) {
          const wy = yawTo(e.pos.x, e.pos.z, e.wander.x, e.wander.z);
          face(e, wy, 5, dt);
          move(e, e.yaw, d.speed * 0.45, dt);
          walking = true;
        }
        break;
      }
      case 'chase': {
        if (!tgt) break;
        face(e, toT, 8, dt);
        if (d.ai === 'melee') {
          if (dist > d.range * 0.85) { move(e, e.yaw, d.speed, dt); walking = true; }
          else if (e.cd <= 0) startWindup(e, tgt);
        } else if (d.ai === 'ranged') {
          if (dist > d.keep + 2) { move(e, toT, d.speed, dt); walking = true; }
          else if (dist < d.keep - 2.5) { move(e, toT + Math.PI, d.speed * 0.8, dt); walking = true; }
          else { move(e, toT + Math.PI / 2 * Math.sign(Math.sin(time * 0.7 + e.phase)), d.speed * 0.4, dt); walking = true; }
          if (e.cd <= 0 && dist < d.aggro) startWindup(e, tgt);
        } else {
          if (dist > 9) { move(e, e.yaw, d.speed, dt); walking = true; }
          else if (e.cd <= 0) startWindup(e, tgt);
          else { move(e, e.yaw, d.speed * 0.4, dt); walking = true; }
        }
        break;
      }
      case 'windup': {
        // 予備動作：前半は標的へ向き直る（突進は向き固定）
        if (tgt && d.ai !== 'charger' && e.t < d.windup * 0.5) {
          face(e, toT, 6, dt);
          e.tele?.follow(e.pos.x, e.pos.z, e.yaw);
        }
        if (e.t >= d.windup) {
          e.tele?.end();
          e.tele = null;
          e.t = 0;
          if (d.ai === 'melee') {
            e.state = 'recover';
            move(e, e.yaw, 6, 0.08);
            for (const p of game.players) {
              const pd = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
              const ang = Math.abs(angleDiff(e.yaw, yawTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z)));
              if (pd < d.range + 0.5 + p.radius && (ang < 0.95 || pd < 0.9)) hurtPlayer(game, p, d.atk, 1, e.pos.x, e.pos.z);
            }
            game.fx.burst(e.pos.x + Math.sin(e.yaw) * 1.2, 0.5, e.pos.z + Math.cos(e.yaw) * 1.2, 0xffffff, 6, { speed: 3, life: 0.3 });
          } else if (d.ai === 'ranged') {
            e.state = 'recover';
            const n = d.burst || 1;
            for (let i = 0; i < n; i++) {
              const a = e.yaw + (i - (n - 1) / 2) * 0.22;
              game.projectiles.enemyShot(e.pos.x + Math.sin(a) * 0.6, e.pos.z + Math.cos(a) * 0.6, a, d.shotSpeed, d.atk, d.shotColor);
            }
            game.sound.se('shoot');
          } else {
            e.state = 'charge';
            e.hitDone = false;
          }
        }
        break;
      }
      case 'charge': {
        const bx = e.pos.x;
        const bz = e.pos.z;
        e.pos.x += e.dirX * d.chargeSpeed * dt;
        e.pos.z += e.dirZ * d.chargeSpeed * dt;
        if (Math.random() < 0.5) game.fx.burst(e.pos.x, 0.2, e.pos.z, 0xbcaaa4, 1, { speed: 1, up: 1, life: 0.4 });
        if (!e.hitDone) {
          for (const p of game.players) {
            if (Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < e.radius + p.radius + 0.2) {
              if (hurtPlayer(game, p, d.atk, 1, e.pos.x, e.pos.z)) e.hitDone = true;
            }
          }
        }
        game.world.collide(e.pos, e.radius);
        const blockedHard = Math.hypot(e.pos.x - bx, e.pos.z - bz) < d.chargeSpeed * dt * 0.5;
        if (e.t >= d.chargeTime || blockedHard) {
          e.state = 'stun';
          e.t = 0;
          if (blockedHard) game.fx.shake(0.2);
        }
        break;
      }
      case 'stun':
        if (e.t >= d.stun) { e.state = 'chase'; e.cd = rand(1, 2); }
        break;
      case 'recover':
        if (e.t >= (d.recover ?? 0.6)) {
          e.state = 'chase';
          e.cd = d.ai === 'ranged' ? d.cooldown : rand(0.4, 1.0);
        }
        break;
      default:
        break;
    }

    // ノックバック・押し合い・壁
    e.pos.x += e.kx * dt;
    e.pos.z += e.kz * dt;
    e.kx *= Math.max(0, 1 - dt * 7);
    e.kz *= Math.max(0, 1 - dt * 7);
    for (const o of list) {
      if (o === e || !o.alive) continue;
      const dx = e.pos.x - o.pos.x;
      const dz = e.pos.z - o.pos.z;
      const rr = e.radius + o.radius;
      const dd = dx * dx + dz * dz;
      if (dd < rr * rr && dd > 1e-6) {
        const dl = Math.sqrt(dd);
        const push = (rr - dl) * 0.5;
        e.pos.x += (dx / dl) * push;
        e.pos.z += (dz / dl) * push;
      }
    }
    game.world.collide(e.pos, e.radius);

    // 見た目
    const m = e.model;
    m.group.rotation.y = e.yaw;
    e.flash = Math.max(0, e.flash - dt);
    const glow = e.state === 'windup' ? 0.5 + 0.5 * Math.sin(e.t * 30) : 0;
    m.bodyMat.emissive.setRGB(e.flash > 0 ? 1 : glow * 0.9, e.flash > 0 ? 1 : 0, e.flash > 0 ? 1 : 0);
    animateEnemy(e, walking, time);
    bars.set(e.bar, e.pos, e.hp / e.maxHp, e.hp < e.maxHp);
  }

  function animateEnemy(e, walking, time) {
    const m = e.model;
    const ph = time * 10 + e.phase;
    if (e.def.model === 'slime') {
      const sq = e.state === 'windup' ? 0.6 + e.t * 0.2 : 1 + Math.sin(ph) * (walking ? 0.12 : 0.05);
      m.root.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    } else if (e.def.model === 'boar') {
      const s = Math.sin(ph * 1.3) * (walking || e.state === 'charge' ? 0.6 : 0);
      m.legs.forEach((l, i) => { l.rotation.x = i % 2 ? s : -s; });
      m.root.rotation.x = e.state === 'windup' ? -0.15 + Math.sin(e.t * 25) * 0.05 : 0;
    } else {
      animateWalk(m, ph * 0.9, walking ? 1 : 0, e.state !== 'windup');
      if (e.state === 'windup') m.armR.rotation.set(-2.6, 0, 0);
      else if (e.state === 'recover' && e.def.ai === 'melee') m.armR.rotation.set(-0.3, 0, 0);
      if (e.state === 'charge') m.root.rotation.x = 0.35;
      else m.root.rotation.x = 0;
    }
  }

  function update(dt, time) {
    for (const e of list) {
      if (e.alive) {
        updateOne(e, dt, time);
      } else if (!e.removed) {
        e.deadT += dt;
        e.model.group.scale.setScalar(e.baseScale * Math.max(0.01, 1 - e.deadT * 1.6));
        e.pos.y = -e.deadT;
        bars.set(e.bar, e.pos, 0, false);
        if (e.deadT > 0.6) removeModel(e);
      }
    }
    bars.update(game.camera);
  }

  return { list, spawn, update, clear, aliveCount: () => list.filter((e) => e.alive).length };
}
