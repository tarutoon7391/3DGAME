// 演出：足音の波紋・キラキラ粒子・画面揺れ・「！」「？」アイコン用テクスチャ（すべてプール再利用）
import * as THREE from 'three';

const RIPPLES = 28;
const SPARKS = 160;

function makeIconTexture(ch, bg, fg) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = bg;
  g.beginPath();
  g.arc(32, 32, 28, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#000a';
  g.stroke();
  g.fillStyle = fg;
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, 32, 35);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFx(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // 波紋
  const ringGeo = new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2);
  const ripples = [];
  for (let i = 0; i < RIPPLES; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const m = new THREE.Mesh(ringGeo, mat);
    m.visible = false;
    m.renderOrder = 3;
    root.add(m);
    ripples.push({ m, t: 0, dur: 1, r: 1 });
  }
  let rippleNext = 0;

  // 粒子
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkCol = new Float32Array(SPARKS * 3);
  const sparkVel = new Float32Array(SPARKS * 3);
  const sparkLife = new Float32Array(SPARKS);
  sparkPos.fill(-999);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false;
  root.add(sparks);
  let sparkNext = 0;

  let shakeAmt = 0;
  const shakeOff = new THREE.Vector3();
  const col = new THREE.Color();

  const icons = {
    alert: makeIconTexture('!', '#ff3b30', '#fff'),
    question: makeIconTexture('?', '#ffcc00', '#222'),
  };

  return {
    icons,
    shakeOff,
    /** 波紋：(x,z) から半径 radius まで広がる */
    ripple(x, z, radius, color = 0xffffff, dur = 0.8) {
      const p = ripples[rippleNext];
      rippleNext = (rippleNext + 1) % RIPPLES;
      p.t = 0;
      p.dur = dur;
      p.r = Math.max(0.3, radius);
      p.m.visible = true;
      p.m.position.set(x, 0.06, z);
      p.m.material.color.setHex(color);
    },
    sparkle(x, y, z, color = 0xffd54f, n = 30, speed = 3) {
      col.setHex(color);
      for (let i = 0; i < n; i++) {
        const k = sparkNext;
        sparkNext = (sparkNext + 1) % SPARKS;
        sparkPos[k * 3] = x;
        sparkPos[k * 3 + 1] = y;
        sparkPos[k * 3 + 2] = z;
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        sparkVel[k * 3] = Math.cos(a) * s;
        sparkVel[k * 3 + 1] = 1 + Math.random() * speed;
        sparkVel[k * 3 + 2] = Math.sin(a) * s;
        sparkCol[k * 3] = col.r;
        sparkCol[k * 3 + 1] = col.g;
        sparkCol[k * 3 + 2] = col.b;
        sparkLife[k] = 0.6 + Math.random() * 0.6;
      }
    },
    shake(a) {
      shakeAmt = Math.max(shakeAmt, a);
    },
    update(dt) {
      for (const p of ripples) {
        if (!p.m.visible) continue;
        p.t += dt;
        const k = p.t / p.dur;
        if (k >= 1) { p.m.visible = false; continue; }
        const s = p.r * (0.15 + 0.85 * Math.sqrt(k));
        p.m.scale.set(s, 1, s);
        p.m.material.opacity = 0.7 * (1 - k);
      }
      let any = false;
      for (let k = 0; k < SPARKS; k++) {
        if (sparkLife[k] <= 0) continue;
        any = true;
        sparkLife[k] -= dt;
        if (sparkLife[k] <= 0) { sparkPos[k * 3 + 1] = -999; continue; }
        sparkVel[k * 3 + 1] -= 6 * dt;
        sparkPos[k * 3] += sparkVel[k * 3] * dt;
        sparkPos[k * 3 + 1] = Math.max(0.05, sparkPos[k * 3 + 1] + sparkVel[k * 3 + 1] * dt);
        sparkPos[k * 3 + 2] += sparkVel[k * 3 + 2] * dt;
      }
      if (any) sparkGeo.attributes.position.needsUpdate = true;
      if (any) sparkGeo.attributes.color.needsUpdate = true;
      shakeAmt = Math.max(0, shakeAmt - dt * 1.8);
      shakeOff.set((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
    },
    reset() {
      for (const p of ripples) p.m.visible = false;
      sparkLife.fill(0);
      for (let k = 0; k < SPARKS; k++) sparkPos[k * 3 + 1] = -999;
      sparkGeo.attributes.position.needsUpdate = true;
      shakeAmt = 0;
    },
  };
}
