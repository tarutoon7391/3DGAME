// 3DRPG：仮ページ（フェーズ0）。shared を使って回る立方体を表示するだけ。本体はフェーズ1で実装する
import * as THREE from 'three';
import { createApp } from '/shared/engine.js';
import { createInput } from '/shared/input.js';
import { createAudio } from '/shared/audio.js';
import { showTitle, hud, showPause, hidePause, isPaused, showResult, toast } from '/shared/ui.js';
import { createSave } from '/shared/save.js';

const { renderer, scene, camera, start } = createApp({ canvas: document.getElementById('game') });
const input = createInput(renderer.domElement);
const audio = createAudio();
const store = createSave('rpg');
const data = store.load({ plays: 0 });

scene.background = new THREE.Color(0x0d1117);
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(3, 6, 4);
sun.castShadow = true;
scene.add(sun);

const cube = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshStandardMaterial({ color: 0x4caf50 }));
cube.castShadow = true;
cube.position.y = 1;
scene.add(cube);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x30363d }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
camera.position.set(0, 2.5, 5);
camera.lookAt(0, 1, 0);

let playing = false;
let timeLeft = 0;

function begin() {
  playing = true;
  timeLeft = 5;
  data.plays += 1;
  store.save(data);
  toast('準備中の仮ページです');
  audio.beep({ freq: 660, dur: 0.15 });
}

start((dt) => {
  if (playing && input.wasPressed('Escape')) {
    if (isPaused()) hidePause();
    else showPause({ onRetry: begin });
  }
  const active = playing && !isPaused();
  cube.rotation.x += dt * 0.7;
  cube.rotation.y += dt * (active ? 2.5 : 1);
  if (active) {
    timeLeft -= dt;
    hud(`のこり ${Math.ceil(timeLeft)} 秒／プレイ回数 ${data.plays}`);
    if (timeLeft <= 0) {
      playing = false;
      hud('');
      audio.beep({ freq: 440, dur: 0.3, slide: 880 });
      showResult({ title: '仮ページ終了', lines: ['本体はフェーズ1で実装予定です'], onRetry: begin });
    }
  }
  input.endFrame();
});

showTitle({ title: '3DRPG', desc: '村・草原・ダンジョンを冒険してボスを倒すアクションRPG（準備中）', controls: 'Esc：ポーズ', onStart: begin });
