// 一人称の技ごとの特別な動き（viewmodel.js から）。p.vmAnim = { kind, t, dur, ... } を jobs.js・skillfx_c.js が入れる
// Rp・Lp は右手・左手の動き（x は負で画面の中央寄り、rx 正で腕が上へ、twist は武器のひねり、aim は槍を前へ構える）
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (k) => 1 - (1 - k) * (1 - k);
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
/** 縦斬り：振り上げ（0→up）→ 振り下ろし（up→down）。u は 0〜1 */
function vertical(P, raise, down) {
  P.ry = 0;
  P.rz = 0;
  P.twist = 0;
  P.x = -0.12;
  if (down <= 0) {
    const u = ease(raise);
    P.rx = 1.35 * u; // 真上へ
    P.y = 0.12 * u;
    P.z = 0.05 * u;
  } else {
    const u = ease(down);
    P.rx = 1.35 - 2.75 * u; // 一気に振り下ろす
    P.y = 0.12 - 0.2 * u;
    P.z = 0.05 - 0.2 * u;
  }
}

/** 戻り値：{ spin（光らせる）, sheath（鞘を見せる） } */
export function animateSpecial(V, k, Rp, Lp, setFlash) {
  const out = {};
  if (V.kind === 'iai') {
    // 居合：腕を真上へ振り上げ、縦に一閃
    vertical(Rp, smooth(0, 0.35, k), smooth(0.4, 0.6, k));
    if (k > 0.35 && k < 0.75) setFlash(0x6a6a6a);
  } else if (V.kind === 'sheathe') {
    // 見切り：左下の鞘へ刀を納めて構え、終わったら素早く抜いて戻す
    const t = V.t;
    const inK = smooth(0, 0.15, t); // 納める
    const outK = smooth(V.dur - 0.1, V.dur, t); // 抜き戻す
    const s = inK * (1 - outK);
    Rp.x += -0.55 * s;
    Rp.y += -0.12 * s;
    Rp.z += 0.12 * s;
    Rp.rx += -1.25 * s;
    Rp.ry += 0.5 * s;
    Rp.rz += 0.9 * s;
    out.sheath = s > 0.05;
    if (outK > 0 && outK < 1) setFlash(0x8a8a8a);
  } else if (V.kind === 'tsubame') {
    // 燕返し：少し溜める → 左右に高速で斬る → もう一度溜めて縦に振り下ろす
    const t = V.t;
    const fast = V.w + (V.n - 1) * V.every; // 縦斬りの溜めに入る時刻
    if (t < V.w) {
      // 溜め：刀を右下へ引いて光らせる
      const u = ease(t / V.w);
      Rp.x = 0.06 * u;
      Rp.y = -0.06 * u;
      Rp.z = 0.1 * u;
      Rp.rx = -0.9 * u;
      Rp.ry = -0.7 * u;
      Rp.rz = 0.3 * u;
      setFlash(0x6a6a6a);
    } else if (t < fast) {
      const f = (t - V.w) / V.every;
      const i = Math.floor(f);
      const u = ease(f - i);
      const toLeft = i % 2 === 0;
      Rp.ry = toLeft ? -1.25 + u * 2.5 : 1.25 - u * 2.5;
      Rp.rx = -1.05;
      Rp.rz = toLeft ? 0.45 : -0.45;
      Rp.x = -0.2;
      Rp.y = 0.22;
      Rp.z = 0;
      out.spin = true;
    } else {
      // 溜めた縦斬りで締める
      vertical(Rp, smooth(fast, fast + V.gap, t), smooth(fast + V.gap, fast + V.gap + 0.1, t));
      if (t < fast + V.gap) setFlash(0x6a6a6a);
    }
  } else if (V.kind === 'dance') {
    // 情熱のサンバ：腕を左右に揺らして踊る
    const t = V.t;
    const w = Math.sin(t * 12);
    Rp.ry += 0.45 * w;
    Rp.rz += 0.35 * w;
    Rp.rx += 0.5 + 0.25 * Math.abs(Math.sin(t * 12));
    Rp.y += 0.1 + 0.05 * Math.abs(w);
    Rp.x += -0.08 * w;
  } else if (V.kind === 'toss4') {
    // 罠の大地：腕を4回振り上げて、罠を放る
    const step = 0.28;
    const t = V.t - 0.1;
    const i = Math.floor(t / step);
    if (t > 0 && i < 4) {
      const f = (t - i * step) / step;
      const up = f < 0.5 ? ease(f / 0.5) : 1 - ease((f - 0.5) / 0.5) * 0.8;
      Rp.rx = 1.4 * up - 0.3;
      Rp.y = 0.18 * up;
      Rp.z = 0.05 - 0.15 * (f > 0.5 ? (f - 0.5) * 2 : 0);
      Rp.x = -0.1 + (i % 2 ? -0.08 : 0.04);
      Rp.ry = (i % 2 ? 0.25 : -0.15);
    }
  } else if (V.kind === 'plant') {
    // 結界の衝撃：杖をそのままの向きで真上へ持ち上げ、地面へまっすぐ落とす（V.hit 秒で地面）
    const t = V.t;
    const up = smooth(0, V.hit * 0.6, t);
    const down = smooth(V.hit * 0.65, V.hit, t);
    const back = smooth(V.hit + 0.08, V.dur, t);
    Rp.y += 0.24 * up - 0.46 * down * (1 - back) - 0.24 * up * back;
    Rp.z += -0.04 * up + 0.04 * down;
    Rp.x += -0.04 * up;
    if (t > V.hit * 0.65 && t < V.hit + 0.1) setFlash(0x1a5a7a);
  } else if (V.kind === 'throwdown') {
    // 煙玉：腕を少し上げてから、地面へ叩きつけるように振り下ろす
    const t = V.t;
    const up = smooth(0, 0.12, t) * (1 - smooth(0.12, 0.2, t));
    const down = smooth(0.12, 0.22, t) * (1 - smooth(0.3, V.dur, t));
    Rp.rx += 0.6 * up - 1.4 * down;
    Rp.y += 0.08 * up - 0.22 * down;
    Rp.z += -0.18 * down;
    Rp.x += -0.06 * down;
  } else if (V.kind === 'cheer') {
    // 大盤振る舞い：両手を3回 上へ振り上げて、コインをばらまく
    const step = 0.35;
    const t = V.t - 0.05;
    const i = Math.floor(t / step);
    if (t > 0 && i < 3) {
      const f = (t - i * step) / step;
      const up = f < 0.45 ? ease(f / 0.45) : 1 - ease((f - 0.45) / 0.55) * 0.6;
      for (const [P, s] of [[Rp, 1], [Lp, -1]]) {
        P.rx = 1.35 * up - 0.25;
        P.ry = 0.25 * s * up;
        P.rz = -0.2 * s * up;
        P.x = -0.08 + 0.06 * up;
        P.y = 0.2 * up - 0.02;
        P.z = 0.05;
      }
    }
  } else if (V.kind === 'kiblast') {
    // 気功波：両手をそろえて前へ突き出す（波動拳）
    for (const P of [Rp, Lp]) {
      P.x = -0.24;
      P.y = 0.06;
      P.z = 0.08 - 0.32 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - smooth(0.75, 1, k));
      P.rx = 0.15;
      P.ry = 0;
      P.rz = 0;
    }
    setFlash(k < 0.7 ? 0x6a4a10 : 0x000000);
  } else if (V.kind === 'uppercut') {
    // 昇竜拳：右腕を真上へ突き上げる
    Rp.rx = 1.45 * smooth(0, 0.3, k);
    Rp.x = -0.22;
    Rp.y = 0.0;
    Rp.z = -0.12;
    Rp.ry = 0;
    Rp.rz = 0;
  } else if (V.kind === 'barrage') {
    // 百裂拳：左右の拳を目にもとまらぬ速さで交互に突き出す
    const step = 0.07;
    const i = Math.floor(V.t / step);
    const f = (V.t % step) / step;
    const P = i % 2 ? Lp : Rp;
    P.z -= 0.45 * Math.sin(f * Math.PI);
    P.rx -= 0.3;
    P.y += (i % 3 - 1) * 0.04;
  } else if (V.kind === 'bigchop') {
    // 大地割り：斧を思い切り振り上げ、刃を縦にして一気に振り下ろす
    Rp.twist = Math.PI / 2;
    Rp.ry = 0;
    Rp.rz = 0;
    if (k < 0.4) {
      const u = ease(k / 0.4);
      Rp.rx = 0.85 * u;
      Rp.y = 0.3 * u;
      Rp.z = -0.08 * u;
    } else {
      const u = smooth(0.4, 0.55, k);
      Rp.rx = 0.85 - 2.45 * u;
      Rp.y = 0.3 - 0.37 * u;
      Rp.z = -0.08 - 0.17 * u;
      if (k < 0.7) setFlash(0x5a2a10);
    }
    Rp.x = -0.15;
  } else if (V.kind === 'frenzy') {
    // 死の宣告：一瞬で左右に何度も斬る（左へは鎌を反転、右へは戻す）
    const n = 4;
    const f = k * n;
    const i = Math.min(n - 1, Math.floor(f));
    const u = ease(f - i);
    const toLeft = i % 2 === 0;
    Rp.ry = toLeft ? -1.3 + u * 2.6 : 1.3 - u * 2.6;
    Rp.rx = -1.05;
    Rp.rz = toLeft ? 0.45 : -0.45;
    Rp.x = -0.22;
    Rp.y = 0.22;
    Rp.twist = toLeft ? Math.PI : 0;
    out.spin = true;
  } else if (V.kind === 'dive') {
    // 天穿ち：空中で槍を振りかぶり、着地点へ槍を前に構えて急降下
    if (k < 0.45) {
      const u = ease(k / 0.45);
      Rp.rx = 0.9 * u;
      Rp.y = 0.15 * u;
      Rp.z = 0.1 * u;
    } else {
      Rp.aim = true;
      Rp.rx = -0.1;
      Rp.ry = 0.12;
      Rp.x = -0.1;
      Rp.y = 0.1;
      Rp.z = -0.12;
      setFlash(0x2a5a3a);
    }
  }
  return out;
}
