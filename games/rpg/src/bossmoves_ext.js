// ボスの台本の追加分（ステージ7〜9 で増えた技と姿勢）。src/bossmoves.js から呼ばれる
//   do: 'pool'  … しばらく残る溜まり（溶岩・渦・虚無）。上にいる間 every 秒ごとに当たる
//   do: 'orbs'  … 撃った場所のまわりを回りながら広がる（縮む）光球。触れると当たる
//   do: 'cluster' … 扇状に撃った弾が pop 秒後にそれぞれ輪になって弾ける
//   姿勢：sink（潜る）・float（浮かぶ）・flail（触手を振り回す）・clap（挟み込む）・coil（ばねのように縮む）・spinH（横回転しながら浮く）
import { rand } from './util.js';

/** 光球の位置（ホストの当たり判定と見た目で同じ式を使う） */
export function orbPos(d, i, t) {
  const k = Math.min(1, t / d.dur);
  const rr = d.rr0 + (d.rr1 - d.rr0) * k;
  const a = d.a0 + (i / d.n) * Math.PI * 2 + d.speed * t;
  return { x: d.x + Math.sin(a) * rr, z: d.z + Math.cos(a) * rr };
}

/**
 * 予兆（arm）。扱えたら true
 * api: { game, b, ctx, run, spots(s,tgt), color(s), fracOf(s) }
 */
export function armExt(st, tgt, api) {
  const s = st.s;
  const { game } = api;
  const left = Math.max(0.05, st.at - api.b.t);
  if (s.do === 'pool') {
    st.spots = api.spots(s, tgt);
    st.teles = st.spots.map((sp) => game.fx.telegraph('circle', { x: sp.x, z: sp.z, r: s.r, dur: left }));
    return true;
  }
  if (s.do === 'orbs') {
    // 回る範囲の外周を薄く見せる
    st.teles = [game.fx.telegraph('circle', { x: api.b.pos.x, z: api.b.pos.z, r: Math.max(s.rr0, s.rr1) + (s.r ?? 1), dur: left })];
    return true;
  }
  return false;
}

/** 当たる時刻（fire）。扱えたら true */
export function fireExt(st, tgt, api) {
  const s = st.s;
  const { game, b, ctx } = api;
  const col = api.color(s);
  if (s.do === 'pool') {
    const every = s.every ?? 0.5;
    const n = Math.ceil((s.dur ?? 5) / every);
    const spots = st.spots || [];
    for (const sp of spots) {
      ctx.vfx('pool', { x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), r: s.r, dur: s.dur ?? 5, color: col, kind: s.kind || 'lava' });
      ctx.vfx('impact', { x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), r: s.r, color: col });
    }
    const frac = ctx.meleeHit * (s.k ?? 0.3);
    ctx.emit(0, every, n, () => {
      for (const sp of spots) ctx.hitAll(ctx.inCircle(sp.x, sp.z, s.r * 0.92), frac, sp.x, sp.z);
    });
    game.sound.se(s.se || 'slam');
    game.fx.shake(0.35);
    return true;
  }
  if (s.do === 'orbs') {
    const d = { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), n: s.n ?? 6, rr0: s.rr0 ?? 2, rr1: s.rr1 ?? 12, dur: s.dur ?? 3, speed: s.speed ?? 2.2, a0: +rand(0, Math.PI * 2).toFixed(3), r: s.r ?? 1, color: col };
    ctx.vfx('orbs', d);
    api.run.active.push({ kind: 'orbs', s, d, t: 0, hit: new Map() });
    game.sound.se('spin');
    return true;
  }
  if (s.do === 'cluster') {
    // 扇に撃った弾の位置を先に計算しておき、pop 秒後にそこで輪にする
    aimTo(b, tgt);
    const n = s.n ?? 5;
    const pop = s.pop ?? 0.9;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = b.yaw + (k - (n - 1) / 2) * (s.spread ?? 0.35);
      ctx.shot(b.pos.x, b.pos.z, a, s.speed ?? 10, col);
      pts.push({ x: b.pos.x + Math.sin(a) * (s.speed ?? 10) * pop, z: b.pos.z + Math.cos(a) * (s.speed ?? 10) * pop });
    }
    ctx.emit(pop, 1, 1, () => {
      const m = Math.round((s.ring ?? 8) * ctx.cm());
      for (const p of pts) {
        ctx.ring(p.x, p.z, m, rand(0, 1), s.ringSpeed ?? 7, col);
        game.fx.burst(p.x, 1, p.z, col, 14, { speed: 5, up: 3, life: 0.5 });
      }
      game.sound.se('slam');
    });
    game.sound.se('shoot');
    return true;
  }
  return false;
}

function aimTo(b, tgt) {
  if (tgt) b.yaw = Math.atan2(tgt.pos.x - b.pos.x, tgt.pos.z - b.pos.z);
}

/** 続いている動き。扱えたら { done } を返す */
export function activeExt(a, dt, api) {
  if (a.kind !== 'orbs') return null;
  const { ctx } = api;
  const d = a.d;
  const frac = ctx.meleeHit * (a.s.k ?? 0.6);
  for (let i = 0; i < d.n; i++) {
    const p = orbPos(d, i, a.t);
    ctx.hitAll((x, z, pr, who) => {
      if ((x - p.x) ** 2 + (z - p.z) ** 2 >= (d.r + pr) ** 2) return false;
      const last = a.hit.get(who) ?? -9;
      if (a.t - last < 0.6) return false; // 同じ人には 0.6 秒に1回まで
      a.hit.set(who, a.t);
      return true;
    }, frac, p.x, p.z);
  }
  return { done: a.t >= d.dur };
}

/** 追加の姿勢。扱えたら true */
export function poseExt(m, cur, t) {
  const { root, armL, armR, legL, legR } = m;
  const { k } = cur;
  const wind = k < 0 ? 1 + k : 0;
  const hit = k >= 0 ? 1 - k : 0;
  switch (cur.pose) {
    case 'sink': // 地面（水面・溶岩）に沈む
      root.position.y = -2.2 * wind - 2.2 * (k >= 0 ? 1 : 0) * (1 - Math.min(1, k * 2));
      root.rotation.x = 0.3 * wind;
      return true;
    case 'float': // ふわっと高く浮かぶ
      root.position.y = 1.2 * (wind + hit) + 0.15 * Math.sin(t * 6);
      armL.rotation.set(-0.6, 0, 1.0 * (wind + hit));
      armR.rotation.set(-0.6, 0, -1.0 * (wind + hit));
      return true;
    case 'flail': // 触手（腕）を交互に振り回す
      armL.rotation.set(-1.5 + Math.sin(t * 14) * 1.2, 0, 0.6);
      armR.rotation.set(-1.5 - Math.sin(t * 14) * 1.2, 0, -0.6);
      root.rotation.z = Math.sin(t * 7) * 0.12;
      return true;
    case 'clap': // 左右から挟み込む
      armL.rotation.set(-1.3, -1.2 * wind + 0.9 * hit, 0.9 * wind);
      armR.rotation.set(-1.3, 1.2 * wind - 0.9 * hit, -0.9 * wind);
      root.rotation.x = 0.2 * hit;
      return true;
    case 'coil': // ばねのように縮んでから伸びる
      root.position.y = -0.35 * wind + 0.5 * hit;
      root.rotation.x = 0.45 * wind - 0.5 * hit;
      legL.rotation.x = 0.6 * wind;
      legR.rotation.x = 0.6 * wind;
      return true;
    case 'spinH': // 回りながら浮き上がる
      root.rotation.y = (k + 1) * Math.PI * 6;
      root.position.y = 0.8 * (wind + hit);
      armL.rotation.set(0, 0, 1.4);
      armR.rotation.set(0, 0, -1.4);
      return true;
    default:
      return false;
  }
}
