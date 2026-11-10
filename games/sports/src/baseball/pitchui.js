// 投球選択パネル（DOM）：球種3つとコース 3×3。操作はコマンドとしてキューに積む
import { PITCHES } from './pitch.js';

const STYLE = `
.bb-panel{position:fixed;right:16px;bottom:16px;z-index:12;padding:12px 14px;border-radius:12px;background:#0d1117e6;
  border:1px solid #30363d;color:#f0f4f8;font:14px system-ui,"Hiragino Sans","Yu Gothic UI",sans-serif;text-align:center}
.bb-panel p{margin:0 0 6px;color:#9fb1c2;font-size:12px}
.bb-types{display:flex;gap:6px;margin-bottom:10px}
.bb-types button{font:inherit;padding:6px 10px;border-radius:8px;border:1px solid #30363d;background:#161b22;color:#c9d1d9;cursor:pointer}
.bb-types button.on{background:#1f6feb;border-color:#58a6ff;color:#fff}
.bb-grid{display:grid;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(3,52px);gap:3px;margin:0 auto;width:max-content;
  padding:6px;border-radius:8px;background:#ffffff10;outline:2px dashed #ffffff40;outline-offset:-30px}
.bb-grid button{border:1px solid #ffffff30;background:#ffffff14;border-radius:6px;cursor:pointer;color:#fff;font:12px system-ui}
.bb-grid button:hover{background:#ffd16688;border-color:#ffd166}
`;

export function createPitchPanel() {
  const queue = [];
  let type = 0;
  const s = document.createElement('style');
  s.textContent = STYLE;
  document.head.appendChild(s);
  const el = document.createElement('div');
  el.className = 'bb-panel';
  el.innerHTML = '<p>球種（1/2/3 キーでも可）</p><div class="bb-types"></div><p>コースをクリックして投球（点線＝ゾーンの縁）</p><div class="bb-grid"></div>';
  const types = el.querySelector('.bb-types');
  const grid = el.querySelector('.bb-grid');
  const typeBtns = PITCHES.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${i + 1} ${p.label}`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      queue.push({ kind: 'type', type: i });
    });
    types.appendChild(b);
    return b;
  });
  // 投手の後ろから見た画面に合わせて左右反転（画面の右に打者＝内角）
  for (let d = 0; d < 9; d++) {
    const c = Math.floor(d / 3) * 3 + (2 - (d % 3));
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ['内高', '高', '外高', '内', '真ん中', '外', '内低', '低', '外低'][c];
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      queue.push({ kind: 'pitch', cell: c });
    });
    grid.appendChild(b);
  }
  el.style.display = 'none';
  document.body.appendChild(el);

  return {
    /** 溜まったコマンドを取り出す */
    drain() {
      return queue.splice(0, queue.length);
    },
    setType(t) {
      type = t;
      typeBtns.forEach((b, i) => b.classList.toggle('on', i === type));
    },
    get type() {
      return type;
    },
    show(v) {
      el.style.display = v ? '' : 'none';
      if (!v) queue.length = 0;
    },
    dispose() {
      el.remove();
      s.remove();
    },
  };
}
