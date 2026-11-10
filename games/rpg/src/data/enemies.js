// 敵・ボスのデータ
// ai: melee（近接）/ ranged（遠距離）/ charger（突進）。model は src/models.js の形状名
// 攻撃の威力は data/player.js の HIT（最大 HP の割合）で決まる
// 速度・予備動作・攻撃間隔は旧仕様から 速さ×1.3、予備動作×0.8、硬直×0.7、攻撃間隔×0.65 程度にした

export const ENEMIES = {
  // ---- ステージ1・2 ----
  slime: {
    name: 'スライム', ai: 'melee', model: 'slime', color: 0x66bb6a,
    hp: 30, def: 1, speed: 3.4, radius: 0.6, aggro: 11, hpY: 1.3,
    range: 1.7, windup: 0.55, recover: 0.6,
  },
  goblin: {
    name: 'ゴブリン弓兵', ai: 'ranged', model: 'goblin', color: 0x8bc34a,
    hp: 26, def: 1, speed: 3.9, radius: 0.5, aggro: 15, hpY: 1.9,
    keep: 7, windup: 0.7, cooldown: 1.5, shotSpeed: 12, burst: 1, shotColor: 0xffa726,
  },
  boar: {
    name: '突進イノシシ', ai: 'charger', model: 'boar', color: 0x8d6e63,
    hp: 48, def: 2, speed: 3.6, radius: 0.8, aggro: 13, hpY: 1.6,
    windup: 0.7, chargeSpeed: 17, chargeTime: 0.75, stun: 1.0, chargeFrom: 9,
  },
  // ---- 魔窟（同じ3系統の強化版） ----
  skeleton: {
    name: 'ガイコツ兵', ai: 'melee', model: 'skeleton', color: 0xe8e4d0,
    hp: 70, def: 5, speed: 4.2, radius: 0.55, aggro: 12, hpY: 2.4,
    range: 1.9, windup: 0.48, recover: 0.55,
  },
  wraith: {
    name: '亡霊術師', ai: 'ranged', model: 'mage', color: 0x7e57c2,
    hp: 50, def: 3, speed: 3.6, radius: 0.55, aggro: 16, hpY: 2.5,
    keep: 8, windup: 0.65, cooldown: 1.6, shotSpeed: 13, burst: 3, shotColor: 0xce93d8,
  },
  golem: {
    name: '岩ゴーレム', ai: 'charger', model: 'golem', color: 0x78909c,
    hp: 110, def: 9, speed: 2.9, radius: 1.0, aggro: 13, hpY: 3.1,
    windup: 0.8, chargeSpeed: 15, chargeTime: 0.9, stun: 1.2, chargeFrom: 9, heavy: true,
  },
};

/** 雑魚 AI の共通の数値 */
export const AI = {
  chaseAggroMul: 1.8, // 追跡中は索敵範囲がこの倍率に広がる
  leash: 28, // 持ち場からこれ以上離れたら諦める
  sightEvery: 0.2, // 視線（壁越しか）の判定間隔（秒）
  loseSight: 2.5, // 見失ってから諦めるまで（秒）
  wander: 2.5, // 待機中にうろつく半径
  meleeCd: [0.25, 0.6], // 近接の攻撃後、次の攻撃までの間隔（最小・最大）
  meleeArc: 0.95, // 近接攻撃が当たる角度（片側・ラジアン）
  meleeTeleArc: 1.8, // 近接の予兆（扇）の角度
  shotSpread: 0.22, // 複数弾の間隔（ラジアン）
  rangedTeleLen: 12, // 遠距離の予兆（直線）の長さ
  knock: 6, // 被弾時のノックバックの強さ
  heavyKnock: 0.25, // heavy な敵のノックバック倍率
  firstCd: [0.3, 1.0], // 出現直後の攻撃間隔
};

/** ボス：攻撃パターン3つ、HP 50% で怒り（行動変化）。強さは旧仕様で Lv4 が挑んだときと同じ HP・防御 */
export const BOSS = {
  name: '魔窟の主ガルドラ', color: 0x8e2b2b,
  hp: 1400, def: 8, speed: 3.2, radius: 1.7, hpY: 6,
  patterns: {
    sweep: { name: '薙ぎ払い', windup: 1.0, range: 6, arc: Math.PI * 1.1 },
    ring: { name: '魔弾の輪', windup: 1.1, count: 14, speed: 9, color: 0xff5252, secondWave: 0.45, rageSpeedMul: 1.15 },
    slam: { name: '跳躍叩きつけ', windup: 0.9, air: 0.9, radius: 4.2, height: 7, rageRing: 10 },
  },
  rage: {
    at: 0.5, // HP 割合
    speedMul: 1.35,
    windupMul: 0.72,
    summon: 'skeleton',
    summonEvery: 20, // 秒ごとに手下を2体呼ぶ
    summonMax: 3, // 雑魚がこの数未満のときだけ呼ぶ
    summonOffset: [4, 2], // 手下の出現位置（ボスから x ±4、z +2）
  },
  restMin: 0.8, // 攻撃の合間
  restMax: 1.6,
};
