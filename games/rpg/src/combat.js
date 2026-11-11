// ダメージ計算と、攻撃の当たり判定（プレイヤー→敵、敵→プレイヤー）
// 協力プレイ：自分の攻撃の当たり判定は自分のブラウザで行い、ホストのボス・雑魚には「何ダメージ当てた」を送る
// 敵→他の人への攻撃は、その人のブラウザへ「当たった」を送り、向こうで無敵などを見て判定する
import { angleDiff, yawTo } from './util.js';
import { PLAYER } from './data/player.js';
import { GAUGE } from './data/jobs.js';

/**
 * 攻撃力×倍率を、防御で割合カット（防御 8 で約 2割減）して ±10% のぶれ。最低1（プレイヤー→敵）
 * 以前は「− 防御÷2」の固定値引きで、1発の軽い攻撃（連射・多段）がほぼ 1 ダメージになっていたので割合にした
 */
export function calcDamage(atk, mult, def) {
  const base = atk * mult * (DEF_K / (DEF_K + def));
  return Math.max(1, Math.round(base * (0.9 + Math.random() * 0.2)));
}
const DEF_K = 30; // 防御の効き方（大きいほど防御が効きにくい）

/** 生きている攻撃対象（雑魚＋戦闘中のボス）に fn を呼ぶ */
export function forEachTarget(game, fn) {
  for (const e of game.enemies.list) if (e.alive) fn(e);
  for (const b of game.bosses) if (b.active && b.alive) fn(b);
}

/**
 * プレイヤーの攻撃を1体に当てる
 * opts: knock, color, melee（近接か。ブレイク値と必殺ゲージの溜まり方が変わる）, gauge（ゲージの増え方。省略時は近接/飛び道具で決まる）,
 *       crit（必ず会心）, clone（分身の追い打ち）
 */
export function strike(game, pl, target, mult, opts = {}) {
  const { knock = 1, color = 0xffffff, melee = false, crit: forceCrit = false, clone = false } = opts;
  const J = pl.job;
  let critRate = PLAYER.critRate + (J.critBonus || 0);
  for (const b of Object.values(pl.buffs)) if (b.critAdd) critRate += b.critAdd;
  const crit = forceCrit || Math.random() < critRate;
  // 道化師：たまにダメージ2倍
  if (J.luckyChance && Math.random() < J.luckyChance) mult *= 2;
  // 暗殺者：相手の背中側から当てると強い
  if (J.backstab && target.yaw !== undefined) {
    const toMe = Math.atan2(pl.pos.x - target.pos.x, pl.pos.z - target.pos.z);
    if (Math.abs(angleDiff(target.yaw, toMe)) > Math.PI * 0.55) mult *= J.backstab;
  }
  // エクソシスト：怒っている・気絶しているボスに強い
  if (J.vsRage && (target.raged || target.state === 'stun')) mult *= J.vsRage;
  // 狩人：印を付けた相手には自分のダメージが上がる
  if (pl.mark && pl.mark.t > 0 && pl.mark.target === target) mult *= pl.job.markBonus || 1.5;
  // 職業の特性による倍率：腐食中のボス（錬金術師）・瀕死のボス（処刑人）
  if (J.vulnBonus && target.debuffs?.vuln) mult *= J.vulnBonus;
  if (J.executeBonus && target.maxHp && target.hp / target.maxHp <= J.executeAt) mult *= J.executeBonus;
  const dmg = calcDamage(pl.atkNow(), mult * (crit ? PLAYER.critMul + (J.critDmgBonus || 0) : 1), target.defense);
  const dx = target.pos.x - pl.pos.x;
  const dz = target.pos.z - pl.pos.z;
  const len = Math.hypot(dx, dz) || 1;
  const brk = dmg * (melee ? 1 : GAUGE.breakShot) * (J.breakMul ?? 1) * (opts.brkMul ?? 1);
  target.takeHit(game, dmg, dx / len, dz / len, knock, { brk, from: pl.id });
  pl.addGauge(opts.gauge ?? (melee ? GAUGE.gainMelee : GAUGE.gainShot));
  if (!pl.remote) {
    // 吸血（呪術師の特性・狂戦士の血の旋風）
    let ls = (J.lifesteal || 0) + (opts.lifesteal || 0);
    for (const b of Object.values(pl.buffs)) if (b.lifesteal) ls += b.lifesteal; // 吸血鬼の蝙蝠化など
    if (ls && pl.alive && pl.hp !== undefined) {
      const gain = J.lifestealCap ? Math.min(dmg * ls, pl.maxHp * J.lifestealCap) : dmg * ls; // 呪術師は1回の回復に上限
      pl.hp = Math.min(pl.maxHp, pl.hp + gain);
    }
    // 格闘家：当て続けるほど強くなる
    if (J.chainPer && melee) pl.chain = Math.min(J.chainMax, (pl.chain || 0) + 1);
    if (J.soulPer && !opts.clone) pl.soul = Math.min(J.soulMax, (pl.soul || 0) + J.soulPer); // 魂喰い
    if (J.healPool && melee) pl.healPool = (pl.healPool || 0) + dmg; // 治癒拳士：殴った分を仲間の回復に回す
    // 鎧砕き：近接で殴るたびにボスの鎧が砕けて、被ダメが重なって上がる（送るのは 0.25 秒に1回まで）
    if (J.shred && melee && game.bosses.includes(target) && performance.now() - (pl.shredAt || 0) > 250) {
      pl.shredAt = performance.now();
      game.bossCommand({ type: 'shred', sub: target.sub, per: J.shred.per, max: J.shred.max });
    }
  }
  game.fx.text(target.pos.x, target.hpY ?? 2, target.pos.z, crit ? `${dmg}!` : String(dmg), clone ? '#ce93d8' : crit ? '#ffd54f' : '#ffffff', crit);
  game.fx.burst(target.pos.x, 1, target.pos.z, color, crit ? 14 : 8, { speed: 5, up: 3, life: 0.4 });
  game.sound.se(crit ? 'crit' : 'hit');
  if (melee) game.fx.hitstop(crit ? 0.07 : 0.04);
  // 魔剣士の魔力付与：近接が当たると小さな爆発（爆発そのものは付与を起こさない）
  const ench = pl.buffs.enchant;
  if (ench && melee && !opts.enchanted) {
    game.fx.burst(target.pos.x, 1.2, target.pos.z, ench.color || 0x7c4dff, 10, { speed: 5, up: 3, life: 0.35 });
    radiusHit(game, pl, ench.mult, ench.radius, { enchanted: true, gauge: 0, color: ench.color || 0x7c4dff, knock: 0.5 }, target.pos.x, target.pos.z);
  }
  // 鞭使い：当てるたびに足が速くなる（最大 +30%・2秒）
  if (J.whipSpeed && melee && !pl.remote) {
    const st = Math.min(J.whipSpeed.max, (pl.buffs.whipspeed?.stacks || 0) + 1);
    pl.buff('whipspeed', 2, { stacks: st, speedMul: 1 + st * J.whipSpeed.per });
  }
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
  // 酔拳家・幽霊：一定の確率で攻撃をすり抜ける
  if (pl.job.evade && Math.random() < pl.job.evade) {
    pl.invuln = Math.max(pl.invuln, 0.35);
    game.fx.text(pl.pos.x, 2.3, pl.pos.z, 'ひらり', '#b3e5fc');
    return false;
  }
  // 侍の見切り：構え中に攻撃を受けたら無傷で反撃
  if (pl.buffs.counter) {
    const c = pl.buffs.counter;
    delete pl.buffs.counter;
    pl.invuln = Math.max(pl.invuln, 0.6);
    game.fx.burst(pl.pos.x, 1.4, pl.pos.z, 0xffffff, 30, { speed: 7, up: 3, life: 0.4 });
    game.sound.se('crit');
    game.toastOnce('見切った！ 反撃！', 1000);
    let best = null;
    let bd = Infinity;
    forEachTarget(game, (e) => {
      const d = Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) - e.radius;
      if (d < bd) { bd = d; best = e; }
    });
    if (best && bd < c.range) strike(game, pl, best, c.mult, { melee: true, crit: true, gauge: 15, knock: 2 });
    return false;
  }
  // 重騎士の守護結界の中にいれば被ダメ半減
  if (game.inAegis?.(pl.pos.x, pl.pos.z)) pl.buff('aegis', 0.2);
  let dmg = Math.max(1, Math.ceil(pl.maxHp * frac * pl.dmgTakenMul()));
  // 剣闘士：正面（向いている方向の左右60°）からの攻撃は 40% カット
  if (pl.job.frontGuard) {
    const toFrom = Math.atan2(fromX - pl.pos.x, fromZ - pl.pos.z);
    if (Math.abs(angleDiff(pl.yaw, toFrom)) < Math.PI / 3) dmg = Math.max(1, Math.ceil(dmg * pl.job.frontGuard));
  }
  // 結界師のバリア：先にバリアが受け止める
  const bar = pl.buffs.barrier;
  if (bar && bar.hp > 0) {
    const used = Math.min(bar.hp, dmg);
    bar.hp -= used;
    dmg -= used;
    game.fx.burst(pl.pos.x, 1.2, pl.pos.z, 0x80d8ff, 10, { speed: 3, up: 2, life: 0.4 });
    if (bar.hp <= 0) delete pl.buffs.barrier;
    if (dmg <= 0) {
      pl.invuln = Math.max(pl.invuln, 0.3);
      game.sound.se('hit');
      return true;
    }
  }
  pl.hp = Math.max(0, pl.hp - dmg);
  // 棘の騎士：殴られたら近くの敵にとげで反撃
  if (pl.job.thorns && pl.hp > 0) {
    let best = null;
    let bd = 9;
    forEachTarget(game, (e) => {
      const d = Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) - e.radius;
      if (d < bd) { bd = d; best = e; }
    });
    if (best) strike(game, pl, best, pl.job.thorns, { gauge: 4, knock: 0.3, color: 0x8bc34a });
  }
  // 修羅：攻撃を受けるほど強くなる（倒れると0に戻る）
  if (pl.job.rageOnHurt) pl.rage = Math.min(pl.job.rageMax, (pl.rage || 0) + pl.job.rageOnHurt);
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
