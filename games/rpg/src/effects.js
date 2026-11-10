// 演出：パーティクル（InstancedMesh）・ダメージ数字・画面揺れ・ヒットストップ・攻撃の予兆表示
import * as THREE from 'three';

const MAX_P = 500;

export function createEffects(scene, camera) {
  // ---- パーティクル ----
  const pGeo = new THREE.BoxGeometry(1, 1, 1);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pMesh = new THREE.InstancedMesh(pGeo, pMat, MAX_P);
  pMesh.frustumCulled = false;
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const P = {
    x: new Float32Array(MAX_P), y: new Float32Array(MAX_P), z: new Float32Array(MAX_P),
    vx: new Float32Array(MAX_P), vy: new Float32Array(MAX_P), vz: new Float32Array(MAX_P),
    life: new Float32Array(MAX_P), max: new Float32Array(MAX_P), size: new Float32Array(MAX_P), grav: new Float32Array(MAX_P),
  };
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX_P; i++) {
    pMesh.setMatrixAt(i, zero);
    pMesh.setColorAt(i, col.setHex(0xffffff));
  }
  scene.add(pMesh);
  let pNext = 0;

  /** 粒を飛ばす */
  function burst(x, y, z, color, n = 12, { speed = 4, up = 3, life = 0.6, size = 0.15, grav = 9 } = {}) {
    col.setHex(color);
    for (let k = 0; k < n; k++) {
      const i = pNext;
      pNext = (pNext + 1) % MAX_P;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      P.x[i] = x; P.y[i] = y; P.z[i] = z;
      P.vx[i] = Math.cos(a) * sp;
      P.vz[i] = Math.sin(a) * sp;
      P.vy[i] = up * (0.4 + Math.random() * 0.8);
      P.max[i] = P.life[i] = life * (0.6 + Math.random() * 0.6);
      P.size[i] = size * (0.6 + Math.random() * 0.8);
      P.grav[i] = grav;
      pMesh.setColorAt(i, col);
    }
    pMesh.instanceColor.needsUpdate = true;
  }

  // ---- ダメージ数字（DOM プール） ----
  const layer = document.createElement('div');
  layer.className = 'rpg-dmg-layer';
  document.body.appendChild(layer);
  const texts = [];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'rpg-dmg';
    el.style.display = 'none';
    layer.appendChild(el);
    texts.push({ el, life: 0, x: 0, y: 0, z: 0 });
  }
  let tNext = 0;
  const v3 = new THREE.Vector3();
  function text(x, y, z, str, color = '#fff', big = false) {
    const t = texts[tNext];
    tNext = (tNext + 1) % texts.length;
    t.x = x + (Math.random() - 0.5) * 0.4; t.y = y; t.z = z;
    t.life = 0.9;
    t.el.textContent = str;
    t.el.style.color = color;
    t.el.style.fontSize = big ? '26px' : '19px';
    t.el.style.display = 'block';
  }

  // ---- 予兆表示（地面の赤い図形） ----
  const teleMatOuter = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const teleMatInner = new THREE.MeshBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  const teleGeos = new Map();
  function teleGeo(kind, arc) {
    const key = kind + (arc ? arc.toFixed(2) : '');
    let g = teleGeos.get(key);
    if (g) return g;
    if (kind === 'circle') g = new THREE.CircleGeometry(1, 36);
    else if (kind === 'sector') g = new THREE.CircleGeometry(1, 28, -Math.PI / 2 - arc / 2, arc);
    else {
      g = new THREE.PlaneGeometry(1, 1);
      g.translate(0, 0.5, 0);
    }
    if (kind === 'rect') g.rotateX(Math.PI / 2);
    else g.rotateX(-Math.PI / 2);
    teleGeos.set(key, g);
    return g;
  }
  const teles = [];
  /**
   * 予兆を出す。kind: circle(r) / sector(r, arc) / rect(len, width)。angle は向き（ヨー）
   * 戻り値の handle.follow(x,z,angle) で追従、handle.end() で消す。dur 経過で自動で消える
   */
  function telegraph(kind, { x, z, r = 1, arc = 0, len = 1, width = 1, angle = 0, dur = 1 }) {
    let t = teles.find((o) => !o.active && o.kind === kind && o.arc === arc);
    if (!t) {
      const g = teleGeo(kind, arc);
      t = { kind, arc, outer: new THREE.Mesh(g, teleMatOuter), inner: new THREE.Mesh(g, teleMatInner), active: false };
      t.outer.renderOrder = 2;
      t.inner.renderOrder = 3;
      scene.add(t.outer, t.inner);
      teles.push(t);
    }
    t.active = true;
    t.t = 0;
    t.dur = dur;
    t.sx = kind === 'rect' ? width : r;
    t.sz = kind === 'rect' ? len : r;
    t.outer.visible = t.inner.visible = true;
    t.outer.scale.set(t.sx, 1, t.sz);
    const handle = {
      follow(nx, nz, na = angle) {
        t.x = nx;
        t.z = nz;
        t.angle = na;
        t.outer.position.set(nx, 0.04, nz);
        t.inner.position.set(nx, 0.05, nz);
        t.outer.rotation.y = t.inner.rotation.y = na;
      },
      end() {
        t.active = false;
        t.outer.visible = t.inner.visible = false;
      },
    };
    t.handle = handle;
    handle.follow(x, z, angle);
    return handle;
  }

  /** (x,z) がいま出ている予兆の範囲内か（一人称で足元の予兆が見えないときの警告用） */
  function danger(x, z, pad = 0.4) {
    for (const t of teles) {
      if (!t.active) continue;
      const dx = x - t.x;
      const dz = z - t.z;
      if (t.kind === 'circle') {
        if (dx * dx + dz * dz < (t.sx + pad) ** 2) return true;
      } else if (t.kind === 'sector') {
        const d = Math.hypot(dx, dz);
        if (d > t.sx + pad) continue;
        let da = Math.atan2(dx, dz) - t.angle;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (d < pad + 0.6 || Math.abs(da) < t.arc / 2) return true;
      } else {
        const s = Math.sin(t.angle);
        const c = Math.cos(t.angle);
        const along = dx * s + dz * c;
        const side = dx * c - dz * s;
        if (along > -pad && along < t.sz + pad && Math.abs(side) < t.sx / 2 + pad) return true;
      }
    }
    return false;
  }

  const teleBase = { outer: teleMatOuter.opacity, inner: teleMatInner.opacity };
  /** 予兆の濃さ（一人称では濃くする）。null で元に戻す */
  function setTeleOpacity(o) {
    teleMatOuter.opacity = o ? o.outer : teleBase.outer;
    teleMatInner.opacity = o ? o.inner : teleBase.inner;
  }

  // ---- 画面揺れ・ヒットストップ ----
  let shakeAmt = 0;
  let stop = 0;
  const shakeOffset = new THREE.Vector3();

  function update(dt) {
    // パーティクル
    for (let i = 0; i < MAX_P; i++) {
      if (P.life[i] <= 0) continue;
      P.life[i] -= dt;
      if (P.life[i] <= 0) {
        pMesh.setMatrixAt(i, zero);
        continue;
      }
      P.vy[i] -= P.grav[i] * dt;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      P.z[i] += P.vz[i] * dt;
      if (P.y[i] < 0.05) {
        P.y[i] = 0.05;
        P.vy[i] *= -0.3;
        P.vx[i] *= 0.7;
        P.vz[i] *= 0.7;
      }
      const s = P.size[i] * (P.life[i] / P.max[i]);
      dummy.position.set(P.x[i], P.y[i], P.z[i]);
      dummy.rotation.set(P.life[i] * 5, P.life[i] * 3, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      pMesh.setMatrixAt(i, dummy.matrix);
    }
    pMesh.instanceMatrix.needsUpdate = true;
    // 文字
    for (const t of texts) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.y += dt * 1.6;
      if (t.life <= 0) {
        t.el.style.display = 'none';
        continue;
      }
      v3.set(t.x, t.y, t.z).project(camera);
      if (v3.z > 1) {
        t.el.style.display = 'none';
        continue;
      }
      t.el.style.display = 'block';
      t.el.style.transform = `translate(${((v3.x + 1) / 2) * innerWidth}px, ${((1 - v3.y) / 2) * innerHeight}px) translate(-50%,-50%)`;
      t.el.style.opacity = String(Math.min(1, t.life * 2.5));
    }
    // 予兆
    for (const t of teles) {
      if (!t.active) continue;
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      if (t.kind === 'rect') t.inner.scale.set(t.sx, 1, t.sz * k);
      else t.inner.scale.set(t.sx * k, 1, t.sz * k);
      if (t.t > t.dur + 0.15) t.handle.end();
    }
    // 揺れ
    shakeAmt = Math.max(0, shakeAmt - dt * 2.2);
    const a = shakeAmt * shakeAmt * 0.8;
    shakeOffset.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
  }

  /** 全部消す（エリア遷移時） */
  function clear() {
    for (let i = 0; i < MAX_P; i++) {
      P.life[i] = 0;
      pMesh.setMatrixAt(i, zero);
    }
    pMesh.instanceMatrix.needsUpdate = true;
    texts.forEach((t) => { t.life = 0; t.el.style.display = 'none'; });
    teles.forEach((t) => t.active && t.handle.end());
    shakeAmt = 0;
  }

  return {
    burst,
    text,
    telegraph,
    danger,
    setTeleOpacity,
    update,
    clear,
    shakeOffset,
    shake(v) { shakeAmt = Math.min(1.2, Math.max(shakeAmt, v)); },
    hitstop(sec) { stop = Math.max(stop, sec); },
    /** ヒットストップ中なら残りを減らして true */
    consumeStop(dt) {
      if (stop <= 0) return false;
      stop -= dt;
      return true;
    },
  };
}
