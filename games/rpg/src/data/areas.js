// エリア定義（大きさ・つながり・配置）。形状の組み立ては src/world/*.js
// 座標は XZ 平面（Y が上）。北が -Z。1-1→1-2→1-3 の一方通行（ステージ2 の冥王の城は単独）で、ゲートをくぐると次のエリアへ
//
// 迷路（maze）：cols×rows マスの完全迷路をシードから生成する（同じシードなら毎回同じ形）。
//   入口は南端の entryCol、出口は北端の exitCol。正解ルート上に「結界」を置き、
//   その手前の番人（guards）を全部倒すと結界が消える＝戦わないと先へ進めない。
//   seals[i].at は正解ルート上の位置（0＝入口、1＝出口）。roamers は脇道などをうろつく雑魚

/** 迷路エリアの外形（範囲・入口・出口ゲート）を作る */
function mazeArea(o) {
  const { cols, rows, cell } = o.maze;
  const hw = (cols * cell) / 2;
  const hd = (rows * cell) / 2;
  const cx = (c) => -hw + (c + 0.5) * cell;
  return {
    ...o,
    bounds: { minX: -hw, maxX: hw, minZ: -hd - 1.5, maxZ: hd },
    spawn: { x: cx(o.maze.entryCol), z: hd - cell / 2 },
    gates: [{ to: o.next, x: cx(o.maze.exitCol), z: -hd - 0.6, label: o.nextLabel }],
  };
}

export const AREAS = {
  forest: mazeArea({
    name: '1-1　迷いの森', stage: 1, bgm: 'village', next: 'canyon', nextLabel: '岩の迷宮へ',
    sky: 0x9fd3f0, fog: [40, 110], ground: 0x6aa84f, wall: 0x2e7d32, wallTop: 0x43a047, wallH: 2.8,
    sun: { color: 0xfff1d6, intensity: 2.2, hemi: 0.9 },
    camPitch: 0.75, // 迷路は高めの視点で見下ろす（マウスで変えられる）
    maze: { cols: 8, rows: 10, cell: 6, wallT: 1, seed: 1110, entryCol: 3, exitCol: 4 },
    seals: [
      { at: 0.3, guards: ['slime', 'slime'] },
      { at: 0.62, guards: ['slime', 'goblin', 'slime'] },
      { at: 0.93, guards: ['boar', 'goblin', 'slime'] },
    ],
    roamers: ['slime', 'slime', 'slime', 'goblin', 'slime', 'boar', 'goblin', 'slime', 'slime', 'goblin', 'boar', 'slime'],
    trees: 120, seed: 20261110,
    signs: [{ key: 'forest', dx: 1.8, dz: -1 }], // 入口のマスからのずれ
  }),

  canyon: mazeArea({
    name: '1-2　岩の迷宮', stage: 2, bgm: 'field', next: 'dungeon', nextLabel: '魔窟へ',
    sky: 0xe7b98a, fog: [35, 100], ground: 0xb08d63, wall: 0x8d6e63, wallTop: 0xa1887f, wallH: 3.2,
    sun: { color: 0xffd9b0, intensity: 2.0, hemi: 0.8 },
    camPitch: 0.8,
    maze: { cols: 9, rows: 11, cell: 6, wallT: 1, seed: 7777, entryCol: 4, exitCol: 4 },
    seals: [
      { at: 0.25, guards: ['slime', 'goblin', 'slime'] },
      { at: 0.55, guards: ['boar', 'goblin', 'slime'] },
      { at: 0.92, guards: ['boar', 'goblin', 'goblin', 'slime'] },
    ],
    roamers: ['goblin', 'slime', 'boar', 'slime', 'goblin', 'slime', 'boar', 'goblin', 'slime', 'boar', 'slime', 'goblin', 'slime'],
    rocks: 90, seed: 4242,
    signs: [{ key: 'canyon', dx: 1.8, dz: -1 }],
  }),

  // 1-3（構造は旧仕様のまま。レバー・宝箱・草原へ戻るゲートは撤去し、扉は最初から開いている）
  dungeon: {
    name: '1-3　魔窟', stage: 3, bgm: 'dungeon', dark: true, wallH: 6,
    bounds: { minX: -22, maxX: 22, minZ: -50, maxZ: 50 },
    sky: 0x07060a, fog: [8, 46], ground: 0x3b3640,
    sun: { color: 0x8f7fd0, intensity: 0.5, hemi: 0.35 },
    spawn: { x: 0, z: 44 },
    gates: [],
    // 入口通路（x ±5）の両脇は岩盤
    solids: [
      { minX: -22, maxX: -5, minZ: 30, maxZ: 50 },
      { minX: 5, maxX: 22, minZ: 30, maxZ: 50 },
    ],
    pillars: [[-10, 20], [10, 20], [-10, 4], [10, 4], [-15, -24], [15, -24], [-15, -42], [15, -42]],
    divider: { z: -14.5, gap: 3 }, // ボス部屋との仕切り壁と扉
    torches: [[-4.6, 38], [4.6, 38], [-21.5, 12], [21.5, 12], [-21.5, -10], [21.5, -10], [-4, -15.5], [4, -15.5]],
    enemies: [
      ['skeleton', -6, 24], ['skeleton', 8, 22], ['wraith', 0, 12], ['golem', -14, 8], ['skeleton', 15, 4],
      ['wraith', -16, -4], ['golem', 10, -6], ['skeleton', -4, -6], ['wraith', 16, 26],
    ],
    // ボス（bosses の順に戦う）。triggerZ より奥へ入ると戦闘開始、door はそのとき閉まる扉の番号
    bosses: [{ key: 'galdra', x: 0, z: -34, triggerZ: -18, door: 0 }],
    signs: [{ x: 3.5, z: 34, key: 'dungeon' }],
  },

  // ステージ2：入口通路 → 中ボス1の間 → 中ボス2の間 → 冥王の間 と一直線。各部屋は扉で区切る
  // 部屋に入ると後ろの扉が閉まり、ボスを倒すと次の扉が開く。やられたら「いま戦っているボスの部屋の前」から
  castle: {
    name: 'ステージ2　冥王の城', stage: 4, bgm: 'castle', dark: true, wallH: 7, castle: true,
    bounds: { minX: -20, maxX: 20, minZ: -84, maxZ: 50 },
    sky: 0x0b0614, fog: [12, 60], ground: 0x2a2233,
    sun: { color: 0xb388ff, intensity: 0.45, hemi: 0.35 },
    spawn: { x: 0, z: 44 },
    gates: [],
    solids: [
      { minX: -20, maxX: -5, minZ: 30, maxZ: 50 },
      { minX: 5, maxX: 20, minZ: 30, maxZ: 50 },
    ],
    // 扉（z の位置と、開口部の半分の幅）。0 は最初から開いている
    doors: [{ z: 30, gap: 3 }, { z: -2, gap: 3 }, { z: -36, gap: 3.5 }],
    pillars: [], // 柱なし（弾幕をよけやすいように部屋は広いまま）
    torches: [[-4.6, 40], [4.6, 40], [-19.5, 14], [19.5, 14], [-19.5, -19], [19.5, -19], [-19.5, -50], [19.5, -50], [-19.5, -68], [19.5, -68]],
    bosses: [
      { key: 'ignis', x: 0, z: 12, triggerZ: 25, door: 0, respawn: { x: 0, z: 44 }, circle: 0xff6d00 },
      { key: 'frosga', x: 0, z: -22, triggerZ: -7, door: 1, respawn: { x: 0, z: 3 }, circle: 0x00b8d4 },
      { key: 'zarvan', x: 0, z: -62, triggerZ: -41, door: 2, respawn: { x: 0, z: -31 }, circle: 0xaa00ff },
    ],
    signs: [{ x: 3.5, z: 42, key: 'castle' }],
  },
};


/** ステージの順番（つづきから・移行用） */
export const AREA_ORDER = ['forest', 'canyon', 'dungeon', 'castle'];

/** 古いセーブ（version 1）のエリア id → 新しい id */
export const OLD_AREA_MAP = { village: 'forest', field: 'canyon', dungeon: 'dungeon' };

/**
 * タイトルで選ぶステージ（コース）。areas はそのコースに含まれるエリア、recKey はセーブの記録の置き場所
 * ステージ1 は旧来の3エリア（ガルドラ撃破でクリア）、ステージ2 は冥王の城だけ（冥王撃破でクリア）
 */
export const COURSES = [
  {
    key: 'cave', label: 'ステージ1', name: '魔窟の主', start: 'forest', areas: ['forest', 'canyon', 'dungeon'], recKey: 'records',
    desc: '迷路2つを抜けて、魔窟の主ガルドラを倒す', clearMsg: '魔窟の主ガルドラを討ち取った！',
  },
  {
    key: 'castle', label: 'ステージ2', name: '冥王の城', start: 'castle', areas: ['castle'], recKey: 'records2',
    desc: '中ボス2連戦のあと冥王と戦う弾幕ボスラッシュ（難しい）', clearMsg: '冥王ザルヴァーンを討ち取った！',
  },
];

/** エリア id → そのエリアを含むコース */
export function courseOf(area) {
  return COURSES.find((c) => c.areas.includes(area)) || COURSES[0];
}
