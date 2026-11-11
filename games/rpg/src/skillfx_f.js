// 技エフェクト（その6）：竜人と道化師。skillfx.js から呼ぶ
//   breath 竜の息吹（前へ吐き出す炎） / leapFx・leapLand 翼撃（竜の翼で舞い上がって急降下）
//   dragonFormFx 竜化（空から雷 → 光の中で赤い竜に変身。src/dragonform.js）
//   randomFx 手品（帽子から取り出す）・大道芸（両手を上げて紙吹雪） / bigBang 大爆発 / teamHealFx くす玉（赤十字の緑の帯）
//   fireWhirl 大旋風（火のついた桜吹雪の炎の竜巻）
import * as THREE from 'three';
import { geo, glow, hotOf, ease, ringGeo } from './fxkit.js';
import { starTexture, petalTexture, smokeTexture } from './fxtex.js';
import { createDragonForms } from './dragonform.js';

const sprite = (map, color, opacity = 1, additive = true) => new THREE.SpriteMaterial({
  map, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});
const FIRE = [0xfff59d, 0xffca28, 0xff9800, 0xff5722, 0xd84315];
const CONFETTI = [0xff5252, 0xffeb3b, 0x40c4ff, 0x69f0ae, 0xe040fb, 0xffab40, 0xffffff];

/** 赤十字のマーク（白い角丸の四角に赤い十字。そのままの色で描く） */
let crossTex = null;
function crossTexture() {
  if (crossTex) return crossTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.roundRect(6, 6, 52, 52, 12);
  c.fill();
  c.fillStyle = '#e53935';
  c.fillRect(26, 13, 12, 38);
  c.fillRect(13, 26, 38, 12);
  crossTex = new THREE.CanvasTexture(cv);
  crossTex.colorSpace = THREE.SRGBColorSpace;
  return crossTex;
}

/** 竜の翼（片側）：骨と、三角の膜。+X へ広がる */
function wingGeo() {
  return geo('pWing', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(1.6, 0.5);
    s.lineTo(1.4, -0.25);
    s.lineTo(1.0, -0.45);
    s.lineTo(0.7, -0.35);
    s.lineTo(0.35, -0.55);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  });
}

export function createSkillFxF({ game, root, add, mesh }) {
  const fx = () => game.skillFx;
  const dragons = createDragonForms(game);

  function flash(x, y, z, color, size, dur) {
    const m = sprite(starTexture(), color);
    const sp = new THREE.Sprite(m);
    sp.position.set(x, y, z);
    add(sp, dur, (k) => {
      sp.scale.setScalar(size * (0.6 + 0.8 * ease(Math.min(1, k * 3))));
      m.opacity = 1 - k;
    }, [m]);
  }
  /** 画面が白く光る（自分の画面だけ） */
  function whiteout(dur, color = '255,255,255') {
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:6;background:rgb(${color});opacity:0`;
    document.body.appendChild(el);
    add(new THREE.Group(), dur, (k) => {
      el.style.opacity = (k < 0.12 ? k / 0.12 : 1 - Math.max(0, (k - 0.35) / 0.65)).toFixed(2);
      if (k >= 1) el.remove();
    }, []);
  }

  // ---------------- 竜の息吹：前へ吐き出す炎 ----------------
  function breath(p, sk) {
    const big = dragons.active(p);
    const D = big ? 2.0 : 1.4; // 吐き続ける秒
    const LIFE = big ? 0.75 : 0.6;
    const N = big ? 120 : 80;
    const range = (sk.range || 6) * (big ? 1.5 : 1);
    const g = new THREE.Group();
    const parts = [];
    const mats = [];
    for (let i = 0; i < N; i++) {
      const m = sprite(smokeTexture(), FIRE[i % FIRE.length], 0);
      const sp = new THREE.Sprite(m);
      sp.visible = false;
      g.add(sp);
      mats.push(m);
      parts.push({ sp, m, age: 99, v: new THREE.Vector3(), o: new THREE.Vector3(), s: 1 });
    }
    let next = 0;
    let acc = 0;
    const rate = N / LIFE; // 1秒あたりに出す数
    add(g, D + LIFE, (k, dt) => {
      const t = k * (D + LIFE);
      if (t < D) {
        acc += dt * rate;
        const o = big ? dragons.mouth(p) : { x: p.pos.x + Math.sin(p.yaw) * 0.7, y: 1.55 + (p.model?.root?.position.y || 0), z: p.pos.z + Math.cos(p.yaw) * 0.7 };
        while (acc >= 1) {
          acc -= 1;
          const q = parts[next];
          next = (next + 1) % N;
          const a = p.yaw + (Math.random() - 0.5) * (sk.arc || 1.2) * 0.8;
          const sp = range / LIFE;
          q.o.set(o.x, o.y, o.z);
          q.v.set(Math.sin(a) * sp, -(o.y - 0.5) / LIFE + (Math.random() - 0.3) * 1.5, Math.cos(a) * sp);
          q.age = 0;
          q.s = (big ? 1.1 : 0.6) + Math.random() * 0.5;
          q.sp.visible = true;
        }
      }
      for (const q of parts) {
        if (q.age >= LIFE) {
          q.sp.visible = false;
          continue;
        }
        q.age += dt;
        const u = Math.min(1, q.age / LIFE);
        q.sp.position.copy(q.o).addScaledVector(q.v, q.age);
        q.sp.position.y = Math.max(0.3, q.sp.position.y);
        q.sp.scale.setScalar(q.s * (0.4 + 2.6 * u) * (big ? 1.4 : 1));
        q.m.opacity = (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85) * 0.85;
        q.m.rotation += dt * 2;
      }
    }, mats);
    if (big) game.fx?.shake?.(0.3);
  }

  // ---------------- 翼撃：竜の翼が生えて2回羽ばたく ----------------
  function leapFx(p, sk) {
    if (sk.id !== 'wingdash') return;
    const dur = sk.time || 2;
    const rise = sk.rise || dur * 0.6;
    if (dragons.active(p)) {
      dragons.flap(p, rise);
      return;
    }
    const g = new THREE.Group();
    g.position.set(0, 1.55, -0.18);
    const mM = new THREE.MeshLambertMaterial({ color: 0x8d2a0a, emissive: 0x2a0800, side: THREE.DoubleSide, flatShading: true });
    const mB = new THREE.MeshLambertMaterial({ color: 0xbf360c, flatShading: true });
    const wings = [-1, 1].map((side) => {
      const pv = new THREE.Group();
      pv.position.x = side * 0.22;
      const w = mesh(wingGeo(), mM);
      w.scale.set(side, 1, 1);
      const bone = mesh(geo('pWingBone', () => new THREE.BoxGeometry(1.7, 0.07, 0.07).translate(0.85, 0, 0)), mB);
      bone.rotation.z = Math.atan2(0.5, 1.6) * side;
      bone.scale.x = side;
      pv.add(w, bone);
      g.add(pv);
      return { pv, side };
    });
    p.model.root.add(g);
    // 火の粉の帯（羽ばたくたびに）
    add(new THREE.Group(), dur + 0.3, (k) => {
      const t = k * (dur + 0.3);
      const grow = ease(Math.min(1, t / 0.25)) * (1 - Math.max(0, (t - dur) / 0.3));
      g.scale.setScalar(Math.max(0.01, grow) * 1.15);
      // 舞い上がる間に2回大きく羽ばたき、急降下では後ろへたたむ
      const flapK = t < rise ? Math.sin((t / rise) * Math.PI * 4 - Math.PI / 2) : 1;
      const fold = t < rise ? 0 : Math.min(1, (t - rise) / 0.2);
      for (const w of wings) {
        w.pv.rotation.z = w.side * (0.15 + 0.6 * flapK) * (1 - fold) + w.side * 0.9 * fold;
        w.pv.rotation.y = w.side * (0.35 + 0.6 * fold); // 後ろへ反らせる
      }
      if (k >= 1) {
        p.model.root.remove(g);
        mM.dispose();
        mB.dispose();
      }
    }, []);
  }
  function leapLand(p, sk) {
    if (sk.id !== 'wingdash') return;
    if (dragons.active(p)) {
      fx().explosion?.(p.pos.x, p.pos.z, sk.radius * 1.3, 0xff5722, true);
      breathRing(p.pos.x, p.pos.z, sk.radius * 1.6);
    } else {
      breathRing(p.pos.x, p.pos.z, sk.radius);
    }
  }
  /** 着地点から外へ広がる炎の輪 */
  function breathRing(x, z, r) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const parts = [];
    const mats = [];
    for (let i = 0; i < 28; i++) {
      const m = sprite(smokeTexture(), FIRE[i % FIRE.length]);
      const sp = new THREE.Sprite(m);
      g.add(sp);
      mats.push(m);
      parts.push({ sp, m, a: (i / 28) * Math.PI * 2 });
    }
    add(g, 0.6, (k) => {
      const rr = r * ease(k);
      for (const o of parts) {
        o.sp.position.set(Math.sin(o.a) * rr, 0.5 + k, Math.cos(o.a) * rr);
        o.sp.scale.setScalar(1.2 + k * 1.6);
        o.m.opacity = 1 - k;
      }
    }, mats);
  }

  // ---------------- 竜化：空から雷 → 光の中で竜に ----------------
  function dragonFormFx(p, sk) {
    const pts = [[0, 0, 1.5]];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.random();
      const r = 2 + Math.random() * ((sk.strike?.radius || 5) - 2);
      pts.push([Math.sin(a) * r, Math.cos(a) * r, 0.9]);
    }
    pts.forEach(([dx, dz, s], i) => {
      setTimeout(() => fx().bolt?.(p.pos.x + dx, p.pos.z + dz, 0xfff176, s), i * 70);
    });
    flash(p.pos.x, 2, p.pos.z, 0xffffff, 14, 0.6);
    flash(p.pos.x, 2, p.pos.z, 0xfff176, 20, 0.8);
    game.fx?.shake?.(0.9);
    if (p === game.me?.()) whiteout(0.75, '255,253,231');
    dragons.start(p, sk.dur || 12);
    // 変身の炎の渦
    setTimeout(() => breathRing(p.pos.x, p.pos.z, 5), 350);
  }

  // ---------------- 道化師 ----------------
  /** 紙吹雪：上へ打ち上がって、ひらひら舞い落ちる */
  function confetti(x, z, n = 120, h = 3, spread = 5) {
    const mM = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true });
    const im = new THREE.InstancedMesh(geo('confetti', () => new THREE.PlaneGeometry(0.16, 0.1)), mM, n);
    const col = new THREE.Color();
    const seeds = [];
    for (let i = 0; i < n; i++) {
      im.setColorAt(i, col.setHex(CONFETTI[i % CONFETTI.length]));
      const a = Math.random() * Math.PI * 2;
      seeds.push({ a, v: Math.random() * spread, up: 6 + Math.random() * 6, ph: Math.random() * 6, sp: 6 + Math.random() * 10 });
    }
    im.instanceColor.needsUpdate = true;
    const g = new THREE.Group();
    g.position.set(x, h, z);
    g.add(im);
    const tmp = new THREE.Object3D();
    add(g, 2.6, (k) => {
      const t = k * 2.6;
      seeds.forEach((s, i) => {
        // 打ち上がる → 空気でゆっくり落ちる（ひらひら）
        const up = Math.min(t, 0.5);
        const y = s.up * up - 4.5 * up * up - Math.max(0, t - 0.5) * 1.6;
        const r = s.v * (1 - Math.exp(-t * 2));
        tmp.position.set(Math.sin(s.a) * r + Math.sin(t * 4 + s.ph) * 0.25, Math.max(-h + 0.05, y), Math.cos(s.a) * r);
        tmp.rotation.set(t * s.sp, t * s.sp * 0.7, s.ph);
        tmp.scale.setScalar(1);
        tmp.updateMatrix();
        im.setMatrixAt(i, tmp.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      mM.opacity = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
    }, [mM, im]);
  }

  /** 手品：帽子から何かを取り出す（一人称の帽子と手）＋ぱっと光る */
  function trickFx(p) {
    p.vmAnim = { kind: 'hat', t: 0, dur: 0.95 };
    setTimeout(() => {
      const x = p.pos.x + Math.sin(p.yaw) * 0.8;
      const z = p.pos.z + Math.cos(p.yaw) * 0.8;
      flash(x, 1.6, z, 0xffffff, 2.5, 0.4);
      game.fx?.burst?.(x, 1.6, z, 0xfff59d, 18, { speed: 4, up: 4, life: 0.5, size: 0.12, grav: 4 });
    }, 380);
  }

  /** 大爆発：二重の大爆発と色つきの火花 */
  function bigBang(p, sk) {
    const r = sk.radius || 4.5;
    fx().explosion?.(p.pos.x, p.pos.z, r * 1.25, sk.color, true);
    setTimeout(() => fx().explosion?.(p.pos.x, p.pos.z, r * 0.8, 0xffeb3b, false), 120);
    flash(p.pos.x, 1.5, p.pos.z, 0xffffff, 10, 0.45);
    for (let i = 0; i < 6; i++) game.fx?.burst?.(p.pos.x, 1.2, p.pos.z, CONFETTI[i], 14, { speed: 13, up: 7, life: 0.8, size: 0.18 });
    confetti(p.pos.x, p.pos.z, 60, 1.5, 6);
    game.fx?.shake?.(0.9);
    if (p === game.me?.()) whiteout(0.35, '255,183,77');
  }

  /** くす玉：赤十字のマークが並んだ緑の帯が広がる */
  function teamHealFx(p, sk) {
    if (sk.id !== 'kusudama') return;
    const R = sk.radius || 8;
    const g = new THREE.Group();
    g.position.set(p.pos.x, 0, p.pos.z);
    const mBand = glow(0x66bb6a, 0.8);
    const band = mesh(geo('healBand', () => new THREE.RingGeometry(0.78, 1, 64).rotateX(-Math.PI / 2)), mBand);
    band.position.y = 0.1;
    const mEdge = glow(0xb9f6ca, 1);
    const edge = mesh(ringGeo(), mEdge);
    edge.position.y = 0.13;
    g.add(band, edge);
    const icons = [];
    const mats = [mBand, mEdge];
    for (let i = 0; i < 10; i++) {
      const m = sprite(crossTexture(), 0xffffff, 1, false);
      const sp = new THREE.Sprite(m);
      g.add(sp);
      mats.push(m);
      icons.push({ sp, m, a: (i / 10) * Math.PI * 2 });
    }
    add(g, 1.3, (k, dt) => {
      const rr = 0.8 + (R - 0.8) * ease(Math.min(1, k / 0.6));
      const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      band.scale.set(rr, 1, rr);
      edge.scale.set(rr, 1, rr);
      mBand.opacity = 0.75 * fade;
      mEdge.opacity = fade;
      for (const o of icons) {
        o.a += dt * 0.5;
        o.sp.position.set(Math.sin(o.a) * rr * 0.89, 0.55 + Math.sin(k * 8 + o.a) * 0.08, Math.cos(o.a) * rr * 0.89);
        o.sp.scale.setScalar(0.75);
        o.m.opacity = fade;
      }
    }, mats);
    confetti(p.pos.x, p.pos.z, 40, 3, 3);
  }

  /** 大旋風：火のついた桜吹雪が、炎の竜巻になって回る */
  function fireWhirl(p, dur) {
    const g = new THREE.Group();
    const parts = [];
    const mats = [];
    for (let i = 0; i < 70; i++) {
      const petal = i % 2 === 0;
      const m = sprite(petal ? petalTexture() : smokeTexture(), petal ? (i % 4 ? 0xff8a65 : 0xffcdd2) : FIRE[i % FIRE.length]);
      const sp = new THREE.Sprite(m);
      g.add(sp);
      mats.push(m);
      parts.push({ sp, m, petal, a: Math.random() * 6.28, h: Math.random(), r: 0.8 + Math.random() * 3.6, ph: Math.random() });
    }
    add(g, dur, (k, dt) => {
      g.position.set(p.pos.x, 0, p.pos.z);
      const fade = k < 0.1 ? k / 0.1 : k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      for (const o of parts) {
        o.a += dt * (7 - o.r * 0.6);
        o.h = (o.h + dt * (o.petal ? 0.5 : 0.9)) % 1;
        const rr = o.r * (0.6 + 0.6 * o.h); // 上ほど広がる竜巻
        o.sp.position.set(Math.sin(o.a) * rr, 0.2 + o.h * 4.5, Math.cos(o.a) * rr);
        o.sp.scale.setScalar(o.petal ? 0.45 : 0.9 + o.h * 1.2);
        o.m.rotation += dt * 4;
        o.m.opacity = fade * Math.sin(o.h * Math.PI) * (o.petal ? 1 : 0.8);
      }
    }, mats);
  }

  return {
    dragonForm: dragons,
    breath,
    leapFx,
    leapLand,
    dragonFormFx,
    bigBang,
    teamHealFx,
    fireWhirl,
    confetti,
    /** 手品・大道芸（random の技）。何が出るかの前に出す */
    randomFx(p, sk) {
      if (sk.id === 'trick') trickFx(p);
      else if (sk.id === 'grandshow') {
        p.vmAnim = { kind: 'cheer', t: 0, dur: 1.15 };
        confetti(p.pos.x, p.pos.z, 140, 3, 6);
      }
    },
    updateF(dt) {
      dragons.update(dt);
    },
  };
}
