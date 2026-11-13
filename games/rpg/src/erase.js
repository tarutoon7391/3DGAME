// 「敵の攻撃を消す」技の共通処理（メイドのお掃除・大掃除、踊り子のターン、吸収術士・反射術士、守護結界・鏡の盾など）
// 敵弾だけでなく、その範囲にある攻撃をまとめて消す：
//   ・敵弾：消える（今までどおり。消した数を返す）
//   ・地面に落ちてくる攻撃（隕石などのボスの設置範囲）：中心が範囲内なら、その攻撃ごと消える
//   ・予兆が出ている攻撃・なぎ払い・炎の壁・近接攻撃：その「範囲の中だけ」当たらなくなる（範囲の外はそのまま当たる）
// 範囲の中が安全な時間は、消した瞬間に範囲へかかっている予兆が終わるまで（最低 0.6 秒、最大 4 秒）。地面に光る輪で見せる
// 消す技は全員の画面で再生されるので、ボスを動かしているホストの画面でも同じ範囲が安全になる
import * as THREE from 'three';

const MIN_SAFE = 0.6;
const MAX_SAFE = 4;

export function createEraser(game) {
  const holes = []; // { x, z, r, t（残り秒）, life, mesh }
  const ringGeo = new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);

  function show(h) {
    const g = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe0f7fa, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const discMat = new THREE.MeshBasicMaterial({ color: 0x80deea, transparent: true, opacity: 0.18, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    const disc = new THREE.Mesh(discGeo, discMat);
    ring.renderOrder = disc.renderOrder = 4; // 敵の予兆より上に描く
    g.add(disc, ring);
    g.scale.set(h.r, 1, h.r);
    g.position.set(h.x, 0.07, h.z);
    game.scene.add(g);
    h.mesh = g;
    h.mats = [ringMat, discMat];
  }
  function drop(i) {
    const h = holes[i];
    game.scene.remove(h.mesh);
    h.mats.forEach((m) => m.dispose());
    holes.splice(i, 1);
  }

  return {
    /**
     * (x,z) の半径 r にある敵の攻撃を消す。消した敵弾の数を返す
     */
    erase(x, z, r) {
      const shots = game.projectiles.clearShotsNear(x, z, r);
      // ボスの「あとで落ちてくる」範囲：中心が入っていればまるごと消す
      let zones = 0;
      for (const b of game.bosses || []) {
        if (!b.zones) continue;
        for (let i = b.zones.length - 1; i >= 0; i--) {
          const zn = b.zones[i];
          if ((zn.x - x) ** 2 + (zn.z - z) ** 2 < r * r) {
            zn.tele?.end();
            b.zones.splice(i, 1);
            zones++;
          }
        }
      }
      // ほかの攻撃は、いまかかっている予兆が終わるまで範囲の中だけ当たらなくする
      const left = game.fx.teleLeftNear?.(x, z, r) ?? 0;
      const life = Math.min(MAX_SAFE, Math.max(MIN_SAFE, left + 0.3));
      const h = { x, z, r, t: life, life };
      show(h);
      holes.push(h);
      return shots + zones;
    },
    /** (x,z) がいま安全な範囲（攻撃を消した範囲）の中か */
    covers(x, z) {
      for (const h of holes) if ((x - h.x) ** 2 + (z - h.z) ** 2 < h.r * h.r) return true;
      return false;
    },
    update(dt) {
      for (let i = holes.length - 1; i >= 0; i--) {
        const h = holes[i];
        h.t -= dt;
        if (h.t <= 0) {
          drop(i);
          continue;
        }
        const k = Math.min(1, h.t / 0.4); // 最後の 0.4 秒で薄くなる
        h.mats[0].opacity = 0.9 * k * (0.75 + 0.25 * Math.sin(h.t * 12));
        h.mats[1].opacity = 0.18 * k;
      }
    },
    clear() {
      for (let i = holes.length - 1; i >= 0; i--) drop(i);
    },
  };
}
