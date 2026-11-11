// 一人称のビューモデル（画面右下の腕と武器）。カメラの子として置き、
// 最後に描く（深度を消してから描く）ので、壁に近づいても欠けたりめり込んだりしない
//
// 腕は「右手」「左手（両手の拳の職業だけ）」「影分身の薄い左手」の3本。どれも 位置のずれ（off）→ 肩（pivot）→ 手 → 持ち方（holder）→ ひねり（twist）→ 武器
// 振り方は武器の style（src/weaponmodel.js）で変わる。技ごとの特別な動きは p.vmAnim = { kind, t, dur }（jobs.js から）
import * as THREE from 'three';
import { PLAYER } from './data/player.js';
import { VIEW } from './data/view.js';
import { DEFAULT_JOB } from './data/jobs.js';
import { buildWeapon, HOLD_ROT, HOLD_POS } from './weaponmodel.js';
import { animateSpecial } from './vmanim.js';

const ORDER = 10000; // 透明物よりも後に描く
const LEFT_X = -0.72; // 左手の肩（右手の肩から見た位置）
const GHOST_DELAY = 0.12; // 分身の追い打ち（combat.js）と同じ遅れ

function vmMat(color, extra = {}) {
  // transparent にして描画順を最後へ回す（不透明度は 1 のまま、深度は書く）
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true, transparent: true, opacity: 1, depthWrite: true, ...extra });
}
const ghostMat = (color) => new THREE.MeshBasicMaterial({
  color: new THREE.Color(color).lerp(new THREE.Color(0xb388ff), 0.65), transparent: true, opacity: 0.38,
  depthWrite: false, blending: THREE.AdditiveBlending,
});
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (k) => 1 - (1 - k) * (1 - k);
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
/** 動きの1つ分（腕ごと）。x は負で画面の中央寄り */
const pose = () => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, twist: 0, aim: false }); // aim：武器を前へ向けて構える（槍）
const AIM_ROT = [-1.5, 0.12, 0]; // 槍を前へ向けたときの持ち方

export function createViewModel(renderer, camera) {
  const root = new THREE.Group(); // カメラ基準の位置
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
  const ghostArmMat = ghostMat(0x7e57c2);
  mats.push(armorMat, skinMat, ghostArmMat);

  /** 腕を1本作る（肩から前へ 0.42m、その先に手） */
  function makeArm(armMat, handMat, baseX, baseY, baseZ) {
    const off = new THREE.Group();
    off.position.set(baseX, baseY, baseZ);
    root.add(off);
    const pivot = new THREE.Group();
    off.add(pivot);
    add(new THREE.BoxGeometry(0.11, 0.11, 0.42), armMat, 0, 0, -0.19, pivot);
    const hand = new THREE.Group();
    hand.position.set(0, 0, -0.42);
    pivot.add(hand);
    const handMesh = add(new THREE.BoxGeometry(0.1, 0.1, 0.1), handMat, 0, 0, 0, hand);
    const holder = new THREE.Group();
    hand.add(holder);
    const twist = new THREE.Group();
    holder.add(twist);
    return { off, pivot, handMesh, holder, twist, base: [baseX, baseY, baseZ], weapon: null };
  }
  const R = makeArm(armorMat, skinMat, 0, 0, 0);
  const L = makeArm(armorMat, skinMat, LEFT_X, 0, 0);
  const Gh = makeArm(ghostArmMat, ghostArmMat, -0.3, 0.03, 0.05); // 影分身の薄い左手
  L.off.visible = false;
  Gh.off.visible = false;

  let weapon = null; // 右手の武器 { group, style, dual, flashMats, mats }
  let flashMats = [];
  let weaponId = '';
  const setFlash = (hex) => {
    for (const m of flashMats) m.emissive.setHex(hex);
  };

  /** 腕に武器を持たせる。mirror：左手（左右反転の持ち方） */
  function arm(A, jobId, colors, makeMat, mirror) {
    if (A.weapon) {
      A.twist.remove(A.weapon.group);
      A.weapon.mats.forEach((m) => m.dispose()); // 形（geometry）は weaponmodel.js で使い回すので消さない
    }
    A.weapon = buildWeapon(jobId, colors, makeMat);
    A.weapon.group.traverse((o) => {
      if (!o.isMesh) return;
      o.renderOrder = ORDER + 1;
      o.frustumCulled = false;
    });
    if (mirror) A.weapon.group.scale.x *= -1;
    A.twist.add(A.weapon.group);
    const r = A.weapon.rot || HOLD_ROT[A.weapon.hold] || HOLD_ROT.up;
    const hp = A.weapon.pos || HOLD_POS[A.weapon.hold] || HOLD_POS.up;
    A.holder.rotation.set(r[0], mirror ? -r[1] : r[1], mirror ? -r[2] : r[2]);
    A.baseRot = A.holder.rotation.clone();
    A.holder.position.set(mirror ? -hp[0] : hp[0], hp[1], hp[2]);
    A.handMesh.visible = A.weapon.hold !== 'fist'; // 籠手・爪は手にかぶせる
    return A.weapon;
  }
  function equip(jobId, lk, accent) {
    const colors = { metal: lk.swordColor, accent, armor: lk.armorColor };
    weapon = arm(R, jobId, colors, vmMat, false);
    if (weapon.dual) arm(L, jobId, colors, vmMat, true);
    L.off.visible = weapon.dual;
    arm(Gh, jobId, colors, (c) => ghostMat(c), true);
    flashMats = weapon.flashMats;
    weaponId = jobId;
  }
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
  // 見切りのときだけ見える、左下の鞘
  const sheath = new THREE.Group();
  sheath.position.set(-0.42, -0.2, -0.38);
  sheath.rotation.set(-1.2, 0, 0.9);
  root.add(sheath);
  const sheathMat = vmMat(0x212121);
  const sheathTrim = vmMat(0xb71c1c);
  mats.push(sheathMat, sheathTrim);
  add(new THREE.BoxGeometry(0.06, 0.62, 0.04), sheathMat, 0, 0.31, 0, sheath);
  add(new THREE.BoxGeometry(0.075, 0.05, 0.055), sheathTrim, 0, 0.02, 0, sheath);
  add(new THREE.BoxGeometry(0.075, 0.03, 0.055), sheathTrim, 0, 0.3, 0, sheath);
  sheath.visible = false;
  let sheathVis = false;
  const history = []; // 右手の動きの記録（影分身の手が少し遅れてまねる）
  let clock = 0;

  /** 突き（槍・拳）：構えて引き → 一気に前へ → 戻す。actT は今の段の経過、hit は当たる瞬間 */
  function thrust(P, actT, hit, dur, reach) {
    if (actT < hit) {
      const k = actT / hit;
      P.z += 0.08 * ease(clamp01(k / 0.6)) - (0.08 + reach) * smooth(0.6, 1, k);
    } else {
      const r = clamp01((actT - hit) / Math.max(0.05, dur - hit));
      P.z += -reach * (1 - ease(r) * 0.85);
    }
  }
  const guard = (P) => {
    // 両手の拳の構え（胸の前に上げる）
    P.x -= 0.1;
    P.y += 0.14;
    P.z += 0.1;
    P.rx += 0.35;
  };

  /** 右手・左手の動きを決める */
  function animate(p, dt, Rp, Lp) {
    const style = weapon?.style || 'swing';
    const a = p.action;
    const combo = p.job?.basic.combo;
    if (style === 'fist2') {
      guard(Rp);
      guard(Lp);
    }
    if (a === 'attack' && combo) {
      const c = combo[p.combo] || combo[0];
      const last = p.combo === combo.length - 1;
      const k = Math.min(1, p.actT / (c.hit * 1.8)); // 当たりの少し後まで振り切る
      const e = ease(k);
      if (p.waveT > 0) {
        // 衝撃波：前へ突き出して振り下ろす
        const w = 1 - p.waveT / 0.4;
        Rp.z -= Math.sin(w * Math.PI) * 0.15;
        Rp.rx = 0.5 - w * 1.4;
        setFlash(0x2a6f8f);
      } else if (style === 'thrust') {
        // 槍：前へまっすぐ突く。3段目は深く突き込み、槍をひねって光らせる
        Rp.aim = true;
        Rp.rx = 0.08;
        Rp.ry = 0.12;
        Rp.x -= 0.06;
        Rp.y += 0.02;
        thrust(Rp, p.actT, c.hit, c.dur, last ? 0.5 : 0.32);
        if (last) {
          Rp.twist = e * Math.PI * 2;
          Rp.rz = Math.sin(e * Math.PI) * 0.25;
          setFlash(p.actT < c.hit * 1.6 ? 0x5a4a20 : 0x000000);
        }
      } else if (style === 'fist2') {
        // 格闘家：右・左・右・左・右と交互に突く（5段目は強く）
        const P = p.combo % 2 === 0 ? Rp : Lp;
        P.rx -= 0.35;
        P.x -= 0.04;
        thrust(P, p.actT, c.hit, c.dur, last ? 0.55 : 0.4);
        if (last) setFlash(p.actT < c.hit * 1.5 ? 0x5a3a10 : 0x000000);
      } else if (last) {
        // 最後の段：振りかぶって真上から振り下ろし（斧は刃を縦に、鎌も縦に）
        Rp.rx = 0.7 - e * 1.6;
        Rp.x -= 0.1 * e;
        if (style === 'axe' || style === 'scythe') Rp.twist = Math.PI / 2;
      } else {
        // 横に薙ぐ（1段目は右→左、2段目は左→右）。鎌は1段目だけ刃を反転
        const dir = p.combo % 2 === 0 ? 1 : -1;
        Rp.ry = -dir * (0.6 - e * 1.4);
        Rp.rx = -1.05;
        Rp.rz = dir * 0.5;
        Rp.y += 0.24;
        Rp.x -= 0.16;
        if (style === 'scythe' && p.combo === 0) Rp.twist = Math.PI;
      }
    } else if ((a === 'shoot' || a === 'cast' || (a !== 'attack' && p.waveT > 0)) && !p.vmAnim) {
      // 飛び道具・詠唱：武器を前へ突き出す
      const w = a === 'cast' ? Math.min(1, p.actT / (p.actDur || 0.4)) : 1 - Math.max(0, p.waveT) / 0.25;
      Rp.z -= Math.sin(Math.min(1, w) * Math.PI) * 0.12;
      Rp.rx += a === 'cast' ? 0.6 - w * 0.4 : -0.3;
      setFlash(0x2a3f6f);
    } else if (a === 'dash') {
      // 突進：低く構えて突き抜ける（槍は前へ構える）
      Rp.rx = style === 'thrust' ? 0.05 : -1.2;
      Rp.y -= 0.08;
      if (style === 'thrust') {
        Rp.aim = true;
        Rp.z -= 0.2;
      }
      spinVis = 1;
    } else if (a === 'spin') {
      // 回転斬り：真右から真左まで 180 度、画面を大きく横切って薙ぐ
      const k = ease(Math.min(1, p.actT / (p.actDur || 0.5)));
      Rp.ry = -Math.PI / 2 + k * Math.PI;
      Rp.rx = -1.15;
      Rp.rz = 0.45;
      Rp.y += 0.2;
      Rp.x -= 0.3;
      if (p.vmAnim?.kind === 'spinflip') Rp.twist = Math.PI; // 魂刈り：鎌を反転させて振る
      spinVis = 1;
    } else if (a === 'dodge') {
      // 回避：腕を引いて沈む
      const k = Math.sin(Math.min(1, p.actT / PLAYER.dodgeTime) * Math.PI);
      for (const P of [Rp, Lp]) {
        P.y -= 0.12 * k;
        P.x += 0.06 * k;
        P.rz -= 0.5 * k;
      }
    }

    // ---- 技ごとの特別な動き（src/vmanim.js） ----
    const V = p.vmAnim;
    sheathVis = false;
    if (V) {
      V.t += dt;
      const r = animateSpecial(V, clamp01(V.t / V.dur), Rp, Lp, setFlash);
      if (r?.spin) spinVis = 1;
      sheathVis = !!r?.sheath;
      if (V.t >= V.dur) p.vmAnim = null;
    }
  }

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
      root.position.set(
        V.x + swayX + Math.cos(ph) * V.sway * walk * bobOn,
        V.y + swayY - Math.abs(Math.sin(ph)) * V.sway * walk * bobOn,
        V.z,
      );
      const Rp = pose();
      const Lp = pose();
      for (const P of [Rp, Lp]) {
        if (p.dashing) { P.y -= 0.06; P.rx = -0.35; P.rz = -0.15; } // ダッシュ：武器を下げて構える
        if (p.tired) { P.y -= 0.1; P.rx -= 0.25; } // バテ：腕が下がる
        if (p.hurtT > 0) { const k = p.hurtT / 0.3; P.y -= 0.05 * k; P.rx += 0.4 * k; }
      }
      setFlash(spinVis > 0 ? 0x1f4f6f : 0x000000); // 光らせる動きは animate の中で上書き
      animate(p, dt, Rp, Lp);
      // 矢の雨など：真上へ向けて放つ（p.aimUpT 秒）
      if (p.aimUpT > 0) {
        const k = Math.sin(Math.min(1, 1 - p.aimUpT / 0.45) * Math.PI);
        Rp.rx += 1.15 * k;
        Rp.y += 0.1 * k;
        p.aimUpT -= dt;
      }
      spinVis = Math.max(0, spinVis - dt * 4);
      // 右手
      R.off.position.set(Rp.x, Rp.y, Rp.z);
      R.pivot.rotation.set(Rp.rx, Rp.ry, Rp.rz, 'YXZ');
      R.twist.rotation.y = Rp.twist;
      sheath.visible = sheathVis;
      if (Rp.aim) R.holder.rotation.set(AIM_ROT[0], AIM_ROT[1], AIM_ROT[2]);
      else if (R.baseRot) R.holder.rotation.copy(R.baseRot);
      // 左手（両手の拳の職業だけ）。左右反転して置く
      if (L.off.visible) {
        L.off.position.set(LEFT_X - Lp.x, Lp.y, Lp.z);
        L.pivot.rotation.set(Lp.rx, -Lp.ry, -Lp.rz, 'YXZ');
        L.twist.rotation.y = -Lp.twist;
      }
      // 影分身：左の薄い手が少し遅れて、右手と左右反転の同じ動きをする
      clock += dt;
      history.push({ t: clock, ...Rp });
      while (history.length > 2 && history[1].t <= clock - GHOST_DELAY) history.shift();
      const clone = p.buffs?.clone;
      Gh.off.visible = !!(clone && clone.t > 0);
      if (Gh.off.visible) {
        const h = history[0];
        Gh.off.position.set(-0.3 - h.x, 0.03 + h.y, 0.05 + h.z);
        Gh.pivot.rotation.set(h.rx, -h.ry, -h.rz, 'YXZ');
        Gh.twist.rotation.y = -h.twist;
        const o = 0.3 + 0.12 * Math.sin(clock * 6);
        ghostArmMat.opacity = o;
        Gh.weapon?.mats.forEach((m) => (m.opacity = o));
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
      for (const A of [R, L, Gh]) A.weapon?.mats.forEach((m) => m.dispose());
    },
  };
  return vm;
}
