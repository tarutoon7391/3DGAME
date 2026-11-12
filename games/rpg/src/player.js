// プレイヤー：移動・ダッシュ・通常攻撃（近接コンボ／飛び道具）・回避（無敵）・Q スキル・E 必殺技・スタミナ
// 職業（data/jobs.js）で能力と攻撃が変わる。スキルの中身は src/jobs.js
// 入力は直接読まず、game.js が作る intent（データ）を受け取って状態を更新する
// remote: true のプレイヤーは「他の人の分身」。自分では動かさず、届いた位置へなめらかに寄せて描くだけ
import { makeHero, animateWalk } from './models.js';
import { PLAYER, STAMINA, CLOSE } from './data/player.js';
import { JOBS, DEFAULT_JOB, GAUGE, REVIVE } from './data/jobs.js';
import { lerpAngle, lerpAngle as la } from './util.js';
import { meleeArc, strike, forEachTarget, radiusHit } from './combat.js';
import { castQ, castE, castC, castR, basicShot } from './jobs.js';

/** 空の入力（何も押していない） */
export function emptyIntent(out = {}) {
  out.moveX = 0; out.moveZ = 0; out.aimYaw = 0;
  out.attack = false; out.dodge = false; out.dash = false; out.skillQ = false; out.skillE = false; out.skillC = false; out.skillR = false; out.interact = false;
  out.lockYaw = false; // true なら体の向きを常に aimYaw（一人称：カメラの水平方向）に合わせる
  return out;
}

/**
 * @param {object} o { job, remote, id, name }
 */
export function createPlayer(game, index = 0, { job = DEFAULT_JOB, remote = false, id = 'local', name = '' } = {}) {
  const J = JOBS[job] || JOBS[DEFAULT_JOB];
  const model = makeHero({ ...J.look, jobId: job in JOBS ? job : DEFAULT_JOB, accent: parseInt(String(J.color || '#ffd54f').replace('#', ''), 16) }); // 一人称と同じ武器を右手に
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
    staminaMax: (STAMINA.max + (J.staminaBonus || 0)) * (J.closeFighter ? CLOSE.staminaMul : 1), // 近接職（タンク以外）は 2倍
    stamina: (STAMINA.max + (J.staminaBonus || 0)) * (J.closeFighter ? CLOSE.staminaMul : 1),
    tired: false, // バテ状態（満タンに戻るまで回避・ダッシュ不可、足が遅い）
    staminaWait: 0, // 回復が始まるまでの残り秒
    fight: { d: 0, h: 0 }, // いまのボス戦で与えたダメージ・回復した量（撃破後の順位表）
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
    cd: { q: 0, e: 0, c: 0 },
    hpHist: [], // 時魔導士の巻き戻し用：0.1秒ごとの HP（3秒ぶん）
    hpHistT: 0,
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
      p.stamina = p.staminaMax;
      p.tired = false;
      p.invuln = 0;
      p.cd.q = 0;
      p.cd.e = 0;
      p.cd.c = 0;
      p.hpHist.length = 0;
      p.wolfUsed = false;
      p.mark = null;
      p.shotCd = 0;
      p.buffs = {};
      p.pending.length = 0;
      if (p.net) Object.assign(p.net, { x, z, yaw });
    },

    /** 今の攻撃力（バフ込み） */
    atkNow() {
      let a = J.stats.atk * (J.power ?? 1) * (p.buffs.courage ? p.buffs.courage.mul : 1); // power：職ごとの火力係数
      // 汎用：バフの atkMul（怒号・竜化・星占いなど）をすべて掛ける
      for (const b of Object.values(p.buffs)) if (b.atkMul) a *= b.atkMul;
      if (J.barrierAtk && p.buffs.barrier) a *= J.barrierAtk; // 結界師：バリアがある間 攻撃力アップ
      if (J.soulPer) a *= 1 + (p.soul || 0); // 魂喰い：当てるほど永続的に強くなる
      if (J.rageOnHurt) a *= 1 + (p.rage || 0); // 修羅：受けるほど強い
      if (J.moveAtk && p.walking) a *= J.moveAtk; // 韋駄天：動いている間は強い
      if (J.lastStand) {
        // 背水：倒れている仲間の数と、自分の HP の少なさで強くなる
        const downs = game.players.filter((o) => o !== p && o.downed).length;
        a *= 1 + J.lastStand * downs;
        if (p.hp / p.maxHp < 0.3) a *= 1.3;
      }
      if (J.chainPer) a *= 1 + (p.chain || 0) * J.chainPer; // 格闘家の連打
      if (J.lowHpBonus) a *= 1 + J.lowHpBonus * (1 - p.hp / p.maxHp); // 狂戦士：HP が減るほど強い
      if (p.closeIn()) a *= CLOSE.atkMul; // 近接職の肉薄ボーナス
      return a;
    },
    /** 被ダメージの倍率（職業の特性・バフ込み） */
    dmgTakenMul() {
      let m = J.dmgTaken ?? 1;
      if (p.buffs.taunt) m *= 0.5;
      if (p.buffs.sanctuary) m *= p.buffs.sanctuary.mul; // 僧侶の聖なる守り
      // 汎用：バフの dmgMul（怒号・竜化・闇の衣など）をすべて掛ける
      for (const b of Object.values(p.buffs)) if (b.dmgMul) m *= b.dmgMul;
      if (game.paladinAura?.(p)) m *= 0.9; // 聖騎士の近くでは被ダメ -10%
      if (J.stillGuard && p.still > 0.5) m *= J.stillGuard; // 要塞兵：止まっていると硬い
      if (p.buffs.aegis) m *= 0.5;
      if (J.summonGuard && game.allies?.ownedBy(p.id)) m *= J.summonGuard;
      if (p.closeIn()) m *= CLOSE.dmgMul; // 近接職の肉薄ボーナス
      return m;
    },
    /** 近接職（タンク以外）がボスのすぐ近くにいるか（肉薄ボーナス） */
    closeIn() {
      if (!J.closeFighter || !p.alive) return false;
      for (const b of game.bosses) {
        if (b.active && b.alive && !b.hidden && Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) - b.radius < CLOSE.near) return true;
      }
      return false;
    },
    /** sec 秒前の HP（記録が無ければ undefined） */
    hpAgo(sec) {
      const i = p.hpHist.length - 1 - Math.round(sec / 0.1);
      return i >= 0 ? p.hpHist[i] : p.hpHist[0];
    },
    /** 必殺ゲージを足す */
    addGauge(n) {
      if (p.remote) return;
      p.gauge = Math.min(GAUGE.max, p.gauge + n * (J.gaugeMul || 1));
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
      p.soul = 0;
      p.rage = 0;
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
      const cdRate = game.bardAura?.(p) || 1; // 吟遊詩人の近くでは速く戻る
      p.cd.q = Math.max(0, p.cd.q - dt * cdRate);
      p.cd.e = Math.max(0, p.cd.e - dt * cdRate);
      p.cd.c = Math.max(0, p.cd.c - dt * cdRate);
      // HP の記録（巻き戻し用）
      p.hpHistT -= dt;
      if (p.hpHistT <= 0) {
        p.hpHistT = 0.1;
        p.hpHist.push(p.hp);
        if (p.hpHist.length > 40) p.hpHist.shift();
      }
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
      if (J.idleCharge) p.idleT = (p.idleT || 0) + dt;
      // 太鼓叩き：リズムの拍ごとに小さく光る（拍がわかるように）
      if (J.beat) {
        const ph = (performance.now() / 1000) % J.beat.period;
        if (ph < (p.lastPh ?? 0)) game.fx.burst(p.pos.x, 2.4, p.pos.z, 0xffeb3b, 4, { speed: 1, up: 1, life: 0.25, grav: 0 });
        p.lastPh = ph;
      }
      // 先駆け：ボス戦が始まってから15秒間 攻撃力アップ（ボスごとに）
      if (J.vanguard) {
        const b = game.bosses.find((o) => o.active && o.alive);
        const key = b ? `${b.idx}` : null;
        if (key && p.vanguardKey !== key) {
          p.vanguardKey = key;
          p.buff('vanguard', J.vanguard.dur, { atkMul: J.vanguard.atkMul });
          game.toastOnce('先陣を切る！ 攻撃力アップ', 1400);
        }
      }
      // 狩人の印の残り時間
      if (p.mark) {
        p.mark.t -= dt;
        if (p.mark.t <= 0 || !p.mark.target.alive) p.mark = null;
      }
      // 人狼：HP が半分を切ると一度だけ自動で獣化（エリアに入り直すとまた使える）
      if (J.wolfAt && !p.wolfUsed && p.hp / p.maxHp < J.wolfAt) {
        p.wolfUsed = true;
        p.buff('wolf', J.wolfBuff.dur, { ...J.wolfBuff.vals });
        game.fx.burst(p.pos.x, 1.6, p.pos.z, 0x795548, 40, { speed: 6, up: 5, life: 0.8 });
        game.sound.se('roar');
        game.toastOnce('獣化！ 人狼の力が目覚めた', 1600);
      }
      // 治癒拳士：殴った分をまとめて周りの仲間の回復に（1.2秒ごと）
      if (J.healPool) {
        p.healT = (p.healT ?? 1.2) - dt;
        if (p.healT <= 0) {
          p.healT = 1.2;
          if (p.healPool > 0) {
            game.teamEffect({ kind: 'heal', x: +p.pos.x.toFixed(1), z: +p.pos.z.toFixed(1), r: J.healPool.radius, amount: Math.min(J.healPool.max, p.healPool * J.healPool.rate), quiet: true, from: p.id, selfMul: J.healPool.selfMul ?? 1 });
            p.healPool = 0;
          }
        }
      }
      // 鷹匠：鷹が一定間隔で一番近い敵を自動で攻撃する
      if (J.hawk) {
        p.hawkT = (p.hawkT ?? J.hawk.every) - dt * (p.buffs.hawkfrenzy ? 2.5 : 1);
        if (p.hawkT <= 0) {
          p.hawkT = J.hawk.every;
          let best = null;
          let bd = J.hawk.range;
          forEachTarget(game, (e) => {
            const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
            if (d < bd) { bd = d; best = e; }
          });
          if (best) {
            game.fx.burst(best.pos.x, (best.hpY || 2) * 0.8, best.pos.z, 0xa1887f, 10, { speed: 4, up: 3, life: 0.4 });
            strike(game, p, best, J.hawk.mult, { gauge: 2, knock: 0, color: 0xa1887f });
          }
        }
      }
      if (J.selfRegen) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * J.selfRegen * dt); // 料理人のつまみ食い
      if (J.hpDrain && p.hp > 1 && !p.buffs.curseHold) p.hp = Math.max(1, p.hp - p.maxHp * J.hpDrain * dt); // 呪いの騎士：HP が減り続ける

      const mlen = Math.hypot(intent.moveX, intent.moveZ);
      const moving = mlen > 0.01;
      p.still = moving ? 0 : p.still + dt;
      const moveYaw = moving ? Math.atan2(intent.moveX, intent.moveZ) : p.yaw;
      const canStamina = (!p.tired && p.stamina > 0) || !!p.buffs.gale;
      const busy = p.action === 'dodge' || p.action === 'spin' || p.action === 'cast' || p.action === 'dash';

      // ---- 行動の開始 ----
      if (intent.dodge && J.noDodge) {
        if (p === game.me()) game.toastOnce('鬼は回避できない！（そのかわり硬い）', 1200);
      } else if (intent.dodge && p.dodgeCd <= 0 && p.action !== 'dodge' && p.action !== 'dash' && canStamina) {
        const y = moving ? moveYaw : p.yaw + Math.PI;
        p.action = 'dodge';
        p.actT = 0;
        p.dodgeX = Math.sin(y);
        p.dodgeZ = Math.cos(y);
        p.invuln = Math.max(p.invuln, PLAYER.dodgeInvuln + (J.dodgeInvulnBonus || 0) + (J.closeFighter ? CLOSE.dodgeInvulnAdd : 0));
        p.dodgeCd = PLAYER.dodgeCd + PLAYER.dodgeTime;
        if (moving && !intent.lockYaw) p.yaw = y;
        p.useStamina(STAMINA.dodgeCost * (J.dodgeCostMul ?? 1));
        if (J.dodgeCostMul) p.critNext = true; // 忍者：回避直後の1撃は会心
        if (J.dodgeGauge) p.addGauge(J.dodgeGauge); // 踊り子：回避で必殺ゲージ
        // 曲芸師：回避したその場で爆発
        if (J.dodgeBlast) {
          game.fx.burst(p.pos.x, 0.8, p.pos.z, 0xffd54f, 24, { speed: 6, up: 4, life: 0.5 });
          radiusHit(game, p, J.dodgeBlast.mult, J.dodgeBlast.radius, { gauge: 2, color: 0xffd54f, knock: 1 });
          game.raid?.sendSkill(p, '_dodgeblast', { x: p.pos.x, z: p.pos.z });
        }
        game.sound.se('dodge');
        game.fx.burst(p.pos.x, 0.3, p.pos.z, 0xd7ccc8, 8, { speed: 2, up: 1, life: 0.4 });
      } else if (intent.dodge && p.tired && p === game.me()) {
        game.toastOnce('バテていて回避できない！');
      } else if ((intent.skillQ || intent.skillE || (intent.skillC && J.c)) && !busy) {
        // Q・E・C：クールダウン制のスキル
        const slot = intent.skillQ ? 'q' : intent.skillE ? 'e' : 'c';
        const sk = J[slot];
        if (p.cd[slot] > 0) {
          if (p === game.me()) game.toastOnce(`${sk.name}はあと ${p.cd[slot].toFixed(1)} 秒`, 900);
        } else if ((slot === 'q' ? castQ : slot === 'e' ? castE : castC)(game, p, intent)) {
          p.cd[slot] = p.cdOverride ?? sk.cd * (J.cdMul || 1); // 賢者はクールダウンが短い。cdOverride：転送結界の印・蘇生ショットの空振り
          delete p.cdOverride;
        }
      } else if (intent.skillR && !busy) {
        // R：必殺技（必殺ゲージ。oncePerRun なら1回の挑戦で1度だけ）
        const once = J.r.oncePerRun;
        const used = once && game.state.progress.usedOnce?.[J.r.id];
        if (used) {
          if (p === game.me()) game.toastOnce(`${J.r.name}はこの挑戦ではもう使った（1度だけ）`, 1600);
        } else if (p.gauge < GAUGE.max) {
          if (p === game.me()) game.toastOnce('必殺ゲージが足りない（通常攻撃を当てて溜める。近接ほど早く溜まる）', 1600);
        } else if (castR(game, p, intent)) {
          p.gauge = 0;
          if (once) game.state.progress.usedOnce = { ...(game.state.progress.usedOnce || {}), [J.r.id]: true };
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
        if (p.lunge && p.lunge.t > 0) {
          const s = Math.min(dt, p.lunge.t);
          p.lunge.t -= s;
          p.pos.x += p.lunge.vx * s;
          p.pos.z += p.lunge.vz * s;
          game.world.collide(p.pos, p.radius);
        }
        if (!p.didHit && p.actT >= c.hit) {
          p.didHit = true;
          const crit = p.critNext || (last && J === JOBS.swordsman);
          const bonus = meleeBonus();
          if (meleeArc(game, p, p.yaw, c.mult * bonus, J.basic.range + (last ? J.basic.heavyBonus : 0), J.basic.arc, { crit, gauge: J.basicGauge, basic: true })) {
            p.critNext = false;
            p.idleT = 0; // 溜め斬り：当てたら溜めはリセット
          }
          // 剣の軌跡
          const sx = p.pos.x + Math.sin(p.yaw) * 1.6;
          const sz = p.pos.z + Math.cos(p.yaw) * 1.6;
          game.fx.burst(sx, 1.2, sz, J.look.swordColor, 5, { speed: 2, up: 1, life: 0.25, size: 0.1, grav: 0 });
          game.skillFx?.swing(p, p.combo, last, J.basic.range + (last ? J.basic.heavyBonus : 0), J.basic.arc, parseInt(J.color.slice(1), 16)); // 剣の軌跡（src/skillfx.js）
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
          const rm = J.closeFighter ? (p.tired ? CLOSE.tiredRegenMul : CLOSE.regenMul) : 1;
          p.stamina = Math.min(p.staminaMax, p.stamina + (p.tired ? STAMINA.tiredRegenPerSec : STAMINA.regenPerSec) * rm * dt);
          if (p.tired && p.stamina >= p.staminaMax) p.tired = false;
        }
      }
      if (p.tired && !p.buffs.gale) speedMul *= PLAYER.tiredMul;
      // 汎用：バフの speedMul（疾風の旋律・影分身・雷速・竜化など）
      for (const b of Object.values(p.buffs)) if (b.speedMul) speedMul *= b.speedMul;

      // ---- 移動 ----
      let vx = 0;
      let vz = 0;
      if (p.action === 'dodge') {
        const ds = PLAYER.dodgeSpeed * (J.closeFighter ? CLOSE.dodgeSpeedMul : 1); // 近接職は遠くまで転がる
        vx = p.dodgeX * ds;
        vz = p.dodgeZ * ds;
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
    // 被弾後の無敵は点滅させる（回避・突進・跳ぶ技の無敵は点滅させない）。
    // ほかの人の分身は無敵の残り時間が届かない（invuln は 0.1 で固定）ので、時計で点滅させる
    const flick = p.remote ? Math.floor(performance.now() / 50) : Math.floor(p.invuln * 20);
    const blink = p.invuln > 0 && p.action !== 'dodge' && p.action !== 'dash' && flick % 2 === 0;
    model.group.visible = !blink && !p.hideBody; // 一人称では自分の体を描かない
    let glow = p.buffs.courage ? 0x332200 : p.buffs.clone ? 0x220033 : 0x000000;
    // 回復ができる職業で遊んでいる人の画面では、HP が少ない（35% 以下）か倒れた仲間を赤く点滅させる
    if (p.remote && game.me()?.job.healer && (p.downed || p.hp / p.maxHp <= 0.35)) {
      glow = Math.floor(performance.now() / 250) % 2 ? 0xaa0000 : 0x440000;
    }
    model.armorMat.emissive.setHex(p.flash > 0 ? 0x880000 : glow);
  }

  /** 通常攻撃（近接）の倍率：太鼓叩きのリズム・溜め斬りの溜め */
  function meleeBonus() {
    let m = 1;
    if (J.beat) {
      // 一定のリズム（period 秒ごと）にぴったり合わせて当てると 2倍
      const ph = (performance.now() / 1000) % J.beat.period;
      if (ph < J.beat.window || ph > J.beat.period - J.beat.window) {
        m *= J.beat.mult;
        game.fx.text(p.pos.x, 2.6, p.pos.z, '♪ジャスト', '#ffeb3b');
      }
    }
    if (J.idleCharge) {
      // 当てていない時間が長いほど強い（最大 max 倍）
      const k = Math.min(J.idleCharge.max, 1 + (p.idleT || 0) * J.idleCharge.per);
      if (k > 1.3) game.fx.text(p.pos.x, 2.6, p.pos.z, `溜め ×${k.toFixed(1)}`, '#ffab40');
      m *= k;
    }
    return m;
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
    p.lunge = null;
    if (J.closeFighter && !p.remote) {
      // 踏み込み：前方の一番近い敵へ、届く距離まで少し寄る（三人称なら向きも合わせる）
      let best = null;
      let bd = Infinity;
      forEachTarget(game, (e) => {
        const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) - e.radius;
        if (d >= bd || d > J.basic.range + CLOSE.lungeMax + 1) return;
        const a = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
        if (Math.abs(Math.atan2(Math.sin(a - p.yaw), Math.cos(a - p.yaw))) > CLOSE.lungeArc) return;
        bd = d;
        best = { e, a };
      });
      if (best) {
        if (!intent.lockYaw) p.yaw = best.a;
        const gap = Math.min(CLOSE.lungeMax, bd - J.basic.range * 0.6);
        const t = Math.max(0.06, J.basic.combo[i].hit);
        if (gap > 0.05) p.lunge = { vx: (Math.sin(best.a) * gap) / t, vz: (Math.cos(best.a) * gap) / t, t };
      }
    }
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
