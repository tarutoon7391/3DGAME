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

export function createSound(audio) {
  let current = '';

  const SE = {
    swing: () => audio.noise({ dur: 0.09, vol: 0.12, filter: 2500 }),
    hit: () => { audio.beep({ freq: 220, dur: 0.08, type: 'square', vol: 0.14, slide: 90 }); audio.noise({ dur: 0.07, vol: 0.18, filter: 1800 }); },
    crit: () => { audio.beep({ freq: 330, dur: 0.12, type: 'sawtooth', vol: 0.14, slide: 110 }); audio.noise({ dur: 0.12, vol: 0.22, filter: 1500 }); },
    hurt: () => { audio.beep({ freq: 180, dur: 0.18, type: 'sawtooth', vol: 0.16, slide: 70 }); },
    dodge: () => audio.noise({ dur: 0.16, vol: 0.1, filter: 900 }),
    spin: () => { audio.beep({ freq: 300, dur: 0.3, type: 'sawtooth', vol: 0.1, slide: 900 }); audio.noise({ dur: 0.3, vol: 0.12, filter: 3000 }); },
    wave: () => audio.beep({ freq: 900, dur: 0.35, type: 'sawtooth', vol: 0.1, slide: 200 }),
    shoot: () => audio.beep({ freq: 620, dur: 0.12, type: 'triangle', vol: 0.08, slide: 300 }),
    windup: () => audio.beep({ freq: 140, dur: 0.25, type: 'square', vol: 0.05, slide: 260 }),
    die: () => { audio.beep({ freq: 400, dur: 0.25, type: 'square', vol: 0.1, slide: 60 }); audio.noise({ dur: 0.2, vol: 0.12, filter: 1200 }); },
    talk: () => audio.beep({ freq: 880, dur: 0.04, type: 'square', vol: 0.04 }),
    error: () => audio.beep({ freq: 150, dur: 0.15, type: 'square', vol: 0.08 }),
    gate: () => audio.beep({ freq: 300, dur: 0.6, type: 'sine', vol: 0.15, slide: 1200 }),
    roar: () => { audio.beep({ freq: 90, dur: 1.2, type: 'sawtooth', vol: 0.22, slide: 50 }); audio.noise({ dur: 1.0, vol: 0.2, filter: 500 }); },
    slam: () => { audio.noise({ dur: 0.6, vol: 0.35, filter: 400 }); audio.beep({ freq: 70, dur: 0.4, type: 'sine', vol: 0.3, slide: 35 }); },
    seal: () => { audio.noise({ dur: 0.5, vol: 0.18, filter: 2200 }); [523, 784, 1047].forEach((f, i) => audio.beep({ freq: f, dur: 0.16, type: 'triangle', vol: 0.1, when: 0.1 + i * 0.08 })); },
    tired: () => { audio.beep({ freq: 260, dur: 0.22, type: 'sine', vol: 0.12, slide: 160 }); audio.beep({ freq: 240, dur: 0.26, type: 'sine', vol: 0.1, slide: 140, when: 0.25 }); },
    fall: () => { [392, 330, 262, 196].forEach((f, i) => audio.beep({ freq: f, dur: 0.3, type: 'triangle', vol: 0.12, when: i * 0.22 })); },
  };

  return {
    se(name) {
      SE[name]?.();
    },
    bgm(name) {
      if (name === current) return;
      current = name;
      if (!name || !BGM[name]) {
        audio.stopSeq();
        return;
      }
      audio.playSeq(BGM[name], { loop: name !== 'clear' });
    },
    get current() { return current; },
  };
}
