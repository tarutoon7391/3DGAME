// スコアボード（画面上部中央）と中央の大きな告知テキスト（「ホームラン！」など）
const STYLE = `
.sp-board{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:12;pointer-events:none;
  font-family:system-ui,"Segoe UI","Hiragino Sans","Yu Gothic UI",sans-serif;color:#f0f4f8;
  background:#0d1117d9;border:1px solid #30363d;border-radius:10px;padding:6px 14px;font-size:15px;line-height:1.45;
  text-align:center;box-shadow:0 4px 18px #0007;white-space:nowrap}
.sp-board:empty{display:none}
.sp-board table{border-collapse:collapse;margin:0 auto}
.sp-board td,.sp-board th{padding:1px 7px;text-align:center}
.sp-board th{color:#9fb1c2;font-weight:normal;font-size:12px}
.sp-board .me{color:#7cc4ff}.sp-board .cpu{color:#ff8a80}
.sp-board .dim{color:#6e7f90}
.sp-call{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(1);z-index:13;pointer-events:none;
  font:900 clamp(32px,7vw,76px) system-ui,"Hiragino Sans","Yu Gothic UI",sans-serif;letter-spacing:.04em;
  text-shadow:0 4px 0 #0009,0 0 24px #000a;transition:opacity .25s,transform .25s;opacity:0;white-space:nowrap}
.sp-call.show{opacity:1;transform:translate(-50%,-50%) scale(1.06)}
.sp-sub{display:block;font-size:.32em;font-weight:700;letter-spacing:0;margin-top:6px;color:#f0f4f8}
.sp-meter{display:inline-block;width:140px;height:10px;border-radius:5px;background:#30363d;vertical-align:middle;overflow:hidden}
.sp-meter i{display:block;height:100%;background:linear-gradient(90deg,#3fb950,#ffd166,#ff6b6b)}
`;

let board = null;
let call = null;
let callTimer = 0;
let last = null;

function ensure() {
  if (board) return;
  const s = document.createElement('style');
  s.textContent = STYLE;
  document.head.appendChild(s);
  board = document.createElement('div');
  board.className = 'sp-board';
  document.body.appendChild(board);
  call = document.createElement('div');
  call.className = 'sp-call';
  document.body.appendChild(call);
}

/** スコアボードの中身を差し替え（同じ内容なら DOM を触らない）。空文字で非表示 */
export function setBoard(html) {
  ensure();
  if (html === last) return;
  last = html;
  board.innerHTML = html;
}

/**
 * 画面中央に大きく告知する
 * @param {string} text
 * @param {{color?:string, sub?:string, ms?:number}} [o]
 */
export function callout(text, { color = '#ffd166', sub = '', ms = 1400 } = {}) {
  ensure();
  clearTimeout(callTimer);
  call.style.color = color;
  call.innerHTML = '';
  call.append(text);
  if (sub) {
    const s = document.createElement('span');
    s.className = 'sp-sub';
    s.textContent = sub;
    call.appendChild(s);
  }
  call.classList.add('show');
  callTimer = setTimeout(() => call.classList.remove('show'), ms);
}

export function clearCallout() {
  ensure();
  clearTimeout(callTimer);
  call.classList.remove('show');
}

/** HUD 用のゲージ HTML（0〜1） */
export function meter(v) {
  const p = Math.round(Math.max(0, Math.min(1, v)) * 100);
  return `<span class="sp-meter"><i style="width:${p}%"></i></span>`;
}
