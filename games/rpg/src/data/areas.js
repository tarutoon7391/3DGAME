// エリア定義（大きさ・ゲート接続・配置）。形状の組み立ては src/world/*.js
// 座標は XZ 平面（Y が上）。北が -Z

export const AREAS = {
  village: {
    name: 'はじまりの村', safe: true, bgm: 'village',
    bounds: { minX: -32, maxX: 32, minZ: -32, maxZ: 32 },
    sky: 0x9fd3f0, fog: [60, 140], ground: 0x6aa84f,
    sun: { color: 0xfff1d6, intensity: 2.2, hemi: 0.9 },
    spawn: { x: 0, z: 6 },
    respawn: { x: -10, z: 4 }, // 全滅時の復活位置
    gates: [{ to: 'field', x: 0, z: -31, toX: 0, toZ: 44, label: '風の草原へ' }],
    npcs: [
      { id: 'chief', x: -12, z: -7.2, ry: 0 },
      { id: 'shop', x: 12, z: -7.6, ry: 0 },
      { id: 'inn', x: -13, z: 6.2, ry: Math.PI },
      { id: 'healer', x: 13, z: 8.2, ry: Math.PI },
      { id: 'guard', x: 3.6, z: -26, ry: -Math.PI / 2 },
      { id: 'kid', x: -4, z: 2.5, ry: 0.6 },
    ],
    // door: 's' なら +Z 側、'n' なら -Z 側に扉
    buildings: [
      { x: -12, z: -13, w: 9, d: 7, h: 4, wall: 0xe8d8b8, roof: 0x8e3b2e, door: 's', sign: '村長の家' },
      { x: 12, z: -12.5, w: 8, d: 6, h: 3.6, wall: 0xd7c4a0, roof: 0x2e6b8e, door: 's', sign: '道具・武具の店' },
      { x: -13, z: 12, w: 10, d: 8, h: 4.4, wall: 0xf0e2c4, roof: 0x6b8e2e, door: 'n', sign: '宿屋' },
      { x: 13, z: 13, w: 7, d: 6, h: 3.4, wall: 0xe6dcc8, roof: 0x7b4ea0, door: 'n', sign: '薬師の家' },
      { x: -24, z: -2, w: 6, d: 6, h: 3, wall: 0xd8ccb0, roof: 0x8e5b2e, door: 's' },
      { x: 24, z: 0, w: 6, d: 7, h: 3.2, wall: 0xdcd0b4, roof: 0x8e3b2e, door: 's' },
    ],
    signs: [{ x: -3, z: -22, key: 'village' }],
  },

  field: {
    name: '風の草原', bgm: 'field',
    bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
    sky: 0xa9d8f5, fog: [45, 120], ground: 0x7cb342,
    sun: { color: 0xffffff, intensity: 2.3, hemi: 0.85 },
    spawn: { x: 0, z: 44 },
    gates: [
      { to: 'village', x: 0, z: 49, toX: 0, toZ: -26, label: 'はじまりの村へ' },
      { to: 'dungeon', x: 0, z: -49, toX: 0, toZ: 44, label: '魔窟へ', requires: 'boss' },
    ],
    enemies: [
      ['slime', -12, 32], ['slime', 10, 30], ['slime', -4, 22], ['slime', 18, 18], ['slime', -20, 14],
      ['goblin', 22, 8], ['goblin', -24, 2], ['boar', 4, 8], ['slime', -8, 4],
      ['boar', -18, -10], ['goblin', 12, -12], ['slime', 26, -18], ['boar', 0, -20],
      ['goblin', -26, -24], ['slime', -10, -28], ['boar', 20, -32], ['goblin', 6, -36], ['slime', -30, 30],
    ],
    herbs: [[-16, 38], [14, 36], [-30, 18], [28, 22], [-6, 12], [34, 2], [-36, -8], [16, -4], [-20, -30], [30, -38], [-40, 36], [40, -20]],
    trees: 70, rocks: 26, seed: 20261110,
    signs: [{ x: 4, z: 42, key: 'field' }],
  },

  dungeon: {
    name: '魔窟', bgm: 'dungeon', dark: true,
    bounds: { minX: -22, maxX: 22, minZ: -50, maxZ: 50 },
    sky: 0x07060a, fog: [8, 46], ground: 0x3b3640,
    sun: { color: 0x8f7fd0, intensity: 0.5, hemi: 0.35 },
    spawn: { x: 0, z: 44 },
    gates: [{ to: 'field', x: 0, z: 49, toX: 0, toZ: -44, label: '風の草原へ' }],
    // 入口通路（x ±5）の両脇は岩盤
    solids: [
      { minX: -22, maxX: -5, minZ: 30, maxZ: 50 },
      { minX: 5, maxX: 22, minZ: 30, maxZ: 50 },
    ],
    pillars: [[-10, 20], [10, 20], [-10, 4], [10, 4], [-15, -24], [15, -24], [-15, -42], [15, -42]],
    divider: { z: -14.5, gap: 3 }, // ボス部屋との仕切り壁と扉
    levers: [[-21.2, 22], [21.2, 22], [-21.2, -6]],
    chest: { x: 20, z: -10, gold: 200, items: { ether: 2, potion: 2 } },
    torches: [[-4.6, 38], [4.6, 38], [-21.5, 12], [21.5, 12], [-21.5, -10], [21.5, -10], [-4, -15.5], [4, -15.5]],
    enemies: [
      ['skeleton', -6, 24], ['skeleton', 8, 22], ['wraith', 0, 12], ['golem', -14, 8], ['skeleton', 15, 4],
      ['wraith', -16, -4], ['golem', 10, -6], ['skeleton', -4, -6], ['wraith', 16, 26],
    ],
    boss: { x: 0, z: -34, triggerZ: -18 },
    signs: [{ x: 3.5, z: 34, key: 'dungeon' }],
  },
};
