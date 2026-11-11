// ゲーム全体：初期化・メインループ・タイトル／ポーズ／全滅／クリアの流れ
// 状態の正本は game.state.progress（JSON 化可能）。入力は readIntent() でデータにしてから更新処理へ渡す
// ステージ2 はレイド（1〜8人）：準備画面（ui/lobby.js）で職業を選び、ひとりで、またはルームで協力して挑む。通信は raid.js
import { createApp } from '/shared/engine.js';
import { createInput } from '/shared/input.js';
import { createAudio } from '/shared/audio.js';
import { showTitle, showPause, hidePause, isPaused, showResult, toast, isOverlayOpen, closeAll } from '/shared/ui.js';
import { createSave } from '/shared/save.js';
import { createState, newProgress, migrateProgress } from './state.js';
import { createPlayer, emptyIntent } from './player.js';
import { createEnemies } from './enemies.js';
import { createProjectiles } from './projectiles.js';
import { createAllies } from './allies.js';
import { createHazards } from './hazards.js';
import { createEffects } from './effects.js';
import { createSound } from './sound.js';
import { createCameraRig } from './camera.js';
import { createViewModel } from './viewmodel.js';
import { VIEW } from './data/view.js';
import { createHudView } from './ui/hudview.js';
import { createModalHost, createDialog } from './ui/dialog.js';
import { openLobby } from './ui/lobby.js';
import { openJobPicker } from './ui/jobpick.js';
import { createNameplates } from './ui/nameplates.js';
import { createLights, loadArea, updateAreaLogic, checkSeals, bossDown, makeRoom } from './area.js';
import { AREAS, AREA_ORDER, COURSES, courseOf } from './data/areas.js';
import { JOBS, JOB_ORDER, REVIVE, DEFAULT_JOB } from './data/jobs.js';
import { updateJobZones, inAegis } from './jobs.js';
import { hurtPlayer } from './combat.js';
import { createRaid } from './raid.js';
import { fmtTime, clamp } from './util.js';

const TITLE = '3DRPG 〜魔窟の主〜';
const CONTROLS = [
  'WASD：移動　Shift：ダッシュ　マウス：視点（画面クリックで視点ロック／右ドラッグでも可）',
  'V：一人称／三人称の切り替え（はじめは一人称）',
  '左クリック：通常攻撃（長押しで出し続ける）　Space：回避（無敵時間あり）　F：看板を調べる',
  'Q・E：スキル（クールダウン）　R：必殺技（攻撃を当てて溜める。近接ほど早く溜まる）',
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
  if (!saveData.records3) saveData.records3 = { clears: 0, bestTime: 0 }; // ステージ3 の記録
  for (const c of COURSES) if (!saveData[c.recKey]) saveData[c.recKey] = { clears: 0, bestTime: 0 }; // 以降のステージも
  saveData.progress = migrateProgress(saveData.progress); // 旧形式（レベル制）は到達エリアだけ引き継ぐ
  // 設定（視点・名前・職業）は進行とは別に保存する（クリアしても消えない）
  if (!saveData.settings || !['fps', 'tps'].includes(saveData.settings.view)) saveData.settings = { ...(saveData.settings || {}), view: VIEW.defaultMode };
  const saveSettings = () => store.save(saveData);

  const game = {
    scene, camera, renderer, input, audio,
    sound: createSound(audio),
    state: createState(newProgress()),
    world: null,
    players: [],
    localIndex: 0, // 自分のプレイヤー番号
    bosses: [], // いまの部屋のボス（2体同時の部屋もある）
    /** 代表のボス（生きている最初の1体）。代入するとその1体だけの部屋になる */
    get boss() { return this.bosses.find((b) => b.alive) || this.bosses[0] || null; },
    set boss(b) { this.bosses = b ? [b] : []; },
    playing: false,
    down: null, // ひとりプレイの全滅演出中 { t }
    trans: null, // エリア遷移中 { t, phase, to }
    raid: null, // 協力プレイの通信（ひとりなら null）
    isClient: false, // 協力プレイの参加者（ホストでない）なら true：ボス・雑魚は見た目だけ
    mirroring: false, // ホストで演出を参加者へ送る記録中
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
  game.allies = createAllies(game);
  game.hazards = createHazards(game);
  game.hudView = createHudView(game);
  game.plates = createNameplates(game); // 頭上の名前と HP バー（味方・ボス）
  game.modal = createModalHost(game);
  game.dialog = createDialog(game, game.modal);
  game.ui = { dialog: game.dialog };
  game.inAegis = inAegis;
  setPlayers([{ id: 'local', job: DEFAULT_JOB, name: saveData.settings.name || '' }], 'local');

  // 同じ文を短時間に何度も出さないトースト
  const toastTimes = new Map();
  game.toastOnce = (msg, ms = 2000) => {
    const now = performance.now();
    if (now - (toastTimes.get(msg) || 0) < ms + 400) return;
    toastTimes.set(msg, now);
    game.toast(msg, ms);
  };
  game.onEnemyKilled = () => checkSeals(game);
  game.onBossDown = (b) => bossDown(game, b);
  game.onPlayerHurt = (p, dirX, dirZ) => {
    if (p === game.me()) game.hudView.hurt(dirX, dirZ);
  };

  // ---- プレイヤー（職業）を作り直す ----
  function setPlayers(roster, myId) {
    for (const p of game.players) scene.remove(p.model.group);
    game.players = roster.map((r, i) => createPlayer(game, i, { job: r.job, remote: r.id !== myId, id: r.id, name: r.name }));
    game.localIndex = Math.max(0, game.players.findIndex((p) => !p.remote));
    const me = game.me();
    if (me.jobId === 'shifter') me.shift = { t: JOBS.shifter.shiftEvery };
    game.vm.setLook(me.job.look);
    game.setView?.(saveData.settings.view);
  }

  /** 自分の職業を変える（全滅したときの選び直し）。協力プレイでは 'ps' の job で他の人の画面も作り直される */
  function changeMyJob(job, { shift = false } = {}) {
    const old = game.me();
    if (!old || old.jobId === job || !JOBS[job]) return;
    scene.remove(old.model.group);
    const np = createPlayer(game, game.localIndex, { job, remote: false, id: old.id, name: old.name });
    np.pos.copy(old.pos);
    np.yaw = old.yaw;
    game.players[game.localIndex] = np;
    if (shift) {
      // 変化師：HP の割合・必殺ゲージ・バフはそのまま、職業だけ入れ替わる
      np.hp = Math.max(1, np.maxHp * (old.hp / old.maxHp));
      np.gauge = old.gauge;
      np.buffs = old.buffs;
      np.alive = old.alive;
      np.downed = old.downed;
      np.invuln = old.invuln;
      np.shift = old.shift;
    } else {
      saveData.settings.job = job;
      store.save(saveData);
      if (job === 'shifter') np.shift = { t: JOBS.shifter.shiftEvery };
    }
    game.vm.setLook(np.job.look);
    game.setView(saveData.settings.view);
    game.toast(shift ? `変化！ ${np.job.name}になった` : `${np.job.name}に転職した！`, 1800);
  }
  game.changeMyJob = changeMyJob;
  /** 変化師：決まった時間ごとに、ランダムな職業に入れ替わる（変化師そのものには戻らない） */
  function updateShift(dt) {
    const me = game.me();
    if (!me?.shift || !me.alive) return;
    me.shift.t -= dt;
    if (me.shift.t <= 5 && me.shift.t + dt > 5) game.toastOnce('あと5秒で変化する……', 1500);
    if (me.shift.t > 0) return;
    me.shift.t = JOBS.shifter.shiftEvery;
    const pool = JOB_ORDER.filter((j) => j !== 'shifter' && j !== me.jobId);
    changeMyJob(pool[Math.floor(Math.random() * pool.length)], { shift: true });
  }
  /** 職業を選べるステージか（ステージ1 は剣士固定） */
  const canChangeJob = () => courseOf(game.state.progress.area) !== COURSES[0];

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

  // ---- セーブ（到達したエリアと記録だけ。つづきからはそのエリアの入口から）。ルームでの協力プレイ中は保存しない ----
  game.autosave = () => {
    if (!game.playing || game.raid) return;
    saveData.progress = game.state.progress;
    store.save(saveData);
  };
  // ハブへ戻る・タブを閉じる・裏に回ったときもプレイ時間などを保存
  addEventListener('pagehide', () => game.autosave());
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.autosave(); });

  // ---- 味方への効果（回復・強化・蘇生）：全員に配り、各自が自分に当てはまるか見て適用 ----
  game.teamEffect = (eff) => {
    applyTeamEffect(eff);
    game.raid?.sendTeam(eff);
  };
  function applyTeamEffect(eff) {
    const me = game.me();
    if (!me) return;
    const near = eff.r ? Math.hypot(me.pos.x - eff.x, me.pos.z - eff.z) <= eff.r : true;
    switch (eff.kind) {
      case 'heal':
        if (me.alive && near) {
          me.hp = Math.min(me.maxHp, me.hp + me.maxHp * eff.amount);
          game.fx.burst(me.pos.x, 1.5, me.pos.z, eff.quiet ? 0xce93d8 : 0xfff59d, eff.quiet ? 3 : 16, { speed: 2, up: 4, life: 0.7 });
          if (!eff.quiet) game.toastOnce('癒しの光で回復した！', 1200);
        }
        break;
      case 'buff':
        if (me.alive && near) {
          // 結界師のバリア：最大 HP の割合 → 吸収できる量
          if (eff.vals?.shield) me.buff(eff.name, eff.dur, { hp: me.maxHp * eff.vals.shield });
          else me.buff(eff.name, eff.dur, { ...eff.vals });
          if (eff.msg) game.toastOnce(eff.msg, 1600);
        }
        break;
      case 'prayer':
        if (me.downed) me.revive(1);
        me.hp = me.maxHp;
        me.invuln = Math.max(me.invuln, eff.invuln);
        game.toastOnce('女神の祈り：全回復＆無敵！', 1600);
        break;
      case 'gauge':
        // 盗賊の大盤振る舞い：必殺ゲージを配る
        if (me.alive && near && eff.from !== me.id) {
          me.addGauge(eff.amount);
          game.toastOnce(`必殺ゲージをもらった！（+${eff.amount}）`, 1400);
        }
        break;
      case 'cdreset':
        // 指揮者：みんなの Q・E がすぐ使えるようになる
        if (me.alive) {
          me.cd.q = 0;
          me.cd.e = 0;
          game.toastOnce('指揮者の号令：Q・E がすぐ使える！', 1600);
        }
        break;
      case 'reviveall':
        // 献身者：倒れた仲間を全員蘇生
        if (me.downed) {
          me.revive(eff.hp);
          game.toast('献身者に救われた！', 1600);
        }
        break;
      case 'revive':
        if (eff.id === me.id && me.downed) {
          me.revive();
          game.toast('仲間に助け起こされた！', 1600);
        }
        break;
      default:
        break;
    }
  }

  // ---- ボスへの命令（挑発・召喚）：ホストが処理 ----
  game.bossCommand = (cmd) => {
    if (game.isClient) game.raid.sendCommand(cmd);
    else game.withMirror ? game.withMirror(() => handleCommand(cmd)) : handleCommand(cmd);
  };
  function handleCommand(cmd) {
    // 挑発・鈍化・時間停止は部屋のボス全員に、腐食は当てた1体に（sub で指定）
    const alive = game.bosses.filter((b) => b.alive);
    if (cmd.type === 'taunt') alive.forEach((b) => b.setTaunt(cmd.id, cmd.dur));
    else if (cmd.type === 'debuff') alive.filter((b) => cmd.sub === undefined || b.sub === cmd.sub).forEach((b) => b.setDebuff(cmd.name, cmd.dur, cmd.mul));
    else if (cmd.type === 'pull') {
      // 重力術師：近くのボスを (x,z) の方へ引き寄せる（壁は越えない）
      for (const b of alive) {
        const dx = cmd.x - b.pos.x;
        const dz = cmd.z - b.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > cmd.r || d < 1) continue;
        const k = Math.min(cmd.dist, d - 1) / d;
        b.pos.x += dx * k;
        b.pos.z += dz * k;
        game.world.collide(b.pos, b.radius);
        game.fx.burst(b.pos.x, 2, b.pos.z, 0x7c4dff, 20, { speed: 4, up: 2, life: 0.5 });
      }
    } else if (cmd.type === 'shred') {
      alive.filter((b) => b.sub === cmd.sub).forEach((b) => b.addShred(cmd.per, cmd.max));
    } else if (cmd.type === 'detonate') game.allies.detonate(cmd.owner, cmd.mult, cmd.radius);
    else if (cmd.type === 'freeze') alive.forEach((b) => b.freeze(cmd.dur, cmd.immune));
    else if (cmd.type === 'summon') {
      if (cmd.kind === 'spirit') {
        // 上限を超えたら古い精霊から消える
        const mine = game.allies.list.filter((a) => a.owner === cmd.owner && a.kind === 'spirit');
        if (mine.length >= JOBS.summoner.q.max) mine[0].life = 0;
      }
      game.allies.spawn(cmd.kind, cmd.x, cmd.z, cmd.owner);
    }
  }

  /** 聖騎士の近く（6m）にいるか（被ダメ -10%） */
  game.paladinAura = (p) => game.players.some((o) => o.alive && o.jobId === 'paladin' && Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) <= 6);

  /** 吟遊詩人の近くでは Q のクールダウンが速く戻る */
  game.bardAura = (p) => {
    const J = JOBS.bard;
    return game.players.some((o) => o.alive && o.jobId === 'bard' && Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) <= J.auraRadius) ? J.auraCd : 1;
  };

  /** 中ボスを倒して次の部屋へ：自分を全回復（倒れていたら蘇生） */
  game.onBossStep = (stepN) => {
    const me = game.me();
    if (me.downed) me.revive(1);
    me.hp = me.maxHp;
    game.state.progress.bossStep = stepN;
  };
  /** 扉の外に残っている自分を部屋の中へ */
  game.gatherLocal = (toZ, doorZ) => {
    const me = game.me();
    if (me.pos.z > doorZ - 0.6) {
      me.pos.set(clamp(me.pos.x, -3, 3), 0, toZ);
      game.toastOnce('ボス部屋へ呼び寄せられた！', 1400);
    }
  };

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
      extra: `${game.world?.def.name || ''}　プレイ時間 ${fmtTime(game.state.progress.stats.time)}${game.raid ? '　（協力プレイ中はポーズしても時間は止まりません）' : ''}`,
    });
  }

  // ---- 暗転・遷移（次のステージへ） ----
  game.startTransition = (to) => {
    if (game.trans) return;
    game.trans = { t: 0, phase: 'out', to };
    game.sound.se('gate');
  };

  // ---- やられた・全滅・クリア ----
  game.onPlayerDown = (pl) => {
    // 不死鳥使い：1回の挑戦で一度だけ、倒れてもその場で復活する
    const pr0 = game.state.progress;
    if (pl.job.autoRevive && !pr0.usedOnce?.phoenixrise) {
      pr0.usedOnce = { ...(pr0.usedOnce || {}), phoenixrise: true };
      pl.hp = Math.round(pl.maxHp * pl.job.autoRevive);
      pl.invuln = Math.max(pl.invuln, 2.5);
      game.fx.burst(pl.pos.x, 1.5, pl.pos.z, 0xff7043, 70, { speed: 8, up: 9, life: 1.1, size: 0.3 });
      game.sound.se('roar');
      game.toast('不死鳥の炎で蘇った！（この挑戦では一度だけ）', 2400);
      return;
    }
    if (game.raid) {
      // 協力プレイ：その場で倒れて、仲間の蘇生を待つ（全員倒れたら全滅）
      pl.knockDown();
      game.sound.se('fall');
      game.toast('倒れた！ 仲間がそばに立つと蘇生できる', 2600);
      return;
    }
    if (game.down) return;
    pl.alive = false;
    game.down = { t: 0 };
    game.sound.bgm('');
    game.sound.se('fall');
  };

  /** 職業の選び直しをやめたとき：やられた画面を出し直す（やられた回数は増やさない） */
  function finishDownAgain() {
    game.state.progress.stats.deaths--;
    finishDown();
  }
  function finishDown() {
    const pr = game.state.progress;
    pr.stats.deaths++;
    game.autosave();
    expectUnlock = true;
    input.unlockPointer();
    game.hudView.show(false);
    const retry = () => {
      resetOnceOnWipe();
      game.down = null;
      loadArea(game, pr.area);
      game.hudView.show(true);
      input.lockPointer();
    };
    const extra = [];
    if (canChangeJob()) {
      // 職業を選び直してからやり直す（やめたら元の画面に戻る）
      extra.push({ label: '職業を変えてやり直す', onClick: () => openJobPicker({
        current: game.me().jobId,
        title: 'やられてしまった…… 職業を選び直す',
        onPick: (job, done) => {
          if (!done) return;
          changeMyJob(job);
          retry();
        },
        onClose: () => { if (game.down) finishDownAgain(); },
      }) });
    }
    extra.push({ label: 'タイトルへ', onClick: () => title() });
    showResult({
      title: 'やられてしまった……',
      lines: [pr.bossStep ? `${AREAS[pr.area].name}：倒したボスの次の部屋の前からやり直す（HP は全快）。` : `${AREAS[pr.area].name} の入口からやり直す（HP は全快、魔物は元に戻る）。`, `プレイ時間 ${fmtTime(pr.stats.time)}　やられた回数 ${pr.stats.deaths}`],
      retryLabel: pr.bossStep ? '部屋の前からやり直す' : '入口からやり直す',
      onRetry: retry,
      extraButtons: extra,
    });
  }

  /**
   * 協力プレイ：全員倒れたら（ホストが判定）全員に職業の選び直しを出す。時間制限はなく、
   * 全員が「準備OK」を押すとホストが「再開」を押せて、部屋の前から選んだ職業でやり直す
   */
  let wiped = false;
  const wipeReady = new Map(); // id → { ready, job }
  function checkWipe() {
    if (!game.raid || game.isClient || wiped) return;
    if (game.players.length && game.players.every((p) => !p.alive)) {
      game.raid.broadcast('wipe', {});
      onWipe();
    }
  }
  /** 全滅：職業を選び直せる（決まった職業はやり直すときに反映） */
  let pendingJob = null;
  let picker = null;
  function onWipe() {
    wiped = true;
    wipeReady.clear();
    game.toast('全滅…… 職業を選び直して「準備OK」。全員そろったらホストが再開', 3200);
    if (document.pointerLockElement) {
      expectUnlock = true;
      input.unlockPointer();
    }
    pendingJob = null;
    picker?.close();
    picker = openJobPicker({
      current: game.me().jobId,
      title: '全滅…… 職業を選び直す',
      onPick: (job) => { pendingJob = job; },
      onClose: () => { picker = null; },
      ready: {
        isHost: () => !game.isClient,
        members: () => game.players.map((p) => ({
          name: p.name, me: p === game.me(),
          job: wipeReady.get(p.id)?.job || p.jobId,
          ready: !!wipeReady.get(p.id)?.ready,
        })),
        onReady: (job, ready) => {
          wipeReady.set(game.me().id, { job, ready });
          game.raid?.broadcast('wipeready', { job, ready });
          picker?.refresh();
        },
        onStart: () => {
          const d = { step: game.state.progress.bossStep || 0 };
          game.raid.broadcast('restart', d);
          onRestart(d);
        },
      },
    });
  }
  /** 仲間の準備OK が届いた */
  function onWipeReady(d, from) {
    wipeReady.set(from, { job: d.job, ready: d.ready });
    picker?.refresh();
  }
  /** 全滅してやり直すとき：僧侶の女神の祈り（一度きりの R）は使えるように戻す */
  function resetOnceOnWipe() {
    const u = game.state.progress.usedOnce;
    if (u?.prayer) {
      delete u.prayer;
      if (game.me()?.jobId === 'priest') game.toastOnce('全滅したので「女神の祈り」がまた使える', 1800);
    }
    if (u?.lastrites) delete u.lastrites; // 献身者の身代わりの儀も同じく戻る
  }
  function onRestart(d) {
    resetOnceOnWipe();
    wiped = false;
    wipeReady.clear();
    closeAll();
    picker?.close();
    if (pendingJob) changeMyJob(pendingJob);
    pendingJob = null;
    const pr = game.state.progress;
    pr.bossStep = d.step;
    pr.stats.deaths++;
    game.playing = true;
    loadArea(game, pr.area);
    game.hudView.show(true);
  }

  game.onBossDefeated = () => {
    if (game.raid && !game.isClient) game.raid.broadcast('clear', { time: game.state.progress.stats.time });
    showClear();
  };
  function showClear() {
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
    if (!game.raid) saveData.progress = null; // クリアしたら「つづきから」は消える
    store.save(saveData);
    game.hudView.show(false);
    const party = game.players.length > 1 ? `仲間：${game.players.filter((p) => p !== game.me()).map((p) => `${p.name}（${p.job.name}）`).join('、')}` : '';
    const lines = [
      `プレイ時間 ${fmtTime(time)}${best ? '（ベスト更新！）' : `（ベスト ${fmtTime(rec.bestTime)}）`}`,
      `撃破数 ${pr.stats.kills}　やられた回数 ${pr.stats.deaths}`,
      `クリア回数 ${rec.clears}`,
    ];
    if (party) lines.push(party);
    const raidHost = game.raid && !game.isClient;
    showResult({
      title: `${course.label} クリア！ ${course.clearMsg}`,
      lines,
      retryLabel: game.raid ? (raidHost ? '同じメンバーでもう一度' : undefined) : `${course.label}をもう一度`,
      onRetry: game.raid
        ? (raidHost ? () => { const d = { step: 0, again: true }; game.raid.broadcast('restart', d); againRaid(d); } : undefined)
        : () => startCourse(course),
      extraButtons: [{ label: 'タイトルへ', onClick: () => title() }],
    });
  }
  /** 同じメンバーでもう一度（記録はリセット） */
  function againRaid(d) {
    game.state = createState(newProgress(game.state.progress.area));
    onRestart(d);
    game.state.progress.stats.deaths = 0;
  }

  // ---- 開始 ----
  function begin(progress) {
    game.state = createState(progress);
    game.down = null;
    game.trans = null;
    game.playing = true;
    wiped = false;
    const pr = game.state.progress;
    loadArea(game, pr.area);
    game.hudView.show(true);
    game.autosave();
    input.lockPointer();
    if (pr.area === AREA_ORDER[0]) setTimeout(() => toast('迷路を抜けて北の出口へ。赤い結界は番人を全部倒すと消える', 4000), 800);
    if (pr.area === COURSES[1].start && !pr.bossStep) setTimeout(() => toast('中ボス2体を倒して、最奥の冥王を討て。近接で殴るとボスがブレイク（気絶）する', 4000), 800);
    if (pr.area === 'dusk' && !pr.bossStep) setTimeout(() => toast('夕暮れの5連戦。最後は黄昏竜ラグナ', 4000), 800);
    if (pr.area === 'wilds' && !pr.bossStep) setTimeout(() => toast('屋外の5連戦。竜や魔獣が相手。最後は古竜エルドラード', 4000), 800);
    if (pr.area === COURSES[2].start && !pr.bossStep) setTimeout(() => toast('5連戦。4戦目と5戦目はボスが2体同時に出る。攻撃は重い、油断するな', 4000), 800);
  }

  /** ひとりで遊ぶ（ステージ1 は剣士固定、ステージ2・3 は選んだ職業） */
  function startSolo(progress, job = DEFAULT_JOB) {
    leaveRaid();
    closeAll();
    setPlayers([{ id: 'local', job, name: saveData.settings.name || '' }], 'local');
    begin(progress);
  }
  function startCourse(course) {
    if (course !== COURSES[0]) startSolo(newProgress(course.start), saveData.settings.job || DEFAULT_JOB);
    else startSolo(newProgress(course.start));
  }

  /** ステージ2・3（レイド）の準備画面 */
  function lobby(course = COURSES[1]) {
    leaveRaid();
    openLobby({
      settings: saveData.settings,
      save: saveSettings,
      area: course.start,
      heading: `${course.label}　${course.name}`,
      headingOf: (a) => { const c = courseOf(a); return `${c.label}　${c.name}`; },
      onSolo: ({ job }) => startSolo(newProgress(course.start), job),
      onBack: () => title(),
      onStart: ({ net, roster, step, area }) => startRaid(net, roster, step, area),
    });
  }

  /** ルームで協力プレイを始める */
  function startRaid(net, roster, stepN, area = 'castle') {
    leaveRaid();
    if (!roster.some((r) => r.id === net.myId)) {
      // 途中参加：自分を足す
      roster = [...roster, { id: net.myId, name: saveData.settings.name || '', job: saveData.settings.job || DEFAULT_JOB }];
    }
    setPlayers(roster, net.myId);
    game.isClient = !net.isHost;
    game.raid = createRaid(game, net, raidHandlers);
    const pr = newProgress(AREAS[area] ? area : 'castle');
    pr.bossStep = stepN || 0;
    begin(pr);
    game.toast(game.isClient ? '協力プレイ開始！（ボスはホストの画面と同期）' : '協力プレイ開始！ あなたがホスト', 2600);
  }

  function leaveRaid() {
    if (!game.raid) return;
    const r = game.raid;
    game.raid = null;
    game.isClient = false;
    r.dispose();
    r.net.leaveRoom();
  }

  const raidHandlers = {
    hurtLocal: (me, frac, fx, fz) => hurtPlayer(game, me, frac, fx, fz),
    applyTeamEffect,
    handleCommand,
    applyWorld(ws) {
      const pr = game.state.progress;
      const def = game.world?.def;
      if (!def?.bosses) return;
      if (ws.step !== (pr.bossStep || 0)) game.onBossStep(ws.step);
      // ボス（1体または2体）：部屋が変わっていたら作り直してから、それぞれに状態を当てる
      const list = ws.bosses || [];
      if (list.length) {
        const sig = (arr) => arr.map((o) => `${o.idx}:${o.sub}:${o.key}`).join(',');
        if (sig(game.bosses) !== sig(list)) {
          for (const b of game.bosses) b.dispose();
          game.bosses = makeRoom(game, def.bosses[list[0].idx], list[0].idx);
        }
        for (const s of list) game.bosses.find((b) => b.sub === s.sub)?.applyNet(s);
      }
      game.enemies.applyNet(ws.enemies);
      game.allies.applyNet(ws.allies);
      pr.stats.kills = ws.kills;
    },
    onEvent(type, a) {
      if (type === 'door') game.world.extra.doors?.[a[0]]?.(a[1]);
      else if (type === 'gather') game.gatherLocal(a[0], a[1]);
      else if (type === 'step') {
        game.onBossStep(a[0]);
        game.projectiles.clearEnemyShots();
      }
    },
    onRestart: (d) => (d.again ? againRaid(d) : onRestart(d)),
    onWipe: () => onWipe(),
    onWipeReady,
    onClear: () => showClear(),
    onBecomeHost() {
      game.isClient = false;
      // ボスを本物として作り直し、全員で部屋の前からやり直す
      const d = { step: game.state.progress.bossStep || 0 };
      game.raid.broadcast('restart', d);
      onRestart(d);
    },
    onLateJoin(id) {
      const roster = game.players.map((p) => ({ id: p.id, name: p.name, job: p.jobId }));
      game.raid.net.send('start', { roster, step: game.state.progress.bossStep || 0, area: game.state.progress.area }, { to: id });
      game.withMirror(() => game.toast('仲間が参加した！', 2000));
    },
    onDisconnect() {
      if (!game.raid) return;
      game.raid.dispose();
      game.raid = null;
      game.isClient = false;
      game.toast('接続が切れました。タイトルに戻ります', 3000);
      title();
    },
  };

  /** タイトル：ステージ1／ステージ2 を選ぶ（shared の showTitle はボタン1つなので、2つ目はここで足す） */
  function title() {
    leaveRaid();
    closeAll();
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
      onStart: () => startCourse(COURSES[0]),
      startLabel: `${COURSES[0].label}　${COURSES[0].name}`,
      onContinue: has ? () => startSolo(saveData.progress, cont !== COURSES[0] ? saveData.settings.job || DEFAULT_JOB : DEFAULT_JOB) : undefined,
      continueLabel: has ? `つづきから（${cont.label}：${AREAS[saveData.progress.area].name.replace(/^\S+\s+/, '')}）` : undefined,
    });
    // 説明文はステージごとに改行して見せる
    const descEl = document.querySelector('.g3-overlay .g3-panel > p');
    if (descEl) descEl.style.whiteSpace = 'pre-line';
    // ステージ2・3 のボタン（見た目は shared のボタンに合わせる）
    const row = document.querySelector('.g3-overlay .g3-btns');
    if (row) {
      for (const c of COURSES.slice(1)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'g3-btn' + (has ? ' sub' : '');
        b.textContent = `${c.label}　${c.name}（1〜8人・職業を選ぶ）`;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          closeAll();
          lobby(c);
        });
        row.appendChild(b);
      }
    }
  }

  // ---- 入力 → intent（データ） ----
  const myIntent = emptyIntent();
  const idleIntent = emptyIntent(); // 操作していないとき（ポーズ中の協力プレイなど）
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
    // 左クリックは押しっぱなしで通常攻撃を出し続ける（近接はコンボが続き、飛び道具は撃てる間隔ごとに撃つ）
    it.attack = input.isDown('Mouse0') || input.wasPressed('Mouse0');
    it.dodge = input.wasPressed('Space');
    it.dash = k('ShiftLeft') || k('ShiftRight');
    it.skillQ = input.wasPressed('KeyQ');
    it.skillE = input.wasPressed('KeyE');
    it.skillR = input.wasPressed('KeyR');
    it.interact = input.wasPressed('KeyF');
    return it;
  }

  /** 倒れた仲間のそばに立つと蘇生（だれでも同じ速さ） */
  const reviving = new Map();
  function updateRevive(dt, me) {
    if (!me.alive) return;
    for (const p of game.players) {
      if (p === me || !p.downed) {
        reviving.delete(p.id);
        continue;
      }
      if (Math.hypot(p.pos.x - me.pos.x, p.pos.z - me.pos.z) > REVIVE.radius) {
        reviving.delete(p.id);
        continue;
      }
      const t = (reviving.get(p.id) || 0) + dt;
      reviving.set(p.id, t);
      game.hudView.setPrompt(`${p.name || '仲間'}を蘇生中… ${Math.min(100, Math.floor((t / REVIVE.time) * 100))}%`, null);
      if (t >= REVIVE.time) {
        reviving.delete(p.id);
        game.teamEffect({ kind: 'revive', id: p.id });
        game.toast(`${p.name || '仲間'}を助け起こした！`, 1600);
      }
    }
  }

  /** 僧侶の近くにいると少しずつ回復 */
  function priestAura(dt, me) {
    if (!me.alive || me.hp >= me.maxHp) return;
    const J = JOBS.priest;
    if (game.players.some((o) => o.alive && o.jobId === 'priest' && Math.hypot(o.pos.x - me.pos.x, o.pos.z - me.pos.z) <= J.auraRadius)) {
      me.hp = Math.min(me.maxHp, me.hp + me.maxHp * J.auraRegen * dt);
    }
  }

  /** 2体同時の部屋：ボス同士が重ならないように押し離す */
  function separateBosses() {
    const bs = game.bosses;
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i];
        const c = bs[j];
        if (!a.alive || !c.alive || a.pos.y > 0 || c.pos.y > 0) continue;
        const dx = c.pos.x - a.pos.x;
        const dz = c.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz) || 0.01;
        const min = a.radius + c.radius;
        if (d < min) {
          const push = (min - d) / 2;
          a.pos.x -= (dx / d) * push;
          a.pos.z -= (dz / d) * push;
          c.pos.x += (dx / d) * push;
          c.pos.z += (dz / d) * push;
        }
      }
    }
  }

  // ---- 1フレームのゲーム更新 ----
  let saveTimer = 0;
  function step(dt, time, controlling, forced = null) {
    const intent = forced || (controlling ? readIntent() : idleIntent);
    const pr = game.state.progress;
    const me = game.me();

    if (!game.raid && game.fx.consumeStop(dt)) return; // ヒットストップ（協力プレイでは止めない）
    pr.stats.time += dt;
    game.players.forEach((p) => p.update(dt, p === me ? intent : idleIntent));
    game.world.update(dt, time);
    if (game.isClient) {
      // 参加者：ボス・雑魚・召喚物は見た目だけ
      game.enemies.update(dt, time);
      for (const b of game.bosses) b.update(dt, time);
      game.allies.update(dt, time);
    } else {
      const sim = () => {
        game.enemies.update(dt, time);
        for (const b of game.bosses) b.update(dt, time);
        separateBosses();
        game.allies.update(dt, time);
        if (!game.down) updateAreaLogic(game, intent);
      };
      if (game.withMirror && game.raid) game.withMirror(sim);
      else sim();
    }
    if (game.isClient && !game.down) updateAreaLogic(game, intent); // 看板だけ
    game.projectiles.update(dt);
    game.hazards.update(dt);
    updateJobZones(game, dt);
    if (game.raid) {
      updateRevive(dt, me);
      checkWipe();
      game.raid.update(dt);
    }
    priestAura(dt, me);
    updateShift(dt);
    // 祈祷師の近くにいると必殺ゲージが少しずつ溜まる
    if (me.alive && game.players.some((o) => o !== me && o.alive && o.jobId === 'shaman' && Math.hypot(o.pos.x - me.pos.x, o.pos.z - me.pos.z) <= 8)) me.addGauge(1.5 * dt);
    saveTimer += dt;
    if (saveTimer > 45 && !game.bosses.some((b) => b.active)) {
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
      step(dt, time, true);
    } else if (game.playing && game.raid && !game.modal.open) {
      // 協力プレイはポーズ中も世界が進む（操作だけ止める）
      step(dt, time, false);
    }

    if (game.playing) {
      if (active || game.raid) game.fx.update(dt);
      const me = game.me();
      game.lights.follow(me.pos);
      game.cam.update(dt, me, game.world, game.fx.shakeOffset);
      game.vm.setVisible(game.cam.fps && me.alive);
      game.vm.update(dt, me, game.cam);
      ui.update(dt);
      game.plates.update();
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
    // stepWith：入力を指定して1フレーム進める（自動テスト用）
    let dbgT = 0;
    game.debug = {
      startRaid, startSolo, lobby, title, newProgress, applyTeamEffect,
      stepWith(it, dt = 1 / 60) {
        dbgT += dt;
        step(dt, dbgT, false, Object.assign(emptyIntent({}), it));
        game.fx.update(dt);
      },
    };
  }
  return game;
}
