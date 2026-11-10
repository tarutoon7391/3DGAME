// 共通エンジン：レンダラー・シーン・カメラとメインループ（凍結対象の契約）
import * as THREE from 'three';

const MAX_DT = 0.05; // 1フレームの最大経過秒（タブ復帰時のワープ防止）
const MAX_PIXEL_RATIO = 2;

/**
 * 3D アプリの土台を作る。
 * @param {object} [opts]
 * @param {HTMLCanvasElement} [opts.canvas] 既存の canvas。省略時は作って body に追加
 * @param {boolean} [opts.antialias=true]
 * @returns {{renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera,
 *            start: (update: (dt:number, time:number) => void) => void, stop: () => void}}
 */
export function createApp({ canvas, antialias = true } = {}) {
  if (!canvas) {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
  }
  // canvas は画面全体に敷く
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', display: 'block' });
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 2, 5);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let running = false;
  let rafId = 0;
  let last = 0;
  let elapsed = 0;
  let updateFn = null;

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min((now - last) / 1000, MAX_DT));
    last = now;
    elapsed += dt;
    if (updateFn) updateFn(dt, elapsed);
    renderer.render(scene, camera);
  }

  /** メインループ開始。update(dt, time) が毎フレーム呼ばれ、その後に描画される */
  function start(update) {
    if (update) updateFn = update;
    if (running) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  /** メインループ停止（描画も止まる）。start() で再開できる */
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  return { renderer, scene, camera, start, stop };
}
