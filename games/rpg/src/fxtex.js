// 技エフェクトの模様（canvas で描くテクスチャ。外部の画像は使わない）。白で描いて材質の色で塗る
import * as THREE from 'three';

const cache = new Map();
function make(key, w, h, draw) {
  let t = cache.get(key);
  if (t) return t;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** 斬撃：中心は透明、外側の縁ほど明るい（扇形に貼ると三日月の刃の軌跡になる） */
export function slashTexture() {
  return make('slash', 256, 256, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.94, 'rgba(255,255,255,1)');
    g.addColorStop(0.97, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  });
}

/** 光の筋：横方向に、片側（u=1）が濃く反対側に向かって消える（突進の残像など） */
export function streakTexture() {
  return make('streak', 128, 16, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // 縦方向は真ん中が濃い
    const v = c.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,1)');
    v.addColorStop(0.5, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  });
}

/** 当たったときの光：4本の光の筋と丸い芯 */
export function starTexture() {
  return make('star', 128, 128, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.45);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(-R, -R, w, w);
    c.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      c.save();
      c.rotate((i * Math.PI) / 2 + Math.PI / 4 * (i % 2 ? 0 : 0));
      c.beginPath();
      c.moveTo(0, -R * 0.98);
      c.lineTo(R * 0.07, 0);
      c.lineTo(0, R * 0.98);
      c.lineTo(-R * 0.07, 0);
      c.closePath();
      c.fill();
      c.restore();
    }
  });
}

/** 地面のひび割れ（着地・叩きつけ） */
export function crackTexture() {
  return make('crack', 256, 256, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    c.strokeStyle = '#fff';
    c.lineCap = 'round';
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 9; i++) {
      let a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
      let x = 0;
      let y = 0;
      c.lineWidth = R * 0.05;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        a += (rnd() - 0.5) * 0.8;
        const step = R * (0.12 + rnd() * 0.1);
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        c.lineTo(x, y);
        c.lineWidth *= 0.8;
      }
      c.stroke();
    }
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.35);
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(-R, -R, w, w);
  });
}

/** 魔法陣（呪い・召喚・印）：二重の輪と、間に並ぶ文字のような模様と、中の星形 */
export function sigilTexture() {
  return make('sigil', 512, 512, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    c.strokeStyle = '#fff';
    c.fillStyle = '#fff';
    c.lineWidth = R * 0.025;
    for (const r of [0.96, 0.8, 0.42]) {
      c.beginPath();
      c.arc(0, 0, R * r, 0, Math.PI * 2);
      c.stroke();
    }
    for (let i = 0; i < 20; i++) {
      c.save();
      c.rotate((i / 20) * Math.PI * 2);
      c.translate(0, -R * 0.88);
      const k = i % 4;
      if (k === 0) c.fillRect(-R * 0.012, -R * 0.05, R * 0.024, R * 0.1);
      else if (k === 1) {
        c.beginPath();
        c.arc(0, 0, R * 0.03, 0, Math.PI * 2);
        c.fill();
      } else if (k === 2) c.fillRect(-R * 0.04, -R * 0.012, R * 0.08, R * 0.024);
      else {
        c.beginPath();
        c.moveTo(0, -R * 0.045);
        c.lineTo(R * 0.035, R * 0.035);
        c.lineTo(-R * 0.035, R * 0.035);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    // 中の星形（五芒星）
    c.lineWidth = R * 0.02;
    c.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = (i * 2 * (Math.PI * 2)) / 5 - Math.PI / 2;
      c.lineTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78);
    }
    c.stroke();
  });
}
