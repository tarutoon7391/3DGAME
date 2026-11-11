// 進行データ（セーブ対象）。progress は素の JSON で、Three.js のオブジェクトは含めない
// 育成・所持品はないので、保存するのは「到達したエリア」と記録用の統計だけ
import { AREAS, AREA_ORDER, OLD_AREA_MAP } from './data/areas.js';

export const PROGRESS_VERSION = 2;

/** ニューゲームの進行データ */
export function newProgress(area = AREA_ORDER[0]) {
  return {
    version: PROGRESS_VERSION,
    area: AREAS[area] ? area : AREA_ORDER[0],
    bossStep: 0, // ボスが複数いるステージで、倒したボスの数（やられたらその次のボスの部屋から）
    stats: { kills: 0, deaths: 0, time: 0 },
  };
}

/**
 * セーブデータを今の形にそろえる。壊れていたり読めなければ null（＝つづきからなし）
 * version 1（レベル制のころ）は、いたエリアを新しいステージに置き換えて引き継ぐ
 */
export function migrateProgress(p) {
  if (!p || typeof p !== 'object') return null;
  const out = newProgress();
  if (p.version === PROGRESS_VERSION) {
    if (AREAS[p.area]) out.area = p.area;
    const n = AREAS[out.area].bosses?.length || 0;
    if (Number.isInteger(p.bossStep) && p.bossStep > 0 && p.bossStep < n) out.bossStep = p.bossStep;
  } else if (p.version === 1 || p.version === undefined) {
    out.area = OLD_AREA_MAP[p.area] || AREA_ORDER[0];
  } else {
    return null; // 知らない新しい形式は触らない
  }
  const s = p.stats || {};
  for (const k of Object.keys(out.stats)) if (Number.isFinite(s[k])) out.stats[k] = s[k];
  // 1度だけの必殺技（僧侶の女神の祈り）を使ったか。つづきからでも戻らない
  if (p.usedOnce && typeof p.usedOnce === 'object') out.usedOnce = { ...p.usedOnce };
  return out;
}

/** 進行データを包む（オンライン化しても progress を送れば同期できる形） */
export function createState(progress = newProgress()) {
  return { progress };
}
