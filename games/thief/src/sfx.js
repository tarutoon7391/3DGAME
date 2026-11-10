// 効果音と簡易BGM（WebAudio 合成のみ）

// 低音のベース（Am → F → G → Em）
const N = { A2: 110, C3: 131, D3: 147, E3: 165, F2: 87.3, G2: 98, E2: 82.4, A3: 220, B2: 123.5 };
const CALM = [
  { freq: N.A2, dur: 0.5, vol: 0.05 }, { rest: 0.25 }, { freq: N.E3, dur: 0.25, vol: 0.03 },
  { freq: N.A2, dur: 0.5, vol: 0.05 }, { rest: 0.5 },
  { freq: N.F2, dur: 0.5, vol: 0.05 }, { rest: 0.25 }, { freq: N.C3, dur: 0.25, vol: 0.03 },
  { freq: N.F2, dur: 0.5, vol: 0.05 }, { rest: 0.5 },
  { freq: N.G2, dur: 0.5, vol: 0.05 }, { rest: 0.25 }, { freq: N.D3, dur: 0.25, vol: 0.03 },
  { freq: N.G2, dur: 0.5, vol: 0.05 }, { rest: 0.5 },
  { freq: N.E2, dur: 0.5, vol: 0.05 }, { rest: 0.25 }, { freq: N.B2, dur: 0.25, vol: 0.03 },
  { freq: N.E2, dur: 0.5, vol: 0.05 }, { rest: 0.5 },
];
const TENSE = [];
for (let i = 0; i < 4; i++) {
  const root = [N.A2, N.A2, N.F2, N.G2][i];
  for (let j = 0; j < 4; j++) TENSE.push({ freq: root, dur: 0.12, type: 'sawtooth', vol: 0.035 }, { rest: 0.06 });
  TENSE.push({ freq: root * 2, dur: 0.12, type: 'square', vol: 0.025 }, { rest: 0.06 });
}

export function createSfx(audio) {
  let bgm = '';
  return {
    bgm(kind) {
      if (kind === bgm) return;
      bgm = kind;
      if (kind === 'calm') audio.playSeq(CALM, { tempo: 0.9 });
      else if (kind === 'tense') audio.playSeq(TENSE, { tempo: 1 });
      else audio.stopSeq();
    },
    step(mode) {
      if (mode === 'crouch') audio.noise({ dur: 0.04, vol: 0.015, filter: 500 });
      else if (mode === 'run') audio.noise({ dur: 0.07, vol: 0.12, filter: 1500 });
      else audio.noise({ dur: 0.05, vol: 0.05, filter: 900 });
    },
    guardStep() {
      audio.noise({ dur: 0.04, vol: 0.02, filter: 700 });
    },
    steal(main) {
      const base = main ? 880 : 1046;
      [0, 0.08, 0.16, main ? 0.24 : -1].forEach((w, i) => {
        if (w >= 0) audio.beep({ freq: base * [1, 1.25, 1.5, 2][i], dur: 0.12, type: 'triangle', vol: 0.14, when: w });
      });
    },
    key() {
      audio.beep({ freq: 1200, dur: 0.07, type: 'square', vol: 0.08 });
      audio.beep({ freq: 1600, dur: 0.1, type: 'square', vol: 0.08, when: 0.08 });
    },
    door(open) {
      audio.noise({ dur: 0.2, vol: 0.08, filter: 400 });
      audio.beep({ freq: open ? 140 : 110, dur: 0.18, type: 'sawtooth', vol: 0.04, slide: open ? 200 : 80 });
    },
    locked() {
      audio.beep({ freq: 180, dur: 0.12, type: 'square', vol: 0.1 });
      audio.beep({ freq: 150, dur: 0.16, type: 'square', vol: 0.1, when: 0.13 });
    },
    hide() {
      audio.noise({ dur: 0.15, vol: 0.06, filter: 600 });
      audio.beep({ freq: 260, dur: 0.1, type: 'triangle', vol: 0.06 });
    },
    coinThrow() {
      audio.beep({ freq: 1800, dur: 0.05, type: 'sine', vol: 0.06 });
    },
    coinLand() {
      audio.beep({ freq: 2600, dur: 0.08, type: 'triangle', vol: 0.12 });
      audio.beep({ freq: 3200, dur: 0.12, type: 'triangle', vol: 0.09, when: 0.07 });
      audio.beep({ freq: 2900, dur: 0.1, type: 'triangle', vol: 0.06, when: 0.16 });
    },
    smoke() {
      audio.noise({ dur: 0.8, vol: 0.18, filter: 900 });
    },
    suspicious() {
      audio.beep({ freq: 520, dur: 0.12, type: 'triangle', vol: 0.08, slide: 700 });
    },
    detect() {
      audio.beep({ freq: 880, dur: 0.12, type: 'square', vol: 0.12 });
      audio.beep({ freq: 1320, dur: 0.25, type: 'square', vol: 0.12, when: 0.1 });
    },
    alarm() {
      for (let i = 0; i < 3; i++) {
        audio.beep({ freq: 700, dur: 0.35, type: 'sawtooth', vol: 0.06, slide: 1100, when: i * 0.4 });
      }
    },
    caught() {
      audio.beep({ freq: 400, dur: 0.25, type: 'square', vol: 0.12, slide: 300 });
      audio.beep({ freq: 300, dur: 0.25, type: 'square', vol: 0.12, slide: 200, when: 0.25 });
      audio.beep({ freq: 200, dur: 0.5, type: 'square', vol: 0.12, slide: 90, when: 0.5 });
    },
    clear() {
      [523, 659, 784, 1046, 784, 1046].forEach((f, i) => audio.beep({ freq: f, dur: 0.16, type: 'triangle', vol: 0.12, when: i * 0.12 }));
    },
    gadgetEmpty() {
      audio.beep({ freq: 220, dur: 0.08, type: 'square', vol: 0.06 });
    },
  };
}
