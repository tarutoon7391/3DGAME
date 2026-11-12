// 拳銃使いのデッドアイ（構えている間の見た目。自分の画面だけ）
//   ・狙うボスにドクロつきの照準（溜まるほど赤く・速く回る）
//   ・画面はシネマ調（上下の黒帯・セピア・粒子のノイズ・周りを暗く）
//   ・画面下に溜めのゲージと、いま撃ったときの1発の威力の目安
import * as THREE from 'three';
import { skullTexture, starTexture } from '../fxtex.js';

export function createDeadeyeView(game) {
  // ---- 照準（ドクロと回る輪） ----
  const g = new THREE.Group();
  const skullMat = new THREE.SpriteMaterial({ map: skullTexture(), color: 0xff1744, transparent: true, depthTest: false, depthWrite: false });
  const skull = new THREE.Sprite(skullMat);
  skull.renderOrder = 20;
  const ringMat = new THREE.SpriteMaterial({ map: starTexture(), color: 0xff5252, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Sprite(ringMat);
  ring.renderOrder = 19;
  g.add(ring, skull);
  g.visible = false;
  game.scene.add(g);

  // ---- 画面（シネマ調） ----
  const root = document.createElement('div');
  root.className = 'rpg-deadeye';
  root.innerHTML = '<i class="bar top"></i><i class="bar bottom"></i><i class="grain"></i><i class="vig"></i><div class="meter"><b>DEAD EYE</b><span></span><div><u></u></div></div>';
  document.body.appendChild(root);
  const txt = root.querySelector('.meter span');
  const fill = root.querySelector('.meter u');
  const grain = root.querySelector('.grain');
  // フィルムの粒子：小さなノイズ画像を一度だけ作って敷き詰める
  const nc = document.createElement('canvas');
  nc.width = nc.height = 96;
  const nx = nc.getContext('2d');
  const img = nx.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nx.putImageData(img, 0, 0);
  grain.style.backgroundImage = `url(${nc.toDataURL()})`;
  const canvas = game.renderer?.domElement;
  let on = false;

  function setOn(v) {
    if (v === on) return;
    on = v;
    root.classList.toggle('on', v);
    if (canvas) canvas.style.filter = v ? 'sepia(0.55) contrast(1.15) saturate(0.85) brightness(0.95)' : '';
    if (!v) g.visible = false;
  }

  return {
    update() {
      const me = game.me?.();
      const de = me?.deadeye;
      if (!de || !game.playing) {
        setOn(false);
        return;
      }
      setOn(true);
      const r = me.job.r;
      const k = Math.min(1, de.t / r.full);
      const est = Math.round(60 + 140 * k);
      txt.textContent = `${Math.floor(k * 100)}%　1発 約${est} × 6`;
      fill.style.width = `${(k * 100).toFixed(1)}%`;
      fill.style.background = k >= 1 ? '#ff1744' : 'linear-gradient(90deg,#ffb300,#ff5252)';
      grain.style.backgroundPosition = `${Math.floor(Math.random() * 200)}px ${Math.floor(Math.random() * 200)}px`;
      // 狙うボス（一番近い戦闘中のボス）
      let best = null;
      let bd = r.range;
      for (const b of game.bosses) {
        if (!b.active || !b.alive || b.hidden) continue;
        const d = Math.hypot(b.pos.x - me.pos.x, b.pos.z - me.pos.z);
        if (d < bd) { bd = d; best = b; }
      }
      g.visible = !!best;
      if (!best) return;
      const t = performance.now() / 1000;
      g.position.set(best.pos.x, (best.hpY ?? 4) * 0.6, best.pos.z);
      const s = 2.2 + 0.6 * k;
      skull.scale.setScalar(s * (1 + 0.06 * Math.sin(t * (6 + k * 10))));
      ring.scale.setScalar(s * 2.1);
      ringMat.rotation = t * (1.5 + k * 6);
      skullMat.color.setRGB(1, 0.6 - k * 0.5, 0.6 - k * 0.5);
      ringMat.opacity = 0.5 + 0.4 * k;
    },
  };
}
