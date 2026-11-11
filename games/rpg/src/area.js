// エリアの読み込み・ライティング・ゲート遷移・調べる・ボス部屋の開始
import * as THREE from 'three';
import { AREAS } from './data/areas.js';
import { createWorld } from './world/build.js';
import { createBoss } from './boss.js';
import { RAID_SCALE } from './data/jobs.js';
import { clearJobZones } from './jobs.js';

/**
 * 部屋のボスを作る（参加者のブラウザでは見た目だけの puppet。人数で HP を増やす）
 * 部屋の定義 bd に pair（[{ key, x, z }, ...]）があれば2体同時。戻り値はボスの配列
 */
export function makeRoom(game, bd, idx) {
  const o = { puppet: !!game.isClient, scale: RAID_SCALE(game.players.length) };
  const list = bd.pair || [{ key: bd.key, x: bd.x, z: bd.z }];
  return list.map((m, sub) => createBoss(game, m.key, m.x, m.z, idx, { ...o, sub }));
}

function disposeBosses(game) {
  for (const b of game.bosses) b.dispose();
  game.bosses = [];
}

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

/**
 * エリアを作り直してプレイヤーを入口に置く（HP・スタミナは全回復）
 * ボスが複数いるエリアでは progress.bossStep（倒したボスの数）から再開する：倒したボスは出さず、その次のボスの部屋の前から
 */
export function loadArea(game, id) {
  const pr = game.state.progress;
  if (pr.area !== id) pr.bossStep = 0; // 別のステージに入ったら最初のボスから
  const step = pr.bossStep || 0;
  game.enemies.clear();
  game.projectiles.clear();
  game.allies?.clear();
  game.hazards?.clear();
  clearJobZones();
  game.fx.clear();
  disposeBosses(game);
  if (game.world) game.world.dispose();

  const def = AREAS[id];
  game.world = createWorld(id, game);
  game.lights.apply(def);
  if (step === 0 && !game.isClient) for (const [type, ex, ez] of def.enemies || []) game.enemies.spawn(type, ex, ez);
  // 迷路：番人と雑魚
  const seals = game.world.extra.seals || [];
  for (const [type, ex, ez, sealId] of game.world.extra.spawns || []) {
    const e = game.enemies.spawn(type, ex, ez, sealId);
    if (sealId >= 0) seals[sealId].guards.push(e);
  }
  const bd = def.bosses?.[step];
  if (bd) {
    game.bosses = makeRoom(game, bd, step);
    // 途中から：その部屋の扉だけ開けておく
    if (step > 0) game.world.extra.doors?.forEach((set, i) => set(i === bd.door, true));
  }
  // 自分以外のプレイヤーも入口（再開地点）の近くへ
  const sp = (step > 0 && bd?.respawn) || def.spawn;
  // 4人ずつ横に並べる（8人なら2列。入口通路の幅に収まるように）
  game.players.forEach((p, i) => {
    const row = Math.floor(i / 4);
    const inRow = Math.min(4, game.players.length - row * 4);
    p.reset(sp.x + ((i % 4) - (inRow - 1) / 2) * 1.6, sp.z + row * 1.8, Math.PI);
  });
  game.state.progress.area = id;
  game.cam.snapBehind(Math.PI);
  if (def.camPitch) game.cam.setTpsPitch(def.camPitch);
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

  // ボス部屋に誰かが入ったら戦闘開始（後ろの扉を閉じる）。参加者はホストの合図を待つ
  if (game.isClient) return;
  const b = game.bosses[0];
  const room = b && w.def.bosses?.[b.idx];
  if (room && !b.active && game.bosses.some((o) => o.alive) && game.players.some((p) => p.alive && p.pos.z < room.triggerZ)) {
    for (const o of game.bosses) o.wake(); // 2体同時の部屋は両方いっぺんに目覚める
    setDoor(game, room.door, false);
    // 扉の外に残っている人は部屋の中へ呼び寄せる
    const dz = w.def.doors?.[room.door]?.z;
    if (dz !== undefined) gather(game, room.triggerZ - 1, dz);
    const last = b.idx === w.def.bosses.length - 1;
    const names = game.bosses.map((o) => o.name).join(' ＆ ');
    game.sound.bgm(last && w.def.castle ? 'lastboss' : 'boss');
    game.hudView.banner(last ? names : `${room.label || '中ボス'}　${names}`);
  }
}

/**
 * ボスが倒れきったとき（boss.js から）。まだ次のボスがいれば奥の扉を開けて次へ、
 * 最後のボスなら次のステージへ（なければクリア）
 */
export function bossDown(game, b) {
  game.withMirror ? game.withMirror(() => bossDownInner(game, b)) : bossDownInner(game, b);
}
function bossDownInner(game, b) {
  const w = game.world;
  const def = w.def;
  const list = def.bosses || [];
  const pr = game.state.progress;
  const next = list[b.idx + 1];
  // 2体同時の部屋：もう1体が残っていればまだ続く
  const rest = game.bosses.filter((o) => o.alive);
  if (rest.length) {
    game.toast(`${b.name}を倒した！ 残るは ${rest.map((o) => o.name).join('・')}`, 2600);
    return;
  }
  game.projectiles.clearEnemyShots(); // 残った弾は消す
  if (next) {
    pr.bossStep = b.idx + 1;
    for (const e of game.enemies.list) if (e.alive) e.takeHit(game, 9999, 0, 0, 0); // 手下も消える
    setDoor(game, next.door, true);
    game.raid?.event('step', pr.bossStep);
    game.onBossStep(pr.bossStep); // 全回復・蘇生（自分）
    disposeBosses(game);
    game.bosses = makeRoom(game, next, b.idx + 1);
    game.sound.bgm(def.bgm);
    game.sound.se('seal');
    const left = list.length - (b.idx + 1);
    game.toast(`${b.name}を倒した！ HP が全回復した。奥の扉が開いた（残り ${left} 部屋）`, 3200);
    game.autosave();
    return;
  }
  if (def.next) {
    game.toast(`${b.name}を倒した！ さらに奥へ……`, 2600);
    game.startTransition(def.next);
    return;
  }
  game.onBossDefeated();
}

/** 扉の開け閉め（ホスト。参加者にも伝える） */
export function setDoor(game, i, open) {
  game.world.extra.doors?.[i]?.(open);
  game.raid?.event('door', i, open);
}

/** z が doorZ より手前（入口側）にいる人を (0, toZ) へ呼び寄せる（ホスト。参加者にも伝える） */
export function gather(game, toZ, doorZ) {
  game.raid?.event('gather', toZ, doorZ);
  game.gatherLocal(toZ, doorZ);
}
