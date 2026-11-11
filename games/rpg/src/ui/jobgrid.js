// 職業の選択欄（準備画面・全滅時の選び直しで共通）
// ロール（data/roles.js の ROLE_INFO）ごとのタブで絞り込み、カードには職業名とロールの札（ロールの色）を出す
// 選んだ職業の説明は欄の上に1か所だけ。ふだんは1行（タップで技の説明まで開く）。カード一覧はその下でスクロールする
// スマホ横持ち（高さ 360px）でもタブ・説明・ボタンが見えたまま、カードだけをスクロールできる作り
import { JOBS, JOB_ORDER } from '../data/jobs.js';
import { ROLES, ROLE_INFO } from '../data/roles.js';
import { esc } from '../util.js';

export const ROLE_ORDER = Object.keys(ROLE_INFO);

/** その職業のタブ（＝ロール） */
export function tabOf(job) {
  return ROLES[job] || ROLE_ORDER[0];
}

/** そのロールの職業（JOB_ORDER の順） */
export function jobsOfRole(role) {
  return JOB_ORDER.filter((id) => ROLES[id] === role);
}

/** ロールの札（名前と色）。ロールが未登録の職は空 */
export function roleChip(jobId) {
  const r = ROLE_INFO[ROLES[jobId]];
  return r ? `<i class="rpg-role" style="--rc:${r.color}">${esc(r.name)}</i>` : '';
}

/**
 * 選択欄の HTML。data-tab（ロールのタブ）・data-job（カード）・data-act="info"（説明の開閉）を押すと切り替わる
 * @param {string} selected 選んでいる職業
 * @param {string} tab 表示するロール（不明なら選んでいる職業のロール）
 * @param {{infoOpen?: boolean}} o infoOpen：技の説明まで開いているか
 */
export function jobGridHtml(selected, tab, { infoOpen = false } = {}) {
  if (!ROLE_INFO[tab]) tab = tabOf(selected);
  const J = JOBS[selected];
  const tabBtns = ROLE_ORDER.map((r) => `<button type="button" class="rpg-tab ${r === tab ? 'on' : ''}" data-tab="${r}" style="--rc:${ROLE_INFO[r].color}"><i></i>${esc(ROLE_INFO[r].name)}<small>${jobsOfRole(r).length}</small></button>`).join('');
  const cards = jobsOfRole(tab).map((id) => {
    const C = JOBS[id];
    return `<button type="button" class="rpg-jobc ${id === selected ? 'sel' : ''}" data-job="${id}" style="--c:${C.color}">
      <b>${esc(C.name)}</b><div class="rpg-jobc-sub">${roleChip(id)}<span>${esc(C.role)}</span></div></button>`;
  }).join('');
  return `<div class="rpg-tabs">${tabBtns}</div>
    <div class="rpg-jobinfo ${infoOpen ? 'open' : ''}" data-act="info" style="--c:${J.color}">
      <div class="rpg-jobinfo-head"><b>${esc(J.name)}</b>${roleChip(selected)}<span class="rpg-small">${esc(J.role)}　HP ${J.stats.hp}・攻 ${J.stats.atk}・${J.basic.type === 'melee' ? '近接' : '飛び道具'}</span><u>${infoOpen ? '▲ 閉じる' : '▼ 技をみる'}</u></div>
      <div class="rpg-jobinfo-body">
        <div><em>Q</em>${esc(J.q.name)}：${esc(J.q.desc)}</div>
        <div><em>E</em>${esc(J.e.name)}：${esc(J.e.desc)}</div>
        <div><em>R</em>${esc(J.r.name)}：${esc(J.r.desc)}</div>
        <div class="trait">特性：${esc(J.trait)}</div>
      </div>
    </div>
    <div class="rpg-jobgrid-scroll"><div class="rpg-jobgrid">${cards}</div></div>`;
}

/**
 * 選択欄の共通のクリック処理（準備画面・選び直しで同じ）。扱ったら true
 * @param {Event} e
 * @param {{ onTab(role), onJob(job), onInfo() }} h
 */
export function handleGridClick(e, h) {
  const t = e.target.closest('[data-tab]');
  if (t) {
    h.onTab(t.dataset.tab);
    return true;
  }
  const card = e.target.closest('[data-job]');
  if (card) {
    h.onJob(card.dataset.job);
    return true;
  }
  if (e.target.closest('[data-act="info"]')) {
    h.onInfo();
    return true;
  }
  return false;
}

/** 描き直す前にカード一覧のスクロール位置を覚えて、描き直した後に戻す */
export function keepGridScroll(el, render) {
  const keep = el.querySelector('.rpg-jobgrid-scroll')?.scrollTop || 0;
  render();
  const s = el.querySelector('.rpg-jobgrid-scroll');
  if (s) s.scrollTop = keep;
}
