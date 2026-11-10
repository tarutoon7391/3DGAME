// 効果音と簡易BGM（WebAudio 合成のみ）
import { createAudio } from '/shared/audio.js';

const N = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, G5: 784 };

// のどかなワルツ風のループ（昼）
const DAY_BGM = [
  ['C5', 0.5], ['E5', 0.25], ['G5', 0.25], ['E5', 0.5], ['D5', 0.5],
  ['C5', 0.5], ['A4', 0.5], ['G4', 1],
  ['A4', 0.5], ['C5', 0.25], ['D5', 0.25], ['E5', 0.5], ['D5', 0.5],
  ['C5', 0.5], ['D5', 0.5], ['C5', 1], [null, 0.5],
].map(([n, d]) => (n ? { freq: N[n], dur: d * 0.6, vol: 0.045 } : { rest: d * 0.6 }));
// 夜はゆっくり低めに
const NIGHT_BGM = [
  ['E4', 1], ['G4', 1], ['C5', 1.5], [null, 0.5], ['B4', 1], ['G4', 1], ['A4', 2], [null, 1],
].map(([n, d]) => (n ? { freq: N[n] / 2, dur: d * 0.8, vol: 0.04, type: 'sine' } : { rest: d * 0.8 }));

export function createSound() {
  const audio = createAudio();
  let bgm = '';
  return {
    audio,
    till() { audio.noise({ dur: 0.18, vol: 0.25, filter: 700 }); audio.beep({ freq: 120, dur: 0.08, type: 'triangle', vol: 0.15 }); },
    water() { audio.noise({ dur: 0.35, vol: 0.12, filter: 3500 }); },
    plant() { audio.beep({ freq: 520, dur: 0.06, type: 'triangle', vol: 0.12 }); audio.beep({ freq: 780, dur: 0.08, type: 'triangle', vol: 0.1, when: 0.06 }); },
    harvest() { [660, 880, 1100].forEach((f, i) => audio.beep({ freq: f, dur: 0.08, type: 'triangle', vol: 0.13, when: i * 0.06 })); },
    cut() { audio.noise({ dur: 0.1, vol: 0.18, filter: 5000 }); },
    coin() { audio.beep({ freq: 988, dur: 0.07, type: 'square', vol: 0.08 }); audio.beep({ freq: 1319, dur: 0.18, type: 'square', vol: 0.08, when: 0.07 }); },
    ng() { audio.beep({ freq: 200, dur: 0.12, type: 'square', vol: 0.08, slide: 150 }); },
    open() { audio.beep({ freq: 600, dur: 0.05, type: 'triangle', vol: 0.1 }); },
    step() { audio.noise({ dur: 0.04, vol: 0.03, filter: 900 }); },
    cluck() { audio.beep({ freq: 900, dur: 0.06, type: 'square', vol: 0.06, slide: 600 }); audio.beep({ freq: 1000, dur: 0.05, type: 'square', vol: 0.05, slide: 700, when: 0.09 }); },
    moo() { audio.beep({ freq: 160, dur: 0.7, type: 'sawtooth', vol: 0.08, slide: 110 }); },
    eat() { [0, 0.1, 0.2].forEach((w) => audio.noise({ dur: 0.05, vol: 0.12, filter: 2000, when: w })); },
    levelUp() { ['C5', 'E5', 'G5', 'C5'].forEach((n, i) => audio.beep({ freq: N[n] * (i === 3 ? 2 : 1), dur: 0.15, type: 'triangle', vol: 0.14, when: i * 0.12 })); },
    sleep() { ['G4', 'E4', 'C4'].forEach((n, i) => audio.beep({ freq: N[n], dur: 0.35, type: 'sine', vol: 0.12, when: i * 0.3 })); },
    /** 昼／夜で BGM を切り替える（同じなら何もしない） */
    setBgm(kind) {
      if (kind === bgm) return;
      bgm = kind;
      if (kind === 'day') audio.playSeq(DAY_BGM, { loop: true });
      else if (kind === 'night') audio.playSeq(NIGHT_BGM, { loop: true });
      else audio.stopSeq();
    },
  };
}
