// 効果音・BGM（shared/audio.js の合成音だけで作る）

const N = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, G5: 784, A3: 220, G3: 196, F3: 175, E3: 165, C3: 131 };

export function createSound(audio) {
  return {
    audio,
    /** ラケット・バットで打った音（強さ 0〜1） */
    hit(power = 0.6) {
      audio.noise({ dur: 0.06, vol: 0.25 + power * 0.25, filter: 3500 });
      audio.beep({ freq: 520 + power * 500, dur: 0.07, type: 'triangle', vol: 0.18, slide: 300 });
    },
    bat(power = 0.7) {
      audio.noise({ dur: 0.09, vol: 0.4 + power * 0.3, filter: 5000 });
      audio.beep({ freq: 1400, dur: 0.05, type: 'square', vol: 0.08 + power * 0.08, slide: 600 });
    },
    bounce() {
      audio.beep({ freq: 180, dur: 0.06, type: 'sine', vol: 0.18, slide: 90 });
    },
    mitt() {
      audio.noise({ dur: 0.08, vol: 0.45, filter: 1200 });
    },
    whoosh() {
      audio.noise({ dur: 0.18, vol: 0.12, filter: 2200 });
    },
    swingMiss() {
      audio.noise({ dur: 0.2, vol: 0.12, filter: 1500 });
    },
    bowDraw() {
      audio.beep({ freq: 120, dur: 0.25, type: 'sawtooth', vol: 0.04, slide: 200 });
    },
    bowRelease() {
      audio.beep({ freq: 300, dur: 0.12, type: 'triangle', vol: 0.2, slide: 90 });
      audio.noise({ dur: 0.12, vol: 0.15, filter: 3000 });
    },
    thunk() {
      audio.noise({ dur: 0.1, vol: 0.5, filter: 900 });
      audio.beep({ freq: 140, dur: 0.12, type: 'sine', vol: 0.3, slide: 70 });
    },
    click() {
      audio.beep({ freq: 900, dur: 0.04, type: 'square', vol: 0.06 });
    },
    whistle() {
      audio.beep({ freq: 2100, dur: 0.35, type: 'sine', vol: 0.12, slide: 2000 });
    },
    good() {
      audio.beep({ freq: N.C5, dur: 0.1, type: 'square', vol: 0.1 });
      audio.beep({ freq: N.E5, dur: 0.1, type: 'square', vol: 0.1, when: 0.1 });
      audio.beep({ freq: N.G5, dur: 0.2, type: 'square', vol: 0.1, when: 0.2 });
    },
    bad() {
      audio.beep({ freq: N.E4, dur: 0.15, type: 'square', vol: 0.09 });
      audio.beep({ freq: N.C4, dur: 0.3, type: 'square', vol: 0.09, when: 0.15, slide: 200 });
    },
    /** 歓声（ノイズを重ねる） */
    cheer(v = 1) {
      for (let i = 0; i < 4; i++) audio.noise({ dur: 0.5 + i * 0.25, vol: 0.12 * v, filter: 1800 + i * 500, when: i * 0.08 });
    },
    fanfare() {
      const seq = [N.C5, N.E5, N.G5, N.C5 * 2];
      seq.forEach((f, i) => audio.beep({ freq: f, dur: i === 3 ? 0.5 : 0.14, type: 'square', vol: 0.1, when: i * 0.14 }));
    },
    lose() {
      const seq = [N.G4, N.F4, N.E4, N.C4];
      seq.forEach((f, i) => audio.beep({ freq: f, dur: 0.22, type: 'triangle', vol: 0.12, when: i * 0.22 }));
    },
    /** 試合中の簡易BGM（競技ごとに少し変える） */
    bgm(kind) {
      const v = 0.035;
      const songs = {
        menu: [N.C4, N.E4, N.G4, N.E4, N.F4, N.A4, N.G4, 0, N.E4, N.G4, N.C5, N.G4, N.F4, N.D4, N.C4, 0],
        tennis: [N.E4, 0, N.G4, N.E4, N.A4, 0, N.G4, 0, N.E4, 0, N.D4, N.E4, N.C4, 0, 0, 0],
        baseball: [N.C4, N.C4, N.G4, 0, N.A4, N.G4, N.E4, 0, N.F4, N.F4, N.E4, 0, N.D4, N.E4, N.C4, 0],
        archery: [N.A3, 0, N.E4, 0, N.C4, 0, N.E4, 0, N.G3, 0, N.D4, 0, N.B4 / 2, 0, N.D4, 0],
      };
      const notes = (songs[kind] || songs.menu).map((f) => (f ? { freq: f, dur: 0.22, vol: v } : { rest: 0.22 }));
      audio.playSeq(notes, { loop: true, tempo: kind === 'archery' ? 0.8 : 1 });
    },
    stopBgm() {
      audio.stopSeq();
    },
  };
}
