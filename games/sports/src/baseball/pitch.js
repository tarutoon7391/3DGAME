// 投球：球種・コース9分割・軌道の計算、CPU 投手の配球、CPU 打者の読み
import * as THREE from 'three';
import { ZONE, MOUND_Z } from './field.js';
import { gauss, rand } from '../core/difficulty.js';

/** 球種。time: 本塁までの秒数、brk: 変化量（x は横、y は落ち） */
export const PITCHES = [
  { key: 'straight', label: 'ストレート', time: 0.6, brk: [0, -0.05] },
  { key: 'curve', label: 'カーブ', time: 0.78, brk: [0.55, 0.3] },
  { key: 'fork', label: 'フォーク', time: 0.7, brk: [0, 0.55] },
];

/** コース 0〜8（左上から右下。捕手側から見た向き）。端のマスはゾーンの縁にまたがる */
export function cellCenter(cell, out = { x: 0, y: 0 }) {
  const col = cell % 3;
  const row = Math.floor(cell / 3);
  out.x = [-0.25, 0, 0.25][col];
  out.y = [1.1, 0.8, 0.5][row];
  return out;
}

export function inZone(x, y) {
  const r = 0.037; // ボールが少しでもかかればストライク
  return x >= ZONE.L - r && x <= ZONE.R + r && y >= ZONE.B - r && y <= ZONE.T + r;
}

const START = new THREE.Vector3(0.15, 1.85, MOUND_Z + 1.4);

/**
 * 投球データを作る（JSON 化できる素のオブジェクト）
 * @param {number} type PITCHES の番号
 * @param {number} cell コース
 * @param {number} control 制球ブレ（m）
 * @param {number} speedMul 到達時間倍率
 */
export function makePitch(type, cell, control, speedMul) {
  const c = cellCenter(cell);
  const p = PITCHES[type];
  const tx = c.x + gauss() * control;
  const ty = c.y + gauss() * control;
  const time = p.time * speedMul * rand(0.97, 1.03);
  return {
    type,
    cell,
    tx,
    ty,
    time,
    bx: p.brk[0] * (Math.random() < 0.5 ? 1 : -1) * (type === 1 ? 1 : 0.2),
    by: p.brk[1],
    strike: inZone(tx, ty),
    kmh: Math.round((18.44 / time) * 3.6 * 1.32),
  };
}

/**
 * 投球の位置（u=0 リリース、u=1 本塁上）。曲がり分を最初は外へ、終盤に戻す
 */
export function pitchPos(pt, u, out) {
  const ex = pt.tx + pt.bx;
  const ey = pt.ty + pt.by;
  out.set(
    START.x + (ex - START.x) * u - pt.bx * u * u,
    START.y + (ey - START.y) * u - pt.by * u * u,
    START.z + (0 - START.z) * u,
  );
  return out;
}

/** CPU 投手の配球 */
export function cpuChoosePitch(diff, balls, strikes) {
  const type = Math.random() < diff.pitchBreaking ? (Math.random() < 0.5 ? 1 : 2) : 0;
  let cell;
  if (balls >= 3) cell = 4; // 四球を嫌って真ん中
  else if (strikes === 2 && Math.random() < 0.5) cell = [6, 7, 8][(Math.random() * 3) | 0]; // 追い込んだら低め
  else cell = (Math.random() * 9) | 0;
  return makePitch(type, cell, diff.pitchControl, diff.pitchSpeed);
}

/**
 * CPU 打者の「読み」：プレイヤーの配球の傾向を覚える
 */
export function createReader() {
  const typeCount = [1, 1, 1];
  const cellCount = new Array(9).fill(1);
  return {
    learn(pt) {
      for (let i = 0; i < 3; i++) typeCount[i] *= 0.85;
      for (let i = 0; i < 9; i++) cellCount[i] *= 0.85;
      typeCount[pt.type] += 1;
      cellCount[pt.cell] += 1;
    },
    /** いちばん多い球種・コースを予想 */
    guess() {
      const t = typeCount.indexOf(Math.max(...typeCount));
      const c = cellCount.indexOf(Math.max(...cellCount));
      return { type: t, cell: c };
    },
  };
}

/**
 * CPU 打者の判断。戻り値 null=見送り、{contact:false}=空振り、{contact:true, v, angle, spray}=打った
 */
export function cpuBat(pt, diff, guess, strikes) {
  const read = guess.type === pt.type && Math.abs((guess.cell % 3) - (pt.cell % 3)) + Math.abs(Math.floor(guess.cell / 3) - Math.floor(pt.cell / 3)) <= 1;
  let swingP = pt.strike ? 0.74 : diff.batChase;
  if (strikes === 2) swingP += pt.strike ? 0.18 : 0.1; // 追い込まれたら振る
  if (read) swingP += 0.08;
  if (Math.random() > swingP) return null;
  let contact = diff.batContact + (read ? diff.batRead : 0);
  if (pt.type !== 0) contact -= 0.1;
  if (pt.cell === 4) contact += 0.15;
  if (pt.cell === 0 || pt.cell === 2 || pt.cell === 6 || pt.cell === 8) contact -= 0.08;
  if (!pt.strike) contact -= 0.22;
  if (Math.random() > contact) return { contact: false };
  const sweet = Math.min(1, Math.random() * 0.75 + (read ? 0.3 : 0.1));
  const v = (20 + 26 * sweet) * diff.batPower * rand(0.8, 1.05);
  const angle = rand(-6, 38) + gauss() * 7;
  const spray = gauss() * 26;
  return { contact: true, v, angle, spray };
}
