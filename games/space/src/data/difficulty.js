// 難易度定義：敵弾速度・発射頻度・出現量・スコア倍率などを段階ごとに持つ
// bulletSpeed: 敵弾速度の倍率 / fire: 雑魚の発射頻度倍率 / bossFire: ボス攻撃の間隔短縮倍率
// density: 編隊の出現数倍率 / level: タイムラインの min 指定（normal/hard 限定の出現）判定用
export const DIFFICULTIES = {
  easy: { key: 'easy', label: 'やさしい', level: 0, bulletSpeed: 0.72, fire: 0.6, bossFire: 0.8, density: 0.75, scoreMul: 0.8, bossHp: 0.8, desc: '敵弾が遅く、数も少なめ' },
  normal: { key: 'normal', label: 'ふつう', level: 1, bulletSpeed: 1, fire: 1, bossFire: 1, density: 1, scoreMul: 1, bossHp: 1, desc: '標準のバランス' },
  hard: { key: 'hard', label: 'むずかしい', level: 2, bulletSpeed: 1.35, fire: 1.55, bossFire: 1.25, density: 1.3, scoreMul: 1.5, bossHp: 1.2, desc: '弾幕が速く濃い。スコア1.5倍' },
};

export const DIFF_ORDER = ['easy', 'normal', 'hard'];

/** タイムラインの min 指定 → 必要な level */
export const MIN_LEVEL = { easy: 0, normal: 1, hard: 2 };

/** 敵弾の基準速度（units/秒）。難易度の bulletSpeed を掛けて使う */
export const ENEMY_BULLET_SPEED = 28;
