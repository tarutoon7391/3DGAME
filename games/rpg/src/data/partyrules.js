// パーティの職業の制限（協力プレイ）：同じ職業は1人まで・タンクは1人まで・ほかのロールは2人まで
// ひとりで遊ぶときは関係ない。ルームの準備画面と、全滅したときの選び直しで使う
import { ROLES, ROLE_INFO } from './roles.js';
import { JOBS } from './jobs.js';

/** ロールごとの上限（書いていないロールは 2人） */
export const ROLE_CAP = { tank: 1 };
export const roleCap = (role) => ROLE_CAP[role] ?? 2;

/** others（ほかの人の職業 id の配列）がいるとき、job を選べない理由。選べるなら null */
export function pickBlock(job, others) {
  if (others.includes(job)) return 'ほかの人が選んでいます';
  const role = ROLES[job];
  const cap = roleCap(role);
  if (others.filter((j) => ROLES[j] === role).length >= cap) return `${ROLE_INFO[role].name}は${cap}人まで`;
  return null;
}

/** パーティ全体（職業 id の配列）が制限を守っているか。だめなら理由、よければ null */
export function partyProblem(jobs) {
  const seen = new Set();
  for (const j of jobs) {
    if (!j) continue;
    if (seen.has(j)) return `${JOBS[j]?.name || j}が2人います（同じ職業は1人まで）`;
    seen.add(j);
  }
  for (const role of Object.keys(ROLE_INFO)) {
    const n = jobs.filter((j) => ROLES[j] === role).length;
    if (n > roleCap(role)) return `${ROLE_INFO[role].name}が${n}人います（${roleCap(role)}人まで）`;
  }
  return null;
}

/** ロールごとの人数 */
export function roleCounts(jobs) {
  const c = {};
  for (const j of jobs) if (ROLES[j]) c[ROLES[j]] = (c[ROLES[j]] || 0) + 1;
  return c;
}
