// ステージ定義と出現タイムライン（処理は src/spawner.js）
//
// タイムラインの1行 = 1編隊。
//   t: 出現秒（ステージ開始から） / type: ENEMY_TYPES のキー / count: 数（難易度の density で増減）
//   formation:
//     'line'   … x を中心に span 幅で横一列（同時）
//     'v'      … x,y を先頭に V 字（奥へ並ぶ）
//     'column' … x,y から interval 秒ごとに1機ずつ（縦列）
//     'random' … 画面内ランダム位置に interval 秒ごと
//     'circle' … x,y を中心に半径 r の円形（同時）
//   drop: 編隊を全滅させると落とすパワーアップ（'rapid' | 'spread' | 'shield'）
//   min:  'normal' / 'hard' 以上の難易度でのみ出現
// bossAt: この秒数でボス警告を出す / boss: BOSSES の添字 / env: 背景（src/env.js）

export const STAGES = [
  {
    name: '小惑星帯',
    env: 0,
    boss: 0,
    bossAt: 64,
    timeline: [
      { t: 3, type: 'straight', formation: 'line', count: 5, x: 0, y: 3, span: 16 },
      { t: 6, type: 'rock', formation: 'random', count: 6, interval: 0.5 },
      { t: 9, type: 'straight', formation: 'v', count: 5, x: -6, y: -2, span: 10, drop: 'rapid' },
      { t: 12, type: 'snake', formation: 'column', count: 6, x: -8, y: 4, interval: 0.45 },
      { t: 14, type: 'snake', formation: 'column', count: 6, x: 8, y: -3, interval: 0.45 },
      { t: 17, type: 'ironRock', formation: 'random', count: 2, interval: 1.2 },
      { t: 18, type: 'rock', formation: 'random', count: 8, interval: 0.4 },
      { t: 22, type: 'sniper', formation: 'line', count: 2, x: 0, y: 5, span: 14 },
      { t: 24, type: 'straight', formation: 'line', count: 6, x: 0, y: -4, span: 20, drop: 'spread' },
      { t: 28, type: 'rammer', formation: 'line', count: 3, x: 0, y: 0, span: 16 },
      { t: 31, type: 'rock', formation: 'random', count: 10, interval: 0.3 },
      { t: 31, type: 'ironRock', formation: 'random', count: 3, interval: 1.0 },
      { t: 36, type: 'snake', formation: 'column', count: 8, x: 0, y: 6, interval: 0.35, drop: 'shield' },
      { t: 40, type: 'sniper', formation: 'line', count: 3, x: 0, y: -3, span: 20, min: 'normal' },
      { t: 41, type: 'straight', formation: 'v', count: 7, x: 0, y: 2, span: 14 },
      { t: 45, type: 'rammer', formation: 'random', count: 4, interval: 0.7 },
      { t: 48, type: 'rock', formation: 'random', count: 12, interval: 0.25 },
      { t: 50, type: 'ironRock', formation: 'line', count: 3, x: 0, y: 0, span: 22 },
      { t: 53, type: 'snake', formation: 'column', count: 6, x: -10, y: 0, interval: 0.4 },
      { t: 53, type: 'snake', formation: 'column', count: 6, x: 10, y: 0, interval: 0.4 },
      { t: 57, type: 'straight', formation: 'circle', count: 8, x: 0, y: 0, r: 7, drop: 'rapid' },
      { t: 58, type: 'sniper', formation: 'line', count: 2, x: 0, y: 6, span: 18, min: 'hard' },
    ],
  },
  {
    name: '敵艦隊',
    env: 1,
    boss: 1,
    bossAt: 66,
    timeline: [
      { t: 3, type: 'straight', formation: 'v', count: 7, x: 0, y: 3, span: 14 },
      { t: 6, type: 'snake', formation: 'column', count: 6, x: -6, y: -4, interval: 0.4 },
      { t: 7, type: 'snake', formation: 'column', count: 6, x: 6, y: 4, interval: 0.4, drop: 'spread' },
      { t: 11, type: 'sniper', formation: 'line', count: 3, x: 0, y: 4, span: 22 },
      { t: 14, type: 'rammer', formation: 'line', count: 4, x: 0, y: -2, span: 20 },
      { t: 17, type: 'straight', formation: 'circle', count: 10, x: 0, y: 0, r: 8, drop: 'shield' },
      { t: 20, type: 'sniper', formation: 'random', count: 3, interval: 0.8 },
      { t: 21, type: 'straight', formation: 'line', count: 6, x: 0, y: 6, span: 22 },
      { t: 24, type: 'rammer', formation: 'random', count: 5, interval: 0.5 },
      { t: 27, type: 'snake', formation: 'column', count: 10, x: 0, y: 0, interval: 0.3, drop: 'rapid' },
      { t: 31, type: 'ironRock', formation: 'line', count: 2, x: 0, y: 2, span: 14 },
      { t: 32, type: 'sniper', formation: 'line', count: 4, x: 0, y: -5, span: 24, min: 'normal' },
      { t: 35, type: 'straight', formation: 'v', count: 9, x: 0, y: -2, span: 18 },
      { t: 38, type: 'rammer', formation: 'circle', count: 5, x: 0, y: 0, r: 9 },
      { t: 42, type: 'snake', formation: 'column', count: 7, x: -10, y: 5, interval: 0.35 },
      { t: 42, type: 'snake', formation: 'column', count: 7, x: 10, y: -5, interval: 0.35 },
      { t: 46, type: 'sniper', formation: 'line', count: 3, x: 0, y: 0, span: 24, drop: 'spread' },
      { t: 49, type: 'straight', formation: 'random', count: 10, interval: 0.25 },
      { t: 52, type: 'rammer', formation: 'random', count: 6, interval: 0.45, min: 'normal' },
      { t: 55, type: 'straight', formation: 'line', count: 7, x: 0, y: -6, span: 24 },
      { t: 56, type: 'straight', formation: 'line', count: 7, x: 0, y: 6, span: 24 },
      { t: 59, type: 'sniper', formation: 'random', count: 4, interval: 0.6, min: 'hard' },
    ],
  },
  {
    name: '母艦内部',
    env: 2,
    boss: 2,
    bossAt: 68,
    timeline: [
      { t: 3, type: 'snake', formation: 'column', count: 8, x: 0, y: 4, interval: 0.35 },
      { t: 6, type: 'sniper', formation: 'line', count: 2, x: 0, y: -4, span: 16 },
      { t: 8, type: 'straight', formation: 'circle', count: 10, x: 0, y: 0, r: 7, drop: 'shield' },
      { t: 11, type: 'rammer', formation: 'line', count: 5, x: 0, y: 3, span: 22 },
      { t: 14, type: 'ironRock', formation: 'line', count: 3, x: 0, y: -4, span: 20 },
      { t: 15, type: 'snake', formation: 'column', count: 8, x: -9, y: 0, interval: 0.3 },
      { t: 15, type: 'snake', formation: 'column', count: 8, x: 9, y: 0, interval: 0.3 },
      { t: 19, type: 'sniper', formation: 'line', count: 4, x: 0, y: 5, span: 24, drop: 'rapid' },
      { t: 23, type: 'straight', formation: 'v', count: 9, x: 0, y: 0, span: 18 },
      { t: 26, type: 'rammer', formation: 'random', count: 6, interval: 0.4 },
      { t: 29, type: 'ironRock', formation: 'random', count: 4, interval: 0.6 },
      { t: 30, type: 'straight', formation: 'random', count: 12, interval: 0.2, drop: 'spread' },
      { t: 34, type: 'sniper', formation: 'random', count: 4, interval: 0.5 },
      { t: 37, type: 'snake', formation: 'column', count: 12, x: 0, y: -5, interval: 0.25 },
      { t: 41, type: 'rammer', formation: 'circle', count: 6, x: 0, y: 0, r: 9, min: 'normal' },
      { t: 44, type: 'straight', formation: 'line', count: 8, x: 0, y: 4, span: 26 },
      { t: 45, type: 'straight', formation: 'line', count: 8, x: 0, y: -4, span: 26, drop: 'shield' },
      { t: 49, type: 'sniper', formation: 'line', count: 5, x: 0, y: 0, span: 26 },
      { t: 52, type: 'ironRock', formation: 'line', count: 3, x: 0, y: 3, span: 18 },
      { t: 53, type: 'rammer', formation: 'random', count: 7, interval: 0.35 },
      { t: 57, type: 'snake', formation: 'column', count: 8, x: -10, y: 6, interval: 0.3 },
      { t: 57, type: 'snake', formation: 'column', count: 8, x: 10, y: -6, interval: 0.3 },
      { t: 61, type: 'sniper', formation: 'random', count: 5, interval: 0.5, min: 'hard', drop: 'rapid' },
    ],
  },
];
