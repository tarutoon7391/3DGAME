// 当たり判定の箱を升目ごとに仕分ける（迷路は壁が多いので、近くの箱だけを調べる）
// 箱 { minX, maxX, minZ, maxZ, off?, low? } の off は後から切り替えてよい（扉・結界）

export function createGrid(bounds, colliders, size = 4) {
  const pad = 4;
  const x0 = bounds.minX - pad;
  const z0 = bounds.minZ - pad;
  const nx = Math.ceil((bounds.maxX - bounds.minX + pad * 2) / size);
  const nz = Math.ceil((bounds.maxZ - bounds.minZ + pad * 2) / size);
  const cells = Array.from({ length: nx * nz }, () => []);
  const ix = (x) => Math.max(0, Math.min(nx - 1, Math.floor((x - x0) / size)));
  const iz = (z) => Math.max(0, Math.min(nz - 1, Math.floor((z - z0) / size)));
  for (const c of colliders) {
    for (let j = iz(c.minZ); j <= iz(c.maxZ); j++) {
      for (let i = ix(c.minX); i <= ix(c.maxX); i++) cells[j * nx + i].push(c);
    }
  }
  let stamp = 0;

  return {
    /** 範囲に重なる箱に fn を呼ぶ（同じ箱は1回だけ） */
    each(minX, minZ, maxX, maxZ, fn) {
      stamp++;
      for (let j = iz(minZ); j <= iz(maxZ); j++) {
        for (let i = ix(minX); i <= ix(maxX); i++) {
          const list = cells[j * nx + i];
          for (let k = 0; k < list.length; k++) {
            const c = list[k];
            if (c._s === stamp) continue;
            c._s = stamp;
            fn(c);
          }
        }
      }
    },
    /** 点を含む升目の箱 */
    at(x, z) {
      return cells[iz(z) * nx + ix(x)];
    },
  };
}
