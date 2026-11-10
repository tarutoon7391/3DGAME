// ステージ背景：ライト・フォグ・背景色と、ステージごとの流れる飾り（すべて当たり判定なし）
//   0 小惑星帯：周囲を漂う岩と青い惑星
//   1 敵艦隊  ：遠くを並走する巨大戦艦と赤い惑星
//   2 母艦内部：流れていく通路のフレーム・床と天井（影が落ちる）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand } from './util.js';

const ENVS = [
  { bg: 0x04060f, fog: 0x0a0e22, near: 70, far: 260, hemiSky: 0xbfd8ff, hemiGround: 0x2a2038, sun: 0xfff1dd, sunI: 2.4 },
  { bg: 0x05050c, fog: 0x140c1c, near: 70, far: 250, hemiSky: 0xd0d4ff, hemiGround: 0x301822, sun: 0xffd6c8, sunI: 2.2 },
  { bg: 0x0c0403, fog: 0x1c0a06, near: 40, far: 190, hemiSky: 0xffc8a0, hemiGround: 0x301008, sun: 0xffb088, sunI: 2.0 },
];

const dummy = new THREE.Object3D();

/** 複数ジオメトリを1つに（属性をそろえるため非インデックス化してから結合） */
export function merge(list) {
  const ni = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = mergeGeometries(ni);
  ni.forEach((g) => g.dispose());
  list.forEach((g) => g.dispose());
  return out;
}

/** 流れる InstancedMesh の飾りを作る共通処理 */
function scroller(scene, geo, mat, items, speedMul, wrapLen, { spin = false, shadow = false } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  mesh.frustumCulled = false;
  mesh.receiveShadow = shadow;
  items.forEach((it, i) => mesh.setColorAt(i, new THREE.Color(it.color ?? 0xffffff)));
  scene.add(mesh);
  const write = () => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      dummy.scale.setScalar(it.s || 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  write();
  return {
    mesh,
    update(dt, speed) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        it.z += speed * speedMul * dt;
        if (it.z > 30) it.z -= wrapLen;
        if (spin) {
          it.rx += it.sx * dt;
          it.ry += it.sy * dt;
        }
      }
      write();
    },
  };
}

function planet(scene, color, x, y, z, r, ringColor) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshStandardMaterial({ color, roughness: 0.9, fog: false }));
  g.add(body);
  if (ringColor) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.6, r * 0.08, 4, 64), new THREE.MeshBasicMaterial({ color: ringColor, fog: false, transparent: true, opacity: 0.6 }));
    ring.rotation.x = 1.2;
    g.add(ring);
  }
  g.position.set(x, y, z);
  scene.add(g);
  return g;
}

// ---- ステージ別の飾り ----
function asteroidField(scene) {
  const items = [];
  for (let i = 0; i < 90; i++) {
    const side = i % 2 ? 1 : -1;
    const shade = rand(0.18, 0.38);
    items.push({
      x: side * rand(40, 110), y: rand(-50, 50), z: rand(-330, 20), s: rand(2, 9),
      rx: rand(0, 6), ry: rand(0, 6), sx: rand(-0.4, 0.4), sy: rand(-0.4, 0.4),
      color: new THREE.Color(shade, shade * 0.85, shade * 0.7).getHex(),
    });
  }
  const rocks = scroller(scene, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 }), items, 0.8, 360, { spin: true });
  const p = planet(scene, 0x4a64c8, -170, 70, -430, 70, 0x9fb4ff);
  return { objs: [rocks.mesh, p], update: rocks.update };
}

function fleet(scene) {
  // 戦艦：胴体＋艦橋＋エンジン
  const hull = new THREE.BoxGeometry(6, 3, 40);
  const bridge = new THREE.BoxGeometry(2.5, 3, 6);
  bridge.translate(0, 2.8, 8);
  const eng = new THREE.CylinderGeometry(1.2, 1.2, 4, 8);
  eng.rotateX(Math.PI / 2);
  eng.translate(0, 0, -21);
  const wing = new THREE.BoxGeometry(16, 0.6, 10);
  wing.translate(0, 0, -8);
  const geo = merge([hull, bridge, eng, wing]);
  const items = [];
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const sh = rand(0.25, 0.45);
    items.push({ x: side * rand(42, 115), y: rand(-35, 40), z: rand(-380, 0), s: rand(1, 2.2), ry: Math.PI, color: new THREE.Color(sh, sh * 1.05, sh * 1.25).getHex() });
  }
  const ships = scroller(scene, geo, new THREE.MeshStandardMaterial({ flatShading: true, metalness: 0.5, roughness: 0.5 }), items, 0.35, 400);
  // 窓の光（同じ配置で細い発光帯）
  const winGeo = new THREE.BoxGeometry(6.2, 0.25, 30);
  const lights = scroller(scene, winGeo, new THREE.MeshBasicMaterial({ color: 0xffb060, fog: false }), items, 0.35, 400);
  // 位置配列を共有しているので2回目の update は z を2重に進めてしまう→窓は描画だけ追従させる
  const p = planet(scene, 0xb04a3a, 150, -40, -420, 85, null);
  return {
    objs: [ships.mesh, lights.mesh, p],
    update(dt, speed) {
      ships.update(dt, speed);
      lights.update(0, 0);
    },
  };
}

function mothership(scene) {
  // 通路のフレーム（四角い枠）
  const top = new THREE.BoxGeometry(50, 3, 3); top.translate(0, 15, 0);
  const bot = new THREE.BoxGeometry(50, 3, 3); bot.translate(0, -15, 0);
  const lft = new THREE.BoxGeometry(3, 33, 3); lft.translate(-25, 0, 0);
  const rgt = new THREE.BoxGeometry(3, 33, 3); rgt.translate(25, 0, 0);
  const frameGeo = merge([top, bot, lft, rgt]);
  const items = [];
  for (let i = 0; i < 24; i++) items.push({ x: 0, y: 0, z: 20 - i * 16, color: 0x8a6a5a });
  const frames = scroller(scene, frameGeo, new THREE.MeshStandardMaterial({ flatShading: true, metalness: 0.6, roughness: 0.5 }), items, 1, 384, { shadow: true });
  frames.mesh.castShadow = false;
  // 枠の内側の発光帯
  const s1 = new THREE.BoxGeometry(44, 0.3, 0.5); s1.translate(0, 13.4, 1.6);
  const s2 = new THREE.BoxGeometry(44, 0.3, 0.5); s2.translate(0, -13.4, 1.6);
  const s3 = new THREE.BoxGeometry(0.3, 26, 0.5); s3.translate(-23.4, 0, 1.6);
  const s4 = new THREE.BoxGeometry(0.3, 26, 0.5); s4.translate(23.4, 0, 1.6);
  const strips = scroller(scene, merge([s1, s2, s3, s4]), new THREE.MeshBasicMaterial({ color: 0xff7a30, toneMapped: false }), items, 1, 384);
  // 床と天井（影を受ける）
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x3a2622, roughness: 0.8, metalness: 0.3 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 420), planeMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -14, -180);
  floor.receiveShadow = true;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(50, 420), planeMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 14, -180);
  ceil.receiveShadow = true;
  scene.add(floor, ceil);
  return {
    objs: [frames.mesh, strips.mesh, floor, ceil],
    update(dt, speed) {
      frames.update(dt, speed);
      strips.update(0, 0);
    },
  };
}

const BUILDERS = [asteroidField, fleet, mothership];

function disposeObj(o) {
  o.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
    if (c.isInstancedMesh) c.dispose();
  });
  o.removeFromParent();
}

export function createEnv(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1.1);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(12, 30, 18);
  sun.target.position.set(0, 0, -25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 40, bottom: -40, near: 1, far: 120 });
  scene.add(hemi, sun, sun.target);
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 60, 240);

  let decor = null;
  let current = -1;

  function set(i) {
    if (i === current) return;
    if (decor) decor.objs.forEach(disposeObj);
    current = i;
    const c = ENVS[i];
    scene.background.setHex(c.bg);
    scene.fog.color.setHex(c.fog);
    scene.fog.near = c.near;
    scene.fog.far = c.far;
    hemi.color.setHex(c.hemiSky);
    hemi.groundColor.setHex(c.hemiGround);
    sun.color.setHex(c.sun);
    sun.intensity = c.sunI;
    decor = BUILDERS[i](scene);
  }

  function update(dt, speed) {
    if (decor) decor.update(dt, speed);
  }

  return { set, update };
}
