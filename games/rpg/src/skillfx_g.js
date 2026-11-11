// 技エフェクト（その7）：聖騎士・拳銃使い・鎖鎌使い。skillfx.js から呼ぶ
//   smiteStart・smiteHit 聖撃（振りかぶって聖なる縦斬り） / divineFx 神の盾（天使の翼・大きな盾・羽マークの金の輪）
//   muzzle 拳銃の銃口が光る / grappleFx 鎖の飛びつき（鎖を飛ばし、斜め上へ跳んで右上→左下へ振る）
//   chainBind 鎖縛り（鎖を飛ばして体に巻きつける） / stormStart・stormTick 鎖嵐（×字の超高速斬り）
import * as THREE from 'three';
import { geo, glow, hotOf, ease } from './fxkit.js';
import { starTexture, wingIconTexture, glyphTexture } from './fxtex.js';
import { WEAPONS } from './weaponmodel.js';
import { GUN_JOBS } from './data/skillvis.js';

const sprite = (map, color, opacity = 1) => new THREE.SpriteMaterial({
  map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
});
const GOLD = 0xffd54f;

// ---------------- 鎖（輪をつないだ形。InstancedMesh で並べる） ----------------
const LINK = 0.17; // 輪の間隔
function linkGeo() {
  return geo('chainLink', () => new THREE.TorusGeometry(0.085, 0.024, 4, 10).scale(1, 1.45, 1));
}
function chainMat() {
  return new THREE.MeshLambertMaterial({ color: 0xb0bec5, emissive: 0x263238, flatShading: true });
}
const tmp = new THREE.Object3D();
const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
/** im の start 番目から、点の列（pts）に沿って輪を並べる。並べた数を返す */
function layChain(im, pts, start = 0) {
  let i = start;
  let need = 0; // 今の区間の始めから、次の輪までの距離
  for (let s = 0; s < pts.length - 1 && i < im.count; s++) {
    vA.copy(pts[s]);
    vB.subVectors(pts[s + 1], pts[s]);
    const len = vB.length();
    if (len < 1e-4) continue;
    vB.divideScalar(len);
    let d = need;
    for (; d < len && i < im.count; d += LINK) {
      tmp.position.copy(vA).addScaledVector(vB, d);
      tmp.quaternion.setFromUnitVectors(UP, vB);
      tmp.rotateY(i % 2 ? Math.PI / 2 : 0); // 輪を交互に90°ひねる
      tmp.scale.setScalar(1);
      tmp.updateMatrix();
      im.setMatrixAt(i++, tmp.matrix);
    }
    need = d - len;
  }
  return i;
}
function hideRest(im, from) {
  tmp.scale.setScalar(0.0001);
  tmp.position.set(0, -50, 0);
  tmp.updateMatrix();
  for (let i = from; i < im.count; i++) im.setMatrixAt(i, tmp.matrix);
  im.instanceMatrix.needsUpdate = true;
}

/** 天使の翼（片側）：羽根を扇に並べる。+X へ広がる */
function angelWing(mat, glowMat) {
  const g = new THREE.Group();
  const feather = geo('angelFeather', () => new THREE.SphereGeometry(1, 8, 4).scale(0.5, 0.1, 0.06).translate(0.5, 0, 0));
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(feather, row === 2 ? glowMat : mat);
      const len = (1.2 - row * 0.3) * (0.7 + i * 0.12);
      f.scale.set(len, 1 + row * 0.2, 1);
      f.position.set(0.1 * row, -0.05 * row, -0.02 * row);
      f.rotation.z = 0.9 - i * 0.28 - row * 0.05;
      g.add(f);
    }
  }
  return g;
}

export function createSkillFxG({ game, root, add, mesh, slash, column, slam }) {
  const fx = () => game.skillFx;
  function flash(x, y, z, color, size, dur) {
    const m = sprite(starTexture(), color);
    const sp = new THREE.Sprite(m);
    sp.position.set(x, y, z);
    add(sp, dur, (k) => {
      sp.scale.setScalar(size * (0.6 + 0.8 * ease(Math.min(1, k * 3))));
      m.opacity = 1 - k;
    }, [m]);
  }

  // ---------------- 聖騎士 ----------------
  function smiteStart(p, sk) {
    p.vmAnim = { kind: 'iai', t: 0, dur: (sk.windup || 0.15) + 0.25 };
    column(p.pos.x, p.pos.z, 0.8, 3, GOLD, (sk.windup || 0.15) + 0.1, p, 0.5);
  }
  function smiteHit(p, sk) {
    const yaw = p.yaw;
    const fx0 = p.pos.x + Math.sin(yaw) * 1.8;
    const fz0 = p.pos.z + Math.cos(yaw) * 1.8;
    slash(p.pos.x, p.pos.z, yaw, sk.radius + 0.6, 1.3, 0xffffff, { y: 1.5, roll: Math.PI / 2, dur: 0.32, sweep: 1.1 });
    slash(p.pos.x, p.pos.z, yaw, sk.radius + 1.2, 1.2, GOLD, { y: 1.45, roll: Math.PI / 2, dur: 0.42, sweep: 1.0 });
    column(fx0, fz0, 1.1, 7, 0xfff8e1, 0.5, null, 0.9); // 天から光の柱
    slam(p.pos.x, p.pos.z, sk.radius, GOLD);
    flash(fx0, 1, fz0, GOLD, 7, 0.45);
    flash(fx0, 1, fz0, 0xffffff, 3.5, 0.3);
    game.fx?.burst?.(fx0, 0.6, fz0, 0xfff59d, 30, { speed: 8, up: 7, life: 0.6, size: 0.16 });
    game.fx?.shake?.(0.5);
  }

  /** 神の盾：使った人に天使の翼と大きな盾。羽マークの金の輪が広がる */
  function divineFx(p, sk) {
    const dur = sk.dur || 6;
    const R = sk.radius || 12;
    fx().iconRing?.(p, R, GOLD, wingIconTexture(), 12, 1.4, 0.8);
    fx().iconRing?.(p, R * 0.6, 0xfff8e1, wingIconTexture(), 8, 1.1, 0.4);
    column(p.pos.x, p.pos.z, 1.4, 7, 0xfff59d, 0.6, p, 0.45);
    flash(p.pos.x, 2.5, p.pos.z, GOLD, 10, 0.6);
    game.fx?.shake?.(0.35);
    const body = p.model?.root;
    if (!body) return;
    // 背中の翼
    const mF = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xa08850, flatShading: true, side: THREE.DoubleSide });
    const mG = glow(0xfff59d, 0.7);
    const wings = new THREE.Group();
    wings.position.set(0, 1.75, -0.28);
    const L = angelWing(mF, mG);
    const Rw = angelWing(mF, mG);
    L.scale.x = -1;
    wings.add(L, Rw);
    body.add(wings);
    // 盾を大きく、金色に光らせる
    const shield = p.model.shield;
    const s0 = shield ? shield.scale.clone() : null;
    let sGlow = null;
    const mS = glow(GOLD, 0.6);
    if (shield) {
      shield.geometry.computeBoundingBox();
      const sz = shield.geometry.boundingBox.getSize(new THREE.Vector3());
      sGlow = new THREE.Mesh(new THREE.BoxGeometry(sz.x * 1.6, sz.y * 1.08, sz.z * 1.08), mS);
      shield.add(sGlow);
    }
    add(new THREE.Group(), dur, (k) => {
      const t = k * dur;
      const inK = ease(Math.min(1, t / 0.4));
      const outK = Math.max(0, (t - dur + 0.5) / 0.5);
      const s = Math.max(0.01, inK * (1 - outK));
      wings.scale.setScalar(s * 1.7);
      const flap = Math.sin(t * 3) * 0.18;
      L.rotation.y = 0.35 + flap;
      Rw.rotation.y = -0.35 - flap;
      L.rotation.z = Rw.rotation.z = 0.1 + flap * 0.5;
      mG.opacity = 0.5 + 0.3 * Math.sin(t * 6);
      if (shield) {
        const b = 1 + 0.75 * s;
        shield.scale.set(s0.x * b, s0.y * b, s0.z * b);
        mS.opacity = (0.35 + 0.25 * Math.sin(t * 7)) * s;
      }
      if (k >= 1) {
        body.remove(wings);
        mF.dispose();
        mG.dispose();
        if (shield) {
          shield.remove(sGlow);
          sGlow.geometry.dispose();
          shield.scale.copy(s0);
        }
        mS.dispose();
      }
    }, []);
  }

  // ---------------- 拳銃使い ----------------
  function muzzle(p) {
    const spec = WEAPONS[p.jobId];
    if (!spec?.muzzle && !GUN_JOBS.includes(p.jobId)) return;
    p.muzzleT = 0.07; // 一人称の銃口の光（viewmodel.js）
    if (p === game.me?.() && p.hideBody) return; // 一人称の自分は手元で光らせる
    const x = p.pos.x + Math.sin(p.yaw) * 0.95 + Math.cos(p.yaw) * -0.3;
    const z = p.pos.z + Math.cos(p.yaw) * 0.95 - Math.sin(p.yaw) * -0.3;
    flash(x, 1.3, z, 0xffe0b2, 1.4, 0.08);
  }

  // ---------------- 鎖鎌使い ----------------
  /** 鎖を from → to へ伸ばして、縮めて消す（飛びつき・縛りの鎖を投げる） */
  function throwChain(from, getTo, outT, hold, back, color = 0xb0bec5) {
    const n = 140;
    const m = chainMat();
    const im = new THREE.InstancedMesh(linkGeo(), m, n);
    im.frustumCulled = false;
    const g = new THREE.Group();
    g.add(im);
    const head = new THREE.Sprite(sprite(starTexture(), color));
    g.add(head);
    const total = outT + hold + back;
    add(g, total, (k) => {
      const t = k * total;
      const a = typeof from === 'function' ? from() : from;
      const b = getTo();
      const u = t < outT ? ease(t / outT) : t < outT + hold ? 1 : 1 - (t - outT - hold) / back;
      const end = new THREE.Vector3().lerpVectors(a, b, Math.max(0, u));
      // 少したるませる
      const mid = new THREE.Vector3().lerpVectors(a, end, 0.5);
      mid.y -= 0.25 * Math.min(1, a.distanceTo(end) / 8) * (t < outT ? 0.3 : 1);
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const s = i / 12;
        pts.push(new THREE.Vector3(
          (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * mid.x + s * s * end.x,
          (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * mid.y + s * s * end.y,
          (1 - s) * (1 - s) * a.z + 2 * (1 - s) * s * mid.z + s * s * end.z,
        ));
      }
      hideRest(im, layChain(im, pts));
      head.position.copy(end);
      head.scale.setScalar(0.9);
      head.material.opacity = t < outT ? 1 : 0.4;
    }, [m, head.material, im]);
  }
  const handOf = (p) => new THREE.Vector3(p.pos.x + Math.sin(p.yaw + 0.5) * 0.5, 1.4 + (p.model?.root?.position.y || 0), p.pos.z + Math.cos(p.yaw + 0.5) * 0.5);

  /** 鎖の飛びつき：ボスへ鎖を飛ばし、斜め上へ跳び上がりながら、右上から左下へ鎖鎌を振る */
  function grappleFx(p, d, sk) {
    const target = { x: d.bx, z: d.bz };
    const boss = game.bosses?.find((b) => Math.abs(b.pos.x - d.bx) < 0.5 && Math.abs(b.pos.z - d.bz) < 0.5);
    const to = () => new THREE.Vector3(boss ? boss.pos.x : target.x, boss ? Math.min(2.5, (boss.hpY ?? 2.5) * 0.55) : 1.5, boss ? boss.pos.z : target.z);
    throwChain(() => handOf(p), to, 0.1, (sk.time || 0.3) * 0.7, 0.12);
    p.vmAnim = { kind: 'chainswing', t: 0, dur: (sk.time || 0.3) + 0.3 };
    // 斜め上へ跳ぶ（見た目の高さ。一人称の視点も上がる）
    const T = (sk.time || 0.3) + 0.12;
    add(new THREE.Group(), T, (k) => {
      if (p.model?.root) p.model.root.position.y = k >= 1 ? 0 : Math.sin(k * Math.PI) * 2.2;
    }, []);
    // 飛びついた瞬間：右上→左下の斜めの斬撃
    setTimeout(() => {
      const yaw = Math.atan2(target.x - p.pos.x, target.z - p.pos.z) || p.yaw;
      slash(p.pos.x, p.pos.z, yaw, 4, 2.4, 0xffffff, { y: 1.6, roll: -0.85, dur: 0.28, sweep: 1.6 });
      slash(p.pos.x, p.pos.z, yaw, 4.6, 2.2, sk.color || 0x90a4ae, { y: 1.55, roll: -0.85, dur: 0.36, sweep: 1.5 });
      game.fx?.shake?.(0.35);
    }, (sk.time || 0.3) * 1000 * 0.8);
  }

  /** 鎖縛り：鎖を投げ、ボスの体にぐるぐる巻きつける（dur 秒） */
  function chainBind(p, b, dur) {
    const fly = 0.25;
    throwChain(() => handOf(p), () => new THREE.Vector3(b.pos.x, Math.min(2.5, (b.hpY ?? 2.5) * 0.55), b.pos.z), fly, 0.15, 0.15);
    const n = 260;
    const m = chainMat();
    const im = new THREE.InstancedMesh(linkGeo(), m, n);
    im.frustumCulled = false;
    const g = new THREE.Group();
    g.add(im);
    const mG = glow(0xcfd8dc, 0.0);
    const ringGlow = mesh(geo('bindGlow', () => new THREE.CylinderGeometry(1, 1, 1, 24, 1, true)), mG);
    g.add(ringGlow);
    const total = dur + fly;
    add(g, total, (k, dt) => {
      const t = k * total;
      g.position.set(b.pos.x, 0, b.pos.z);
      if (t < fly || !b.alive) {
        hideRest(im, 0);
        return;
      }
      const u = Math.min(1, (t - fly) / 0.35); // 巻きつく
      const H = b.hpY ?? 2.5;
      const R = (b.radius ?? 1.2) * 0.9 + 0.15;
      const r = R * (1 + 1.4 * (1 - ease(u))); // 外から締まる
      // 2本の鎖を、逆向きのらせんで巻く
      let i = 0;
      for (const dir of [1, -1]) {
        const pts = [];
        const turns = 3;
        for (let s = 0; s <= 72; s++) {
          const f = s / 72;
          if (f > u + 0.02) break;
          const a = dir * f * turns * Math.PI * 2 + (dir < 0 ? Math.PI : 0) + t * 0.2;
          pts.push(new THREE.Vector3(Math.sin(a) * r, H * (0.15 + 0.7 * f), Math.cos(a) * r));
        }
        if (pts.length > 1) i = layChain(im, pts, i);
      }
      hideRest(im, i);
      ringGlow.scale.set(R * 1.05, H * 0.8, R * 1.05);
      ringGlow.position.y = H * 0.55;
      const fade = k > 0.92 ? 1 - (k - 0.92) / 0.08 : 1;
      mG.opacity = (u < 1 ? 0.5 * (1 - u) : 0.08 + 0.05 * Math.sin(t * 6)) * fade;
      im.visible = fade > 0.05;
    }, [m, mG, im]);
    setTimeout(() => {
      flash(b.pos.x, (b.hpY ?? 2.5) * 0.5, b.pos.z, 0xeceff1, 5, 0.35);
      game.fx?.shake?.(0.3);
    }, fly * 1000);
  }

  /** 鎖嵐：まわりを鎖が高速で回り、×字に斬りまくる */
  function stormStart(p, sk) {
    const ticks = sk.ticks || 8;
    const every = sk.every || 0.12;
    const D = ticks * every + 0.3;
    p.vmAnim = { kind: 'xstorm', t: 0, dur: D, every };
    // 体のまわりを回る鎖の輪（2本）
    const n = 200;
    const m = chainMat();
    const im = new THREE.InstancedMesh(linkGeo(), m, n);
    im.frustumCulled = false;
    const g = new THREE.Group();
    g.add(im);
    const mW = glow(0xeceff1, 0.5);
    const blur = mesh(geo('stormBlur', () => new THREE.RingGeometry(0.88, 1, 48).rotateX(-Math.PI / 2)), mW);
    g.add(blur);
    add(g, D, (k) => {
      const t = k * D;
      g.position.set(p.pos.x, 0, p.pos.z);
      const R = sk.radius || 5;
      let i = 0;
      for (const [ph, tilt, h] of [[0, 0.35, 1.3], [Math.PI, -0.3, 1.0]]) {
        const pts = [];
        for (let s = 0; s <= 40; s++) {
          const a = ph + t * 22 + (s / 40) * 2.2; // 鎖が円弧になって高速で回る
          const rr = R * (0.35 + 0.65 * (s / 40));
          pts.push(new THREE.Vector3(Math.sin(a) * rr, h + Math.sin(a) * tilt * (s / 40), Math.cos(a) * rr));
        }
        i = layChain(im, pts, i);
      }
      hideRest(im, i);
      blur.scale.set(R, 1, R);
      blur.position.y = 1.2;
      blur.rotation.y = t * 22;
      mW.opacity = 0.18 * (k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15);
    }, [m, mW, im]);
  }
  function stormTick(p, sk, n) {
    // ×字：右上→左下、左上→右下を交互に（2枚ずつ、少しずらして）
    const roll = n % 2 ? -0.85 : 0.85;
    for (let j = 0; j < 2; j++) {
      const yaw = p.yaw + (Math.random() - 0.5) * 1.4 + j * Math.PI;
      slash(p.pos.x, p.pos.z, yaw, (sk.radius || 5) - j * 0.6, 2.6, j ? 0xffffff : sk.color, { y: 1.3 + (Math.random() - 0.5) * 0.4, roll, dur: 0.2, sweep: n % 2 ? 1.8 : -1.8 });
    }
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * ((sk.radius || 5) - 1.5);
    flash(p.pos.x + Math.sin(a) * r, 1.2, p.pos.z + Math.cos(a) * r, 0xffffff, 2.2, 0.18);
    game.fx?.burst?.(p.pos.x + Math.sin(a) * r, 1.2, p.pos.z + Math.cos(a) * r, 0xffe082, 10, { speed: 7, up: 3, life: 0.3, size: 0.1, grav: 4 });
    game.fx?.shake?.(0.15);
  }

  // ---------------- 双子の入れ替わり ----------------
  const twinMarks = new Map(); // プレイヤー → 場に置いたハート
  function heartBurst(x, y, z, color, n, speed) {
    const g = new THREE.Group();
    const parts = [];
    const mats = [];
    for (let i = 0; i < n; i++) {
      const m = sprite(glyphTexture('♥'), color);
      const sp = new THREE.Sprite(m);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      g.add(sp);
      mats.push(m);
      parts.push({ sp, m, v: new THREE.Vector3(Math.sin(a) * speed, 1.5 + Math.random() * 3, Math.cos(a) * speed) });
    }
    g.position.set(x, y, z);
    add(g, 0.7, (k, dt) => {
      for (const q of parts) {
        q.sp.position.addScaledVector(q.v, dt);
        q.v.multiplyScalar(1 - dt * 3);
        q.sp.scale.setScalar(0.55 * (1 - k * 0.5));
        q.m.opacity = 1 - k;
      }
    }, mats);
  }
  /** 場に置くハート（次に使うと、ここまで斬り抜ける） */
  function placeMark(p, x, z, color, killOldAfter = 0) {
    const old = twinMarks.get(p);
    if (old) setTimeout(() => { old.dead = true; }, killOldAfter * 1000); // 行き先のハートは、たどり着いたら消える
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const mH = sprite(glyphTexture('♥'), color);
    const heart = new THREE.Sprite(mH);
    const mR = glow(color, 0.8);
    const ring = mesh(geo('twinRing', () => new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2)), mR);
    ring.position.y = 0.08;
    g.add(heart, ring);
    const rec = { dead: false, x, z };
    twinMarks.set(p, rec);
    let fade = 1;
    add(g, 600, (k, dt) => {
      const t = k * 600;
      if (rec.dead) fade -= dt * 4;
      heart.position.y = 1.4 + Math.sin(t * 2.5) * 0.15;
      heart.scale.setScalar(1.3 * Math.min(1, t * 4) * (1 + Math.sin(t * 5) * 0.06));
      ring.scale.setScalar(1.2 + Math.sin(t * 3) * 0.1);
      mH.opacity = Math.max(0, fade);
      mR.opacity = 0.6 * Math.max(0, fade);
      if (fade <= 0) return 'done';
    }, [mH, mR]);
    rec.g = g;
  }

  return {
    smiteStart, smiteHit, divineFx, muzzle, grappleFx, chainBind, stormStart, stormTick,
    /** 入れ替わり：使った場所でハートがはじけ、そこに次の目印のハートを置く。行き先のハートは消える */
    twinSwap(p, d, color, sk) {
      heartBurst(d.x, 1.3, d.z, color, 14, 5);
      flash(d.x, 1.3, d.z, color, 4, 0.35);
      if (d.sw) {
        const to = d.sw;
        // 行き先（前のハート）でももう一度はじける。たどり着いたころに
        setTimeout(() => {
          heartBurst(to.x, 1.3, to.z, color, 14, 5);
          flash(to.x, 1.3, to.z, color, 5, 0.35);
        }, (sk.time || 0.2) * 1000);
        // 通り道にハートを並べる
        const n = Math.max(2, Math.round(Math.hypot(to.x - d.x, to.z - d.z) / 1.5));
        for (let i = 1; i < n; i++) {
          const u = i / n;
          setTimeout(() => heartBurst(d.x + (to.x - d.x) * u, 1.2, d.z + (to.z - d.z) * u, color, 2, 1), u * (sk.time || 0.2) * 1000);
        }
      }
      placeMark(p, d.x, d.z, color, d.sw ? sk.time || 0.2 : 0);
    },
    /** 新しいボス：場のハートを全部消す */
    twinMarkClear() {
      for (const r of twinMarks.values()) r.dead = true;
      twinMarks.clear();
    },
  };
}
