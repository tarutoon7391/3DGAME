// ボスの固有技・必殺技の見た目（当たり判定には関わらない）
// ホストのボスが play(type, d) を呼び、同じ引数を参加者にも送って再生する（boss.js の vfx()）
// 中で使う fx.burst はミラーしない（参加者は自分で play するので、二重に出さない）
import * as THREE from 'three';
import { columnGeo, ringGeo, glow, hotOf, ease } from './fxkit.js';
import { slashTexture, streakTexture, noteTexture } from './fxtex.js';
import { wallTexture } from './auratex.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createBossVfx(game) {
  const root = new THREE.Group();
  game.scene.add(root);
  const live = new Set(); // { tick(dt) → false で終わり, dispose() }
  const geos = {};
  const G = (k, mk) => (geos[k] ||= mk());

  // 共通の形
  const plane = () => G('plane', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)); // 足元の板（中心）
  const strip = () => G('strip', () => new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(-Math.PI / 2).rotateY(Math.PI)); // +Z へ 0..1
  const disc = () => G('disc', () => new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2));
  const cone = () => G('cone', () => new THREE.ConeGeometry(1, 1, 24, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5)); // +Z へ広がる
  const tooth = () => G('tooth', () => new THREE.ConeGeometry(0.12, 0.5, 4));
  const rock = () => G('rock', () => new THREE.DodecahedronGeometry(1, 0));
  const sector = (arc) => G('sec' + arc.toFixed(2), () => new THREE.CircleGeometry(1, 32, -Math.PI / 2 - arc / 2, arc).rotateX(-Math.PI / 2));
  const twister = () => G('tw', () => new THREE.CylinderGeometry(1, 0.25, 1, 24, 6, true).translate(0, 0.5, 0));

  /** 寿命つきの汎用の見た目。upd(k, t) を毎フレーム（k=経過/寿命） */
  function add(obj, life, upd, mats = []) {
    root.add(obj);
    let t = 0;
    const h = {
      tick(dt) {
        t += dt;
        upd(Math.min(1, t / life), t, dt);
        return t < life;
      },
      dispose() {
        root.remove(obj);
        for (const m of mats) m.dispose();
      },
    };
    live.add(h);
    return h;
  }
  /** パーティクル（ミラーしない） */
  function burst(...a) {
    const prev = game.mirroring;
    game.mirroring = false;
    try {
      game.fx.burst(...a);
    } finally {
      game.mirroring = prev;
    }
  }

  // ---------------- それぞれの見た目 ----------------
  const T = {
    /** 噛みつき：上下の顎（牙の列）が閉じる */
    bite(d) {
      const g = new THREE.Group();
      g.position.set(d.x, 1.1, d.z);
      g.rotation.y = d.yaw;
      const s = d.r ?? 3;
      const m = glow(d.color, 1);
      const m2 = new THREE.MeshBasicMaterial({ color: 0xfff8e1 });
      const jaws = [1, -1].map((side) => {
        const j = new THREE.Group();
        for (let i = 0; i < 7; i++) {
          const a = (i / 6 - 0.5) * 2.2;
          const t = new THREE.Mesh(tooth(), m2);
          t.position.set(Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9);
          t.rotation.x = side > 0 ? Math.PI : 0;
          t.scale.setScalar(1.4);
          j.add(t);
        }
        const gum = new THREE.Mesh(G('gum', () => new THREE.TorusGeometry(0.9, 0.09, 6, 20, Math.PI * 1.3).rotateX(Math.PI / 2).rotateY(Math.PI / 2 + Math.PI * 0.35)), m);
        gum.rotation.y = 0;
        j.add(gum);
        g.add(j);
        return { j, side };
      });
      g.scale.setScalar(s * 0.55);
      return add(g, 0.42, (k) => {
        const c = k < 0.45 ? 1 - ease(k / 0.45) : 0;
        for (const { j, side } of jaws) j.position.y = side * (0.15 + c * 0.9);
        m.opacity = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55;
        m2.opacity = m.opacity;
        m2.transparent = true;
        if (k > 0.45 && k < 0.5) burst(d.x + Math.sin(d.yaw) * s * 0.4, 1, d.z + Math.cos(d.yaw) * s * 0.4, d.color, 12, { speed: 6, up: 3, life: 0.4 });
      }, [m, m2]);
    },

    /** 爪：3本の光る筋が扇の上を走る */
    claw(d) {
      const g = new THREE.Group();
      g.position.set(d.x, 0.9, d.z);
      g.rotation.y = d.yaw;
      const m = glow(d.color, 1, slashTexture());
      const n = d.n ?? 3;
      const r = d.r ?? 5;
      for (let i = 0; i < n; i++) {
        const s = new THREE.Mesh(G('clawp', () => new THREE.PlaneGeometry(1, 1)), m);
        s.position.set((i - (n - 1) / 2) * 0.9, 0.3 + i * 0.2, r * 0.55);
        s.rotation.set(-Math.PI / 2, 0, 0.9 * (d.dir ?? 1));
        s.scale.set(0.5, r * 1.2, 1);
        g.add(s);
      }
      return add(g, 0.32, (k) => {
        m.opacity = 1 - k;
        g.scale.set(1, 1, 0.6 + ease(k) * 0.5);
      }, [m]);
    },

    /** 振り（扇の光）：薙ぎ払い・尾の一撃 */
    arc(d) {
      const m = glow(d.color, 0.85, slashTexture());
      const mesh = new THREE.Mesh(sector(d.arc ?? 2), m);
      mesh.position.set(d.x, 0.7, d.z);
      mesh.rotation.y = d.yaw;
      mesh.scale.setScalar(d.r ?? 5);
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = d.yaw + (i / (n - 1) - 0.5) * (d.arc ?? 2);
        burst(d.x + Math.sin(a) * (d.r ?? 5) * 0.85, 0.8, d.z + Math.cos(a) * (d.r ?? 5) * 0.85, d.color, 3, { speed: 4, up: 2, life: 0.4 });
      }
      return add(mesh, 0.35, (k) => {
        m.opacity = 0.85 * (1 - k);
        mesh.scale.setScalar((d.r ?? 5) * (0.85 + 0.2 * ease(k)));
      }, [m]);
    },

    /** 帯の光（直線の一撃・地割れ・光線） */
    line(d) {
      const g = new THREE.Group();
      g.position.set(d.x, 0.08, d.z);
      g.rotation.y = d.yaw;
      const m = glow(d.color, 1, streakTexture());
      const core = new THREE.Mesh(strip(), m);
      core.scale.set(d.w ?? 2, 1, d.len ?? 10);
      g.add(core);
      const tall = d.tall ?? 0;
      let wallM = null;
      if (tall) {
        wallM = glow(d.color, 0.7, wallTexture());
        const wall = new THREE.Mesh(G('lwall', () => new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0.5).rotateY(Math.PI / 2)), wallM);
        wall.scale.set(1, tall, d.len ?? 10);
        g.add(wall);
      }
      for (let s = 0; s < (d.len ?? 10); s += 1.4) burst(d.x + Math.sin(d.yaw) * s, 0.6, d.z + Math.cos(d.yaw) * s, d.color, 2, { speed: 2.5, up: 4, life: 0.5 });
      return add(g, d.life ?? 0.5, (k) => {
        m.opacity = 1 - k;
        if (wallM) wallM.opacity = 0.7 * (1 - k);
        g.scale.y = 1 + k;
      }, wallM ? [m, wallM] : [m]);
    },

    /** ブレス：口から円すいに広がる炎（dur 秒） */
    breath(d) {
      const g = new THREE.Group();
      g.position.set(d.x, d.y ?? 1.6, d.z);
      g.rotation.y = d.yaw;
      const m = glow(d.color, 0.55, wallTexture());
      const m2 = glow(hotOf(d.color, 0.6), 0.8, wallTexture());
      const outer = new THREE.Mesh(cone(), m);
      const inner = new THREE.Mesh(cone(), m2);
      const len = d.len ?? 14;
      const w = (d.w ?? 4) / 2;
      outer.scale.set(w, w * 0.5, len);
      inner.scale.set(w * 0.5, w * 0.3, len * 0.85);
      g.add(outer, inner);
      const dur = d.dur ?? 0.6;
      return add(g, dur + 0.25, (k, t) => {
        const on = t < dur ? Math.min(1, t / 0.12) : 1 - (t - dur) / 0.25;
        m.opacity = 0.55 * on;
        m2.opacity = 0.8 * on;
        outer.rotation.z += 0.3;
        inner.rotation.z -= 0.4;
        g.scale.set(1, 1, Math.min(1, t / 0.15));
        if (t < dur && Math.random() < 0.8) {
          const s = Math.random() * len;
          const sp = (Math.random() - 0.5) * w * (s / len) * 1.6;
          burst(d.x + Math.sin(d.yaw) * s + Math.cos(d.yaw) * sp, (d.y ?? 1.6) * (1 - s / len) + 0.4, d.z + Math.cos(d.yaw) * s - Math.sin(d.yaw) * sp, d.color, 2, { speed: 2, up: 2, life: 0.4, size: 0.3 });
        }
      }, [m, m2]);
    },

    /** 回るブレス（必殺技など）：arms 本の扇が速さ speed で回る */
    rot(d) {
      const g = new THREE.Group();
      g.position.set(d.x, 0.15, d.z);
      const mats = [];
      const parts = [];
      for (let i = 0; i < d.arms; i++) {
        const m = glow(d.colors?.[i] ?? d.color, 0.7, wallTexture());
        mats.push(m);
        const mesh = new THREE.Mesh(sector(d.arc), m);
        mesh.scale.setScalar(d.len);
        const c = new THREE.Mesh(cone(), m);
        c.scale.set(d.len * Math.tan(d.arc / 2), 1.6, d.len);
        c.position.y = 1.3;
        const arm = new THREE.Group();
        arm.add(mesh, c);
        g.add(arm);
        parts.push(arm);
      }
      return add(g, d.dur + 0.3, (k, t) => {
        const tt = Math.min(t, d.dur);
        parts.forEach((p, i) => {
          const a = d.a0 + (i / d.arms) * Math.PI * 2 + d.speed * tt;
          p.rotation.y = a;
          if (t < d.dur && Math.random() < 0.6) {
            const s = 2 + Math.random() * (d.len - 2);
            burst(d.x + Math.sin(a) * s, 0.8, d.z + Math.cos(a) * s, d.colors?.[i] ?? d.color, 2, { speed: 2, up: 3, life: 0.4, size: 0.3 });
          }
        });
        const on = t < 0.2 ? t / 0.2 : t > d.dur ? Math.max(0, 1 - (t - d.dur) / 0.3) : 1;
        for (const m of mats) m.opacity = 0.7 * on;
      }, mats);
    },

    /** 落雷：空から細い光が落ちて地面で弾ける */
    bolt(d) {
      const m = glow(d.color, 1, streakTexture());
      const g = new THREE.Group();
      g.position.set(d.x, 0, d.z);
      const a = new THREE.Mesh(G('boltc', () => new THREE.CylinderGeometry(0.18, 0.35, 30, 6, 8, true).translate(0, 15, 0)), m);
      g.add(a);
      burst(d.x, 0.5, d.z, d.color, 24, { speed: 8, up: 6, life: 0.5, size: 0.22 });
      return add(g, 0.4, (k) => {
        a.rotation.y = Math.random() * 6;
        a.scale.set(1 + Math.random() * 0.8, 1, 1 + Math.random() * 0.8);
        a.position.x = (Math.random() - 0.5) * 0.3;
        m.opacity = (1 - k) * (0.6 + Math.random() * 0.4);
      }, [m]);
    },

    /** 火柱・光の柱 */
    pillar(d) {
      const m = glow(d.color, 0.85, wallTexture());
      const mesh = new THREE.Mesh(columnGeo(), m);
      mesh.position.set(d.x, 0, d.z);
      const r = d.r ?? 2;
      const h = d.h ?? 8;
      burst(d.x, 0.5, d.z, d.color, 18, { speed: 5, up: 10, life: 0.7, size: 0.25 });
      return add(mesh, 0.6, (k) => {
        mesh.scale.set(r * (1 - k * 0.5), h * ease(Math.min(1, k * 3)), r * (1 - k * 0.5));
        m.opacity = 0.85 * (1 - k);
      }, [m]);
    },

    /** 空から落ちてくる岩・火球（fall 秒で着地） */
    meteor(d) {
      const m = new THREE.MeshLambertMaterial({ color: d.rock ?? 0x5d4037, emissive: d.color, emissiveIntensity: 0.6, flatShading: true });
      const tail = glow(d.color, 0.7, wallTexture());
      const g = new THREE.Group();
      const ball = new THREE.Mesh(rock(), m);
      const fire = new THREE.Mesh(columnGeo(), tail);
      fire.rotation.x = Math.PI;
      g.add(ball, fire);
      const s = (d.r ?? 2.5) * 0.45;
      ball.scale.setScalar(s);
      fire.scale.set(s * 0.9, s * 5, s * 0.9);
      fire.position.y = s * 5;
      const fall = d.fall ?? 1;
      const sx = d.x - 6;
      const sz = d.z - 3;
      return add(g, fall, (k) => {
        const e = k * k;
        g.position.set(sx + (d.x - sx) * e, 30 * (1 - e) + s * 0.3, sz + (d.z - sz) * e);
        ball.rotation.x += 0.1;
        ball.rotation.z += 0.07;
      }, [m, tail]);
    },

    /** 動く竜巻（path：x0,z0 → x1,z1、back なら戻る）。ホストの当たり判定と同じ式で位置を出す */
    twister(d) {
      const m = glow(d.color, 0.55, wallTexture());
      const m2 = glow(hotOf(d.color, 0.5), 0.4, streakTexture());
      const g = new THREE.Group();
      const a = new THREE.Mesh(twister(), m);
      const b = new THREE.Mesh(twister(), m2);
      const r = d.r ?? 2;
      a.scale.set(r, r * 3.2, r);
      b.scale.set(r * 0.7, r * 3.4, r * 0.7);
      g.add(a, b);
      const life = d.life;
      return add(g, life, (k, t) => {
        const p = moverPos(d, t);
        g.position.set(p.x, 0, p.z);
        a.rotation.y += 0.35;
        b.rotation.y -= 0.5;
        const on = t < 0.25 ? t / 0.25 : t > life - 0.3 ? (life - t) / 0.3 : 1;
        m.opacity = 0.55 * on;
        m2.opacity = 0.4 * on;
        if (Math.random() < 0.5) burst(p.x + (Math.random() - 0.5) * r, 0.3, p.z + (Math.random() - 0.5) * r, d.color, 1, { speed: 3, up: 4, life: 0.4 });
      }, [m, m2]);
    },

    /** 飛んで戻ってくる斧（回転する刃） */
    axe(d) {
      const m = new THREE.MeshLambertMaterial({ color: 0xcfd8dc, emissive: d.color, emissiveIntensity: 0.5 });
      const h = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
      const g = new THREE.Group();
      const spin = new THREE.Group();
      const handle = new THREE.Mesh(G('axeh', () => new THREE.BoxGeometry(0.2, 2.4, 0.2)), h);
      const blade = new THREE.Mesh(G('axeb', () => new THREE.CylinderGeometry(0.9, 0.9, 0.12, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 0.9, 0)), m);
      spin.add(handle, blade);
      spin.scale.setScalar((d.r ?? 2) * 0.8);
      g.add(spin);
      return add(g, d.life, (k, t) => {
        const p = moverPos(d, t);
        g.position.set(p.x, 1.4, p.z);
        spin.rotation.x += 0.5;
        g.rotation.y = d.yaw ?? 0;
        if (Math.random() < 0.5) burst(p.x, 1.2, p.z, d.color, 1, { speed: 2, up: 1, life: 0.3 });
      }, [m, h]);
    },

    /** 炎の分身：火の鳥の影が直線を駆け抜ける */
    phantom(d) {
      if (d.x0 === undefined) d = { ...d, x0: d.x, z0: d.z, x1: d.x + Math.sin(d.yaw) * d.len, z1: d.z + Math.cos(d.yaw) * d.len, dur: d.dur ?? 0.35 };
      const m = glow(d.color, 0.9, wallTexture());
      const g = new THREE.Group();
      const body = new THREE.Mesh(G('ph', () => new THREE.SphereGeometry(1, 12, 8).scale(0.6, 0.4, 1.6)), m);
      const wing = new THREE.Mesh(G('phw', () => new THREE.PlaneGeometry(4.5, 1.6).rotateX(-Math.PI / 2)), m);
      g.add(body, wing);
      g.scale.setScalar(1.3);
      const len = Math.hypot(d.x1 - d.x0, d.z1 - d.z0);
      g.rotation.y = Math.atan2(d.x1 - d.x0, d.z1 - d.z0);
      return add(g, d.dur, (k) => {
        g.position.set(d.x0 + (d.x1 - d.x0) * k, 1.6, d.z0 + (d.z1 - d.z0) * k);
        wing.scale.z = 1 + Math.sin(k * 30) * 0.4;
        if (len) burst(g.position.x, 1.2, g.position.z, d.color, 3, { speed: 2, up: 2, life: 0.5 });
      }, [m]);
    },

    /** 安全地帯（水たまり・光と闇の円・岩陰の印） list: [{x,z,r,kind}] */
    safe(d) {
      const g = new THREE.Group();
      const mats = [];
      const COL = { water: 0x29b6f6, light: 0xfff176, dark: 0x7c4dff, rock: 0x8d6e63, eye: 0x69f0ae };
      for (const s of d.list) {
        const c = COL[s.kind] ?? 0x69f0ae;
        const fill = s.kind === 'dark' ? new THREE.MeshBasicMaterial({ color: 0x1a0033, transparent: true, opacity: 0.75, depthWrite: false }) : glow(c, 0.45);
        const edge = glow(c, 1);
        const col = glow(c, 0.25, wallTexture());
        mats.push(fill, edge, col);
        const a = new THREE.Mesh(disc(), fill);
        a.position.set(s.x, 0.07, s.z);
        a.scale.setScalar(s.r);
        const e = new THREE.Mesh(ringGeo(), edge);
        e.position.set(s.x, 0.09, s.z);
        e.scale.setScalar(s.r);
        const p = new THREE.Mesh(columnGeo(), col);
        p.position.set(s.x, 0, s.z);
        p.scale.set(s.r, 6, s.r);
        g.add(a, e, p);
        if (s.kind === 'rock') {
          const rm = new THREE.MeshLambertMaterial({ color: 0x6d4c41, flatShading: true });
          mats.push(rm);
          const r = new THREE.Mesh(rock(), rm);
          r.position.set(s.x, 1.2, s.z);
          r.scale.set(1.4, 1.6, 1.4);
          g.add(r);
        }
      }
      return add(g, d.dur, (k, t) => {
        const on = t < 0.3 ? t / 0.3 : k > 0.92 ? (1 - k) / 0.08 : 1;
        mats.forEach((m, i) => {
          if (m.isMeshLambertMaterial) return;
          const base = i % 3 === 0 ? (m.blending === THREE.AdditiveBlending ? 0.45 : 0.75) : i % 3 === 1 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 6)) : 0.25;
          m.opacity = base * on;
        });
      }, mats);
    },

    /** 大きな目（石化の睨み）：ボスの頭上で開いて光る */
    eye(d) {
      const g = new THREE.Group();
      g.position.set(d.x, d.y ?? 8, d.z);
      const white = glow(d.color, 0.9);
      const pupil = new THREE.MeshBasicMaterial({ color: 0x1b1b1b, transparent: true });
      const a = new THREE.Mesh(G('eyew', () => new THREE.SphereGeometry(1, 20, 12).scale(2.2, 1, 0.3)), white);
      const p = new THREE.Mesh(G('eyep', () => new THREE.SphereGeometry(0.5, 12, 8).scale(0.6, 1.6, 0.4)), pupil);
      p.position.z = 0.25;
      g.add(a, p);
      const dur = d.dur ?? 2;
      return add(g, dur + 0.4, (k, t) => {
        const cam = game.camera;
        if (cam) g.lookAt(cam.getWorldPosition(new THREE.Vector3()));
        const open = Math.min(1, t / (dur * 0.6));
        g.scale.set(1 + open, open * (1 + 0.1 * Math.sin(t * 20)), 1 + open);
        const end = t > dur ? 1 - (t - dur) / 0.4 : 1;
        white.opacity = 0.9 * end;
        pupil.opacity = end;
      }, [white, pupil]);
    },

    /** とぐろ：締まっていく輪 */
    coil(d) {
      const m = glow(d.color, 0.9, streakTexture());
      const g = new THREE.Group();
      g.position.set(d.x, 0.3, d.z);
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(G('coilt', () => new THREE.TorusGeometry(1, 0.08, 6, 40).rotateX(Math.PI / 2)), m);
        r.position.y = i * 0.6;
        g.add(r);
      }
      const dur = d.dur ?? 1.5;
      return add(g, dur, (k, t) => {
        g.children.forEach((c, i) => {
          c.scale.setScalar(d.r * (1 - k * 0.6) * (1 + i * 0.05));
          c.rotation.y = t * (2 + i);
        });
        m.opacity = 0.9 * (k > 0.85 ? (1 - k) / 0.15 : 1);
      }, [m]);
    },

    /** 次元の裂け目：黒い割れ目が地面を走って光る */
    rift(d) {
      const g = new THREE.Group();
      g.position.set(d.x, 0.1, d.z);
      g.rotation.y = d.yaw;
      const dark = new THREE.MeshBasicMaterial({ color: 0x120018, transparent: true, opacity: 0.9, depthWrite: false });
      const edge = glow(d.color, 0.9, streakTexture());
      const a = new THREE.Mesh(strip(), dark);
      const b = new THREE.Mesh(strip(), edge);
      a.scale.set(d.w * 0.6, 1, d.len);
      b.scale.set(d.w, 1, d.len);
      b.position.y = 0.01;
      g.add(b, a);
      const dur = d.dur ?? 1.2;
      return add(g, dur, (k, t) => {
        g.scale.set(Math.min(1, t / 0.2), 1, Math.min(1, t / 0.3));
        edge.opacity = 0.5 + 0.5 * Math.abs(Math.sin(t * 15));
        if (k > 0.9) {
          dark.opacity = 0.9 * (1 - k) / 0.1;
          edge.opacity *= (1 - k) / 0.1;
        }
      }, [dark, edge]);
    },

    /** 石柱の輪（gap の向きだけ開いている） */
    pillars(d) {
      const g = new THREE.Group();
      g.position.set(d.x, 0, d.z);
      const m = new THREE.MeshLambertMaterial({ color: 0x8d6e63, flatShading: true, emissive: d.color, emissiveIntensity: 0.15 });
      const n = d.n ?? 14;
      const items = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (d.gap !== undefined && Math.abs(Math.atan2(Math.sin(a - d.gap), Math.cos(a - d.gap))) < (d.gapW ?? 0.6)) continue;
        const p = new THREE.Mesh(G('pil', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), m);
        p.position.set(Math.sin(a) * d.r, 0, Math.cos(a) * d.r);
        p.rotation.y = a;
        g.add(p);
        items.push(p);
      }
      const dur = d.dur ?? 2;
      return add(g, dur, (k, t) => {
        const h = t < 0.3 ? t / 0.3 : k > 0.85 ? (1 - k) / 0.15 : 1;
        for (const p of items) p.scale.set(1.1, 3.2 * Math.max(0.01, h), 1.1);
      }, [m]);
    },

    /** 風の放射（翼の嵐） */
    wind(d) {
      const m = glow(d.color, 0.7, streakTexture());
      const g = new THREE.Group();
      g.position.set(d.x, 0.6, d.z);
      for (let i = 0; i < 18; i++) {
        const s = new THREE.Mesh(G('wst', () => new THREE.PlaneGeometry(0.4, 3).rotateX(-Math.PI / 2).translate(0, 0, 1.5)), m);
        s.rotation.y = (i / 18) * Math.PI * 2;
        g.add(s);
      }
      const dur = d.dur ?? 1;
      return add(g, dur, (k) => {
        g.scale.setScalar(2 + k * (d.r ?? 12));
        g.rotation.y += 0.02;
        m.opacity = 0.7 * (1 - k);
      }, [m]);
    },

    /** 画面いっぱいの光（必殺技の着弾） */
    flash(d) {
      const el = document.createElement('div');
      el.className = 'rpg-ultflash';
      el.style.background = '#' + new THREE.Color(d.color ?? 0xffffff).getHexString();
      document.body.appendChild(el);
      const dur = d.dur ?? 0.6;
      const h = {
        t: 0,
        tick(dt) {
          h.t += dt;
          el.style.opacity = String(Math.max(0, (d.peak ?? 0.7) * (1 - h.t / dur)));
          return h.t < dur;
        },
        dispose() { el.remove(); },
      };
      live.add(h);
      return h;
    },

    /** 着地・爆発の衝撃（テーマの見た目） */
    impact(d) {
      game.enemyFx?.impact(d.x, d.z, d.r, d.color);
    },

    /** 必殺技の警告（画面の縁が赤く点滅＋大きな文字） */
    warn(d) {
      game.hudView.ultWarn?.(d.boss, d.name, d.hint, d.dur);
    },

    /** 拍子：自分のプレイヤーのまわりに縮む輪。0 になった瞬間に回避（times は開始からの秒） */
    beat(d) {
      const me = game.me?.();
      if (!me) return;
      const m = glow(d.color, 0.9);
      const note = glow(d.color, 1, noteTexture('two'));
      const g = new THREE.Group();
      const ring = new THREE.Mesh(ringGeo(), m);
      const icon = new THREE.Mesh(G('noteP', () => new THREE.PlaneGeometry(1.2, 1.2)), note);
      icon.position.y = 3;
      g.add(ring, icon);
      const lead = d.lead ?? 1;
      const end = d.times[d.times.length - 1] + 0.3;
      return add(g, end, (k, t) => {
        g.position.set(me.pos.x, 0.12, me.pos.z);
        const cam = game.camera;
        if (cam) icon.lookAt(cam.getWorldPosition(new THREE.Vector3()));
        const next = d.times.find((x) => x >= t - 0.05);
        if (next === undefined) { m.opacity = 0; note.opacity = 0; return; }
        const left = next - t;
        const kk = Math.max(0, Math.min(1, left / lead));
        ring.scale.setScalar(0.6 + kk * 4.5);
        m.opacity = left < lead ? 0.95 : 0.2;
        note.opacity = left < 0.12 ? 1 : 0.7;
        icon.scale.setScalar(left < 0.12 ? 1.6 : 1);
      }, [m, note]);
    },
  };

  /** 動くもの（竜巻・斧）の位置：from → to を speed で進み、back なら折り返して戻る */
  function moverPos(d, t) {
    const len = Math.hypot(d.x1 - d.x0, d.z1 - d.z0) || 1;
    let s = (d.speed ?? 8) * t;
    if (d.back && s > len) s = Math.max(0, 2 * len - s);
    else s = Math.min(s, len);
    return { x: d.x0 + ((d.x1 - d.x0) / len) * s, z: d.z0 + ((d.z1 - d.z0) / len) * s };
  }

  return {
    moverPos,
    play(type, d) {
      const f = T[type];
      if (!f) return;
      const prev = game.mirroring;
      game.mirroring = false; // 中で出すパーティクル・効果音は参加者へ送らない（向こうでも play する）
      try {
        f(d);
      } finally {
        game.mirroring = prev;
      }
    },
    update(dt) {
      for (const h of [...live]) {
        if (!h.tick(dt)) {
          h.dispose();
          live.delete(h);
        }
      }
    },
    clear() {
      for (const h of live) h.dispose();
      live.clear();
      game.hudView.ultWarn?.(null);
    },
  };
}

export { UP };
