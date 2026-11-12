// 結界師の転送結界：置いた印（戻り先）を、残っている間ずっと足元に表示する（自分の画面だけ）
// 印は jobs.js の cast() が p.recallMark に置く（20秒で消える）
import * as THREE from 'three';

const LIFE = 20; // 秒（jobs.js の転送結界と同じ）

export function createRecallMark(game) {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x80d8ff, transparent: true, opacity: 0.9, depthWrite: false });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x80d8ff, transparent: true, opacity: 0.18, depthWrite: false });
  const colMat = new THREE.MeshBasicMaterial({ color: 0x80d8ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.35, 40).rotateX(-Math.PI / 2), ringMat);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40).rotateX(-Math.PI / 2), fillMat);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 6, 24, 1, true).translate(0, 3, 0), colMat);
  // 残り時間を表す内側の輪（減っていく）
  const leftMat = new THREE.MeshBasicMaterial({ color: 0xe1f5fe, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const left = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 40, 1, 0, Math.PI * 2), leftMat);
  left.rotation.x = -Math.PI / 2;
  ring.position.y = fill.position.y = 0.06;
  left.position.y = 0.07;
  g.add(fill, ring, left, col);
  g.visible = false;
  game.scene.add(g);
  let lastFrac = -1;
  return {
    update() {
      const me = game.me();
      const m = me?.recallMark;
      const age = m ? (performance.now() - m.at) / 1000 : LIFE;
      if (!m || age >= LIFE || !game.playing) {
        g.visible = false;
        return;
      }
      g.visible = true;
      g.position.set(m.x, 0, m.z);
      const t = performance.now() / 1000;
      ring.scale.setScalar(1 + 0.06 * Math.sin(t * 5));
      col.material.opacity = 0.16 + 0.08 * Math.sin(t * 3);
      // 残りの割合で内側の輪を欠けさせる（0.05 刻みで作り直す）
      const frac = Math.round((1 - age / LIFE) * 20) / 20;
      if (frac !== lastFrac) {
        lastFrac = frac;
        left.geometry.dispose();
        left.geometry = new THREE.RingGeometry(0.7, 0.85, 40, 1, Math.PI / 2, Math.max(0.01, frac) * Math.PI * 2);
      }
      ringMat.opacity = age > LIFE - 3 && Math.floor(t * 6) % 2 ? 0.3 : 0.9; // 消える前は点滅
    },
  };
}
