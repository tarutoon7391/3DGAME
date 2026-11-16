// ボスの新しい体型（ステージ7〜9）。makeMonsterModel と同じ部品（root・armL・armR・legL・legR・bodyMat・heads）を返す
//   kraken：大ダコ（armL/armR＝前の大きな触手） / crab：大蟹（armL/armR＝はさみ） / serpent：海竜（heads＝首）
//   golem：溶岩の巨人（ひびが光る） / eye：浮かぶ目玉（armL/armR＝触手） / saucer：円盤 / kaiju：宇宙怪獣（二足・背びれが光る）
// 浮いている体は root の子（body）に高さを持たせる（poseSeq が毎フレーム root.position.y を 0 に戻すため）
import * as THREE from 'three';
import { mat, ownMat, box, sphere, cyl, cone, part } from './models.js';

function pivot(parent, x, y, z) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  p.rotation.order = 'YXZ';
  parent.add(p);
  return p;
}

export const EXT_MONSTERS = new Set(['kraken', 'crab', 'serpent', 'golem', 'eye', 'saucer', 'kaiju']);

export function makeExtMonster(color, look = {}) {
  const { monster, scale = 2, horn: hornColor = 0xeeeeee, eye = 0xffea00, belly = 0xd7ccc8 } = look;
  const bodyMat = ownMat(color);
  bodyMat.emissive = new THREE.Color(0x000000);
  const group = new THREE.Group();
  const root = pivot(group, 0, 0, 0);
  const horn = mat(hornColor);
  const em = mat(eye, { emissive: eye, emissiveIntensity: 1.4 });
  const bel = mat(belly);
  const glowM = mat(look.glow ?? eye, { emissive: look.glow ?? eye, emissiveIntensity: 1.6 });
  let armL;
  let armR;
  let legL;
  let legR;
  let heads = null;
  /** 触手：根元の pivot から先へ細くなる箱をつなぐ */
  const tentacle = (pv, n, len, w, dir = 1) => {
    let cur = pv;
    for (let i = 0; i < n; i++) {
      const s = 1 - i / (n + 1);
      part(box(w * s, w * s, len), i % 2 ? bodyMat : bel, 0, 0, (len / 2) * dir, cur);
      const nx = pivot(cur, 0, 0, len * dir * 0.95);
      nx.rotation.x = 0.18;
      cur = nx;
    }
    part(cone(w * 0.3, len * 0.6, 4), bodyMat, 0, 0, len * 0.3 * dir, cur).rotation.x = (Math.PI / 2) * dir;
  };

  if (monster === 'kraken') {
    const body = pivot(root, 0, 0, 0);
    part(sphere(1.3, 10, 8), bodyMat, 0, 2.3, -0.3, body).scale.set(1, 1.35, 1.1); // 頭（外套）
    part(sphere(0.9, 8, 6), bel, 0, 1.2, 0.2, body);
    part(box(0.32, 0.32, 0.1), em, -0.55, 1.75, 0.95, body);
    part(box(0.32, 0.32, 0.1), em, 0.55, 1.75, 0.95, body);
    part(box(0.12, 0.2, 0.05), mat(0x000000), -0.55, 1.75, 1.0, body);
    part(box(0.12, 0.2, 0.05), mat(0x000000), 0.55, 1.75, 1.0, body);
    // 周りの触手（動かない6本）
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.35 + (i / 6) * Math.PI * 1.3;
      const pv = pivot(body, Math.sin(a) * 0.7, 0.7, Math.cos(a) * 0.7);
      pv.rotation.y = a;
      pv.rotation.x = 0.5;
      tentacle(pv, 4, 0.75, 0.38);
    }
    // 前の大きな触手を腕に
    armL = pivot(body, -0.7, 1.0, 0.7);
    tentacle(armL, 5, 0.85, 0.48);
    armL.rotation.set(0.2, -0.35, 0);
    armR = pivot(body, 0.7, 1.0, 0.7);
    tentacle(armR, 5, 0.85, 0.48);
    armR.rotation.set(0.2, 0.35, 0);
    legL = pivot(body, -0.5, 0.6, -0.6);
    legR = pivot(body, 0.5, 0.6, -0.6);
  } else if (monster === 'crab') {
    part(box(2.8, 0.9, 2.0), bodyMat, 0, 1.2, 0, root);
    part(box(2.4, 0.3, 1.7), bel, 0, 0.7, 0, root);
    for (let i = 0; i < 4; i++) part(cone(0.18, 0.4, 4), horn, -0.9 + i * 0.6, 1.75, -0.3, root);
    // 目の柄
    for (const sd of [-1, 1]) {
      part(cyl(0.06, 0.06, 0.6, 5), bodyMat, sd * 0.45, 1.9, 0.75, root);
      part(sphere(0.16, 6, 5), em, sd * 0.45, 2.25, 0.75, root);
    }
    // 脚（左右3本ずつ。動かない）
    for (const sd of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const pv = pivot(root, sd * 1.3, 1.0, -0.6 + i * 0.5);
        pv.rotation.z = sd * -0.9;
        part(box(0.2, 1.4, 0.2), bodyMat, 0, -0.6, 0, pv);
      }
    }
    // はさみ
    const claw = (sd) => {
      const pv = pivot(root, sd * 1.2, 1.3, 0.9);
      part(box(0.35, 0.35, 1.0), bodyMat, 0, 0, 0.45, pv);
      part(box(0.75, 0.55, 0.9), bodyMat, 0, 0.1, 1.25, pv);
      part(box(0.25, 0.22, 0.8), horn, 0, 0.35, 1.95, pv);
      part(box(0.25, 0.18, 0.7), horn, 0, -0.1, 1.9, pv);
      pv.rotation.y = sd * 0.25;
      return pv;
    };
    armL = claw(-1);
    armR = claw(1);
    legL = pivot(root, -1, 0.5, -0.8);
    legR = pivot(root, 1, 0.5, -0.8);
  } else if (monster === 'serpent') {
    // とぐろの胴と、高く伸びる首
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      part(box(0.9, 0.8, 1.2), i % 2 ? bodyMat : bel, Math.sin(a) * 1.3, 0.45, Math.cos(a) * 1.3 - 0.3, root).rotation.y = a + Math.PI / 2;
    }
    // 首は後ろへ反ってから前へ曲がる（S字）。頭は前を向く
    const neck = pivot(root, 0, 0.6, 0.3);
    neck.userData.rx = -0.25;
    neck.rotation.x = -0.25;
    let cur = neck;
    const bend = [0.2, 0.4, 0.45, 0.45, 0.3];
    for (let i = 0; i < 5; i++) {
      part(box(0.8 - i * 0.06, 0.8, 0.8), i % 2 ? bodyMat : bel, 0, 0.4, 0, cur);
      const nx = pivot(cur, 0, 0.62, 0.05);
      nx.rotation.x = bend[i];
      cur = nx;
    }
    cur.rotation.x -= 1.2; // 頭を水平に戻す
    part(box(0.9, 0.7, 1.4), bodyMat, 0, 0.3, 0.4, cur); // 頭
    part(box(0.7, 0.25, 0.7), bel, 0, 0.0, 1.1, cur);
    part(box(0.14, 0.14, 0.05), em, -0.3, 0.5, 1.11, cur);
    part(box(0.14, 0.14, 0.05), em, 0.3, 0.5, 1.11, cur);
    for (const sd of [-1, 1]) part(box(0.08, 0.7, 0.5), mat(look.fin ?? hornColor), sd * 0.48, 0.5, 0.1, cur).rotation.z = sd * 0.5; // えら
    for (let i = 0; i < 5; i++) part(cone(0.12, 0.45, 4), mat(look.fin ?? hornColor), Math.sin(i * 1.2) * 1.3, 1.0, Math.cos(i * 1.2) * 1.3 - 0.3, root); // とぐろの背びれ
    heads = [neck];
    // ひれを腕に
    armL = pivot(root, -0.7, 1.6, 0.9);
    part(box(1.4, 0.08, 0.8), mat(look.fin ?? hornColor), -0.7, 0, 0, armL);
    armR = pivot(root, 0.7, 1.6, 0.9);
    part(box(1.4, 0.08, 0.8), mat(look.fin ?? hornColor), 0.7, 0, 0, armR);
    legL = pivot(root, -0.5, 0.3, -1.4);
    legR = pivot(root, 0.5, 0.3, -1.4);
    part(box(0.5, 0.4, 1.4), bodyMat, 0, 0, -0.6, legL);
  } else if (monster === 'golem') {
    // 岩の塊でできた巨人。ひびの光（glow）を挟む
    part(box(1.8, 1.4, 1.2), bodyMat, 0, 2.3, 0, root);
    part(box(1.4, 0.15, 1.25), glowM, 0, 1.75, 0, root);
    part(box(1.3, 0.9, 1.0), bodyMat, 0, 1.25, 0, root);
    part(box(0.9, 0.8, 0.9), bodyMat, 0, 3.35, 0.15, root); // 頭
    part(box(0.6, 0.12, 0.05), em, 0, 3.4, 0.61, root);
    for (let i = 0; i < 3; i++) part(cone(0.2, 0.6, 4), horn, -0.5 + i * 0.5, 3.1, -0.4, root);
    const arm = (sd) => {
      const pv = pivot(root, sd * 1.2, 2.7, 0);
      part(box(0.75, 1.0, 0.75), bodyMat, 0, -0.45, 0, pv);
      part(box(0.8, 0.12, 0.8), glowM, 0, -1.0, 0, pv);
      part(box(1.0, 1.0, 1.0), bodyMat, 0, -1.6, 0.05, pv); // 拳
      return pv;
    };
    armL = arm(-1);
    armR = arm(1);
    const leg = (sd) => {
      const pv = pivot(root, sd * 0.45, 0.85, 0);
      part(box(0.7, 0.9, 0.75), bodyMat, 0, -0.45, 0, pv);
      return pv;
    };
    legL = leg(-1);
    legR = leg(1);
  } else if (monster === 'eye') {
    const body = pivot(root, 0, 2.6, 0);
    part(sphere(1.2, 12, 10), bel, 0, 0, 0, body);
    part(cyl(0.65, 0.65, 0.12, 14), bodyMat, 0, 0, 1.12, body).rotation.x = Math.PI / 2; // 虹彩
    part(cyl(0.3, 0.3, 0.14, 10), em, 0, 0, 1.18, body).rotation.x = Math.PI / 2; // 瞳
    part(box(2.6, 0.18, 0.4), bodyMat, 0, 1.0, 0, body).rotation.z = 0.08; // まぶたの縁
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pv = pivot(body, Math.sin(a) * 0.8, -0.7, Math.cos(a) * 0.8);
      pv.rotation.x = Math.PI / 2 + 0.4;
      pv.rotation.y = a;
      tentacle(pv, 3, 0.5, 0.2);
    }
    armL = pivot(body, -1.1, 0.2, 0.2);
    part(cyl(0.1, 0.1, 1.3, 5), bodyMat, -0.55, 0, 0, armL).rotation.z = Math.PI / 2;
    part(sphere(0.22, 6, 5), em, -1.25, 0, 0, armL);
    armR = pivot(body, 1.1, 0.2, 0.2);
    part(cyl(0.1, 0.1, 1.3, 5), bodyMat, 0.55, 0, 0, armR).rotation.z = Math.PI / 2;
    part(sphere(0.22, 6, 5), em, 1.25, 0, 0, armR);
    legL = pivot(body, -0.3, -1, 0);
    legR = pivot(body, 0.3, -1, 0);
  } else if (monster === 'saucer') {
    const body = pivot(root, 0, 2.2, 0);
    part(cyl(2.2, 1.4, 0.45, 18), bodyMat, 0, 0, 0, body);
    part(cyl(1.4, 2.2, 0.25, 18), mat(look.metal ?? 0x90a4ae, { metalness: 0.6 }), 0, -0.33, 0, body);
    part(sphere(0.95, 12, 8), mat(look.dome ?? 0x80deea, { emissive: look.dome ?? 0x80deea, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }), 0, 0.35, 0, body).scale.y = 0.7;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      part(sphere(0.14, 5, 4), glowM, Math.sin(a) * 1.95, 0, Math.cos(a) * 1.95, body);
    }
    part(cyl(0.6, 0.9, 0.3, 10), glowM, 0, -0.55, 0, body); // 下の光
    armL = pivot(body, -1.0, -0.5, 0.6);
    part(box(0.12, 1.2, 0.12), horn, 0, -0.6, 0, armL);
    part(box(0.35, 0.2, 0.35), em, 0, -1.25, 0, armL);
    armR = pivot(body, 1.0, -0.5, 0.6);
    part(box(0.12, 1.2, 0.12), horn, 0, -0.6, 0, armR);
    part(box(0.35, 0.2, 0.35), em, 0, -1.25, 0, armR);
    legL = pivot(body, -0.5, -0.6, -0.5);
    legR = pivot(body, 0.5, -0.6, -0.5);
  } else {
    // kaiju：二足で立つ宇宙怪獣。背びれ（glow）・長い尾・大きな顎
    part(box(1.6, 1.9, 1.3), bodyMat, 0, 2.4, 0, root); // 胴
    part(box(1.2, 1.5, 0.3), bel, 0, 2.3, 0.62, root);
    const head = pivot(root, 0, 3.4, 0.4);
    head.userData.rx = 0;
    part(box(1.0, 0.8, 1.2), bodyMat, 0, 0.3, 0.4, head);
    part(box(0.9, 0.3, 0.9), bodyMat, 0, -0.15, 0.8, head); // 下顎
    for (let i = 0; i < 4; i++) part(cone(0.06, 0.2, 3), horn, -0.3 + i * 0.2, -0.0, 1.2, head).rotation.x = Math.PI;
    part(box(0.16, 0.12, 0.05), em, -0.3, 0.45, 1.01, head);
    part(box(0.16, 0.12, 0.05), em, 0.3, 0.45, 1.01, head);
    for (const sd of [-1, 1]) part(cone(0.12, 0.7, 4), horn, sd * 0.35, 0.85, 0.1, head).rotation.z = sd * -0.4;
    heads = [head];
    // 背びれ（光る結晶）
    for (let i = 0; i < 6; i++) {
      const s = 1 - Math.abs(i - 1.5) * 0.15;
      part(cone(0.28 * s, 1.0 * s, 4), glowM, 0, 3.3 - i * 0.35, -0.6 - i * 0.35, root).rotation.x = -0.5;
    }
    // 尾
    let cur = pivot(root, 0, 1.7, -0.6);
    for (let i = 0; i < 5; i++) {
      part(box(0.8 - i * 0.12, 0.7 - i * 0.1, 1.0), bodyMat, 0, 0, -0.5, cur);
      part(cone(0.12, 0.4, 4), glowM, 0, 0.4 - i * 0.04, -0.5, cur);
      const nx = pivot(cur, 0, 0, -0.95);
      nx.rotation.x = 0.12;
      cur = nx;
    }
    const arm = (sd) => {
      const pv = pivot(root, sd * 0.95, 2.9, 0.3);
      part(box(0.4, 0.9, 0.4), bodyMat, 0, -0.4, 0.1, pv);
      part(box(0.5, 0.3, 0.5), horn, 0, -0.95, 0.2, pv);
      return pv;
    };
    armL = arm(-1);
    armR = arm(1);
    const leg = (sd) => {
      const pv = pivot(root, sd * 0.6, 1.5, 0);
      part(box(0.75, 1.5, 0.85), bodyMat, 0, -0.7, 0, pv);
      part(box(0.9, 0.25, 1.2), horn, 0, -1.4, 0.2, pv);
      return pv;
    };
    legL = leg(-1);
    legR = leg(1);
  }
  group.scale.setScalar(scale);
  return { group, root, armL, armR, legL, legR, bodyMat, heads };
}
