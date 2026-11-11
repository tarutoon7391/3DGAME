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

/** 音符（♪ 1つ・♫ 2つつながり）。kind：'one' / 'two' */
export function noteTexture(kind = 'one') {
  return make('note:' + kind, 128, 128, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    c.fillStyle = '#fff';
    c.shadowColor = 'rgba(255,255,255,0.9)';
    c.shadowBlur = R * 0.15;
    const head = (x, y) => {
      c.beginPath();
      c.ellipse(x, y, R * 0.24, R * 0.17, -0.45, 0, Math.PI * 2);
      c.fill();
    };
    if (kind === 'two') {
      head(-R * 0.38, R * 0.45);
      head(R * 0.32, R * 0.32);
      c.fillRect(-R * 0.2, -R * 0.62, R * 0.09, R * 1.07);
      c.fillRect(R * 0.5, -R * 0.75, R * 0.09, R * 1.07);
      c.beginPath();
      c.moveTo(-R * 0.2, -R * 0.62);
      c.lineTo(R * 0.59, -R * 0.75);
      c.lineTo(R * 0.59, -R * 0.55);
      c.lineTo(-R * 0.2, -R * 0.42);
      c.closePath();
      c.fill();
    } else {
      head(-R * 0.1, R * 0.45);
      c.fillRect(R * 0.1, -R * 0.7, R * 0.09, R * 1.15);
      c.beginPath();
      c.moveTo(R * 0.19, -R * 0.7);
      c.quadraticCurveTo(R * 0.6, -R * 0.45, R * 0.42, -R * 0.05);
      c.quadraticCurveTo(R * 0.45, -R * 0.4, R * 0.19, -R * 0.45);
      c.closePath();
      c.fill();
    }
  });
}

/** 五線譜：横に5本の線（輪に巻くと楽譜の輪になる）。u 方向に繰り返して使う */
export function staffTexture() {
  return make('staff', 256, 64, (c, w, h) => {
    c.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) c.fillRect(0, h * (0.14 + i * 0.18), w, h * 0.045);
    // 小節の縦線
    c.fillRect(w * 0.98, h * 0.14, w * 0.012, h * 0.765);
  });
}

/** 六角の網目（盾の壁）。縁は明るく */
export function hexGridTexture() {
  return make('hexgrid', 256, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0.15)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineWidth = 3;
    const s = 22;
    for (let row = -1; row < h / (s * 1.5) + 1; row++) {
      for (let col = -1; col < w / (s * Math.sqrt(3)) + 1; col++) {
        const cx = col * s * Math.sqrt(3) + (row % 2 ? (s * Math.sqrt(3)) / 2 : 0);
        const cy = row * s * 1.5;
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
          c.lineTo(cx + Math.cos(a) * s * 0.92, cy + Math.sin(a) * s * 0.92);
        }
        c.closePath();
        c.stroke();
      }
    }
    // 上下の縁
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, 6);
    c.fillRect(0, h - 6, w, 6);
  });
}

/** ドクロ（正面）。白で描き、目と鼻と歯のすき間は抜く */
export function skullTexture() {
  return make('skull', 128, 128, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    c.shadowColor = 'rgba(255,255,255,0.8)';
    c.shadowBlur = R * 0.12;
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(0, -R * 0.12, R * 0.62, Math.PI * 0.9, Math.PI * 2.1);
    c.lineTo(R * 0.42, R * 0.38);
    c.lineTo(R * 0.36, R * 0.72);
    c.lineTo(-R * 0.36, R * 0.72);
    c.lineTo(-R * 0.42, R * 0.38);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
    c.globalCompositeOperation = 'destination-out';
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(s * R * 0.24, -R * 0.05, R * 0.16, R * 0.19, s * 0.2, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.moveTo(0, R * 0.14);
    c.lineTo(R * 0.08, R * 0.3);
    c.lineTo(-R * 0.08, R * 0.3);
    c.closePath();
    c.fill();
    for (let i = -2; i <= 2; i++) c.fillRect(i * R * 0.14 - R * 0.02, R * 0.48, R * 0.04, R * 0.24);
  });
}

/** 時計の文字盤（輪・12の目盛り・中心） */
export function clockFaceTexture() {
  return make('clockface', 256, 256, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(-R, -R, w, w);
    c.strokeStyle = '#fff';
    c.lineWidth = R * 0.07;
    c.beginPath();
    c.arc(0, 0, R * 0.82, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = R * 0.025;
    c.beginPath();
    c.arc(0, 0, R * 0.7, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#fff';
    for (let i = 0; i < 12; i++) {
      c.save();
      c.rotate((i / 12) * Math.PI * 2);
      const big = i % 3 === 0;
      c.fillRect(-R * (big ? 0.035 : 0.02), -R * 0.68, R * (big ? 0.07 : 0.04), R * (big ? 0.16 : 0.09));
      c.restore();
    }
    c.beginPath();
    c.arc(0, 0, R * 0.07, 0, Math.PI * 2);
    c.fill();
  });
}

/** 時計の針（中心から上へ）。kind：'hour' 太く短い／'min' 細く長い */
export function clockHandTexture(kind = 'min') {
  return make('hand:' + kind, 256, 256, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    c.fillStyle = '#fff';
    c.shadowColor = 'rgba(255,255,255,0.9)';
    c.shadowBlur = R * 0.06;
    const len = kind === 'hour' ? 0.42 : 0.62;
    const wd = kind === 'hour' ? 0.07 : 0.04;
    c.beginPath();
    c.moveTo(-R * wd, R * 0.08);
    c.lineTo(R * wd, R * 0.08);
    c.lineTo(R * wd * 0.4, -R * len);
    c.lineTo(0, -R * (len + 0.06));
    c.lineTo(-R * wd * 0.4, -R * len);
    c.closePath();
    c.fill();
  });
}

/** 吸い込む風：斜めの筋の模様（繰り返して貼り、ずらして流す） */
export function windTexture() {
  return make('wind', 128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.strokeStyle = g;
      c.lineWidth = 5 + (i % 3) * 3;
      c.beginPath();
      const x = (i / 6) * w;
      c.moveTo(x, 0);
      c.bezierCurveTo(x + w * 0.25, h * 0.33, x - w * 0.1, h * 0.66, x + w * 0.2, h);
      c.stroke();
    }
  });
}

/** 花びら（剣の舞） */
export function petalTexture() {
  return make('petal', 64, 64, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    const g = c.createLinearGradient(0, -R, 0, R);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0.7)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, R * 0.85);
    c.bezierCurveTo(R * 0.9, R * 0.3, R * 0.6, -R * 0.7, R * 0.1, -R * 0.75);
    c.lineTo(0, -R * 0.55);
    c.lineTo(-R * 0.1, -R * 0.75);
    c.bezierCurveTo(-R * 0.6, -R * 0.7, -R * 0.9, R * 0.3, 0, R * 0.85);
    c.fill();
  });
}

/** 歪んだ音符（不協和音）：ぎざぎざに欠けた音符。普通の重ね方で暗い色に塗る */
export function brokenNoteTexture(seed = 1) {
  return make('bnote:' + seed, 128, 128, (c, w) => {
    const R = w / 2;
    let s = seed * 97;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    c.translate(R, R);
    c.rotate((rnd() - 0.5) * 0.9);
    c.fillStyle = '#fff';
    // ゆがんだ玉
    c.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rr = R * (0.2 + rnd() * 0.12);
      c.lineTo(-R * 0.1 + Math.cos(a) * rr * 1.3, R * 0.42 + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
    // 折れ曲がった棒
    c.beginPath();
    c.moveTo(R * 0.12, R * 0.4);
    c.lineTo(R * 0.2, -R * 0.05);
    c.lineTo(R * 0.05, -R * 0.2);
    c.lineTo(R * 0.22, -R * 0.7);
    c.lineTo(R * 0.3, -R * 0.68);
    c.lineTo(R * 0.15, -R * 0.2);
    c.lineTo(R * 0.3, -R * 0.05);
    c.lineTo(R * 0.2, R * 0.4);
    c.closePath();
    c.fill();
    // ぎざぎざの旗
    c.beginPath();
    c.moveTo(R * 0.26, -R * 0.68);
    for (let i = 1; i <= 5; i++) c.lineTo(R * (0.26 + i * 0.08), -R * (0.68 - i * 0.09) + (i % 2 ? R * 0.1 : 0));
    c.lineTo(R * 0.3, -R * 0.4);
    c.closePath();
    c.fill();
    // 欠け
    c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      const x = (rnd() - 0.5) * R;
      const y = (rnd() - 0.2) * R;
      c.moveTo(x, y);
      c.lineTo(x + R * 0.25, y + R * 0.05);
      c.lineTo(x + R * 0.05, y + R * 0.12);
      c.closePath();
      c.fill();
    }
  });
}

/** 盾のマーク（守りの結界の輪に並べる）：盾の形に縁どりと十字 */
export function shieldIconTexture() {
  return make('shieldIcon', 128, 128, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    const path = () => {
      c.beginPath();
      c.moveTo(0, -R * 0.82);
      c.quadraticCurveTo(R * 0.45, -R * 0.62, R * 0.72, -R * 0.66);
      c.quadraticCurveTo(R * 0.78, R * 0.25, 0, R * 0.86);
      c.quadraticCurveTo(-R * 0.78, R * 0.25, -R * 0.72, -R * 0.66);
      c.quadraticCurveTo(-R * 0.45, -R * 0.62, 0, -R * 0.82);
      c.closePath();
    };
    path();
    const g = c.createLinearGradient(0, -R, 0, R);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0.35)');
    c.fillStyle = g;
    c.fill();
    c.lineWidth = R * 0.12;
    c.strokeStyle = 'rgba(255,255,255,1)';
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,1)';
    c.fillRect(-R * 0.07, -R * 0.5, R * 0.14, R * 1.0);
    c.fillRect(-R * 0.38, -R * 0.2, R * 0.76, R * 0.14);
  });
}

/** コインのマーク（大盤振る舞いの輪に並べる）：縁・内側の輪・まん中の「G」 */
export function coinIconTexture() {
  return make('coinIcon', 128, 128, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.arc(0, 0, R * 0.9, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = R * 0.12;
    c.strokeStyle = 'rgba(255,255,255,1)';
    c.stroke();
    c.lineWidth = R * 0.05;
    c.beginPath();
    c.arc(0, 0, R * 0.66, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,1)';
    c.font = `bold ${Math.round(R * 0.95)}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('G', 0, R * 0.04);
  });
}

/** やわらかい煙のかたまり（煙玉）：ふちがもやもやした丸 */
export function smokeTexture() {
  return make('smoke', 128, 128, (c, w) => {
    const R = w / 2;
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 9; i++) {
      const x = R + (rnd() - 0.5) * R * 0.7;
      const y = R + (rnd() - 0.5) * R * 0.7;
      const r = R * (0.35 + rnd() * 0.3);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, w);
    }
  });
}
