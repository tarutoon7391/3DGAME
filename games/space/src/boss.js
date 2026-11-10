// ボス：部位（弱点／装甲）の組み立て・移動・攻撃パターン・撃破演出
import * as THREE from 'three';
import { segHitsSphere, rand, TAU } from './util.js';

const SHAPES = {
  sphere: (s) => new THREE.SphereGeometry(s, 20, 14),
  ico: (s) => new THREE.IcosahedronGeometry(s, 1),
  dodeca: (s) => new THREE.DodecahedronGeometry(s, 0),
  box: (s) => new THREE.BoxGeometry(s[0], s[1], s[2]),
  cyl: (s) => new THREE.CylinderGeometry(s[0], s[1], s[2], 12).rotateX(Math.PI / 2),
  cone: (s) => new THREE.ConeGeometry(s[0], s[1], 8).rotateX(Math.PI / 2),
  torus: (s) => new THREE.TorusGeometry(s[0], s[1], 8, 32),
};
const DEFAULT_R = {
  sphere: (s) => s, ico: (s) => s * 0.95, dodeca: (s) => s * 0.9,
  box: (s) => Math.min(s[0], s[1], s[2]) / 2, cyl: (s) => Math.max(s[0], s[1]) * 1.1,
  cone: (s) => s[0], torus: (s) => s[1],
};

// ---- 攻撃パターン。every 秒ごとに fire(b, k) を呼び、dur 秒で終わる ----
const PATTERNS = {
  // 拡散リング：ボスの正面から広がる輪
  ring: { dur: 2.2, every: 0.55, fire(b, k) {
    const n = Math.round(16 * b.dens);
    const r = [0.07, 0.13, 0.19][k % 3];
    for (let i = 0; i < n; i++) {
      const a = k * 0.2 + (i / n) * TAU;
      b.shoot(Math.cos(a) * r, Math.sin(a) * r, 1, 0.9, 0xff5ab4);
    }
  } },
  // 自機狙い3way
  aimed3: { dur: 2.2, every: 0.32, fire(b) { b.aimed(3, 0.09, 1.15, 0xffa040); } },
  // 回転弾
  spiral: { dur: 3.0, every: 0.075, fire(b, k) {
    const arms = b.dens > 1.1 ? 3 : 2;
    for (let j = 0; j < arms; j++) {
      const a = k * 0.33 + (j * TAU) / arms;
      b.shoot(Math.cos(a) * 0.16, Math.sin(a) * 0.16, 1, 0.85, 0xc070ff);
    }
  } },
  // 弾幕の壁（隙間あり）。横壁と縦壁を交互に
  sweep: { dur: 2.8, every: 0.9, fire(b, k) {
    const m = b.muzzle, t = b.target;
    if (k % 2 === 0) {
      const gap = rand(-11, 11);
      for (let x = -19; x <= 19; x += 2.2) if (Math.abs(x - gap) > 3.6) b.fireAt(x, t.y, m.z, 0, 0, 1, 0.8, 0x66f0ff);
    } else {
      const gap = rand(-6, 6);
      for (let y = -11; y <= 11; y += 2.2) if (Math.abs(y - gap) > 3.4) b.fireAt(t.x, y, m.z, 0, 0, 1, 0.8, 0x66f0ff);
    }
  } },
  // 自機狙いの高速連射
  aimedBurst: { dur: 1.6, every: 0.09, fire(b) { b.aimed(1, 0, 1.4, 0xffe066, 0.03); } },
  // 隕石を投げる
  rocks: { dur: 2.4, every: 0.45, fire(b, k) {
    const m = b.muzzle;
    b.spawn(k % 4 === 3 ? 'ironRock' : 'rock', m.x + rand(-10, 10), m.y + rand(-6, 6), m.z + 8);
  } },
  // 突撃機を射出
  rammers: { dur: 2.0, every: 0.5, fire(b, k) {
    const m = b.muzzle;
    b.spawn('rammer', m.x + (k % 2 ? 8 : -8), m.y + rand(-4, 4), m.z + 6);
  } },
};

const tmpA = new THREE.Vector3();

/**
 * @param {THREE.Scene} scene
 * @param {object} def data/bosses.js の1件
 * @param {object} g ゲーム（diff・fireEnemy・spawnEnemy・fx・sfx・target を使う）
 */
export function createBoss(scene, def, g) {
  const group = new THREE.Group();
  scene.add(group);
  const parts = [];
  const pivots = [];
  const hpMul = g.diff.bossHp;

  function makePart(pd, parent) {
    const geo = SHAPES[pd.shape](pd.size);
    const mat = new THREE.MeshStandardMaterial({
      color: pd.color, flatShading: true, roughness: 0.55, metalness: 0.35,
      emissive: pd.weak ? pd.color : 0x000000, emissiveIntensity: pd.weak ? 0.9 : 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.fromArray(pd.pos);
    mesh.castShadow = true;
    parent.add(mesh);
    const hp = (pd.hp || 0) * hpMul;
    parts.push({
      def: pd, id: pd.id, mesh, mat, weak: !!pd.weak, hp, maxHp: hp,
      r: pd.r ?? DEFAULT_R[pd.shape](pd.size), collide: pd.collide !== false,
      dead: false, flash: 0, wpos: new THREE.Vector3(), requires: null,
    });
  }
  def.parts.forEach((pd) => makePart(pd, group));
  (def.rings || []).forEach((r) => {
    const pivot = new THREE.Group();
    pivot.position.z = r.z;
    group.add(pivot);
    pivots.push({ pivot, speed: r.speed });
    for (let i = 0; i < r.count; i++) {
      const a = (i / r.count) * TAU;
      makePart({ ...r.part, pos: [Math.cos(a) * r.radius, Math.sin(a) * r.radius, 0] }, pivot);
    }
  });
  parts.forEach((p) => {
    if (p.def.requires) p.requires = p.def.requires.map((id) => parts.find((q) => q.id === id));
  });
  const weak = parts.filter((p) => p.weak);
  const maxHp = weak.reduce((s, p) => s + p.maxHp, 0);

  group.position.set(0, 0, -280);
  const muzzle = new THREE.Vector3();
  let t = 0;
  let entering = true;
  let phase2 = false;
  let patList = def.patterns;
  let patIdx = -1, patT = 0, patK = 0, nextShot = 0, rest = 1.0;
  let deathT = 0, boomT = 0;

  // パターンから使う発射ヘルパ
  const b = {
    muzzle,
    target: g.target,
    dens: g.diff.density,
    shoot(dx, dy, dz, sp, color) {
      g.fireEnemy(muzzle.x, muzzle.y, muzzle.z, dx, dy, dz, sp, color);
    },
    fireAt(x, y, z, dx, dy, dz, sp, color) {
      g.fireEnemy(x, y, z, dx, dy, dz, sp, color);
    },
    aimed(n, spread, sp, color, jitter = 0) {
      g.fireAimed(muzzle, sp, spread, n, color, jitter);
    },
    spawn(type, x, y, z) {
      g.spawnEnemy(type, x, y, z);
    },
  };

  const boss = {
    name: def.name,
    group,
    parts,
    defeated: false,
    finished: false,
    get entering() { return entering; },
    hp: () => weak.reduce((s, p) => s + Math.max(0, p.hp), 0),
    ratio: () => boss.hp() / maxHp,
    isVulnerable: (p) => p.weak && !p.dead && (!p.requires || p.requires.every((q) => q.dead)),
  };

  boss.update = (dt) => {
    t += dt;
    const pos = group.position;
    if (entering) {
      pos.z += (def.z - pos.z) * Math.min(1, dt * 1.1);
      if (Math.abs(pos.z - def.z) < 1) entering = false;
    } else if (!boss.defeated) {
      const mv = def.move;
      pos.x += (Math.sin(t * mv.fx) * mv.ax - pos.x) * Math.min(1, dt * 2);
      pos.y += (Math.sin(t * mv.fy) * mv.ay - pos.y) * Math.min(1, dt * 2);
    } else {
      pos.y -= dt * 2;
      group.rotation.z += dt * 0.4;
    }
    pivots.forEach((pv) => { pv.pivot.rotation.z += pv.speed * (phase2 ? 1.6 : 1) * dt; });
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const sp = p.def.spin;
      if (sp) {
        p.mesh.rotation.x += sp[0] * dt;
        p.mesh.rotation.y += sp[1] * dt;
        p.mesh.rotation.z += sp[2] * dt;
      }
      if (p.weak && !p.dead) {
        p.flash = Math.max(0, p.flash - dt);
        const locked = !boss.isVulnerable(p);
        p.mat.emissiveIntensity = p.flash > 0 ? 3 : locked ? 0.15 : 0.7 + Math.sin(t * 6) * 0.3;
      }
    }
    group.updateMatrixWorld(true);
    for (let i = 0; i < parts.length; i++) parts[i].mesh.getWorldPosition(parts[i].wpos);
    muzzle.fromArray(def.muzzle).add(pos);

    if (!entering && !boss.defeated) {
      if (!phase2 && boss.ratio() <= 0.5) {
        phase2 = true;
        patList = def.patterns2;
        parts.forEach((p) => { if (!p.weak) p.mat.emissive.setHex(0x401010); });
        g.onBossRage();
      }
      runPattern(dt);
    }
    if (boss.defeated && !boss.finished) {
      deathT += dt;
      boomT -= dt;
      if (boomT <= 0) {
        boomT = 0.12;
        const p = parts[Math.floor(Math.random() * parts.length)];
        tmpA.copy(p.wpos).add({ x: rand(-3, 3), y: rand(-3, 3), z: rand(-2, 2) });
        g.fx.explode(tmpA, 0xff8a30, 18, 16, 1, 0.7);
        g.sfx.explode();
        g.fx.shake(0.5);
      }
      if (deathT > 2.4) {
        g.fx.explode(pos, 0xffd080, 120, 40, 2, 1.4);
        g.fx.explode(pos, 0xff4060, 60, 25, 1.5, 1.2);
        g.sfx.bigExplode();
        g.fx.shake(1.6);
        g.ui.flash('#ffffff', 0.8);
        group.visible = false;
        boss.finished = true;
      }
    }
  };

  function runPattern(dt) {
    if (rest > 0) {
      rest -= dt;
      if (rest <= 0) {
        patIdx = (patIdx + 1) % patList.length;
        patT = 0;
        patK = 0;
        nextShot = 0;
      }
      return;
    }
    const P = PATTERNS[patList[patIdx]];
    const every = (P.every * (phase2 ? 0.75 : 1)) / g.diff.bossFire;
    patT += dt;
    nextShot -= dt;
    while (nextShot <= 0 && patT < P.dur) {
      P.fire(b, patK++);
      nextShot += every;
    }
    if (patT >= P.dur) rest = phase2 ? 0.6 : 1.1;
  }

  /** 線分 a→b が当たる部位（自機に一番近い＝z が大きいもの）を返す。なければ null */
  boss.hitTest = (a, c) => {
    if (entering || boss.defeated) return null;
    let best = null;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.collide || p.dead) continue;
      if (segHitsSphere(a, c, p.wpos, p.r + 0.3) && (!best || p.wpos.z > best.wpos.z)) best = p;
    }
    return best;
  };

  /** 部位にダメージ。'armor'（はじいた）/'hit'/'break'（弱点破壊）/'kill'（撃破） */
  boss.damage = (p, dmg) => {
    if (!boss.isVulnerable(p)) return 'armor';
    p.hp -= dmg;
    p.flash = 0.05;
    if (p.hp > 0) return 'hit';
    p.dead = true;
    p.mesh.visible = false;
    g.fx.explode(p.wpos, 0xff5060, 50, 26, 1.2, 1);
    if (weak.every((q) => q.dead)) {
      boss.defeated = true;
      return 'kill';
    }
    return 'break';
  };

  boss.dispose = () => {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    group.removeFromParent();
  };

  return boss;
}
