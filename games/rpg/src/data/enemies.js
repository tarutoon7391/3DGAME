// 敵・ボスのデータ
// ai: melee（近接）/ ranged（遠距離）/ charger（突進）。model は src/models.js の形状名
// 攻撃の威力は data/player.js の HIT（最大 HP の割合）で決まる
// 速度・予備動作・攻撃間隔は旧仕様から 速さ×1.3、予備動作×0.8、硬直×0.7、攻撃間隔×0.65 程度にした

export const ENEMIES = {
  // ---- 1-1・1-2 ----
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

/**
 * ボスのデータ。patterns の kind（省略時はキー名）で動きが決まる：
 *   sweep 前方扇の近接 / slam 跳躍叩きつけ（着地で ring 発の弾） / ring 全方位弾（waves 回）
 *   fan 狙い撃ちの扇弾（volleys 回） / spiral 渦巻き弾（arms 本。twin で逆回りも同時）
 *   charge 突進（通った跡から左右に弾） / rain 足元に落ちる隕石（赤円。着弾で burst 発の弾）
 * near / far：プレイヤーとの距離が nearRange 未満か以上かで選ぶパターンの重み
 * after：そのパターンのあと続けて出す追撃（近接の後に弾幕など）
 * shotHit：弾1発で削る最大 HP の割合（近接・叩きつけ・突進・隕石は HIT.boss）
 * rage：HP 割合 at で怒り。speedMul・windupMul・countMul（弾の数の倍率）、summon で手下を呼ぶ
 * rage 中は rageWaves／rageRing／rageCount／rageTwin があればそちらを使う
 * look：見た目（models.js の makeBossModel）
 */
export const BOSSES = {
  // ---- 1-3 の主（強さ・動きは旧仕様のまま） ----
  galdra: {
    name: '魔窟の主ガルドラ', color: 0x8e2b2b,
    hp: 1400, def: 8, speed: 3.2, radius: 1.7, hpY: 6,
    shotHit: 1 / 3,
    nearRange: 7,
    near: { sweep: 0.6, slam: 0.2, ring: 0.2 },
    far: { ring: 0.5, slam: 0.5 },
    patterns: {
      sweep: { name: '薙ぎ払い', windup: 1.0, range: 6, arc: Math.PI * 1.1 },
      ring: { name: '魔弾の輪', windup: 1.1, count: 14, speed: 9, color: 0xff5252, waves: 1, rageWaves: 2, waveGap: 0.45, rageSpeedMul: 1.15 },
      slam: { name: '跳躍叩きつけ', windup: 0.9, air: 0.9, radius: 4.2, height: 7, ring: 0, rageRing: 10, color: 0xff5252 },
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
    look: {},
  },

  // ---- ステージ2 中ボス1：突進と扇弾で攻めてくる騎士 ----
  ignis: {
    name: '業火の騎士イグニス', color: 0xd84315,
    hp: 950, def: 6, speed: 4.4, radius: 1.4, hpY: 5,
    shotHit: 1 / 5,
    nearRange: 6,
    near: { sweep: 0.45, fan: 0.2, charge: 0.2, ring: 0.15 },
    far: { charge: 0.4, fan: 0.4, ring: 0.2 },
    patterns: {
      sweep: { name: '炎の薙ぎ払い', windup: 0.8, range: 5.5, arc: Math.PI * 1.2, after: 'fan' },
      fan: { name: '火炎の扇', windup: 0.75, count: 9, spread: 0.16, volleys: 3, interval: 0.32, speed: 12, color: 0xff7043 },
      charge: { name: '業火の突進', windup: 0.75, speed: 22, time: 0.8, width: 2.8, trailEvery: 0.07, trailSpeed: 6, color: 0xffab40 },
      ring: { name: '爆炎の輪', windup: 0.9, count: 18, speed: 9, color: 0xff5722, waves: 2, rageWaves: 3, waveGap: 0.35 },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.75, countMul: 1.35 },
    restMin: 0.5, restMax: 1.1,
    look: { scale: 2.1, horn: 0xffcc80, eye: 0xffffff, weapon: 'sword', metal: 0x5d4037 },
  },

  // ---- ステージ2 中ボス2：距離を取って弾幕を張る魔導士 ----
  frosga: {
    name: '氷霧の魔導士フロスガ', color: 0x4fc3f7,
    hp: 820, def: 4, speed: 3.0, radius: 1.3, hpY: 5, keep: 9,
    shotHit: 1 / 5,
    nearRange: 5,
    near: { ring: 0.35, slam: 0.35, spiral: 0.3 },
    far: { spiral: 0.35, fan: 0.35, rain: 0.3 },
    patterns: {
      spiral: { name: '氷の渦', windup: 0.9, arms: 4, dur: 2.4, interval: 0.12, turn: 0.21, speed: 7.5, color: 0x80deea, twin: false, rageTwin: true },
      fan: { name: '氷柱の扇', windup: 0.6, count: 7, spread: 0.2, volleys: 4, interval: 0.28, speed: 13, color: 0xb3e5fc, alternate: true },
      ring: { name: '凍える輪', windup: 0.8, count: 20, speed: 7, color: 0x81d4fa, waves: 3, rageWaves: 4, waveGap: 0.3 },
      slam: { name: '氷塊落とし', windup: 0.7, air: 0.8, radius: 3.8, height: 6, ring: 12, rageRing: 18, color: 0x80deea },
      rain: { name: '雹の雨', windup: 0.5, count: 6, rageCount: 9, radius: 2.4, spreadR: 7, delay: 1.0, burst: 6, color: 0xb3e5fc },
    },
    rage: { at: 0.5, speedMul: 1.25, windupMul: 0.8, countMul: 1.3 },
    restMin: 0.6, restMax: 1.2,
    look: { scale: 2.0, horn: 0xe1f5fe, eye: 0x00e5ff, weapon: 'staff', metal: 0x1a237e },
  },

  // ---- ステージ2 ボス：全種類の弾幕＋手下召喚 ----
  zarvan: {
    name: '冥王ザルヴァーン', color: 0x6a1b9a,
    hp: 2300, def: 8, speed: 3.6, radius: 1.9, hpY: 7,
    shotHit: 1 / 5,
    nearRange: 7,
    near: { sweep: 0.3, slam: 0.2, ring: 0.2, spiral: 0.15, charge: 0.15 },
    far: { spiral: 0.25, fan: 0.25, rain: 0.2, ring: 0.15, slam: 0.15 },
    patterns: {
      sweep: { name: '冥刃', windup: 0.85, range: 6.5, arc: Math.PI * 1.25, after: 'ring' },
      ring: { name: '冥弾の輪', windup: 0.9, count: 22, speed: 8.5, color: 0xea80fc, waves: 3, rageWaves: 4, waveGap: 0.32 },
      spiral: { name: '冥獄の渦', windup: 0.9, arms: 4, dur: 2.6, interval: 0.11, turn: 0.2, speed: 7.5, color: 0xce93d8, twin: true },
      fan: { name: '冥槍の扇', windup: 0.6, count: 11, spread: 0.14, volleys: 4, interval: 0.3, speed: 13, color: 0xf48fb1, alternate: true },
      slam: { name: '冥王の鉄槌', windup: 0.85, air: 0.85, radius: 4.6, height: 8, ring: 16, rageRing: 24, color: 0xea80fc },
      charge: { name: '冥王の突撃', windup: 0.8, speed: 21, time: 0.9, width: 3.2, trailEvery: 0.06, trailSpeed: 6.5, color: 0xe040fb },
      rain: { name: '冥星の雨', windup: 0.6, count: 8, rageCount: 12, radius: 2.6, spreadR: 9, delay: 1.0, burst: 8, color: 0xea80fc },
    },
    rage: {
      at: 0.5, speedMul: 1.3, windupMul: 0.75, countMul: 1.3,
      summon: 'wraith', summonEvery: 18, summonMax: 3, summonOffset: [5, 2],
    },
    restMin: 0.5, restMax: 1.0,
    look: { scale: 2.8, horn: 0xffd54f, eye: 0xff1744, weapon: 'scythe', metal: 0x212121 },
  },
};

/** 1-3のボス（旧コードとの互換用） */
export const BOSS = BOSSES.galdra;
