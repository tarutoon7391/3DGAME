// 野球場（ローポリ）：グラウンド・ダイヤモンド・フェンス・観客・選手・ボール・ストライクゾーン
import * as THREE from 'three';
import { addLights, makeFigure, makeBlobShadow } from '../core/env.js';

export const ZONE = { L: -0.25, R: 0.25, B: 0.5, T: 1.1 };
export const FENCE = 96;
export const MOUND_Z = -18.44;
const BASE_D = 27.43 / Math.SQRT2;
/** 塁の位置（0=本塁,1=一塁,2=二塁,3=三塁） */
export const BASES = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(BASE_D, 0, -BASE_D),
  new THREE.Vector3(0, 0, -BASE_D * 2),
  new THREE.Vector3(-BASE_D, 0, -BASE_D),
];

/** 守備位置：角度（度、+ が一塁側）と本塁からの距離 */
export const FIELDERS = [
  { name: '投', a: 0, d: 18.4 },
  { name: '一', a: 36, d: 27 },
  { name: '二', a: 14, d: 35 },
  { name: '遊', a: -14, d: 35 },
  { name: '三', a: -36, d: 27 },
  { name: '左', a: -28, d: 74 },
  { name: '中', a: 0, d: 80 },
  { name: '右', a: 28, d: 74 },
];

export function polar(aDeg, d, out = new THREE.Vector3()) {
  const a = (aDeg * Math.PI) / 180;
  out.x = Math.sin(a) * d; // 素のオブジェクトでも Vector3 でも使える
  out.y = 0;
  out.z = -Math.cos(a) * d;
  return out;
}

export function buildField(group) {
  addLights(group, { size: 60, sunPos: [-30, 60, 20], target: [0, 0, -40], intensity: 2.4 });

  const grass = new THREE.Mesh(new THREE.CircleGeometry(140, 48), new THREE.MeshStandardMaterial({ color: 0x3c8d3a, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  group.add(grass);
  // 芝の縞（扇形）
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x48a044, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.RingGeometry(20 + i * 14, 27 + i * 14, 32, 1, Math.PI / 4, Math.PI / 2), stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.rotation.z = 0;
    s.position.y = 0.005;
    s.receiveShadow = true;
    group.add(s);
  }
  // 内野の土（扇形）
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0xb5835a, roughness: 1 });
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(29, 32, Math.PI / 4, Math.PI / 2), dirtMat);
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.y = 0.01;
  dirt.receiveShadow = true;
  group.add(dirt);
  // 内野の芝（ダイヤモンドの内側）
  const infield = new THREE.Mesh(new THREE.PlaneGeometry(BASE_D * 1.15, BASE_D * 1.15), new THREE.MeshStandardMaterial({ color: 0x45993f, roughness: 1 }));
  infield.rotation.x = -Math.PI / 2;
  infield.rotation.z = Math.PI / 4;
  infield.position.set(0, 0.015, -BASE_D);
  infield.receiveShadow = true;
  group.add(infield);
  // マウンド・本塁周り
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 0.25, 20), dirtMat);
  mound.position.set(0, 0.12, MOUND_Z);
  mound.receiveShadow = true;
  group.add(mound);
  const homeDirt = new THREE.Mesh(new THREE.CircleGeometry(4, 20), dirtMat);
  homeDirt.rotation.x = -Math.PI / 2;
  homeDirt.position.y = 0.016;
  homeDirt.receiveShadow = true;
  group.add(homeDirt);
  // ベース
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  BASES.forEach((b, i) => {
    const m = i === 0
      ? new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 5), white)
      : new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), white);
    m.position.set(b.x, 0.03, b.z);
    if (i === 0) m.rotation.y = Math.PI / 2 + Math.PI / 5;
    else m.rotation.y = Math.PI / 4;
    m.receiveShadow = true;
    group.add(m);
  });
  // ファウルライン
  [-45, 45].forEach((a) => {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.1, FENCE), white);
    l.rotation.x = -Math.PI / 2;
    l.rotation.z = (-a * Math.PI) / 180;
    const p = polar(a, FENCE / 2);
    l.position.set(p.x, 0.02, p.z);
    group.add(l);
  });
  // フェンス（扇形の壁）＋ポール
  const fence = new THREE.Mesh(
    new THREE.CylinderGeometry(FENCE + 0.5, FENCE + 0.5, 3, 48, 1, true, Math.PI * 0.75, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.9, side: THREE.DoubleSide }),
  );
  fence.position.y = 1.5;
  fence.receiveShadow = true;
  group.add(fence);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xffd60a });
  [-45, 45].forEach((a) => {
    const p = polar(a, FENCE + 0.5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 14, 6), poleMat);
    pole.position.set(p.x, 7, p.z);
    group.add(pole);
  });
  // 外野スタンド（観客は InstancedMesh）
  const standMat = new THREE.MeshStandardMaterial({ color: 0x5a6270, roughness: 1 });
  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(FENCE + 22, FENCE + 4, 14, 40, 1, true, Math.PI * 0.72, Math.PI * 0.56),
    standMat,
  );
  stand.position.y = 7;
  stand.material.side = THREE.DoubleSide;
  group.add(stand);
  const crowdGeo = new THREE.CapsuleGeometry(0.5, 0.8, 2, 5);
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const COUNT = 700;
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, COUNT);
  const m4 = new THREE.Matrix4();
  const c = new THREE.Color();
  const palette = [0xe63946, 0xf1faee, 0x457b9d, 0xffb703, 0x2a9d8f, 0xe76f51, 0x8ecae6];
  const base = [];
  for (let i = 0; i < COUNT; i++) {
    const a = -48 + Math.random() * 96;
    const r = Math.random();
    const d = FENCE + 5 + r * 16;
    const p = polar(a, d);
    const y = 1 + r * 12.5;
    base.push([p.x, y, p.z]);
    m4.setPosition(p.x, y, p.z);
    crowd.setMatrixAt(i, m4);
    crowd.setColorAt(i, c.setHex(palette[(Math.random() * palette.length) | 0]));
  }
  group.add(crowd);
  let excite = 0;

  // ストライクゾーン枠（打撃時のみ表示）
  const zoneGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(ZONE.R - ZONE.L, ZONE.T - ZONE.B));
  const zone = new THREE.LineSegments(zoneGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  zone.position.set(0, (ZONE.T + ZONE.B) / 2, 0);
  group.add(zone);
  // バットの芯カーソル
  const cursor = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.1, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, depthTest: false }),
  );
  cursor.renderOrder = 5;
  group.add(cursor);
  // バット（カーソルに向けて振る）
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0xc8a165, roughness: 0.6 }));
  bat.geometry.translate(0, 0.45, 0);
  bat.castShadow = true;
  group.add(bat);

  return {
    zone,
    cursor,
    bat,
    cheer(v = 1) {
      excite = Math.max(excite, v);
    },
    update(dt, time) {
      if (excite <= 0) return;
      excite = Math.max(0, excite - dt * 0.5);
      for (let i = 0; i < COUNT; i++) {
        const b = base[i];
        m4.setPosition(b[0], b[1] + Math.max(0, Math.sin(time * 11 + i)) * 0.6 * Math.min(1, excite), b[2]);
        crowd.setMatrixAt(i, m4);
      }
      crowd.instanceMatrix.needsUpdate = true;
    },
  };
}

/** 選手一式（守備8人＋捕手＋打者＋走者3人）。色はチームごとに塗り替える */
export function buildPlayers(group) {
  const mk = (color) => {
    const f = makeFigure({ color, hat: 0x1b263b });
    const sh = makeBlobShadow(0.45);
    group.add(f.root, sh);
    return { ...f, sh, home: new THREE.Vector3() };
  };
  const fielders = FIELDERS.map((fd) => {
    const f = mk(0xffffff);
    polar(fd.a, fd.d, f.home);
    return f;
  });
  const catcher = mk(0xffffff);
  catcher.home.set(0, 0, 1.0);
  const batter = mk(0xffffff);
  batter.home.set(-0.85, 0, 0.05);
  const runners = [1, 2, 3].map(() => mk(0xffffff));
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x333333 }));
  ball.castShadow = true;
  const ballShadow = makeBlobShadow(0.07);
  group.add(ball, ballShadow);
  return { fielders, catcher, batter, runners, ball, ballShadow };
}

/** チームの色に塗る（守備側・攻撃側） */
export function paintTeams(pl, fieldColor, batColor) {
  const paint = (f, c) => f.body.material.color.setHex(c);
  pl.fielders.forEach((f) => paint(f, fieldColor));
  paint(pl.catcher, fieldColor);
  paint(pl.batter, batColor);
  pl.runners.forEach((r) => paint(r, batColor));
}
