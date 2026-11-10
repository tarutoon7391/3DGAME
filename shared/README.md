# shared/ API（凍結する契約）

フェーズ1中は変更しない。足りない機能は各ゲームの `games/<slug>/src/` に書き、要望は `docs/requests/<ワーカー名>-shared.md` へ。

読み込みは絶対パス（`/shared/xxx.js`）で行う。`three` は各ゲームの `index.html` の importmap で `/vendor/three/three.module.js` に解決される。

## engine.js

```js
import { createApp } from '/shared/engine.js';
const { renderer, scene, camera, start, stop } = createApp({ canvas, antialias: true }); // 引数は全部省略可
start((dt, time) => { /* 毎フレーム。dt は秒（最大 0.05 にクランプ） */ });
stop(); // ループ停止。start() で再開（引数省略で前回の update を継続）
```

- canvas 省略時は自動生成して body に追加。全画面・リサイズ追従
- pixelRatio は上限 2、`renderer.shadowMap.enabled = true`（PCFSoft）
- camera は PerspectiveCamera(60°, near 0.1, far 1000)

## input.js

```js
import { createInput } from '/shared/input.js';
const input = createInput(renderer.domElement);
input.isDown('KeyW');        // 押しっぱなし（KeyboardEvent.code）
input.wasPressed('Escape');  // このフレームで押された
input.isDown('Mouse0');      // マウス左（Mouse1=中, Mouse2=右）
input.mouse.dx, input.mouse.dy, input.mouse.wheel, input.mouse.buttons, input.mouse.x, input.mouse.y, input.mouse.locked
input.lockPointer();         // クリックイベント内で呼ぶ
input.unlockPointer();
input.endFrame();            // update の最後で必ず呼ぶ（wasPressed と dx/dy/wheel をリセット）
input.dispose();
```

- Space・矢印・Tab はブラウザ既定動作を止める。右クリックメニューは出ない

## audio.js

```js
import { createAudio } from '/shared/audio.js';
const audio = createAudio();       // 初回クリック／キーで AudioContext 開始（それ以前の音は無視）
audio.beep({ freq: 880, dur: 0.1, type: 'square', vol: 0.2, slide: 220, when: 0 });
audio.noise({ dur: 0.3, vol: 0.3, filter: 1500 });          // 爆発・足音など
const stopBgm = audio.playSeq([{ freq: 262, dur: 0.25 }, { rest: 0.25 }, { freq: 330, dur: 0.5, type: 'square', vol: 0.05 }], { loop: true, tempo: 1 });
audio.stopSeq();
audio.setMuted(true); audio.setMuted(); // 引数省略でトグル。audio.muted で状態取得
```

## ui.js

```js
import { showTitle, hud, showPause, hidePause, isPaused, showResult, toast, isOverlayOpen, closeAll, initUI } from '/shared/ui.js';
showTitle({ title, desc, controls: 'WASD：移動\nSpace：ジャンプ', onStart, onContinue /* 任意：つづきから */ });
hud('<b>HP</b> 10/10');   // 左上。同じ文字列なら DOM を触らない
showPause({ onResume, onRetry /* 任意 */ });  // Esc 検知はゲーム側
hidePause(); isPaused();
showResult({ title: 'クリア！', lines: ['スコア 1200'], onRetry, extraButtons: [{ label: 'ステージ選択', onClick }] });
toast('アイテムを手に入れた');
```

- 右上に常設の「ハブへ戻る」ボタン（どれか1つ呼べば出る。`initUI()` で明示的に出せる）
- ポーズ・リザルトにも「ハブへ戻る」ボタンあり

## save.js

```js
import { createSave } from '/shared/save.js';
const store = createSave('rpg');            // localStorage キー: 3dgame:rpg
const data = store.load({ level: 1, gold: 0 }); // 無い・壊れている時は defaults。足りないキーは defaults で補完
store.save(data); store.exists(); store.clear();
```

## 最小の流れ（Esc ポーズ込み）

```js
let playing = false;
start((dt) => {
  if (input.wasPressed('Escape') && playing) {
    if (isPaused()) hidePause(); else showPause({ onResume() {} });
  }
  if (playing && !isPaused()) { /* ゲーム更新 */ }
  input.endFrame();
});
showTitle({ title: '…', controls: '…', onStart: () => { playing = true; } });
```
