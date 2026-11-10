// ゲーム本体：画面遷移（タイトル→難易度→プレイ→リザルト）・ステージ進行・メインループ
// 状態は g.state（JSON 化できる素の値だけ）にまとめ、3D オブジェクト等の参照は g 直下に置く
import * as THREE from 'three';
import { createApp } from '/shared/engine.js';
import { createInput } from '/shared/input.js';
import { createAudio } from '/shared/audio.js';
import { showTitle, hud, showPause, hidePause, isPaused, showResult, toast, isOverlayOpen, initUI } from '/shared/ui.js';
import { createSave } from '/shared/save.js';
import { DIFFICULTIES, DIFF_ORDER, ENEMY_BULLET_SPEED } from './data/difficulty.js';
import { STAGES } from './data/stages.js';
import { BOSSES } from './data/bosses.js';
import { createEnv } from './env.js';
import { createFx } from './fx.js';
import { createBullets } from './bullets.js';
import { createPlayer, readControls, createControls } from './player.js';
import { createEnemies } from './enemies.js';
import { createItems } from './items.js';
import { createBoss } from './boss.js';
import { createSpawner } from './spawner.js';
import { createHud } from './hud.js';
import { createSfx } from './sfx.js';
import { runCombat, useBomb, pickItem, comboMul, COMBO_TIME } from './combat.js';
import { buildHud } from './hudText.js';
import { rand, fmt } from './util.js';

const BASE_SPEED = 60; // 背景が流れる速さ（＝前進速度の見た目）
const AIM_Z = -90; // 照準面の z

export function boot() {
  const { renderer, scene, camera, start } = createApp({ canvas: document.getElementById('game') });
  const input = createInput(renderer.domElement);
  const audio = createAudio();
  const store = createSave('space');
  const save = store.load({ high: { easy: 0, normal: 0, hard: 0 }, lastDiff: 'normal' });
  initUI();
  const params = new URLSearchParams(location.search);
  const debug = params.has('debug');

  const g = {
    // ---- 状態（JSON 化できる値のみ） ----
    state: {
      mode: 'title', // title | play | result
      phase: 'stage', // stage | warning | boss | clear | dead
      phaseT: 0,
      stageIdx: 0,
      diffKey: save.lastDiff in DIFFICULTIES ? save.lastDiff : 'normal',
      score: 0,
      combo: 0,
      comboT: 0,
      maxCombo: 0,
      kills: 0,
      noMiss: true,
      cleared: false,
    },
    localId: 0, // この画面で操作するプレイヤーの id
    time: 0,
    scene,
    camera,
    sfx: createSfx(audio),
    ui: createHud(),
    env: createEnv(scene),
    fx: createFx(scene),
    bullets: createBullets(scene),
    enemies: createEnemies(scene),
    items: createItems(scene),
    players: [],
    boss: null,
    target: new THREE.Vector3(), // 敵が狙う位置（生存中のプレイヤー）
    get diff() { return DIFFICULTIES[this.state.diffKey]; },
  };
  g.players.push(createPlayer(scene, 0));
  const spawner = createSpawner(g);
  const controls = createControls();
  const raycaster = new THREE.Raycaster();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -AIM_Z);
  const ndc = new THREE.Vector2();
  const aimPoint = new THREE.Vector3();
  const camPos = new THREE.Vector3(0, 3.4, 18);
  const camBase = new THREE.Vector3();
  const look = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let hudT = 0;

  const localPlayer = () => g.players.find((p) => p.id === g.localId) || g.players[0];

  // ---- 各モジュールから呼ばれる関数 ----
  g.fireEnemy = (x, y, z, dx, dy, dz, sp, color) => {
    g.bullets.fireEnemy(x, y, z, dx, dy, dz, sp * ENEMY_BULLET_SPEED * g.diff.bulletSpeed, color);
  };
  /** from から自機へ n-way（spread ラジアン間隔）で撃つ */
  g.fireAimed = (from, sp, spread = 0, n = 1, color = 0xff4fa0, jitter = 0) => {
    tmp.copy(g.target).sub(from);
    tmp.x += rand(-1, 1) * jitter * tmp.length();
    tmp.y += rand(-1, 1) * jitter * tmp.length();
    tmp.normalize();
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * spread;
      const cs = Math.cos(a), sn = Math.sin(a);
      g.fireEnemy(from.x, from.y, from.z, tmp.x * cs + tmp.z * sn, tmp.y, -tmp.x * sn + tmp.z * cs, sp, color);
    }
  };
  g.spawnEnemy = (type, x, y, z, group) => g.enemies.spawn(type, x, y, z, group);
  g.onBossRage = () => {
    g.ui.message('', `${g.boss.name} が激昂した！`, 1.8);
    g.sfx.lock();
  };
  g.onBossDefeated = () => {
    g.bullets.clearEnemy((pos) => g.fx.spark(pos, 0xffffff, 1));
    g.ui.message('BOSS DOWN', '', 2);
  };
  g.onPlayerDead = () => {
    if (g.players.every((p) => p.dead)) {
      g.state.phase = 'dead';
      g.state.phaseT = 0;
      g.sfx.stopBgm();
    }
  };
  const enemyCtx = {
    get diff() { return g.diff; },
    target: g.target,
    fireAimed: g.fireAimed,
    sfx: g.sfx,
  };

  // ---- 画面遷移 ----
  function toTitle() {
    g.state.mode = 'title';
    resetWorld();
    g.env.set(0);
    g.fx.setStars(true);
    hud('');
    g.ui.setPlaying(false);
    g.sfx.titleBgm();
    const h = save.high;
    showTitle({
      title: '宇宙シューティング STARLANCE',
      desc: `3つのステージを突破し、各ステージのボスを倒せ。ハイスコア：やさしい ${fmt(h.easy)}／ふつう ${fmt(h.normal)}／むずかしい ${fmt(h.hard)}`,
      controls:
        'WASD／矢印：上下左右に移動\nマウス：照準　左クリック（長押し）：連射\n右クリック／Shift：ロール（回避中は無敵）\nSpace：ボム（敵弾消去＋全体攻撃）\nEsc：ポーズ　M：消音\n\n黄＝連射強化　緑＝拡散弾　青＝シールド\n編隊を全滅させるとアイテムが出る。被弾で武器レベルが下がる',
      onStart: chooseDifficulty,
      startLabel: 'はじめる（難易度選択へ）',
    });
  }

  function chooseDifficulty() {
    g.ui.chooseDifficulty({
      list: DIFF_ORDER.map((k) => DIFFICULTIES[k]),
      current: g.state.diffKey,
      highs: save.high,
      onPick: (k) => beginGame(k),
      onBack: toTitle,
    });
  }

  function resetWorld() {
    g.enemies.clear();
    g.bullets.clearAll();
    g.items.clear();
    g.fx.clear();
    if (g.boss) g.boss.dispose();
    g.boss = null;
    g.ui.reset();
    g.players.forEach((p) => p.reset());
  }

  function beginGame(diffKey) {
    const s = g.state;
    s.diffKey = diffKey;
    save.lastDiff = diffKey;
    store.save(save);
    resetWorld();
    Object.assign(s, { mode: 'play', score: 0, combo: 0, comboT: 0, maxCombo: 0, kills: 0, cleared: false });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const startStage = debug ? Math.min(2, Math.max(0, (parseInt(params.get('stage'), 10) || 1) - 1)) : 0;
    beginStage(startStage);
  }

  function beginStage(i) {
    const s = g.state;
    const st = STAGES[i];
    s.stageIdx = i;
    s.phase = 'stage';
    s.phaseT = 0;
    s.noMiss = true;
    g.env.set(st.env);
    g.fx.setStars(st.env !== 2);
    spawner.load(st);
    g.ui.message(`STAGE ${i + 1}`, st.name, 2.6);
    g.sfx.stageStart();
    g.sfx.stageBgm(i);
  }

  function stageClear() {
    const s = g.state;
    const p = localPlayer();
    const bonus = Math.round((10000 * (s.stageIdx + 1) + p.lives * 2000 + (s.noMiss ? 10000 : 0)) * g.diff.scoreMul);
    s.score += bonus;
    s.phase = 'clear';
    s.phaseT = 0;
    g.players.forEach((q) => { q.bombs = Math.min(5, q.bombs + 1); });
    g.ui.setBoss(null);
    g.ui.message('STAGE CLEAR', `クリアボーナス +${fmt(bonus)}${s.noMiss ? '（ノーミス込み）' : ''}`, 3.6);
    g.sfx.stopBgm();
    g.sfx.clear();
  }

  function finish(cleared) {
    const s = g.state;
    s.mode = 'result';
    s.cleared = cleared;
    g.ui.setPlaying(false);
    g.ui.setBoss(null);
    g.sfx.stopBgm();
    if (!cleared) g.sfx.gameOver();
    else g.sfx.clear();
    const prev = save.high[s.diffKey] || 0;
    const isNew = s.score > prev;
    if (isNew) {
      save.high[s.diffKey] = s.score;
      store.save(save);
    }
    showResult({
      title: cleared ? '全ステージクリア！' : 'ゲームオーバー',
      lines: [
        `難易度：${g.diff.label}　到達：STAGE ${s.stageIdx + 1} ${STAGES[s.stageIdx].name}`,
        `スコア：${fmt(s.score)}${isNew ? '　★ハイスコア更新！' : `（ハイスコア ${fmt(prev)}）`}`,
        `撃破数：${s.kills}　最大コンボ：${s.maxCombo}`,
      ],
      onRetry: () => beginGame(s.diffKey),
      retryLabel: '同じ難易度でリトライ',
      extraButtons: [{ label: '難易度を変える', onClick: chooseDifficulty }, { label: 'タイトルへ', onClick: toTitle }],
    });
  }

  function pause() {
    if (isPaused()) return;
    showPause({ onResume() {}, onRetry: () => beginGame(g.state.diffKey) });
  }
  window.addEventListener('blur', () => {
    if (g.state.mode === 'play' && !isOverlayOpen()) pause();
  });

  // ---- プレイ中の更新 ----
  function updatePlay(dt) {
    const s = g.state;
    s.phaseT += dt;
    const p = localPlayer();
    readControls(input, controls);
    controls.aimX = aimDir.x;
    controls.aimY = aimDir.y;
    controls.aimZ = aimDir.z;

    g.players.forEach((q) => q.update(dt, controls, g));
    if (controls.bomb) useBomb(g, p);
    const alive = g.players.find((q) => !q.dead);
    if (alive) g.target.copy(alive.pos);

    // デバッグ用：N でボス警告へスキップ（?debug 時のみ）
    if (debug && s.phase === 'stage' && input.wasPressed('KeyN')) spawner.skipTo(STAGES[s.stageIdx].bossAt);
    if (s.phase === 'stage') {
      spawner.update(dt);
      if (spawner.t >= STAGES[s.stageIdx].bossAt) {
        s.phase = 'warning';
        s.phaseT = 0;
        g.ui.warning(true);
        g.sfx.stopBgm();
        g.sfx.warning();
      }
    } else if (s.phase === 'warning') {
      if (s.phaseT > 3.2) {
        g.ui.warning(false);
        g.boss = createBoss(scene, BOSSES[STAGES[s.stageIdx].boss], g);
        s.phase = 'boss';
        s.phaseT = 0;
        g.sfx.bossBgm();
      }
    } else if (s.phase === 'boss') {
      if (g.boss.finished) {
        g.boss.dispose();
        g.boss = null;
        stageClear();
      }
    } else if (s.phase === 'clear') {
      if (s.phaseT > 4.2) {
        if (s.stageIdx + 1 < STAGES.length) beginStage(s.stageIdx + 1);
        else finish(true);
      }
    } else if (s.phase === 'dead') {
      if (s.phaseT > 2.2) {
        finish(false);
        return;
      }
    }

    if (g.boss) {
      g.boss.update(dt);
      g.ui.setBoss(g.boss.name, g.boss.ratio());
    }
    g.enemies.update(dt, enemyCtx);
    g.bullets.update(dt);
    g.items.update(dt, p.pos, (kind) => pickItem(g, p, kind));
    if (debug && params.has('stress')) stress();
    runCombat(g);

    // コンボの時間切れ
    if (s.comboT > 0) {
      s.comboT -= dt;
      if (s.comboT <= 0) s.combo = 0;
    }
    g.ui.setCombo(s.combo, comboMul(s.combo), Math.max(0, s.comboT / COMBO_TIME));

    hudT -= dt;
    if (hudT <= 0) {
      hudT = 0.1;
      hud(buildHud(g, p, save.high[s.diffKey] || 0, debug ? fps : 0));
    }
  }

  // 負荷確認用（?debug&stress）：敵弾を常に 250 発以上に保つ
  function stress() {
    while (g.bullets.enemy.count < 250) {
      g.bullets.fireEnemy(rand(-30, 30), rand(-18, 18), -150, rand(-0.1, 0.1), rand(-0.1, 0.1), 1, 25, 0xff4fa0);
      g.bullets.enemy.sync();
    }
  }

  // ---- 照準とカメラ ----
  const aimDir = new THREE.Vector3(0, 0, -1);
  function updateAim() {
    const m = input.mouse;
    const w = window.innerWidth, h = window.innerHeight;
    const mx = m.x || w / 2, my = m.y || h / 2;
    g.ui.setCross(mx, my);
    ndc.set((mx / w) * 2 - 1, -(my / h) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(aimPlane, aimPoint)) aimPoint.set(0, 0, AIM_Z);
    const p = localPlayer();
    aimDir.copy(aimPoint).sub(tmp.set(p.pos.x, p.pos.y, p.pos.z - 2)).normalize();
  }

  function updateCamera(dt) {
    const p = localPlayer();
    camBase.set(p.pos.x * 0.6, p.pos.y * 0.6 + 3.4, 18);
    camPos.lerp(camBase, Math.min(1, dt * 5));
    camera.position.copy(camPos).add(g.fx.shakeOff);
    look.set(p.pos.x * 0.7, p.pos.y * 0.7, -40);
    camera.lookAt(look);
  }

  // ---- メインループ ----
  let fps = 60;
  const loop = (dt) => {
    const s = g.state;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    if (input.wasPressed('KeyM')) toast(audio.setMuted() ? '消音しました（M で解除）' : '音を出します');
    if (s.mode === 'play' && input.wasPressed('Escape')) {
      if (isPaused()) hidePause();
      else pause();
    }
    const active = s.mode === 'play' && !isPaused();
    g.ui.setPlaying(active);
    if (active) {
      g.time += dt;
      updateAim();
      updatePlay(dt);
    }
    if (!isPaused()) {
      const p = localPlayer();
      let speed = BASE_SPEED;
      if (s.mode !== 'play') speed = 35;
      else if (s.phase === 'clear') speed = BASE_SPEED * (1 + Math.min(3, s.phaseT));
      else if (p.isRolling()) speed = BASE_SPEED * 1.6;
      if (s.mode === 'title') {
        // タイトル中は自機がゆらゆら飛ぶだけ
        p.pos.set(Math.sin(g.time * 0.7) * 3, Math.sin(g.time * 1.1) * 1.5 - 1, 0);
        g.time += dt;
        g.fx.trail(p.pos.x, p.pos.y - 0.1, 2.6, false);
      }
      g.env.update(dt, speed);
      g.fx.update(dt, speed);
      updateCamera(dt);
      g.ui.update(dt);
    }
    input.endFrame();
  };
  start(loop);

  // デバッグ用：?debug のときだけ外から状態を見たり時間を進めたりできる
  if (debug) {
    window.__space = g;
    g.step = loop;
  }
  toTitle();
}
