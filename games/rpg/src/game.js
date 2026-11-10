// ゲーム全体：初期化・メインループ・タイトル／ポーズ／全滅／クリアの流れ
// 状態の正本は game.state.progress（JSON 化可能）。入力は readIntent() でデータにしてから更新処理へ渡す
import { createApp } from '/shared/engine.js';
import { createInput } from '/shared/input.js';
import { createAudio } from '/shared/audio.js';
import { showTitle, showPause, hidePause, isPaused, showResult, toast, isOverlayOpen } from '/shared/ui.js';
import { createSave } from '/shared/save.js';
import { createState, newProgress } from './state.js';
import { createPlayer, emptyIntent } from './player.js';
import { createEnemies } from './enemies.js';
import { createProjectiles } from './projectiles.js';
import { createPickups } from './pickups.js';
import { createEffects } from './effects.js';
import { createSound } from './sound.js';
import { createCameraRig } from './camera.js';
import { createHudView } from './ui/hudview.js';
import { createModalHost, createDialog } from './ui/dialog.js';
import { createLights, loadArea, updateAreaLogic } from './area.js';
import { installActions } from './actions.js';
import { AREAS } from './data/areas.js';
import { DEATH_GOLD_LOSS } from './data/levels.js';
import { BOSS } from './data/enemies.js';
import { fmtTime } from './util.js';

const TITLE = '3DRPG 〜魔窟の主〜';
const CONTROLS = [
  'WASD：移動　マウス：カメラ（クリックで視点ロック／右ドラッグでも可）',
  '左クリック：攻撃（連打で3段コンボ）　Space：回避（無敵時間あり）',
  'Q：回転斬り　E：衝撃波（MP 消費・クールダウンあり）',
  'F：話す・調べる　Tab：メニュー（装備・持ち物・クエスト）',
  '1：回復薬　2：魔力水　ホイール：カメラ距離　Esc：ポーズ',
].join('\n');

export function createGame() {
  const { renderer, scene, camera, start } = createApp({ canvas: document.getElementById('game') });
  const input = createInput(renderer.domElement);
  const audio = createAudio();
  const store = createSave('rpg');
  const saveData = store.load({ records: { clears: 0, bestTime: 0 }, progress: null });

  const game = {
    scene, camera, renderer, input, audio,
    sound: createSound(audio),
    state: createState(newProgress()),
    world: null,
    players: [],
    localIndex: 0, // 自分のプレイヤー番号（オンライン化で変わる）
    boss: null,
    playing: false,
    down: null, // 全滅演出中 { t }
    trans: null, // エリア遷移中 { t, phase, to, x, z, yaw }
    toast,
    me() { return game.players[game.localIndex]; },
  };
  game.fx = createEffects(scene, camera);
  game.cam = createCameraRig(camera);
  game.lights = createLights(scene);
  game.enemies = createEnemies(game);
  game.projectiles = createProjectiles(game);
  game.pickups = createPickups(game);
  game.hudView = createHudView(game);
  game.modal = createModalHost(game);
  game.dialog = createDialog(game, game.modal);
  game.ui = { dialog: game.dialog };
  installActions(game);
  game.players.push(createPlayer(game, 0));

  // ---- セーブ ----
  game.autosave = () => {
    if (!game.playing || game.down) return;
    const pr = game.state.progress;
    const me = game.me();
    pr.x = Math.round(me.pos.x * 10) / 10;
    pr.z = Math.round(me.pos.z * 10) / 10;
    // ボス戦中に保存した場合は、ボス部屋の手前から再開
    if (game.boss && game.boss.active) pr.z = Math.max(pr.z, -10);
    saveData.progress = pr;
    store.save(saveData);
  };

  game.gateOpen = (g) => !g.requires || game.state.progress.quests[g.requires].status !== 'none';

  // ---- ポインタロックとモーダル ----
  let expectUnlock = false;
  const canLock = () => game.playing && !game.modal.open && !isOverlayOpen() && !game.down;
  renderer.domElement.addEventListener('click', () => {
    if (canLock()) input.lockPointer();
  });
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    if (locked) return;
    if (expectUnlock) {
      expectUnlock = false;
      return;
    }
    // Esc でブラウザがロックを外した → ポーズ
    if (game.playing && !game.modal.open && !isOverlayOpen() && !game.down && !game.noAutoPause) pause();
  });
  game.onModalOpen = () => {
    if (document.pointerLockElement) {
      expectUnlock = true;
      input.unlockPointer();
    }
    game.hudView.setPrompt('');
  };
  game.onModalClose = () => {
    input.endFrame(); // 閉じたキーで再度開かないように
    setTimeout(() => { if (canLock()) input.lockPointer(); }, 0);
  };

  let pausedAt = 0;
  function pause() {
    if (isPaused()) return;
    pausedAt = performance.now();
    if (document.pointerLockElement) {
      expectUnlock = true;
      input.unlockPointer();
    }
    showPause({
      onResume: () => input.lockPointer(),
      extra: `${game.world?.def.name || ''}　プレイ時間 ${fmtTime(game.state.progress.stats.time)}`,
    });
  }

  // ---- 暗転・遷移 ----
  let flashT = 0;
  game.flashFade = () => { flashT = 1.2; };
  game.startTransition = (to, x, z, yaw) => {
    if (game.trans) return;
    game.trans = { t: 0, phase: 'out', to, x, z, yaw };
    game.sound.se('gate');
  };

  // ---- 全滅・クリア ----
  game.onPlayerDown = (pl) => {
    if (game.down) return;
    pl.alive = false;
    game.down = { t: 0 };
    game.sound.bgm('');
    game.sound.se('fall');
  };

  function finishDown() {
    const pr = game.state.progress;
    const loss = Math.floor(pr.gold * DEATH_GOLD_LOSS);
    pr.gold -= loss;
    pr.stats.deaths++;
    expectUnlock = true;
    input.unlockPointer();
    game.hudView.show(false);
    showResult({
      title: '全滅してしまった……',
      lines: [`${loss}G を落としてしまった（所持金 ${pr.gold}G）`, '村の宿屋の前で目を覚ます。装備・レベル・クエストはそのまま。'],
      retryLabel: '村で目覚める',
      onRetry: () => {
        game.down = null;
        game.state.healFull();
        const r = AREAS.village.respawn;
        loadArea(game, 'village', r.x, r.z, Math.PI);
        game.hudView.show(true);
        game.autosave();
        input.lockPointer();
      },
    });
  }

  game.onBossDefeated = () => {
    const pr = game.state.progress;
    pr.quests.boss.status = 'cleared';
    pr.gold += BOSS.gold;
    game.state.gainExp(BOSS.exp);
    game.playing = false;
    expectUnlock = true;
    input.unlockPointer();
    game.sound.bgm('clear');
    const time = pr.stats.time;
    const rec = saveData.records;
    rec.clears++;
    const best = !rec.bestTime || time < rec.bestTime;
    if (best) rec.bestTime = time;
    saveData.progress = null; // クリアしたら「つづきから」は消える
    store.save(saveData);
    game.hudView.show(false);
    showResult({
      title: 'クリア！ 魔窟の主を討ち取った！',
      lines: [
        `プレイ時間 ${fmtTime(time)}${best ? '（ベスト更新！）' : `（ベスト ${fmtTime(rec.bestTime)}）`}`,
        `レベル ${pr.level}　撃破数 ${pr.stats.kills}　全滅 ${pr.stats.deaths} 回`,
        `所持金 ${pr.gold}G　クリア回数 ${rec.clears}`,
      ],
      retryLabel: 'はじめから遊ぶ',
      onRetry: () => begin(newProgress()),
    });
  };

  // ---- 開始 ----
  function begin(progress) {
    game.state = createState(progress);
    game.state.normalize();
    game.down = null;
    game.trans = null;
    game.playing = true;
    game.players.forEach((p) => p.applyEquipment());
    const pr = game.state.progress;
    loadArea(game, pr.area, pr.x, pr.z, Math.PI);
    game.hudView.show(true);
    game.autosave();
    input.lockPointer();
    if (pr.quests.hunt.status === 'none') setTimeout(() => toast('まずは村長（黄色い帽子）に話しかけてみよう', 3500), 800);
  }

  function title() {
    const rec = saveData.records;
    const has = !!saveData.progress;
    const recLine = rec.clears ? `　クリア ${rec.clears} 回／ベスト ${fmtTime(rec.bestTime)}` : '';
    showTitle({
      title: TITLE,
      desc: `村で準備し、草原とダンジョンを抜けて魔窟の主を倒すアクションRPG（約30分）。${recLine}`,
      controls: CONTROLS,
      onStart: () => begin(newProgress()),
      startLabel: has ? 'はじめから' : 'はじめる',
      onContinue: has ? () => begin(saveData.progress) : undefined,
    });
  }

  // ---- 入力 → intent（データ） ----
  function readIntent() {
    const k = (c) => input.isDown(c);
    const right = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    const fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    const v = game.cam.toWorld(right, fwd);
    const it = emptyIntent();
    it.moveX = v.x;
    it.moveZ = v.z;
    it.aimYaw = game.cam.forwardYaw();
    it.attack = input.wasPressed('Mouse0');
    it.dodge = input.wasPressed('Space');
    it.spin = input.wasPressed('KeyQ');
    it.wave = input.wasPressed('KeyE');
    it.interact = input.wasPressed('KeyF');
    it.menu = input.wasPressed('Tab');
    it.potion = input.wasPressed('Digit1');
    it.ether = input.wasPressed('Digit2');
    return it;
  }

  // ---- 1フレームのゲーム更新 ----
  let saveTimer = 0;
  function step(dt, time) {
    const intent = readIntent();
    const pr = game.state.progress;
    if (intent.menu) { game.openMenu(); return; }
    if (intent.potion) game.useItem('potion');
    if (intent.ether) game.useItem('ether');

    if (game.fx.consumeStop(dt)) return; // ヒットストップ
    pr.stats.time += dt;
    game.players.forEach((p, i) => p.update(dt, i === game.localIndex ? intent : emptyIntent()));
    game.enemies.update(dt, time);
    if (game.boss) game.boss.update(dt, time);
    game.projectiles.update(dt);
    game.pickups.update(dt, time);
    if (!game.down) updateAreaLogic(game, intent);
    saveTimer += dt;
    if (saveTimer > 45 && !game.boss?.active) {
      saveTimer = 0;
      game.autosave();
    }
  }

  start((dt, time) => {
    const ui = game.hudView;
    if (game.playing && !game.modal.open && !game.down && !game.trans && input.wasPressed('Escape')) {
      if (isPaused()) {
        // ロック解除で開いた直後の同じ Esc では閉じない
        if (performance.now() - pausedAt > 300) {
          hidePause();
          input.lockPointer();
        }
      } else pause();
    }
    const active = game.playing && !isPaused() && !game.modal.open && !isOverlayOpen();

    // カメラ操作（ロック中、または右ドラッグ）
    if (active && (input.mouse.locked || input.isDown('Mouse2'))) {
      game.cam.input({ dx: input.mouse.dx, dy: input.mouse.dy, wheel: input.mouse.wheel });
    } else if (active) game.cam.input({ wheel: input.mouse.wheel });

    if (active && game.trans) {
      const tr = game.trans;
      tr.t += dt;
      if (tr.phase === 'out') {
        ui.fade(Math.min(1, tr.t / 0.35));
        if (tr.t >= 0.4) {
          loadArea(game, tr.to, tr.x, tr.z, tr.yaw);
          tr.phase = 'in';
          tr.t = 0;
          game.autosave();
        }
      } else {
        ui.fade(Math.max(0, 1 - tr.t / 0.4));
        if (tr.t >= 0.4) game.trans = null;
      }
    } else if (active && game.down) {
      game.down.t += dt;
      const me = game.me();
      me.model.root.rotation.x = -Math.min(1.5, game.down.t * 3);
      game.enemies.update(dt * 0.3, time);
      if (game.down.t > 1.8 && !game.down.shown) {
        game.down.shown = true;
        finishDown();
      }
    } else if (active) {
      step(dt, time);
    }
    if (flashT > 0) {
      flashT -= dt;
      ui.fade(Math.max(0, Math.sin(Math.min(1, flashT / 1.2) * Math.PI)));
    }

    if (game.playing) {
      if (active) game.fx.update(dt);
      const me = game.me();
      game.lights.follow(me.pos);
      game.cam.update(dt, me.pos, game.world, game.fx.shakeOffset);
      ui.update(dt);
    }
    input.endFrame();
  });

  // タイトル背景用に村を表示しておく
  loadArea(game, 'village', 0, 6, Math.PI);
  game.cam.yaw = 0.6;
  game.cam.update(0.016, game.me().pos, game.world, game.fx.shakeOffset);
  title();
  // ?debug：自動テスト用（ロック解除でポーズしない・window.rpg で操作できる）
  if (new URLSearchParams(location.search).has('debug')) {
    window.rpg = game;
    game.noAutoPause = true;
  }
  return game;
}
