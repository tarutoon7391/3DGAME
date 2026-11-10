// テニスコート（ローポリ）：コート面・ライン・ネット・観客・選手とラケット
import * as THREE from 'three';
import { addLights, addCrowd, makeFigure, makeBlobShadow } from '../core/env.js';
import { COURT } from './physics.js';

export function buildCourt(group) {
  addLights(group, { size: 20, sunPos: [8, 22, 6] });
  const { HALF_W, HALF_L, SERVICE_L, NET_H } = COURT;

  // 周りの地面とコート面
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(60, 70), new THREE.MeshStandardMaterial({ color: 0x2f6e4f, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2;
  outer.receiveShadow = true;
  group.add(outer);
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2 + 6, HALF_L * 2 + 10),
    new THREE.MeshStandardMaterial({ color: 0x2d6fb7, roughness: 0.9 }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.005;
  surface.receiveShadow = true;
  group.add(surface);
  const inner = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2, HALF_L * 2),
    new THREE.MeshStandardMaterial({ color: 0x3a86d4, roughness: 0.85 }),
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.008;
  inner.receiveShadow = true;
  group.add(inner);

  // ライン（細い板）
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const line = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.012, z);
    m.receiveShadow = true;
    group.add(m);
  };
  const LW = 0.07;
  line(0, HALF_L, HALF_W * 2 + LW, LW); // ベースライン
  line(0, -HALF_L, HALF_W * 2 + LW, LW);
  line(HALF_W, 0, LW, HALF_L * 2); // サイドライン
  line(-HALF_W, 0, LW, HALF_L * 2);
  line(0, SERVICE_L, HALF_W * 2, LW); // サービスライン
  line(0, -SERVICE_L, HALF_W * 2, LW);
  line(0, 0, LW, SERVICE_L * 2); // センターサービスライン
  line(0, HALF_L - 0.15, LW, 0.3); // センターマーク
  line(0, -HALF_L + 0.15, LW, 0.3);

  // ネット：ポスト・半透明の網・白い帯
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1b2430, metalness: 0.3, roughness: 0.5 });
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, NET_H + 0.15, 8), postMat);
    p.position.set(s * (HALF_W + 0.5), (NET_H + 0.15) / 2, 0);
    p.castShadow = true;
    group.add(p);
  });
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2 + 1, NET_H, 30, 6),
    new THREE.MeshStandardMaterial({ color: 0x111111, wireframe: true, transparent: true, opacity: 0.75 }),
  );
  net.position.set(0, NET_H / 2, 0);
  group.add(net);
  const netFill = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2 + 1, NET_H),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  );
  netFill.position.copy(net.position);
  group.add(netFill);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 1, 0.07, 0.03), lineMat);
  tape.position.set(0, NET_H, 0);
  tape.castShadow = true;
  group.add(tape);

  // 観客
  const crowd = addCrowd(group, { halfX: HALF_W + 6, halfZ: HALF_L + 7, rows: 4, sides: ['n', 'e', 'w'] });

  // 審判台
  const chair = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 0.6), postMat);
  chair.position.set(HALF_W + 1.4, 1.1, 0);
  chair.castShadow = true;
  group.add(chair);
  const ump = makeFigure({ color: 0x264653, height: 1.5 });
  ump.root.position.set(HALF_W + 1.4, 2.2, 0);
  ump.root.rotation.y = -Math.PI / 2;
  group.add(ump.root);

  return { crowd };
}

/** 選手（人物＋ラケット） */
export function buildPlayer(group, color, hat) {
  const fig = makeFigure({ color, hat });
  const racket = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  handle.position.y = -0.62;
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 16), new THREE.MeshStandardMaterial({ color: 0xe63946 }));
  head.position.y = -0.92;
  const strings = new THREE.Mesh(
    new THREE.CircleGeometry(0.14, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  strings.position.y = -0.92;
  racket.add(handle, head, strings);
  racket.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  fig.armR.add(racket);
  const shadow = makeBlobShadow(0.45);
  group.add(fig.root, shadow);
  return { ...fig, racket, shadow };
}

/** ボール＋影＋着地予測マーカー */
export function buildBall(group) {
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(COURT.R, 1), new THREE.MeshStandardMaterial({ color: 0xe4ff3a, emissive: 0x334400, roughness: 0.5 }));
  ball.castShadow = true;
  const shadow = makeBlobShadow(0.1);
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.25, 0.34, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.7, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.02;
  marker.visible = false;
  group.add(ball, shadow, marker);
  return { ball, shadow, marker };
}
