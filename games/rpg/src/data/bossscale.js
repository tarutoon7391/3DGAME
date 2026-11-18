// 巨大ボス：体と攻撃範囲をまとめて k 倍にする（ステージ7・8 の最後は 2倍、ステージ9 の最後は 3倍）
// 長さ・半径・距離は k 倍。巨体なので動きはゆっくりめ：歩きは元の 0.8 倍、突進などの速さは k×0.6 倍（MOVE_SLOW）
// 弾の速さ・角度・時間はそのまま
/** 巨大ボスの動きの遅さ（walk：歩きの速さ倍率、dash：突進・広がる輪などの速さに k と一緒に掛ける） */
export const MOVE_SLOW = { walk: 0.8, dash: 0.6 };
const LEN_KEYS = ['r', 'rIn', 'rOut', 'len', 'w', 'dist', 'rr', 'rr0', 'rr1', 'max', 'h', 'gapW', 'gapRange', 'thick', 'fxDist', 'back', 'step'];

/** 弾・光球の数を shot 倍にする（do: 'shots' / 'cluster' / 'orbs'） */
function scaleCount(o, shot) {
  if (shot === 1) return;
  const m = (v) => Math.max(1, Math.round(v * shot));
  if (o.do === 'shots') {
    if (typeof o.n === 'number') o.n = m(o.n);
    if (typeof o.arms === 'number') o.arms = m(o.arms);
    if (o.pat === 'fan' && typeof o.spread === 'number') o.spread = +(o.spread / Math.sqrt(shot)).toFixed(3); // 扇は少し詰める
  } else if (o.do === 'cluster') {
    if (typeof o.ring === 'number') o.ring = m(o.ring);
    if (typeof o.n === 'number') o.n = m(o.n);
  } else if (o.do === 'orbs' && typeof o.n === 'number') o.n = m(o.n);
}

function scaleStep(s, k, shot = 1) {
  const o = { ...s };
  scaleCount(o, shot);
  for (const key of LEN_KEYS) if (typeof o[key] === 'number') o[key] = +(o[key] * k).toFixed(2);
  if (o.o === 'rand' && typeof o.spread === 'number') o.spread = +(o.spread * k).toFixed(2); // rand の spread は距離
  if (typeof o.hitR === 'number' && o.hitR > 0) o.hitR *= k;
  if ((o.do === 'move' && (o.m === 'dash' || o.m === 'orbit')) || o.do === 'mover' || o.do === 'nova' || o.do === 'wall') {
    if (typeof o.speed === 'number' && o.m !== 'orbit') o.speed = +(o.speed * k * MOVE_SLOW.dash).toFixed(2);
  }
  if (o.fxd) {
    o.fxd = { ...o.fxd };
    for (const key of ['len', 'w', 'r', 'h', 'tall']) if (typeof o.fxd[key] === 'number') o.fxd[key] *= k;
  }
  if (o.d) {
    o.d = { ...o.d };
    if (typeof o.d.r === 'number') o.d.r *= k;
  }
  if (o.groups) o.groups = o.groups.map((g) => ({ ...g, rr: g.rr * k, r: (g.r ?? 2.6) * k }));
  if (typeof o.pull === 'number') o.pull *= k;
  if (o.do === 'pull') o.strength *= Math.sqrt(k);
  return o;
}

/**
 * def を巨大ボスにした写しを返す（over で上書き）
 * k：攻撃範囲・距離の倍率。opt.size：体の大きさの倍率（省略で k）。opt.shot：弾・光球の数の倍率（省略で 1）
 */
export function giant(def, k, over = {}, opt = {}) {
  const patterns = {};
  for (const [name, p] of Object.entries(def.patterns)) patterns[name] = { ...p, steps: p.steps.map((s) => scaleStep(s, k, opt.shot ?? 1)) };
  const size = opt.size ?? k; // 体の大きさ（範囲 k とは別に決められる）
  return {
    ...def,
    radius: def.radius * size,
    hpY: def.hpY * size,
    speed: def.speed * MOVE_SLOW.walk,
    nearRange: Math.max(def.nearRange * k, def.radius * size + 4),
    keep: def.keep ? def.keep * k : def.keep,
    look: { ...def.look, scale: def.look.scale * size },
    patterns,
    giant: k,
    ...over,
  };
}
