// 打球の判定：初速・角度・方向から飛距離と落下点を求め、守備位置と比べて結果を決める
// 守備・走塁は自動判定（ランナーは安打の塁数だけ進む簡易ルール）
import * as THREE from 'three';
import { FIELDERS, FENCE, polar } from './field.js';

const G = 9.8;
const K = 0.006; // 空気抵抗
const tmp = new THREE.Vector3();

/** 打球の状態（JSON 化できる素の値） */
export function makeBatted(v, angleDeg, sprayDeg) {
  const a = (angleDeg * Math.PI) / 180;
  const s = (sprayDeg * Math.PI) / 180;
  return {
    p: { x: 0, y: 0.9, z: -0.3 },
    v: { x: Math.cos(a) * Math.sin(s) * v, y: Math.sin(a) * v, z: -Math.cos(a) * Math.cos(s) * v },
    landed: false,
  };
}

/** 1ステップ進める（ゴロはバウンドして転がる） */
export function stepBatted(b, dt) {
  const sp = Math.hypot(b.v.x, b.v.y, b.v.z);
  b.v.x -= K * sp * b.v.x * dt;
  b.v.z -= K * sp * b.v.z * dt;
  b.v.y -= (G + K * sp * b.v.y) * dt;
  b.p.x += b.v.x * dt;
  b.p.y += b.v.y * dt;
  b.p.z += b.v.z * dt;
  if (b.p.y < 0.05) {
    b.p.y = 0.05;
    if (b.v.y < 0) {
      b.v.y = -b.v.y * 0.4;
      if (b.v.y < 1) b.v.y = 0;
    }
    b.v.x *= 0.97;
    b.v.z *= 0.97;
    b.landed = true;
  }
}

/**
 * 結果を決める
 * @returns {{kind:string, label:string, bases:number, out:boolean, foul:boolean, fielder:number, catchAt:{x:number,z:number}, dist:number, hang:number, sacFly?:boolean}}
 */
export function judgeBatted(v, angle, spray) {
  if (Math.abs(spray) > 45) {
    return { kind: 'foul', label: 'ファウル', bases: 0, out: false, foul: true, fielder: -1, catchAt: null, dist: 0, hang: 1.2 };
  }
  // 着地点まで飛ばす
  const b = makeBatted(v, angle, spray);
  let t = 0;
  while (!b.landed && t < 10) {
    stepBatted(b, 1 / 60);
    t += 1 / 60;
  }
  const dist = Math.hypot(b.p.x, b.p.z);
  const land = { x: b.p.x, z: b.p.z };
  if (dist >= FENCE) {
    return { kind: 'hr', label: 'ホームラン！', bases: 4, out: false, foul: false, fielder: -1, catchAt: land, dist, hang: t };
  }
  // いちばん近い野手
  let best = -1;
  let bestD = Infinity;
  FIELDERS.forEach((f, i) => {
    polar(f.a, f.d, tmp);
    const d = Math.hypot(tmp.x - land.x, tmp.z - land.z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (angle < 10) {
    // ゴロ：内野手の正面に近いほどアウト
    if (v < 17) return { kind: 'out', label: 'ボテボテのゴロ', bases: 0, out: true, foul: false, fielder: 0, catchAt: polar(0, 14, {}), dist, hang: 1.2 };
    let near = Infinity;
    let who = 1;
    for (let i = 1; i <= 4; i++) {
      const dA = Math.abs(FIELDERS[i].a - spray);
      if (dA < near) {
        near = dA;
        who = i;
      }
    }
    const lateral = Math.sin((near * Math.PI) / 180) * 30;
    const reach = 2.2 + (30 / (v * 0.75)) * 6.5;
    const at = polar(spray, 30, {});
    if (lateral <= reach) return { kind: 'out', label: 'ゴロでアウト', bases: 0, out: true, foul: false, fielder: who, catchAt: at, dist, hang: 30 / (v * 0.75) };
    return { kind: 'single', label: 'ヒット！', bases: 1, out: false, foul: false, fielder: who, catchAt: polar(spray, 45, {}), dist, hang: 1.6 };
  }
  // フライ・ライナー：落下までに野手が届けばアウト
  const reach = 1.0 + Math.max(0, t - 0.5) * 5.6;
  if (bestD <= reach) {
    const label = angle < 20 ? 'ライナーでアウト' : dist < 40 ? '内野フライ' : 'フライでアウト';
    return { kind: 'out', label, bases: 0, out: true, foul: false, fielder: best, catchAt: land, dist, hang: t, sacFly: dist > 62 };
  }
  if (dist < 72) return { kind: 'single', label: 'ヒット！', bases: 1, out: false, foul: false, fielder: best, catchAt: land, dist, hang: t };
  return { kind: 'double', label: 'ツーベース！', bases: 2, out: false, foul: false, fielder: best, catchAt: land, dist, hang: t };
}

/**
 * 走者を進める（決めたこと：二塁より先の走者は安打で1つ余分に進む）。bases は [一塁,二塁,三塁] の真偽。戻り値は入った点数
 * @param {boolean[]} bases
 * @param {number} n 進む塁数（4 でホームラン）
 * @param {boolean} forcedOnly 四球（押し出しのみ）
 */
export function advance(bases, n, forcedOnly = false) {
  let runs = 0;
  if (forcedOnly) {
    if (bases[0]) {
      if (bases[1]) {
        if (bases[2]) runs++;
        bases[2] = true;
      }
      bases[1] = true;
    }
    bases[0] = true;
    return runs;
  }
  for (let i = 2; i >= 0; i--) {
    if (!bases[i]) continue;
    bases[i] = false;
    // 走者は打者より1つ余分に進む（二塁走者はシングルで生還、一塁走者はツーベースで三塁へ）
    const to = i + n + (i >= 1 && n < 4 ? 1 : 0);
    if (to >= 3) runs++;
    else bases[to] = true;
  }
  if (n >= 4) runs++;
  else bases[n - 1] = true;
  return runs;
}
