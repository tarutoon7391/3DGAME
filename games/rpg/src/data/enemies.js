// 敵・ボスのデータ
// ai: melee（近接）/ ranged（遠距離）/ charger（突進）。model は src/models.js の形状名
// drops: [アイテムid, 確率]、gold: [最小, 最大]

export const ENEMIES = {
  // ---- 草原 ----
  slime: {
    name: 'スライム', ai: 'melee', model: 'slime', color: 0x66bb6a,
    hp: 30, atk: 9, def: 1, speed: 2.6, radius: 0.6, aggro: 11, hpY: 1.3,
    range: 1.7, windup: 0.7, recover: 0.9,
    exp: 6, gold: [3, 7], drops: [['herb', 0.25], ['potion', 0.05]],
  },
  goblin: {
    name: 'ゴブリン弓兵', ai: 'ranged', model: 'goblin', color: 0x8bc34a,
    hp: 26, atk: 11, def: 1, speed: 3.0, radius: 0.5, aggro: 15, hpY: 1.9,
    keep: 8, windup: 0.85, cooldown: 2.3, shotSpeed: 10, burst: 1, shotColor: 0xffa726,
    exp: 9, gold: [5, 10], drops: [['fang', 0.3]],
  },
  boar: {
    name: '突進イノシシ', ai: 'charger', model: 'boar', color: 0x8d6e63,
    hp: 48, atk: 15, def: 2, speed: 2.8, radius: 0.8, aggro: 13, hpY: 1.6,
    windup: 0.9, chargeSpeed: 15, chargeTime: 0.85, stun: 1.3,
    exp: 13, gold: [6, 12], drops: [['fang', 0.5]],
  },
  // ---- ダンジョン（同じ3系統の強化版） ----
  skeleton: {
    name: 'ガイコツ兵', ai: 'melee', model: 'skeleton', color: 0xe8e4d0,
    hp: 85, atk: 22, def: 5, speed: 3.2, radius: 0.55, aggro: 12, hpY: 2.4,
    range: 1.9, windup: 0.6, recover: 0.8,
    exp: 28, gold: [12, 22], drops: [['bone', 0.4], ['potion', 0.15]],
  },
  wraith: {
    name: '亡霊術師', ai: 'ranged', model: 'mage', color: 0x7e57c2,
    hp: 60, atk: 24, def: 3, speed: 2.8, radius: 0.55, aggro: 16, hpY: 2.5,
    keep: 9, windup: 0.8, cooldown: 2.4, shotSpeed: 11, burst: 3, shotColor: 0xce93d8,
    exp: 30, gold: [14, 24], drops: [['bone', 0.3], ['ether', 0.2]],
  },
  golem: {
    name: '岩ゴーレム', ai: 'charger', model: 'golem', color: 0x78909c,
    hp: 140, atk: 30, def: 9, speed: 2.2, radius: 1.0, aggro: 13, hpY: 3.1,
    windup: 1.0, chargeSpeed: 13, chargeTime: 1.0, stun: 1.6,
    exp: 40, gold: [20, 35], drops: [['bone', 0.6], ['potion', 0.25]],
  },
};

/** ボス：攻撃パターン3つ、HP 50% で怒り（行動変化） */
export const BOSS = {
  name: '魔窟の主ガルドラ', color: 0x8e2b2b,
  hp: 1400, atk: 30, def: 8, speed: 3.2, radius: 1.7, hpY: 6,
  exp: 500, gold: 600,
  patterns: {
    sweep: { name: '薙ぎ払い', windup: 1.0, range: 6, arc: Math.PI * 1.1, mult: 1.3 },
    ring: { name: '魔弾の輪', windup: 1.1, count: 14, speed: 9, mult: 0.9, color: 0xff5252 },
    slam: { name: '跳躍叩きつけ', windup: 0.9, air: 0.9, radius: 4.2, mult: 1.6 },
  },
  rage: {
    at: 0.5, // HP 割合
    speedMul: 1.35,
    windupMul: 0.72,
    summon: 'skeleton',
    summonEvery: 20, // 秒ごとに手下を2体呼ぶ
  },
  restMin: 0.8, // 攻撃の合間
  restMax: 1.6,
};
