// タイルマップ：衝突・視線レイキャスト（DDA）・経路探索（BFS）
import { T, SOLID, OPAQUE, LOW } from './config.js';

// 文字 → 基本フラグ
const BASE = {
  '#': SOLID | OPAQUE, // 壁
  o: SOLID | OPAQUE, // 扉（閉）
  D: SOLID | OPAQUE, // 鍵付き扉（閉）
  L: SOLID | OPAQUE, // ロッカー
  S: SOLID | LOW, // 展示台
  T: SOLID | LOW, // メインのお宝（展示ケース）
  t: SOLID | LOW, // サブのお宝
};

const DIRS8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export class Grid {
  /** @param {string[]} rows タイルマップ（全行同じ長さ） */
  constructor(rows) {
    this.h = rows.length;
    this.w = rows[0].length;
    this.chars = rows.map((r) => r.split(''));
    this.flags = new Uint8Array(this.w * this.h);
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) this.flags[r * this.w + c] = BASE[this.chars[r][c]] || 0;
    }
    // BFS 用の作業領域（毎回 new しない）
    this._prev = new Int32Array(this.w * this.h);
    this._queue = new Int32Array(this.w * this.h);
    this._mark = new Uint32Array(this.w * this.h);
    this._stamp = 0;
  }

  ch(c, r) {
    return c < 0 || r < 0 || c >= this.w || r >= this.h ? '#' : this.chars[r][c];
  }
  flag(c, r) {
    return c < 0 || r < 0 || c >= this.w || r >= this.h ? SOLID | OPAQUE : this.flags[r * this.w + c];
  }
  setFlag(c, r, f) {
    this.flags[r * this.w + c] = f;
  }
  /** 文字に一致するタイルを全部返す */
  find(chars) {
    const out = [];
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) if (chars.includes(this.chars[r][c])) out.push({ c, r, ch: this.chars[r][c] });
    }
    return out;
  }
  toTile(x) {
    return Math.floor(x / T);
  }
  center(i) {
    return i * T + T / 2;
  }

  /**
   * DDA レイキャスト。mask に一致するタイルに当たるまでの距離を返す（当たらなければ maxDist）
   * dx,dz は正規化済みの向き
   */
  raycast(x0, z0, dx, dz, maxDist, mask = OPAQUE) {
    let c = Math.floor(x0 / T);
    let r = Math.floor(z0 / T);
    const stepC = dx > 0 ? 1 : -1;
    const stepR = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx);
    const adz = Math.abs(dz);
    const tdx = adx > 1e-9 ? T / adx : Infinity;
    const tdz = adz > 1e-9 ? T / adz : Infinity;
    let tmx = adx > 1e-9 ? (dx > 0 ? (c + 1) * T - x0 : x0 - c * T) / adx : Infinity;
    let tmz = adz > 1e-9 ? (dz > 0 ? (r + 1) * T - z0 : z0 - r * T) / adz : Infinity;
    let t = 0;
    for (let i = 0; i < 64; i++) {
      if (tmx < tmz) {
        c += stepC;
        t = tmx;
        tmx += tdx;
      } else {
        r += stepR;
        t = tmz;
        tmz += tdz;
      }
      if (t >= maxDist) return maxDist;
      if (this.flag(c, r) & mask) return t;
    }
    return maxDist;
  }

  /** 2点間の見通し。lowBlocks=true なら展示台なども遮る（しゃがみ時） */
  los(ax, az, bx, bz, lowBlocks = false) {
    const dx = bx - ax;
    const dz = bz - az;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return true;
    const mask = lowBlocks ? OPAQUE | LOW : OPAQUE;
    return this.raycast(ax, az, dx / d, dz / d, d, mask) >= d - 1e-4;
  }

  /** 円（半径 rad）を壁に食い込まないよう押し戻す */
  resolve(pos, rad) {
    const c0 = Math.floor((pos.x - rad) / T);
    const c1 = Math.floor((pos.x + rad) / T);
    const r0 = Math.floor((pos.z - rad) / T);
    const r1 = Math.floor((pos.z + rad) / T);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!(this.flag(c, r) & SOLID)) continue;
        const minX = c * T;
        const minZ = r * T;
        const px = Math.max(minX, Math.min(pos.x, minX + T));
        const pz = Math.max(minZ, Math.min(pos.z, minZ + T));
        let nx = pos.x - px;
        let nz = pos.z - pz;
        const d2 = nx * nx + nz * nz;
        if (d2 >= rad * rad) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          pos.x += (nx / d) * (rad - d);
          pos.z += (nz / d) * (rad - d);
        } else {
          // 中心が箱の中：一番近い辺へ押し出す
          const l = pos.x - minX;
          const rr = minX + T - pos.x;
          const u = pos.z - minZ;
          const b = minZ + T - pos.z;
          const m = Math.min(l, rr, u, b);
          if (m === l) pos.x = minX - rad;
          else if (m === rr) pos.x = minX + T + rad;
          else if (m === u) pos.z = minZ - rad;
          else pos.z = minZ + T + rad;
        }
      }
    }
  }

  /** 軸ごとに動かして押し戻す */
  move(pos, dx, dz, rad) {
    pos.x += dx;
    this.resolve(pos, rad);
    pos.z += dz;
    this.resolve(pos, rad);
  }

  /**
   * 8方向 BFS。walkable(c,r) で通行判定。結果はタイル座標の配列を out に詰める（開始タイルは含まない）
   * 目標に届かない時は false
   */
  path(sc, sr, tc, tr, walkable, out) {
    out.length = 0;
    if (sc === tc && sr === tr) return true;
    const w = this.w;
    const stamp = ++this._stamp;
    const mark = this._mark;
    const prev = this._prev;
    const q = this._queue;
    let head = 0;
    let tail = 0;
    const s = sr * w + sc;
    const goal = tr * w + tc;
    mark[s] = stamp;
    prev[s] = -1;
    q[tail++] = s;
    let found = false;
    while (head < tail) {
      const cur = q[head++];
      if (cur === goal) {
        found = true;
        break;
      }
      const cc = cur % w;
      const cr = (cur / w) | 0;
      for (const [ox, oz] of DIRS8) {
        const nc = cc + ox;
        const nr = cr + oz;
        if (nc < 0 || nr < 0 || nc >= w || nr >= this.h) continue;
        const ni = nr * w + nc;
        if (mark[ni] === stamp) continue;
        if (!walkable(nc, nr)) continue;
        // 斜め移動は角をすり抜けない
        if (ox && oz && (!walkable(cc + ox, cr) || !walkable(cc, cr + oz))) continue;
        mark[ni] = stamp;
        prev[ni] = cur;
        q[tail++] = ni;
      }
    }
    if (!found) return false;
    for (let i = goal; i !== s; i = prev[i]) out.push(i);
    out.reverse();
    return true;
  }

  /** (c,r) から最も近い通行可能タイル（自身含む） */
  nearestWalkable(c, r, walkable) {
    if (walkable(c, r)) return { c, r };
    for (let rad = 1; rad < 4; rad++) {
      for (let oz = -rad; oz <= rad; oz++) {
        for (let ox = -rad; ox <= rad; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oz)) !== rad) continue;
          if (walkable(c + ox, r + oz)) return { c: c + ox, r: r + oz };
        }
      }
    }
    return null;
  }
}
