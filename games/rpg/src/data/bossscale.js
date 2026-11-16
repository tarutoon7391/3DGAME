// 巨大ボス：体と攻撃範囲をまとめて k 倍にする（ステージ7・8 の最後は 2倍、ステージ9 の最後は 3倍）
// 長さ・半径・距離は k 倍、動く技の速さも k 倍（同じ時間で広い範囲を動く）。弾の速さ・角度・時間はそのまま
const LEN_KEYS = ['r', 'rIn', 'rOut', 'len', 'w', 'dist', 'rr', 'rr0', 'rr1', 'max', 'h', 'gapW', 'gapRange', 'thick', 'fxDist', 'back', 'step'];

function scaleStep(s, k) {
  const o = { ...s };
  for (const key of LEN_KEYS) if (typeof o[key] === 'number') o[key] = +(o[key] * k).toFixed(2);
  if (o.o === 'rand' && typeof o.spread === 'number') o.spread = +(o.spread * k).toFixed(2); // rand の spread は距離
  if (typeof o.hitR === 'number' && o.hitR > 0) o.hitR *= k;
  if ((o.do === 'move' && (o.m === 'dash' || o.m === 'orbit')) || o.do === 'mover' || o.do === 'nova' || o.do === 'wall') {
    if (typeof o.speed === 'number' && o.m !== 'orbit') o.speed = +(o.speed * k).toFixed(2);
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

/** def を k 倍の巨大ボスにした写しを返す（over で上書き） */
export function giant(def, k, over = {}) {
  const patterns = {};
  for (const [name, p] of Object.entries(def.patterns)) patterns[name] = { ...p, steps: p.steps.map((s) => scaleStep(s, k)) };
  return {
    ...def,
    radius: def.radius * k,
    hpY: def.hpY * k,
    speed: def.speed * Math.sqrt(k),
    nearRange: def.nearRange * k,
    keep: def.keep ? def.keep * k : def.keep,
    look: { ...def.look, scale: def.look.scale * k },
    patterns,
    giant: k,
    ...over,
  };
}
