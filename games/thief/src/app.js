// 画面の流れ（タイトル → ステージ選択 → プレイ → リザルト）と入力の読み取り
import * as THREE from 'three';
import { createApp } from '/shared/engine.js';
import { createInput } from '/shared/input.js';
import { createAudio } from '/shared/audio.js';
import { showTitle, hud, showPause, hidePause, isPaused, showResult, toast, closeAll } from '/shared/ui.js';
import { STAGES } from './stages/index.js';
import { createSession } from './session.js';
import { createView } from './view.js';
import { createFx } from './fx.js';
import { createSfx } from './sfx.js';
import { calcRank, loadBest, saveBest } from './rank.js';
import { setHint, flashAlarm, updateScreens, showStageSelect, closeStageSelect, fmtTime } from './screens.js';

const CONTROLS = [
  'WASD／矢印：移動　Shift：走る（速いが足音大）',
  'C：しゃがみ切替／Ctrl：押している間しゃがみ（遅い・静か・見つかりにくい）',
  'F：盗む・隠れる・扉を開ける',
  '1：おとりコイン（向いている方へ投げ、音で警備員を誘導）',
  '2：煙玉（数秒間、視界を遮る）',
  'Q／E：カメラ回転　ホイール：ズーム　M：消音　Esc：ポーズ',
  '',
  '床の扇形＝警備員・カメラの視野。物陰や展示台の陰（しゃがみ）は見つかりにくい',
  'メインのお宝を盗んで緑の出口へ。捕まるとステージ最初から',
].join('\n');

export function boot() {
  const { renderer, scene, camera, start } = createApp({ canvas: document.getElementById('game') });
  const input = createInput(renderer.domElement);
  const audio = createAudio();
  const sfx = createSfx(audio);
  const fx = createFx(scene);
  const view = createView(camera);

  // 夜の館内
  scene.background = new THREE.Color(0x07070d);
  scene.fog = new THREE.Fog(0x07070d, 30, 75);
  scene.add(new THREE.HemisphereLight(0x8890c8, 0x201828, 1.3));
  scene.add(new THREE.AmbientLight(0x404058, 0.6));
  const moon = new THREE.DirectionalLight(0x9fb0ff, 0.9);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.bias = -0.0005;
  scene.add(moon, moon.target);

  const me = 0; // 自分のプレイヤー番号（オンライン時はここが変わる）
  let session = null;
  let stageIdx = 0;
  let playing = false;
  let crouchToggle = false;
  let demoT = 0;

  function load(i) {
    if (session) session.dispose();
    fx.reset();
    stageIdx = i;
    session = createSession({ scene, fx, sfx, stage: STAGES[i], stageNo: i + 1 });
    const { w, h } = session.level.size;
    moon.position.set(w / 2 - 12, 30, h / 2 + 10);
    moon.target.position.set(w / 2, 0, h / 2);
    const sc = moon.shadow.camera;
    const half = Math.max(w, h) * 0.75;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
    sc.near = 1; sc.far = 90;
    sc.updateProjectionMatrix();
    const p = session.players[me].pos;
    view.snap(p.x, p.z);
  }

  function startStage(i) {
    closeAll();
    closeStageSelect();
    load(i);
    playing = true;
    crouchToggle = false;
    sfx.bgm('calm');
    toast(`ステージ${i + 1}：${STAGES[i].name}`, 2500);
  }

  function openSelect() {
    playing = false;
    hud('');
    setHint('');
    sfx.bgm('');
    showStageSelect({ stages: STAGES, best: loadBest(), onSelect: startStage, onBack: openTitle });
  }

  function openTitle() {
    playing = false;
    showTitle({
      title: '怪盗ナイト',
      desc: '夜の美術館に忍び込み、警備員・監視カメラ・トラップをかいくぐってお宝を盗み出せ！',
      controls: CONTROLS,
      startLabel: 'ステージ選択へ',
      onStart: openSelect,
    });
  }

  function finish() {
    playing = false;
    setHint('');
    const st = session.state;
    const i = stageIdx;
    const extra = [{ label: 'ステージ選択', onClick: openSelect }];
    if (st.phase === 'clear') {
      sfx.bgm('');
      sfx.clear();
      const total = 1 + st.subTotal;
      const rate = Math.round(((1 + st.subTaken) / total) * 100);
      const time = Math.round(st.time);
      const { score, rank } = calcRank({ time, found: st.found, rate, par: STAGES[i].par });
      const rec = { rank, score, time, found: st.found, rate };
      const isBest = saveBest(i + 1, rec);
      if (i + 1 < STAGES.length) extra.unshift({ label: '次のステージへ', onClick: () => startStage(i + 1) });
      showResult({
        title: `脱出成功！　ランク ${rank}`,
        lines: [
          `クリア時間 ${fmtTime(time)}（目標 ${fmtTime(STAGES[i].par)}）`,
          `発見回数 ${st.found} 回`,
          `回収率 ${rate}%（お宝 ${1 + st.subTaken}/${total}）`,
          `スコア ${score}${isBest ? '　★ベスト更新！' : ''}`,
        ],
        onRetry: () => startStage(i),
        extraButtons: extra,
      });
    } else {
      sfx.bgm('');
      showResult({
        title: 'つかまった…',
        lines: ['警備員に捕まってしまった。', 'ステージの最初からやり直そう。'],
        retryLabel: 'ステージ最初から',
        onRetry: () => startStage(i),
        extraButtons: extra,
      });
    }
  }

  /** キーボード → 意図（データ）。状態更新とは分ける */
  function readIntent() {
    let ix = 0;
    let iz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) iz += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) iz -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) ix += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) ix -= 1;
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    if (input.wasPressed('KeyC')) crouchToggle = !crouchToggle;
    if (run) crouchToggle = false;
    const a = view.axes();
    let mx = a.fx * iz + a.rx * ix;
    let mz = a.fz * iz + a.rz * ix;
    const l = Math.hypot(mx, mz);
    if (l > 0) { mx /= l; mz /= l; }
    return {
      mx,
      mz,
      run,
      crouch: crouchToggle || input.isDown('ControlLeft') || input.isDown('ControlRight'),
      act: input.wasPressed('KeyF'),
      coin: input.wasPressed('Digit1') || input.wasPressed('Numpad1'),
      smoke: input.wasPressed('Digit2') || input.wasPressed('Numpad2'),
    };
  }

  function updateHud() {
    const st = session.state;
    const pl = session.players[me];
    const g = Math.round(session.maxGauge * 10) / 10;
    const mode = pl.hidden ? '<span style="color:#7fe">隠れ中</span>' : pl.mode === 'run' ? '<span style="color:#fa8">走る</span>' : pl.mode === 'crouch' ? '<span style="color:#adf">しゃがみ</span>' : '歩く';
    const subs = st.subTotal ? `　サブ ${st.subTaken}/${st.subTotal}` : '';
    hud(
      `<b>ステージ${st.stageNo}　${STAGES[stageIdx].name}</b><br>` +
        `時間 ${fmtTime(st.time)}　発見 ${st.found}<br>` +
        `メイン ${st.mainTaken ? '<span style="color:#ffd54f">★盗んだ</span>' : '☆まだ'}${subs}${st.keys ? '　<span style="color:#ffeb3b">カードキー</span>' : ''}<br>` +
        `[1] コイン ×${st.coin}　[2] 煙玉 ×${st.smoke}<br>` +
        `${mode}　警戒 <span class="th-bar"><i style="width:${g * 100}%"></i></span>` +
        (audio.muted ? '　（消音）' : ''),
    );
  }

  // Ctrl＋キーのブラウザ既定動作をできるだけ止める（Ctrl+W 等は止められないので C キー推奨）
  window.addEventListener('keydown', (e) => {
    if (playing && e.ctrlKey && /^(Key[A-Z]|Digit\d)$/.test(e.code)) e.preventDefault();
  });

  load(0);
  openTitle();
  // 動作確認用（?debug の時だけ）：セッションを外から進められるようにする
  if (new URLSearchParams(location.search).has('debug')) {
    window.__thief = { get session() { return session; }, startStage, view, camera };
  }

  start((dt, time) => {
    if (input.wasPressed('KeyM')) audio.setMuted();
    if (playing && input.wasPressed('Escape')) {
      if (isPaused()) hidePause();
      else showPause({ onRetry: () => startStage(stageIdx), extra: 'Esc でつづける' });
    }
    if (playing && !isPaused()) {
      const intents = [];
      intents[me] = readIntent();
      session.update(dt, time, intents);
      for (const m of session.messages) typeof m === 'string' ? toast(m, 2200) : toast(m.text, m.ms);
      session.messages.length = 0;
      if (session.alarmFlash > 1.9) flashAlarm(1.5);
      sfx.bgm(session.chasing ? 'tense' : 'calm');
      setHint(session.hintFor(session.players[me]));
      updateHud();
      if (session.state.phase !== 'play') finish();
      const p = session.players[me].pos;
      view.update(dt, input, p.x, p.z, fx.shakeOff);
    } else if (!playing) {
      // メニュー中は館内をゆっくり見せる
      demoT += dt;
      const { w, h } = session.level.size;
      camera.position.set(w / 2 + Math.cos(demoT * 0.1) * w * 0.6, Math.max(w, h) * 0.75, h / 2 + Math.sin(demoT * 0.1) * h * 0.6);
      camera.lookAt(w / 2, 0, h / 2);
    }
    fx.update(dt);
    updateScreens(dt, time, playing && session.chasing);
    input.endFrame();
  });
}
