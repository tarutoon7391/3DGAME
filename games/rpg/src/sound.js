// 効果音とエリア別 BGM（WebAudio 合成。shared/audio.js を使う）

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C4' 'F#3' 'Bb4' → 周波数 */
function hz(n) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(n);
  let k = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + k;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
/** 'C4:1 E4:1 -:2' 形式（数字は拍）を playSeq の配列に */
function seq(str, beat, type, vol) {
  return str.trim().split(/\s+/).map((tok) => {
    const [n, l] = tok.split(':');
    const dur = Number(l || 1) * beat;
    return n === '-' ? { rest: dur } : { freq: hz(n), dur, type, vol };
  });
}

const BGM = {
  village: seq('E4:1 G4:1 A4:2 G4:1 E4:1 D4:2 C4:1 D4:1 E4:1 G4:1 A4:3 -:1 A4:1 C5:1 D5:2 C5:1 A4:1 G4:2 E4:1 G4:1 A4:1 G4:1 E4:3 -:1', 0.3, 'triangle', 0.06),
  field: seq('A4:1 C5:1 E5:1 C5:1 D5:1 B4:1 G4:2 A4:1 C5:1 E5:1 G5:1 E5:3 -:1 F5:1 E5:1 D5:1 C5:1 B4:1 C5:1 D5:2 E5:1 C5:1 A4:1 B4:1 A4:3 -:1', 0.2, 'square', 0.035),
  dungeon: seq('A3:2 C4:2 B3:2 E3:2 A3:2 C4:2 D4:2 -:2 F3:2 A3:2 G#3:2 E3:2 A3:4 -:4', 0.32, 'triangle', 0.07),
  boss: seq('A3:1 A3:1 C4:1 A3:1 D#4:1 D4:1 C4:1 A3:1 G3:1 G3:1 Bb3:1 G3:1 D4:1 C#4:1 C4:1 G3:1', 0.14, 'sawtooth', 0.04),
  castle: seq('D3:2 F3:2 A3:2 C#4:2 D4:2 A3:2 Bb3:2 -:2 G3:2 Bb3:2 A3:2 F3:2 E3:2 C#3:2 D3:4 -:2', 0.3, 'triangle', 0.07),
  lastboss: seq('D3:1 D4:1 D3:1 C4:1 D3:1 Bb3:1 D3:1 A3:1 G3:1 G4:1 G3:1 F4:1 A3:1 E4:1 C#4:1 A3:1', 0.12, 'sawtooth', 0.045),
  clear: seq('C5:1 E5:1 G5:1 C6:3 G5:1 C6:4', 0.16, 'square', 0.06),
};

/**
 * 音量：全体（master）・BGM・効果音（se）は 0〜1。mute で全部消す（設定画面 src/ui/settings.js から変える）
 * shared/audio.js は音量を持たないので、鳴らすときの vol に掛けて調整する
 */
export function createSound(audio) {
  let current = '';
  const vol = { master: 0.8, bgm: 0.7, se: 0.8, mute: false };
  const seK = () => (vol.mute ? 0 : vol.master * vol.se);
  const bgmK = () => (vol.mute ? 0 : vol.master * vol.bgm);
  // 効果音用：vol を掛けてから鳴らす（0 なら鳴らさない）
  const A = {
    beep: (o = {}) => { const k = seK(); if (k > 0.001) audio.beep({ ...o, vol: (o.vol ?? 0.2) * k }); },
    noise: (o = {}) => { const k = seK(); if (k > 0.001) audio.noise({ ...o, vol: (o.vol ?? 0.2) * k }); },
  };
  /** BGM を今の音量で鳴らし直す */
  function playBgm(name) {
    audio.stopSeq();
    const k = bgmK();
    if (!name || !BGM[name] || k <= 0.001) return;
    audio.playSeq(BGM[name].map((n) => (n.rest ? n : { ...n, vol: n.vol * k })), { loop: name !== 'clear' });
  }

  const SE = {
    swing: () => A.noise({ dur: 0.09, vol: 0.12, filter: 2500 }),
    hit: () => { A.beep({ freq: 220, dur: 0.08, type: 'square', vol: 0.14, slide: 90 }); A.noise({ dur: 0.07, vol: 0.18, filter: 1800 }); },
    crit: () => { A.beep({ freq: 330, dur: 0.12, type: 'sawtooth', vol: 0.14, slide: 110 }); A.noise({ dur: 0.12, vol: 0.22, filter: 1500 }); },
    hurt: () => { A.beep({ freq: 180, dur: 0.18, type: 'sawtooth', vol: 0.16, slide: 70 }); },
    dodge: () => A.noise({ dur: 0.16, vol: 0.1, filter: 900 }),
    spin: () => { A.beep({ freq: 300, dur: 0.3, type: 'sawtooth', vol: 0.1, slide: 900 }); A.noise({ dur: 0.3, vol: 0.12, filter: 3000 }); },
    wave: () => A.beep({ freq: 900, dur: 0.35, type: 'sawtooth', vol: 0.1, slide: 200 }),
    shoot: () => A.beep({ freq: 620, dur: 0.12, type: 'triangle', vol: 0.08, slide: 300 }),
    windup: () => A.beep({ freq: 140, dur: 0.25, type: 'square', vol: 0.05, slide: 260 }),
    die: () => { A.beep({ freq: 400, dur: 0.25, type: 'square', vol: 0.1, slide: 60 }); A.noise({ dur: 0.2, vol: 0.12, filter: 1200 }); },
    talk: () => A.beep({ freq: 880, dur: 0.04, type: 'square', vol: 0.04 }),
    error: () => A.beep({ freq: 150, dur: 0.15, type: 'square', vol: 0.08 }),
    gate: () => A.beep({ freq: 300, dur: 0.6, type: 'sine', vol: 0.15, slide: 1200 }),
    roar: () => { A.beep({ freq: 90, dur: 1.2, type: 'sawtooth', vol: 0.22, slide: 50 }); A.noise({ dur: 1.0, vol: 0.2, filter: 500 }); },
    slam: () => { A.noise({ dur: 0.6, vol: 0.35, filter: 400 }); A.beep({ freq: 70, dur: 0.4, type: 'sine', vol: 0.3, slide: 35 }); },
    seal: () => { A.noise({ dur: 0.5, vol: 0.18, filter: 2200 }); [523, 784, 1047].forEach((f, i) => A.beep({ freq: f, dur: 0.16, type: 'triangle', vol: 0.1, when: 0.1 + i * 0.08 })); },
    tired: () => { A.beep({ freq: 260, dur: 0.22, type: 'sine', vol: 0.12, slide: 160 }); A.beep({ freq: 240, dur: 0.26, type: 'sine', vol: 0.1, slide: 140, when: 0.25 }); },
    fall: () => { [392, 330, 262, 196].forEach((f, i) => A.beep({ freq: f, dur: 0.3, type: 'triangle', vol: 0.12, when: i * 0.22 })); },
  };

  return {
    se(name) {
      SE[name]?.();
    },
    bgm(name) {
      if (name === current) return;
      current = name;
      playBgm(name);
    },
    get current() { return current; },
    /** 音量を変える（{ master, bgm, se, mute } のうち変えたいものだけ） */
    setVolume(o) {
      const before = bgmK();
      Object.assign(vol, o);
      // BGM の音量が変わったら鳴らし直す（鳴っている音の音量は後から変えられないため）
      if (Math.abs(bgmK() - before) > 0.001) playBgm(current);
    },
    get volume() { return { ...vol }; },
  };
}
