// タイムライン実行：data/stages.js の出現定義を時間どおりに敵へ変換する
import { MIN_LEVEL } from './data/difficulty.js';
import { rand } from './util.js';

const SPAWN_Z = -170;

export function createSpawner(g) {
  let timeline = [];
  let t = 0;
  let idx = 0;
  const queue = []; // { at, type, x, y, z, group }

  function load(stage) {
    timeline = stage.timeline.slice().sort((a, b) => a.t - b.t);
    t = 0;
    idx = 0;
    queue.length = 0;
  }

  function emit(ev) {
    if (ev.min && MIN_LEVEL[ev.min] > g.diff.level) return;
    const n = Math.max(1, Math.round(ev.count * g.diff.density));
    const group = ev.drop ? { total: n, killed: 0, drop: ev.drop } : null;
    const f = ev.formation;
    const interval = ev.interval ?? (f === 'column' ? 0.45 : f === 'random' ? 0.4 : 0);
    const span = ev.span ?? 16;
    for (let i = 0; i < n; i++) {
      let x = ev.x ?? 0, y = ev.y ?? 0, z = SPAWN_Z;
      if (f === 'line') {
        x += n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
      } else if (f === 'v') {
        const rank = Math.ceil(i / 2);
        x += (i % 2 ? 1 : -1) * rank * (span / n) * 1.2;
        y += rank * 0.6;
        z -= rank * 8;
      } else if (f === 'random') {
        x = rand(-14, 14);
        y = rand(-8, 8);
      } else if (f === 'circle') {
        const a = (i / n) * Math.PI * 2;
        x += Math.cos(a) * (ev.r ?? 7);
        y += Math.sin(a) * (ev.r ?? 7) * 0.7;
      }
      queue.push({ at: t + i * interval, type: ev.type, x, y, z, group });
    }
  }

  function update(dt) {
    t += dt;
    while (idx < timeline.length && timeline[idx].t <= t) emit(timeline[idx++]);
    for (let i = queue.length - 1; i >= 0; i--) {
      const q = queue[i];
      if (q.at <= t) {
        g.spawnEnemy(q.type, q.x, q.y, q.z, q.group);
        queue.splice(i, 1);
      }
    }
  }

  return {
    load,
    /** デバッグ用：時刻を進める（途中の出現は飛ばす） */
    skipTo(sec) {
      t = sec;
      while (idx < timeline.length && timeline[idx].t <= t) idx++;
      queue.length = 0;
    },
    update,
    get t() { return t; },
    /** 出現予定がすべて済んだか */
    get done() { return idx >= timeline.length && queue.length === 0; },
  };
}
