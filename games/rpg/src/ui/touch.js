// スマホ（横持ち）のタッチ操作
// 左：仮想スティック（どこを触ってもそこが中心。いっぱいに倒すとダッシュ）
// 右：ドラッグで視点。ボタン：攻撃（長押しで出し続ける・押したままドラッグで視点も動く）・回避・Q・E・R・調べる
// 上：ポーズ・視点切り替え・全画面
// shared/input.js（共通の契約）は触らず、ここで「押された」をまとめて game.js の readIntent に渡す
import { esc } from '../util.js';
import { GAUGE } from '../data/jobs.js';

/** タッチ端末か（?touch を付けると PC でもマウスで試せる） */
export function isTouchDevice() {
  if (new URLSearchParams(location.search).has('touch')) return true;
  return matchMedia('(hover: none) and (pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(hover: hover)').matches);
}

const STICK_R = 56; // スティックが動ける半径（px）
const DASH_AT = 0.92; // ここまで倒すとダッシュ
const LOOK_SENS = 1.5; // 視点ドラッグの感度（マウス1px と比べた倍率）

/**
 * @param {object} o { onPause(), onView(), allowMouse }
 */
export function createTouch({ onPause, onView, allowMouse = false }) {
  document.body.classList.add('rpg-touch-on');
  const root = document.createElement('div');
  root.className = 'rpg-touch';
  root.innerHTML = `
    <div class="rt-look"></div>
    <div class="rt-stick"><div class="rt-base"></div><div class="rt-knob"></div></div>
    <button type="button" class="rt-btn rt-atk" data-k="attack">攻撃</button>
    <button type="button" class="rt-btn rt-dodge" data-k="dodge">回避</button>
    <button type="button" class="rt-btn rt-q" data-k="skillQ"><b>Q</b><span></span><i></i></button>
    <button type="button" class="rt-btn rt-e" data-k="skillE"><b>E</b><span></span><i></i></button>
    <button type="button" class="rt-btn rt-r" data-k="skillR"><b>R</b><span></span><i></i><u></u></button>
    <button type="button" class="rt-btn rt-f" data-k="interact">調べる</button>
    <div class="rt-top">
      <button type="button" class="rt-mini" data-a="view">視点</button>
      ${document.fullscreenEnabled ? '<button type="button" class="rt-mini" data-a="full">全画面</button>' : ''}
      <button type="button" class="rt-mini" data-a="pause">Ⅱ</button>
    </div>`;
  document.body.appendChild(root);
  const rotate = document.createElement('div');
  rotate.className = 'rpg-rotate';
  rotate.innerHTML = '<div>📱↻<br>スマホを<b>横向き</b>にしてください</div>';
  document.body.appendChild(rotate);

  const st = { mx: 0, my: 0, dash: false, attack: false, lookDx: 0, lookDy: 0, pressed: new Set() };
  const stick = root.querySelector('.rt-stick');
  const base = root.querySelector('.rt-base');
  const knob = root.querySelector('.rt-knob');
  const btn = (k) => root.querySelector(`[data-k="${k}"]`);
  const ok = (e) => allowMouse || e.pointerType !== 'mouse';

  // ---- スティック（左側のどこからでも始められる） ----
  let stickId = null;
  let cx = 0;
  let cy = 0;
  function stickMove(x, y) {
    let dx = x - cx;
    let dy = y - cy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx *= STICK_R / len;
      dy *= STICK_R / len;
    }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    st.mx = dx / STICK_R;
    st.my = -dy / STICK_R;
    // 小さな遊び（ほんの少し触れただけでは歩かない）
    if (Math.hypot(st.mx, st.my) < 0.15) st.mx = st.my = 0;
    st.dash = Math.hypot(st.mx, st.my) >= DASH_AT;
    stick.classList.toggle('dash', st.dash);
  }
  function stickEnd() {
    stickId = null;
    st.mx = st.my = 0;
    st.dash = false;
    stick.classList.remove('on', 'dash');
    knob.style.transform = '';
    stick.style.left = stick.style.top = '';
  }

  // ---- 視点（ボタン以外の右側。攻撃ボタンを押したままのドラッグでも動く） ----
  const looks = new Map(); // pointerId → {x, y}
  function lookStart(e) {
    looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function lookMove(e) {
    const l = looks.get(e.pointerId);
    if (!l) return;
    st.lookDx += (e.clientX - l.x) * LOOK_SENS;
    st.lookDy += (e.clientY - l.y) * LOOK_SENS;
    l.x = e.clientX;
    l.y = e.clientY;
  }

  // 画面全体（.rt-look）：左側ならスティック、右側なら視点
  const look = root.querySelector('.rt-look');
  look.addEventListener('pointerdown', (e) => {
    if (!ok(e)) return;
    e.preventDefault();
    try { look.setPointerCapture(e.pointerId); } catch { /* 取れなくても動く */ }
    if (stickId === null && e.clientX < innerWidth * 0.42) {
      stickId = e.pointerId;
      cx = e.clientX;
      cy = e.clientY;
      stick.classList.add('on');
      stick.style.left = `${cx}px`;
      stick.style.top = `${cy}px`;
      stickMove(cx, cy);
    } else lookStart(e);
  });
  look.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) stickMove(e.clientX, e.clientY);
    else lookMove(e);
  });
  const lookUp = (e) => {
    if (e.pointerId === stickId) stickEnd();
    looks.delete(e.pointerId);
  };
  look.addEventListener('pointerup', lookUp);
  look.addEventListener('pointercancel', lookUp);

  // ---- ボタン ----
  for (const el of root.querySelectorAll('.rt-btn')) {
    const k = el.dataset.k;
    el.addEventListener('pointerdown', (e) => {
      if (!ok(e)) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* 取れなくても動く */ }
      el.classList.add('down');
      st.pressed.add(k);
      if (k === 'attack') {
        st.attack = true;
        lookStart(e); // 押したままドラッグで狙いを動かせる
      }
    });
    el.addEventListener('pointermove', (e) => { if (k === 'attack') lookMove(e); });
    const up = (e) => {
      el.classList.remove('down');
      if (k === 'attack') {
        st.attack = false;
        looks.delete(e.pointerId);
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  for (const el of root.querySelectorAll('.rt-mini')) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const a = el.dataset.a;
      if (a === 'pause') onPause?.();
      else if (a === 'view') onView?.();
      else if (a === 'full') {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
      }
    });
  }
  // ゲーム中に画面がスクロール・拡大しないように
  root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  let lastHtml = {};
  function setHtml(el, key, html) {
    if (lastHtml[key] === html) return;
    lastHtml[key] = html;
    el.innerHTML = html;
  }

  return {
    state: st,
    /** ゲーム中だけ出す（メニュー・会話・ポーズの間は消す） */
    setVisible(v) {
      root.style.display = v ? '' : 'none';
      if (!v) {
        stickEnd();
        looks.clear();
        st.attack = false;
        for (const el of root.querySelectorAll('.rt-btn.down')) el.classList.remove('down');
      }
    },
    /** ボタンにクールダウン・必殺ゲージ・調べられるかを映す（毎フレーム） */
    update(game, me) {
      if (!me) return;
      const J = me.job;
      const cdBtn = (k, key, sk, cd) => {
        const el = btn(k);
        el.classList.toggle('off', cd > 0);
        setHtml(el, k, `<b>${key}</b><span>${esc(sk.name)}</span>${cd > 0 ? `<i>${Math.ceil(cd)}</i>` : ''}`);
      };
      cdBtn('skillQ', 'Q', J.q, me.cd.q);
      cdBtn('skillE', 'E', J.e, me.cd.e);
      const r = btn('skillR');
      const used = J.r.oncePerRun && game.state.progress.usedOnce?.[J.r.id];
      const full = !used && me.gauge >= GAUGE.max;
      r.classList.toggle('off', !full);
      r.classList.toggle('ready', full);
      setHtml(r, 'skillR', `<b>R</b><span>${esc(J.r.name)}</span>${used ? '<i>済</i>' : ''}<u style="height:${used ? 0 : Math.min(100, me.gauge)}%"></u>`);
      btn('dodge').classList.toggle('off', me.dodgeCd > 0 || me.tired);
      const prompt = document.querySelector('.rpg-prompt');
      btn('interact').style.display = prompt && prompt.style.display === 'block' ? '' : 'none';
    },
    /** フレームの最後に：一度だけの入力と視点の移動量を消す */
    endFrame() {
      st.pressed.clear();
      st.lookDx = 0;
      st.lookDy = 0;
    },
  };
}
