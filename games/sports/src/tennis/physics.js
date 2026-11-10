// テニスのボール物理：重力・バウンド・ネット判定と、狙った地点に落とす初速の計算
import * as THREE from 'three';

export const G = 9.8;
/** コート寸法（m）。決めたこと：ダブルスの横幅をインとして扱う（打ちやすさ優先） */
export const COURT = { HALF_W: 5.49, HALF_L: 11.89, SERVICE_L: 6.4, NET_H: 0.914, R: 0.07 };

/** ボール状態を作る */
export function makeBallState() {
  return { p: new THREE.Vector3(), v: new THREE.Vector3(), netHit: false, rolling: false };
}

/**
 * 1ステップ進める。戻り値は 'bounce'（着地）／'net'（ネットに当たった）／null
 * 着地時は b.p が着地点になっている
 */
export function stepBall(b, dt) {
  const { R, NET_H, HALF_W } = COURT;
  const px = b.p.x;
  const py = b.p.y;
  const pz = b.p.z;
  if (!b.rolling) b.v.y -= G * dt;
  b.p.addScaledVector(b.v, dt);
  let ev = null;
  // ネット（z=0 をまたいだ瞬間の高さで判定）
  if (!b.netHit && pz !== 0 && Math.sign(pz) !== Math.sign(b.p.z)) {
    const t = pz / (pz - b.p.z);
    const yAt = py + (b.p.y - py) * t;
    const xAt = px + (b.p.x - px) * t;
    if (yAt < NET_H + R && Math.abs(xAt) < HALF_W + 0.5) {
      b.netHit = true;
      b.p.set(xAt, Math.max(R, yAt), Math.sign(pz) * 0.08);
      b.v.set(b.v.x * 0.2, Math.min(b.v.y, 0) * 0.3, -b.v.z * 0.12);
      ev = 'net';
    }
  }
  // 地面
  if (b.p.y < R) {
    b.p.y = R;
    if (b.rolling) {
      b.v.multiplyScalar(Math.max(0, 1 - 1.5 * dt));
    } else if (b.v.y < 0) {
      const impact = -b.v.y;
      b.v.y = impact * 0.72;
      b.v.x *= 0.82;
      b.v.z *= 0.82;
      if (b.v.y < 0.7) {
        b.v.y = 0;
        b.rolling = true;
      }
      if (impact > 0.9) ev = ev || 'bounce';
    }
  }
  return ev;
}

/**
 * from から (tx, tz) に T 秒で着地する初速を out に入れる。
 * clearNet が true ならネットを越えるまで T を伸ばす。戻り値は実際の T
 */
export function solveShot(from, tx, tz, T, out, clearNet = true, margin = 0.3) {
  const { R, NET_H } = COURT;
  for (let i = 0; i < 20; i++) {
    out.set((tx - from.x) / T, (R - from.y + 0.5 * G * T * T) / T, (tz - from.z) / T);
    if (!clearNet) return T;
    const tn = -from.z / out.z;
    if (!(tn > 0 && tn < T)) return T;
    const yn = from.y + out.y * tn - 0.5 * G * tn * tn;
    if (yn > NET_H + margin) return T;
    T += 0.06;
  }
  return T;
}

// 予測用の作業領域（毎フレーム new しない）
const sim = makeBallState();

/**
 * 着地点と、バウンド後に打ちごろ（高さ hitY 以下に下りてくる）地点を予測する
 * @returns {{bounce:boolean, bx:number, bz:number, hx:number, hz:number, ht:number}} out に書き込む
 */
export function predict(b, out, hitY = 1.1, maxT = 4) {
  sim.p.copy(b.p);
  sim.v.copy(b.v);
  sim.netHit = b.netHit;
  sim.rolling = b.rolling;
  const dt = 1 / 60;
  out.bounce = false;
  out.net = false;
  out.hx = b.p.x;
  out.hz = b.p.z;
  out.ht = 0;
  let t = 0;
  let bounced = false;
  let apexPassed = false;
  while (t < maxT) {
    const ev = stepBall(sim, dt);
    t += dt;
    if (ev === 'net') {
      out.net = true;
    }
    if (!bounced && ev === 'bounce') {
      bounced = true;
      out.bounce = true;
      out.bx = sim.p.x;
      out.bz = sim.p.z;
      out.bt = t;
      continue;
    }
    if (bounced) {
      if (sim.v.y < 0) apexPassed = true;
      if ((apexPassed && sim.p.y <= hitY) || Math.abs(sim.p.z) > COURT.HALF_L + 3.5 || ev === 'bounce') {
        out.hx = sim.p.x;
        out.hz = sim.p.z;
        out.ht = t;
        return out;
      }
    }
  }
  out.hx = sim.p.x;
  out.hz = sim.p.z;
  out.ht = t;
  return out;
}
