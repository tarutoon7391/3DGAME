// CPU 難易度係数（3競技共通）。各競技はここの値だけを見て強さを変える

export const DIFFICULTIES = {
  easy: {
    key: 'easy',
    label: 'やさしい',
    // テニス
    tennisSpeed: 4.6, // CPU の移動速度 m/s
    tennisReact: 0.38, // 反応の遅れ 秒
    tennisError: 0.2, // 返球ミス（ネット・アウト）率
    tennisAim: 1.6, // 狙いのブレ m
    tennisPace: 0.9, // 打球の速さ倍率
    // 野球
    pitchSpeed: 1.2, // 投球の到達時間倍率（大きいほど遅い）
    pitchControl: 0.14, // CPU 投手の制球ブレ m
    pitchBreaking: 0.25, // 変化球を投げる割合
    batContact: 0.42, // CPU 打者の基本ミート率
    batPower: 0.75, // CPU 打者の打球の強さ
    batChase: 0.42, // ボール球に手を出す率
    batRead: 0.08, // 配球を読んだときのボーナス
    // アーチェリー
    archAim: 0.3, // 着弾ブレ（20m あたりの標準偏差 m）
    archComp: 0.75, // 重力・風の補正の正確さ
    wind: 0.7, // 風の強さ倍率
  },
  normal: {
    key: 'normal',
    label: 'ふつう',
    tennisSpeed: 6.0,
    tennisReact: 0.22,
    tennisError: 0.11,
    tennisAim: 1.0,
    tennisPace: 1.0,
    pitchSpeed: 1.0,
    pitchControl: 0.09,
    pitchBreaking: 0.45,
    batContact: 0.56,
    batPower: 0.9,
    batChase: 0.3,
    batRead: 0.14,
    archAim: 0.15,
    archComp: 0.93,
    wind: 1.0,
  },
  hard: {
    key: 'hard',
    label: 'つよい',
    tennisSpeed: 7.4,
    tennisReact: 0.1,
    tennisError: 0.05,
    tennisAim: 0.55,
    tennisPace: 1.12,
    pitchSpeed: 0.86,
    pitchControl: 0.06,
    pitchBreaking: 0.6,
    batContact: 0.68,
    batPower: 1.05,
    batChase: 0.2,
    batRead: 0.2,
    archAim: 0.075,
    archComp: 0.99,
    wind: 1.3,
  },
};

export const DIFF_KEYS = ['easy', 'normal', 'hard'];

/** 正規分布っぽい乱数（平均0・標準偏差1） */
export function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}
