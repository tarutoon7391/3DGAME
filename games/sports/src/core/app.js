// アプリ全体の流れ：タイトル → 競技選択 → 難易度 → 試合 → 結果 → 再戦／競技選択
import * as THREE from 'three';
import { createApp } from '/shared/engine.js';
import { createInput } from '/shared/input.js';
import { createAudio } from '/shared/audio.js';
import { showTitle, hud, showPause, hidePause, isPaused, showResult, toast, closeAll } from '/shared/ui.js';
import { createRecords, SPORTS } from './records.js';
import { DIFFICULTIES } from './difficulty.js';
import { showSportMenu, showDifficulty, closeMenu } from './menu.js';
import { setBoard, clearCallout } from './scoreboard.js';
import { createDirector } from './director.js';
import { createFx, CONFETTI } from './fx.js';
import { createSound } from './sound.js';
import { createBackdrop } from './backdrop.js';
import { createTennis } from '../tennis/game.js';
import { createBaseball } from '../baseball/game.js';
import { createArchery } from '../archery/game.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const FACTORY = { tennis: createTennis, baseball: createBaseball, archery: createArchery };

const CONTROLS = [
  '【テニス】WASD：移動　Space：ショット（タイミングで強さ）',
  '　　　　　←→：打ち分け　Shift：ロブ　サーブも Space',
  '【野球】打撃：マウスでバット位置、クリックでスイング',
  '　　　　投球：1/2/3 で球種、マウスでコース、クリックで投球',
  '【アーチェリー】マウスで狙い、長押しで引き絞り、離して発射',
  '共通：Esc ポーズ　M ミュート',
].join('\n');

export function boot() {
  const { renderer, scene, camera, start } = createApp({ canvas: document.getElementById('game') });
  const input = createInput(renderer.domElement);
  const audio = createAudio();
  const sound = createSound(audio);
  const records = createRecords();
  const director = createDirector(camera);
  const fx = createFx(scene);
  const backdrop = createBackdrop(scene, director);

  let state = 'title'; // title | menu | play | result
  backdrop.show(true);
  let game = null;
  let current = null; // { sport, diff, mode }

  function clearGame() {
    if (game) game.dispose();
    game = null;
    fx.clear();
    hud('');
    setBoard('');
    clearCallout();
    director.reset();
    director.setFov(60, true);
  }

  function openMenu() {
    clearGame();
    closeAll();
    state = 'menu';
    backdrop.show(true);
    sound.bgm('menu');
    showSportMenu({
      records,
      onPick(sport) {
        sound.click();
        showDifficulty({
          sport,
          current: records.lastDiff,
          onBack: () => { sound.click(); openMenu(); },
          onPick(diff, mode) {
            sound.click();
            records.lastDiff = diff;
            closeMenu();
            startMatch({ sport, diff, mode });
          },
        });
      },
    });
  }

  function startMatch(opts) {
    clearGame();
    closeAll();
    current = opts;
    state = 'play';
    backdrop.show(false);
    // 前の画面のボタンにフォーカスが残ると Space で押されてしまうので外す
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    sound.bgm(opts.sport);
    const ctx = {
      scene, camera, renderer, input, sound, director, fx,
      diff: DIFFICULTIES[opts.diff],
      mode: opts.mode || 'cpu',
      finish: (r) => finishMatch(r),
    };
    game = FACTORY[opts.sport](ctx);
    // 動作確認用：?debug のときだけ状態を覗けるようにする
    if (DEBUG) window.__sports = { game, state: game.state, camera, scene, renderer, startMatch, openMenu };
  }

  /** 競技側から呼ばれる。r = {outcome, title, lines, best, bestText} */
  function finishMatch(r) {
    if (state !== 'play') return;
    state = 'result';
    sound.stopBgm();
    hidePause();
    const { sport } = current;
    const updated = records.add(sport, r);
    if (r.outcome === 'win' || (r.outcome === null && r.celebrate)) {
      sound.fanfare();
      sound.cheer(1);
      const p = camera.position;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      fx.burst({ x: p.x + dir.x * 6, y: p.y + 3, z: p.z + dir.z * 6 }, { count: 160, color: CONFETTI, speed: 5, up: 5, size: 0.12, life: 3, gravity: 3 });
    } else if (r.outcome === 'lose') {
      sound.lose();
    } else {
      sound.whistle();
    }
    const lines = [...r.lines];
    if (updated) lines.push(`★ ${SPORTS[sport].bestLabel} 更新！`);
    lines.push(`戦績：${records.summary(sport)}`);
    showResult({
      title: r.title,
      lines,
      retryLabel: '再戦する',
      onRetry: () => startMatch(current),
      extraButtons: [{ label: '競技選択へ', onClick: openMenu }],
    });
  }

  function togglePause() {
    if (isPaused()) {
      hidePause();
      return;
    }
    game?.onPause?.();
    showPause({
      onResume() {},
      onRetry: () => startMatch(current),
      extra: `${SPORTS[current.sport].label}（${DIFFICULTIES[current.diff].label}）　Esc でつづける`,
    });
  }

  start((dt, time) => {
    if (input.wasPressed('KeyM')) toast(audio.setMuted() ? 'ミュート ON' : 'ミュート OFF');
    if (state === 'play' && input.wasPressed('Escape')) togglePause();
    const running = !isPaused();
    if (state === 'play' && running && game) game.update(dt, time);
    else if (state === 'result' && game?.idle) game.idle(dt, time);
    if (state === 'title' || state === 'menu') backdrop.update(dt, time);
    if (running) fx.update(dt);
    director.update(dt);
    input.endFrame();
  });

  showTitle({
    title: '3Dスポーツ対戦',
    desc: 'テニス・野球・アーチェリーの3競技で CPU と対戦しよう（アーチェリーは2人交代プレイも可）。1試合 3〜5 分。',
    controls: CONTROLS,
    startLabel: '競技をえらぶ',
    onStart: () => { sound.click(); openMenu(); },
  });
}
