// 戦績（競技別の勝敗・ベストスコア）の保存。shared/save.js を使う（キー 3dgame:sports）
import { createSave } from '/shared/save.js';

export const SPORTS = {
  tennis: { key: 'tennis', label: 'テニス', bestLabel: '最大ゲーム差' },
  baseball: { key: 'baseball', label: '野球', bestLabel: '最多得点' },
  archery: { key: 'archery', label: 'アーチェリー', bestLabel: '最高合計点' },
};

const emptyRecord = () => ({ win: 0, lose: 0, draw: 0, best: null, bestText: '' });

export function createRecords() {
  const store = createSave('sports');
  const data = store.load({ records: {}, lastDiff: 'normal' });
  // 浅いマージなので競技ごとの欠けはここで補う
  for (const k of Object.keys(SPORTS)) {
    data.records[k] = { ...emptyRecord(), ...(data.records[k] || {}) };
  }

  return {
    get lastDiff() {
      return data.lastDiff;
    },
    set lastDiff(v) {
      data.lastDiff = v;
      store.save(data);
    },
    get(sport) {
      return data.records[sport];
    },
    /**
     * 試合結果を記録する。
     * @param {string} sport
     * @param {{outcome:'win'|'lose'|'draw'|null, best:number, bestText:string}} r outcome が null なら勝敗は数えない（2人対戦など）
     * @returns {boolean} ベスト更新したか
     */
    add(sport, { outcome, best, bestText }) {
      const rec = data.records[sport];
      if (outcome) rec[outcome] += 1;
      let updated = false;
      if (typeof best === 'number' && (rec.best === null || best > rec.best)) {
        rec.best = best;
        rec.bestText = bestText;
        updated = true;
      }
      store.save(data);
      return updated;
    },
    /** メニュー表示用の1行 */
    summary(sport) {
      const r = data.records[sport];
      const best = r.best === null ? '—' : r.bestText;
      return `${r.win}勝 ${r.lose}敗${r.draw ? ` ${r.draw}分` : ''}／${SPORTS[sport].bestLabel} ${best}`;
    },
  };
}
