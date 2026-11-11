// 敵の攻撃の見た目：テーマ（炎・氷・冥界…）に合わせた弾の形・衝撃波・着地の衝撃・壁の飾り
// 当たり判定には関わらない（見た目だけ）。数値とテーマの割り当ては src/data/enemyfx.js
import * as THREE from 'three';
import { BOSSES, ENEMIES } from './data/enemies.js';
import { BOSS_THEME, ENEMY_THEME, THEMES, NOVA, IMPACT, WALL } from './data/enemyfx.js';
import { wallTexture } from './auratex.js';

// ---------------- テーマを決める ----------------
/** obj の中の color・shotColor をすべて集める */
function collectColors(obj, out = new Set()) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    if ((k === 'color' || k === 'shotColor') && typeof v === 'number') out.add(v);
    else if (typeof v === 'object') collectColors(v, out);
  }
  return out;
}
const PALETTE = {}; // ボス → その技の色
for (const key of Object.keys(BOSSES)) PALETTE[key] = collectColors(BOSSES[key]);
const FALLBACK = new Map(); // 色 → テーマ（今いるボスで決まらないとき）
for (const [k, th] of Object.entries(ENEMY_THEME)) if (ENEMIES[k]?.shotColor !== undefined) FALLBACK.set(ENEMIES[k].shotColor, th);
for (const [key, cols] of Object.entries(PALETTE)) for (const c of cols) if (!FALLBACK.has(c)) FALLBACK.set(c, BOSS_THEME[key] || 'default');

// ---------------- 飾り（衝撃波・壁に並ぶもの） ----------------
// glow：加算で光る／solid：陰影のある固体。base：色に混ぜる固定色（岩の茶色など）
const DECOR = {
  flame: { geo: () => new THREE.ConeGeometry(0.32, 1.25, 6).translate(0, 0.62, 0), glow: true, flicker: 1 },
  icespike: { geo: () => new THREE.ConeGeometry(0.24, 1.3, 4).translate(0, 0.65, 0), mix: 0xffffff, mixK: 0.45, tilt: 0.35 },
  wisp: { geo: () => new THREE.ConeGeometry(0.22, 1.5, 5).translate(0, 0.75, 0), glow: true, flicker: 1.4, tilt: -0.25 },
  spike: { geo: () => new THREE.ConeGeometry(0.17, 1.0, 4).translate(0, 0.5, 0), mix: 0x1a0000, mixK: 0.55, tilt: 0.3 },
  shard: { geo: () => new THREE.OctahedronGeometry(0.5, 0).scale(0.45, 1.5, 0.22).translate(0, 0.55, 0), mix: 0xcfd8dc, mixK: 0.5, tilt: 0.45 },
  rock: { geo: () => new THREE.DodecahedronGeometry(0.42, 0).translate(0, 0.3, 0), mix: 0x6d4c41, mixK: 0.7, tumble: true },
  streak: { geo: () => new THREE.BoxGeometry(0.07, 1.0, 0.55).translate(0, 0.6, 0), glow: true, tilt: 0.6 },
  bubble: { geo: () => new THREE.SphereGeometry(0.24, 8, 6).translate(0, 0.35, 0), glow: true, bob: true },
  splash: { geo: () => new THREE.ConeGeometry(0.16, 1.0, 5).translate(0, 0.5, 0), glow: true, tilt: 0.55 },
  feather: { geo: () => new THREE.SphereGeometry(0.3, 6, 5).scale(0.4, 1.8, 0.15).translate(0, 0.55, 0), mix: 0xffffff, mixK: 0.3, tilt: 0.5 },
  spark: { geo: () => new THREE.OctahedronGeometry(0.26, 0).scale(1, 1.6, 1).translate(0, 0.45, 0), glow: true, flicker: 0.6 },
};
const decorGeo = {};
const getDecorGeo = (k) => (decorGeo[k] ||= DECOR[k].geo());

function decorMat(kind, color) {
  const D = DECOR[kind];
  if (D.glow) return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const c = new THREE.Color(color);
  if (D.mix !== undefined) c.lerp(new THREE.Color(D.mix), D.mixK);
  return new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: c.clone().multiplyScalar(0.35) });
}

const tmpO = new THREE.Object3D();
const glowMat = (color, opacity, map = null, side = THREE.FrontSide) =>
  new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, depthWrite: false, side, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 });

/** 帯（太さを毎フレーム変えられる平らな輪）。形は自分専用 */
function makeBand(color, opacity, seg = 96) {
  const geo = new THREE.RingGeometry(0.5, 1, seg, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, glowMat(color, opacity));
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const pos = geo.attributes.position;
  return {
    mesh,
    set(inner, outer) {
      inner = Math.max(0, inner);
      for (let j = 0; j < 2; j++) {
        const rad = j ? outer : inner;
        for (let i = 0; i <= seg; i++) {
          const a = (i / seg) * Math.PI * 2;
          pos.setXYZ(j * (seg + 1) + i, Math.cos(a) * rad, 0, -Math.sin(a) * rad);
        }
      }
      pos.needsUpdate = true;
    },
  };
}

export function createEnemyFx(game) {
  const root = new THREE.Group();
  game.scene.add(root);
  const crestGeo = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true).translate(0, 0.5, 0);
  const waves = new Set(); // 衝撃波・衝撃
  const walls = new Set(); // 飾りをつけた壁
  let time = 0;

  /** 色からテーマ。今いるボスの技の色なら、そのボスのテーマ */
  function themeOf(color) {
    for (const b of game.bosses || []) if (PALETTE[b.key]?.has(color)) return BOSS_THEME[b.key] || 'default';
    return FALLBACK.get(color) || 'default';
  }

  /** 広がる輪の見た目（衝撃波と着地の衝撃で共通） */
  function makeWave(x, z, color, theme) {
    const T = THEMES[theme] || THEMES.default;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const hot = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.55).getHex();
    const after = makeBand(color, 0.2);
    const band = makeBand(color, 0.9);
    const core = makeBand(hot, 1);
    after.mesh.position.y = 0.04;
    band.mesh.position.y = 0.05;
    core.mesh.position.y = 0.06;
    const crest = new THREE.Mesh(crestGeo, glowMat(color, 0.75, wallTexture(), THREE.DoubleSide));
    crest.frustumCulled = false;
    crest.renderOrder = 2;
    const D = DECOR[T.decor] ? T.decor : 'spark';
    const decor = new THREE.InstancedMesh(getDecorGeo(D), decorMat(D, color), NOVA.decorCount);
    decor.frustumCulled = false;
    g.add(after.mesh, band.mesh, core.mesh, crest, decor);
    root.add(g);
    const phase = Math.random() * Math.PI * 2;
    const seeds = Array.from({ length: NOVA.decorCount }, () => Math.random());
    let age = 0;
    return {
      age: 0,
      /** r：輪の半径、w：当たりの半幅、alpha：濃さ（消えるとき用） */
      set(r, w, alpha = 1) {
        after.set(r - w - NOVA.afterglow, r - w);
        band.set(r - w, r + w);
        core.set(r - w * 0.3, r + w * 0.3);
        after.mesh.material.opacity = 0.2 * alpha;
        band.mesh.material.opacity = 0.9 * alpha;
        core.mesh.material.opacity = alpha;
        const h = NOVA.crest * T.crest * (0.75 + 0.25 * Math.sin(age * 14));
        crest.scale.set(Math.max(0.1, r), h, Math.max(0.1, r));
        crest.material.opacity = 0.75 * alpha;
        decor.material.opacity = 0.85 * alpha;
        const DD = DECOR[D];
        const n = NOVA.decorCount;
        for (let i = 0; i < n; i++) {
          const a = phase + (i / n) * Math.PI * 2;
          const sd = seeds[i];
          let s = NOVA.decorSize * (0.7 + sd * 0.6) * Math.min(1, r / 1.5);
          if (DD.flicker) s *= 0.75 + 0.35 * Math.sin(age * 18 * DD.flicker + sd * 20);
          const y = DD.bob ? Math.abs(Math.sin(age * 6 + sd * 9)) * 0.5 : 0;
          tmpO.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
          tmpO.rotation.set((DD.tilt || 0) + (DD.tumble ? age * 5 + sd * 6 : 0), a, DD.tumble ? sd * 3 : 0);
          tmpO.scale.setScalar(s * Math.max(0.01, alpha));
          tmpO.updateMatrix();
          decor.setMatrixAt(i, tmpO.matrix);
        }
        decor.instanceMatrix.needsUpdate = true;
      },
      tick(dt) {
        age += dt;
      },
      remove() {
        root.remove(g);
        for (const o of [after.mesh, band.mesh, core.mesh]) {
          o.geometry.dispose();
          o.material.dispose();
        }
        crest.material.dispose();
        decor.material.dispose();
        decor.dispose();
      },
    };
  }

  return {
    themeOf,

    /** 敵の弾の形と大きさの倍率 */
    shotLook(color) {
      const T = THEMES[themeOf(color)] || THEMES.default;
      return { look: T.shot, scale: T.shotScale };
    },

    /** 衝撃波（boss.js の spawnNova から）。set(r, width) を毎フレーム、remove() で消す */
    nova(x, z, color) {
      const w = makeWave(x, z, color, themeOf(color));
      const h = {
        set(r, width) {
          w.set(r, width);
        },
        remove() {
          w.remove();
          waves.delete(h);
        },
        tick: (dt) => w.tick(dt),
      };
      waves.add(h);
      w.set(0.5, 0.5);
      return h;
    },

    /** 着地・地割れ・火柱・爆発の衝撃：半径 r まで一気に広がって消える（見た目だけ） */
    impact(x, z, r, color) {
      const w = makeWave(x, z, color, themeOf(color));
      const width = Math.max(0.3, r * 0.1);
      let t = 0;
      const h = {
        tick(dt) {
          t += dt;
          w.tick(dt);
          const k = Math.min(1, t / IMPACT.time);
          const e = 1 - (1 - k) * (1 - k);
          const alpha = t < IMPACT.time ? 1 : Math.max(0, 1 - (t - IMPACT.time) / IMPACT.fade);
          w.set(Math.max(0.3, r * IMPACT.over * e), width, alpha);
          if (alpha <= 0) h.remove();
        },
        remove() {
          w.remove();
          waves.delete(h);
        },
      };
      waves.add(h);
      h.tick(0);
    },

    /** 炎の壁など（hazards.js の wall から）：下ほど濃い光にして、テーマの飾りを並べる */
    dressWall(wl) {
      const theme = themeOf(wl.color);
      const T = THEMES[theme] || THEMES.default;
      wl.mat.map = wallTexture();
      wl.mat.blending = THREE.AdditiveBlending;
      wl.mat.needsUpdate = true;
      const D = DECOR[T.decor] ? T.decor : 'spark';
      const L = 40;
      const xs = [];
      for (const s of [1, -1]) {
        for (let d = 0; d < L; d += WALL.every) xs.push(wl.gapC + s * (wl.gapW / 2 + 0.3 + d));
      }
      const mat = decorMat(D, wl.color);
      const top = new THREE.InstancedMesh(getDecorGeo(D), mat, xs.length * 2);
      top.frustumCulled = false;
      wl.group.add(top);
      walls.add({ wl, top, xs, mat, seeds: xs.map(() => Math.random()), D });
    },

    update(dt) {
      time += dt;
      for (const h of [...waves]) h.tick(dt);
      for (const w of [...walls]) {
        if (!w.wl.group.parent) {
          w.mat.dispose();
          w.top.dispose();
          walls.delete(w);
          continue;
        }
        const DD = DECOR[w.D];
        const n = w.xs.length;
        for (let i = 0; i < n; i++) {
          const sd = w.seeds[i];
          let s = WALL.decorSize * (0.7 + sd * 0.6);
          if (DD.flicker) s *= 0.75 + 0.35 * Math.sin(time * 16 * DD.flicker + sd * 20);
          // 上の縁と、足元（前後に少しずらして2列）
          for (let k = 0; k < 2; k++) {
            tmpO.position.set(w.xs[i] + (k ? 0.5 : 0), k ? 0 : 3, (k ? -1 : 1) * (w.wl.thick / 2 + 0.05));
            tmpO.rotation.set((DD.tilt || 0) * (k ? -1 : 1) * 0.5 + (DD.tumble ? sd * 6 : 0), 0, 0);
            tmpO.scale.setScalar(s * (k ? 0.8 : 1.1));
            tmpO.updateMatrix();
            w.top.setMatrixAt(i * 2 + k, tmpO.matrix);
          }
        }
        w.top.instanceMatrix.needsUpdate = true;
      }
    },

    clear() {
      for (const h of [...waves]) h.remove();
    },
  };
}
