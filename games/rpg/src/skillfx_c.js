// 味方の技エフェクト（罠士・侍・踊り子・吟遊詩人の技ごとの演出）。skillfx.js の createSkillFx から core を受け取って作る
//   burstStart / burstTick 周囲攻撃（燕返し：溜め→左右の高速斬り→溜めた縦斬り、剣の舞：花びら）
//   coneFx 扇の技（居合：腕を振り上げて縦の一閃） / counterFx 見切り（刀を鞘に納める）
//   teamBuffFx 味方強化（情熱のサンバ：踊って音符のオーラ） / dissonance 不協和音（歪んだ暗い旋律）
//   toss 罠の大地（地雷を投げる） / trapFx トラバサミ・爆薬罠（地雷）の見た目
import * as THREE from 'three';
import { geo, glow, hotOf, ease } from './fxkit.js';
import { starTexture, noteTexture, petalTexture, brokenNoteTexture } from './fxtex.js';

const lam = (color, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive, flatShading: true });
const sprite = (map, color, opacity = 1, additive = true) => new THREE.SpriteMaterial({
  map, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});

// ---------------- 罠の形 ----------------
const M = {};
const mats = () => {
  if (M.metal) return M;
  M.metal = lam(0x78909c, 0x111111);
  M.dark = lam(0x37474f);
  M.tooth = lam(0xcfd8dc, 0x222222);
  M.olive = lam(0x556b2f, 0x0a1200);
  M.cap = lam(0x8d9a6a);
  M.chain = lam(0x9e9e9e);
  return M;
};

/** トラバサミ：開いた2枚の歯つきのあご。jaws[0..1] の rotation.x で開き具合（±π/2 で全開、0 で閉じる） */
function makeBearTrap() {
  const m = mats();
  const g = new THREE.Group();
  const add = (gg, mm, x, y, z, p = g) => {
    const o = new THREE.Mesh(gg, mm);
    o.position.set(x, y, z);
    p.add(o);
    return o;
  };
  add(geo('btBase', () => new THREE.CylinderGeometry(0.62, 0.66, 0.06, 16)), m.dark, 0, 0.03, 0);
  add(geo('btPlate', () => new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12)), m.metal, 0, 0.08, 0);
  add(geo('btSpring', () => new THREE.BoxGeometry(1.5, 0.06, 0.12)), m.metal, 0, 0.06, 0);
  const jaws = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.y = 0.07;
    g.add(pivot);
    add(geo('btJaw', () => new THREE.TorusGeometry(0.6, 0.045, 5, 18, Math.PI)), m.metal, 0, 0, 0, pivot);
    for (let i = 1; i < 8; i++) {
      const a = (i / 8) * Math.PI;
      const t = add(geo('btTooth', () => new THREE.ConeGeometry(0.05, 0.16, 4)), m.tooth, Math.cos(a) * 0.53, Math.sin(a) * 0.53, 0, pivot);
      t.rotation.z = a + Math.PI / 2; // 内側（中心）へ向く
    }
    pivot.rotation.x = s * Math.PI / 2;
    jaws.push({ pivot, s });
  }
  // 鎖と杭
  for (let i = 0; i < 4; i++) {
    const l = add(geo('btLink', () => new THREE.TorusGeometry(0.07, 0.018, 4, 8)), m.chain, 0.8 + i * 0.11, 0.04, 0.05);
    l.rotation.set(Math.PI / 2, i % 2 ? Math.PI / 2 : 0, 0);
  }
  add(geo('btStake', () => new THREE.CylinderGeometry(0.04, 0.01, 0.35, 5)), m.dark, 1.28, 0.12, 0.05);
  return { g, jaws };
}

/** 地雷：平たい円盤に、とげと赤く点滅する光 */
function makeMine() {
  const m = mats();
  const g = new THREE.Group();
  const add = (gg, mm, x, y, z) => {
    const o = new THREE.Mesh(gg, mm);
    o.position.set(x, y, z);
    g.add(o);
    return o;
  };
  add(geo('mnBody', () => new THREE.CylinderGeometry(0.42, 0.48, 0.16, 14)), m.olive, 0, 0.08, 0);
  add(geo('mnCap', () => new THREE.CylinderGeometry(0.25, 0.3, 0.08, 12)), m.cap, 0, 0.2, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    add(geo('mnProng', () => new THREE.CylinderGeometry(0.025, 0.03, 0.14, 5)), m.metal, Math.cos(a) * 0.16, 0.29, Math.sin(a) * 0.16);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = add(geo('mnRib', () => new THREE.BoxGeometry(0.05, 0.1, 0.12)), m.dark, Math.cos(a) * 0.45, 0.08, Math.sin(a) * 0.45);
    r.rotation.y = -a;
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 1 });
  const light = add(geo('mnLight', () => new THREE.SphereGeometry(0.06, 8, 6)), lightMat, 0, 0.27, 0);
  const halo = new THREE.Sprite(sprite(starTexture(), 0xff1744, 0.9));
  halo.position.set(0, 0.3, 0);
  g.add(halo);
  return { g, lightMat, halo, light };
}

export function createSkillFxC(core) {
  const { game, root, add, mesh, column, slash, streak } = core;
  const fx = () => game.skillFx;

  /** 花びらが舞う（剣の舞） */
  function petals(p, dur) {
    const g = new THREE.Group();
    const list = [];
    const ms = [];
    const cols = [0xf8bbd0, 0xf48fb1, 0xfce4ec, 0xff80ab];
    for (let i = 0; i < 26; i++) {
      const m = sprite(petalTexture(), cols[i % cols.length], 0.95, false);
      const sp = new THREE.Sprite(m);
      g.add(sp);
      ms.push(m);
      list.push({ sp, m, a: Math.random() * 6.28, r: 0.8 + Math.random() * 2.4, h: Math.random() * 2.4, sp0: 2 + Math.random() * 3, ph: Math.random() * 6 });
    }
    add(g, dur, (k, dt) => {
      g.position.set(p.pos.x, 0, p.pos.z);
      const fade = k < 0.1 ? k / 0.1 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      for (const o of list) {
        o.a += o.sp0 * dt;
        o.h += dt * 0.6;
        const rr = o.r * (0.7 + 0.3 * Math.sin(k * 6 + o.ph));
        o.sp.position.set(Math.sin(o.a) * rr, 0.3 + (o.h % 3), Math.cos(o.a) * rr);
        o.sp.scale.setScalar(0.28);
        o.m.rotation = o.a * 2 + o.ph;
        o.m.opacity = 0.95 * fade;
      }
    }, ms);
  }

  /** 音符のオーラ（情熱のサンバ）：持ち主のまわりを音符が回る */
  function noteAura(p, dur) {
    const g = new THREE.Group();
    const list = [];
    const ms = [];
    const cols = [0xf48fb1, 0xffd740, 0xff80ab, 0xffffff];
    for (let i = 0; i < 10; i++) {
      const m = sprite(noteTexture(i % 2 ? 'two' : 'one'), cols[i % cols.length], 0.9);
      const sp = new THREE.Sprite(m);
      g.add(sp);
      ms.push(m);
      list.push({ sp, m, a: (i / 10) * Math.PI * 2, h: 0.6 + (i % 3) * 0.55, ph: Math.random() * 6 });
    }
    add(g, dur, (k, dt) => {
      g.position.set(p.pos.x, 0, p.pos.z);
      const t = k * dur;
      const fade = t < 0.3 ? t / 0.3 : k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
      for (const o of list) {
        o.a += dt * 1.6;
        o.sp.position.set(Math.sin(o.a) * 1.3, o.h + Math.abs(Math.sin(t * 5 + o.ph)) * 0.3, Math.cos(o.a) * 1.3);
        o.sp.scale.setScalar(0.42);
        o.m.rotation = Math.sin(t * 6 + o.ph) * 0.4;
        o.m.opacity = 0.9 * fade * (t > 2 ? 0.6 : 1); // 最初は目立たせ、あとは控えめに
      }
    }, ms);
  }

  return {
    /** 周囲攻撃の始まり（燕返しは溜め、剣の舞は花びら） */
    burstStart(p, sk) {
      if (sk.id === 'tsubame') {
        const w = sk.windup || 0;
        p.vmAnim = { kind: 'tsubame', t: 0, dur: w + sk.ticks * sk.every + (sk.lastGap || 0) + 0.2, w, every: sk.every, n: sk.ticks, gap: sk.lastGap || 0 };
        column(p.pos.x, p.pos.z, 0.9, 2.6, 0xffffff, w + 0.15, p, 0.5); // 溜めの光
      } else if (sk.id === 'swordance') {
        petals(p, (sk.ticks || 1) * (sk.every || 0.2) + 1.2);
      }
    },
    /** 周囲攻撃の1回ごと（燕返しは左右の高速斬り→最後は縦斬り） */
    burstTick(p, sk, n, ticks) {
      if (sk.id === 'tsubame') {
        if (n < ticks) {
          const left = n % 2 === 1;
          slash(p.pos.x, p.pos.z, p.yaw, sk.radius, 2.8, sk.color, { y: 1.15 + (left ? 0.1 : -0.1), roll: left ? 0.2 : -0.2, dur: 0.16, sweep: left ? 1.8 : -1.8 });
        } else {
          slash(p.pos.x, p.pos.z, p.yaw, sk.radius + 1, 1.4, 0xffffff, { y: 1.4, roll: Math.PI / 2, dur: 0.35, sweep: 1.0 });
          game.enemyFx?.impact(p.pos.x + Math.sin(p.yaw) * 2, p.pos.z + Math.cos(p.yaw) * 2, sk.radius, 0xffffff, 'default');
          game.fx?.shake?.(0.5);
        }
        return;
      }
      fx().spin(p.pos.x, p.pos.z, sk.radius, sk.color);
    },
    /** 扇の技（居合は腕を振り上げて縦の一閃） */
    coneFx(p, yaw, sk) {
      if (sk.id === 'iai') {
        p.vmAnim = { kind: 'iai', t: 0, dur: 0.34 };
        slash(p.pos.x, p.pos.z, yaw, sk.range, 0.8, 0xffffff, { y: 1.5, roll: Math.PI / 2, dur: 0.3, sweep: 0.8 });
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        streak(p.pos.x + s * 0.5, p.pos.z + c * 0.5, p.pos.x + s * (sk.range + 1), p.pos.z + c * (sk.range + 1), 0.15, 0xffffff, 0.25, 1.4);
        return;
      }
      slash(p.pos.x, p.pos.z, yaw, sk.range, sk.arc, sk.color);
    },
    /** 見切り：刀を鞘に納めて構え、終わると素早く抜き戻す */
    counterFx(p, sk) {
      if (sk.id === 'mikiri') p.vmAnim = { kind: 'sheathe', t: 0, dur: sk.dur || 1 }; // 侍だけ（刀を鞘へ）
    },
    /** 味方強化の技ごとの演出（情熱のサンバ：少し踊って、まわりに音符のオーラ） */
    teamBuffFx(p, sk) {
      if (sk.id === 'samba') {
        p.vmAnim = { kind: 'dance', t: 0, dur: 1.3 };
        noteAura(p, Math.min(10, sk.dur || 10));
      }
    },
    /** 不協和音：ぎざぎざに歪んだ暗い色の音符が、ふらつきながら扇に飛ぶ */
    dissonance(p, yaw, range, arc) {
      const g = new THREE.Group();
      g.position.set(p.pos.x, 0, p.pos.z);
      const notes = [];
      const ms = [];
      for (let i = 0; i < 9; i++) {
        const a = yaw + (i / 8 - 0.5) * arc;
        const dark = sprite(brokenNoteTexture(i % 4 + 1), i % 2 ? 0x311b92 : 0x4a148c, 1, false);
        const rim = sprite(brokenNoteTexture(i % 4 + 1), 0xd500f9, 0.55);
        const sd = new THREE.Sprite(dark);
        const sr = new THREE.Sprite(rim);
        g.add(sr, sd);
        ms.push(dark, rim);
        notes.push({ sd, sr, dark, rim, a, ph: Math.random() * 6, sp: 0.8 + Math.random() * 0.4, y: 0.9 + Math.random() * 0.8 });
      }
      add(g, 0.55, (k) => {
        for (const o of notes) {
          const d = 0.6 + range * ease(Math.min(1, k * o.sp * 1.3));
          const wob = Math.sin(k * 25 + o.ph) * 0.35; // ふらつき
          const x = Math.sin(o.a) * d + Math.cos(o.a) * wob;
          const z = Math.cos(o.a) * d - Math.sin(o.a) * wob;
          const y = o.y + Math.sin(k * 18 + o.ph) * 0.25;
          o.sd.position.set(x, y, z);
          o.sr.position.set(x, y, z - 0.01);
          o.sd.scale.setScalar(0.7);
          o.sr.scale.setScalar(0.85);
          o.dark.rotation = o.rim.rotation = Math.sin(k * 14 + o.ph) * 0.7;
          const f = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
          o.dark.opacity = f;
          o.rim.opacity = 0.55 * f;
        }
      }, ms);
      slash(p.pos.x, p.pos.z, yaw, range, arc, 0x6a1b9a, { y: 1.2, dur: 0.3, sweep: 0.2 });
    },

    /** 罠の大地：腕を振り上げて地雷を放る（delay 秒後に投げ、0.4 秒で落ちる） */
    toss(p, x, z, delay) {
      const mine = makeMine();
      mine.g.visible = false;
      const x0 = p.pos.x;
      const z0 = p.pos.z;
      add(mine.g, delay + 0.4, (k) => {
        const t = k * (delay + 0.4) - delay;
        if (t < 0) return;
        mine.g.visible = true;
        const u = Math.min(1, t / 0.4);
        mine.g.position.set(x0 + (x - x0) * u, 1.8 * (1 - u) + Math.sin(u * Math.PI) * 2.2, z0 + (z - z0) * u);
        mine.g.rotation.set(u * 8, u * 3, 0);
        if (u >= 1) {
          mine.g.visible = false;
          game.fx?.burst?.(x, 0.3, z, 0x8d6e63, 10, { speed: 3, up: 3, life: 0.4 });
        }
      }, [mine.lightMat, mine.halo.material]);
    },

    /** トラバサミ（茶色）・爆薬罠（地雷）の見た目。z.appear 秒たつまで見せない（投げている途中） */
    trapFx(z) {
      const bear = z.color === 0x8d6e63;
      const g = new THREE.Group();
      g.position.set(z.x, 0, z.z);
      const model = bear ? makeBearTrap() : makeMine();
      model.g.scale.setScalar(bear ? 1.35 : 1.2);
      g.add(model.g);
      g.rotation.y = Math.random() * Math.PI;
      // 踏むと発動する範囲（うっすら）
      const ringMat = glow(bear ? 0xbcaaa4 : 0xff7043, 0.3);
      const ring = mesh(geo('trapRing', () => new THREE.RingGeometry(0.95, 1, 40).rotateX(-Math.PI / 2)), ringMat);
      ring.position.y = 0.04;
      ring.scale.set(z.trigger || 1.6, 1, z.trigger || 1.6);
      g.add(ring);
      root.add(g);
      if (z.mesh) z.mesh.visible = false; // 前の円柱は隠す
      let age = 0;
      const rec = {
        tick(dt) {
          age += dt;
          g.visible = age >= (z.appear || 0);
          if (!bear) {
            const on = Math.floor(age * 2.5) % 2 === 0;
            model.lightMat.color.setHex(on ? 0xff1744 : 0x4a0000);
            model.halo.material.opacity = on ? 0.9 : 0;
            model.halo.scale.setScalar(0.5);
          }
          ringMat.opacity = 0.22 + 0.1 * Math.sin(age * 4);
        },
        remove() {
          trapSet.delete(rec);
          const fired = z.t > 0.05; // 時間切れより前に消えた＝踏まれた
          if (fired && bear) {
            // あごがバチンと閉じ、少しのあいだ閉じたまま残ってから沈んで消える
            ring.visible = false;
            add(g, 0.9, (k) => {
              const t = k * 0.9;
              for (const j of model.jaws) j.pivot.rotation.x = j.s * (Math.PI / 2) * (1 - Math.min(1, t / 0.08));
              g.position.y = t < 0.2 ? Math.sin((t / 0.2) * Math.PI) * 0.3 : -Math.max(0, t - 0.6) * 1.2;
            }, [ringMat]);
            return;
          }
          if (fired) fx().explosion(z.x, z.z, Math.max(2, z.r * 0.7), 0xff7043, false);
          root.remove(g);
          ringMat.dispose();
          if (!bear) {
            model.lightMat.dispose();
            model.halo.material.dispose();
          }
        },
      };
      trapSet.add(rec);
      z.aura = rec;
    },
    updateTraps(dt) {
      for (const r of trapSet) r.tick(dt);
    },
  };
}
const trapSet = new Set();
