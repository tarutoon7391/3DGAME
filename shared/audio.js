// 共通サウンド：WebAudio による合成音（外部音源は使わない／凍結対象の契約）

/**
 * サウンドを作る。AudioContext はブラウザ制約のため初回クリック／キー入力で開始する。
 * 開始前に鳴らした音は無視される（エラーにはならない）。
 */
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let noiseBuf = null;
  let bgm = null; // { timer, stop }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    return ctx;
  }

  // 初回のユーザー操作で開始
  const unlock = () => {
    ensure();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  function ready() {
    return ctx && ctx.state === 'running';
  }

  /**
   * 単音を鳴らす。
   * @param {{freq?:number, dur?:number, type?:OscillatorType, vol?:number, slide?:number, when?:number}} [o]
   *   slide: 終了時の周波数（ピッチを滑らせる）、when: 何秒後に鳴らすか
   */
  function beep({ freq = 440, dur = 0.1, type = 'square', vol = 0.2, slide, when = 0 } = {}) {
    if (!ready()) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /**
   * ノイズ（爆発・足音・打撃など）
   * @param {{dur?:number, vol?:number, filter?:number, when?:number}} [o] filter: ローパス周波数
   */
  function noise({ dur = 0.2, vol = 0.2, filter = 4000, when = 0 } = {}) {
    if (!ready()) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /**
   * 簡易BGM（音符列をループ再生）。再度呼ぶと前の曲は止まる。
   * @param {Array<{freq:number, dur:number, type?:OscillatorType, vol?:number}|{rest:number}>} notes
   *   freq が 0 か rest 指定の要素は休符
   * @param {{loop?:boolean, tempo?:number}} [opts] tempo: 再生速度倍率（1=等速）
   * @returns {() => void} 停止関数
   */
  function playSeq(notes, { loop = true, tempo = 1 } = {}) {
    stopSeq();
    if (!Array.isArray(notes) || notes.length === 0) return () => {};
    const total = notes.reduce((s, n) => s + (n.rest ?? n.dur ?? 0), 0) / tempo;
    let stopped = false;
    let timer = 0;

    const schedule = () => {
      if (stopped) return;
      if (ready()) {
        let off = 0;
        for (const n of notes) {
          const len = (n.rest ?? n.dur ?? 0) / tempo;
          if (!n.rest && n.freq) {
            beep({ freq: n.freq, dur: len * 0.9, type: n.type || 'triangle', vol: n.vol ?? 0.08, when: off });
          }
          off += len;
        }
      }
      if (loop && total > 0) timer = setTimeout(schedule, total * 1000);
    };
    schedule();

    const stop = () => {
      stopped = true;
      clearTimeout(timer);
    };
    bgm = { stop };
    return stop;
  }

  function stopSeq() {
    if (bgm) bgm.stop();
    bgm = null;
  }

  /** ミュート切替（引数省略でトグル）。戻り値は切替後の状態 */
  function setMuted(v = !muted) {
    muted = !!v;
    if (master) master.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
    return muted;
  }

  return {
    beep,
    noise,
    playSeq,
    stopSeq,
    setMuted,
    get muted() { return muted; },
    /** 生の AudioContext（未開始なら null） */
    get ctx() { return ctx; },
  };
}
