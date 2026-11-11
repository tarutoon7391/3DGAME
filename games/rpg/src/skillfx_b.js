// 味方の技エフェクト（後半：技ごとの特別な演出）。skillfx.js の createSkillFx から core（共通の道具）を受け取って作る
//   shieldWall 盾の壁 / volleyUp 上へ放つ矢 / songRing 楽譜の輪 / thrust 槍・拳の突き / hadouken 気功波
//   fistShot 百裂拳の腕の残像 / explosion 爆発 / skullPop 腐食のドクロ / skullSwarm 呪いのドクロの群れ
//   clock 時計（針が逆に回る・止まる） / rewindScreen 時戻しの画面枠 / timeStop 時間停止のモノクロ
//   drainWind 生命吸収の吸い込む風 / mark 着地点の印 / frenzy 死の宣告の高速斬り
import * as THREE from 'three';
import { geo, discGeo, columnGeo, ribbonGeo, ringGeo, glow, arrowGeo, hotOf, ease } from './fxkit.js';
import { starTexture, streakTexture, noteTexture, staffTexture, hexGridTexture, skullTexture, clockFaceTexture, clockHandTexture, windTexture } from './fxtex.js';
import { fillTexture } from './auratex.js';

const spriteMat = (map, color, opacity = 1) => new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });

/**
 * @param core { game, root, add(obj, dur, tick, mats), mesh(geo, mat), column, sigil, streak, slash, slam }
 */
export function createSkillFxB(core) {
  const { game, add, mesh, column, sigil, streak, slash, slam } = core;

  /** 時計の文字盤と針（スプライト3枚）。spin：針の回る速さ（正で反時計回り＝逆行、0 で止まる） */
  function makeClock(color, spin) {
    const g = new THREE.Group();
    const mFace = spriteMat(clockFaceTexture(), color, 0.95);
    const mHour = spriteMat(clockHandTexture('hour'), hotOf(color, 0.5), 1);
    const mMin = spriteMat(clockHandTexture('min'), hotOf(color, 0.6), 1);
    const face = new THREE.Sprite(mFace);
    const hour = new THREE.Sprite(mHour);
    const min = new THREE.Sprite(mMin);
    mHour.rotation = -0.9;
    mMin.rotation = 1.6;
    g.add(face, hour, min);
    return {
      g, mats: [mFace, mHour, mMin],
      tick(dt, size, a) {
        for (const s of [face, hour, min]) s.scale.setScalar(size);
        mMin.rotation += spin * dt;
        mHour.rotation += (spin / 12) * dt;
        for (const m of [mFace, mHour, mMin]) m.opacity = a;
      },
    };
  }

  // 時戻しの画面枠：画面の縁に並ぶ時計（canvas）
  let rewindEl = null;
  function rewindDom() {
    if (rewindEl || typeof document === 'undefined') return rewindEl;
    rewindEl = document.createElement('div');
    rewindEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;box-shadow:inset 0 0 90px 24px rgba(179,136,255,.55)';
    const spots = [];
    for (let i = 0; i < 6; i++) spots.push([8 + i * 16.8, 4], [8 + i * 16.8, 88]);
    for (let i = 0; i < 3; i++) spots.push([2, 22 + i * 22], [92, 22 + i * 22]);
    rewindEl.clocks = spots.map(([x, y], i) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      const s = 64 + (i % 3) * 14;
      cv.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:${s}px;height:${s}px;filter:drop-shadow(0 0 6px #b388ff)`;
      rewindEl.appendChild(cv);
      return { cv, ctx: cv.getContext('2d'), a: Math.random() * 6, sp: 5 + Math.random() * 5 };
    });
    document.body.appendChild(rewindEl);
    return rewindEl;
  }
  function drawDomClock(o) {
    const c = o.ctx;
    const R = 48;
    c.clearRect(0, 0, 96, 96);
    c.save();
    c.translate(R, R);
    c.strokeStyle = 'rgba(209,196,233,.95)';
    c.fillStyle = 'rgba(179,136,255,.25)';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(0, 0, R * 0.82, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    for (let i = 0; i < 12; i++) {
      c.save();
      c.rotate((i / 12) * Math.PI * 2);
      c.fillStyle = '#ede7f6';
      c.fillRect(-2, -R * 0.74, 4, i % 3 ? 6 : 11);
      c.restore();
    }
    c.lineCap = 'round';
    c.strokeStyle = '#fff';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.sin(o.a / 12) * R * 0.4, -Math.cos(o.a / 12) * R * 0.4);
    c.stroke();
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.sin(o.a) * R * 0.62, -Math.cos(o.a) * R * 0.62);
    c.stroke();
    c.restore();
  }

  // 時間停止中のボス：材質を灰色の複製に差し替え、終わったら戻す
  function grayBoss(b) {
    const saved = [];
    b.model?.group?.traverse((o) => {
      if (!o.isMesh || !o.material || o.userData.grayed) return;
      const orig = o.material;
      const gm = orig.clone();
      if (gm.color) {
        const l = gm.color.r * 0.3 + gm.color.g * 0.59 + gm.color.b * 0.11;
        gm.color.setRGB(l, l, l);
      }
      if (gm.emissive) gm.emissive.setRGB(0, 0, 0);
      o.material = gm;
      o.userData.grayed = true;
      saved.push([o, orig, gm]);
    });
    return () => {
      for (const [o, orig, gm] of saved) {
        o.material = orig;
        o.userData.grayed = false;
        gm.dispose();
      }
    };
  }

  return {
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


    /** 槍の突き・拳の突き（通常攻撃）：前へ伸びる光の筋と、先の光。last は強い一撃 */
    thrust(p, last, range, color, fist = false) {
      const s = Math.sin(p.yaw);
      const c = Math.cos(p.yaw);
      const x0 = p.pos.x + s * 0.4;
      const z0 = p.pos.z + c * 0.4;
      const L = range + (last ? 1.2 : 0.3);
      streak(x0, z0, x0 + s * L, z0 + c * L, fist ? 0.5 : last ? 0.9 : 0.45, color, last ? 0.32 : 0.2, fist ? 1.25 : 1.3);
      const m = spriteMat(starTexture(), last ? 0xfff59d : hotOf(color, 0.5));
      const sp = new THREE.Sprite(m);
      sp.position.set(x0 + s * L, fist ? 1.25 : 1.3, z0 + c * L);
      const size = last ? 2.4 : fist ? 0.9 : 1.1;
      add(sp, last ? 0.3 : 0.16, (k) => {
        sp.scale.setScalar(size * (k < 0.3 ? 0.5 + k * 1.7 : 1.01 - (k - 0.3)));
        m.opacity = 1 - k;
      }, [m]);
      if (last) game.enemyFx?.impact(x0 + s * L, z0 + c * L, 1.6, color, 'default');
    },

    /** 気功波：両手の前から気の玉が飛んでいき、扇に衝撃が広がる（波動拳） */
    hadouken(p, yaw, range, arc, color) {
      const s = Math.sin(yaw);
      const c = Math.cos(yaw);
      const g = new THREE.Group();
      const mCore = glow(0xffffff, 1);
      const mBall = glow(hotOf(color, 0.3), 0.9);
      const mOut = glow(color, 0.45);
      const ball = mesh(geo('hdk', () => new THREE.SphereGeometry(1, 16, 12)), mBall);
      const core0 = mesh(geo('hdk', () => new THREE.SphereGeometry(1, 16, 12)), mCore);
      const outer = mesh(geo('hdk', () => new THREE.SphereGeometry(1, 16, 12)), mOut);
      const tail = mesh(geo('hdkTail', () => new THREE.ConeGeometry(1, 3, 12).rotateX(-Math.PI / 2).translate(0, 0, -1.5)), mOut);
      g.add(outer, ball, core0, tail);
      g.rotation.y = yaw;
      add(g, 0.42, (k) => {
        const d = 0.6 + (range + 0.5) * ease(k);
        g.position.set(p.pos.x + s * d, 1.25, p.pos.z + c * d);
        const r = 0.35 + 0.35 * k;
        core0.scale.setScalar(r * 0.45);
        ball.scale.setScalar(r * 0.75);
        outer.scale.setScalar(r * (1.2 + 0.15 * Math.sin(k * 40)));
        tail.scale.set(r * 0.8, r * 0.8, 0.6 + k);
        const f = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
        mCore.opacity = f;
        mBall.opacity = 0.9 * f;
        mOut.opacity = 0.45 * f;
      }, [mCore, mBall, mOut]);
      slash(p.pos.x, p.pos.z, yaw, range, arc, color, { y: 1.2, dur: 0.35, sweep: 0 });
    },

    /** 百裂拳：腕と拳の残像が前へ飛ぶ。big は最後の一撃（大きく、先で光る） */
    fistShot(p, yaw, range, color, big = false) {
      const side = (Math.random() - 0.5) * 0.9;
      const s = Math.sin(yaw);
      const c = Math.cos(yaw);
      const g = new THREE.Group();
      const m = glow(hotOf(color, 0.2), 0.75);
      const armM = mesh(geo('fArm', () => new THREE.BoxGeometry(0.3, 0.3, 1.1).translate(0, 0, -0.55)), m);
      const fist = mesh(geo('fFist', () => new THREE.BoxGeometry(0.5, 0.5, 0.5)), m);
      g.add(armM, fist);
      g.rotation.y = yaw;
      const y = 1.1 + Math.random() * 0.5;
      const sc = big ? 2.4 : 1;
      g.scale.setScalar(sc);
      add(g, big ? 0.3 : 0.17, (k) => {
        const d = 0.5 + range * ease(k);
        g.position.set(p.pos.x + s * d + c * side, y, p.pos.z + c * d - s * side);
        m.opacity = 0.75 * (1 - k * k);
      }, [m]);
      if (big) {
        const sm = spriteMat(starTexture(), 0xfff59d);
        const sp = new THREE.Sprite(sm);
        sp.position.set(p.pos.x + s * (range + 0.5), 1.35, p.pos.z + c * (range + 0.5));
        add(sp, 0.35, (k) => {
          sp.scale.setScalar(3.5 * (0.4 + k));
          sm.opacity = 1 - k;
        }, [sm]);
      }
    },

    /** 爆発：火の玉がふくらみ、光って、衝撃の輪が広がる。big は大爆発（大砲・大爆発フラスコ） */
    explosion(x, z, r, color, big = false) {
      const g = new THREE.Group();
      g.position.set(x, 0.9, z);
      const mCore = glow(0xffffff, 1);
      const mIn = glow(hotOf(color, 0.45), 0.95);
      const mOut = glow(color, 0.55);
      const sg = geo('expl', () => new THREE.SphereGeometry(1, 18, 12));
      const core0 = mesh(sg, mCore);
      const inner = mesh(sg, mIn);
      const outer = mesh(sg, mOut);
      g.add(outer, inner, core0);
      const R = Math.max(1, r) * (big ? 1.15 : 0.85);
      const dur = big ? 0.7 : 0.45;
      add(g, dur, (k) => {
        const e = ease(Math.min(1, k * 1.6));
        core0.scale.setScalar(R * 0.45 * e);
        inner.scale.setScalar(R * 0.75 * e);
        outer.scale.setScalar(R * e);
        mCore.opacity = Math.max(0, 1 - k * 2.2);
        mIn.opacity = 0.95 * (1 - k);
        mOut.opacity = 0.55 * (1 - k);
      }, [mCore, mIn, mOut]);
      const fm = spriteMat(starTexture(), hotOf(color, 0.6));
      const flash = new THREE.Sprite(fm);
      flash.position.set(x, 1.4, z);
      add(flash, big ? 0.28 : 0.16, (k) => {
        flash.scale.setScalar(R * (big ? 5 : 3.2) * (0.5 + k));
        fm.opacity = 1 - k;
      }, [fm]);
      slam(x, z, R * 1.2, color);
      if (big) {
        column(x, z, R * 0.55, 7, color, 0.6);
        game.fx?.shake?.(0.7);
      }
    },

    /** 腐食：相手の頭の上にドクロが浮かび上がる */
    skullPop(target, color) {
      const m = spriteMat(skullTexture(), color);
      const sp = new THREE.Sprite(m);
      add(sp, 1.0, (k) => {
        sp.position.set(target.pos.x, (target.hpY ?? 2) + 0.4 + k * 1.4, target.pos.z);
        sp.scale.setScalar(1.6 * (k < 0.15 ? k / 0.15 : 1));
        m.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      }, [m]);
    },

    /** 呪いの拡散：相手の体のまわりを、ドクロがもやのようにたくさん飛び回る */
    skullSwarm(target, color) {
      const g = new THREE.Group();
      const mats = [];
      const n = 16;
      const skulls = [];
      for (let i = 0; i < n; i++) {
        const m = spriteMat(skullTexture(), i % 3 ? color : hotOf(color, 0.4));
        const sp = new THREE.Sprite(m);
        g.add(sp);
        mats.push(m);
        skulls.push({ sp, m, a: Math.random() * 6.28, r: 0.5 + Math.random(), h: Math.random(), sp0: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2), ph: Math.random() * 6 });
      }
      const mist = [];
      for (let i = 0; i < 8; i++) {
        const m = spriteMat(fillTexture(), color, 0.35);
        const sp = new THREE.Sprite(m);
        g.add(sp);
        mats.push(m);
        mist.push({ sp, m, a: Math.random() * 6.28, h: Math.random() });
      }
      add(g, 1.8, (k, dt) => {
        g.position.set(target.pos.x, 0, target.pos.z);
        const H = target.hpY ?? 2.5;
        const rad = target.radius ?? 1;
        const fade = k < 0.15 ? k / 0.15 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        for (const o of skulls) {
          o.a += o.sp0 * dt;
          const rr = rad + o.r;
          o.sp.position.set(Math.sin(o.a) * rr, 0.4 + o.h * H + Math.sin(k * 10 + o.ph) * 0.25, Math.cos(o.a) * rr);
          o.sp.scale.setScalar(0.55 + 0.25 * Math.sin(k * 8 + o.ph));
          o.m.opacity = fade * (0.7 + 0.3 * Math.sin(k * 12 + o.ph));
        }
        for (const o of mist) {
          o.a += dt * 0.8;
          o.sp.position.set(Math.sin(o.a) * rad, 0.5 + o.h * H, Math.cos(o.a) * rad);
          o.sp.scale.setScalar(2.4 + o.h);
          o.m.opacity = 0.35 * fade;
        }
      }, mats);
    },

    /** ボスの頭の上の時計。mode：'slow'（針がゆっくり順に回る）／'reverse'（逆に回る）／'stop'（止まっている） */
    clock(target, dur, mode = 'slow') {
      const C = makeClock(0xb388ff, mode === 'reverse' ? 7 : mode === 'slow' ? -1.6 : 0);
      add(C.g, dur, (k, dt) => {
        C.g.position.set(target.pos.x, (target.hpY ?? 2.5) + 1.7, target.pos.z);
        const a = k < 0.08 ? k / 0.08 : k > 0.9 ? 1 - (k - 0.9) / 0.1 : 1;
        const size = 2.2 * (k < 0.08 ? 0.6 + 0.4 * (k / 0.08) : 1);
        C.tick(mode === 'stop' ? 0 : dt, size, a * (mode === 'stop' && k > 0.85 ? (Math.sin(k * 80) > 0 ? 1 : 0.3) : 1));
      }, C.mats);
    },

    /** 時戻し：画面の縁にたくさんの時計が出て、針が逆に回る */
    rewindScreen() {
      const el = rewindDom();
      if (!el) return;
      add(new THREE.Group(), 1.3, (k, dt) => {
        el.style.opacity = (k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1).toFixed(2);
        for (const o of el.clocks) {
          o.a -= o.sp * dt; // 反時計回り
          drawDomClock(o);
        }
        if (k >= 1) el.style.opacity = '0';
      }, []);
    },

    /** 時間停止：画面が一瞬（0.5秒）モノクロ、止まっている間はボスがモノクロで、頭の上に止まった時計 */
    timeStop(dur) {
      const cv = game.renderer?.domElement;
      if (cv) {
        add(new THREE.Group(), 0.5, (k) => {
          cv.style.filter = k < 1 ? `grayscale(${Math.min(1, (1 - k) * 2.5).toFixed(2)})` : '';
        }, []);
      }
      for (const b of game.bosses || []) {
        if (!b.alive) continue;
        const restore = grayBoss(b);
        add(new THREE.Group(), dur, (k) => {
          if (k >= 1) restore();
        }, []);
        this.clock(b, dur, 'stop');
      }
    },

    /** 生命吸収：相手から自分へ、掃除機のように吸い込む紫の風 */
    drainWind(p, target, color) {
      const tex = windTexture();
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 2);
      const g = new THREE.Group();
      const funG = geo('funnel', () => new THREE.CylinderGeometry(0.25, 1.5, 1, 24, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5));
      const mF = glow(color, 0.75, tex);
      const mI = glow(hotOf(color, 0.4), 0.4, tex);
      const fun = mesh(funG, mF);
      const inner = mesh(funG, mI);
      inner.scale.set(0.55, 0.55, 1);
      g.add(fun, inner);
      const motes = [];
      for (let i = 0; i < 6; i++) {
        const m = spriteMat(starTexture(), hotOf(color, 0.5), 0.9);
        const sp = new THREE.Sprite(m);
        g.add(sp);
        motes.push({ sp, m, a: Math.random() * 6.28, ph: Math.random() });
      }
      add(g, 0.32, (k, dt) => {
        const dx = p.pos.x - target.pos.x;
        const dz = p.pos.z - target.pos.z;
        const L = Math.hypot(dx, dz) || 1;
        g.position.set(target.pos.x, 1.3, target.pos.z);
        g.rotation.y = Math.atan2(dx, dz);
        fun.scale.set(1, 1, L);
        inner.scale.z = L;
        tex.offset.y -= dt * 4; // 自分のほうへ流れる
        tex.offset.x += dt * 1.5; // ねじれながら
        const f = Math.sin(k * Math.PI);
        mF.opacity = 0.75 * f;
        mI.opacity = 0.4 * f;
        for (const o of motes) {
          const u = (o.ph + k) % 1;
          const rr = 1.4 * (1 - u) + 0.2;
          const a = o.a + u * 8;
          o.sp.position.set(Math.cos(a) * rr, Math.sin(a) * rr, u * L);
          o.sp.scale.setScalar(0.5);
          o.m.opacity = f;
        }
      }, [mF, mI, ...motes.map((o) => o.m)]);
    },

    /** 着地点の印（天穿ちなど） */
    mark(x, z, r, color, dur) {
      sigil(x, z, r, color, dur);
      const m = glow(color, 0.5, fillTexture());
      const d = mesh(discGeo(), m);
      d.position.set(x, 0.05, z);
      add(d, dur, (k) => {
        d.scale.set(r * (0.9 + 0.1 * Math.sin(k * 30)), 1, r * (0.9 + 0.1 * Math.sin(k * 30)));
        m.opacity = 0.25 + 0.35 * k;
      }, [m]);
    },

    /** 死の宣告：相手の前で左右に何度も高速で斬る軌跡 */
    frenzy(p, target, color) {
      const yaw = Math.atan2(target.pos.x - p.pos.x, target.pos.z - p.pos.z);
      const bx = target.pos.x - Math.sin(yaw) * 2.2;
      const bz = target.pos.z - Math.cos(yaw) * 2.2;
      let fired = 0;
      add(new THREE.Group(), 0.45, (k) => {
        while (fired < 4 && k >= fired / 4) {
          const left = fired % 2 === 0;
          slash(bx, bz, yaw, 3.8, 2.4, color, { y: 1.3 + (fired - 1.5) * 0.25, roll: left ? 0.25 : -0.25, dur: 0.18, sweep: left ? 1.6 : -1.6 });
          fired++;
        }
      }, []);
    },
  };
}
