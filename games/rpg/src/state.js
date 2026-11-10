// 進行データ（セーブ対象）。progress は素の JSON で、Three.js のオブジェクトは含めない
import { START_KIT, WEAPONS, ARMORS } from './data/items.js';
import { statsAt, expToNext, MAX_LEVEL } from './data/levels.js';
import { QUESTS } from './data/quests.js';
import { AREAS } from './data/areas.js';

/** ニューゲームの進行データ */
export function newProgress() {
  const st = statsAt(1);
  const quests = {};
  for (const id of Object.keys(QUESTS)) quests[id] = { status: 'none', count: 0 }; // none / active / done / cleared
  return {
    version: 1,
    level: 1,
    exp: 0,
    hp: st.maxHp,
    mp: st.maxMp,
    gold: START_KIT.gold,
    items: { ...START_KIT.items },
    weapons: [...START_KIT.weapons],
    armors: [...START_KIT.armors],
    weapon: START_KIT.weapon,
    armor: START_KIT.armor,
    quests,
    area: 'village',
    x: AREAS.village.spawn.x,
    z: AREAS.village.spawn.z,
    dungeon: { levers: [false, false, false], chest: false },
    stats: { kills: 0, deaths: 0, time: 0 },
  };
}

/** 進行データを包んで、よく使う操作を生やす */
export function createState(progress = newProgress()) {
  const s = {
    progress,
    /** レベル＋装備込みの能力値 */
    derived() {
      const p = s.progress;
      const b = statsAt(p.level);
      const w = WEAPONS[p.weapon] || WEAPONS.w1;
      const a = ARMORS[p.armor] || ARMORS.a1;
      return { maxHp: b.maxHp, maxMp: b.maxMp, atk: b.atk + w.atk, def: b.def + a.def, baseAtk: b.atk, baseDef: b.def };
    },
    count(id) {
      return s.progress.items[id] || 0;
    },
    addItem(id, n = 1) {
      s.progress.items[id] = (s.progress.items[id] || 0) + n;
    },
    removeItem(id, n = 1) {
      const c = s.count(id);
      if (c < n) return false;
      if (c - n <= 0) delete s.progress.items[id];
      else s.progress.items[id] = c - n;
      return true;
    },
    /** EXP を得る。上がったレベル数を返す（上がったら全回復） */
    gainExp(n) {
      const p = s.progress;
      p.exp += n;
      let ups = 0;
      while (p.level < MAX_LEVEL && p.exp >= expToNext(p.level)) {
        p.exp -= expToNext(p.level);
        p.level++;
        ups++;
      }
      if (p.level >= MAX_LEVEL) p.exp = 0;
      if (ups) {
        const d = s.derived();
        p.hp = d.maxHp;
        p.mp = d.maxMp;
      }
      return ups;
    },
    healFull() {
      const d = s.derived();
      s.progress.hp = d.maxHp;
      s.progress.mp = d.maxMp;
    },
    /** 古いセーブや欠けたキーを補う */
    normalize() {
      const base = newProgress();
      const p = s.progress;
      for (const k of Object.keys(base)) if (p[k] === undefined) p[k] = base[k];
      for (const id of Object.keys(base.quests)) if (!p.quests[id]) p.quests[id] = base.quests[id];
      if (!AREAS[p.area]) p.area = 'village';
      const d = s.derived();
      p.hp = Math.min(Math.max(1, p.hp), d.maxHp);
      p.mp = Math.min(Math.max(0, p.mp), d.maxMp);
    },
  };
  return s;
}
