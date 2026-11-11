// オーラ・エリアの模様（canvas で描くテクスチャ。外部の画像は使わない）
// どれも白で描き、材質の色で塗る。1種類につき1枚だけ作って使い回す
import * as THREE from 'three';

const cache = new Map();

function make(key, w, h, draw) {
  let t = cache.get(key);
  if (t) return t;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  draw(ctx, w, h);
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** 地面の塗り：中心は薄く、縁ほど濃い円 */
export function fillTexture() {
  return make('fill', 256, 256, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.25)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.93, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  });
}

/** 縁から立ち上がる光の壁：下が濃く、上に向かって消える（円柱の側面に貼る） */
export function wallTexture() {
  return make('wall', 4, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}

// ---- 縁の内側を回る模様（1つの絵の中心から見て外向きに並べる） ----
const MOTIF = {
  cross(c, s) {
    c.fillRect(-s * 0.18, -s * 0.6, s * 0.36, s * 1.2);
    c.fillRect(-s * 0.6, -s * 0.18, s * 1.2, s * 0.36);
  },
  chevron(c, s) {
    c.beginPath();
    c.moveTo(-s * 0.6, s * 0.25);
    c.lineTo(0, -s * 0.4);
    c.lineTo(s * 0.6, s * 0.25);
    c.lineTo(s * 0.6, s * 0.6);
    c.lineTo(0, -s * 0.05);
    c.lineTo(-s * 0.6, s * 0.6);
    c.closePath();
    c.fill();
  },
  hex(c, s) {
    c.lineWidth = s * 0.18;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      c.lineTo(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55);
    }
    c.closePath();
    c.stroke();
  },
  spike(c, s) {
    c.beginPath();
    c.moveTo(-s * 0.35, s * 0.45);
    c.lineTo(0, -s * 0.7);
    c.lineTo(s * 0.35, s * 0.45);
    c.closePath();
    c.fill();
  },
  note(c, s) {
    c.beginPath();
    c.ellipse(-s * 0.12, s * 0.35, s * 0.26, s * 0.18, -0.4, 0, Math.PI * 2);
    c.fill();
    c.fillRect(s * 0.08, -s * 0.6, s * 0.1, s * 0.95);
    c.fillRect(s * 0.08, -s * 0.6, s * 0.38, s * 0.12);
  },
};

/** 回る模様：縁の内側に motif を n 個、外向きに並べる。内側に点線の輪 */
export function patternTexture(kind) {
  return make('pat:' + kind, 512, 512, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    c.fillStyle = '#fff';
    c.strokeStyle = '#fff';
    const n = kind === 'hex' ? 14 : 16;
    const size = R * 0.09;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      c.save();
      c.rotate(a);
      c.translate(0, -R * 0.84);
      MOTIF[kind](c, size);
      c.restore();
    }
    // 内側の点線の輪
    c.lineWidth = R * 0.012;
    c.setLineDash([R * 0.05, R * 0.04]);
    c.beginPath();
    c.arc(0, 0, R * 0.72, 0, Math.PI * 2);
    c.stroke();
  });
}

// ---- 真ん中に浮かぶマーク ----
const EMBLEM = {
  plus(c, s) {
    c.fillRect(-s * 0.16, -s * 0.55, s * 0.32, s * 1.1);
    c.fillRect(-s * 0.55, -s * 0.16, s * 1.1, s * 0.32);
  },
  arrow(c, s) {
    for (const dy of [-0.28, 0.22]) {
      c.save();
      c.translate(0, s * dy);
      MOTIF.chevron(c, s * 0.85);
      c.restore();
    }
  },
  shield(c, s) {
    c.beginPath();
    c.moveTo(0, -s * 0.6);
    c.lineTo(s * 0.5, -s * 0.42);
    c.quadraticCurveTo(s * 0.5, s * 0.3, 0, s * 0.62);
    c.quadraticCurveTo(-s * 0.5, s * 0.3, -s * 0.5, -s * 0.42);
    c.closePath();
    c.fill();
  },
  note(c, s) {
    MOTIF.note(c, s * 1.1);
  },
};

/** 浮かぶマーク：光るふちどりつき（スプライトに貼る） */
export function emblemTexture(kind) {
  return make('emb:' + kind, 128, 128, (c, w) => {
    const R = w / 2;
    c.translate(R, R);
    // うっすら丸い台座
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(-R, -R, w, w);
    c.shadowColor = 'rgba(255,255,255,0.9)';
    c.shadowBlur = R * 0.25;
    c.fillStyle = '#fff';
    EMBLEM[kind](c, R * 0.75);
  });
}
