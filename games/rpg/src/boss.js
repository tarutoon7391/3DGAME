// ボス（data/enemies.js の BOSSES の1体）。パターンを重みで選び、予兆 → 実行 → 休み を繰り返す
// 弾幕は「エミッター」（一定間隔で弾を出す小さなタイマー）で時間差に撃つ。HP が rage.at を切ると怒り
// ブレイク：主に近接で溜まるブレイク値が上限に達すると、数秒 気絶して被ダメージ 1.5倍
// 協力プレイ：ホストだけが本物を動かす。参加者のブラウザでは puppet（届いた状態を描くだけ）になる
import * as THREE from 'three';
import { BOSSES } from './data/enemies.js';
import { makeBossModel } from './models.js';
import { angleDiff, lerpAngle, yawTo, rand } from './util.js';
import { hurtPlayer, bossTarget } from './combat.js';
import { HIT } from './data/player.js';

const BREAK = { ratio: 0.22, stun: 4, dmgMul: 1.5 };
/** 気絶系の効き目の減り方：かかるたびに ×0.7（最低 25%）。ブレイク気絶と時間停止で回数を共有 */
const CC_DECAY = { per: 0.7, min: 0.25 }; // ブレイク値の上限＝最大HP×ratio、気絶秒数、気絶中の被ダメ倍率

/**
 * @param key BOSSES のキー
 * @param idx エリア内で何番目のボスか（中ボス→ボスの順）
 * @param o { puppet: 参加者側の見た目だけ, scale: 人数による HP 倍率 }
 */
export function createBoss(game, key, x, z, idx = 0, { puppet = false, scale = 1, sub = 0 } = {}) {
  const C = BOSSES[key];
  const m = makeBossModel(C.color, C.look);
  m.group.position.set(x, 0, z);
  m.group.rotation.y = 0;
  game.scene.add(m.group);
  const P = C.patterns;
  const R = C.rage || null;
  const shotHit = C.shotHit ?? HIT.boss;
  const meleeHit = C.meleeHit ?? HIT.boss;
  const maxHp = Math.round(C.hp * scale);

  // 広がる衝撃波の輪の見た目
  const novaGeo = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);
  const novaMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });

  const b = {
    key, idx, sub, puppet, // sub：同じ部屋の何体目か（2体同時の部屋で 0 と 1）
    name: C.name,
    model: m,
    pos: m.group.position,
    radius: C.radius,
    defense: C.def,
    hpY: C.hpY,
    hp: maxHp,
    maxHp,
    brk: 0, // ブレイク値
    brkMax: Math.round(maxHp * BREAK.ratio),
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
    queued: null, // 追撃（after / then）
    emitters: [], // { delay, every, n, i, fn }
    zones: [], // 時間差で落ちる円（隕石・噴火） { x, z, r, t, tele, burst, color }
    novas: [], // 広がる輪 { r, max, speed, width, hit:Set, mesh, x, z }
    stalkers: [], // 追尾する赤円 { tgt, x, z, t, follow, delay, r, tele, color }
    taunt: null, // 挑発 { id, t }
    debuffs: {}, // 弱体化 { vuln: {t, mul}, slow: {t, mul} }（錬金術師の腐食・時魔導士の鈍化）
    net: null, // puppet：届いた状態
    takeHit(g, dmg, dx, dz, knock, o = {}) {
      if (puppet) {
        // 参加者：ホストへ送る。見た目だけ先に反映
        b.flash = 0.1;
        game.raid?.sendDamage('boss', sub, dmg, o.brk || 0);
        return;
      }
      // ホスト：ブレイク・怒りの演出も参加者に見せる
      if (game.withMirror) game.withMirror(() => applyDamage(dmg, o.brk || 0));
      else applyDamage(dmg, o.brk || 0);
    },
    applyDamage, // ホスト：参加者から届いたダメージ
    /** 戦闘開始（ボス部屋に入った） */
    wake() {
      if (b.active) return;
      b.active = true;
      b.state = 'intro';
      b.t = 0;
      game.sound.se('roar');
      game.fx.shake(0.8);
    },
    update: puppet ? updatePuppet : update,
    /** 参加者：ホストからの状態 */
    applyNet(s) {
      b.net = s;
      b.hp = s.hp;
      b.maxHp = s.maxHp;
      b.brk = s.brk;
      b.brkMax = s.brkMax;
      b.raged = s.raged;
      b.active = s.active;
      if (b.alive && !s.alive) b.state = 'dead';
      b.alive = s.alive;
      if (s.state !== b.state && b.state !== 'dead') {
        b.state = s.state;
        b.t = 0;
      }
      b.pattern = s.pattern;
      // 参加者：弱体化の有無だけ（見た目と錬金術師の特性用）
      b.debuffs = {};
      if (s.vuln) b.debuffs.vuln = { t: 1, mul: 1 };
      if (s.slow) b.debuffs.slow = { t: 1, mul: 1 };
    },
    /** 参加者：ホストから届いた「場の仕掛け」を再生する（輪・壁・引き寄せは自分に当たったかをこちらで判定） */
    playFx(name, d) {
      if (name === 'nova') spawnNova(d.x, d.z, d.max, d.speed, d.width, d.color);
      else if (name === 'wall') game.hazards?.wall(d);
      else if (name === 'donut') game.hazards?.donut(d);
      else if (name === 'pull') game.hazards?.startPull(d);
    },
    dispose() {
      cancelAll();
      for (const n of b.novas) game.scene.remove(n.mesh);
      b.novas.length = 0;
      game.scene.remove(m.group);
      m.bodyMat.dispose();
      novaMat.dispose();
      novaGeo.dispose();
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

  function applyDamage(dmg, brk) {
    if (!b.alive) return;
    if (b.state === 'rage') dmg = 0; // 怒りの咆哮中は無敵
    if (b.state === 'stun') dmg = Math.round(dmg * BREAK.dmgMul);
    if (b.debuffs.vuln) dmg = Math.round(dmg * b.debuffs.vuln.mul); // 腐食：被ダメージ増
    if (b.shred) dmg = Math.round(dmg * (1 + b.shred.n * b.shred.per)); // 鎧砕き
    b.hp = Math.max(0, b.hp - dmg);
    b.flash = 0.1;
    if (b.state !== 'stun' && b.active && b.state !== 'rage' && b.state !== 'intro') {
      b.brk += brk;
      if (b.brk >= b.brkMax) breakDown();
    }
    if (b.hp <= 0) die();
    else if (R && !b.raged && b.hp <= maxHp * R.at && b.state !== 'stun') enrage();
  }

  function cancelAll() {
    if (b.tele) b.tele.end();
    b.tele = null;
    b.jump = null;
    b.dash = null;
    b.queued = null;
    b.emitters.length = 0;
    for (const zn of b.zones) zn.tele.end();
    b.zones.length = 0;
    for (const st of b.stalkers) st.tele.end();
    b.stalkers.length = 0;
    b.pos.y = 0;
  }

  /** 場の仕掛けを出して、参加者にも同じものを出させる */
  function hazard(name, d) {
    b.playFx(name, d);
    game.raid?.bossFx(name, d);
  }

  /** 追尾する赤円：follow 秒間 標的の足元を追い、止まって delay 秒後に噴き上がる */
  function spawnStalker(p) {
    const alive = game.players.filter((o) => o.alive);
    const tgt = alive.length ? alive[Math.floor(Math.random() * alive.length)] : bossTarget(game, b);
    if (!tgt) return;
    const dur = p.follow + p.delay;
    b.stalkers.push({ tgt, x: tgt.pos.x, z: tgt.pos.z, t: 0, follow: p.follow, delay: p.delay, r: p.radius, color: p.color,
      tele: game.fx.telegraph('circle', { x: tgt.pos.x, z: tgt.pos.z, r: p.radius, dur }) });
    game.sound.se('windup');
  }
  function updateStalkers(dt) {
    for (let i = b.stalkers.length - 1; i >= 0; i--) {
      const st = b.stalkers[i];
      st.t += dt;
      if (st.t < st.follow) {
        // 少し遅れて追いかける（走れば振り切れる）
        const k = Math.min(1, dt * 2.6);
        st.x += (st.tgt.pos.x - st.x) * k;
        st.z += (st.tgt.pos.z - st.z) * k;
        st.tele.follow(st.x, st.z, 0);
      } else if (st.t >= st.follow + st.delay) {
        st.tele.end();
        b.stalkers.splice(i, 1);
        hitAll(inCircle(st.x, st.z, st.r), meleeHit, st.x, st.z);
        game.fx.burst(st.x, 0.5, st.z, st.color, 30, { speed: 5, up: 11, life: 0.7, size: 0.24 });
        game.sound.se('slam');
      }
    }
  }

  /** 気絶系の効き目（かかった回数が多いほど短い） */
  function ccMul() {
    const k = Math.max(CC_DECAY.min, Math.pow(CC_DECAY.per, b.ccCount || 0));
    b.ccCount = (b.ccCount || 0) + 1;
    return k;
  }
  function breakDown() {
    cancelAll();
    b.brk = 0;
    const k = ccMul();
    b.stunFor = BREAK.stun * k;
    b.state = 'stun';
    b.t = 0;
    game.sound.se('slam');
    game.fx.shake(0.8);
    game.fx.burst(b.pos.x, C.hpY * 0.8, b.pos.z, 0xffee58, 50, { speed: 6, up: 5, life: 0.9 });
    game.toast(`ブレイク！ ${C.name}が${b.stunFor.toFixed(1)}秒 気絶した！ 今がチャンス（被ダメージ ${BREAK.dmgMul}倍）${k < 1 ? '　※慣れてきて気絶が短くなっている' : ''}`, 2600);
  }

  function enrage() {
    b.raged = true;
    cancelAll();
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
    if (name === b.lastPattern && Math.random() < 0.7) name = pick();
    b.lastPattern = name;
    return name;
  }

  /** test(x,z,r) が真のプレイヤー（と召喚物）に攻撃を当てる */
  function hitAll(test, frac, fx, fz) {
    for (const pl of game.players) if (pl.alive && test(pl.pos.x, pl.pos.z, pl.radius, pl)) hurtPlayer(game, pl, frac, fx, fz);
    game.allies?.hitBy(test, frac);
  }
  const inCircle = (cx, cz, r) => (x, z, pr) => (x - cx) ** 2 + (z - cz) ** 2 < (r + pr) ** 2;
  const inRect = (ox, oz, yaw, len, w) => (x, z, pr) => {
    const s = Math.sin(yaw);
    const c = Math.cos(yaw);
    const dx = x - ox;
    const dz = z - oz;
    const along = dx * s + dz * c;
    const side = dx * c - dz * s;
    return along > -pr && along < len + pr && Math.abs(side) < w / 2 + pr;
  };

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

  function spawnNova(x, z, max, speed, width, color) {
    const mesh = new THREE.Mesh(novaGeo, novaMat);
    novaMat.color.setHex(color ?? 0xffffff);
    mesh.position.set(x, 0.15, z);
    mesh.scale.setScalar(0.5);
    game.scene.add(mesh);
    b.novas.push({ x, z, r: 0.5, max, speed, width, hit: new Set(), mesh });
  }

  function updateNovas(dt) {
    for (let i = b.novas.length - 1; i >= 0; i--) {
      const n = b.novas[i];
      n.r += n.speed * dt;
      n.mesh.scale.set(n.r, 1 + n.width * 3, n.r);
      // 当たり判定は自分のブラウザのプレイヤーだけ（弾と同じ）。輪の幅のところにいたら当たる。回避の無敵でくぐれる
      for (const pl of game.players) {
        if (!pl.alive || pl.remote || n.hit.has(pl)) continue;
        const d = Math.hypot(pl.pos.x - n.x, pl.pos.z - n.z);
        if (Math.abs(d - n.r) < n.width + pl.radius) {
          n.hit.add(pl);
          hurtPlayer(game, pl, meleeHit, n.x, n.z);
        }
      }
      if (!puppet) game.allies?.hitBy((x, z) => Math.abs(Math.hypot(x - n.x, z - n.z) - n.r) < n.width + 0.6, meleeHit);
      if (n.r >= n.max) {
        game.scene.remove(n.mesh);
        b.novas.splice(i, 1);
      }
    }
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
      case 'beam': {
        // 光線：dirs 本を放射状に。aim なら1本目はプレイヤーへ
        const base = p.aim ? b.yaw : rand(0, Math.PI);
        b.beamAngles = Array.from({ length: p.dirs }, (_, i) => base + (i / p.dirs) * Math.PI * 2);
        b.beamTeles = b.beamAngles.map((a) => game.fx.telegraph('rect', { x: b.pos.x, z: b.pos.z, len: p.len, width: p.width, angle: a, dur }));
        break;
      }
      case 'erupt': {
        // 地割れ：ボスからプレイヤーの方へ、手前から順に噴き上がる
        const n = Math.round(rv(p, 'count', 6));
        for (let i = 0; i < n; i++) {
          const d = 3 + i * p.spacing;
          const zx = b.pos.x + Math.sin(b.yaw) * d;
          const zz = b.pos.z + Math.cos(b.yaw) * d;
          if (game.world.blocked(zx, zz)) break;
          const life = dur + i * p.gap;
          b.zones.push({ x: zx, z: zz, r: p.radius, t: life, burst: 0, color: p.color, tele: game.fx.telegraph('circle', { x: zx, z: zz, r: p.radius, dur: life }) });
        }
        break;
      }
      case 'teleport': {
        // 標的の背後（向いている方の反対側）に予兆を出し、そこへ瞬間移動する
        const back = (tgt.yaw ?? 0) + Math.PI;
        let tx = tgt.pos.x + Math.sin(back) * p.dist;
        let tz = tgt.pos.z + Math.cos(back) * p.dist;
        if (game.world.blocked(tx, tz)) {
          tx = tgt.pos.x - Math.sin(back) * p.dist;
          tz = tgt.pos.z - Math.cos(back) * p.dist;
        }
        b.warp = { x: tx, z: tz };
        b.tele = game.fx.telegraph('circle', { x: tx, z: tz, r: b.radius + 0.6, dur });
        game.fx.burst(b.pos.x, 2, b.pos.z, C.color, 30, { speed: 5, up: 3, life: 0.6 });
        break;
      }
      case 'rain': {
        const n = Math.round(rv(p, 'count', 6));
        for (let i = 0; i < n; i++) {
          // 1つは必ず足元に、残りはまわりにばらまく
          const a = rand(0, Math.PI * 2);
          const r = i === 0 ? 0 : rand(2.5, p.spreadR);
          const zx = tgt.pos.x + Math.sin(a) * r;
          const zz = tgt.pos.z + Math.cos(a) * r;
          const life = dur + p.delay + i * 0.1;
          b.zones.push({ x: zx, z: zz, r: p.radius, t: life, burst: p.burst, color: p.color, tele: game.fx.telegraph('circle', { x: zx, z: zz, r: p.radius, dur: life }) });
        }
        break;
      }
      case 'whirl':
      case 'pull':
        b.tele = game.fx.telegraph('circle', { x: b.pos.x, z: b.pos.z, r: p.radius, dur: dur + (kindOf(name) === 'pull' ? p.dur : 0) });
        break;
      case 'donut':
        // 外側が危険・ボスの懐（rIn の内側）が安全
        hazard('donut', { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), rIn: p.rIn, rOut: p.rOut, dur });
        b.donutAt = { x: b.pos.x, z: b.pos.z };
        break;
      case 'wall': {
        // すき間が1か所ある壁を、標的の方へ走らせる
        const gapC = rand(-p.gapRange, p.gapRange);
        hazard('wall', { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), yaw: +b.yaw.toFixed(3), wait: dur, speed: p.speed, max: p.max, thick: p.thick, gapC: +gapC.toFixed(2), gapW: p.gapW, frac: meleeHit, color: p.color });
        break;
      }
      default: // ring / spiral / nova / stalker：自分の周り
        b.tele = game.fx.telegraph('circle', { x: b.pos.x, z: b.pos.z, r: kindOf(name) === 'nova' ? b.radius + 1.5 : 3, dur });
        break;
    }
  }

  function beamStrike(angles, p) {
    for (const a of angles) {
      hitAll(inRect(b.pos.x, b.pos.z, a, p.len, p.width), meleeHit, b.pos.x, b.pos.z);
      for (let d = 2; d < p.len; d += 1.6) {
        const x = b.pos.x + Math.sin(a) * d;
        const z = b.pos.z + Math.cos(a) * d;
        if (game.world.blocked(x, z, true)) break;
        game.fx.burst(x, 1.2, z, p.color, 2, { speed: 1.5, up: 1.5, life: 0.35, size: 0.22, grav: 0 });
      }
    }
    game.fx.shake(0.5);
    game.sound.se('wave');
  }

  /** 予備動作が終わった瞬間に攻撃する */
  function execute() {
    const name = b.pattern;
    const p = P[name];
    switch (kindOf(name)) {
      case 'sweep':
        hitAll((x, z, pr) => {
          const d = Math.hypot(x - b.pos.x, z - b.pos.z);
          const ang = Math.abs(angleDiff(b.yaw, yawTo(b.pos.x, b.pos.z, x, z)));
          return d < p.range + 0.5 + pr && (ang < p.arc / 2 || d < b.radius + 0.5);
        }, meleeHit, b.pos.x, b.pos.z);
        game.fx.shake(0.4);
        game.sound.se('swing');
        for (let i = -3; i <= 3; i++) {
          const a = b.yaw + (i / 3) * (p.arc / 2);
          game.fx.burst(b.pos.x + Math.sin(a) * p.range * 0.8, 0.6, b.pos.z + Math.cos(a) * p.range * 0.8, p.color ?? 0xffcc80, 3, { speed: 3, life: 0.4 });
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
          const t = bossTarget(game, b);
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
      case 'beam': {
        b.beamTeles?.forEach((t) => t.end());
        b.beamTeles = null;
        beamStrike(b.beamAngles, p);
        if (rv(p, 'twice', false)) {
          // 2回目：間をずらした向きに、短い予兆のあと
          const second = b.beamAngles.map((a) => a + Math.PI / p.dirs);
          let teles = null;
          emit(0.05, p.gap, 2, (i) => {
            if (i === 0) teles = second.map((a) => game.fx.telegraph('rect', { x: b.pos.x, z: b.pos.z, len: p.len, width: p.width, angle: a, dur: p.gap }));
            else {
              teles?.forEach((t) => t.end());
              beamStrike(second, p);
            }
          });
        }
        break;
      }
      case 'nova': {
        const waves = rv(p, 'waves', 1);
        emit(0, p.gap ?? 0.5, waves, () => {
          spawnNova(b.pos.x, b.pos.z, p.max, p.speed, p.width, p.color);
          game.raid?.bossFx('nova', { x: b.pos.x, z: b.pos.z, max: p.max, speed: p.speed, width: p.width, color: p.color });
          game.sound.se('slam');
          game.fx.shake(0.3);
        });
        break;
      }
      case 'teleport':
        b.pos.x = b.warp.x;
        b.pos.z = b.warp.z;
        game.fx.burst(b.pos.x, 2, b.pos.z, C.color, 40, { speed: 6, up: 4, life: 0.7 });
        game.sound.se('gate');
        {
          const t = bossTarget(game, b);
          if (t) b.yaw = yawTo(b.pos.x, b.pos.z, t.pos.x, t.pos.z);
        }
        if (p.then && P[p.then]) b.queued = p.then;
        b.state = 'rest';
        b.t = 0;
        return;
      case 'charge':
        b.dash = { t: 0, trail: 0, hit: new Set() };
        b.state = 'charge';
        b.t = 0;
        game.sound.se('swing');
        return;
      case 'whirl':
        b.state = 'whirl';
        b.t = 0;
        b.whirlTick = 0;
        game.sound.se('spin');
        return;
      case 'pull':
        hazard('pull', { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), strength: p.strength, t: p.dur, color: p.color });
        game.sound.se('roar');
        emit(p.dur, 1, 1, () => {
          hitAll(inCircle(b.pos.x, b.pos.z, p.radius), meleeHit, b.pos.x, b.pos.z);
          game.fx.burst(b.pos.x, 0.8, b.pos.z, p.color, 70, { speed: 12, up: 6, life: 0.8, size: 0.3 });
          game.fx.shake(1);
          game.sound.se('slam');
        });
        break;
      case 'donut': {
        const c = b.donutAt || b.pos;
        hitAll((x, z, pr) => {
          const d = Math.hypot(x - c.x, z - c.z);
          return d > p.rIn - pr * 0.5 && d < p.rOut + pr;
        }, meleeHit, c.x, c.z);
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * Math.PI * 2;
          const r = (p.rIn + p.rOut) / 2;
          game.fx.burst(c.x + Math.sin(a) * r, 0.4, c.z + Math.cos(a) * r, p.color, 2, { speed: 3, up: 7, life: 0.6 });
        }
        game.fx.shake(0.7);
        game.sound.se('slam');
        break;
      }
      case 'stalker':
        emit(0, p.gap, Math.round(rv(p, 'count', 3)), () => spawnStalker(p));
        break;
      default: // rain・erupt・wall は予兆の時点で配置済み
        break;
    }
    b.state = 'act';
    b.t = 0;
  }

  /** 弾幕のタイマーと、時間差で落ちる円を進める */
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
      hitAll(inCircle(zn.x, zn.z, zn.r), meleeHit, zn.x, zn.z);
      game.fx.burst(zn.x, 0.4, zn.z, zn.color, zn.burst ? 18 : 26, { speed: 6, up: zn.burst ? 6 : 10, life: 0.6, size: 0.22 });
      game.sound.se('slam');
      // 着弾点からまわりに弾を散らす
      const n = Math.round((zn.burst || 0) * cm());
      const off = rand(0, 1);
      for (let k = 0; k < n; k++) shot(zn.x, zn.z, off + (k / n) * Math.PI * 2, 6, zn.color);
    }
  }

  function update(rawDt) {
    // 弱体化の残り時間（実時間で減る）
    for (const [k, d] of Object.entries(b.debuffs)) {
      d.t -= rawDt;
      if (d.t <= 0) delete b.debuffs[k];
    }
    if (b.freezeImmune > 0) b.freezeImmune -= rawDt; // 時間停止の耐性
    if (b.shred && (b.shred.t -= rawDt) <= 0) b.shred = null; // 鎧砕きは殴られないと戻る
    // 時魔導士の鈍化：ボスの時間そのものを遅くする（移動・予備動作・弾幕の間隔すべて）
    const dt = b.debuffs.slow ? rawDt * b.debuffs.slow.mul : rawDt;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    if (b.taunt) {
      b.taunt.t -= dt;
      if (b.taunt.t <= 0) b.taunt = null;
    }
    const tgt = bossTarget(game, b);
    let walking = false;
    if (b.alive) {
      updateEmitters(dt);
      updateStalkers(dt);
    }
    updateNovas(dt);
    // ブレイク値は殴られていないと少しずつ減る
    if (b.state !== 'stun') b.brk = Math.max(0, b.brk - b.brkMax * 0.03 * dt);

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
      case 'stun':
        poseStun();
        if (Math.random() < 0.3) game.fx.burst(b.pos.x + rand(-1, 1), C.hpY * 0.9, b.pos.z + rand(-1, 1), 0xffee58, 1, { speed: 1, up: 1, life: 0.5, grav: 0 });
        if (b.t > (b.stunFor ?? BREAK.stun)) { b.state = 'rest'; b.t = 0; m.root.position.y = 0; m.root.rotation.x = 0; }
        break;
      case 'frozen':
        // 時間停止：その場で固まる（被ダメの増加はない）
        if (Math.random() < 0.3) game.fx.burst(b.pos.x + rand(-1.5, 1.5), rand(1, C.hpY), b.pos.z + rand(-1.5, 1.5), 0xb388ff, 1, { speed: 0.5, up: 0.5, life: 0.6, grav: 0 });
        if (b.t > b.frozenFor) { b.state = 'rest'; b.t = 0; }
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
            // 追撃（連続攻撃・瞬間移動のあと）はすぐ出す
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
          poseWindup(kind);
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
              hitAll(inCircle(b.pos.x, b.pos.z, p.radius), meleeHit, b.pos.x, b.pos.z);
              game.fx.shake(1);
              game.sound.se('slam');
              game.fx.burst(b.pos.x, 0.3, b.pos.z, 0xa1887f, 40, { speed: 10, up: 5, life: 0.8, size: 0.25 });
              // 着地で弾の輪（怒り中は rageRing をそのまま使う）
              const n = b.raged && p.rageRing !== undefined ? p.rageRing : Math.round((p.ring || 0) * cm());
              if (n > 0) ring(b.pos.x, b.pos.z, n, rand(0, 1), 8, p.color);
              b.state = 'act';
              b.t = 0;
            }
          }
        } else if (kind === 'teleport') {
          // 体を縮めて消える
          m.group.scale.setScalar(Math.max(0.05, 1 - b.t / dur));
          if (b.t >= dur) {
            b.tele?.end();
            b.tele = null;
            m.group.scale.setScalar(1);
            execute();
          }
        } else {
          // ring / spiral / rain / beam / erupt / nova：両手を掲げてためる
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
      case 'whirl': {
        // 回転しながら標的へ寄ってくる。tick ごとに周りを斬る
        const p = P[b.pattern];
        if (tgt) {
          b.yaw = lerpAngle(b.yaw, yawTo(b.pos.x, b.pos.z, tgt.pos.x, tgt.pos.z), Math.min(1, dt * 2));
          b.pos.x += Math.sin(b.yaw) * p.speed * sm() * dt;
          b.pos.z += Math.cos(b.yaw) * p.speed * sm() * dt;
        }
        m.root.rotation.y += dt * 18;
        m.armL.rotation.set(-Math.PI / 2, 0, 0.6);
        m.armR.rotation.set(-Math.PI / 2, 0, -0.6);
        b.whirlTick -= dt;
        if (b.whirlTick <= 0) {
          b.whirlTick = p.tick;
          hitAll(inCircle(b.pos.x, b.pos.z, p.radius), meleeHit, b.pos.x, b.pos.z);
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + b.t * 7;
            game.fx.burst(b.pos.x + Math.sin(a) * p.radius, 1, b.pos.z + Math.cos(a) * p.radius, p.color, 1, { speed: 2, up: 1, life: 0.3 });
          }
          game.sound.se('swing');
        }
        if (b.t >= rv(p, 'dur', 2)) {
          m.root.rotation.y = 0;
          b.state = 'act';
          b.t = 0;
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
        hitAll((x, z, pr, who) => {
          if (dsh.hit.has(who) || Math.hypot(x - b.pos.x, z - b.pos.z) >= b.radius + pr + 0.3) return false;
          dsh.hit.add(who); // 突進1回につき1人1回まで
          return true;
        }, meleeHit, b.pos.x - sx, b.pos.z - sz);
        // 通った跡から左右に弾を撃つ
        if (p.trailEvery) {
          while (dsh.trail >= p.trailEvery) {
            dsh.trail -= p.trailEvery;
            for (const s of [-1, 1]) shot(b.pos.x, b.pos.z, b.yaw + (s * Math.PI) / 2, p.trailSpeed, p.color);
          }
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
        if (b.t > (P[b.pattern]?.recover ?? 0.6) && b.emitters.length === 0) {
          b.state = 'rest';
          b.t = 0;
          const after = P[b.pattern]?.after;
          if (after && P[after]) b.queued = after;
        }
        break;
      case 'dead':
        poseDead();
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
    if (b.state === 'rest' || b.state === 'move') poseWalk(walking);
    drawGlow();
  }

  // ---------------- 参加者側（見た目だけ） ----------------
  function updatePuppet(dt) {
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    updateNovas(dt);
    const n = b.net;
    if (n) {
      const k = Math.min(1, dt * 10);
      const dx = n.x - b.pos.x;
      const dz = n.z - b.pos.z;
      if (dx * dx + dz * dz > 64) {
        b.pos.x = n.x;
        b.pos.z = n.z;
      } else {
        b.pos.x += dx * k;
        b.pos.z += dz * k;
      }
      b.pos.y += (n.y - b.pos.y) * k;
      b.yaw = lerpAngle(b.yaw, n.yaw, k);
    }
    m.group.rotation.y = b.yaw;
    const kind = b.pattern && P[b.pattern] ? kindOf(b.pattern) : '';
    m.group.scale.setScalar(b.state === 'windup' && kind === 'teleport' ? Math.max(0.05, 1 - b.t / (P[b.pattern].windup * wm())) : 1);
    switch (b.state) {
      case 'sleep': m.root.rotation.x = 0.1; break;
      case 'intro':
      case 'rage':
        m.armL.rotation.set(-2.6, 0, 0.4);
        m.armR.rotation.set(-2.6, 0, -0.4);
        break;
      case 'stun': poseStun(); break;
      case 'frozen': break;
      case 'windup':
        if (kind === 'sweep' || kind === 'fan' || kind === 'charge') poseWindup(kind);
        else if (kind === 'slam') m.armR.rotation.set(-2.9, 0, 0);
        else {
          m.armL.rotation.set(-2.8, 0, 0.3);
          m.armR.rotation.set(-2.8, 0, -0.3);
        }
        break;
      case 'act':
        m.root.rotation.x = 0;
        m.armR.rotation.set(-0.5, -0.8, 0);
        m.root.rotation.y = -0.3;
        break;
      case 'charge': m.root.rotation.x = 0.35; break;
      case 'whirl':
        m.root.rotation.y += dt * 18;
        m.armL.rotation.set(-Math.PI / 2, 0, 0.6);
        m.armR.rotation.set(-Math.PI / 2, 0, -0.6);
        break;
      case 'dead': poseDead(); break;
      default: poseWalk(n ? Math.hypot(n.x - b.pos.x, n.z - b.pos.z) > 0.05 : false);
    }
    drawGlow();
  }

  // ---------------- 姿勢 ----------------
  function poseWindup(kind) {
    if (kind === 'charge') {
      m.root.rotation.x = 0.35;
      m.armR.rotation.set(-1.4, 0, 0);
    } else {
      m.armR.rotation.set(-Math.PI / 2, 1.5, 0);
      m.root.rotation.y = 0.5;
    }
  }
  function poseStun() {
    m.root.rotation.x = 0.5;
    m.root.position.y = -0.25;
    m.armL.rotation.set(0.3, 0, 0.3);
    m.armR.rotation.set(0.3, 0, -0.3);
  }
  function poseDead() {
    m.root.rotation.x = Math.min(1.5, b.t * 1.2);
    m.group.position.y = -Math.max(0, b.t - 1.2) * 0.8;
    if (Math.random() < 0.5) game.fx.burst(b.pos.x + rand(-2, 2), rand(1, 4), b.pos.z + rand(-2, 2), 0xff6e40, 3, { speed: 3, up: 4, life: 0.7 });
  }
  function poseWalk(walking) {
    const ph = b.t * 6;
    const s = walking ? Math.sin(ph) * 0.5 : 0;
    m.legL.rotation.x = s;
    m.legR.rotation.x = -s;
    m.armL.rotation.set(-s * 0.6, 0, 0);
    m.armR.rotation.set(-0.4 + s * 0.4, 0, 0);
    m.root.rotation.set(0, 0, 0);
    m.root.position.y = 0;
  }
  function drawGlow() {
    const glow = b.state === 'windup' || b.state === 'charge' ? 0.5 + 0.5 * Math.sin(b.t * 25) : b.raged ? 0.25 : 0;
    const stun = b.state === 'stun' ? 0.35 + 0.25 * Math.sin(b.t * 10) : 0;
    if (b.flash > 0) m.bodyMat.emissive.setRGB(1, 1, 1);
    else if (b.state === 'frozen') m.bodyMat.emissive.setRGB(0.35, 0.25, 0.8); // 時間停止：紫
    else {
      // 腐食は緑、鈍化は青みを足す
      const v = b.debuffs.vuln ? 0.35 : 0;
      const s = b.debuffs.slow ? 0.35 : 0;
      m.bodyMat.emissive.setRGB(Math.max(glow, stun), Math.max(stun, v), s);
    }
  }

  /** ホスト：参加者へ送る状態 */
  b.snapshot = () => ({
    key: b.key, idx: b.idx, sub: b.sub, x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), y: +b.pos.y.toFixed(2), yaw: +b.yaw.toFixed(3),
    hp: Math.round(b.hp), maxHp: b.maxHp, brk: Math.round(b.brk), brkMax: b.brkMax,
    state: b.state, pattern: b.pattern, raged: b.raged, active: b.active, alive: b.alive,
    vuln: !!b.debuffs.vuln, slow: !!b.debuffs.slow,
  });
  /** ホスト：鎧砕き（重ねるほど被ダメ増。6秒殴られないと戻る） */
  b.addShred = (per, max) => {
    const n = Math.min(max, (b.shred?.n || 0) + 1);
    b.shred = { n, per, t: 6 };
  };
  /** ホスト：挑発 */
  b.setTaunt = (id, dur) => { b.taunt = { id, t: dur }; };
  /** ホスト：弱体化（vuln：被ダメ倍率、slow：時間の倍率） */
  b.setDebuff = (name, dur, mul) => {
    const had = b.debuffs[name];
    // 強い方・長い方を残す（弱い鈍化で強い鈍化を上書きしない）
    const better = !had || (name === 'slow' ? mul <= had.mul : mul >= had.mul);
    b.debuffs[name] = better ? { t: Math.max(dur, had?.t || 0), mul } : { ...had, t: Math.max(had.t, dur) };
    // お知らせは新しくかかったときだけ（連射・多段で毎回出ると画面が埋まる）
    if (!had) game.toastOnce(name === 'vuln' ? `${C.name}が腐食した！（被ダメージ増）` : `${C.name}の動きが鈍った！`, 1600);
  };
  /** ホスト：時間停止（攻撃を中断して dur 秒 固まる） */
  b.freeze = (dur, immune = 15) => {
    if (!b.alive || !b.active || b.state === 'dead') return;
    if (b.freezeImmune > 0) {
      game.toast(`${C.name}には時間停止がまだ効かない（あと ${Math.ceil(b.freezeImmune)} 秒）`, 1800);
      return;
    }
    const k = ccMul();
    dur = Math.round(dur * k * 10) / 10;
    b.freezeImmune = dur + immune; // 止まっている間＋その後の耐性
    cancelAll();
    b.state = 'frozen';
    b.t = 0;
    b.frozenFor = dur;
    game.sound.se('gate');
    game.toast(`時間停止！ ${C.name}が${dur}秒 止まった${k < 1 ? '（慣れてきて短くなっている）' : ''}`, 2000);
  };

  return b;
}
