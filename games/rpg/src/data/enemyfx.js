// 敵の攻撃の見た目（テーマ）。処理は src/enemyfx.js
// ボスごとにテーマを決め、そのボスの技の色の弾・衝撃波・壁はテーマの形で描く（色は技の color のまま）
// 赤い予兆（地面の警告）は見やすさ優先で全テーマ共通のまま

/** ボス → テーマ */
export const BOSS_THEME = {
  galdra: 'demon', ignis: 'fire', frosga: 'ice', zarvan: 'dark', golgoth: 'iron', sylpha: 'wind', vexis: 'poison',
  kain: 'blood', abel: 'arrow', nezal: 'dark', lilith: 'dark', wyvern: 'fire', behemoth: 'earth', hydra: 'water',
  griffon: 'feather', manticore: 'poison', eldragon: 'arcane', cerberus: 'fire', basilisk: 'poison', firebird: 'fire',
  minotaur: 'earth', harpy: 'feather', ragna: 'fire',
};

/** 雑魚の弾 → テーマ（ENEMIES の shotColor） */
export const ENEMY_THEME = { goblin: 'arrow', wraith: 'dark' };

/**
 * テーマごとの見た目
 *   shot      … 弾の形（src/data/shots_*.js か src/data/enemyshots.js の名前）
 *   shotScale … 弾の大きさの倍率（当たり判定は変わらない）
 *   decor     … 衝撃波・着地の衝撃・壁に並ぶ飾り（src/enemyfx.js の DECOR）
 *   crest     … 衝撃波の立ち上がる光の高さの倍率
 */
export const THEMES = {
  demon: { shot: 'demonorb', shotScale: 1, decor: 'spike', crest: 1 },
  fire: { shot: 'fireball', shotScale: 0.9, decor: 'flame', crest: 1.2 },
  ice: { shot: 'ice', shotScale: 1, decor: 'icespike', crest: 0.9 },
  dark: { shot: 'darkorb', shotScale: 1, decor: 'wisp', crest: 1.1 },
  iron: { shot: 'ironshard', shotScale: 1, decor: 'shard', crest: 0.8 },
  earth: { shot: 'rock', shotScale: 1, decor: 'rock', crest: 0.7 },
  wind: { shot: 'windblade', shotScale: 1, decor: 'streak', crest: 1.3 },
  poison: { shot: 'poison', shotScale: 1, decor: 'bubble', crest: 0.8 },
  water: { shot: 'drop', shotScale: 1, decor: 'splash', crest: 1 },
  feather: { shot: 'feather', shotScale: 1.1, decor: 'feather', crest: 1 },
  arcane: { shot: 'magic', shotScale: 1, decor: 'spark', crest: 1 },
  blood: { shot: 'crescent', shotScale: 0.8, decor: 'spike', crest: 1 },
  arrow: { shot: 'arrow', shotScale: 0.9, decor: 'spark', crest: 1 },
  default: { shot: 'orb', shotScale: 1, decor: 'spark', crest: 1 },
};

/** 弾の大きさの基準（今までの敵弾の半径 0.28 に合わせる） */
export const ENEMY_SHOT_SIZE = 0.3;

/** 衝撃波（ノヴァ） */
export const NOVA = {
  crest: 1.1, // 立ち上がる光の高さ（m）。THEMES の crest を掛ける
  afterglow: 1.6, // 輪の内側に残る光の幅（m）
  decorCount: 40, // 飾りの数（輪1つあたり）
  decorSize: 0.75, // 飾りの大きさ（m）
};

/** 着地・地割れ・火柱の衝撃（見た目だけ。当たり判定は今まで通り） */
export const IMPACT = { time: 0.32, fade: 0.35, over: 1.15 };

/** 壁の飾り（炎の壁・氷壁など） */
export const WALL = { every: 1.1, decorSize: 0.8 };
