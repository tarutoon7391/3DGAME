// 召喚士の召喚物：精霊（その場からボスを撃つ）と岩巨人（ボスの狙いを引きつけて殴る）
// ホストが動かし、参加者には位置を配る（参加者のブラウザでは puppet：見た目と演出だけ）
import * as THREE from 'three';
import { JOBS } from './data/jobs.js';
import { makeEnemyModel, animateWalk } from './models.js';
import { strike, radiusHit } from './combat.js';
import { yawTo, lerpAngle } from './util.js';

export function createAllies(game) {
  const list = [];
  let nextId = 1;
  const spiritGeo = new THREE.OctahedronGeometry(0.45, 0);
  const spiritMat = new THREE.MeshBasicMaterial({ color: 0x80cbc4 });

  /** 召喚物が攻撃するときの「攻撃者」（召喚した人の攻撃力を使う） */
  const attacker = (a) => ({
    id: a.owner, job: JOBS.summoner, pos: a.pos, buffs: {}, pending: [],
    atkNow: () => JOBS.summoner.stats.atk * (JOBS.summoner.power ?? 1), addGauge() {},
  });

  function makeModel(kind) {
    if (kind === 'golem') {
      const m = makeEnemyModel('golem', 0x8d6e63);
      m.group.scale.multiplyScalar(1.3);
      return m;
    }
    const group = new THREE.Group();
    const core = new THREE.Mesh(spiritGeo, spiritMat);
    core.position.y = 1.6;
    group.add(core);
    return { group, core };
  }

  function spawn(kind, x, z, owner, id = nextId++, puppet = false) {
    const S = JOBS.summoner;
    const m = makeModel(kind);
    m.group.position.set(x, 0, z);
    game.scene.add(m.group);
    const a = {
      id, kind, owner, model: m, pos: m.group.position, yaw: 0, puppet,
      life: kind === 'golem' ? S.e.dur : S.q.dur,
      maxLife: kind === 'golem' ? S.e.dur : S.q.dur,
      hp: kind === 'golem' ? S.e.hp : 1,
      cd: 0.5, t: 0, alive: true, radius: kind === 'golem' ? 1.2 : 0.5, net: null,
    };
    list.push(a);
    game.fx.burst(x, 1, z, kind === 'golem' ? 0xa1887f : 0x80cbc4, 25, { speed: 5, up: 5, life: 0.7 });
    return a;
  }

  function remove(i) {
    const a = list[i];
    game.scene.remove(a.model.group);
    a.model.bodyMat?.dispose();
    game.fx.burst(a.pos.x, 1, a.pos.z, 0x80cbc4, 15, { speed: 3, up: 3, life: 0.5 });
    list.splice(i, 1);
  }

  function update(dt, time) {
    // 一番近い戦闘中のボスを狙う（2体同時の部屋もある）
    const nearestBoss = (a) => {
      let best = null;
      let bd = Infinity;
      for (const o of game.bosses) {
        if (!o.active || !o.alive) continue;
        const d = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    };
    const S = JOBS.summoner;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      a.t += dt;
      if (a.puppet) {
        // 参加者：届いた位置へ寄せる。精霊はときどき見た目だけの弾を撃つ
        const n = a.net;
        if (n) {
          const k = Math.min(1, dt * 10);
          a.pos.x += (n.x - a.pos.x) * k;
          a.pos.z += (n.z - a.pos.z) * k;
          a.yaw = lerpAngle(a.yaw, n.yaw, k);
        }
        const b = nearestBoss(a);
        if (a.kind === 'spirit' && b) {
          a.cd -= dt;
          if (a.cd <= 0) {
            a.cd = S.q.every;
            game.projectiles.playerShot(attacker(a), a.pos.x, a.pos.z, yawTo(a.pos.x, a.pos.z, b.pos.x, b.pos.z), { speed: 24, mult: 0, color: 0x80cbc4, size: 0.22, range: 30, local: false });
          }
        }
        draw(a, time, !!(n && Math.hypot(n.x - a.pos.x, n.z - a.pos.z) > 0.05));
        continue;
      }
      a.life -= dt;
      if (a.life <= 0 || a.hp <= 0) {
        remove(i);
        continue;
      }
      const target = nearestBoss(a);
      let walking = false;
      if (a.kind === 'spirit') {
        a.cd -= dt;
        if (target && a.cd <= 0) {
          a.cd = S.q.every;
          a.yaw = yawTo(a.pos.x, a.pos.z, target.pos.x, target.pos.z);
          game.projectiles.playerShot(attacker(a), a.pos.x, a.pos.z, a.yaw, { speed: 24, mult: S.q.mult, color: 0x80cbc4, size: 0.22, range: 30, local: true, gauge: 0 });
        }
      } else if (target) {
        // 岩巨人：ボスへ歩いて殴る
        a.yaw = lerpAngle(a.yaw, yawTo(a.pos.x, a.pos.z, target.pos.x, target.pos.z), Math.min(1, dt * 5));
        const d = Math.hypot(target.pos.x - a.pos.x, target.pos.z - a.pos.z);
        if (d > target.radius + a.radius + 0.8) {
          a.pos.x += Math.sin(a.yaw) * 4.2 * dt;
          a.pos.z += Math.cos(a.yaw) * 4.2 * dt;
          walking = true;
        } else {
          a.cd -= dt;
          if (a.cd <= 0) {
            a.cd = 1.1;
            strike(game, attacker(a), target, S.e.mult, { melee: true, gauge: 0, color: 0xa1887f });
            game.fx.shake(0.15);
          }
        }
        game.world.collide(a.pos, a.radius);
      }
      draw(a, time, walking);
    }
  }

  function draw(a, time, walking) {
    const m = a.model;
    m.group.rotation.y = a.yaw;
    if (a.kind === 'spirit') {
      m.core.position.y = 1.6 + Math.sin(a.t * 3) * 0.2;
      m.core.rotation.y += 0.05;
    } else {
      animateWalk(m, time * 8, walking ? 1 : 0, true);
      if (a.cd > 0.8) m.armR.rotation.set(-2.4, 0, 0);
    }
  }

  return {
    list,
    spawn,
    update,
    /** ボスに狙わせる召喚物（岩巨人） */
    taunter: () => list.find((a) => a.kind === 'golem' && a.alive) || null,
    ownedBy: (id) => list.some((a) => a.owner === id),
    count: (id, kind) => list.filter((a) => a.owner === id && a.kind === kind).length,
    /** 精霊爆破：owner の精霊をすべて爆発させる（ホスト） */
    detonate(owner, mult, radius) {
      for (const a of list) {
        if (a.owner !== owner || a.kind !== 'spirit' || a.puppet) continue;
        game.fx.burst(a.pos.x, 1.4, a.pos.z, 0x80cbc4, 50, { speed: 9, up: 6, life: 0.7, size: 0.26 });
        game.fx.shake(0.4);
        radiusHit(game, attacker(a), mult, radius, { color: 0x80cbc4, gauge: 0, knock: 1.5 }, a.pos.x, a.pos.z);
        a.life = 0;
      }
    },
    /** ボスの攻撃が当たったか調べて岩巨人の HP を減らす */
    hitBy(test, frac) {
      for (const a of list) {
        if (a.kind !== 'golem' || a.puppet) continue;
        if (test(a.pos.x, a.pos.z, a.radius, a)) {
          a.hp -= 400 * frac;
          game.fx.burst(a.pos.x, 1.5, a.pos.z, 0xa1887f, 8, { speed: 3, life: 0.4 });
        }
      }
    },
    /** ホスト → 参加者 */
    snapshot: () => list.map((a) => [a.id, a.kind, +a.pos.x.toFixed(2), +a.pos.z.toFixed(2), +a.yaw.toFixed(2), a.owner]),
    /** 参加者：届いた一覧に合わせて作る・消す */
    applyNet(arr) {
      const seen = new Set();
      for (const [id, kind, x, z, yaw, owner] of arr) {
        seen.add(id);
        let a = list.find((o) => o.id === id);
        if (!a) a = spawn(kind, x, z, owner, id, true);
        a.net = { x, z, yaw };
      }
      for (let i = list.length - 1; i >= 0; i--) if (!seen.has(list[i].id)) remove(i);
    },
    clear() {
      for (let i = list.length - 1; i >= 0; i--) remove(i);
    },
  };
}
