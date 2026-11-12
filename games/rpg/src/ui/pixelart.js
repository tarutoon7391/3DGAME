// メニュー画面のレトロな見た目を作る道具（外部の画像・フォントは使わず、その場で canvas に描く）
// ・pixelText：文字を小さく描いてからにじみを消し、縁取り＋影をつけたドット文字にする（拡大は CSS の pixelated）
// ・installTextures：レンガ・草・土のタイルを描いて CSS 変数（--tx-brick など）に入れる

const cache = new Map();

/** 色 '#rrggbb' → [r,g,b] */
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * ドット文字の画像（canvas）を返す。表示サイズは px × scale。
 * @param {string} text
 * @param {object} o  px：元の文字の大きさ（ドット数）, scale：拡大率（整数）, top/bottom：上下の色（縦グラデ）, edge：縁の色, shadow：影の色（null で影なし）
 */
export function pixelText(text, { px = 12, scale = 2, top = '#fff6cf', bottom = '#ffc93c', edge = '#3a1d0c', shadow = '#00000066' } = {}) {
  const key = [text, px, top, bottom, edge, shadow].join('|');
  let src = cache.get(key);
  if (!src) {
    src = drawPixelText(text, px, top, bottom, edge, shadow);
    cache.set(key, src);
  }
  // 同じ絵を何度も出すので、キャッシュの canvas は写して使う
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  c.className = 'rpg-px';
  c.style.width = `${src.width * scale}px`;
  c.style.height = `${src.height * scale}px`;
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', text);
  return c;
}

function drawPixelText(text, px, top, bottom, edge, shadow) {
  const font = `bold ${px}px "Hiragino Sans","Yu Gothic UI","Meiryo",system-ui,sans-serif`;
  const m = document.createElement('canvas').getContext('2d');
  m.font = font;
  const w = Math.ceil(m.measureText(text).width) + 4;
  const h = Math.ceil(px * 1.25) + 4;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.font = font;
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.fillText(text, 1, h / 2);
  const src = g.getImageData(0, 0, w, h).data;
  // にじみを消して 0/1 の形にする
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = src[i * 4 + 3] > 120 ? 1 : 0;
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0);
  const out = g.createImageData(w, h);
  const d = out.data;
  const T = rgb(top);
  const B = rgb(bottom);
  const E = rgb(edge);
  const S = shadow ? rgb(shadow.slice(0, 7)) : null;
  const sa = shadow && shadow.length > 7 ? parseInt(shadow.slice(7), 16) : 255;
  const put = (i, col, a = 255) => { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = a; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (at(x, y)) {
        // 上は明るく下は濃い（昔のゲームの金文字ふう）
        const k = Math.min(1, Math.max(0, (y - 2) / (h - 4)));
        put(i, [0, 1, 2].map((j) => Math.round(T[j] + (B[j] - T[j]) * k)));
      } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1)) {
        put(i, E);
      } else if (S && (at(x - 2, y - 2) || at(x - 1, y - 2) || at(x - 2, y - 1))) {
        put(i, S, sa);
      }
    }
  }
  g.putImageData(out, 0, 0);
  return c;
}

/** 擬似乱数（毎回同じ模様にする） */
function rnd(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function tile(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  return `url(${c.toDataURL()})`;
}

/** レンガ（ダンジョンの壁） */
function brick(g, w, h, [base, light, dark, mortar], seed) {
  const r = rnd(seed);
  g.fillStyle = mortar;
  g.fillRect(0, 0, w, h);
  const bw = 16;
  const bh = 8;
  for (let row = 0; row < h / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < w / bw + 1; col++) {
      const x = col * bw + off;
      const y = row * bh;
      g.fillStyle = r() < 0.3 ? dark : r() < 0.3 ? light : base;
      g.fillRect(x + 1, y + 1, bw - 1, bh - 1);
      g.fillStyle = light; // 上の縁のハイライト
      g.fillRect(x + 1, y + 1, bw - 2, 1);
      g.fillStyle = dark; // 下の縁の影
      g.fillRect(x + 1, y + bh - 1, bw - 1, 1);
      if (r() < 0.35) { // ところどころ欠け
        g.fillStyle = mortar;
        g.fillRect(x + 2 + Math.floor(r() * (bw - 5)), y + 2 + Math.floor(r() * 4), 2, 1);
      }
    }
  }
}

/** 草（上に草のふち、下は土） */
function grass(g, w, h) {
  const r = rnd(7);
  g.fillStyle = '#5a9e2f';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = r() < 0.5 ? '#7cc243' : '#4a8a25';
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 2);
  }
  for (let i = 0; i < 6; i++) {
    g.fillStyle = '#a6e06a';
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
  }
}

let installed = false;
/** タイルを描いて CSS 変数に入れる（1回だけ） */
export function installTextures() {
  if (installed) return;
  installed = true;
  const s = document.documentElement.style;
  s.setProperty('--tx-brick', tile(32, 32, (g, w, h) => brick(g, w, h, ['#9a4f2c', '#bd6a3e', '#73381d', '#3b2014'], 3)));
  s.setProperty('--tx-brick-dark', tile(32, 32, (g, w, h) => brick(g, w, h, ['#5b3a2c', '#734b38', '#43281d', '#22140e'], 5)));
  s.setProperty('--tx-grass', tile(24, 24, grass));
}
