// プレイヤー：移動・ダッシュ・通常攻撃（近接コンボ／飛び道具）・回避（無敵）・Q スキル・E 必殺技・スタミナ
// 職業（data/jobs.js）で能力と攻撃が変わる。スキルの中身は src/jobs.js
// 入力は直接読まず、game.js が作る intent（データ）を受け取って状態を更新する
// remote: true のプレイヤーは「他の人の分身」。自分では動かさず、届いた位置へなめらかに寄せて描くだけ
import { makeHero, animateWalk } from './models.js';
import { PLAYER, STAMINA } from './data/player.js';
import { JOBS, DEFAULT_JOB, GAUGE, REVIVE } from './data/jobs.js';
import { lerpAngle, lerpAngle as la } from './util.js';
import { meleeArc } from './combat.js';
import { castQ, castE, basicShot } from './jobs.js';

/** 空の入力（何も押していない） */
export function emptyIntent(out = {}) {
  out.moveX = 0; out.moveZ = 0; out.aimYaw = 0;
  out.attack = false; out.dodge = false; out.dash = false; out.skillQ = false; out.skillE = false; out.interact = false;
  out.lockYaw = false; // true なら体の向きを常に aimYaw（一人称：カメラの水平方向）に合わせる
  return out;
}

/**
 * @param {object} o { job, remote, id, name }
 */
export function createPlayer(game, index = 0, { job = DEFAULT_JOB, remote = false, id = 'local', name = '' } = {}) {
  const J = JOBS[job] || JOBS[DEFAULT_JOB];
  const model = makeHero(J.look);
  model.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  game.scene.add(model.group);

  const p = {
    index, id, name, remote,
    jobId: job in JOBS ? job : DEFAULT_JOB,
    job: J,
    model,
    pos: model.group.position,
    radius: PLAYER.radius,
    maxHp: J.stats.hp,
    hp: J.stats.hp,
    stamina: STAMINA.max,
    tired: false, // バテ状態（満タンに戻るまで回避・ダッシュ不可、足が遅い）
    staminaWait: 0, // 回復が始まるまでの残り秒
    dashing: false,
    yaw: Math.PI,
    alive: true,
    downed: false, // 協力プレイで倒れている（味方が近くに立つと蘇生）
    reviveT: 0, // 蘇生の進み具合（秒）
    invuln: 0,
    action: 'none', // none / attack / shoot / dodge / spin / cast / dash
    actT: 0,
    combo: 0,
    queued: false,
    didHit: false,
    dodgeCd: 0,
    dodgeX: 0,
    dodgeZ: 0,
    knockX: 0,
    knockZ: 0,
    shotCd: 0,
    cd: { q: 0 },
    gauge: 0, // 必殺ゲージ（0〜GAUGE.max）
    buffs: {}, // 名前 → { t, ...値 }（攻撃力アップ・被ダメ減など）
    critNext: false, // 次の1撃が必ず会心（忍者の回避後）
    pending: [], // 時間差の追い打ち（忍者の分身） { t, fn }
    walkPhase: 0,
    flash: 0,
    walking: false, // 歩いている（視点・ビューモデルの揺れ用）
    hideBody: false, // 一人称の自分は体を描かない
    waveT: 0, // 衝撃波・射撃・詠唱の残り演出時間（ビューモデル用）
    hurtT: 0, // 被弾してからの残り演出時間
    still: 0, // 立ち止まっている秒数（魔法使いの特性）
    net: null, // remote 用：届いた状態 { x, z, yaw, ... }

    /** 全回復して置く（エリア開始・復活時） */
    reset(x, z, yaw = Math.PI) {
      p.pos.set(x, 0, z);
      p.yaw = yaw;
      model.group.rotation.y = yaw;
      model.root.rotation.set(0, 0, 0);
      model.root.position.y = 0;
      p.action = 'none';
      p.knockX = p.knockZ = 0;
      p.alive = true;
      p.downed = false;
      p.reviveT = 0;
      p.hp = p.maxHp;
      p.stamina = STAMINA.max;
      p.tired = false;
      p.invuln = 0;
      p.cd.q = 0;
      p.shotCd = 0;
      p.buffs = {};
      p.pending.length = 0;
      if (p.net) Object.assign(p.net, { x, z, yaw });
    },

    /** 今の攻撃力（バフ込み） */
    atkNow() {
      let a = J.stats.atk * (p.buffs.courage ? p.buffs.courage.mul : 1);
      if (p.buffs.warcry) a *= p.buffs.warcry.atkMul; // 狂戦士の怒号
      if (J.chainPer) a *= 1 + (p.chain || 0) * J.chainPer; // 格闘家の連打
      if (J.lowHpBonus) a *= 1 + J.lowHpBonus * (1 - p.hp / p.maxHp); // 狂戦士：HP が減るほど強い
      return a;
    },
    /** 被ダメージの倍率（職業の特性・バフ込み） */
    dmgTakenMul() {
      let m = J.dmgTaken ?? 1;
      if (p.buffs.taunt) m *= 0.5;
      if (p.buffs.warcry) m *= p.buffs.warcry.dmgMul;
      if (p.buffs.aegis) m *= 0.5;
      if (J.summonGuard && game.allies?.ownedBy(p.id)) m *= J.summonGuard;
      return m;
    },
    /** 必殺ゲージを足す */
    addGauge(n) {
      if (p.remote) return;
      p.gauge = Math.min(GAUGE.max, p.gauge + n);
    },
    buff(name, dur, vals = {}) {
      p.buffs[name] = { t: dur, ...vals };
    },

    onHurt(dx, dz) {
      p.invuln = PLAYER.hurtInvuln;
      if (!J.noKnock) {
        p.knockX = dx * 7;
        p.knockZ = dz * 7;
      }
      p.flash = 0.25;
      p.hurtT = 0.3;
      p.chain = 0; // 格闘家の連打は被弾でリセット
      if (p.action === 'attack' && !J.noKnock) p.action = 'none';
      game.onPlayerHurt?.(p, -dx, -dz); // 攻撃してきた方向（画面の縁のマーカー用）
    },

    /** スタミナを使う。足りなくても使えるが 0 になったらバテる */
    useStamina(n) {
      if (p.buffs.gale) return; // 吟遊詩人の E：スタミナ無限
      p.stamina = Math.max(0, p.stamina - n);
      p.staminaWait = STAMINA.regenDelay;
      if (p.stamina <= 0 && !p.tired) {
        p.tired = true;
        game.sound.se('tired');
        if (p === game.me()) game.toastOnce('バテた！ スタミナが満タンに戻るまで回避・ダッシュできない');
      }
    },

    /** 倒れる（協力プレイ）。蘇生されるまで動けない */
    knockDown() {
      p.alive = false;
      p.downed = true;
      p.reviveT = 0;
      p.action = 'none';
      p.buffs = {};
    },
    /** 蘇生（HP は割合） */
    revive(frac = REVIVE.hp) {
      if (!p.downed) return;
      p.downed = false;
      p.alive = true;
      p.hp = Math.max(1, Math.round(p.maxHp * frac));
      p.invuln = 2;
      model.root.rotation.set(0, 0, 0);
      game.fx.burst(p.pos.x, 1, p.pos.z, 0xfff59d, 24, { speed: 4, up: 5, life: 0.8 });
      game.sound.se('seal');
    },

    update(dt, intent) {
      if (p.remote) {
        updateRemote(dt);
        return;
      }
      p.invuln = Math.max(0, p.invuln - dt);
      p.dodgeCd = Math.max(0, p.dodgeCd - dt);
      // Q のクールダウン（吟遊詩人の近くでは速く戻る）
      p.cd.q = Math.max(0, p.cd.q - dt * (game.bardAura?.(p) || 1));
      p.shotCd = Math.max(0, p.shotCd - dt);
      p.waveT = Math.max(0, p.waveT - dt);
      p.hurtT = Math.max(0, p.hurtT - dt);
      for (const [k, b] of Object.entries(p.buffs)) {
        b.t -= dt;
        if (b.regen && p.alive) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * b.regen * dt);
        if (b.t <= 0) delete p.buffs[k];
      }
      for (let i = p.pending.length - 1; i >= 0; i--) {
        const pe = p.pending[i];
        pe.t -= dt;
        if (pe.t <= 0) {
          p.pending.splice(i, 1);
          pe.fn();
        }
      }
      if (!p.alive) {
        animateDown();
        return;
      }

      const mlen = Math.hypot(intent.moveX, intent.moveZ);
      const moving = mlen > 0.01;
      p.still = moving ? 0 : p.still + dt;
      const moveYaw = moving ? Math.atan2(intent.moveX, intent.moveZ) : p.yaw;
      const canStamina = (!p.tired && p.stamina > 0) || !!p.buffs.gale;
      const busy = p.action === 'dodge' || p.action === 'spin' || p.action === 'cast' || p.action === 'dash';

      // ---- 行動の開始 ----
      if (intent.dodge && p.dodgeCd <= 0 && p.action !== 'dodge' && p.action !== 'dash' && canStamina) {
        const y = moving ? moveYaw : p.yaw + Math.PI;
        p.action = 'dodge';
        p.actT = 0;
        p.dodgeX = Math.sin(y);
        p.dodgeZ = Math.cos(y);
        p.invuln = Math.max(p.invuln, PLAYER.dodgeInvuln + (J.dodgeInvulnBonus || 0));
        p.dodgeCd = PLAYER.dodgeCd + PLAYER.dodgeTime;
        if (moving && !intent.lockYaw) p.yaw = y;
        p.useStamina(STAMINA.dodgeCost * (J.dodgeCostMul ?? 1));
        if (J.dodgeCostMul) p.critNext = true; // 忍者：回避直後の1撃は会心
        game.sound.se('dodge');
        game.fx.burst(p.pos.x, 0.3, p.pos.z, 0xd7ccc8, 8, { speed: 2, up: 1, life: 0.4 });
      } else if (intent.dodge && p.tired && p === game.me()) {
        game.toastOnce('バテていて回避できない！');
      } else if (intent.skillQ && !busy) {
        if (p.cd.q > 0) {
          if (p === game.me()) game.toastOnce(`${J.q.name}はあと ${p.cd.q.toFixed(1)} 秒`, 900);
        } else if (castQ(game, p, intent)) {
          p.cd.q = J.q.cd;
        }
      } else if (intent.skillE && !busy) {
        const once = J.e.oncePerRun;
        const used = once && game.state.progress.usedOnce?.[J.e.id];
        if (used) {
          if (p === game.me()) game.toastOnce(`${J.e.name}はこの挑戦ではもう使った（1度だけ）`, 1600);
        } else if (p.gauge < GAUGE.max) {
          if (p === game.me()) game.toastOnce('必殺ゲージが足りない（通常攻撃を当てて溜める。近接ほど早く溜まる）', 1600);
        } else if (castE(game, p, intent)) {
          p.gauge = 0;
          if (once) game.state.progress.usedOnce = { ...(game.state.progress.usedOnce || {}), [J.e.id]: true };
        }
      } else if (intent.attack && !busy) {
        if (J.basic.type === 'melee') {
          if (p.action === 'none' || p.action === 'shoot') startCombo(0, intent);
          else if (p.action === 'attack') p.queued = true;
        } else if (p.shotCd <= 0) {
          p.yaw = intent.aimYaw;
          p.action = 'shoot';
          p.actT = 0;
          p.shotCd = J.basic.cd;
          p.waveT = 0.25;
          basicShot(game, p, p.yaw);
        }
      }

      // ---- 行動中の処理 ----
      let speedMul = 1;
      if (p.action === 'attack') {
        const c = J.basic.combo[p.combo];
        const last = p.combo === J.basic.combo.length - 1;
        p.actT += dt;
        speedMul = 0.2;
        if (!p.didHit && p.actT >= c.hit) {
          p.didHit = true;
          const crit = p.critNext || (last && J === JOBS.swordsman);
          if (meleeArc(game, p, p.yaw, c.mult, J.basic.range + (last ? J.basic.heavyBonus : 0), J.basic.arc, { crit })) p.critNext = false;
          // 剣の軌跡
          const sx = p.pos.x + Math.sin(p.yaw) * 1.6;
          const sz = p.pos.z + Math.cos(p.yaw) * 1.6;
          game.fx.burst(sx, 1.2, sz, J.look.swordColor, 5, { speed: 2, up: 1, life: 0.25, size: 0.1, grav: 0 });
        }
        if (p.actT >= c.dur) {
          if (p.queued && !last) startCombo(p.combo + 1, intent);
          else p.action = 'none';
        }
      } else if (p.action === 'shoot') {
        p.actT += dt;
        speedMul = 0.6;
        if (p.actT >= 0.18) p.action = 'none';
      } else if (p.action === 'dodge') {
        p.actT += dt;
        if (p.actT >= PLAYER.dodgeTime) p.action = 'none';
      } else if (p.action === 'spin' || p.action === 'cast') {
        p.actT += dt;
        speedMul = 0.5;
        p.skillTick?.(dt);
        if (p.actT >= p.actDur) {
          p.action = 'none';
          p.skillTick = null;
        }
      } else if (p.action === 'dash') {
        // 忍者の瞬影斬：まっすぐ高速移動（skillTick が当たり判定）
        p.actT += dt;
        p.skillTick?.(dt);
        if (p.actT >= p.actDur) {
          p.action = 'none';
          p.skillTick = null;
        }
      }

      // ---- ダッシュとスタミナ ----
      p.dashing = intent.dash && moving && p.action === 'none' && canStamina;
      if (p.dashing) {
        speedMul *= PLAYER.dashMul;
        p.useStamina(STAMINA.dashPerSec * dt);
        if (Math.random() < 0.3) game.fx.burst(p.pos.x, 0.15, p.pos.z, 0xd7ccc8, 1, { speed: 1, up: 0.6, life: 0.3 });
      } else if (p.action !== 'dodge') {
        p.staminaWait = Math.max(0, p.staminaWait - dt);
        if (p.staminaWait <= 0) {
          p.stamina = Math.min(STAMINA.max, p.stamina + (p.tired ? STAMINA.tiredRegenPerSec : STAMINA.regenPerSec) * dt);
          if (p.tired && p.stamina >= STAMINA.max) p.tired = false;
        }
      }
      if (p.tired && !p.buffs.gale) speedMul *= PLAYER.tiredMul;
      if (p.buffs.gale) speedMul *= p.buffs.gale.speedMul;
      if (p.buffs.clone) speedMul *= p.buffs.clone.speedMul;

      // ---- 移動 ----
      let vx = 0;
      let vz = 0;
      if (p.action === 'dodge') {
        vx = p.dodgeX * PLAYER.dodgeSpeed;
        vz = p.dodgeZ * PLAYER.dodgeSpeed;
      } else if (p.action === 'dash') {
        vx = p.dodgeX * p.dashSpeed;
        vz = p.dodgeZ * p.dashSpeed;
      } else if (moving) {
        const sp = J.stats.speed * speedMul * Math.min(1, mlen);
        vx = (intent.moveX / mlen) * sp;
        vz = (intent.moveZ / mlen) * sp;
        if (p.action === 'none' && !intent.lockYaw) p.yaw = lerpAngle(p.yaw, moveYaw, Math.min(1, dt * 14));
      }
      if (intent.lockYaw && p.action !== 'dash') p.yaw = intent.aimYaw; // 一人称：攻撃も移動も視点の向きが基準
      vx += p.knockX;
      vz += p.knockZ;
      p.knockX *= Math.max(0, 1 - dt * 8);
      p.knockZ *= Math.max(0, 1 - dt * 8);
      p.pos.x += vx * dt;
      p.pos.z += vz * dt;
      game.world.collide(p.pos, p.radius);

      // ---- 見た目 ----
      model.group.rotation.y = p.yaw;
      p.walkPhase += dt * (moving ? 11 * (p.dashing ? 1.4 : p.tired ? 0.7 : 1) : 0);
      p.walking = moving && p.action !== 'dodge';
      animate(dt, moving && p.action === 'none' ? 1 : moving ? 0.4 : 0);
      drawCommon(dt);
    },
  };

  /** 他の人の分身：届いた位置へ寄せて、行動に合わせて体を動かす */
  function updateRemote(dt) {
    const n = p.net;
    if (!n) return;
    const k = Math.min(1, dt * 12);
    const dx = n.x - p.pos.x;
    const dz = n.z - p.pos.z;
    if (dx * dx + dz * dz > 100) p.pos.set(n.x, 0, n.z); // 大きく離れたら瞬間移動
    else {
      p.pos.x += dx * k;
      p.pos.z += dz * k;
    }
    const moving = Math.hypot(dx, dz) > 0.05;
    p.yaw = la(p.yaw, n.yaw, k);
    model.group.rotation.y = p.yaw;
    p.hp = n.hp;
    p.maxHp = n.maxHp;
    p.alive = n.alive;
    p.downed = n.downed;
    p.invuln = n.invuln ? 0.1 : 0;
    p.buffs = n.buffs || {};
    if (n.action !== p.action || n.actId !== p.actIdSeen) {
      p.action = n.action;
      p.combo = n.combo;
      p.actT = 0;
      p.actIdSeen = n.actId;
    } else p.actT += dt;
    p.actDur = n.actDur || 0.5;
    p.dashing = n.dashing;
    p.tired = n.tired;
    p.walkPhase += dt * (moving ? 11 : 0);
    if (!p.alive) animateDown();
    else animate(dt, moving && (p.action === 'none' || p.action === 'shoot') ? 1 : 0);
    drawCommon(dt);
  }

  function drawCommon(dt) {
    p.flash = Math.max(0, p.flash - dt);
    const blink = p.invuln > 0 && p.action !== 'dodge' && Math.floor(p.invuln * 20) % 2 === 0;
    model.group.visible = !blink && !p.hideBody; // 一人称では自分の体を描かない
    const glow = p.buffs.courage ? 0x332200 : p.buffs.clone ? 0x220033 : 0x000000;
    model.armorMat.emissive.setHex(p.flash > 0 ? 0x880000 : glow);
  }

  function startCombo(i, intent) {
    p.action = 'attack';
    p.combo = i;
    p.actT = 0;
    p.didHit = false;
    p.queued = false;
    p.actId = (p.actId || 0) + 1;
    // 一人称は視点の向き、三人称は入力方向（無ければカメラの向き）へ振る
    p.yaw = !intent.lockYaw && Math.hypot(intent.moveX, intent.moveZ) > 0.01 ? Math.atan2(intent.moveX, intent.moveZ) : intent.aimYaw;
    game.sound.se('swing');
  }

  function animateDown() {
    const m = model;
    m.root.rotation.x = -1.4;
    m.root.position.y = 0;
    m.group.rotation.y = p.yaw;
  }

  function animate(dt, walk) {
    const m = model;
    m.root.rotation.y = 0;
    m.root.rotation.x = p.tired && walk ? 0.18 : 0; // バテ中は前かがみ
    if (p.action === 'attack') {
      animateWalk(m, p.walkPhase, walk * 0.3, false);
      const combo = J.basic.combo || [];
      const c = combo[p.combo] || combo[0] || { hit: 0.1 };
      const k = Math.min(1, p.actT / (c.hit * 1.6));
      if (p.combo === combo.length - 1) {
        m.armR.rotation.set(-2.9 + k * 2.3, 0, 0);
        m.root.rotation.x = k * 0.15;
      } else {
        const dir = p.combo % 2 === 0 ? 1 : -1;
        m.armR.rotation.set(-Math.PI / 2, dir * (1.4 - k * 2.8), 0);
        m.root.rotation.y = dir * (0.4 - k * 0.8);
      }
    } else if (p.action === 'shoot') {
      animateWalk(m, p.walkPhase, walk * 0.6, false);
      m.armR.rotation.set(-Math.PI / 2, 0, 0);
      m.armL.rotation.set(-Math.PI / 2, 0, 0);
    } else if (p.action === 'spin') {
      m.armR.rotation.set(-Math.PI / 2, -Math.PI / 2, 0);
      m.root.rotation.y = -(p.actT / (p.actDur || 0.5)) * Math.PI * 2;
    } else if (p.action === 'cast') {
      m.armR.rotation.set(-2.8, 0, -0.3);
      m.armL.rotation.set(-2.8, 0, 0.3);
    } else if (p.action === 'dash') {
      m.root.rotation.x = 0.5;
      m.armR.rotation.set(-1.2, 0.8, 0);
    } else if (p.action === 'dodge') {
      m.armR.rotation.set(-0.5, 0, 0);
      m.root.rotation.x = 0.5;
      m.root.position.y = Math.sin((p.actT / PLAYER.dodgeTime) * Math.PI) * 0.4;
    } else {
      animateWalk(m, p.walkPhase, walk * (p.dashing ? 1.3 : 1), false);
      m.armR.rotation.set(-0.9 + Math.sin(p.walkPhase) * 0.2 * walk, 0, 0);
      if (p.dashing) m.root.rotation.x = 0.25;
      if (!walk) m.root.position.y = 0;
    }
  }

  return p;
}
