// 設定（右上の ⚙ ボタン。タイトル・メニュー・遊んでいる間ずっと出ている）
// 音量（全体・BGM・効果音）とミュート、視点の感度（マウス／タッチ）をまとめて変えられる。セーブの settings.opts に残す
import { VIEW } from '../data/view.js';

export const DEFAULT_OPTS = { master: 0.8, bgm: 0.7, se: 0.8, mute: false, sens: 1, touchSens: 1 };

/**
 * @param {object} o
 *   settings：セーブの settings（opts を読み書き）, save()：保存
 *   sound：src/sound.js（setVolume）, touch：スマホ操作か
 *   onOpen()：開いたとき（遊んでいる間ならポーズする）
 */
export function createSettings({ settings, save, sound, touch, onOpen }) {
  const opts = { ...DEFAULT_OPTS, ...(settings.opts || {}) };
  let open = false;

  function apply() {
    sound.setVolume({ master: opts.master, bgm: opts.bgm, se: opts.se, mute: opts.mute });
    VIEW.sensMul = opts.sens; // camera.js がマウスの動きに掛ける
    VIEW.touchSensMul = opts.touchSens; // ui/touch.js が視点ドラッグに掛ける
    gear.textContent = opts.mute ? '🔇' : '⚙';
    gear.classList.toggle('muted', opts.mute);
  }
  function store() {
    settings.opts = { ...opts };
    save();
  }

  const gear = document.createElement('button');
  gear.type = 'button';
  gear.className = 'rpg-gear';
  gear.title = '設定（音量・感度）';
  gear.setAttribute('aria-label', '設定');
  document.body.appendChild(gear);

  const panel = document.createElement('div');
  panel.className = 'rpg-settings';
  panel.hidden = true;
  document.body.appendChild(panel);

  const pct = (v) => `${Math.round(v * 100)}%`;
  const slider = (key, label, min, max, step, fmt) => `
    <label class="rpg-set-row"><span>${label}</span>
      <input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${opts[key]}" ${key !== 'sens' && key !== 'touchSens' && opts.mute ? 'disabled' : ''}>
      <b data-v="${key}">${fmt(opts[key])}</b></label>`;
  function render() {
    const x = (v) => `×${(+v).toFixed(1)}`;
    panel.innerHTML = `<div class="rpg-set-box" role="dialog" aria-label="設定">
      <div class="rpg-set-head"><b>⚙ 設定</b><button type="button" class="rpg-set-x" data-act="close" aria-label="閉じる">✕</button></div>
      <div class="rpg-set-sec">音量</div>
      <label class="rpg-set-row rpg-set-mute"><span>ミュート</span>
        <button type="button" class="rpg-toggle ${opts.mute ? 'on' : ''}" data-act="mute">${opts.mute ? '🔇 ミュート中' : '🔊 鳴らす'}</button></label>
      ${slider('master', '全体', 0, 1, 0.05, pct)}
      ${slider('bgm', 'BGM', 0, 1, 0.05, pct)}
      ${slider('se', '効果音', 0, 1, 0.05, pct)}
      <div class="rpg-set-sec">視点の感度</div>
      ${touch ? slider('touchSens', 'タッチ', 0.3, 3, 0.1, x) : slider('sens', 'マウス', 0.3, 3, 0.1, x)}
      <div class="rpg-set-foot">
        <button type="button" class="rpg-b rpg-b-plain" data-act="reset">初期値に戻す</button>
        <button type="button" class="rpg-b rpg-b-main" data-act="close">閉じる</button>
      </div>
    </div>`;
  }

  function show() {
    if (open) return;
    open = true;
    render();
    panel.hidden = false;
    onOpen?.();
  }
  function hide() {
    if (!open) return;
    open = false;
    panel.hidden = true;
  }

  gear.addEventListener('click', (e) => {
    e.stopPropagation();
    open ? hide() : show();
  });
  panel.addEventListener('input', (e) => {
    const k = e.target.dataset?.k;
    if (!k) return;
    opts[k] = Number(e.target.value);
    const v = panel.querySelector(`[data-v="${k}"]`);
    if (v) v.textContent = k === 'sens' || k === 'touchSens' ? `×${opts[k].toFixed(1)}` : pct(opts[k]);
    apply();
    if (k === 'se') sound.se('hit'); // 効果音の大きさを試し聞き
  });
  panel.addEventListener('change', () => store()); // つまみを離したときに保存
  panel.addEventListener('click', (e) => {
    if (e.target === panel) return hide(); // 外側を押したら閉じる
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') hide();
    else if (act === 'mute') {
      opts.mute = !opts.mute;
      apply();
      store();
      render();
    } else if (act === 'reset') {
      Object.assign(opts, DEFAULT_OPTS);
      apply();
      store();
      render();
    }
  });
  // Esc で閉じる（ゲームの Esc＝ポーズより先に受け取る）
  window.addEventListener('keydown', (e) => {
    if (open && e.code === 'Escape') {
      e.stopImmediatePropagation();
      hide();
    }
  }, true);

  apply();
  return {
    isOpen: () => open,
    show,
    hide,
    /** M キーなどでミュートを切り替える */
    toggleMute() {
      opts.mute = !opts.mute;
      apply();
      store();
      if (open) render();
      return opts.mute;
    },
  };
}
