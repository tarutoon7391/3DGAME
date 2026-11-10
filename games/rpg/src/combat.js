// ダメージ計算と、攻撃の当たり判定（プレイヤー→敵、敵→プレイヤー）
import { angleDiff, yawTo } from './util.js';
import { PLAYER } from './data/levels.js';

/** 攻撃力×倍率 − 防御÷2 に ±10% のぶれ。最低1 */
export function calcDamage(atk, mult, def) {
  const base = atk * mult - def * 0.5;
  return Math.max(1, Math.round(base * (0.9 + Math.random() * 0.2)));
}

/** 生きている攻撃対象（雑魚＋戦闘中のボス）に fn を呼ぶ */
export function forEachTarget(game, fn) {
  for (const e of game.enemies.list) if (e.alive) fn(e);
  const b = game.boss;
  if (b && b.active && b.alive) fn(b);
}

/** プレイヤーの攻撃を1体に当てる */
export function strike(game, pl, target, mult, { knock = 1, color = 0xffffff } = {}) {
  const d = game.state.derived();
  const crit = Math.random() < 0.1;
  const dmg = calcDamage(d.atk, mult * (crit ? 1.5 : 1), target.defense);
  const dx = target.pos.x - pl.pos.x;
  const dz = target.pos.z - pl.pos.z;
  const len = Math.hypot(dx, dz) || 1;
  target.takeHit(game, dmg, dx / len, dz / len, knock);
  game.fx.text(target.pos.x, target.hpY ?? 2, target.pos.z, crit ? `${dmg}!` : String(dmg), crit ? '#ffd54f' : '#ffffff', crit);
  game.fx.burst(target.pos.x, 1, target.pos.z, color, crit ? 14 : 8, { speed: 5, up: 3, life: 0.4 });
  game.sound.se(crit ? 'crit' : 'hit');
  game.fx.hitstop(crit ? 0.07 : 0.04);
  return dmg;
}

/** 扇形の近接攻撃。当たった数を返す */
export function meleeArc(game, pl, yaw, mult, range = PLAYER.attackRange, arc = PLAYER.attackArc) {
  let n = 0;
  forEachTarget(game, (e) => {
    const dx = e.pos.x - pl.pos.x;
    const dz = e.pos.z - pl.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > range + e.radius) return;
    if (d > e.radius + 0.6 && Math.abs(angleDiff(yaw, yawTo(pl.pos.x, pl.pos.z, e.pos.x, e.pos.z))) > arc / 2) return;
    strike(game, pl, e, mult);
    n++;
  });
  return n;
}

/** 円範囲の攻撃 */
export function radiusHit(game, pl, mult, radius) {
  let n = 0;
  forEachTarget(game, (e) => {
    if (Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) > radius + e.radius) return;
    strike(game, pl, e, mult, { knock: 1.6, color: 0x80d8ff });
    n++;
  });
  return n;
}

/**
 * 敵の攻撃をプレイヤーに当てる。無敵中は false
 * @param {number} atk 攻撃側の攻撃力
 */
export function hurtPlayer(game, pl, atk, mult, fromX, fromZ) {
  if (!pl.alive || pl.invuln > 0) return false;
  const st = game.state;
  const dmg = calcDamage(atk, mult, st.derived().def);
  st.progress.hp = Math.max(0, st.progress.hp - dmg);
  const dx = pl.pos.x - fromX;
  const dz = pl.pos.z - fromZ;
  const len = Math.hypot(dx, dz) || 1;
  pl.onHurt(dx / len, dz / len);
  game.fx.text(pl.pos.x, 2.3, pl.pos.z, String(dmg), '#ff5252', dmg >= 30);
  game.fx.burst(pl.pos.x, 1.2, pl.pos.z, 0xff1744, 10, { speed: 4, life: 0.4 });
  game.fx.shake(Math.min(0.9, 0.3 + dmg / 60));
  game.sound.se('hurt');
  if (st.progress.hp <= 0) game.onPlayerDown(pl);
  return true;
}

/** 一番近い生存プレイヤー（いなければ null）。players[0] を決め打ちしない */
export function nearestPlayer(game, x, z, maxDist = Infinity) {
  let best = null;
  let bd = maxDist * maxDist;
  for (const p of game.players) {
    if (!p.alive) continue;
    const d = (p.pos.x - x) ** 2 + (p.pos.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}
