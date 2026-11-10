// 評価（S〜C）とステージ別ベストの保存
import { createSave } from '/shared/save.js';

const store = createSave('thief');

/** 発見回数・クリア時間・回収率から点数とランクを出す */
export function calcRank({ time, found, rate, par }) {
  const pRate = (rate / 100) * 40;
  const pFound = Math.max(0, 30 - found * 12);
  const pTime = time <= par ? 30 : Math.max(0, 30 * (1 - (time - par) / par));
  const score = Math.round(pRate + pFound + pTime);
  const rank = score >= 90 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C';
  return { score, rank };
}

export function loadBest() {
  return store.load({ best: {} }).best;
}

/** ベスト更新なら true（点数が高い方を残す） */
export function saveBest(stageNo, rec) {
  const data = store.load({ best: {} });
  const old = data.best[stageNo];
  if (old && old.score >= rec.score) return false;
  data.best[stageNo] = rec;
  store.save(data);
  return true;
}
