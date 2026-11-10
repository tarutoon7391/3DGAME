// InstancedMesh ＋オブジェクトプール
// 起動時に capacity 個のアイテムを確保し、spawn/kill で使い回す（毎フレームの new をしない）。
// sync() で生存中のものだけを先頭から詰めて行列・色を書き込み、mesh.count で描画数を絞る。
import * as THREE from 'three';

const dummy = new THREE.Object3D();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const tmpV = new THREE.Vector3();

export class InstPool {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.BufferGeometry} geometry
   * @param {THREE.Material} material
   * @param {number} capacity 最大数
   * @param {() => object} [extra] アイテムに追加するフィールドを返す関数（起動時に capacity 回だけ呼ぶ）
   */
  constructor(scene, geometry, material, capacity, extra = () => ({})) {
    this.scene = scene;
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1)); // instanceColor 属性を作らせる
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.capacity = capacity;
    this.free = [];
    this.alive = [];
    for (let i = 0; i < capacity; i++) {
      const it = {
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        scale: new THREE.Vector3(1, 1, 1),
        color: new THREE.Color(1, 1, 1),
        alignToVel: false, // true なら +z 軸を速度方向に向ける
        ...extra(),
      };
      this.free.push(it);
    }
    scene.add(this.mesh);
  }

  /** 空きから1つ取り出す。満杯なら null */
  spawn() {
    const it = this.free.pop();
    if (!it) return null;
    it.alive = true;
    it.scale.set(1, 1, 1);
    it.rot.set(0, 0, 0);
    it.vel.set(0, 0, 0);
    it.alignToVel = false;
    this.alive.push(it);
    return it;
  }

  /** 消す（実際の回収は次の sync で行う） */
  kill(it) {
    it.alive = false;
  }

  /** 生存数 */
  get count() {
    return this.alive.length;
  }

  /** 死んだものを回収し、生存中のものの行列と色を GPU 用バッファへ書く */
  sync() {
    const a = this.alive;
    const mesh = this.mesh;
    let n = 0;
    for (let i = 0; i < a.length; i++) {
      const it = a[i];
      if (!it.alive) {
        this.free.push(it);
        continue;
      }
      a[n] = it;
      dummy.position.copy(it.pos);
      if (it.alignToVel && it.vel.lengthSq() > 1e-8) {
        dummy.quaternion.setFromUnitVectors(Z_AXIS, tmpV.copy(it.vel).normalize());
      } else {
        dummy.rotation.copy(it.rot);
      }
      dummy.scale.copy(it.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, it.color);
      n++;
    }
    a.length = n;
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  /** 全部消す */
  clear() {
    for (let i = 0; i < this.alive.length; i++) this.alive[i].alive = false;
    this.sync();
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
