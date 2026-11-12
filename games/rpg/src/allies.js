// 召喚士の召喚物：精霊（その場からボスを撃つ水色のおばけ）・癒しの精霊（HP の減った味方へ回復の球を飛ばす緑のおばけ）・
// 岩巨人（ボスの狙いを引きつけ、地面から岩を引き抜いて投げる）。召喚士が精霊強化（C）中は精霊の攻撃・回復が 1.5倍速
// ホストが動かし、参加者には位置を配る（参加者のブラウザでは puppet：見た目と演出だけ）
import * as THREE from 'three';
import { JOBS } from './data/jobs.js';
import { makeEnemyModel, animateWalk } from './models.js';
import { strike, radiusHit } from './combat.js';
import { yawTo, lerpAngle } from './util.js';

export function createAllies(game) {
  const list = [];
  let nextId = 1;
  // ---- 精霊：水色のおばけ（使い回す形と材質） ----
  const G = {
    head: new THREE.SphereGeometry(0.42, 16, 12),
    tail: new THREE.CylinderGeometry(0.42, 0.3, 0.4, 16, 1, true),
    tip: new THREE.ConeGeometry(0.12, 0.28, 6),
    eye: new THREE.SphereGeometry(0.075, 10, 8),
    shine: new THREE.SphereGeometry(0.026, 6, 5),
    nub: new THREE.SphereGeometry(0.1, 8, 6),
    glow: new THREE.SphereGeometry(0.75, 14, 10),
    rock: new THREE.DodecahedronGeometry(0.32, 0),
  };
  const MAT = {
    body: new THREE.MeshLambertMaterial({ color: 0x9be7f0, emissive: 0x2a8a96, transparent: true, opacity: 0.92 }),
    eye: new THREE.MeshBasicMaterial({ color: 0x102027 }),
    shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    blush: new THREE.MeshBasicMaterial({ color: 0xff8fb1, transparent: true, opacity: 0.7 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x80deea, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
    rock: new THREE.MeshLambertMaterial({ color: 0x8d6e63, flatShading: true }),
  };
  // 癒しの精霊は緑
  const MH = {
    ...MAT,
    body: new THREE.MeshLambertMaterial({ color: 0xa5f5c0, emissive: 0x1f8a4c, transparent: true, opacity: 0.92 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  const orbGeo = new THREE.SphereGeometry(0.28, 12, 8);
  const orbMat = new THREE.MeshBasicMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const orbs = []; // 回復の球 { mesh, target, local, owner }
  function makeSpirit(M = MAT) {
    const group = new THREE.Group();
    const core = new THREE.Group();
    core.position.y = 1.5;
    group.add(core);
    const add = (g, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      core.add(o);
      return o;
    };
    add(G.head, M.body, 0, 0, 0, 1, 1.05, 0.95);
    add(G.tail, M.body, 0, -0.2, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(G.tip, M.body, Math.sin(a) * 0.24, -0.47, Math.cos(a) * 0.24).rotation.x = Math.PI; // すそのひらひら
    }
    // 目（黒目に白い光）・ほっぺ・小さな手
    for (const s of [-1, 1]) {
      add(G.eye, M.eye, s * 0.15, 0.06, 0.37, 0.8, 1.25, 0.5);
      add(G.shine, M.shine, s * 0.15 - 0.025, 0.12, 0.41);
      add(G.nub, M.blush, s * 0.27, -0.07, 0.32, 0.8, 0.5, 0.3);
      add(G.nub, M.body, s * 0.43, -0.12, 0.05);
    }
    add(G.glow, M.glow, 0, -0.05, 0);
    return { group, core };
  }

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
    return makeSpirit(kind === 'healspirit' ? MH : MAT);
  }

  function spawn(kind, x, z, owner, id = nextId++, puppet = false) {
    const S = JOBS.summoner;
    const m = makeModel(kind);
    m.group.position.set(x, 0, z);
    game.scene.add(m.group);
    const a = {
      id, kind, owner, model: m, pos: m.group.position, yaw: 0, puppet,
      life: kind === 'golem' ? S.r.dur : kind === 'healspirit' ? S.e.dur : S.q.dur,
      maxLife: kind === 'golem' ? S.r.dur : kind === 'healspirit' ? S.e.dur : S.q.dur,
      hp: kind === 'golem' ? S.r.hp : 1,
      throwT: -1, thrown: false, held: null, // 岩巨人の投げ（throwT：投げ始めてからの秒、-1 で投げていない）
      cd: 0.5, t: 0, alive: true, radius: kind === 'golem' ? 1.2 : 0.5, net: null,
    };
    list.push(a);
    game.fx.burst(x, 1, z, kind === 'golem' ? 0xa1887f : kind === 'healspirit' ? 0x69f0ae : 0x80cbc4, 25, { speed: 5, up: 5, life: 0.7 });
    return a;
  }

  function remove(i) {
    const a = list[i];
    if (a.held) a.model.group.remove(a.held);
    game.scene.remove(a.model.group);
    a.model.bodyMat?.dispose();
    game.fx.burst(a.pos.x, 1, a.pos.z, 0x80cbc4, 15, { speed: 3, up: 3, life: 0.5 });
    list.splice(i, 1);
  }

  // ---- 岩巨人の投げ ----
  const THROW = { range: 10, pick: 0.5, end: 0.8, cycle: 1.1, flight: 0.4, arc: 3.5 }; // 1回 1.1 秒（前の殴りと同じ間隔）
  const rocks = []; // 飛んでいる岩 { mesh, x0, z0, y0, target, t, local, from }
  /** 投げの動き（ホスト・参加者とも）。target が無ければ投げない */
  function stepThrow(a, dt, target, local) {
    if (a.throwT < 0) return;
    a.throwT += dt;
    // 地面から岩を引き抜く（少しかがんだところで土が飛ぶ）
    if (a.throwT >= 0.12 && !a.held && !a.thrown) {
      a.held = new THREE.Mesh(G.rock, MAT.rock);
      a.held.scale.setScalar(1.2);
      a.model.group.add(a.held);
      game.fx.burst(a.pos.x + Math.sin(a.yaw) * 1.2, 0.3, a.pos.z + Math.cos(a.yaw) * 1.2, 0x8d6e63, 22, { speed: 4, up: 6, life: 0.6, size: 0.2 });
      game.fx.shake(0.12);
    }
    if (a.held) {
      // 前の地面 → 頭の上へ持ち上げる
      const k = Math.min(1, Math.max(0, (a.throwT - 0.12) / (THROW.pick - 0.12)));
      const e = 1 - (1 - k) * (1 - k);
      a.held.position.set(0, -0.1 + e * 2.6, 0.55 * (1 - e) + 0.05);
      a.held.rotation.x += dt * 3;
    }
    // 思い切り投げる
    if (!a.thrown && a.throwT >= THROW.pick && target) {
      a.thrown = true;
      if (a.held) {
        a.model.group.remove(a.held);
        a.held = null;
      }
      const mesh = new THREE.Mesh(G.rock, MAT.rock);
      mesh.scale.setScalar(2.4);
      game.scene.add(mesh);
      rocks.push({ mesh, x0: a.pos.x, z0: a.pos.z, y0: 5, target, tx: target.pos.x, tz: target.pos.z, t: 0, local, from: a });
      game.sound.se('swing');
    }
    if (a.throwT >= THROW.end) {
      a.throwT = -1;
      a.thrown = false;
    }
  }
  function updateRocks(dt) {
    for (let i = rocks.length - 1; i >= 0; i--) {
      const r = rocks[i];
      r.t += dt;
      // 当たる先は飛んでいる間も相手を追う
      if (r.target.alive) {
        r.tx = r.target.pos.x;
        r.tz = r.target.pos.z;
      }
      const k = Math.min(1, r.t / THROW.flight);
      const ty = (r.target.hpY || 3) * 0.45;
      r.mesh.position.set(r.x0 + (r.tx - r.x0) * k, r.y0 + (ty - r.y0) * k + Math.sin(k * Math.PI) * THROW.arc, r.z0 + (r.tz - r.z0) * k);
      r.mesh.rotation.x += dt * 9;
      r.mesh.rotation.z += dt * 6;
      if (Math.random() < 0.5) game.fx.burst(r.mesh.position.x, r.mesh.position.y, r.mesh.position.z, 0xa1887f, 1, { speed: 0.5, up: 0, life: 0.3, grav: 0 });
      if (k < 1) continue;
      // 命中：ホストだけダメージ、見た目は全員
      if (r.local && r.target.alive) strike(game, attacker(r.from), r.target, JOBS.summoner.r.mult, { melee: true, gauge: 0, color: 0xa1887f, knock: 1.2 });
      game.fx.burst(r.tx, ty, r.tz, 0x8d6e63, 36, { speed: 8, up: 5, life: 0.7, size: 0.26 });
      game.enemyFx?.impact(r.tx, r.tz, 2.6, 0xa1887f, 'earth');
      game.fx.shake(0.3);
      game.sound.se('slam');
      game.scene.remove(r.mesh);
      rocks.splice(i, 1);
    }
  }

  /** 召喚した人が精霊強化（C）中なら精霊の速さ 1.5倍 */
  const rateOf = (a) => {
    const o = game.players.find((p) => p.id === a.owner);
    return o?.buffs?.spiritboost ? JOBS.summoner.c?.vals?.spiritRate ?? 1.5 : 1;
  };
  /** 癒しの精霊の回復先：届く範囲で一番 HP の割合が低い味方（満タンなら無し） */
  function healTarget(a) {
    let best = null;
    let br = 0.999;
    for (const p of game.players) {
      if (!p.alive || p.downed) continue;
      if (Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) > JOBS.summoner.e.range) continue;
      const r = p.hp / p.maxHp;
      if (r < br) { br = r; best = p; }
    }
    return best;
  }
  function launchOrb(a, target, local) {
    const mesh = new THREE.Mesh(orbGeo, orbMat);
    mesh.position.set(a.pos.x, 1.6, a.pos.z);
    game.scene.add(mesh);
    orbs.push({ mesh, target, local, owner: a.owner, t: 0 });
    game.sound.se('seal');
  }
  function updateOrbs(dt) {
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.t += dt;
      const m = o.mesh.position;
      const tx = o.target.pos.x;
      const tz = o.target.pos.z;
      const dx = tx - m.x;
      const dy = 1.3 - m.y + Math.sin(o.t * 8) * 0.02;
      const dz = tz - m.z;
      const d = Math.hypot(dx, dy, dz);
      const step = 13 * dt;
      if (Math.random() < 0.6) game.fx.burst(m.x, m.y, m.z, 0x69f0ae, 1, { speed: 0.5, up: 0.5, life: 0.4, grav: 0 });
      if (d > step && o.t < 2.5 && o.target.alive) {
        m.x += (dx / d) * step;
        m.y += (dy / d) * step + Math.sin(o.t * 10) * 0.02;
        m.z += (dz / d) * step;
        continue;
      }
      // 届いた：回復（ホストだけが配る。回復量の順位表は召喚した人に付ける）
      game.fx.burst(tx, 1.3, tz, 0x69f0ae, 18, { speed: 3, up: 3, life: 0.6 });
      if (o.local && o.target.alive) game.teamEffectRaw?.({ kind: 'heal', x: +tx.toFixed(1), z: +tz.toFixed(1), r: 1.6, amount: JOBS.summoner.e.amount * (JOBS.summoner.support ?? 1), quiet: true, credit: o.owner });
      game.scene.remove(o.mesh);
      orbs.splice(i, 1);
    }
  }

  function update(dt, time) {
    updateRocks(dt);
    updateOrbs(dt);
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
        if (a.kind === 'healspirit') {
          a.cd -= dt * rateOf(a);
          if (a.cd <= 0) {
            a.cd = S.e.every;
            const t = healTarget(a);
            if (t) launchOrb(a, t, false); // 見た目だけ
          }
        }
        if (a.kind === 'spirit' && b) {
          a.cd -= dt * rateOf(a);
          if (a.cd <= 0) {
            a.cd = S.q.every;
            game.projectiles.playerShot(attacker(a), a.pos.x, a.pos.z, yawTo(a.pos.x, a.pos.z, b.pos.x, b.pos.z), { speed: 24, mult: 0, color: 0x80cbc4, size: 0.22, range: 30, local: false });
          }
        }
        if (a.kind === 'golem') {
          // 新しい投げが始まったときだけ再生（届いた値が前より小さい＝投げ直し）
          const th = n ? n.th : -1;
          if (th >= 0 && (a.lastTh === undefined || a.lastTh < 0 || th < a.lastTh) && a.throwT < 0) {
            a.throwT = th;
            a.thrown = false;
          }
          a.lastTh = th;
          stepThrow(a, dt, b, false);
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
      if (a.kind === 'healspirit') {
        a.cd -= dt * rateOf(a);
        if (a.cd <= 0) {
          const t = healTarget(a);
          if (t) {
            a.cd = S.e.every;
            a.yaw = yawTo(a.pos.x, a.pos.z, t.pos.x, t.pos.z);
            launchOrb(a, t, true);
          }
        }
      } else if (a.kind === 'spirit') {
        a.cd -= dt * rateOf(a);
        if (target && a.cd <= 0) {
          a.cd = S.q.every;
          a.yaw = yawTo(a.pos.x, a.pos.z, target.pos.x, target.pos.z);
          game.projectiles.playerShot(attacker(a), a.pos.x, a.pos.z, a.yaw, { speed: 24, mult: S.q.mult, color: 0x80cbc4, size: 0.22, range: 30, local: true, gauge: 0 });
        }
      } else if (target) {
        // 岩巨人：投げられる距離まで歩き、地面から岩を引き抜いてボスへ投げる（1回 1.1 秒）
        a.yaw = lerpAngle(a.yaw, yawTo(a.pos.x, a.pos.z, target.pos.x, target.pos.z), Math.min(1, dt * 5));
        const d = Math.hypot(target.pos.x - a.pos.x, target.pos.z - a.pos.z);
        a.cd -= dt;
        if (a.throwT < 0 && d > THROW.range + target.radius) {
          a.pos.x += Math.sin(a.yaw) * 4.2 * dt;
          a.pos.z += Math.cos(a.yaw) * 4.2 * dt;
          walking = true;
        } else if (a.throwT < 0 && a.cd <= 0) {
          a.cd = THROW.cycle;
          a.throwT = 0;
          a.thrown = false;
        }
        stepThrow(a, dt, target, true);
        game.world.collide(a.pos, a.radius);
      }
      draw(a, time, walking);
    }
  }

  function draw(a, time, walking) {
    const m = a.model;
    m.group.rotation.y = a.yaw;
    if (a.kind === 'spirit' || a.kind === 'healspirit') {
      // ふわふわ浮いて、左右にゆらゆら
      m.core.position.y = 1.5 + Math.sin(a.t * 3) * 0.18;
      m.core.rotation.z = Math.sin(a.t * 2.2) * 0.15;
      const sq = 1 + Math.sin(a.t * 6) * 0.04;
      m.core.scale.set(1 / sq, sq, 1 / sq);
    } else {
      animateWalk(m, time * 8, walking ? 1 : 0, true);
      if (a.throwT >= 0) {
        // かがむ → 両手で頭の上へ持ち上げる → 前へ振り下ろして投げる
        const t = a.throwT;
        let arm;
        if (t < 0.12) arm = -0.9 * (t / 0.12);
        else if (t < THROW.pick) arm = -0.9 - 2.1 * ((t - 0.12) / (THROW.pick - 0.12));
        else arm = -3.0 + 2.4 * Math.min(1, (t - THROW.pick) / 0.15);
        m.armL.rotation.set(arm, 0, 0.15);
        m.armR.rotation.set(arm, 0, -0.15);
        m.root.position.y = t < 0.2 ? -0.12 * Math.sin((t / 0.2) * Math.PI) : 0;
        m.root.rotation.x = t >= THROW.pick ? 0.25 * Math.sin(Math.min(1, (t - THROW.pick) / 0.3) * Math.PI) : -0.1;
      } else m.root.rotation.x = 0;
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
    snapshot: () => list.map((a) => [a.id, a.kind, +a.pos.x.toFixed(2), +a.pos.z.toFixed(2), +a.yaw.toFixed(2), a.owner, a.kind === 'golem' && a.throwT >= 0 ? +a.throwT.toFixed(2) : -1]),
    /** 参加者：届いた一覧に合わせて作る・消す */
    applyNet(arr) {
      const seen = new Set();
      for (const [id, kind, x, z, yaw, owner, th = -1] of arr) {
        seen.add(id);
        let a = list.find((o) => o.id === id);
        if (!a) a = spawn(kind, x, z, owner, id, true);
        a.net = { x, z, yaw, th };
      }
      for (let i = list.length - 1; i >= 0; i--) if (!seen.has(list[i].id)) remove(i);
    },
    clear() {
      for (let i = list.length - 1; i >= 0; i--) remove(i);
      for (const r of rocks) game.scene.remove(r.mesh);
      rocks.length = 0;
      for (const o of orbs) game.scene.remove(o.mesh);
      orbs.length = 0;
    },
  };
}
