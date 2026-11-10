// 自機：見た目・移動・ロール（ブースト回避）・射撃・パワーアップ状態
// 入力は readControls() で「意図」オブジェクトに変換してから update に渡す（入力と状態更新を分離）
import * as THREE from 'three';
import { clamp } from './util.js';

export const BOUND_X = 16;
export const BOUND_Y = 9;
const SPEED = 22;
const ROLL_TIME = 0.45;
const ROLL_COOLDOWN = 0.95;
const ROLL_SPEED = 44;
export const MAX_LV = 3;
export const MAX_SHIELD = 3;
const FIRE_INTERVAL = [0.14, 0.1, 0.075, 0.055];
const SPREAD = [[0], [-0.07, 0, 0.07], [-0.14, -0.07, 0, 0.07, 0.14], [-0.21, -0.14, -0.07, 0, 0.07, 0.14, 0.21]];
const BULLET_SPEED = 170;

/** キーボード・マウスの状態を「意図」に変換する（ここ以外で input を読まない） */
export function readControls(input, out) {
  const k = (c) => input.isDown(c);
  out.mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  out.my = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  out.fire = k('Mouse0');
  out.roll = input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight') || input.wasPressed('Mouse2');
  out.bomb = input.wasPressed('Space');
  return out;
}

export function createControls() {
  return { mx: 0, my: 0, fire: false, roll: false, bomb: false, aimX: 0, aimY: 0, aimZ: -1 };
}

function buildShip() {
  const group = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xdfe8f5, flatShading: true, metalness: 0.4, roughness: 0.45 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x2f7bff, flatShading: true, emissive: 0x0a2a66 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x66e0ff, emissive: 0x1aa0d0, emissiveIntensity: 0.8, roughness: 0.1 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  const body = new THREE.ConeGeometry(0.7, 3.6, 6);
  body.rotateX(-Math.PI / 2); // 先端を -z（前方）へ
  add(body, hull, 0, 0, 0);
  add(new THREE.BoxGeometry(5, 0.12, 1.4), accent, 0, -0.1, 0.7);
  add(new THREE.BoxGeometry(0.15, 0.8, 1.1), accent, -2.5, 0.2, 0.8);
  add(new THREE.BoxGeometry(0.15, 0.8, 1.1), accent, 2.5, 0.2, 0.8);
  add(new THREE.BoxGeometry(0.12, 1, 1), hull, 0, 0.55, 1.3);
  const cp = add(new THREE.SphereGeometry(0.42, 12, 8), glass, 0, 0.35, -0.2);
  cp.scale.set(1, 0.7, 1.6);
  const eng = new THREE.CylinderGeometry(0.32, 0.38, 1.2, 8);
  eng.rotateX(Math.PI / 2);
  add(eng, hull, -0.6, -0.1, 1.5);
  add(eng.clone(), hull, 0.6, -0.1, 1.5);

  // エンジン噴射（加算合成のコーン。先端が後方 +z）
  const flameGeo = new THREE.ConeGeometry(0.3, 1.6, 8);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.8);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const flames = [-0.6, 0.6].map((x) => {
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(x, -0.1, 2.1);
    group.add(f);
    return f;
  });

  // シールド（ワイヤーの球）
  const shield = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.6, 1),
    new THREE.MeshBasicMaterial({ color: 0x4db8ff, wireframe: true, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  shield.visible = false;
  // 機体のロールに巻き込まれないよう外側の group に入れる
  return { group, flames, flameMat, shield };
}

export function createPlayer(scene, id = 0) {
  const outer = new THREE.Group(); // 位置
  const ship = buildShip(); // 姿勢（バンク・ロール）
  outer.add(ship.group, ship.shield);
  scene.add(outer);

  const p = {
    id,
    group: outer,
    pos: outer.position,
    vel: new THREE.Vector3(),
    lives: 3,
    shield: 0,
    rapid: 0,
    spread: 0,
    bombs: 3,
    invuln: 0,
    rollT: 0,
    rollCd: 0,
    rollAngle: 0,
    rollX: 1,
    rollY: 0,
    fireCd: 0,
    dead: false,
    lastDirX: 1,
    radius: 0.9,
  };

  p.reset = () => {
    p.pos.set(0, -1, 0);
    p.vel.set(0, 0, 0);
    p.lives = 3;
    p.shield = 0;
    p.rapid = 0;
    p.spread = 0;
    p.bombs = 3;
    p.invuln = 0;
    p.rollT = 0;
    p.rollCd = 0;
    p.rollAngle = 0;
    p.fireCd = 0;
    p.dead = false;
    outer.visible = true;
  };

  p.isRolling = () => p.rollT > 0;
  p.isInvulnerable = () => p.invuln > 0 || p.rollT > 0 || p.dead;

  /**
   * 1フレーム分の更新
   * @param {number} dt
   * @param {object} c readControls の結果（aimX/Y/Z に照準方向）
   * @param {object} g ゲーム（弾・音・演出の呼び出し用）
   */
  p.update = (dt, c, g) => {
    if (p.dead) return;
    // ロール開始
    p.rollCd = Math.max(0, p.rollCd - dt);
    if (c.roll && p.rollCd <= 0) {
      const len = Math.hypot(c.mx, c.my);
      p.rollX = len ? c.mx / len : p.lastDirX;
      p.rollY = len ? c.my / len : 0;
      p.rollT = ROLL_TIME;
      p.rollCd = ROLL_COOLDOWN;
      g.sfx.roll();
    }
    if (c.mx) p.lastDirX = c.mx;

    // 移動
    if (p.rollT > 0) {
      p.rollT -= dt;
      p.vel.set(p.rollX * ROLL_SPEED, p.rollY * ROLL_SPEED, 0);
      p.rollAngle -= (Math.PI * 2 / ROLL_TIME) * dt * (p.rollX >= 0 ? 1 : -1);
      if (p.rollT <= 0) p.rollAngle = 0;
    } else {
      const len = Math.hypot(c.mx, c.my) || 1;
      const k = Math.min(1, dt * 10);
      p.vel.x += ((c.mx / len) * SPEED - p.vel.x) * k;
      p.vel.y += ((c.my / len) * SPEED - p.vel.y) * k;
    }
    p.pos.x = clamp(p.pos.x + p.vel.x * dt, -BOUND_X, BOUND_X);
    p.pos.y = clamp(p.pos.y + p.vel.y * dt, -BOUND_Y, BOUND_Y);

    // 姿勢：移動でバンク、照準方向へ少し機首を向ける
    const sg = ship.group;
    sg.rotation.order = 'YXZ';
    sg.rotation.y = Math.atan2(-c.aimX, -c.aimZ) * 0.5;
    sg.rotation.x = Math.atan2(c.aimY, -c.aimZ) * 0.5 + p.vel.y * 0.015;
    sg.rotation.z = -p.vel.x * 0.03 + p.rollAngle;

    // 噴射の揺らぎ
    const boost = p.rollT > 0;
    const fl = (boost ? 1.8 : 1) * (0.8 + Math.random() * 0.45);
    ship.flames[0].scale.set(1, 1, fl);
    ship.flames[1].scale.set(1, 1, fl);
    ship.flameMat.color.setHex(boost ? 0x9fdcff : 0xff9a3c);
    g.fx.trail(p.pos.x + (Math.random() < 0.5 ? -0.6 : 0.6), p.pos.y - 0.1, p.pos.z + 2.6, boost);

    // 無敵中は点滅、シールドの表示
    p.invuln = Math.max(0, p.invuln - dt);
    outer.visible = p.invuln <= 0 || Math.floor(p.invuln * 18) % 2 === 0;
    ship.shield.visible = p.shield > 0;
    if (p.shield > 0) {
      ship.shield.rotation.y += dt * 1.5;
      ship.shield.material.opacity = 0.25 + 0.1 * p.shield + Math.sin(g.time * 6) * 0.08;
    }

    // 射撃
    p.fireCd -= dt;
    if (c.fire && p.fireCd <= 0) {
      p.fireCd = FIRE_INTERVAL[p.rapid];
      const angles = SPREAD[p.spread];
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i];
        const cs = Math.cos(a), sn = Math.sin(a);
        // 照準方向を y 軸まわりに a だけ回す（横に広がる拡散弾）
        const dx = c.aimX * cs + c.aimZ * sn;
        const dz = -c.aimX * sn + c.aimZ * cs;
        const col = a === 0 ? 0x7ff3ff : 0x8affb0;
        g.bullets.firePlayer(p.pos.x, p.pos.y, p.pos.z - 2, dx, c.aimY, dz, BULLET_SPEED, col);
      }
      g.sfx.shot();
    }
  };

  /** 撃墜演出用に非表示 */
  p.kill = () => {
    p.dead = true;
    outer.visible = false;
  };

  p.reset();
  return p;
}
