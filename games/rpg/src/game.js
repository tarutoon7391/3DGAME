// ゲーム全体：初期化・メインループ・タイトル／ポーズ／全滅／クリアの流れ
// 状態の正本は game.state.progress（JSON 化可能）。入力は readIntent() でデータにしてから更新処理へ渡す
import { createApp } from '/shared/engine.js';
import { createInput } from '/shared/input.js';
import { createAudio } from '/shared/audio.js';
import { showTitle, showPause, hidePause, isPaused, showResult, toast, isOverlayOpen, closeAll } from '/shared/ui.js';
import { createSave } from '/shared/save.js';
import { createState, newProgress, migrateProgress } from './state.js';
import { createPlayer, emptyIntent } from './player.js';
import { createEnemies } from './enemies.js';
import { createProjectiles } from './projectiles.js';
import { createEffects } from './effects.js';
import { createSound } from './sound.js';
import { createCameraRig } from './camera.js';
import { createViewModel } from './viewmodel.js';
import { VIEW } from './data/view.js';
import { createHudView } from './ui/hudview.js';
import { createModalHost, createDialog } from './ui/dialog.js';
import { createLights, loadArea, updateAreaLogic, checkSeals, bossDown } from './area.js';
import { AREAS, AREA_ORDER, COURSES, courseOf } from './data/areas.js';
import { fmtTime } from './util.js';

const TITLE = '3DRPG 〜魔窟の主〜';
const CONTROLS = [
  'WASD：移動　Shift：ダッシュ　マウス：視点（画面クリックで視点ロック／右ドラッグでも可）',
  'V：一人称／三人称の切り替え（はじめは一人称）',
  '左クリック：攻撃（連打で3段コンボ）　Space：回避（無敵時間あり）',
  'Q：回転斬り　E：衝撃波（クールダウンあり）　F：看板を調べる',
  'ダッシュと回避はスタミナを使う。0 になるとバテて、満タンに戻るまで使えない',
  'ホイール：カメラ距離（三人称）　Esc：ポーズ',
].join('\n');

export function createGame() {
  const { renderer, scene, camera, start } = createApp({ canvas: document.getElementById('game') });
  const input = createInput(renderer.domElement);
  const audio = createAudio();
  const store = createSave('rpg');
  const saveData = store.load({ records: { clears: 0, bestTime: 0 }, progress: null });
  if (!saveData.records) saveData.records = { clears: 0, bestTime: 0 }; // ステージ1 の記録
  if (!saveData.records2) saveData.records2 = { clears: 0, bestTime: 0 }; // ステージ2 の記録
  saveData.progress = migrateProgress(saveData.progress); // 旧形式（レベル制）は到達エリアだけ引き継ぐ
  // 設定（視点）は進行とは別に保存する（クリアしても消えない）
  if (!saveData.settings || !['fps', 'tps'].includes(saveData.settings.view)) saveData.settings = { view: VIEW.defaultMode };

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
  scene.add(camera); // ビューモデルをカメラの子として描くため
  game.vm = createViewModel(renderer, camera);
  game.lights = createLights(scene);
  game.enemies = createEnemies(game);
  game.projectiles = createProjectiles(game);
  game.hudView = createHudView(game);
  game.modal = createModalHost(game);
  game.dialog = createDialog(game, game.modal);
  game.ui = { dialog: game.dialog };
  game.players.push(createPlayer(game, 0));

  // 同じ文を短時間に何度も出さないトースト
  const toastTimes = new Map();
  game.toastOnce = (msg, ms = 2000) => {
    const now = performance.now();
    if (now - (toastTimes.get(msg) || 0) < ms + 400) return;
    toastTimes.set(msg, now);
    toast(msg, ms);
  };
  game.onEnemyKilled = () => checkSeals(game);
  game.onBossDown = (b) => bossDown(game, b);
  game.onPlayerHurt = (p, dirX, dirZ) => {
    if (p === game.me()) game.hudView.hurt(dirX, dirZ);
  };

  // ---- 視点（一人称／三人称）。V で切り替え、選んだ方を保存 ----
  game.setView = (mode, announce = false) => {
    const fps = mode === 'fps';
    game.cam.setMode(mode);
    game.players.forEach((p) => { p.hideBody = fps && p === game.me(); });
    game.hudView.setFps(fps);
    game.fx.setTeleOpacity(fps ? VIEW.teleBoost : null);
    if (saveData.settings.view !== mode) {
      saveData.settings.view = mode;
      store.save(saveData);
    }
    if (announce) game.toastOnce(fps ? '一人称視点（V で三人称）' : '三人称視点（V で一人称）', 1600);
  };
  game.setView(saveData.settings.view);

  // ---- セーブ（到達したエリアと記録だけ。つづきからはそのエリアの入口から） ----
  game.autosave = () => {
    if (!game.playing) return;
    saveData.progress = game.state.progress;
    store.save(saveData);
  };
  // ハブへ戻る・タブを閉じる・裏に回ったときもプレイ時間などを保存
  addEventListener('pagehide', () => game.autosave());
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.autosave(); });

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

  // ---- 暗転・遷移（次のステージへ） ----
  game.startTransition = (to) => {
    if (game.trans) return;
    game.trans = { t: 0, phase: 'out', to };
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
    pr.stats.deaths++;
    game.autosave();
    expectUnlock = true;
    input.unlockPointer();
    game.hudView.show(false);
    showResult({
      title: 'やられてしまった……',
      lines: [pr.bossStep ? `${AREAS[pr.area].name}：倒したボスの次の部屋の前からやり直す（HP は全快）。` : `${AREAS[pr.area].name} の入口からやり直す（HP は全快、魔物は元に戻る）。`, `プレイ時間 ${fmtTime(pr.stats.time)}　やられた回数 ${pr.stats.deaths}`],
      retryLabel: pr.bossStep ? '部屋の前からやり直す' : '入口からやり直す',
      onRetry: () => {
        game.down = null;
        loadArea(game, pr.area);
        game.hudView.show(true);
        input.lockPointer();
      },
    });
  }

  game.onBossDefeated = () => {
    const pr = game.state.progress;
    const course = courseOf(pr.area);
    game.playing = false;
    expectUnlock = true;
    input.unlockPointer();
    game.sound.bgm('clear');
    const time = pr.stats.time;
    const rec = saveData[course.recKey];
    rec.clears++;
    const best = !rec.bestTime || time < rec.bestTime;
    if (best) rec.bestTime = time;
    saveData.progress = null; // クリアしたら「つづきから」は消える
    store.save(saveData);
    game.hudView.show(false);
    showResult({
      title: `${course.label} クリア！ ${course.clearMsg}`,
      lines: [
        `プレイ時間 ${fmtTime(time)}${best ? '（ベスト更新！）' : `（ベスト ${fmtTime(rec.bestTime)}）`}`,
        `撃破数 ${pr.stats.kills}　やられた回数 ${pr.stats.deaths}`,
        `クリア回数 ${rec.clears}`,
      ],
      retryLabel: `${course.label}をもう一度`,
      onRetry: () => begin(newProgress(course.start)),
      extraButtons: [{ label: 'タイトルへ', onClick: () => title() }],
    });
  };

  // ---- 開始 ----
  function begin(progress) {
    game.state = createState(progress);
    game.down = null;
    game.trans = null;
    game.playing = true;
    const pr = game.state.progress;
    loadArea(game, pr.area);
    game.hudView.show(true);
    game.autosave();
    input.lockPointer();
    if (pr.area === AREA_ORDER[0]) setTimeout(() => toast('迷路を抜けて北の出口へ。赤い結界は番人を全部倒すと消える', 4000), 800);
    if (pr.area === COURSES[1].start && !pr.bossStep) setTimeout(() => toast('中ボス2体を倒して、最奥の冥王を討て。弾幕は横に走るか回避の無敵でくぐれ', 4000), 800);
  }

  /** タイトル：ステージ1／ステージ2 を選ぶ（shared の showTitle はボタン1つなので、2つ目はここで足す） */
  function title() {
    game.playing = false;
    game.hudView.show(false);
    const has = !!saveData.progress;
    const recText = (c) => {
      const r = saveData[c.recKey];
      return r.clears ? `クリア ${r.clears} 回／ベスト ${fmtTime(r.bestTime)}` : '未クリア';
    };
    const desc = [
      'ステージを選んでください。育成も収集もないアクション。',
      ...COURSES.map((c) => `${c.label}「${c.name}」：${c.desc}（${recText(c)}）`),
    ].join('\n');
    const cont = has ? courseOf(saveData.progress.area) : null;
    showTitle({
      title: TITLE,
      desc,
      controls: CONTROLS,
      onStart: () => begin(newProgress(COURSES[0].start)),
      startLabel: `${COURSES[0].label}　${COURSES[0].name}`,
      onContinue: has ? () => begin(saveData.progress) : undefined,
      continueLabel: has ? `つづきから（${cont.label}：${AREAS[saveData.progress.area].name.replace(/^\S+\s+/, '')}）` : undefined,
    });
    // 説明文はステージごとに改行して見せる
    const descEl = document.querySelector('.g3-overlay .g3-panel > p');
    if (descEl) descEl.style.whiteSpace = 'pre-line';
    // 2つ目のステージのボタン（見た目は shared のボタンに合わせる）
    const row = document.querySelector('.g3-overlay .g3-btns');
    if (row) {
      const c = COURSES[1];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'g3-btn' + (has ? ' sub' : '');
      b.textContent = `${c.label}　${c.name}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAll();
        begin(newProgress(c.start));
      });
      row.appendChild(b);
    }
  }

  // ---- 入力 → intent（データ） ----
  const myIntent = emptyIntent();
  const idleIntent = emptyIntent(); // 操作していないプレイヤー用（毎フレーム作らない）
  function readIntent() {
    const k = (c) => input.isDown(c);
    const right = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    const fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    const v = game.cam.toWorld(right, fwd);
    const it = myIntent;
    it.moveX = v.x;
    it.moveZ = v.z;
    it.aimYaw = game.cam.forwardYaw();
    it.lockYaw = game.cam.fps; // 一人称：体の向き＝視点の水平方向
    it.attack = input.wasPressed('Mouse0');
    it.dodge = input.wasPressed('Space');
    it.dash = k('ShiftLeft') || k('ShiftRight');
    it.spin = input.wasPressed('KeyQ');
    it.wave = input.wasPressed('KeyE');
    it.interact = input.wasPressed('KeyF');
    return it;
  }

  // ---- 1フレームのゲーム更新 ----
  let saveTimer = 0;
  function step(dt, time) {
    const intent = readIntent();
    const pr = game.state.progress;

    if (game.fx.consumeStop(dt)) return; // ヒットストップ
    pr.stats.time += dt;
    game.players.forEach((p, i) => p.update(dt, i === game.localIndex ? intent : idleIntent));
    game.world.update(dt, time);
    game.enemies.update(dt, time);
    if (game.boss) game.boss.update(dt, time);
    game.projectiles.update(dt);
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
    if (active && !game.down && input.wasPressed('KeyV')) game.setView(game.cam.fps ? 'tps' : 'fps', true);

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
          loadArea(game, tr.to); // 次のステージ：HP・スタミナ全回復
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

    if (game.playing) {
      if (active) game.fx.update(dt);
      const me = game.me();
      game.lights.follow(me.pos);
      game.cam.update(dt, me, game.world, game.fx.shakeOffset);
      game.vm.setVisible(game.cam.fps && me.alive);
      game.vm.update(dt, me, game.cam);
      ui.update(dt);
    }
    input.endFrame();
  });

  // タイトル背景用に村を表示しておく
  loadArea(game, AREA_ORDER[0]);
  game.vm.setVisible(false);
  game.cam.update(0.016, game.me(), game.world, game.fx.shakeOffset);
  title();
  // ?debug：自動テスト用（ロック解除でポーズしない・window.rpg で操作できる）
  if (new URLSearchParams(location.search).has('debug')) {
    window.rpg = game;
    game.noAutoPause = true;
  }
  return game;
}
