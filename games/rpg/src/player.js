// プレイヤー：移動・3段コンボ・回避（無敵）・スキル2つ
// 入力は直接読まず、game.js が作る intent（データ）を受け取って状態を更新する
import { makeHero, animateWalk } from './models.js';
import { PLAYER, SKILLS } from './data/levels.js';
import { WEAPONS, ARMORS } from './data/items.js';
import { lerpAngle } from './util.js';
import { meleeArc, radiusHit } from './combat.js';

/** 空の入力（何も押していない） */
export function emptyIntent() {
  return { moveX: 0, moveZ: 0, aimYaw: 0, attack: false, dodge: false, spin: false, wave: false };
}

export function createPlayer(game, index = 0) {
  const model = makeHero();
  model.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  game.scene.add(model.group);

  const p = {
    index,
    model,
    pos: model.group.position,
    radius: PLAYER.radius,
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

    applyEquipment() {
      const pr = game.state.progress;
      model.setWeapon(WEAPONS[pr.weapon] || WEAPONS.w1);
      model.setArmor(ARMORS[pr.armor] || ARMORS.a1);
    },

    place(x, z, yaw = Math.PI) {
      p.pos.set(x, 0, z);
      p.yaw = yaw;
      model.group.rotation.y = yaw;
      p.action = 'none';
      p.knockX = p.knockZ = 0;
    },

    onHurt(dx, dz) {
      p.invuln = PLAYER.hurtInvuln;
      p.knockX = dx * 7;
      p.knockZ = dz * 7;
      p.flash = 0.25;
      if (p.action === 'attack') p.action = 'none';
    },

    update(dt, intent) {
      const st = game.state;
      const pr = st.progress;
      const d = st.derived();
      p.invuln = Math.max(0, p.invuln - dt);
      p.dodgeCd = Math.max(0, p.dodgeCd - dt);
      p.cd.spin = Math.max(0, p.cd.spin - dt);
      p.cd.wave = Math.max(0, p.cd.wave - dt);
      pr.mp = Math.min(d.maxMp, pr.mp + PLAYER.mpRegen * dt);
      if (!p.alive) return;

      const mlen = Math.hypot(intent.moveX, intent.moveZ);
      const moving = mlen > 0.01;
      const moveYaw = moving ? Math.atan2(intent.moveX, intent.moveZ) : p.yaw;

      // ---- 行動の開始 ----
      if (intent.dodge && p.dodgeCd <= 0 && p.action !== 'dodge') {
        const y = moving ? moveYaw : p.yaw + Math.PI;
        p.action = 'dodge';
        p.actT = 0;
        p.dodgeX = Math.sin(y);
        p.dodgeZ = Math.cos(y);
        p.invuln = Math.max(p.invuln, PLAYER.dodgeInvuln);
        p.dodgeCd = PLAYER.dodgeCd + PLAYER.dodgeTime;
        if (moving) p.yaw = y;
        game.sound.se('dodge');
        game.fx.burst(p.pos.x, 0.3, p.pos.z, 0xd7ccc8, 8, { speed: 2, up: 1, life: 0.4 });
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
          meleeArc(game, p, p.yaw, c.mult * (p.combo === 2 ? 1 : 1), PLAYER.attackRange + (p.combo === 2 ? 0.4 : 0));
          // 剣の軌跡
          const sx = p.pos.x + Math.sin(p.yaw) * 1.6;
          const sz = p.pos.z + Math.cos(p.yaw) * 1.6;
          game.fx.burst(sx, 1.2, sz, WEAPONS[pr.weapon].color, 5, { speed: 2, up: 1, life: 0.25, size: 0.1, grav: 0 });
        }
        if (p.actT >= c.dur) {
          if (p.queued && p.combo < 2) startCombo(p.combo + 1, intent);
          else if (p.actT >= c.dur + (p.queued ? 0 : 0)) p.action = 'none';
        }
      } else if (p.action === 'dodge') {
        p.actT += dt;
        if (p.actT >= PLAYER.dodgeTime) p.action = 'none';
      } else if (p.action === 'spin') {
        p.actT += dt;
        speedMul = 0.5;
        if (!p.didHit && p.actT >= 0.15) {
          p.didHit = true;
          radiusHit(game, p, SKILLS.spin.mult, SKILLS.spin.radius);
          game.fx.burst(p.pos.x, 1, p.pos.z, 0x80d8ff, 30, { speed: 9, up: 1.5, life: 0.45, size: 0.14, grav: 2 });
          game.fx.shake(0.25);
        }
        if (p.actT >= 0.5) p.action = 'none';
      }

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
      p.walkPhase += dt * (moving ? 11 : 0);
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
    const sk = SKILLS[id];
    const pr = game.state.progress;
    if (p.cd[id] > 0) return false;
    if (pr.mp < sk.mp) {
      game.toastOnce('MP が足りない！');
      game.sound.se('error');
      return false;
    }
    pr.mp -= sk.mp;
    p.cd[id] = sk.cd;
    return true;
  }

  function animate(dt, walk) {
    const m = model;
    m.root.rotation.y = 0;
    m.root.rotation.x = 0;
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
      m.root.rotation.y = -(p.actT / 0.5) * Math.PI * 2;
    } else if (p.action === 'dodge') {
      m.armR.rotation.set(-0.5, 0, 0);
      m.root.rotation.x = 0.5;
      m.root.position.y = Math.sin((p.actT / PLAYER.dodgeTime) * Math.PI) * 0.4;
    } else {
      animateWalk(m, p.walkPhase, walk, false);
      m.armR.rotation.set(-0.9 + Math.sin(p.walkPhase) * 0.2 * walk, 0, 0);
      if (!walk) m.root.position.y = 0;
    }
  }

  p.applyEquipment();
  return p;
}
