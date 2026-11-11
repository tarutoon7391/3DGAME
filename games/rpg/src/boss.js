// ボス（data/enemies.js の BOSSES の1体）。パターンを重みで選び、予兆 → 実行 → 休み を繰り返す
// 弾幕は「エミッター」（一定間隔で弾を出す小さなタイマー）で時間差に撃つ。HP が rage.at を切ると怒り
import { BOSSES } from './data/enemies.js';
import { makeBossModel } from './models.js';
import { angleDiff, lerpAngle, yawTo, rand } from './util.js';
import { hurtPlayer, nearestPlayer } from './combat.js';
import { HIT } from './data/player.js';

/**
 * @param key BOSSES のキー
 * @param idx エリア内で何番目のボスか（中ボス→ボスの順）
 */
export function createBoss(game, key, x, z, idx = 0) {
  const C = BOSSES[key];
  const m = makeBossModel(C.color, C.look);
  m.group.position.set(x, 0, z);
  m.group.rotation.y = 0;
  game.scene.add(m.group);
  const P = C.patterns;
  const R = C.rage || null;
  const shotHit = C.shotHit ?? HIT.boss;

  const b = {
    key, idx,
    name: C.name,
    model: m,
    pos: m.group.position,
    radius: C.radius,
    defense: C.def,
    hpY: C.hpY,
    hp: C.hp,
    maxHp: C.hp,
    alive: true,
    active: false, // 戦闘開始まで false（攻撃も当たらない）
    raged: false,
    state: 'sleep',
    t: 0,
    yaw: 0,
    pattern: null,
    tele: null,
    jump: null,
    dash: null,
    flash: 0,
    summonT: 0,
    lastPattern: '',
    queued: null, // 追撃（after）
    emitters: [], // { delay, every, n, i, fn }
    zones: [], // 隕石 { x, z, r, t, tele, burst, color }
    takeHit(g, dmg) {
      if (b.state === 'rage') dmg = 0; // 怒りの咆哮中は無敵
      b.hp = Math.max(0, b.hp - dmg);
      b.flash = 0.1;
      if (b.hp <= 0 && b.alive) die();
      else if (R && !b.raged && b.hp <= C.hp * R.at) enrage();
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
      cancelAll();
      game.scene.remove(m.group);
      m.bodyMat.dispose();
    },
  };

  const wm = () => (b.raged ? R.windupMul : 1);
  const sm = () => (b.raged ? R.speedMul : 1);
  const cm = () => (b.raged ? R.countMul ?? 1 : 1);
  /** 怒り中は rageXxx があればそちらを使う */
  const rv = (p, k, def) => {
    const rk = 'rage' + k[0].toUpperCase() + k.slice(1);
    return b.raged && p[rk] !== undefined ? p[rk] : p[k] ?? def;
  };
  const kindOf = (name) => P[name].kind || name;

  function cancelAll() {
    if (b.tele) b.tele.end();
    b.tele = null;
    b.jump = null;
    b.dash = null;
    b.queued = null;
    b.emitters.length = 0;
    for (const zn of b.zones) zn.tele.end();
    b.zones.length = 0;
  }

  function enrage() {
    b.raged = true;
    cancelAll();
    b.pos.y = 0;
    b.state = 'rage';
    b.t = 0;
    b.summonT = 3;
    game.sound.se('roar');
    game.fx.shake(1);
    game.toast(`${C.name}が怒り狂った！ 攻撃が激しくなる！`, 3000);
  }

  function die() {
    b.alive = false;
    b.state = 'dead';
    b.t = 0;
    cancelAll();
    b.pos.y = 0;
    game.sound.se('roar');
    game.fx.shake(1.2);
  }

  /** 重み付きで次のパターンを選ぶ（同じものが続きにくい） */
  function choose(tgt) {
    const d = Math.hypot(tgt.pos.x - b.pos.x, tgt.pos.z - b.pos.z);
    const table = d < C.nearRange ? C.near : C.far;
    const total = Object.values(table).reduce((a, c) => a + c, 0);
    const pick = () => {
      let r = Math.random() * total;
      for (const [k, w] of Object.entries(table)) {
        r -= w;
        if (r <= 0) return k;
      }
      return Object.keys(table)[0];
    };
    let name = pick();
    if (name === b.lastPattern && Math.random() < 0.6) name = pick();
    b.lastPattern = name;
    return name;
  }

  function shot(x, z, yaw, speed, color) {
    game.projectiles.enemyShot(x, z, yaw, speed, shotHit, color);
  }

  function ring(cx, cz, count, offset, speed, color) {
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2;
      shot(cx + Math.sin(a) * 2, cz + Math.cos(a) * 2, a, speed, color);
    }
    game.sound.se('shoot');
  }

  function emit(delay, every, n, fn) {
    b.emitters.push({ delay, every, n, i: 0, fn });
  }

  function startPattern(name, tgt) {
    b.pattern = name;
    b.state = 'windup';
    b.t = 0;
    b.yaw = yawTo(b.pos.x, b.pos.z, tgt.pos.x, tgt.pos.z);
    const p = P[name];
    const dur = p.windup * wm();
    game.sound.se('windup');
    switch (kindOf(name)) {
      case 'sweep':
        b.tele = game.fx.telegraph('sector', { x: b.pos.x, z: b.pos.z, r: p.range + 0.5, arc: p.arc, angle: b.yaw, dur });
        break;
      case 'slam':
        b.jump = { sx: b.pos.x, sz: b.pos.z, tx: tgt.pos.x, tz: tgt.pos.z };
        b.tele = game.fx.telegraph('circle', { x: tgt.pos.x, z: tgt.pos.z, r: p.radius, dur: dur + p.air * wm() });
        break;
      case 'fan': {
        const n = Math.round(p.count * cm());
        b.tele = game.fx.telegraph('sector', { x: b.pos.x, z: b.pos.z, r: 12, arc: Math.min(Math.PI * 1.6, p.spread * n), angle: b.yaw, dur });
        break;
      }
      case 'charge':
        b.tele = game.fx.telegraph('rect', { x: b.pos.x, z: b.pos.z, len: p.speed * p.time, width: p.width, angle: b.yaw, dur });
        break;
      case 'rain': {
        const n = Math.round(rv(p, 'count', 6));
        for (let i = 0; i < n; i++) {
          // 1つは必ず足元に、残りはまわりにばらまく
          const a = rand(0, Math.PI * 2);
          const r = i === 0 ? 0 : rand(2, p.spreadR);
          const zx = tgt.pos.x + Math.sin(a) * r;
          const zz = tgt.pos.z + Math.cos(a) * r;
          const life = dur + p.delay + i * 0.08;
          b.zones.push({ x: zx, z: zz, r: p.radius, t: life, burst: p.burst, color: p.color, tele: game.fx.telegraph('circle', { x: zx, z: zz, r: p.radius, dur: life }) });
        }
        break;
      }
      default: // ring / spiral：自分の周り
        b.tele = game.fx.telegraph('circle', { x: b.pos.x, z: b.pos.z, r: 3, dur });
        break;
    }
  }

  /** 予備動作が終わった瞬間に攻撃する */
  function execute() {
    const name = b.pattern;
    const p = P[name];
    switch (kindOf(name)) {
      case 'sweep':
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
        break;
      case 'ring': {
        const n = Math.round(p.count * cm());
        const waves = rv(p, 'waves', 1);
        const sp = p.speed * (b.raged ? p.rageSpeedMul ?? 1 : 1);
        const off = rand(0, 1);
        // 波ごとに半歩ずらして隙間をふさぐ
        emit(0, p.waveGap ?? 0.4, waves, (i) => ring(b.pos.x, b.pos.z, n, off + (i % 2) * (Math.PI / n), sp, p.color));
        break;
      }
      case 'fan': {
        const n = Math.round(p.count * cm());
        emit(0, p.interval, p.volleys, (i) => {
          const t = nearestPlayer(game, b.pos.x, b.pos.z);
          if (t) b.yaw = yawTo(b.pos.x, b.pos.z, t.pos.x, t.pos.z);
          const shift = p.alternate && i % 2 ? p.spread / 2 : 0;
          for (let k = 0; k < n; k++) {
            const a = b.yaw + (k - (n - 1) / 2) * p.spread + shift;
            shot(b.pos.x + Math.sin(a) * 1.5, b.pos.z + Math.cos(a) * 1.5, a, p.speed, p.color);
          }
          game.sound.se('shoot');
        });
        break;
      }
      case 'spiral': {
        const arms = Math.round(p.arms * cm());
        const twin = rv(p, 'twin', false);
        const steps = Math.round(p.dur / p.interval);
        const base = rand(0, Math.PI * 2);
        emit(0, p.interval, steps, (i) => {
          for (let k = 0; k < arms; k++) {
            const a = base + i * p.turn + (k / arms) * Math.PI * 2;
            shot(b.pos.x + Math.sin(a) * 1.8, b.pos.z + Math.cos(a) * 1.8, a, p.speed, p.color);
            if (twin) {
              const a2 = base - i * p.turn + (k / arms) * Math.PI * 2 + Math.PI / arms;
              shot(b.pos.x + Math.sin(a2) * 1.8, b.pos.z + Math.cos(a2) * 1.8, a2, p.speed * 0.85, p.color);
            }
          }
          if (i % 4 === 0) game.sound.se('shoot');
        });
        break;
      }
      case 'charge':
        b.dash = { t: 0, trail: 0, hit: new Set() };
        b.state = 'charge';
        b.t = 0;
        game.sound.se('swing');
        return;
      default: // rain は予兆の時点で配置済み
        break;
    }
    b.state = 'act';
    b.t = 0;
  }

  /** 弾幕のタイマーと隕石を進める */
  function updateEmitters(dt) {
    for (let i = b.emitters.length - 1; i >= 0; i--) {
      const e = b.emitters[i];
      e.delay -= dt;
      while (e.delay <= 0 && e.n > 0) {
        e.fn(e.i++);
        e.n--;
        e.delay += e.every;
      }
      if (e.n <= 0) b.emitters.splice(i, 1);
    }
    for (let i = b.zones.length - 1; i >= 0; i--) {
      const zn = b.zones[i];
      zn.t -= dt;
      if (zn.t > 0) continue;
      zn.tele.end();
      b.zones.splice(i, 1);
      for (const pl of game.players) {
        if (Math.hypot(pl.pos.x - zn.x, pl.pos.z - zn.z) < zn.r + pl.radius) hurtPlayer(game, pl, HIT.boss, zn.x, zn.z);
      }
      game.fx.burst(zn.x, 0.4, zn.z, zn.color, 18, { speed: 6, up: 6, life: 0.6, size: 0.22 });
      game.sound.se('slam');
      // 着弾点からまわりに弾を散らす
      const n = Math.round(zn.burst * cm());
      const off = rand(0, 1);
      for (let k = 0; k < n; k++) shot(zn.x, zn.z, off + (k / n) * Math.PI * 2, 6, zn.color);
    }
  }

  function update(dt) {
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    const tgt = nearestPlayer(game, b.pos.x, b.pos.z);
    let walking = false;
    if (b.alive) updateEmitters(dt);

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
          const spd = C.speed * sm() * dt;
          if (C.keep && d < C.keep - 1) {
            // 魔導士型：近づかれたら下がる
            b.pos.x -= Math.sin(b.yaw) * spd;
            b.pos.z -= Math.cos(b.yaw) * spd;
            walking = true;
          } else if (d > (C.keep || 4)) {
            b.pos.x += Math.sin(b.yaw) * spd;
            b.pos.z += Math.cos(b.yaw) * spd;
            walking = true;
          }
          if (b.queued) {
            // 追撃（近接のあとの弾幕など）はすぐ出す
            const q = b.queued;
            b.queued = null;
            startPattern(q, tgt);
            break;
          }
          if (b.restDur == null) b.restDur = rand(C.restMin, C.restMax) / sm();
          if (b.t > b.restDur + 0.3) {
            b.restDur = null;
            startPattern(choose(tgt), tgt);
          }
        }
        // 怒り中は手下を呼ぶ
        if (b.raged && R.summon) {
          b.summonT -= dt;
          if (b.summonT <= 0 && game.enemies.aliveCount() < R.summonMax) {
            b.summonT = R.summonEvery;
            for (const s of [-1, 1]) {
              const ex = b.pos.x + s * R.summonOffset[0];
              const ez = b.pos.z + R.summonOffset[1];
              game.enemies.spawn(R.summon, ex, ez).state = 'chase';
              game.fx.burst(ex, 1, ez, 0x7e57c2, 20, { speed: 4, up: 4, life: 0.6 });
            }
            game.toast(`${C.name}が手下を呼んだ！`);
          }
        }
        break;
      case 'windup': {
        const p = P[b.pattern];
        const kind = kindOf(b.pattern);
        const dur = p.windup * wm();
        if (kind === 'sweep' || kind === 'fan' || kind === 'charge') {
          // 前半だけプレイヤーを追って向きを変える
          if (tgt && b.t < dur * (kind === 'charge' ? 0.6 : 0.4)) {
            b.yaw = lerpAngle(b.yaw, yawTo(b.pos.x, b.pos.z, tgt.pos.x, tgt.pos.z), Math.min(1, dt * 3));
            b.tele?.follow(b.pos.x, b.pos.z, b.yaw);
          }
          if (kind === 'charge') {
            m.root.rotation.x = 0.35;
            m.armR.rotation.set(-1.4, 0, 0);
          } else {
            m.armR.rotation.set(-Math.PI / 2, 1.5, 0);
            m.root.rotation.y = 0.5;
          }
          if (b.t >= dur) {
            b.tele?.end();
            b.tele = null;
            m.root.rotation.x = 0;
            execute();
          }
        } else if (kind === 'slam') {
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
              // 着地で弾の輪（怒り中は rageRing をそのまま使う）
              const n = b.raged && p.rageRing !== undefined ? p.rageRing : Math.round((p.ring || 0) * cm());
              if (n > 0) ring(b.pos.x, b.pos.z, n, rand(0, 1), 9, p.color);
              b.state = 'act';
              b.t = 0;
            }
          }
        } else {
          // ring / spiral / rain：両手を掲げてためる
          m.armL.rotation.set(-2.8, 0, 0.3);
          m.armR.rotation.set(-2.8, 0, -0.3);
          if (b.t >= dur) {
            b.tele?.end();
            b.tele = null;
            execute();
          }
        }
        break;
      }
      case 'charge': {
        const p = P[b.pattern];
        const dsh = b.dash;
        dsh.t += dt;
        dsh.trail += dt;
        const sx = Math.sin(b.yaw);
        const sz = Math.cos(b.yaw);
        b.pos.x += sx * p.speed * dt;
        b.pos.z += sz * p.speed * dt;
        for (const pl of game.players) {
          if (dsh.hit.has(pl)) continue;
          if (Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z) < b.radius + pl.radius + 0.3) {
            if (hurtPlayer(game, pl, HIT.boss, b.pos.x - sx, b.pos.z - sz)) dsh.hit.add(pl);
          }
        }
        // 通った跡から左右に弾を撃つ
        while (dsh.trail >= p.trailEvery) {
          dsh.trail -= p.trailEvery;
          for (const s of [-1, 1]) shot(b.pos.x, b.pos.z, b.yaw + (s * Math.PI) / 2, p.trailSpeed, p.color);
        }
        if (Math.random() < 0.6) game.fx.burst(b.pos.x, 0.5, b.pos.z, p.color, 2, { speed: 2, up: 2, life: 0.4 });
        // 壁にぶつかったら止まる
        const px = b.pos.x;
        const pz = b.pos.z;
        game.world.collide(b.pos, b.radius);
        const bumped = Math.abs(px - b.pos.x) + Math.abs(pz - b.pos.z) > 0.01;
        if (dsh.t >= p.time || bumped) {
          if (bumped) {
            game.fx.shake(0.6);
            game.sound.se('slam');
          }
          b.dash = null;
          b.state = 'act';
          b.t = 0;
        }
        break;
      }
      case 'act':
        m.armR.rotation.set(-0.5, -0.8, 0);
        m.root.rotation.y = -0.3;
        // 弾幕を撃ち終わるまでその場で踏ん張る
        if (b.t > 0.6 && b.emitters.length === 0) {
          b.state = 'rest';
          b.t = 0;
          const after = P[b.pattern]?.after;
          if (after && P[after]) b.queued = after;
        }
        break;
      case 'dead':
        m.root.rotation.x = Math.min(1.5, b.t * 1.2);
        m.group.position.y = -Math.max(0, b.t - 1.2) * 0.8;
        if (Math.random() < 0.5) game.fx.burst(b.pos.x + rand(-2, 2), rand(1, 4), b.pos.z + rand(-2, 2), 0xff6e40, 3, { speed: 3, up: 4, life: 0.7 });
        if (b.t > 2.4 && !b.reported) {
          b.reported = true;
          game.onBossDown(b);
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
      m.root.rotation.set(0, 0, 0);
      m.root.position.y = 0;
    }
    const glow = b.state === 'windup' || b.state === 'charge' ? 0.5 + 0.5 * Math.sin(b.t * 25) : b.raged ? 0.25 : 0;
    m.bodyMat.emissive.setRGB(b.flash > 0 ? 1 : glow, b.flash > 0 ? 1 : 0, b.flash > 0 ? 1 : 0);
  }

  return b;
}
