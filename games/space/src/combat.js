// 当たり判定とその結果（ダメージ・撃破・スコア・コンボ・アイテム・ボム）
import { segHitsSphere, dist2 } from './util.js';
import { ITEM_KINDS } from './items.js';
import { MAX_LV, MAX_SHIELD } from './player.js';

export const COMBO_TIME = 2.5;
const DROP_CHANCE = 0.045;
const DROP_KINDS = ['rapid', 'rapid', 'spread', 'spread', 'shield'];

/** コンボ倍率：4 コンボごとに +1（最大 ×8） */
export const comboMul = (combo) => Math.min(8, 1 + Math.floor(combo / 4));

/** スコア加算（コンボ倍率・難易度倍率込み） */
export function addScore(g, base) {
  const s = g.state;
  s.score += Math.round(base * comboMul(s.combo) * g.diff.scoreMul);
}

function onKill(g, e) {
  const s = g.state;
  s.combo++;
  s.comboT = COMBO_TIME;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
  s.kills++;
  addScore(g, e.def.score);
  const big = e.type === 'sniper' || e.type === 'rock';
  g.fx.explode(e.pos, e.def.color, big ? 34 : 24, big ? 20 : 16, big ? 0.9 : 0.7);
  g.fx.shake(0.25);
  g.sfx.explode();
  // 編隊全滅ボーナスのアイテム／ランダムドロップ
  const grp = e.group;
  if (grp) {
    grp.killed++;
    if (grp.killed >= grp.total) {
      g.items.spawn(grp.drop, e.pos);
      g.ui.message('', `編隊全滅！ ${ITEM_KINDS[grp.drop].label}`, 1.2);
    }
  } else if (Math.random() < DROP_CHANCE) {
    g.items.spawn(DROP_KINDS[Math.floor(Math.random() * DROP_KINDS.length)], e.pos);
  }
  g.enemies.kill(e);
}

/** 敵にダメージ。破壊不可ならはじく */
export function damageEnemy(g, e, dmg, at) {
  if (e.def.indestructible) {
    g.fx.spark(at, 0xaab4c8, 3);
    g.sfx.clank();
    return;
  }
  e.hp -= dmg;
  e.flash = 0.06;
  if (e.hp <= 0) onKill(g, e);
  else {
    g.fx.spark(at, 0xffffff, 3);
    g.sfx.hit();
  }
}

/** 自機の被弾。シールド→ライフの順に減る。ライフを失うと武器レベルが1下がる */
export function damagePlayer(g, p) {
  if (p.isInvulnerable()) return;
  const s = g.state;
  s.combo = 0;
  s.comboT = 0;
  s.noMiss = false;
  if (p.shield > 0) {
    p.shield--;
    p.invuln = 1.0;
    g.sfx.shieldHit();
    g.fx.explode(p.pos, 0x4db8ff, 22, 14, 0.5, 0.5);
    g.fx.shake(0.45);
    g.ui.flash('#4db8ff', 0.35);
    return;
  }
  p.lives--;
  p.rapid = Math.max(0, p.rapid - 1);
  p.spread = Math.max(0, p.spread - 1);
  p.invuln = 2.4;
  p.bombs = Math.max(p.bombs, 2);
  g.sfx.damage();
  g.fx.explode(p.pos, 0xff7040, 40, 20, 0.8, 0.8);
  g.fx.shake(1.3);
  g.ui.flash('#ff2244', 0.6);
  g.bullets.clearEnemy((pos) => g.fx.spark(pos, 0xffffff, 1));
  if (p.lives <= 0) {
    p.kill();
    g.fx.explode(p.pos, 0xffd080, 90, 30, 1.4, 1.3);
    g.sfx.bigExplode();
    g.onPlayerDead(p);
  } else {
    g.ui.message('', `被弾！ のこり ${p.lives}　武器レベルダウン`, 1.6);
  }
}

/** ボム：敵弾を全消去し、画面内の敵とボスの弱点にダメージ */
export function useBomb(g, p) {
  if (p.bombs <= 0 || p.dead) return;
  p.bombs--;
  p.invuln = Math.max(p.invuln, 1.2);
  const n = g.bullets.clearEnemy((pos) => g.fx.spark(pos, 0xfff0a0, 1));
  g.state.score += n * 10;
  g.enemies.forEach((e) => {
    if (e.pos.z > -190) damageEnemy(g, e, 15, e.pos);
  });
  const boss = g.boss;
  if (boss && !boss.entering && !boss.defeated) {
    boss.parts.forEach((part) => {
      if (boss.isVulnerable(part)) hitBossPart(g, part, 14);
    });
  }
  g.fx.explode(p.pos, 0xfff0c0, 80, 60, 1.2, 1);
  g.fx.shake(1.2);
  g.ui.flash('#ffffff', 0.9);
  g.sfx.bomb();
}

function hitBossPart(g, part, dmg) {
  const r = g.boss.damage(part, dmg);
  if (r === 'armor') {
    g.fx.spark(part.wpos, 0xaab4c8, 2);
    g.sfx.clank();
  } else if (r === 'hit') {
    g.state.score += Math.round(10 * g.diff.scoreMul);
    g.sfx.hit();
  } else {
    addScore(g, r === 'kill' ? 20000 : 3000);
    g.sfx.bigExplode();
    g.fx.shake(1);
    if (r === 'kill') g.onBossDefeated();
  }
}

/** 取得したアイテムの効果 */
export function pickItem(g, p, kind) {
  g.sfx.item();
  const label = ITEM_KINDS[kind].label;
  if (kind === 'shield') {
    if (p.shield >= MAX_SHIELD) {
      addScore(g, 1000);
      g.ui.message('', `${label} MAX ボーナス`, 1.2);
    } else {
      p.shield++;
      g.ui.message('', `${label} +1`, 1.2);
    }
    return;
  }
  if (p[kind] >= MAX_LV) {
    addScore(g, 1000);
    g.ui.message('', `${label} MAX ボーナス`, 1.2);
  } else {
    p[kind]++;
    g.ui.message('', `${label} Lv${p[kind]}`, 1.2);
  }
}

/** 1フレーム分の当たり判定 */
export function runCombat(g) {
  // 自機弾 → 敵・ボス
  const pb = g.bullets.player.alive;
  const pools = g.enemies.list;
  for (let i = 0; i < pb.length; i++) {
    const b = pb[i];
    if (!b.alive) continue;
    let hit = false;
    for (let k = 0; k < pools.length && !hit; k++) {
      const ea = pools[k].alive;
      for (let j = 0; j < ea.length; j++) {
        const e = ea[j];
        if (e.alive && segHitsSphere(b.prev, b.pos, e.pos, e.radius + 0.3)) {
          g.bullets.player.kill(b);
          damageEnemy(g, e, b.dmg, b.pos);
          hit = true;
          break;
        }
      }
    }
    if (hit || !g.boss) continue;
    const part = g.boss.hitTest(b.prev, b.pos);
    if (part) {
      g.bullets.player.kill(b);
      hitBossPart(g, part, b.dmg);
      if (part.weak) g.fx.spark(b.pos, 0xff8090, 2);
    }
  }

  // 敵弾・敵の体当たり → 自機（プレイヤーは配列で持つ）
  const eb = g.bullets.enemy.alive;
  for (let pi = 0; pi < g.players.length; pi++) {
    const p = g.players[pi];
    if (p.dead) continue;
    if (!p.isInvulnerable()) {
      const rr = (p.radius + 0.5) * (p.radius + 0.5);
      for (let i = 0; i < eb.length; i++) {
        const b = eb[i];
        if (b.alive && dist2(b.pos, p.pos) < rr) {
          b.alive = false;
          damagePlayer(g, p);
          break;
        }
      }
    }
    if (!p.isInvulnerable()) {
      g.enemies.forEach((e) => {
        const r = e.radius + p.radius;
        if (!p.isInvulnerable() && dist2(e.pos, p.pos) < r * r) {
          damagePlayer(g, p);
          if (!e.def.indestructible) damageEnemy(g, e, 10, e.pos);
        }
      });
    }
  }
}
