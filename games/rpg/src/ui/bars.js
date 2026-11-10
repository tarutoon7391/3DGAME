// 敵の頭上 HP バー（カメラを向く板。geometry / material は全バーで共有）
import * as THREE from 'three';

export function createBars(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const bgGeo = new THREE.PlaneGeometry(1.24, 0.2);
  const fillGeo = new THREE.PlaneGeometry(1.16, 0.12);
  fillGeo.translate(0.58, 0, 0); // 左端を原点に（scale.x で減らす）
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.75, depthTest: false });
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xff3d3d, depthTest: false });
  const items = new Set();

  return {
    add(y) {
      const g = new THREE.Group();
      const bg = new THREE.Mesh(bgGeo, bgMat);
      const fill = new THREE.Mesh(fillGeo, fillMat);
      bg.renderOrder = 20;
      fill.renderOrder = 21;
      fill.position.set(-0.58, 0, 0.001);
      g.add(bg, fill);
      g.visible = false;
      group.add(g);
      const b = { g, fill, y };
      items.add(b);
      return b;
    },
    set(b, pos, ratio, show) {
      b.g.visible = show && ratio > 0;
      if (!b.g.visible) return;
      b.g.position.set(pos.x, pos.y + b.y, pos.z);
      b.fill.scale.x = Math.max(0.001, ratio);
    },
    remove(b) {
      group.remove(b.g);
      items.delete(b);
    },
    update(camera) {
      for (const b of items) if (b.g.visible) b.g.quaternion.copy(camera.quaternion);
    },
  };
}
