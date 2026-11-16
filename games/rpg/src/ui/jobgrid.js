// 職業の選択欄（準備画面・全滅時の選び直しで共通）
// ロールごとのタブ（アタッカー・ガンナー・タンク…）に分け、小さなカード（名前と役割）を並べる。選んだ職業の詳しい説明は下の欄にまとめて出す
// 協力プレイでは others（ほかの人の職業）を渡すと、選べない職業（同じ職業・ロールの人数オーバー）を暗くし、タブに人数を出す
import { JOBS, JOB_ORDER } from '../data/jobs.js';
import { ROLES, ROLE_INFO } from '../data/roles.js';
import { pickBlock, roleCap, roleCounts } from '../data/partyrules.js';
import { esc } from '../util.js';

/** タブの並び（ロール）と、スマホで出す短い名前 */
export const ROLE_TABS = ['attacker', 'gunner', 'tank', 'healer', 'buffer', 'debuffer', 'unique'];
const SHORT = { attacker: '近接', gunner: '遠距離', tank: '盾', healer: '回復', buffer: '強化', debuffer: '弱体', unique: '特殊' };
const BY_ROLE = Object.fromEntries(ROLE_TABS.map((r) => [r, JOB_ORDER.filter((id) => ROLES[id] === r)]));

/** その職業が何番目のタブにあるか */
export function tabOf(job) {
  return Math.max(0, ROLE_TABS.indexOf(ROLES[job]));
}

/** 選択欄の HTML。data-tab（タブ）と data-job（カード）を押すと切り替わる */
export function jobGridHtml(selected, tab, others = null) {
  const p = jobGridParts(selected, tab, others);
  return p.tabs + p.grid + p.info;
}

/**
 * 選択欄をタブ・カード・説明に分けて返す（職業選択画面では左右に分けて置く）
 * others：協力プレイのとき、ほかの人の職業 id の配列（null ならひとり用で制限なし）
 */
export function jobGridParts(selected, tab, others = null) {
  const role = ROLE_TABS[tab] || ROLE_TABS[0];
  const list = BY_ROLE[role];
  const J = JOBS[selected];
  const counts = others ? roleCounts([...others, selected]) : null;
  const tabBtns = ROLE_TABS.map((r, i) => {
    const info = ROLE_INFO[r];
    const cnt = counts ? `<small class="rpg-tab-n ${(counts[r] || 0) >= roleCap(r) ? 'full' : ''}">${counts[r] || 0}/${roleCap(r)}</small>` : '';
    return `<button type="button" class="rpg-tab ${i === tab ? 'on' : ''}" data-tab="${i}" style="--rc:${info.color}"><b>${SHORT[r]}</b><span>${esc(info.name)}</span>${cnt}</button>`;
  }).join('');
  const cards = list.map((id) => {
    const C = JOBS[id];
    const block = others && id !== selected ? pickBlock(id, others) : null;
    return `<button type="button" class="rpg-jobc ${id === selected ? 'sel' : ''} ${block ? 'off' : ''}" data-job="${id}" ${block ? `data-block="${esc(block)}"` : ''} style="--c:${C.color}">
      <b>${esc(C.name)}</b><span>${esc(block || C.role)}</span></button>`;
  }).join('');
  const rule = others ? `<div class="rpg-small rpg-rule">協力プレイの制限：同じ職業は1人まで・タンクは1人まで・ほかのロールは2人まで</div>` : '';
  return {
    tabs: `<div class="rpg-tabs">${tabBtns}</div>`,
    grid: `<div class="rpg-jobgrid">${cards}</div>${rule}`,
    info: `<div class="rpg-jobinfo" style="--c:${J.color}">
      <div class="rpg-jobinfo-head"><b>${esc(J.name)}</b><span>${esc(J.role)}</span><span class="rpg-small">${esc(ROLE_INFO[ROLES[selected]].name)}・HP ${J.stats.hp}・攻 ${J.stats.atk}・${J.basic.type === 'melee' ? '近接' : '飛び道具'}</span></div>
      <div><em>Q</em>${esc(J.q.name)}：${esc(J.q.desc)}</div>
      <div><em>E</em>${esc(J.e.name)}：${esc(J.e.desc)}</div>
      ${J.c ? `<div><em>C</em>${esc(J.c.name)}：${esc(J.c.desc)}</div>` : ''}
      <div><em>R</em>${esc(J.r.name)}：${esc(J.r.desc)}</div>
      <div class="trait">特性：${esc(J.trait)}</div>
    </div>`,
  };
}
