// エリアの読み込み・ライティング・ゲート遷移・調べる・ボス部屋の開始
import * as THREE from 'three';
import { AREAS } from './data/areas.js';
import { BOSS } from './data/enemies.js';
import { createWorld } from './world/build.js';
import { createBoss } from './boss.js';

/** シーン共通のライト（エリアごとに色・強さを変える） */
export function createLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 0.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -32; c.right = 32; c.top = 32; c.bottom = -32; c.near = 1; c.far = 120;
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  // ダンジョン用の手持ちランタン
  const lantern = new THREE.PointLight(0xffd8a0, 0, 16, 1.3);
  scene.add(lantern);
  return {
    hemi, sun, lantern,
    apply(def) {
      scene.background = new THREE.Color(def.sky);
      scene.fog = new THREE.Fog(def.sky, def.fog[0], def.fog[1]);
      sun.color.setHex(def.sun.color);
      sun.intensity = def.sun.intensity;
      hemi.intensity = def.sun.hemi;
      hemi.color.setHex(def.dark ? 0x8877aa : 0xffffff);
      hemi.groundColor.setHex(def.dark ? 0x221a2a : 0x445533);
      lantern.intensity = def.dark ? 30 : 0;
    },
    follow(p) {
      sun.position.set(p.x + 18, 32, p.z + 12);
      sun.target.position.set(p.x, 0, p.z);
      lantern.position.set(p.x, 3.2, p.z);
    },
  };
}

/** エリアを作り直してプレイヤーを置く */
export function loadArea(game, id, x, z, yaw = Math.PI) {
  game.enemies.clear();
  game.pickups.clear();
  game.projectiles.clear();
  game.fx.clear();
  if (game.boss) {
    game.boss.dispose();
    game.boss = null;
  }
  if (game.world) game.world.dispose();

  const def = AREAS[id];
  game.world = createWorld(id, game);
  game.lights.apply(def);
  for (const [type, ex, ez] of def.enemies || []) game.enemies.spawn(type, ex, ez);
  if (def.boss && game.state.progress.quests.boss.status !== 'cleared') {
    game.boss = createBoss(game, def.boss.x, def.boss.z);
  }
  // 自分以外のプレイヤーも同じ場所の近くへ
  game.players.forEach((p, i) => {
    p.alive = true;
    p.place(x + i * 1.2, z, yaw);
  });
  const pr = game.state.progress;
  pr.area = id;
  pr.x = x;
  pr.z = z;
  game.cam.snapBehind(yaw);
  game.sound.bgm(def.bgm);
  game.hudView.banner(def.name);
  game.hudView.refresh();
}

/** 毎フレーム：ゲート・調べる・ボス部屋 */
export function updateAreaLogic(game, intent) {
  const me = game.me();
  const w = game.world;
  // ゲート
  for (const g of w.gates) {
    const d = Math.hypot(me.pos.x - g.x, me.pos.z - g.z);
    if (d > 2.1) continue;
    if (!game.gateOpen(g)) {
      game.toastOnce('魔物の気配が強すぎる……。村長の話を聞いてからにしよう');
      const dz = Math.sign(me.pos.z - g.z) || 1;
      me.pos.z = g.z + dz * 2.3;
      continue;
    }
    // 到着側のゲートに背を向けて立つ
    const back = AREAS[g.to].gates.find((o) => o.to === w.id);
    game.startTransition(g.to, g.toX, g.toZ, back && back.z > g.toZ ? Math.PI : 0);
    return;
  }
  // 調べる・話す（一番近いもの）
  let best = null;
  let bd = Infinity;
  for (const it of w.interactables) {
    if (!it.active) continue;
    const d = Math.hypot(me.pos.x - it.x, me.pos.z - it.z);
    if (d < it.r && d < bd) {
      bd = d;
      best = it;
    }
  }
  game.hudView.setPrompt(best ? best.label : '');
  if (best && intent.interact) best.action(game);

  // ボス部屋に入ったら戦闘開始（扉を閉じる）
  const b = game.boss;
  if (b && b.alive && !b.active && w.def.boss && me.pos.z < w.def.boss.triggerZ) {
    b.wake();
    w.extra.setDoor?.(false);
    game.sound.bgm('boss');
    game.hudView.banner(BOSS.name);
  }
}
