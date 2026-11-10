// ゲーム本体：入力の読み取り → 状態更新 → 見た目の反映、1日の流れ（就寝・セーブ・リザルト）
import * as THREE from 'three';
import { createApp } from '/shared/engine.js';
import { createInput } from '/shared/input.js';
import { showTitle, hud, showPause, hidePause, isPaused, showResult, toast, isOverlayOpen, closeAll } from '/shared/ui.js';
import { createSave } from '/shared/save.js';
import { CROPS } from './data/crops.js';
import { HOUR_SECONDS, DAY_START_HOUR, DAY_END_HOUR, RAIN_CHANCE, STAMINA_MAX, PASSOUT_STAMINA, WALK_SPEED, TIRED_SPEED, SHIP_EXP_RATE, CLEAR_LEVEL, shopEntries } from './data/balance.js';
import { ITEMS } from './data/items.js';
import { newState, validate, addExp as addExpState } from './state.js';
import { createWorld, SPAWN } from './world.js';
import { createField } from './field.js';
import { createPlayer } from './player.js';
import { createAnimals } from './animals.js';
import { createSky } from './sky.js';
import { createParticles } from './particles.js';
import { createSound } from './sound.js';
import { createPanels, createHotbar, createHint } from './panel.js';
import { createMenus } from './menus.js';
import { createActions } from './actions.js';
import { fillQuests } from './quests.js';
import { buildHud, buildHotbar, nextGoal, unwateredCount } from './hud.js';

const CAM_OFFSET = new THREE.Vector3(0, 11, 8.5);
const KEY_TOOLS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];

export function startGame() {
  const { renderer, scene, camera, start } = createApp({ canvas: document.getElementById('game') });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const input = createInput(renderer.domElement);
  const store = createSave('farm');
  const sfx = createSound();

  // 状態は1つのオブジェクトにまとめる（JSON でそのまま保存できる形）。中身だけ入れ替えて参照を保つ
  const state = newState();
  const replaceState = (src) => {
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, src);
  };

  const world = createWorld(scene);
  const field = createField(scene, state);
  const animals = createAnimals(scene, state);
  const sky = createSky(scene);
  const particles = createParticles(scene);
  // プレイヤーは配列で持つ（操作するのは localIndex 番）
  const players = [createPlayer(scene, world.colliders)];
  const localIndex = 0;
  const me = () => players[localIndex];

  const panels = createPanels();
  const hotbar = createHotbar();
  const hintEl = createHint();
  hotbar.show(false);

  let playing = false;
  let shakeT = 0;
  let zoom = 1;
  let stepT = 0;
  let goalT = 0;
  let goal = '';
  let warned24 = false;
  let pendingClear = false;
  const camTarget = new THREE.Vector3();
  const lastToast = { m: '', t: 0 };

  const ctx = {
    state, sfx, field, animals, particles,
    toast: (m) => {
      // 同じメッセージの連打は出さない
      const now = performance.now();
      if (m === lastToast.m && now - lastToast.t < 1500) return;
      lastToast.m = m;
      lastToast.t = now;
      toast(m, 2600);
    },
    interactables: world.interactables,
    shake: (s) => { shakeT = Math.max(shakeT, s); },
    openMenu: (kind) => menus.open(kind),
    addExp,
    sleep: (passedOut) => endDay(passedOut),
    setTool,
    unwateredCount: () => unwateredCount(state),
  };
  const menus = createMenus(panels, ctx);
  const actions = createActions(ctx);

  function setTool(i) {
    state.tool = i;
    players.forEach((p) => p.setTool(i));
  }

  /** EXP 加算とレベルアップ演出。レベル5到達でクリア画面 */
  function addExp(n) {
    const ups = addExpState(state, n);
    for (const lv of ups) {
      const unlocked = [
        ...Object.values(CROPS).filter((c) => c.level === lv).map((c) => c.name),
        ...shopEntries().filter((e) => e.level === lv && e.kind !== 'item').map((e) => (e.kind === 'animal' ? (e.animal === 'cow' ? 'ウシ' : 'ニワトリ') : e.kind === 'expand' ? '畑の拡張' : '道具強化')),
      ];
      toast(`🎉 農場レベル ${lv} にアップ！${unlocked.length ? `　解放：${[...new Set(unlocked)].join('・')}` : ''}`, 4000);
      sfx.levelUp();
      const p = me().pos;
      particles.burst(p.x, 1.5, p.z, 0xffd54f, { n: 30, up: 5, speed: 3, life: 1.2 });
    }
    if (state.level >= CLEAR_LEVEL && !state.cleared) {
      state.cleared = true;
      pendingClear = true;
    }
    return ups;
  }

  function showClear() {
    pendingClear = false;
    panels.close();
    store.save(state);
    showResult({
      title: `🏆 農場レベル${CLEAR_LEVEL} 達成！`,
      lines: [
        `${state.day} 日目で目標を達成しました`,
        `出荷総額 ${state.totalShipped}G ／ 依頼達成 ${state.questsDone} 件 ／ 動物 ${state.animals.length} 匹`,
        'メロンと金の道具が解放されました。このまま農場を続けられます。',
      ],
      retryLabel: '続けて遊ぶ',
      onRetry: () => {},
      extraButtons: [{ label: '最初から', onClick: newGame }],
    });
  }

  /** 就寝（passedOut=true は 2:00 に力尽きた） */
  function endDay(passedOut) {
    const finished = state.day;
    let income = 0;
    for (const [id, n] of Object.entries(state.ship)) income += ITEMS[id].sell * n;
    state.ship = {};
    state.money += income;
    state.totalShipped += income;
    const rain = Math.random() < RAIN_CHANCE;
    state.weather = rain ? 'rain' : 'sunny';
    const grown = field.newDay(rain);
    const made = animals.newDay();
    state.day += 1;
    state.time = 0;
    state.stamina = passedOut ? Math.round(STAMINA_MAX * PASSOUT_STAMINA) : STAMINA_MAX;
    warned24 = false;
    me().setPose(SPAWN.x, SPAWN.z, 0);
    const levelBefore = state.level;
    const shipExp = Math.floor(income * SHIP_EXP_RATE);
    addExp(shipExp);
    fillQuests(state);
    store.save(state);
    sfx.sleep();
    const lines = [];
    if (passedOut) lines.push('夜中の2時。力尽きて倒れてしまった…（スタミナ半分で目覚めた）');
    lines.push(income ? `出荷の売上 ${income}G（農場EXP +${shipExp}）` : '今日は出荷しなかった');
    lines.push(`育った作物 ${grown} マス` + (state.animals.length ? `／動物の生産物 ${made.made} 個${made.hungry ? `（おなかをすかせた動物 ${made.hungry}）` : ''}` : ''));
    if (state.level > levelBefore) lines.push(`農場レベル ${state.level} にアップ！`);
    lines.push(`${state.day} 日目の天気：${rain ? '☔ 雨（水やり不要）' : '☀ 晴れ'}`);
    lines.push('💾 セーブしました');
    showResult({
      title: `🌙 ${finished} 日目 おしまい`,
      lines,
      retryLabel: '朝をむかえる',
      onRetry: () => { if (pendingClear) showClear(); },
    });
  }

  function begin() {
    playing = true;
    field.markDirty();
    animals.sync();
    me().setPose(SPAWN.x, SPAWN.z, 0);
    setTool(state.tool);
    hotbar.show(true);
    camTarget.copy(me().pos);
    goalT = 0;
  }

  function newGame() {
    closeAll();
    panels.close();
    replaceState(newState());
    fillQuests(state);
    pendingClear = false;
    warned24 = false;
    begin();
    toast('ようこそ！ まずは家の前の畑で 1:クワ を使って耕そう', 4000);
  }

  function continueGame() {
    const data = validate(store.load({}));
    if (!data) { newGame(); return; }
    replaceState(data);
    fillQuests(state);
    begin();
    toast(`${state.day} 日目の朝。おかえりなさい！`);
  }

  // ---- 入力の読み取り（状態は変えない） ----
  function readIntent() {
    let mx = 0, mz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) mz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) mz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;
    return {
      mx, mz,
      use: input.wasPressed('KeyF') || input.wasPressed('Mouse0'),
      interact: input.wasPressed('KeyE'),
      tool: KEY_TOOLS.findIndex((k) => input.wasPressed(k)),
      inventory: input.wasPressed('Tab'),
      pause: input.wasPressed('Escape'),
      zoom: input.mouse.wheel,
    };
  }

  // ---- 状態更新（プレイ中・メニューなし） ----
  function step(dt, it) {
    const p = me();
    state.time += dt;
    const hour = DAY_START_HOUR + state.time / HOUR_SECONDS;
    if (hour >= 24 && !warned24) { warned24 = true; toast('もう0時。2時までに寝ないと倒れてしまう…', 3500); }
    if (hour >= DAY_END_HOUR) { endDay(true); return; }

    if (it.tool >= 0) {
      if (it.tool === 2 && state.tool === 2) cycleSeed();
      setTool(it.tool);
    }
    if (it.inventory) { menus.open('inventory'); return; }
    const speed = state.stamina > 0 ? WALK_SPEED : TIRED_SPEED;
    const moving = p.update(dt, it.mx, it.mz, speed);
    if (moving && (stepT -= dt) <= 0) { stepT = 0.33; sfx.step(); }
    if (it.use) actions.use(p);
    else if (it.interact) actions.interact(p);
    animals.update(dt, state.time);
    if (state.animals.length && Math.random() < dt * 0.08) {
      const a = state.animals[Math.floor(Math.random() * state.animals.length)];
      if (Math.hypot(a.x - p.pos.x, a.z - p.pos.z) < 9) (a.type === 'cow' ? sfx.moo : sfx.cluck)();
    }
    if (pendingClear) showClear();
  }

  function cycleSeed() {
    const owned = Object.keys(CROPS).filter((id) => (state.items[`seed_${id}`] ?? 0) > 0);
    if (owned.length < 2) return;
    state.seed = owned[(owned.indexOf(state.seed) + 1) % owned.length];
    toast(`タネ：${CROPS[state.seed].name}`, 1200);
  }

  // ---- 見た目の反映（毎フレーム） ----
  function render(dt, time) {
    const p = me();
    const hour = DAY_START_HOUR + state.time / HOUR_SECONDS;
    camTarget.lerp(p.pos, Math.min(1, dt * 6));
    camera.position.copy(camTarget).addScaledVector(CAM_OFFSET, zoom);
    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - dt);
      camera.position.x += (Math.random() - 0.5) * shakeT * 2;
      camera.position.y += (Math.random() - 0.5) * shakeT * 2;
    }
    camera.lookAt(camTarget.x, camTarget.y + 0.6, camTarget.z);
    const night = sky.update(dt, hour, playing && state.weather === 'rain', camTarget);
    world.update(p.pos.x, p.pos.z, night, time);
    field.update(time);
    particles.update(dt);
    if (!playing) return;
    sfx.setBgm(hour >= 19 ? 'night' : 'day');
    const h = actions.hint(p);
    const L = h.look;
    field.showCursor(state.tool <= 3 && !panels.isOpen() ? L.tiles : [], L.tiles.length > 0);
    hintEl.set(isOverlayOpen() || panels.isOpen() ? '' : h.text);
    if ((goalT -= dt) <= 0) { goalT = 0.5; goal = nextGoal(state); }
    hud(buildHud(state, hour, goal));
    hotbar.set(buildHotbar(state));
  }

  let elapsed = 0;
  function loop(dt, time) {
    elapsed = time;
    const it = readIntent();
    if (it.zoom) zoom = Math.min(1.6, Math.max(0.55, zoom + it.zoom * 0.08));
    if (playing && it.pause) {
      if (panels.isOpen()) panels.close();
      else if (isPaused()) hidePause();
      else if (!isOverlayOpen()) showPause({ onRetry: newGame });
    } else if (playing && it.inventory && panels.isOpen()) {
      panels.close();
      it.inventory = false;
    }
    if (playing && !isOverlayOpen() && !panels.isOpen()) step(dt, it);
    render(dt, time);
    input.endFrame();
  }
  start(loop);
  // 動作確認用：URL に ?debug があるときだけ、フレームを手動で進める口を出す
  if (new URLSearchParams(location.search).has('debug')) {
    window.__farm = {
      state,
      tick: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) loop(dt, elapsed + dt); },
      goto: (x, z, f = 0) => me().setPose(x, z, f),
      pos: () => ({ x: me().pos.x, z: me().pos.z }),
    };
  }

  // タイトル（背景に農場を見せる）
  me().setPose(SPAWN.x, SPAWN.z + 6, 0);
  camTarget.set(-1, 0, 0);
  state.time = HOUR_SECONDS * 3;
  showTitle({
    title: '🌾 のんびり農場',
    desc: '畑を耕して作物を育て、出荷してお金を稼ごう。農場レベル5が目標（その後も続けられます）。1日は約5分、ベッドで寝ると翌日へ。',
    controls: 'WASD／矢印：移動\nF／左クリック：目の前のマスに道具を使う（収穫・拾うも）\n1〜5：道具切替（1クワ 2ジョウロ 3タネ 4カマ 5エサ）※3を再度押すとタネの種類切替\nE：話す・調べる（ショップ・出荷箱・依頼・ベッド・井戸・動物）\nTab：持ち物（タネ選択・食べる）　ホイール：ズーム　Esc：ポーズ',
    onStart: newGame,
    onContinue: store.exists() && validate(store.load({})) ? continueGame : undefined,
  });
}
