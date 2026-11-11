// 味方の技エフェクト（見た目だけ）。jobs.js・player.js・combat.js から呼ぶ
//   slash 扇の斬撃 / swing 通常攻撃の軌跡 / spin 回転斬り / dash 突進の残像 / slam 着地・叩きつけ
//   beam 光線 / powerUp 自分を強化 / pillar 大きな光の柱 / curse ボスにかかる紋 / summon 召喚陣
//   blink 瞬間移動 / execute とどめの十字斬り / hit 当たったときの光 / zoneAdded メテオ・矢の雨・落雷
//   バフ中の味方の足元には、効果の種類ごとの色の輪が出る（update で自動）
// 数値は src/data/skillfx.js
import * as THREE from 'three';
import { DUR, HIT, BUFF_COLOR, BUFF_IGNORE } from './data/skillfx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { slashTexture, streakTexture, starTexture, crackTexture, sigilTexture, noteTexture, staffTexture, hexGridTexture } from './fxtex.js';
import { wallTexture, fillTexture } from './auratex.js';

const geoCache = new Map();
function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}
/** 扇形（XZ 平面、+Z 向きが真ん中）。UV は平面のままなので、放射状の模様がそのまま乗る */
const sectorGeo = (arc) => geo('sec' + arc.toFixed(2), () => new THREE.CircleGeometry(1, 40, -Math.PI / 2 - arc / 2, arc).rotateX(-Math.PI / 2));
const discGeo = () => geo('disc', () => new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2));
const columnGeo = () => geo('col', () => new THREE.CylinderGeometry(1, 1, 1, 40, 1, true).translate(0, 0.5, 0));
const beamGeo = () => geo('beam', () => new THREE.CylinderGeometry(1, 1, 1, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5));
const ribbonGeo = () => geo('rib', () => new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0)); // +X へ 0..1
const ringGeo = () => geo('ring', () => new THREE.RingGeometry(0.93, 1, 56).rotateX(-Math.PI / 2));

function glow(color, opacity = 1, map = null) {
  return new THREE.MeshBasicMaterial({
    color, map, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2,
  });
}
/** 矢（矢じり・羽根つき）。+Y 向き、長さ約 1.5m。色は頂点色 */
function arrowGeo() {
  return geo('arrow', () => {
    const parts = [];
    const paint = (g, hex) => {
      g = g.index ? g.toNonIndexed() : g;
      const c = new THREE.Color(hex);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      g.deleteAttribute('uv');
      parts.push(g);
    };
    paint(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5), 0x8d6e63);
    paint(new THREE.ConeGeometry(0.1, 0.3, 4).translate(0, 0.8, 0), 0xcfd8dc);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      paint(new THREE.BoxGeometry(0.012, 0.28, 0.15).translate(0, -0.5, 0.08).rotateY(a), 0xa5d6a7);
    }
    paint(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6).translate(0, -0.64, 0), 0x4e342e);
    return mergeGeometries(parts, false);
  });
}

/** 矢の雨：上へ放った矢が落ちてくるまでの間（秒）。この間は矢を降らせない（見た目だけ） */
const RAIN_DELAY = 0.4;

const hotOf = (color, k = 0.5) => new THREE.Color(color).lerp(new THREE.Color(0xffffff), k).getHex();
const ease = (k) => 1 - (1 - k) * (1 - k);

export function createSkillFx(game) {
  const root = new THREE.Group();
  game.scene.add(root);
  const fxs = []; // { t, dur, tick(k, dt), obj, mats }
  const hits = [];

  /** エフェクトを1つ足す。tick(k, dt) は 0→1 で呼ばれる。obj は消すときに外す */
  function add(obj, dur, tick, mats) {
    obj.traverse((o) => {
      o.frustumCulled = false;
      o.renderOrder = 3;
    });
    root.add(obj);
    const f = { t: 0, dur, tick, obj, mats };
    fxs.push(f);
    tick(0, 0);
    return f;
  }
  const mesh = (g, m) => new THREE.Mesh(g, m);

  /** 扇の斬撃。roll：進む向きを軸にした傾き（0＝水平、π/2＝縦斬り） */
  function slash(x, z, yaw, range, arc, color, { y = 1.1, roll = 0, dur = DUR.slash, sweep = 0.5 } = {}) {
    arc = Math.min(arc, Math.PI * 2 - 0.01);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.set(0, yaw, 0);
    const tilt = new THREE.Group();
    tilt.rotation.z = roll;
    g.add(tilt);
    const mBlade = glow(hotOf(color, 0.55), 1, slashTexture());
    const mGlow = glow(color, 0.55, slashTexture());
    const blade = mesh(sectorGeo(arc), mBlade);
    const halo = mesh(sectorGeo(Math.min(Math.PI * 2 - 0.01, arc * 1.1)), mGlow);
    tilt.add(halo, blade);
    add(g, dur, (k) => {
      const e = ease(k);
      const s = Math.max(0.3, range) * (0.7 + 0.35 * e);
      blade.scale.set(s, 1, s);
      halo.scale.set(s * 1.08, 1, s * 1.08);
      blade.rotation.y = halo.rotation.y = (e - 0.5) * sweep;
      mBlade.opacity = (1 - k) ** 1.4;
      mGlow.opacity = 0.55 * (1 - k);
    }, [mBlade, mGlow]);
  }

  /** 着地・叩きつけ：衝撃の輪（敵の衝撃と同じ部品）と、地面のひび割れ */
  function slam(x, z, r, color) {
    game.enemyFx?.impact(x, z, r, color, 'default');
    const m = glow(color, 0.9, crackTexture());
    const d = mesh(discGeo(), m);
    d.position.set(x, 0.04, z);
    d.scale.set(r * 0.9, 1, r * 0.9);
    d.rotation.y = Math.random() * Math.PI;
    add(d, DUR.crack, (k) => {
      m.opacity = k < 0.15 ? 1 : 0.9 * (1 - (k - 0.15) / 0.85);
    }, [m]);
  }

  /** 光の柱（足元から立ち上がる）。follow があればその人についていく */
  function column(x, z, r, h, color, dur, follow = null, opacity = 0.85) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const mCol = glow(color, opacity, wallTexture());
    const mRing = glow(hotOf(color, 0.3), 1);
    const mFill = glow(color, 0.5, fillTexture());
    const col = mesh(columnGeo(), mCol);
    const ring = mesh(ringGeo(), mRing);
    const fill = mesh(discGeo(), mFill);
    ring.position.y = 0.06;
    fill.position.y = 0.05;
    g.add(col, ring, fill);
    add(g, dur, (k) => {
      if (follow) g.position.set(follow.pos.x, 0, follow.pos.z);
      const up = Math.min(1, k / 0.2);
      const fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
      col.scale.set(r * (1 + 0.15 * k), h * ease(up), r * (1 + 0.15 * k));
      const rr = r * (0.6 + 1.0 * ease(Math.min(1, k / 0.4)));
      ring.scale.set(rr, 1, rr);
      fill.scale.set(r, 1, r);
      mCol.opacity = opacity * fade;
      mRing.opacity = fade;
      mFill.opacity = 0.5 * fade;
    }, [mCol, mRing, mFill]);
  }

  /** 地面の魔法陣（ゆっくり回る）。follow があればその相手の足元についていく */
  function sigil(x, z, r, color, dur, follow = null, overhead = false) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const m = glow(color, 1, sigilTexture());
    const d = mesh(discGeo(), m);
    d.position.y = 0.07;
    g.add(d);
    let sp = null;
    let mSp = null;
    if (overhead) {
      mSp = new THREE.SpriteMaterial({ map: sigilTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      sp = new THREE.Sprite(mSp);
      g.add(sp);
    }
    add(g, dur, (k, dt) => {
      if (follow) g.position.set(follow.pos.x, 0, follow.pos.z);
      d.rotation.y += dt * 1.2;
      const a = k < 0.12 ? k / 0.12 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const s = r * (0.8 + 0.2 * ease(Math.min(1, k / 0.2)));
      d.scale.set(s, 1, s);
      m.opacity = a;
      if (sp) {
        sp.position.y = (follow?.hpY ?? 2.5) + 1.2;
        sp.scale.setScalar(1.6);
        mSp.rotation += dt * 1.5;
        mSp.opacity = a;
      }
    }, mSp ? [m, mSp] : [m]);
  }

  /** 横に流れる光の筋（突進・瞬間移動）。(x0,z0) から (x1,z1) へ、先端ほど明るい */
  function streak(x0, z0, x1, z1, width, color, dur, y = 1.0) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.1) return;
    const g = new THREE.Group();
    g.position.set(x0, y, z0);
    g.rotation.y = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    const mA = glow(hotOf(color, 0.25), 1, streakTexture());
    const mB = glow(hotOf(color, 0.6), 0.9, streakTexture());
    const flat = mesh(ribbonGeo(), mA); // 水平
    flat.rotation.x = -Math.PI / 2;
    const up = mesh(ribbonGeo(), mB); // 垂直
    g.add(flat, up);
    add(g, dur, (k) => {
      const w = width * (1 - 0.6 * k);
      flat.scale.set(len, w, 1);
      up.scale.set(len, w * 1.3, 1);
      mA.opacity = 1 - k;
      mB.opacity = 0.9 * (1 - k) ** 2;
    }, [mA, mB]);
  }

  // ---------------- メテオ・矢の雨・落雷（jobs.js の設置物） ----------------
  function zoneFx(z) {
    const g = new THREE.Group();
    g.position.set(z.x, 0, z.z);
    const color = z.kind === 'meteor' ? 0xff7043 : z.kind === 'arrowrain' ? 0xc5e1a5 : z.color ?? 0xfff176;
    const mSig = glow(color, 0.9, sigilTexture());
    const sig = mesh(discGeo(), mSig);
    sig.position.y = 0.07;
    sig.scale.set(z.r, 1, z.r);
    g.add(sig);
    const mats = [mSig];
    let trail = null;
    let arrows = null;
    let bolt = null;
    if (z.kind === 'meteor') {
      const mT = glow(0xff7043, 0.8);
      const mT2 = glow(0xffe082, 0.9);
      trail = new THREE.Group();
      const c1 = mesh(geo('mtrail', () => new THREE.ConeGeometry(1.3, 6, 10).translate(0, 3, 0)), mT);
      const c2 = mesh(geo('mtrail2', () => new THREE.ConeGeometry(0.8, 4, 8).translate(0, 2, 0)), mT2);
      trail.add(c1, c2);
      root.add(trail);
      mats.push(mT, mT2);
    } else if (z.kind === 'arrowrain') {
      const mA = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3e2723 });
      arrows = new THREE.InstancedMesh(arrowGeo(), mA, 24);
      arrows.userData.seeds = Array.from({ length: 24 }, () => [Math.random(), Math.random(), Math.random()]);
      g.add(arrows);
      mats.push(mA);
    } else if (z.kind === 'strike') {
      const mB = glow(color, 0.6, wallTexture());
      bolt = mesh(columnGeo(), mB);
      g.add(bolt);
      mats.push(mB);
    }
    g.traverse((o) => {
      o.frustumCulled = false;
      o.renderOrder = 3;
    });
    root.add(g);
    const t0 = Math.max(0.01, z.t);
    let age = 0;
    const rec = {
      tick(dt) {
        age += dt;
        sig.rotation.y += dt * (z.kind === 'strike' ? 2.5 : 1);
        const left = Math.max(0, z.t);
        const urgency = 1 - left / t0; // 落ちるまでの近さ
        mSig.opacity = 0.55 + 0.45 * urgency * (0.6 + 0.4 * Math.sin(age * (8 + urgency * 20)));
        if (trail && z.rock) {
          trail.position.copy(z.rock.position);
          // 落ちてくる向き（右上から）に尾を伸ばす
          trail.rotation.set(0, 0, Math.atan2(8, 18));
        }
        if (arrows) {
          const tmp = new THREE.Object3D();
          arrows.userData.seeds.forEach(([a, b, c], i) => {
            // 上に放った矢が落ちてくるまで（RAIN_DELAY 秒）は降らせない
            const ph = (Math.max(0, age - RAIN_DELAY) * 1.6 + c) % 1;
            const rr = Math.sqrt(a) * z.r;
            const yy = 9 * (1 - ph) + 0.6;
            tmp.position.set(Math.sin(b * 6.28) * rr + 0.25 * (1 - ph), yy, Math.cos(b * 6.28) * rr);
            tmp.rotation.set(Math.PI, b * 6.28, 0.12);
            tmp.scale.setScalar(ph > 0.96 || age < RAIN_DELAY + c * 0.5 ? 0.01 : 1);
            tmp.updateMatrix();
            arrows.setMatrixAt(i, tmp.matrix);
          });
          arrows.instanceMatrix.needsUpdate = true;
        }
        if (bolt) {
          const w = 0.3 + z.r * 0.25 * urgency;
          bolt.scale.set(w, 9 * urgency, w);
          bolt.material.opacity = 0.15 + 0.6 * urgency;
        }
      },
      remove() {
        root.remove(g);
        if (trail) root.remove(trail);
        mats.forEach((m) => m.dispose());
        arrows?.dispose();
        zoneSet.delete(rec);
      },
    };
    zoneSet.add(rec);
    if (z.mesh && z.kind !== 'meteor') z.mesh.visible = false; // 前の細い輪は魔法陣に置きかえる
    z.aura = rec;
  }
  const zoneSet = new Set();

  // ---------------- バフ中の足元の輪 ----------------
  const buffRings = new Map(); // player → { g, rings: Map(cat → mesh) }
  function buffCats(p) {
    const cats = new Set();
    for (const [name, b] of Object.entries(p.buffs || {})) {
      if (!b || b.t <= 0 || BUFF_IGNORE.includes(name)) continue;
      let any = false;
      if (b.atkMul > 1 || b.mul > 1) { cats.add('atk'); any = true; }
      if (b.dmgMul < 1 || name === 'taunt' || name === 'sanctuary') { cats.add('def'); any = true; }
      if (b.speedMul > 1) { cats.add('speed'); any = true; }
      if (b.regen) { cats.add('regen'); any = true; }
      if (b.hp && name !== 'counter') { cats.add('shield'); any = true; }
      if (b.critAdd) { cats.add('crit'); any = true; }
      if (!any) cats.add('other');
    }
    return cats;
  }
  function updateBuffRings(dt) {
    const seen = new Set();
    for (const p of game.players || []) {
      if (!p.alive) continue;
      const cats = buffCats(p);
      if (!cats.size) continue;
      seen.add(p);
      let rec = buffRings.get(p);
      if (!rec) {
        rec = { g: new THREE.Group(), rings: new Map(), age: 0 };
        root.add(rec.g);
        buffRings.set(p, rec);
      }
      rec.age += dt;
      rec.g.position.set(p.pos.x, 0, p.pos.z);
      let i = 0;
      for (const c of Object.keys(BUFF_COLOR)) {
        let m = rec.rings.get(c);
        if (cats.has(c)) {
          if (!m) {
            m = mesh(geo('bsig', () => new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)), glow(BUFF_COLOR[c], 0.8, sigilTexture()));
            m.frustumCulled = false;
            rec.g.add(m);
            rec.rings.set(c, m);
          }
          const r = 0.9 + i * 0.35;
          m.scale.set(r, 1, r);
          m.position.y = 0.05 + i * 0.005;
          m.rotation.y += dt * (i % 2 ? -1.4 : 1.4);
          m.material.opacity = 0.55 + 0.25 * Math.sin(rec.age * 4 + i);
          i++;
        } else if (m) {
          rec.g.remove(m);
          m.material.dispose();
          rec.rings.delete(c);
        }
      }
    }
    for (const [p, rec] of buffRings) {
      if (seen.has(p)) continue;
      root.remove(rec.g);
      rec.rings.forEach((m) => m.material.dispose());
      buffRings.delete(p);
    }
  }

  // ---------------- 影分身中の紫の枠（画面の縁） ----------------
  let cloneFrame = null;
  let frameT = 0;
  function updateCloneFrame(dt) {
    if (typeof document === 'undefined') return;
    const me = game.me?.();
    const b = me?.alive ? me.buffs?.clone : null;
    if (!b && !cloneFrame) return;
    if (!cloneFrame) {
      cloneFrame = document.createElement('div');
      cloneFrame.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;opacity:0;transition:opacity .2s;'
        + 'box-shadow:inset 0 0 70px 16px rgba(179,136,255,.55);border:4px solid rgba(179,136,255,.75);box-sizing:border-box';
      document.body.appendChild(cloneFrame);
    }
    frameT += dt;
    let o = 0;
    if (b && b.t > 0) {
      o = 0.75 + 0.25 * Math.sin(frameT * 4);
      if (b.t < 1.5) o *= Math.sin(frameT * 18) > 0 ? 1 : 0.25; // もうすぐ切れる
    }
    cloneFrame.style.opacity = o.toFixed(2);
  }

  return {
    slash(x, z, yaw, range, arc, color, o) {
      slash(x, z, yaw, range, arc, color, o);
    },
    /** 通常攻撃の剣の軌跡。combo：何段目、last：最後の段（縦斬り） */
    swing(p, combo, last, range, arc, color) {
      const roll = last ? Math.PI / 2 * 0.9 : combo % 2 ? -0.5 : 0.5;
      slash(p.pos.x, p.pos.z, p.yaw, range * 0.95, Math.min(arc, 2.4), color, { y: 1.15, roll, dur: DUR.swing, sweep: combo % 2 ? -0.9 : 0.9 });
    },
    /** 回転斬り（周囲の範囲攻撃） */
    spin(x, z, r, color) {
      slash(x, z, Math.random() * 6, r, Math.PI * 2, color, { y: 0.95, dur: DUR.spin, sweep: 2.5 });
      slash(x, z, Math.random() * 6, r * 0.8, Math.PI * 2, color, { y: 1.35, dur: DUR.spin, sweep: -2.5 });
      game.enemyFx?.impact(x, z, r, color, 'default');
    },
    /** 突進：出発点から dist 先まで残像の筋 */
    dash(p, yaw, dist, width, color) {
      const x0 = p.pos.x;
      const z0 = p.pos.z;
      streak(x0, z0, x0 + Math.sin(yaw) * dist, z0 + Math.cos(yaw) * dist, Math.max(0.8, width * 1.2), color, DUR.dash);
      streak(x0, z0, x0 + Math.sin(yaw) * dist, z0 + Math.cos(yaw) * dist, 0.25, 0xffffff, DUR.dash * 0.8, 1.5);
    },
    slam,
    /** 光線：(x,z) から yaw 向きへ。壁で止まる */
    beam(x, z, yaw, len, width, color) {
      const s = Math.sin(yaw);
      const c = Math.cos(yaw);
      let L = 1;
      while (L < len && !game.world?.blocked?.(x + s * L, z + c * L, true)) L += 0.6;
      const g = new THREE.Group();
      g.position.set(x + s * 0.6, 1.2, z + c * 0.6);
      g.rotation.y = yaw;
      const mCore = glow(hotOf(color, 0.7), 1);
      const mGlow = glow(color, 0.55);
      const core = mesh(beamGeo(), mCore);
      const outer = mesh(beamGeo(), mGlow);
      const mEnd = new THREE.SpriteMaterial({ map: starTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const end = new THREE.Sprite(mEnd);
      end.position.z = L;
      g.add(outer, core, end);
      add(g, DUR.beam, (k) => {
        const w = Math.max(0.15, width) * (1 - k * 0.7);
        core.scale.set(w * 0.22, w * 0.22, L);
        outer.scale.set(w * 0.55, w * 0.55, L);
        end.scale.setScalar(2.2 * (1 - k * 0.5));
        mCore.opacity = 1 - k;
        mGlow.opacity = 0.55 * (1 - k);
        mEnd.opacity = 1 - k;
      }, [mCore, mGlow, mEnd]);
    },
    /** 自分を強化：足元から光の柱 */
    powerUp(p, color, big = false) {
      column(p.pos.x, p.pos.z, big ? 1.4 : 0.95, big ? 4 : 2.8, color, DUR.powerUp, p);
    },
    /** 大きな光の柱（女神の祈り・全員蘇生など） */
    pillar(x, z, color, r = 1.8) {
      column(x, z, r, 14, color, DUR.pillar, null, 0.95);
    },
    /** ボスにかかる紋（弱体化・時間停止・印） */
    curse(target, color) {
      sigil(target.pos.x, target.pos.z, (target.radius || 1.5) + 1.8, color, DUR.curse, target, true);
    },
    /** 召喚陣 */
    summon(x, z, color) {
      sigil(x, z, 2, color, DUR.summon);
      column(x, z, 1.1, 3, color, DUR.summon * 0.8);
    },
    /** 瞬間移動：出発点と到着点に光、間に筋 */
    blink(x0, z0, x1, z1, color) {
      column(x0, z0, 0.7, 3, color, 0.45);
      column(x1, z1, 0.7, 3, color, 0.45);
      streak(x0, z0, x1, z1, 0.5, color, 0.35, 1.2);
    },
    /** とどめの一撃：相手の上で大きく交差する斬撃 */
    execute(p, target, color) {
      const yaw = Math.atan2(target.pos.x - p.pos.x, target.pos.z - p.pos.z);
      const y = (target.hpY || 2.5) * 0.55;
      const bx = target.pos.x - Math.sin(yaw) * 2;
      const bz = target.pos.z - Math.cos(yaw) * 2;
      slash(bx, bz, yaw, 4.5, 1.6, color, { y, roll: 0.9, dur: 0.45, sweep: 1.2 });
      slash(bx, bz, yaw, 4.5, 1.6, color, { y, roll: -0.9, dur: 0.45, sweep: -1.2 });
    },
    /** 当たったときの光。from（撃った人）があれば、相手の体の手前（その人の側）に出す */
    hit(target, color, crit, from = null) {
      if (hits.length >= HIT.max) {
        const old = hits.shift();
        old.t = old.dur;
      }
      const m = new THREE.SpriteMaterial({ map: starTexture(), color: crit ? HIT.critColor : hotOf(color, 0.4), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, rotation: Math.random() * Math.PI });
      const s = new THREE.Sprite(m);
      const y = (target.hpY ?? 2) * 0.55;
      let ox = 0;
      let oz = 0;
      if (from?.pos) {
        const dx = from.pos.x - target.pos.x;
        const dz = from.pos.z - target.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        const r = (target.radius || 0.8) * 0.9;
        ox = (dx / len) * r;
        oz = (dz / len) * r;
      }
      s.position.set(target.pos.x + ox + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.6, target.pos.z + oz + (Math.random() - 0.5) * 0.5);
      const size = crit ? HIT.critSize : HIT.size;
      const f = add(s, DUR.hit, (k) => {
        s.scale.setScalar(size * (k < 0.3 ? 0.4 + 2 * k : 1 - (k - 0.3) * 0.6));
        m.opacity = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
      }, [m]);
      hits.push(f);
    },
    /** 盾の壁（シールドバッシュ）：構えた盾の前に水色の六角の壁を出し、そのまま突っ込む。p についていく */
    shieldWall(p, dur, color = 0x80d8ff) {
      const tex = hexGridTexture();
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.set(2, 1);
      const g = new THREE.Group();
      const wallG = geo('shieldWall', () => new THREE.CylinderGeometry(1.8, 1.8, 2.3, 24, 1, true, -0.95, 1.9).translate(0, 1.15, 0));
      const mW = glow(color, 0.8, tex);
      const mF = glow(hotOf(color, 0.6), 0.9);
      const wall = mesh(wallG, mW);
      const front = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      front.position.set(0, 1.2, 1.85);
      const mFr = front.material;
      const base = mesh(geo('shieldBase', () => new THREE.RingGeometry(1.7, 1.85, 24, 1, -Math.PI / 2 - 0.95, 1.9).rotateX(-Math.PI / 2)), mF);
      base.position.y = 0.06;
      g.add(wall, base, front);
      add(g, dur + 0.25, (k) => {
        g.position.set(p.pos.x, 0, p.pos.z);
        g.rotation.y = p.yaw;
        const T = dur + 0.25;
        const t = k * T;
        const grow = Math.min(1, t / 0.1);
        const end = t > dur ? (t - dur) / 0.25 : 0; // 突撃が終わったら砕けて消える
        const s = (0.5 + 0.5 * ease(grow)) * (1 + end * 0.35);
        g.scale.set(s, 0.8 + 0.2 * ease(grow), s);
        mW.opacity = 0.8 * (1 - end) * (0.85 + 0.15 * Math.sin(t * 40));
        mF.opacity = 0.9 * (1 - end);
        front.scale.setScalar(1.6 + Math.sin(t * 30) * 0.3);
        mFr.opacity = 0.8 * (1 - end);
      }, [mW, mF, mFr]);
    },

    /** 矢の雨の前に、上へ矢を放つ（見た目だけ） */
    volleyUp(p, color = 0xc5e1a5) {
      const g = new THREE.Group();
      g.position.set(p.pos.x, 1.5, p.pos.z);
      const mA = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3e2723 });
      const mT = glow(color, 0.8, streakTexture());
      const arrows = [];
      for (let i = 0; i < 7; i++) {
        const a = new THREE.Group();
        const ang = (i - 3) * 0.09;
        a.rotation.order = 'YXZ';
        a.rotation.set(0.18, p.yaw, ang); // 扇に広げ、少し前へ傾けて真上へ
        const m = mesh(arrowGeo(), mA);
        const tr = mesh(ribbonGeo(), mT); // 後ろに伸びる光の筋（下向き）
        tr.rotation.z = -Math.PI / 2;
        tr.position.y = -0.6;
        a.add(m, tr);
        g.add(a);
        arrows.push({ a, m, tr, sp: 34 + Math.random() * 8 });
      }
      add(g, 0.5, (k) => {
        const t = k * 0.5;
        for (const o of arrows) {
          o.m.position.y = o.sp * t;
          o.tr.position.y = o.sp * t - 0.6;
          o.tr.scale.set(Math.min(4, o.sp * t), 0.25, 1);
        }
        mT.opacity = 0.8 * (1 - k);
      }, [mA, mT]);
    },

    /**
     * 楽譜の輪：五線譜の輪が広がり、音符が乗って踊る。mood：'hype'（疾風の旋律：速く・にぎやか）／'lonely'（勇気の歌：ゆっくり・寂しげ）
     */
    songRing(x, z, r, color, mood = 'hype') {
      const hype = mood === 'hype';
      const base = hype ? color : new THREE.Color(color).lerp(new THREE.Color(0x90a4ae), 0.5).getHex();
      const dur = hype ? 1.7 : 2.6;
      const grow = hype ? 0.45 : 1.3;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const staffTex = staffTexture();
      staffTex.wrapS = THREE.RepeatWrapping;
      staffTex.repeat.set(10, 1);
      const ringG = geo('staffRing', () => new THREE.CylinderGeometry(1, 1, 0.9, 64, 1, true));
      const rings = [];
      const mats = [];
      for (let i = 0; i < (hype ? 2 : 1); i++) {
        const m = glow(i ? hotOf(base, 0.5) : base, hype ? 0.95 : 0.6, staffTex);
        const ring = mesh(ringG, m);
        g.add(ring);
        rings.push({ ring, m, delay: i * 0.15, y: i ? 2.0 : 1.3 });
        mats.push(m);
      }
      // 地面の輪
      const mGround = glow(base, hype ? 0.7 : 0.4);
      const ground = mesh(ringGeo(), mGround);
      ground.position.y = 0.06;
      g.add(ground);
      mats.push(mGround);
      // 音符
      const palette = hype ? [color, 0xffd740, 0x40c4ff, 0xffffff, 0xff80ab] : [base];
      const notes = [];
      const n = hype ? 18 : 7;
      for (let i = 0; i < n; i++) {
        const m = new THREE.SpriteMaterial({ map: noteTexture(i % 3 === 0 ? 'two' : 'one'), color: palette[i % palette.length], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const sp = new THREE.Sprite(m);
        g.add(sp);
        mats.push(m);
        notes.push({ sp, m, a: (i / n) * Math.PI * 2 + Math.random() * 0.3, ph: Math.random() * 6, lane: i % 2 });
      }
      add(g, dur, (k, dt) => {
        const t = k * dur;
        for (const o of rings) {
          const tt = Math.max(0, t - o.delay);
          const e = ease(Math.min(1, tt / grow));
          const rr = Math.max(0.3, r * e);
          o.ring.scale.set(rr, hype ? 1 + 0.15 * Math.sin(t * 18) : 1, rr);
          o.ring.position.y = o.y + (hype ? Math.sin(t * 9) * 0.15 : -t * 0.15);
          o.ring.rotation.y += dt * (hype ? 2.2 : 0.35) * (o.delay ? -1 : 1);
          const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
          o.m.opacity = (hype ? 0.95 : 0.6) * fade * (tt > 0 ? 1 : 0);
        }
        const e0 = ease(Math.min(1, t / grow));
        const gr = Math.max(0.3, r * e0);
        ground.scale.set(gr, 1, gr);
        mGround.opacity = (hype ? 0.7 : 0.4) * (1 - k);
        for (const o of notes) {
          const ang = o.a + t * (hype ? 1.4 : 0.25);
          const rr = gr * (hype ? 1 : 0.95 + 0.05 * Math.sin(o.ph));
          let y;
          let s;
          if (hype) {
            // 跳ねながら上へ（盛り上がる）
            y = 1.2 + o.lane * 0.7 + Math.abs(Math.sin(t * 7 + o.ph)) * 0.9 + t * 0.8;
            s = 0.55 + 0.25 * Math.abs(Math.sin(t * 7 + o.ph));
          } else {
            // ゆっくり沈みながら揺れる（寂しげ）
            y = 1.6 + o.lane * 0.4 - t * 0.45 + Math.sin(t * 1.5 + o.ph) * 0.12;
            s = 0.45;
          }
          o.sp.position.set(Math.sin(ang) * rr, Math.max(0.3, y), Math.cos(ang) * rr);
          o.sp.scale.setScalar(s * Math.min(1, t / 0.15));
          o.m.opacity = (k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35) * (hype ? 1 : 0.7);
          o.m.rotation = hype ? Math.sin(t * 6 + o.ph) * 0.4 : Math.sin(t * 1.2 + o.ph) * 0.2;
        }
      }, mats);
      if (hype) column(x, z, 1.3, 4.5, color, 0.7);
    },

    /** メテオ・矢の雨・落雷（auras.js の zoneAdded から回ってくる） */
    zoneAdded(z) {
      if (z.kind === 'meteor' || z.kind === 'arrowrain' || z.kind === 'strike') zoneFx(z);
    },

    update(dt) {
      for (let i = fxs.length - 1; i >= 0; i--) {
        const f = fxs[i];
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        f.tick(k, dt);
        if (k >= 1) {
          root.remove(f.obj);
          f.mats.forEach((m) => m.dispose());
          fxs.splice(i, 1);
          const hi = hits.indexOf(f);
          if (hi >= 0) hits.splice(hi, 1);
        }
      }
      for (const z of zoneSet) z.tick(dt);
      updateBuffRings(dt);
      updateCloneFrame(dt);
    },

    clear() {
      for (const f of fxs) {
        root.remove(f.obj);
        f.mats.forEach((m) => m.dispose());
      }
      fxs.length = 0;
      hits.length = 0;
    },
  };
}
