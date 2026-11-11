// 職業のスキル（通常攻撃の飛び道具・Q・E）と、スキルが残す効果（隕石・矢の雨・結界など）
// 使った本人のブラウザでは当たり判定込みで実行し（local = true）、他の人のブラウザでは見た目だけ再生する（local = false）
// 味方への回復・強化は game.teamEffect（全員に配って各自が自分に適用）、ボスへの挑発・召喚は game.bossCommand（ホストが処理）
import * as THREE from 'three';
import { JOBS, GAUGE } from './data/jobs.js';
import { radiusHit, strike, forEachTarget } from './combat.js';
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
    const e = JOBS.swordsman.e;
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
    const e = JOBS.knight.e;
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
    const e = JOBS.mage.e;
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
    const e = JOBS.priest.e;
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
    const e = JOBS.archer.e;
    startAction(p, 'cast', 0.4);
    game.sound.se('shoot');
    addZone(game, { kind: 'arrowrain', x: d.tx, z: d.tz, r: e.radius, t: e.dur, every: e.every, tick: 0, mult: e.mult, owner: p.id, local, p });
  },
  // ---- 忍者 ----
  shadowstep(game, p, d, local) {
    const q = JOBS.ninja.q;
    startAction(p, 'dash', q.time);
    p.dodgeX = Math.sin(d.yaw);
    p.dodgeZ = Math.cos(d.yaw);
    p.yaw = d.yaw;
    p.dashSpeed = q.dist / q.time;
    if (local) p.invuln = Math.max(p.invuln, q.time + 0.15);
    const hit = new Set();
    game.sound.se('spin');
    p.skillTick = () => {
      game.fx.burst(p.pos.x, 1, p.pos.z, 0xb39ddb, 3, { speed: 2, up: 1, life: 0.3 });
      if (!local) return;
      forEachTarget(game, (e) => {
        if (hit.has(e)) return;
        if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < e.radius + q.width) {
          hit.add(e);
          strike(game, p, e, q.mult, { melee: true, gauge: GAUGE.gainSkill, color: 0xb39ddb });
        }
      });
    };
  },
  clone(game, p, d, local) {
    const e = JOBS.ninja.e;
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
    const e = JOBS.bard.e;
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

/** E 必殺技 */
export function castE(game, p, intent) {
  const e = p.job.e;
  return cast(game, p, e.id, skillData(game, p, intent, e.dist || 3));
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
  if (z.kind === 'aegis') {
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
