// プレイヤー：移動・ダッシュ・3段コンボ・回避（無敵）・スキル2つ・スタミナ
// 入力は直接読まず、game.js が作る intent（データ）を受け取って状態を更新する
import { makeHero, animateWalk } from './models.js';
import { PLAYER, SKILLS, STAMINA } from './data/player.js';
import { lerpAngle } from './util.js';
import { meleeArc, radiusHit } from './combat.js';

/** 空の入力（何も押していない） */
export function emptyIntent(out = {}) {
  out.moveX = 0; out.moveZ = 0; out.aimYaw = 0;
  out.attack = false; out.dodge = false; out.dash = false; out.spin = false; out.wave = false; out.interact = false;
  return out;
}

export function createPlayer(game, index = 0) {
  const model = makeHero(PLAYER.look);
  model.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  game.scene.add(model.group);

  const p = {
    index,
    model,
    pos: model.group.position,
    radius: PLAYER.radius,
    maxHp: PLAYER.maxHp,
    hp: PLAYER.maxHp,
    stamina: STAMINA.max,
    tired: false, // バテ状態（満タンに戻るまで回避・ダッシュ不可、足が遅い）
    staminaWait: 0, // 回復が始まるまでの残り秒
    dashing: false,
    yaw: Math.PI,
    alive: true,
    invuln: 0,
    action: 'none', // none / attack / dodge / spin
    actT: 0,
    combo: 0,
    queued: false,
    didHit: false,
    dodgeCd: 0,
    dodgeX: 0,
    dodgeZ: 0,
    knockX: 0,
    knockZ: 0,
    cd: { spin: 0, wave: 0 },
    walkPhase: 0,
    flash: 0,

    /** 全回復して置く（エリア開始・復活時） */
    reset(x, z, yaw = Math.PI) {
      p.pos.set(x, 0, z);
      p.yaw = yaw;
      model.group.rotation.y = yaw;
      model.root.rotation.set(0, 0, 0);
      p.action = 'none';
      p.knockX = p.knockZ = 0;
      p.alive = true;
      p.hp = p.maxHp;
      p.stamina = STAMINA.max;
      p.tired = false;
      p.invuln = 0;
      p.cd.spin = p.cd.wave = 0;
    },

    onHurt(dx, dz) {
      p.invuln = PLAYER.hurtInvuln;
      p.knockX = dx * 7;
      p.knockZ = dz * 7;
      p.flash = 0.25;
      if (p.action === 'attack') p.action = 'none';
    },

    /** スタミナを使う。足りなくても使えるが 0 になったらバテる */
    useStamina(n) {
      p.stamina = Math.max(0, p.stamina - n);
      p.staminaWait = STAMINA.regenDelay;
      if (p.stamina <= 0 && !p.tired) {
        p.tired = true;
        game.sound.se('tired');
        if (p === game.me()) game.toastOnce('バテた！ スタミナが満タンに戻るまで回避・ダッシュできない');
      }
    },

    update(dt, intent) {
      p.invuln = Math.max(0, p.invuln - dt);
      p.dodgeCd = Math.max(0, p.dodgeCd - dt);
      p.cd.spin = Math.max(0, p.cd.spin - dt);
      p.cd.wave = Math.max(0, p.cd.wave - dt);
      if (!p.alive) return;

      const mlen = Math.hypot(intent.moveX, intent.moveZ);
      const moving = mlen > 0.01;
      const moveYaw = moving ? Math.atan2(intent.moveX, intent.moveZ) : p.yaw;
      const canStamina = !p.tired && p.stamina > 0;

      // ---- 行動の開始 ----
      if (intent.dodge && p.dodgeCd <= 0 && p.action !== 'dodge' && canStamina) {
        const y = moving ? moveYaw : p.yaw + Math.PI;
        p.action = 'dodge';
        p.actT = 0;
        p.dodgeX = Math.sin(y);
        p.dodgeZ = Math.cos(y);
        p.invuln = Math.max(p.invuln, PLAYER.dodgeInvuln);
        p.dodgeCd = PLAYER.dodgeCd + PLAYER.dodgeTime;
        if (moving) p.yaw = y;
        p.useStamina(STAMINA.dodgeCost);
        game.sound.se('dodge');
        game.fx.burst(p.pos.x, 0.3, p.pos.z, 0xd7ccc8, 8, { speed: 2, up: 1, life: 0.4 });
      } else if (intent.dodge && p.tired && p === game.me()) {
        game.toastOnce('バテていて回避できない！');
      } else if (intent.spin && p.action !== 'dodge' && p.action !== 'spin') {
        if (trySkill('spin')) {
          p.action = 'spin';
          p.actT = 0;
          p.didHit = false;
          game.sound.se('spin');
        }
      } else if (intent.wave && p.action !== 'dodge' && p.action !== 'spin') {
        if (trySkill('wave')) {
          p.yaw = intent.aimYaw;
          p.action = 'attack';
          p.combo = 2;
          p.actT = PLAYER.combo[2].hit; // 振り下ろしの姿勢から
          p.didHit = true;
          p.queued = false;
          game.projectiles.playerWave(p, p.yaw);
          game.sound.se('wave');
        }
      } else if (intent.attack) {
        if (p.action === 'none') startCombo(0, intent);
        else if (p.action === 'attack') p.queued = true;
      }

      // ---- 行動中の処理 ----
      let speedMul = 1;
      if (p.action === 'attack') {
        const c = PLAYER.combo[p.combo];
        p.actT += dt;
        speedMul = 0.2;
        if (!p.didHit && p.actT >= c.hit) {
          p.didHit = true;
          meleeArc(game, p, p.yaw, c.mult, PLAYER.attackRange + (p.combo === 2 ? PLAYER.heavyRangeBonus : 0));
          // 剣の軌跡
          const sx = p.pos.x + Math.sin(p.yaw) * 1.6;
          const sz = p.pos.z + Math.cos(p.yaw) * 1.6;
          game.fx.burst(sx, 1.2, sz, PLAYER.look.swordColor, 5, { speed: 2, up: 1, life: 0.25, size: 0.1, grav: 0 });
        }
        if (p.actT >= c.dur) {
          if (p.queued && p.combo < 2) startCombo(p.combo + 1, intent);
          else p.action = 'none';
        }
      } else if (p.action === 'dodge') {
        p.actT += dt;
        if (p.actT >= PLAYER.dodgeTime) p.action = 'none';
      } else if (p.action === 'spin') {
        const sk = SKILLS.spin;
        p.actT += dt;
        speedMul = 0.5;
        if (!p.didHit && p.actT >= sk.hitAt) {
          p.didHit = true;
          radiusHit(game, p, sk.mult, sk.radius);
          game.fx.burst(p.pos.x, 1, p.pos.z, 0x80d8ff, 30, { speed: 9, up: 1.5, life: 0.45, size: 0.14, grav: 2 });
          game.fx.shake(0.25);
        }
        if (p.actT >= sk.dur) p.action = 'none';
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
      if (p.tired) speedMul *= PLAYER.tiredMul;

      // ---- 移動 ----
      let vx = 0;
      let vz = 0;
      if (p.action === 'dodge') {
        vx = p.dodgeX * PLAYER.dodgeSpeed;
        vz = p.dodgeZ * PLAYER.dodgeSpeed;
      } else if (moving) {
        const sp = PLAYER.speed * speedMul * Math.min(1, mlen);
        vx = (intent.moveX / mlen) * sp;
        vz = (intent.moveZ / mlen) * sp;
        if (p.action === 'none') p.yaw = lerpAngle(p.yaw, moveYaw, Math.min(1, dt * 14));
      }
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
      animate(dt, moving && p.action === 'none' ? 1 : moving ? 0.4 : 0);
      p.flash = Math.max(0, p.flash - dt);
      const blink = p.invuln > 0 && p.action !== 'dodge' && Math.floor(p.invuln * 20) % 2 === 0;
      model.group.visible = !blink;
      model.armorMat.emissive.setHex(p.flash > 0 ? 0x880000 : 0x000000);
    },
  };

  function startCombo(i, intent) {
    p.action = 'attack';
    p.combo = i;
    p.actT = 0;
    p.didHit = false;
    p.queued = false;
    // 入力方向、無ければカメラの向きへ振る
    p.yaw = Math.hypot(intent.moveX, intent.moveZ) > 0.01 ? Math.atan2(intent.moveX, intent.moveZ) : intent.aimYaw;
    game.sound.se('swing');
  }

  function trySkill(id) {
    if (p.cd[id] > 0) return false;
    p.cd[id] = SKILLS[id].cd;
    return true;
  }

  function animate(dt, walk) {
    const m = model;
    m.root.rotation.y = 0;
    m.root.rotation.x = p.tired && walk ? 0.18 : 0; // バテ中は前かがみ
    if (p.action === 'attack') {
      animateWalk(m, p.walkPhase, walk * 0.3, false);
      const c = PLAYER.combo[p.combo];
      const k = Math.min(1, p.actT / (c.hit * 1.6));
      if (p.combo === 2) {
        m.armR.rotation.set(-2.9 + k * 2.3, 0, 0);
        m.root.rotation.x = k * 0.15;
      } else {
        const dir = p.combo === 0 ? 1 : -1;
        m.armR.rotation.set(-Math.PI / 2, dir * (1.4 - k * 2.8), 0);
        m.root.rotation.y = dir * (0.4 - k * 0.8);
      }
    } else if (p.action === 'spin') {
      m.armR.rotation.set(-Math.PI / 2, -Math.PI / 2, 0);
      m.root.rotation.y = -(p.actT / SKILLS.spin.dur) * Math.PI * 2;
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
