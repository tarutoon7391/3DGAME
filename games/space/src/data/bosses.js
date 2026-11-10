// ボス定義（処理は src/boss.js）
//
// parts: ボスを構成する部位
//   shape: 'sphere' | 'ico' | 'dodeca' | 'box' | 'cyl' | 'cone' | 'torus' / size: 形状ごとの寸法
//   weak: true … 弱点。ここだけダメージが通る（全弱点を壊すと撃破）。hp は弱点ごと
//   requires: [id…] … 指定した弱点を全部壊すまで装甲扱い（ダメージ無効）
//   r: 当たり判定の球半径（省略時は形状から推定） / collide: false … 判定なし（飾り）
//   spin: [x,y,z] 回転速度（見た目）
// rings: 弱点の前を回転する装甲板（count 枚を radius の円周に配置し z 軸まわりに回転）
// patterns / patterns2: 攻撃パターン（HP 半分以下で patterns2 に切替・攻撃間隔も短縮）
//   ring 拡散リング / aimed3 自機狙い3way / spiral 回転弾 / sweep 隙間つき弾幕壁
//   aimedBurst 自機狙い連射 / rocks 隕石を投げる / rammers 突撃機を射出
// move: 左右 ax・上下 ay の振幅と周波数 fx・fy / z: 戦闘位置 / muzzle: 弾の発射位置（ボス中心から）

export const BOSSES = [
  {
    name: '岩喰らい ガルガン',
    z: -72,
    move: { ax: 7, ay: 3, fx: 0.35, fy: 0.5 },
    muzzle: [0, 0, 8],
    parts: [
      { shape: 'ico', size: 7, pos: [0, 0, 0], color: 0x6e5b4b, r: 6.8, spin: [0.05, 0.12, 0] },
      { shape: 'ico', size: 2.8, pos: [-8, 2.5, 0.5], color: 0x5a4a3c, r: 2.6, spin: [0.6, 0.3, 0] },
      { shape: 'ico', size: 2.4, pos: [7.5, -2.5, 1], color: 0x5f4f40, r: 2.2, spin: [0.3, 0.7, 0] },
      { shape: 'cone', size: [1.2, 4], pos: [-3, 5.5, 3], color: 0x8a7a68, collide: false },
      { shape: 'cone', size: [1.2, 4], pos: [3, 5.5, 3], color: 0x8a7a68, collide: false },
      { id: 'core', shape: 'sphere', size: 2.3, pos: [0, 0, 6.4], color: 0xff3355, weak: true, hp: 120 },
    ],
    patterns: ['ring', 'aimed3', 'rocks'],
    patterns2: ['ring', 'spiral', 'aimed3', 'rocks'],
  },
  {
    name: '艦隊旗艦 ヴァルキス',
    z: -78,
    move: { ax: 9, ay: 2.5, fx: 0.28, fy: 0.45 },
    muzzle: [0, 1, 12],
    parts: [
      { shape: 'box', size: [9, 3, 26], pos: [0, 0, 0], color: 0x56607a, r: 4.2 },
      { shape: 'box', size: [22, 1, 8], pos: [0, -0.5, 2], color: 0x48526a, collide: false },
      { shape: 'box', size: [4, 3.5, 6], pos: [0, 3, -2], color: 0x6a7590, r: 2.5 },
      { shape: 'cone', size: [2.5, 6], pos: [0, 0, 15], color: 0x7a86a0, r: 2 },
      { id: 'podL', shape: 'cyl', size: [1.8, 1.8, 6], pos: [-10, 0, 3], color: 0xff7a1a, weak: true, hp: 60 },
      { id: 'podR', shape: 'cyl', size: [1.8, 1.8, 6], pos: [10, 0, 3], color: 0xff7a1a, weak: true, hp: 60 },
      { id: 'bridge', shape: 'sphere', size: 1.7, pos: [0, 3.2, 1.6], color: 0xff3355, weak: true, hp: 90, requires: ['podL', 'podR'] },
    ],
    patterns: ['sweep', 'aimedBurst', 'rammers'],
    patterns2: ['sweep', 'spiral', 'aimedBurst', 'rammers'],
  },
  {
    name: 'マザーコア',
    z: -74,
    move: { ax: 6, ay: 4, fx: 0.4, fy: 0.55 },
    muzzle: [0, 0, 5],
    parts: [
      { shape: 'torus', size: [8, 1.2], pos: [0, 0, 0], color: 0x7a3a2a, collide: false, spin: [0, 0, 0.2] },
      { shape: 'dodeca', size: 5, pos: [0, 0, -4], color: 0x553028, r: 4.5, spin: [0.1, 0.15, 0.05] },
      { shape: 'cone', size: [1, 5], pos: [0, 9.5, 0], color: 0x9a5040, collide: false },
      { shape: 'cone', size: [1, 5], pos: [0, -9.5, 0], color: 0x9a5040, collide: false },
      { shape: 'cone', size: [1, 5], pos: [9.5, 0, 0], color: 0x9a5040, collide: false },
      { shape: 'cone', size: [1, 5], pos: [-9.5, 0, 0], color: 0x9a5040, collide: false },
      { id: 'core', shape: 'sphere', size: 3.2, pos: [0, 0, 0], color: 0xff2266, weak: true, hp: 180 },
    ],
    rings: [
      { count: 3, radius: 2.4, z: 4.2, speed: 1.1, part: { shape: 'box', size: [2.6, 2.6, 0.8], color: 0x9aa4b8, r: 1.6 } },
    ],
    patterns: ['spiral', 'ring', 'aimedBurst'],
    patterns2: ['spiral', 'sweep', 'ring', 'aimedBurst'],
  },
];
