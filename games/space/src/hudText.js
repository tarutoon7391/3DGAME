// 左上 HUD（shared の hud() に渡す HTML）を組み立てる
import { STAGES } from './data/stages.js';
import { MAX_LV, MAX_SHIELD } from './player.js';
import { fmt } from './util.js';

const pips = (n, max, on, off = '#ffffff30') =>
  `<span style="color:${on}">${'■'.repeat(n)}</span><span style="color:${off}">${'■'.repeat(Math.max(0, max - n))}</span>`;

export function buildHud(g, p, high, fps) {
  const s = g.state;
  const st = STAGES[s.stageIdx];
  const hearts = `<span style="color:#ff5c7a">${'♥'.repeat(Math.max(0, p.lives))}</span><span style="color:#ffffff30">${'♥'.repeat(Math.max(0, 3 - p.lives))}</span>`;
  const bombs = `<span style="color:#ffd27a">${'●'.repeat(p.bombs)}</span>`;
  const roll = p.rollCd > 0 ? '<span style="color:#ffffff60">ロール充填中</span>' : '<span style="color:#7ff3ff">ロールOK</span>';
  return (
    `<div style="font-size:22px;font-weight:800;letter-spacing:.04em">SCORE ${fmt(s.score)}</div>` +
    `<div style="color:#9fb1c2">HI ${fmt(Math.max(high, s.score))}　｜　STAGE ${s.stageIdx + 1} ${st.name}　｜　${g.diff.label}</div>` +
    `<div>LIFE ${hearts}　BOMB ${bombs}</div>` +
    `<div>SHIELD ${pips(p.shield, MAX_SHIELD, '#4db8ff')}</div>` +
    `<div>連射 ${pips(p.rapid, MAX_LV, '#ffe14d')}　拡散 ${pips(p.spread, MAX_LV, '#5dff8a')}</div>` +
    `<div style="font-size:13px">${roll}</div>` +
    (fps ? `<div style="font-size:12px;color:#8f8">FPS ${fps.toFixed(0)}　敵弾 ${g.bullets.enemy.count}</div>` : '')
  );
}
