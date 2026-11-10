// 効果音と簡易BGM（すべて WebAudio 合成。shared/audio.js を使う）

// MIDI ノート番号 → 周波数
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** ベースのアルペジオ列を作る（roots: MIDI 番号、各根音で 1-8-5-8 を刻む） */
function bassLine(roots, dur, type, vol) {
  const out = [];
  for (const r of roots) {
    for (const o of [0, 12, 7, 12]) out.push({ freq: hz(r + o), dur, type, vol });
  }
  return out;
}

const BGM = [
  bassLine([45, 45, 43, 43, 41, 41, 40, 40], 0.16, 'triangle', 0.07), // 小惑星帯：Am-G-F-E
  bassLine([38, 38, 41, 41, 36, 36, 43, 40], 0.15, 'triangle', 0.07), // 敵艦隊
  bassLine([40, 40, 41, 41, 40, 40, 46, 45], 0.14, 'triangle', 0.075), // 母艦内部（不穏）
];
const BOSS_BGM = bassLine([40, 41, 40, 43, 40, 41, 46, 45], 0.11, 'sawtooth', 0.045);
const TITLE_BGM = [57, 64, 69, 71, 72, 71, 69, 64].map((n) => ({ freq: hz(n), dur: 0.42, type: 'sine', vol: 0.05 }));

export function createSfx(audio) {
  let shotFlip = false;
  return {
    shot() {
      // 連射音は1発おきに鳴らしてうるさくしない
      shotFlip = !shotFlip;
      if (shotFlip) audio.beep({ freq: 1500, dur: 0.05, type: 'square', vol: 0.025, slide: 700 });
    },
    hit() { audio.beep({ freq: 320, dur: 0.04, type: 'triangle', vol: 0.05 }); },
    clank() { audio.beep({ freq: 2400, dur: 0.035, type: 'square', vol: 0.025, slide: 1800 }); },
    explode() {
      audio.noise({ dur: 0.35, vol: 0.22, filter: 1400 });
      audio.beep({ freq: 140, dur: 0.25, type: 'sine', vol: 0.15, slide: 40 });
    },
    bigExplode() {
      audio.noise({ dur: 1.2, vol: 0.4, filter: 700 });
      audio.beep({ freq: 90, dur: 1.0, type: 'sine', vol: 0.25, slide: 25 });
    },
    damage() {
      audio.noise({ dur: 0.35, vol: 0.35, filter: 2500 });
      audio.beep({ freq: 240, dur: 0.35, type: 'sawtooth', vol: 0.12, slide: 60 });
    },
    shieldHit() { audio.beep({ freq: 500, dur: 0.25, type: 'sine', vol: 0.15, slide: 1300 }); },
    item() {
      [660, 880, 1320].forEach((f, i) => audio.beep({ freq: f, dur: 0.09, type: 'square', vol: 0.06, when: i * 0.07 }));
    },
    bomb() {
      audio.noise({ dur: 1.4, vol: 0.45, filter: 600 });
      audio.beep({ freq: 60, dur: 1.2, type: 'sawtooth', vol: 0.15, slide: 30 });
      audio.beep({ freq: 1200, dur: 0.6, type: 'sine', vol: 0.08, slide: 200 });
    },
    roll() {
      audio.noise({ dur: 0.25, vol: 0.12, filter: 3000 });
      audio.beep({ freq: 380, dur: 0.18, type: 'triangle', vol: 0.06, slide: 950 });
    },
    lock() { audio.beep({ freq: 1250, dur: 0.07, type: 'square', vol: 0.04 }); },
    warning() {
      for (let i = 0; i < 4; i++) {
        audio.beep({ freq: 880, dur: 0.28, type: 'sawtooth', vol: 0.07, when: i * 0.7 });
        audio.beep({ freq: 620, dur: 0.28, type: 'sawtooth', vol: 0.07, when: i * 0.7 + 0.33 });
      }
    },
    stageStart() {
      [523, 659, 784, 1047].forEach((f, i) => audio.beep({ freq: f, dur: 0.12, type: 'triangle', vol: 0.08, when: i * 0.09 }));
    },
    clear() {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => audio.beep({ freq: f, dur: 0.16, type: 'square', vol: 0.06, when: i * 0.13 }));
    },
    gameOver() {
      [392, 330, 262, 196].forEach((f, i) => audio.beep({ freq: f, dur: 0.3, type: 'triangle', vol: 0.09, when: i * 0.25 }));
    },
    stageBgm(i) { audio.playSeq(BGM[i % BGM.length], { loop: true }); },
    bossBgm() { audio.playSeq(BOSS_BGM, { loop: true }); },
    titleBgm() { audio.playSeq(TITLE_BGM, { loop: true }); },
    stopBgm() { audio.stopSeq(); },
  };
}
