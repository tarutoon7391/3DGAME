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

/** エリアを作り直してプレイヤーを入口に置く（HP・スタミナは全回復） */
export function loadArea(game, id) {
  game.enemies.clear();
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
  // 迷路：番人と雑魚
  const seals = game.world.extra.seals || [];
  for (const [type, ex, ez, sealId] of game.world.extra.spawns || []) {
    const e = game.enemies.spawn(type, ex, ez, sealId);
    if (sealId >= 0) seals[sealId].guards.push(e);
  }
  if (def.boss) game.boss = createBoss(game, def.boss.x, def.boss.z);
  // 自分以外のプレイヤーも入口の近くへ
  const sp = def.spawn;
  game.players.forEach((p, i) => p.reset(sp.x + i * 1.2, sp.z, Math.PI));
  game.state.progress.area = id;
  game.cam.snapBehind(Math.PI);
  if (def.camPitch) game.cam.pitch = def.camPitch;
  game.sound.bgm(def.bgm);
  game.hudView.banner(def.name);
  game.hudView.refresh();
}

/** 結界：番人が全滅したら開く（雑魚を倒すたびに呼ぶ） */
export function checkSeals(game) {
  for (const s of game.world.extra.seals || []) {
    if (s.open || s.guards.some((e) => e.alive)) continue;
    s.open = true;
    s.col.off = true;
    game.sound.se('seal');
    game.fx.burst(s.x, 1.5, s.z, 0xff8a80, 30, { speed: 5, up: 4, life: 0.8 });
    const left = game.world.extra.seals.filter((o) => !o.open).length;
    game.toast(left ? `結界が消えた！（残り ${left}）` : '最後の結界が消えた！ 出口へ急げ', 2400);
  }
}

/** 次の結界（まだ閉じているもののうち、正解ルートで一番手前）と残りの番人の数 */
export function nextSeal(game) {
  const seals = game.world?.extra.seals;
  if (!seals) return null;
  const s = seals.find((o) => !o.open);
  if (!s) return { done: true, total: seals.length };
  return { done: false, left: s.guards.filter((e) => e.alive).length, opened: seals.filter((o) => o.open).length, total: seals.length };
}

/** 毎フレーム：ゲート・調べる・ボス部屋 */
export function updateAreaLogic(game, intent) {
  const me = game.me();
  const w = game.world;
  // ゲート（次のステージへ）
  for (const g of w.gates) {
    if (Math.hypot(me.pos.x - g.x, me.pos.z - g.z) > 2.1) continue;
    game.startTransition(g.to);
    return;
  }
  // 調べる（看板）
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
