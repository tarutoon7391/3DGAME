// ゲーム固有の画面表示：照準・ボスHPバー・警告・中央メッセージ・画面フラッシュ・コンボ・難易度選択
// （shared/ui.js の hud/トースト/タイトル等と併用。こちらは space 専用）
import { fmt } from './util.js';

const CSS = `
body.sp-playing, body.sp-playing canvas{cursor:none}
.sp-cross{position:fixed;left:0;top:0;width:36px;height:36px;margin:-18px 0 0 -18px;border:2px solid #7ff3ffd0;border-radius:50%;pointer-events:none;z-index:12;display:none;box-shadow:0 0 10px #3cf8,inset 0 0 6px #3cf6}
.sp-cross::before{content:'';position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#bff;border-radius:50%}
.sp-cross i{position:absolute;background:#7ff3ff;opacity:.8}
.sp-cross i:nth-child(1){left:16px;top:-9px;width:2px;height:8px}.sp-cross i:nth-child(2){left:16px;bottom:-9px;width:2px;height:8px}
.sp-cross i:nth-child(3){top:16px;left:-9px;height:2px;width:8px}.sp-cross i:nth-child(4){top:16px;right:-9px;height:2px;width:8px}
.sp-boss{position:fixed;left:50%;top:16px;transform:translateX(-50%);width:min(520px,56vw);z-index:12;pointer-events:none;display:none;font:700 14px system-ui,sans-serif;color:#ffd0d8;text-align:center;text-shadow:0 1px 3px #000;letter-spacing:.08em}
.sp-boss .bar{height:10px;margin-top:5px;border:1px solid #ff6680;border-radius:5px;background:#200a10aa;overflow:hidden}
.sp-boss .fill{height:100%;width:100%;background:linear-gradient(90deg,#ff2d55,#ffb340);transition:width .15s}
.sp-warn{position:fixed;left:0;right:0;top:34%;z-index:13;pointer-events:none;text-align:center;display:none;color:#ff3355;font-family:system-ui,sans-serif;animation:spblink .5s steps(2) infinite}
.sp-warn b{display:block;font-size:68px;font-weight:900;letter-spacing:.25em;text-shadow:0 0 24px #f03}
.sp-warn span{display:block;font-size:18px;color:#ffc0c8;margin-top:6px;letter-spacing:.2em}
.sp-warn::before,.sp-warn::after{content:'';display:block;height:10px;margin:10px 0;background:repeating-linear-gradient(-45deg,#ff3355 0 14px,transparent 14px 28px);opacity:.8}
.sp-msg{position:fixed;left:0;right:0;top:28%;z-index:12;text-align:center;pointer-events:none;opacity:0;transition:opacity .4s;font-family:system-ui,sans-serif}
.sp-msg b{display:block;font-size:46px;font-weight:800;letter-spacing:.14em;color:#e8f6ff;text-shadow:0 0 18px #39f}
.sp-msg span{display:block;font-size:19px;color:#b5d2ef;margin-top:8px;text-shadow:0 1px 3px #000}
.sp-flash{position:fixed;inset:0;z-index:9;pointer-events:none;opacity:0}
.sp-combo{position:fixed;right:16px;top:58px;z-index:11;pointer-events:none;text-align:right;font-family:system-ui,sans-serif;text-shadow:0 1px 4px #000;display:none}
.sp-combo b{display:block;font-size:30px;font-weight:900;color:#ffe066}
.sp-combo span{font-size:13px;color:#ffd;letter-spacing:.1em}
.sp-combo .gauge{height:4px;margin-top:3px;background:#ffe066;border-radius:2px;margin-left:auto}
.sp-hint{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:11;pointer-events:none;font:12px system-ui,sans-serif;color:#9fb1c2cc;display:none;white-space:nowrap}
.sp-diff .g3-btn{min-width:150px;display:block;margin:8px auto}
.sp-diff small{display:block;font-size:.78rem;opacity:.8}
@keyframes spblink{50%{opacity:.35}}
`;

function el(tag, cls, html = '') {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  document.body.appendChild(e);
  return e;
}

export function createHud() {
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  const cross = el('div', 'sp-cross', '<i></i><i></i><i></i><i></i>');
  const boss = el('div', 'sp-boss', '<div class="nm"></div><div class="bar"><div class="fill"></div></div>');
  const bossName = boss.querySelector('.nm');
  const bossFill = boss.querySelector('.fill');
  const warn = el('div', 'sp-warn', '<b>WARNING</b><span>巨大な反応が接近中</span>');
  const msg = el('div', 'sp-msg', '<b></b><span></span>');
  const msgB = msg.querySelector('b');
  const msgS = msg.querySelector('span');
  const flashEl = el('div', 'sp-flash');
  const combo = el('div', 'sp-combo', '<span>COMBO</span><b></b><div class="gauge"></div>');
  const comboB = combo.querySelector('b');
  const comboG = combo.querySelector('.gauge');
  const hint = el('div', 'sp-hint', 'WASD 移動　マウス 照準　左クリック 射撃　右クリック/Shift ロール　Space ボム　Esc ポーズ　M 消音');

  let msgT = 0;
  let flashA = 0;
  let lastBoss = -1;
  let lastCombo = '';
  let diffEl = null;

  return {
    /** プレイ中表示（カーソル非表示・照準・操作ヒント） */
    setPlaying(on) {
      document.body.classList.toggle('sp-playing', on);
      cross.style.display = on ? 'block' : 'none';
      hint.style.display = on ? 'block' : 'none';
    },
    setCross(x, y) {
      cross.style.transform = `translate(${x}px,${y}px)`;
    },
    setBoss(name, ratio) {
      if (name == null) {
        boss.style.display = 'none';
        lastBoss = -1;
        return;
      }
      boss.style.display = 'block';
      bossName.textContent = name;
      const r = Math.round(ratio * 200) / 2;
      if (r !== lastBoss) {
        lastBoss = r;
        bossFill.style.width = r + '%';
      }
    },
    warning(on) {
      warn.style.display = on ? 'block' : 'none';
    },
    message(title, sub = '', secs = 2.5) {
      msgB.textContent = title;
      msgS.textContent = sub;
      msg.style.opacity = '1';
      msgT = secs;
    },
    flash(color, strength = 0.5) {
      flashEl.style.background = color;
      flashA = Math.max(flashA, strength);
    },
    /** コンボ表示。count<2 で非表示。ratio は残り時間ゲージ */
    setCombo(count, mult, ratio) {
      if (count < 2) {
        if (lastCombo !== '') combo.style.display = 'none';
        lastCombo = '';
        return;
      }
      const key = `${count}×${mult}`;
      if (key !== lastCombo) {
        lastCombo = key;
        combo.style.display = 'block';
        comboB.textContent = `${count} ×${mult}`;
      }
      comboG.style.width = Math.round(ratio * 120) + 'px';
    },
    update(dt) {
      if (msgT > 0) {
        msgT -= dt;
        if (msgT <= 0) msg.style.opacity = '0';
      }
      if (flashA > 0) {
        flashA = Math.max(0, flashA - dt * 2.5);
        flashEl.style.opacity = String(flashA);
      }
    },
    /** プレイ用の表示を全部隠す */
    reset() {
      this.setBoss(null);
      this.warning(false);
      this.setCombo(0);
      msg.style.opacity = '0';
      msgT = 0;
      flashA = 0;
      flashEl.style.opacity = '0';
    },
    get diffOpen() { return !!diffEl; },
    /** 難易度選択（shared のオーバーレイと同じ見た目） */
    chooseDifficulty({ list, current, highs, onPick, onBack }) {
      this.closeDifficulty();
      diffEl = document.createElement('div');
      diffEl.className = 'g3-overlay sp-diff';
      const panel = document.createElement('div');
      panel.className = 'g3-panel';
      panel.innerHTML = '<h2>難易度をえらぶ</h2><p>敵弾の速さと出現量が変わります</p>';
      let focus = null;
      list.forEach((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'g3-btn' + (d.key === current ? '' : ' sub');
        b.innerHTML = `${d.label}<small>${d.desc}／ハイスコア ${fmt(highs[d.key] || 0)}</small>`;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeDifficulty();
          onPick(d.key);
        });
        panel.appendChild(b);
        if (d.key === current) focus = b;
      });
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'g3-btn sub';
      back.textContent = 'もどる';
      back.style.marginTop = '14px';
      back.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeDifficulty();
        onBack();
      });
      panel.appendChild(back);
      diffEl.appendChild(panel);
      document.body.appendChild(diffEl);
      focus?.focus();
    },
    closeDifficulty() {
      if (diffEl) diffEl.remove();
      diffEl = null;
    },
  };
}
