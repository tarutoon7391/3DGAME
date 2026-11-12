// 職業の選択欄（準備画面・全滅時の選び直しで共通）
// 16職ずつのタブ（1・2・…）に分け、小さなカード（名前と役割）を並べる。選んだ職業の詳しい説明は下の欄にまとめて出す
// スクロールしなくても全部見えるように、カードは小さく・説明は1か所だけにしている
import { JOBS, JOB_ORDER } from '../data/jobs.js';
import { esc } from '../util.js';

export const JOBS_PER_TAB = 16;

/** その職業が何番目のタブにあるか */
export function tabOf(job) {
  return Math.max(0, Math.floor(JOB_ORDER.indexOf(job) / JOBS_PER_TAB));
}

/** 選択欄の HTML。data-tab（タブ）と data-job（カード）を押すと切り替わる */
export function jobGridHtml(selected, tab) {
  const tabs = Math.ceil(JOB_ORDER.length / JOBS_PER_TAB);
  const list = JOB_ORDER.slice(tab * JOBS_PER_TAB, (tab + 1) * JOBS_PER_TAB);
  const J = JOBS[selected];
  const tabBtns = Array.from({ length: tabs }, (_, i) => {
    const first = JOBS[JOB_ORDER[i * JOBS_PER_TAB]].name;
    const last = JOBS[JOB_ORDER[Math.min(JOB_ORDER.length, (i + 1) * JOBS_PER_TAB) - 1]].name;
    return `<button type="button" class="rpg-tab ${i === tab ? 'on' : ''}" data-tab="${i}"><b>${i + 1}</b> ${esc(first)}〜${esc(last)}</button>`;
  }).join('');
  const cards = list.map((id) => {
    const C = JOBS[id];
    return `<button type="button" class="rpg-jobc ${id === selected ? 'sel' : ''}" data-job="${id}" style="--c:${C.color}">
      <b>${esc(C.name)}</b><span>${esc(C.role)}</span></button>`;
  }).join('');
  return `<div class="rpg-tabs">${tabBtns}</div>
    <div class="rpg-jobgrid">${cards}</div>
    <div class="rpg-jobinfo" style="--c:${J.color}">
      <div><b>${esc(J.name)}</b>　${esc(J.role)}　<span class="rpg-small">HP ${J.stats.hp}・攻 ${J.stats.atk}・${J.basic.type === 'melee' ? '近接' : '飛び道具'}</span></div>
      <div><em>Q</em>${esc(J.q.name)}：${esc(J.q.desc)}</div>
      <div><em>E</em>${esc(J.e.name)}：${esc(J.e.desc)}</div>
      ${J.c ? `<div><em>C</em>${esc(J.c.name)}：${esc(J.c.desc)}</div>` : ''}
      <div><em>R</em>${esc(J.r.name)}：${esc(J.r.desc)}</div>
      <div class="trait">特性：${esc(J.trait)}</div>
    </div>`;
}
