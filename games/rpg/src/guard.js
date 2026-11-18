// 止まらないようにする保険：毎フレームの処理を部品ごとに try で包み、どこか1か所でエラーが出ても
// ほかの部品（ほかのボス・弾・画面）はそのまま動かしつづける。エラーは画面の左下に小さく出し、コンソールにも残す
const seen = new Map(); // 部品名＋メッセージ → 回数
let box = null;
let lastShow = 0;

function notice(text) {
  if (!box) {
    box = document.createElement('div');
    box.className = 'rpg-errnote';
    document.body.appendChild(box);
  }
  box.textContent = text;
  box.hidden = false;
  clearTimeout(box.timer);
  box.timer = setTimeout(() => { box.hidden = true; }, 6000);
}

/** エラーを記録する（同じものは最初の1回だけコンソールへ。画面表示は10秒に1回まで） */
export function report(where, err) {
  const msg = `${where}: ${err?.message || err}`;
  const n = (seen.get(msg) || 0) + 1;
  seen.set(msg, n);
  if (n === 1) console.error(`[保険] ${msg}`, err);
  const now = performance.now();
  if (now - lastShow > 10000) {
    lastShow = now;
    notice(`⚠ エラーが出ましたが、ゲームは続けています（${where}）`);
  }
}

/** fn をエラーから守って呼ぶ。エラーなら onError（立て直し）を呼ぶ */
export function guard(where, fn, onError) {
  try {
    return fn();
  } catch (err) {
    report(where, err);
    try {
      onError?.(err);
    } catch (e2) {
      report(`${where}（立て直し）`, e2);
    }
    return undefined;
  }
}

/** これまでのエラー（自動テスト・調べもの用） */
export const guardLog = () => [...seen.entries()].map(([msg, n]) => ({ msg, n }));
