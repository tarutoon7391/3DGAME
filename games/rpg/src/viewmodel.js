// 一人称のビューモデル（画面右下の腕と剣）。カメラの子として置き、
// 最後に描く（深度を消してから描く）ので、壁に近づいても欠けたりめり込んだりしない
import * as THREE from 'three';
import { PLAYER } from './data/player.js';
import { VIEW } from './data/view.js';
import { DEFAULT_JOB } from './data/jobs.js';
import { buildWeapon, HOLD_ROT, HOLD_POS } from './weaponmodel.js';

const ORDER = 10000; // 透明物よりも後に描く

function vmMat(color, extra = {}) {
  // transparent にして描画順を最後へ回す（不透明度は 1 のまま、深度は書く）
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true, transparent: true, opacity: 1, depthWrite: true, ...extra });
}

export function createViewModel(renderer, camera) {
  const root = new THREE.Group(); // カメラ基準の位置
  const pivot = new THREE.Group(); // 振りの回転の中心（肩）
  root.add(pivot);
  camera.add(root);

  const mats = [];
  const geos = [];
  const add = (geo, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.renderOrder = ORDER + 1;
    m.frustumCulled = false;
    parent.add(m);
    geos.push(geo);
    return m;
  };
  const look = PLAYER.look;
  const armorMat = vmMat(look.armorColor);
  const skinMat = vmMat(0xf1c27d);
  mats.push(armorMat, skinMat);

  // 腕（肩から前へ）と手。武器は職業ごとに src/weaponmodel.js で組み立てて手に持たせる
  // pivot は肩。腕は肩から前へ 0.42m、その先に手
  add(new THREE.BoxGeometry(0.11, 0.11, 0.42), armorMat, 0, 0, -0.19, pivot);
  const hand = new THREE.Group();
  hand.position.set(0, 0, -0.42);
  pivot.add(hand);
  const handMesh = add(new THREE.BoxGeometry(0.1, 0.1, 0.1), skinMat, 0, 0, 0, hand);
  const holder = new THREE.Group(); // 武器の向き（持ち方で変わる）
  hand.add(holder);
  let weapon = null; // { group, flashMats, mats }
  let flashMats = [];
  let weaponId = '';
  const setFlash = (hex) => {
    for (const m of flashMats) m.emissive.setHex(hex);
  };
  function equip(jobId, lk, accent) {
    if (weapon) {
      holder.remove(weapon.group);
      weapon.mats.forEach((m) => m.dispose()); // 形（geometry）は weaponmodel.js で使い回すので消さない
    }
    weapon = buildWeapon(jobId, { metal: lk.swordColor, accent, armor: lk.armorColor }, vmMat);
    weapon.group.traverse((o) => {
      if (!o.isMesh) return;
      o.renderOrder = ORDER + 1;
      o.frustumCulled = false;
    });
    holder.add(weapon.group);
    const r = weapon.rot || HOLD_ROT[weapon.hold] || HOLD_ROT.up;
    holder.rotation.set(r[0], r[1], r[2]);
    const hp = weapon.pos || HOLD_POS[weapon.hold] || HOLD_POS.up;
    holder.position.set(hp[0], hp[1], hp[2]);
    handMesh.visible = weapon.hold !== 'fist'; // 籠手・爪は手にかぶせる
    if (ghostWeapon) {
      ghostHolder.remove(ghostWeapon.group);
      ghostWeapon.mats.forEach((m) => m.dispose());
    }
    ghostWeapon = buildWeapon(jobId, { metal: lk.swordColor, accent, armor: lk.armorColor }, (c) => ghostMat(c));
    ghostWeapon.group.traverse((o) => {
      if (!o.isMesh) return;
      o.renderOrder = ORDER + 1;
      o.frustumCulled = false;
    });
    ghostHolder.add(ghostWeapon.group);
    ghostHolder.rotation.set(r[0], -r[1], -r[2]); // 左手なので左右反転
    ghostHolder.position.set(-hp[0], hp[1], hp[2]);
    ghostHandMesh.visible = handMesh.visible;
    flashMats = weapon.flashMats;
    weaponId = jobId;
  }
  // ---- 影分身中だけ出る、左側の薄い手（本体より少し遅れて同じ動きをする＝2回攻撃） ----
  const ghostRoot = new THREE.Group();
  ghostRoot.position.set(-0.3, 0.03, 0.05);
  ghostRoot.visible = false;
  root.add(ghostRoot);
  const ghostPivot = new THREE.Group();
  ghostRoot.add(ghostPivot);
  const ghostMat = (color) => new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color(0xb388ff), 0.65), transparent: true, opacity: 0.38,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const ghostArmMat = ghostMat(0x7e57c2);
  mats.push(ghostArmMat);
  add(new THREE.BoxGeometry(0.11, 0.11, 0.42), ghostArmMat, 0, 0, -0.19, ghostPivot);
  const ghostHand = new THREE.Group();
  ghostHand.position.set(0, 0, -0.42);
  ghostPivot.add(ghostHand);
  const ghostHandMesh = add(new THREE.BoxGeometry(0.1, 0.1, 0.1), ghostArmMat, 0, 0, 0, ghostHand);
  const ghostHolder = new THREE.Group();
  ghostHand.add(ghostHolder);
  let ghostWeapon = null;
  const history = []; // 本体の腕の向きの記録 [{ t, rx, ry, rz }]
  let clock = 0;
  const GHOST_DELAY = 0.12; // 分身の追い打ち（combat.js）と同じ遅れ

  equip(DEFAULT_JOB, look, 0xffd54f);

  // 深度を消すための見えない板（ビューモデルより先に描かれる）
  const clearMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false, colorWrite: false });
  mats.push(clearMat);
  const clearer = add(new THREE.PlaneGeometry(0.01, 0.01), clearMat, 0, 0, -0.5, root);
  clearer.renderOrder = ORDER;
  clearer.onBeforeRender = (r) => {
    r.state.buffers.depth.setMask(true);
    r.clearDepth();
  };

  let swayX = 0;
  let swayY = 0;
  let spinVis = 0;

  const vm = {
    visible: true,
    setVisible(v) {
      vm.visible = v;
      root.visible = v;
    },
    /** p：プレイヤー、rig：カメラ（マウスの動き） */
    update(dt, p, rig) {
      if (!vm.visible) return;
      const V = VIEW.vm;
      // マウスを動かすと少し遅れてついてくる
      swayX += (-rig.lastDx * VIEW.vm.lookLag - swayX) * Math.min(1, dt * 10);
      swayY += (rig.lastDy * VIEW.vm.lookLag - swayY) * Math.min(1, dt * 10);
      // 歩き・ダッシュ・バテの揺れ（VIEW.bob が 0 なら揺れない）
      const bobOn = VIEW.bob > 0 ? 1 : 0;
      const walk = p.walking ? (p.dashing ? 1.8 : p.tired ? 0.6 : 1) : 0;
      const ph = p.walkPhase;
      let x = V.x + swayX + Math.cos(ph) * V.sway * walk * bobOn;
      let y = V.y + swayY - Math.abs(Math.sin(ph)) * V.sway * walk * bobOn;
      let z = V.z;
      let rx = 0;
      let ry = 0;
      let rz = 0;
      if (p.dashing) { y -= 0.06; rx = -0.35; rz = -0.15; } // ダッシュ：剣を下げて構える
      if (p.tired) { y -= 0.1; rx -= 0.25; } // バテ：腕が下がる
      if (p.hurtT > 0) { const k = p.hurtT / 0.3; y -= 0.05 * k; rx += 0.4 * k; }

      // 行動ごとの振り
      const a = p.action;
      const combo = p.job?.basic.combo;
      if (a === 'attack' && combo) {
        const c = combo[p.combo] || combo[0];
        const k = Math.min(1, p.actT / (c.hit * 1.8)); // 当たりの少し後まで振り切る
        const e = 1 - (1 - k) * (1 - k);
        if (p.waveT > 0) {
          // 衝撃波：前へ突き出して振り下ろす
          const w = 1 - p.waveT / 0.4;
          z -= Math.sin(w * Math.PI) * 0.15;
          rx = 0.5 - w * 1.4;
          setFlash(0x2a6f8f);
        } else if (p.combo === combo.length - 1) {
          // 3段目：振りかぶって真上から振り下ろし
          rx = 0.7 - e * 1.6;
          x -= 0.1 * e;
        } else {
          // 1・2段目：剣先を前へ向けて横に薙ぐ（1段目は右→左、2段目は左→右）
          const dir = p.combo % 2 === 0 ? 1 : -1;
          ry = -dir * (0.6 - e * 1.4);
          rx = -1.05;
          rz = dir * 0.5;
          y += 0.24;
          x -= 0.16;
        }
      } else if (a === 'shoot' || a === 'cast' || (a !== 'attack' && p.waveT > 0)) {
        // 飛び道具・詠唱：武器を前へ突き出す
        const w = a === 'cast' ? Math.min(1, p.actT / (p.actDur || 0.4)) : 1 - Math.max(0, p.waveT) / 0.25;
        z -= Math.sin(Math.min(1, w) * Math.PI) * 0.12;
        rx = a === 'cast' ? 0.6 - w * 0.4 : -0.3;
        setFlash(0x2a3f6f);
      } else if (a === 'dash') {
        // 瞬影斬：低く構えて突き抜ける
        rx = -1.2;
        y -= 0.08;
        spinVis = 1;
      } else if (a === 'spin') {
        // 回転斬り：画面を大きく横切って薙ぐ（カメラ自体は回さない）
        const k = Math.min(1, p.actT / (p.actDur || 0.5));
        ry = -1.0 + k * 3.0;
        rx = -1.1;
        rz = 0.6;
        y += 0.22;
        x -= 0.16;
        spinVis = 1;
      } else if (a === 'dodge') {
        // 回避：腕を引いて沈む
        const k = Math.sin(Math.min(1, p.actT / PLAYER.dodgeTime) * Math.PI);
        y -= 0.12 * k;
        x += 0.06 * k;
        rz -= 0.5 * k;
      }
      // 矢の雨など：真上へ向けて放つ（p.aimUpT 秒）
      if (p.aimUpT > 0) {
        const k = Math.sin(Math.min(1, 1 - p.aimUpT / 0.45) * Math.PI);
        rx += 1.15 * k;
        y += 0.1 * k;
        p.aimUpT -= dt;
      }
      if (p.waveT <= 0 && a !== 'cast') setFlash(spinVis > 0 ? 0x1f4f6f : 0x000000);
      spinVis = Math.max(0, spinVis - dt * 4);
      root.position.set(x, y, z);
      pivot.rotation.set(rx, ry, rz, 'YXZ');
      // 影分身：左の薄い手が少し遅れて同じ動きをする
      clock += dt;
      history.push({ t: clock, rx, ry, rz });
      while (history.length > 2 && history[1].t <= clock - GHOST_DELAY) history.shift();
      const clone = p.buffs?.clone;
      ghostRoot.visible = !!(clone && clone.t > 0);
      if (ghostRoot.visible) {
        const h = history[0];
        ghostPivot.rotation.set(h.rx, -h.ry, -h.rz, 'YXZ'); // 左右反転した動き
        const o = 0.3 + 0.12 * Math.sin(clock * 6);
        ghostArmMat.opacity = o;
        ghostWeapon?.mats.forEach((m) => (m.opacity = o));
      }
    },
    /** 職業の見た目に替える（防具の色と、手に持つ武器） */
    setLook(lk, jobId = DEFAULT_JOB, color = '#ffd54f') {
      armorMat.color.setHex(lk.armorColor);
      if (jobId !== weaponId) equip(jobId, lk, parseInt(String(color).replace('#', ''), 16));
    },
    dispose() {
      camera.remove(root);
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      weapon?.mats.forEach((m) => m.dispose());
      ghostWeapon?.mats.forEach((m) => m.dispose());
    },
  };
  return vm;
}
