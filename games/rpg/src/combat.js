// ダメージ計算と、攻撃の当たり判定（プレイヤー→敵、敵→プレイヤー）
// 協力プレイ：自分の攻撃の当たり判定は自分のブラウザで行い、ホストのボス・雑魚には「何ダメージ当てた」を送る
// 敵→他の人への攻撃は、その人のブラウザへ「当たった」を送り、向こうで無敵などを見て判定する
import { angleDiff, yawTo } from './util.js';
import { PLAYER } from './data/player.js';
import { GAUGE } from './data/jobs.js';

/** 攻撃力×倍率 − 防御÷2 に ±10% のぶれ。最低1（プレイヤー→敵） */
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

/**
 * プレイヤーの攻撃を1体に当てる
 * opts: knock, color, melee（近接か。ブレイク値と必殺ゲージの溜まり方が変わる）, gauge（ゲージの増え方。省略時は近接/飛び道具で決まる）,
 *       crit（必ず会心）, clone（分身の追い打ち）
 */
export function strike(game, pl, target, mult, opts = {}) {
  const { knock = 1, color = 0xffffff, melee = false, crit: forceCrit = false, clone = false } = opts;
  const J = pl.job;
  const crit = forceCrit || Math.random() < PLAYER.critRate + (J.critBonus || 0);
  // 職業の特性による倍率：腐食中のボス（錬金術師）・瀕死のボス（処刑人）
  if (J.vulnBonus && target.debuffs?.vuln) mult *= J.vulnBonus;
  if (J.executeBonus && target.maxHp && target.hp / target.maxHp <= J.executeAt) mult *= J.executeBonus;
  const dmg = calcDamage(pl.atkNow(), mult * (crit ? PLAYER.critMul : 1), target.defense);
  const dx = target.pos.x - pl.pos.x;
  const dz = target.pos.z - pl.pos.z;
  const len = Math.hypot(dx, dz) || 1;
  const brk = dmg * (melee ? 1 : GAUGE.breakShot) * (J.breakMul ?? 1);
  target.takeHit(game, dmg, dx / len, dz / len, knock, { brk, from: pl.id });
  pl.addGauge(opts.gauge ?? (melee ? GAUGE.gainMelee : GAUGE.gainShot));
  if (!pl.remote) {
    // 吸血（呪術師の特性・狂戦士の血の旋風）
    const ls = (J.lifesteal || 0) + (opts.lifesteal || 0);
    if (ls && pl.alive && pl.hp !== undefined) pl.hp = Math.min(pl.maxHp, pl.hp + dmg * ls);
    // 格闘家：当て続けるほど強くなる
    if (J.chainPer && melee) pl.chain = Math.min(J.chainMax, (pl.chain || 0) + 1);
  }
  game.fx.text(target.pos.x, target.hpY ?? 2, target.pos.z, crit ? `${dmg}!` : String(dmg), clone ? '#ce93d8' : crit ? '#ffd54f' : '#ffffff', crit);
  game.fx.burst(target.pos.x, 1, target.pos.z, color, crit ? 14 : 8, { speed: 5, up: 3, life: 0.4 });
  game.sound.se(crit ? 'crit' : 'hit');
  if (melee) game.fx.hitstop(crit ? 0.07 : 0.04);
  // 忍者の影分身：少し遅れて分身が同じ相手を斬る
  if (pl.buffs.clone && melee && !clone) {
    const cm = pl.buffs.clone.cloneMult;
    pl.pending.push({ t: 0.12, fn: () => { if (target.alive) strike(game, pl, target, mult * cm, { ...opts, clone: true, gauge: 0 }); } });
  }
  return dmg;
}

/** 扇形の近接攻撃。当たった数を返す */
export function meleeArc(game, pl, yaw, mult, range = PLAYER.attackRange, arc = PLAYER.attackArc, opts = {}) {
  let n = 0;
  forEachTarget(game, (e) => {
    const dx = e.pos.x - pl.pos.x;
    const dz = e.pos.z - pl.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > range + e.radius) return;
    if (d > e.radius + 0.6 && Math.abs(angleDiff(yaw, yawTo(pl.pos.x, pl.pos.z, e.pos.x, e.pos.z))) > arc / 2) return;
    strike(game, pl, e, mult, { melee: true, ...opts });
    n++;
  });
  return n;
}

/** 円範囲の攻撃（中心 cx,cz 省略時はプレイヤーの位置） */
export function radiusHit(game, pl, mult, radius, opts = {}, cx = pl.pos.x, cz = pl.pos.z) {
  let n = 0;
  forEachTarget(game, (e) => {
    if (Math.hypot(e.pos.x - cx, e.pos.z - cz) > radius + e.radius) return;
    strike(game, pl, e, mult, { knock: 1.6, color: 0x80d8ff, gauge: GAUGE.gainSkill, ...opts });
    n++;
  });
  return n;
}

/**
 * 敵の攻撃をプレイヤーに当てる。無敵中は false
 * 他の人（remote）なら、その人のブラウザへ送って向こうで判定する
 * @param {number} frac 最大 HP に対する割合（data/player.js の HIT）
 */
export function hurtPlayer(game, pl, frac, fromX, fromZ) {
  if (!pl.alive) return false;
  if (pl.remote) {
    if (pl.invuln > 0) return false;
    game.raid?.sendHurt(pl, frac, fromX, fromZ);
    return true;
  }
  if (pl.invuln > 0) return false;
  // 重騎士の守護結界の中にいれば被ダメ半減
  if (game.inAegis?.(pl.pos.x, pl.pos.z)) pl.buff('aegis', 0.2);
  const dmg = Math.max(1, Math.ceil(pl.maxHp * frac * pl.dmgTakenMul()));
  pl.hp = Math.max(0, pl.hp - dmg);
  const dx = pl.pos.x - fromX;
  const dz = pl.pos.z - fromZ;
  const len = Math.hypot(dx, dz) || 1;
  pl.onHurt(dx / len, dz / len);
  game.fx.text(pl.pos.x, 2.3, pl.pos.z, String(dmg), '#ff5252', frac >= 0.3);
  game.fx.burst(pl.pos.x, 1.2, pl.pos.z, 0xff1744, 10, { speed: 4, life: 0.4 });
  game.fx.shake(0.5 + frac);
  game.sound.se('hurt');
  if (pl.hp <= 0) game.onPlayerDown(pl);
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

/**
 * ボスの標的：挑発中の重騎士 → 召喚された岩巨人 → 一番近いプレイヤー
 * 返すのは pos と radius を持つもの（プレイヤーか召喚物）
 */
export function bossTarget(game, b) {
  const t = b.taunt;
  if (t && t.t > 0) {
    const p = game.players.find((o) => o.id === t.id && o.alive);
    if (p) return p;
  }
  const g = game.allies?.taunter();
  if (g) return g;
  return nearestPlayer(game, b.pos.x, b.pos.z);
}
