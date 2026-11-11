// 敵・ボスのデータ
// ai: melee（近接）/ ranged（遠距離）/ charger（突進）。model は src/models.js の形状名
// 攻撃の威力は data/player.js の HIT（最大 HP の割合）で決まる
// 速度・予備動作・攻撃間隔は旧仕様から 速さ×1.3、予備動作×0.8、硬直×0.7、攻撃間隔×0.65 程度にした


/** ボスの HP にかける倍率（調整中の一時的なもの。1 で元どおり） */
export const BOSS_HP_MUL = 0.5;

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
 *   sweep 前方扇の近接（after で連続攻撃） / slam 跳躍叩きつけ（着地で ring 発の弾）
 *   ring 全方位弾（waves 回） / fan 狙い撃ちの扇弾（volleys 回） / spiral 渦巻き弾（arms 本。twin で逆回りも同時）
 *   charge 突進（trailEvery があれば通った跡から左右に弾） / rain 足元に落ちる隕石（赤円。着弾で burst 発の弾）
 *   beam 放射状の光線（dirs 本。twice でずらしてもう1回） / erupt 地割れ（プレイヤーの方へ手前から順に噴き上がる）
 *   nova 広がる衝撃波の輪（回避の無敵でくぐる） / teleport 標的の背後へ瞬間移動して then の技を出す
 *   whirl 回転しながら追ってきて周りを斬り続ける / pull 吸い寄せてから周りを爆発（走って逃げる）
 *   donut ドーナツ型の範囲（rIn の内側＝ボスの懐が安全） / stalker 足元を追いかける赤円が止まってから噴き上がる
 *   wall すき間が1か所ある壁が部屋を横切る（すき間をくぐる）
 * near / far：プレイヤーとの距離が nearRange 未満か以上かで選ぶパターンの重み
 * after：そのパターンのあと続けて出す追撃
 * shotHit：弾1発で削る最大 HP の割合。meleeHit：弾以外（近接・叩きつけ・突進・隕石・光線・輪）の割合（省略時は HIT.boss）
 * rage：HP 割合 at で怒り。speedMul・windupMul・countMul（弾の数の倍率）、summon で手下を呼ぶ
 * rage 中は rageWaves／rageRing／rageCount／rageTwin があればそちらを使う
 * 弾の間隔：輪は 12〜14 発、扇は 0.3 ラジアン以上あけて、すき間を走り抜けられるようにしている
 * look：見た目（models.js の makeBossModel）
 */
// ボスの hp は「剣士ひとり（人数補正 1）が攻撃できる時間 55% で倒すのにかかる秒数」から決めている：
// 中ボス 3分前後／2体同時の部屋は合わせて 4〜5分／最後のボス 5分（docs/balance/policy.md・bosses.md）
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

  // ---- ステージ2 中ボス1：剣の連撃・旋風・突進・炎の壁で攻める騎士 ----
  ignis: {
    name: '業火の騎士イグニス', color: 0xd84315,
    hp: 16600, def: 7, speed: 5.0, radius: 1.4, hpY: 5,
    shotHit: 1 / 7, meleeHit: 1 / 4.5, // 弾1発 約14%、それ以外 約22%（職業の HP で変わる）
    nearRange: 6,
    near: { sweep: 0.3, whirl: 0.2, donut: 0.1, nova: 0.1, charge: 0.1, erupt: 0.1, stalker: 0.1 },
    far: { charge: 0.25, erupt: 0.2, wall: 0.2, stalker: 0.2, fan: 0.15 },
    patterns: {
      sweep: { name: '炎の薙ぎ払い', windup: 0.7, range: 5.5, arc: Math.PI * 1.2, after: 'sweep2', color: 0xff7043 },
      sweep2: { kind: 'sweep', name: '返し斬り', windup: 0.4, range: 5.5, arc: Math.PI * 1.2, color: 0xff7043, after: 'sweep3' },
      sweep3: { kind: 'slam', name: '兜割り', windup: 0.45, air: 0.5, radius: 3.4, height: 4, ring: 0, rageRing: 8, color: 0xff7043 },
      whirl: { name: '炎の大旋風', windup: 0.7, radius: 3.4, speed: 3.6, tick: 0.35, dur: 2.2, rageDur: 3, color: 0xff7043 },
      donut: { name: '爆炎陣（懐が安全）', windup: 1.0, rIn: 3.2, rOut: 11, color: 0xff7043 },
      stalker: { name: '追い火柱', windup: 0.5, follow: 1.6, delay: 0.55, radius: 2.2, count: 2, rageCount: 3, gap: 0.5, color: 0xff5722 },
      wall: { name: '炎の壁', windup: 0.9, speed: 10, max: 40, thick: 1.2, gapW: 4.5, gapRange: 7, color: 0xff7043 },
      fan: { name: '火炎の扇', windup: 0.7, count: 5, spread: 0.32, volleys: 3, interval: 0.38, speed: 11, color: 0xff7043, alternate: true },
      charge: { name: '業火の突進', windup: 0.7, speed: 23, time: 0.8, width: 2.8, trailEvery: 0.16, trailSpeed: 5, color: 0xffab40, after: 'whirl' },
      erupt: { name: '炎の地割れ', windup: 0.55, count: 7, rageCount: 9, spacing: 2.6, gap: 0.11, radius: 1.8, color: 0xff5722 },
      nova: { name: '爆炎の波動', windup: 0.6, max: 16, speed: 9, width: 0.55, waves: 1, rageWaves: 2, gap: 0.7, color: 0xff7043 },
    },
    rage: { at: 0.5, speedMul: 1.25, windupMul: 0.75, countMul: 1.15 },
    restMin: 0.4, restMax: 0.9,
    look: { scale: 2.1, horn: 0xffcc80, eye: 0xffffff, weapon: 'sword', metal: 0x5d4037 },
  },

  // ---- ステージ2 中ボス2：瞬間移動・引き寄せ・光線・氷壁で翻弄する魔導士 ----
  frosga: {
    name: '氷霧の魔導士フロスガ', color: 0x4fc3f7,
    hp: 17500, def: 5, speed: 3.4, radius: 1.3, hpY: 5, keep: 9,
    shotHit: 1 / 7, meleeHit: 1 / 4.5,
    nearRange: 5,
    near: { blink: 0.25, pull: 0.15, donut: 0.15, nova: 0.15, slam: 0.15, ring: 0.15 },
    far: { beam: 0.2, stalker: 0.2, wall: 0.15, pull: 0.15, spiral: 0.1, rain: 0.1, fan: 0.1 },
    patterns: {
      blink: { kind: 'teleport', name: '氷霧の転移', windup: 0.6, dist: 4, then: 'nova' },
      pull: { name: '氷の渦潮（吸い寄せて爆発）', windup: 0.6, dur: 2.2, strength: 4.2, radius: 5.5, color: 0x80deea },
      donut: { name: '氷輪（懐が安全）', windup: 0.95, rIn: 3, rOut: 12, color: 0x80deea, after: 'nova' },
      stalker: { name: 'つらら追尾', windup: 0.45, follow: 1.4, delay: 0.5, radius: 2.2, count: 3, rageCount: 4, gap: 0.4, color: 0xb3e5fc },
      wall: { name: '氷壁', windup: 0.9, speed: 9, max: 40, thick: 1.2, gapW: 4.5, gapRange: 7, color: 0x80deea },
      nova: { name: '凍てつく波動', windup: 0.5, max: 14, speed: 8, width: 0.55, waves: 1, rageWaves: 2, gap: 0.8, color: 0x80deea },
      beam: { name: '氷槍の光線', windup: 0.85, dirs: 4, len: 26, width: 1.6, aim: true, twice: false, rageTwice: true, gap: 0.7, color: 0xb3e5fc },
      spiral: { name: '氷の渦', windup: 0.85, arms: 3, dur: 2.2, interval: 0.17, turn: 0.26, speed: 7, color: 0x80deea, twin: false, rageTwin: true },
      fan: { name: '氷柱の扇', windup: 0.55, count: 5, spread: 0.34, volleys: 3, interval: 0.36, speed: 12, color: 0xb3e5fc, alternate: true },
      ring: { name: '凍える輪', windup: 0.75, count: 12, speed: 7, color: 0x81d4fa, waves: 2, rageWaves: 3, waveGap: 0.45 },
      slam: { name: '氷塊落とし', windup: 0.65, air: 0.75, radius: 3.8, height: 6, ring: 8, rageRing: 12, color: 0x80deea },
      rain: { name: '雹の雨', windup: 0.5, count: 5, rageCount: 7, radius: 2.4, spreadR: 7, delay: 1.0, burst: 0, color: 0xb3e5fc },
    },
    rage: { at: 0.5, speedMul: 1.2, windupMul: 0.75, countMul: 1.15 },
    restMin: 0.5, restMax: 1.0,
    look: { scale: 2.0, horn: 0xe1f5fe, eye: 0x00e5ff, weapon: 'staff', metal: 0x1a237e },
  },

  // ---- ステージ2 ボス：全部の技を織り交ぜる＋手下召喚 ----
  zarvan: {
    name: '冥王ザルヴァーン', color: 0x6a1b9a,
    hp: 26900, def: 8, speed: 3.6, radius: 1.9, hpY: 7,
    shotHit: 1 / 8, meleeHit: 1 / 5,
    nearRange: 7,
    near: { sweep: 0.2, whirl: 0.1, donut: 0.1, pull: 0.1, slam: 0.1, nova: 0.1, blink: 0.1, charge: 0.1, ring: 0.1 },
    far: { beam: 0.15, wall: 0.15, stalker: 0.15, erupt: 0.15, blink: 0.1, spiral: 0.1, fan: 0.1, rain: 0.1 },
    patterns: {
      sweep: { name: '冥刃', windup: 0.85, range: 6.5, arc: Math.PI * 1.25, after: 'sweep2', color: 0xea80fc },
      sweep2: { kind: 'sweep', name: '冥刃・返し', windup: 0.5, range: 6.5, arc: Math.PI * 1.25, after: 'nova', color: 0xea80fc },
      whirl: { name: '冥王の大鎌旋風', windup: 0.75, radius: 4, speed: 3.2, tick: 0.35, dur: 2.4, rageDur: 3.2, color: 0xea80fc },
      donut: { name: '冥環（懐が安全）', windup: 1.0, rIn: 3.5, rOut: 14, color: 0xea80fc, after: 'whirl' },
      pull: { name: '冥府の渦（吸い寄せて爆発）', windup: 0.7, dur: 2.4, strength: 4.4, radius: 6.5, color: 0xce93d8, after: 'nova' },
      stalker: { name: '冥火の追跡', windup: 0.5, follow: 1.6, delay: 0.5, radius: 2.4, count: 3, rageCount: 5, gap: 0.45, color: 0xce93d8 },
      wall: { name: '冥炎の壁', windup: 0.9, speed: 10, max: 44, thick: 1.3, gapW: 4.5, gapRange: 8, color: 0xe040fb },
      nova: { name: '冥王の波動', windup: 0.5, max: 18, speed: 9, width: 0.6, waves: 1, rageWaves: 2, gap: 0.7, color: 0xea80fc },
      blink: { kind: 'teleport', name: '冥界渡り', windup: 0.65, dist: 4.5, then: 'sweep' },
      beam: { name: '冥光十字', windup: 0.95, dirs: 4, len: 30, width: 1.8, aim: false, twice: true, gap: 0.75, color: 0xea80fc },
      erupt: { name: '冥府の地割れ', windup: 0.6, count: 8, rageCount: 10, spacing: 2.6, gap: 0.11, radius: 1.9, color: 0xce93d8 },
      ring: { name: '冥弾の輪', windup: 0.9, count: 14, speed: 8, color: 0xea80fc, waves: 2, rageWaves: 3, waveGap: 0.45 },
      spiral: { name: '冥獄の渦', windup: 0.9, arms: 3, dur: 2.4, interval: 0.16, turn: 0.22, speed: 7, color: 0xce93d8, twin: true },
      fan: { name: '冥槍の扇', windup: 0.6, count: 7, spread: 0.3, volleys: 3, interval: 0.4, speed: 12, color: 0xf48fb1, alternate: true },
      slam: { name: '冥王の鉄槌', windup: 0.85, air: 0.85, radius: 4.6, height: 8, ring: 10, rageRing: 14, color: 0xea80fc },
      charge: { name: '冥王の突撃', windup: 0.8, speed: 21, time: 0.9, width: 3.2, trailEvery: 0.15, trailSpeed: 5.5, color: 0xe040fb },
      rain: { name: '冥星の雨', windup: 0.6, count: 6, rageCount: 8, radius: 2.6, spreadR: 9, delay: 1.0, burst: 4, color: 0xea80fc },
    },
    rage: {
      at: 0.5, speedMul: 1.25, windupMul: 0.8, countMul: 1.15,
      summon: 'wraith', summonEvery: 18, summonMax: 3, summonOffset: [5, 2],
    },
    restMin: 0.55, restMax: 1.1,
    look: { scale: 2.8, horn: 0xffd54f, eye: 0xff1744, weapon: 'scythe', metal: 0x212121 },
  },

  // ================= ステージ3「深淵の回廊」（5連戦。4・5戦目は2体同時） =================
  // ステージ2 より硬く（HP・防御）、1発が重い（弾 1/6・それ以外 1/3.5）。攻撃の間隔も短い

  // ---- 1戦目：鉄巨人ゴルゴス（遅いが一撃が重い。叩きつけと地割れ） ----
  golgoth: {
    name: '鉄巨人ゴルゴス', color: 0x546e7a,
    hp: 15300, def: 10, speed: 3.4, radius: 2.2, hpY: 7.5,
    shotHit: 1 / 6, meleeHit: 1 / 3.5,
    nearRange: 7,
    near: { sweep: 0.3, whirl: 0.15, donut: 0.15, slam: 0.15, nova: 0.15, erupt: 0.1 },
    far: { charge: 0.25, erupt: 0.2, wall: 0.2, stalker: 0.15, slam: 0.2 },
    patterns: {
      sweep: { name: '鉄塊の薙ぎ払い', windup: 0.8, range: 7, arc: Math.PI * 1.3, after: 'slam2', color: 0x90a4ae },
      slam2: { kind: 'slam', name: '鉄槌落とし', windup: 0.4, air: 0.5, radius: 4.5, height: 4, ring: 0, rageRing: 10, color: 0x90a4ae },
      whirl: { name: '鉄の大旋風', windup: 0.8, radius: 4.2, speed: 3, tick: 0.35, dur: 2.4, rageDur: 3.2, color: 0x90a4ae },
      donut: { name: '鉄環震（懐が安全）', windup: 1.0, rIn: 3.6, rOut: 14, color: 0x90a4ae, after: 'erupt' },
      slam: { name: '大地砕き', windup: 0.85, air: 0.8, radius: 5.2, height: 8, ring: 10, rageRing: 14, color: 0xb0bec5 },
      nova: { name: '鉄の衝撃波', windup: 0.6, max: 18, speed: 9, width: 0.65, waves: 2, rageWaves: 3, gap: 0.6, color: 0xb0bec5 },
      erupt: { name: '大地の裂け目', windup: 0.55, count: 9, rageCount: 11, spacing: 2.6, gap: 0.1, radius: 2.1, color: 0x8d6e63 },
      charge: { name: '鉄塊の突進', windup: 0.75, speed: 22, time: 1.0, width: 4, trailEvery: 0, color: 0x90a4ae, after: 'whirl' },
      wall: { name: '鉄の壁', windup: 0.9, speed: 10, max: 44, thick: 1.4, gapW: 4.5, gapRange: 8, color: 0x90a4ae },
      stalker: { name: '落石の追跡', windup: 0.5, follow: 1.5, delay: 0.5, radius: 2.6, count: 3, rageCount: 4, gap: 0.45, color: 0x8d6e63 },
    },
    rage: { at: 0.5, speedMul: 1.25, windupMul: 0.75, countMul: 1.15 },
    restMin: 0.4, restMax: 0.85,
    look: { scale: 3.0, horn: 0x90a4ae, eye: 0xff6d00, weapon: 'club', metal: 0x263238 },
  },

  // ---- 2戦目：風の魔女シルファ（速い。瞬間移動と光線・壁で翻弄） ----
  sylpha: {
    name: '風の魔女シルファ', color: 0x26a69a,
    hp: 17100, def: 6, speed: 4.6, radius: 1.3, hpY: 5, keep: 9,
    shotHit: 1 / 6, meleeHit: 1 / 3.5,
    nearRange: 5,
    near: { blink: 0.3, nova: 0.2, donut: 0.15, pull: 0.15, ring: 0.2 },
    far: { beam: 0.2, wall: 0.2, stalker: 0.2, fan: 0.15, spiral: 0.1, blink: 0.15 },
    patterns: {
      blink: { kind: 'teleport', name: '疾風の転移', windup: 0.5, dist: 4, then: 'nova' },
      nova: { name: '烈風の輪', windup: 0.45, max: 16, speed: 10, width: 0.55, waves: 2, rageWaves: 3, gap: 0.55, color: 0x80cbc4 },
      donut: { name: '風輪（懐が安全）', windup: 0.9, rIn: 3, rOut: 13, color: 0x80cbc4, after: 'blink' },
      pull: { name: '竜巻（吸い寄せて爆発）', windup: 0.6, dur: 2.2, strength: 4.8, radius: 6, color: 0x80cbc4, after: 'nova' },
      beam: { name: '風刃の光線', windup: 0.8, dirs: 6, len: 28, width: 1.5, aim: true, twice: true, gap: 0.6, color: 0xa7ffeb },
      wall: { name: '風の壁', windup: 0.8, speed: 12, max: 44, thick: 1.2, gapW: 4.2, gapRange: 8, color: 0x80cbc4 },
      stalker: { name: '追い風の刃', windup: 0.4, follow: 1.3, delay: 0.45, radius: 2.3, count: 4, rageCount: 5, gap: 0.35, color: 0xa7ffeb },
      fan: { name: '風切りの扇', windup: 0.5, count: 7, spread: 0.3, volleys: 4, interval: 0.32, speed: 14, color: 0xa7ffeb, alternate: true },
      spiral: { name: '旋風の渦', windup: 0.8, arms: 4, dur: 2.2, interval: 0.17, turn: 0.24, speed: 8, color: 0x80cbc4, twin: false, rageTwin: true },
      ring: { name: '風弾の輪', windup: 0.7, count: 14, speed: 8, color: 0x80cbc4, waves: 2, rageWaves: 3, waveGap: 0.4 },
    },
    rage: { at: 0.5, speedMul: 1.25, windupMul: 0.75, countMul: 1.15 },
    restMin: 0.4, restMax: 0.8,
    look: { scale: 2.0, horn: 0xa7ffeb, eye: 0x00e5ff, weapon: 'staff', metal: 0x004d40 },
  },

  // ---- 3戦目：毒の司祭ヴェクシス（範囲攻撃の嵐） ----
  vexis: {
    name: '毒の司祭ヴェクシス', color: 0x7cb342,
    hp: 17900, def: 8, speed: 3.6, radius: 1.6, hpY: 6,
    shotHit: 1 / 6, meleeHit: 1 / 3.5,
    nearRange: 6,
    near: { donut: 0.2, pull: 0.2, nova: 0.15, sweep: 0.2, ring: 0.1, erupt: 0.15 },
    far: { rain: 0.25, stalker: 0.2, erupt: 0.2, beam: 0.15, wall: 0.1, spiral: 0.1 },
    patterns: {
      sweep: { name: '毒鎌', windup: 0.7, range: 6, arc: Math.PI * 1.3, after: 'donut', color: 0xaeea00 },
      donut: { name: '毒の環（懐が安全）', windup: 0.85, rIn: 3.2, rOut: 13, color: 0xaeea00 },
      pull: { name: '毒沼の渦（吸い寄せて爆発）', windup: 0.6, dur: 2.4, strength: 4.6, radius: 6.5, color: 0xaeea00, after: 'nova' },
      nova: { name: '瘴気の波', windup: 0.5, max: 16, speed: 8.5, width: 0.6, waves: 2, rageWaves: 3, gap: 0.6, color: 0xc6ff00 },
      rain: { name: '毒の雨', windup: 0.5, count: 8, rageCount: 11, radius: 2.6, spreadR: 10, delay: 0.9, burst: 5, color: 0xc6ff00 },
      stalker: { name: '毒の追跡', windup: 0.4, follow: 1.5, delay: 0.45, radius: 2.4, count: 4, rageCount: 6, gap: 0.35, color: 0xaeea00 },
      erupt: { name: '腐蝕の地割れ', windup: 0.5, count: 9, rageCount: 11, spacing: 2.6, gap: 0.1, radius: 2, color: 0x9ccc65 },
      beam: { name: '腐蝕の光線', windup: 0.85, dirs: 4, len: 30, width: 1.8, aim: false, twice: true, gap: 0.65, color: 0xc6ff00 },
      wall: { name: '毒の壁', windup: 0.85, speed: 10, max: 44, thick: 1.3, gapW: 4.3, gapRange: 8, color: 0xaeea00 },
      ring: { name: '毒弾の輪', windup: 0.7, count: 14, speed: 8, color: 0xc6ff00, waves: 3, rageWaves: 4, waveGap: 0.4 },
      spiral: { name: '毒の渦', windup: 0.8, arms: 3, dur: 2.4, interval: 0.15, turn: 0.22, speed: 7.5, color: 0xaeea00, twin: true },
    },
    rage: { at: 0.5, speedMul: 1.25, windupMul: 0.75, countMul: 1.2 },
    restMin: 0.45, restMax: 0.9,
    look: { scale: 2.3, horn: 0xc6ff00, eye: 0xc6ff00, weapon: 'scythe', metal: 0x33691e },
  },

  // ---- 4戦目（2体同時）：双子の剣士カイン（近接）と魔弓のアベル（遠距離） ----
  kain: {
    name: '紅の双剣カイン', color: 0xc62828,
    hp: 10800, def: 8, speed: 5.4, radius: 1.3, hpY: 5,
    shotHit: 1 / 6, meleeHit: 1 / 3.5,
    nearRange: 6,
    near: { sweep: 0.35, whirl: 0.25, nova: 0.15, donut: 0.1, erupt: 0.15 },
    far: { charge: 0.35, stalker: 0.25, erupt: 0.2, blink: 0.2 },
    patterns: {
      sweep: { name: '紅蓮斬', windup: 0.6, range: 5.5, arc: Math.PI * 1.2, after: 'sweep2', color: 0xff5252 },
      sweep2: { kind: 'sweep', name: '紅蓮・返し', windup: 0.35, range: 5.5, arc: Math.PI * 1.2, after: 'sweep3', color: 0xff5252 },
      sweep3: { kind: 'sweep', name: '紅蓮・断', windup: 0.4, range: 6.5, arc: Math.PI * 0.8, color: 0xff1744 },
      whirl: { name: '双剣の旋風', windup: 0.55, radius: 3.4, speed: 4.4, tick: 0.3, dur: 2.2, rageDur: 2.8, color: 0xff5252 },
      nova: { name: '紅の波動', windup: 0.5, max: 14, speed: 9, width: 0.55, waves: 1, rageWaves: 2, gap: 0.6, color: 0xff5252 },
      donut: { name: '紅環（懐が安全）', windup: 0.85, rIn: 3, rOut: 11, color: 0xff5252 },
      erupt: { name: '紅の地割れ', windup: 0.5, count: 8, rageCount: 10, spacing: 2.6, gap: 0.1, radius: 1.9, color: 0xff1744 },
      charge: { name: '紅の突撃', windup: 0.6, speed: 24, time: 0.8, width: 3, trailEvery: 0, color: 0xff5252, after: 'sweep' },
      stalker: { name: '紅火の追跡', windup: 0.4, follow: 1.4, delay: 0.45, radius: 2.2, count: 3, rageCount: 4, gap: 0.4, color: 0xff1744 },
      blink: { kind: 'teleport', name: '紅の瞬身', windup: 0.5, dist: 3.5, then: 'sweep' },
    },
    rage: { at: 0.5, speedMul: 1.25, windupMul: 0.75, countMul: 1.15 },
    restMin: 0.8, restMax: 1.5, // 2体同時なので片方ずつの間は少し長め
    look: { scale: 2.0, horn: 0xffcdd2, eye: 0xffffff, weapon: 'sword', metal: 0x4a0000 },
  },
  abel: {
    name: '蒼の魔弓アベル', color: 0x1565c0,
    hp: 11400, def: 6, speed: 3.8, radius: 1.3, hpY: 5, keep: 11,
    shotHit: 1 / 6, meleeHit: 1 / 3.5,
    nearRange: 6,
    near: { blink: 0.3, nova: 0.25, ring: 0.2, donut: 0.25 },
    far: { fan: 0.25, beam: 0.2, wall: 0.2, rain: 0.15, spiral: 0.2 },
    patterns: {
      blink: { kind: 'teleport', name: '蒼の転移', windup: 0.55, dist: 9, then: 'fan' },
      nova: { name: '蒼の波動', windup: 0.5, max: 14, speed: 9, width: 0.55, waves: 1, rageWaves: 2, gap: 0.6, color: 0x82b1ff },
      donut: { name: '蒼環（懐が安全）', windup: 0.85, rIn: 3, rOut: 12, color: 0x82b1ff },
      ring: { name: '蒼矢の輪', windup: 0.65, count: 14, speed: 9, color: 0x82b1ff, waves: 2, rageWaves: 3, waveGap: 0.4 },
      fan: { name: '蒼の連射', windup: 0.45, count: 5, spread: 0.3, volleys: 5, interval: 0.28, speed: 16, color: 0x82b1ff, alternate: true },
      beam: { name: '蒼の貫光', windup: 0.75, dirs: 3, len: 32, width: 1.5, aim: true, twice: true, gap: 0.55, color: 0x82b1ff },
      wall: { name: '蒼の矢壁', windup: 0.8, speed: 12, max: 44, thick: 1.2, gapW: 4.3, gapRange: 8, color: 0x82b1ff },
      rain: { name: '蒼矢の雨', windup: 0.5, count: 7, rageCount: 9, radius: 2.4, spreadR: 9, delay: 0.9, burst: 0, color: 0x82b1ff },
      spiral: { name: '蒼の渦', windup: 0.75, arms: 3, dur: 2.2, interval: 0.16, turn: 0.24, speed: 8, color: 0x82b1ff, twin: false, rageTwin: true },
    },
    rage: { at: 0.5, speedMul: 1.25, windupMul: 0.75, countMul: 1.15 },
    restMin: 0.8, restMax: 1.5,
    look: { scale: 2.0, horn: 0xbbdefb, eye: 0x82b1ff, weapon: 'staff', metal: 0x0d47a1 },
  },

  // ---- 5戦目（2体同時）：深淵王ネザル（近接の王）と深淵の女王リリス（魔法の女王） ----
  nezal: {
    name: '深淵王ネザル', color: 0x263238,
    hp: 12800, def: 10, speed: 4.0, radius: 2.0, hpY: 7.5,
    shotHit: 1 / 6, meleeHit: 1 / 3.2,
    nearRange: 7,
    near: { sweep: 0.25, whirl: 0.2, slam: 0.15, donut: 0.15, pull: 0.1, nova: 0.15 },
    far: { beam: 0.2, wall: 0.2, erupt: 0.2, charge: 0.2, stalker: 0.2 },
    patterns: {
      sweep: { name: '深淵斬', windup: 0.7, range: 7, arc: Math.PI * 1.3, after: 'sweep2', color: 0x7c4dff },
      sweep2: { kind: 'sweep', name: '深淵斬・返し', windup: 0.4, range: 7, arc: Math.PI * 1.3, after: 'nova', color: 0x7c4dff },
      whirl: { name: '深淵の大旋風', windup: 0.7, radius: 4.4, speed: 3.6, tick: 0.3, dur: 2.6, rageDur: 3.4, color: 0x7c4dff },
      slam: { name: '王の鉄槌', windup: 0.75, air: 0.75, radius: 5, height: 9, ring: 10, rageRing: 14, color: 0x7c4dff },
      donut: { name: '深淵環（懐が安全）', windup: 0.9, rIn: 3.6, rOut: 15, color: 0x7c4dff, after: 'whirl' },
      pull: { name: '深淵の渦（吸い寄せて爆発）', windup: 0.6, dur: 2.4, strength: 5, radius: 7, color: 0x651fff, after: 'nova' },
      nova: { name: '深淵の波動', windup: 0.45, max: 20, speed: 10, width: 0.65, waves: 2, rageWaves: 3, gap: 0.55, color: 0x7c4dff },
      beam: { name: '深淵十字', windup: 0.85, dirs: 4, len: 34, width: 2, aim: false, twice: true, rageTwice: true, gap: 0.6, color: 0xb388ff },
      wall: { name: '深淵の壁', windup: 0.85, speed: 11, max: 48, thick: 1.4, gapW: 4.2, gapRange: 9, color: 0x7c4dff },
      erupt: { name: '深淵の地割れ', windup: 0.5, count: 10, rageCount: 12, spacing: 2.6, gap: 0.1, radius: 2.1, color: 0x651fff },
      charge: { name: '王の突撃', windup: 0.7, speed: 24, time: 0.9, width: 3.6, trailEvery: 0.14, trailSpeed: 6, color: 0x7c4dff, after: 'whirl' },
      stalker: { name: '深淵の追跡', windup: 0.4, follow: 1.5, delay: 0.45, radius: 2.6, count: 4, rageCount: 6, gap: 0.35, color: 0x651fff },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.72, countMul: 1.15 },
    restMin: 0.75, restMax: 1.4,
    look: { scale: 3.0, horn: 0xffd54f, eye: 0x7c4dff, weapon: 'scythe', metal: 0x000000 },
  },
  lilith: {
    name: '深淵の女王リリス', color: 0xad1457,
    hp: 13800, def: 7, speed: 4.2, radius: 1.4, hpY: 5.5, keep: 10,
    shotHit: 1 / 6, meleeHit: 1 / 3.2,
    nearRange: 6,
    near: { blink: 0.3, nova: 0.2, donut: 0.2, ring: 0.15, pull: 0.15 },
    far: { spiral: 0.2, fan: 0.2, rain: 0.2, stalker: 0.2, beam: 0.2 },
    patterns: {
      blink: { kind: 'teleport', name: '女王の転移', windup: 0.5, dist: 4, then: 'nova' },
      nova: { name: '魅了の波動', windup: 0.45, max: 16, speed: 9.5, width: 0.6, waves: 2, rageWaves: 3, gap: 0.55, color: 0xff80ab },
      donut: { name: '女王の環（懐が安全）', windup: 0.85, rIn: 3, rOut: 13, color: 0xff80ab, after: 'blink' },
      pull: { name: '誘惑の渦（吸い寄せて爆発）', windup: 0.6, dur: 2.2, strength: 4.8, radius: 6.5, color: 0xff4081 },
      ring: { name: '薔薇弾の輪', windup: 0.65, count: 14, speed: 8.5, color: 0xff80ab, waves: 3, rageWaves: 4, waveGap: 0.4 },
      spiral: { name: '薔薇の渦', windup: 0.75, arms: 3, dur: 2.6, interval: 0.15, turn: 0.22, speed: 8, color: 0xff80ab, twin: true },
      fan: { name: '茨の扇', windup: 0.5, count: 7, spread: 0.3, volleys: 4, interval: 0.32, speed: 14, color: 0xff4081, alternate: true },
      rain: { name: '血の雨', windup: 0.5, count: 8, rageCount: 11, radius: 2.6, spreadR: 10, delay: 0.85, burst: 5, color: 0xff1744 },
      stalker: { name: '茨の追跡', windup: 0.4, follow: 1.4, delay: 0.45, radius: 2.4, count: 4, rageCount: 6, gap: 0.35, color: 0xff4081 },
      beam: { name: '女王の十字光', windup: 0.8, dirs: 4, len: 32, width: 1.7, aim: true, twice: true, gap: 0.6, color: 0xff80ab },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.72, countMul: 1.2 },
    restMin: 0.75, restMax: 1.4,
    look: { scale: 2.4, horn: 0xffd54f, eye: 0xff4081, weapon: 'staff', metal: 0x4a0026 },
  },

  // ================= ステージ4「竜の高原」（屋外。竜・獣・多頭の蛇。人型ではない） =================
  // ステージ3 よりさらに硬く重い（弾 1/5.5・それ以外 1/3.2）。見た目は models.js の makeMonsterModel

  // ---- 1戦目：飛竜ワイバーン（速い。突進・炎の扇・炎の壁） ----
  wyvern: {
    name: '飛竜ワイバーン', color: 0xbf360c,
    hp: 15700, def: 9, speed: 5.4, radius: 2.2, hpY: 7,
    shotHit: 1 / 5.5, meleeHit: 1 / 3.2,
    nearRange: 7,
    near: { sweep: 0.25, whirl: 0.15, nova: 0.15, slam: 0.15, donut: 0.15, charge: 0.15 },
    far: { charge: 0.3, fan: 0.2, wall: 0.2, stalker: 0.15, rain: 0.15 },
    patterns: {
      sweep: { name: '尾の薙ぎ払い', windup: 0.65, range: 7, arc: Math.PI * 1.4, after: 'fan', color: 0xff7043 },
      whirl: { name: '旋回する尾', windup: 0.6, radius: 4.4, speed: 4, tick: 0.3, dur: 2.2, rageDur: 3, color: 0xff7043 },
      nova: { name: '羽ばたきの衝撃', windup: 0.5, max: 18, speed: 10, width: 0.6, waves: 2, rageWaves: 3, gap: 0.55, color: 0xffab91 },
      slam: { name: '急降下', windup: 0.6, air: 0.9, radius: 5, height: 12, ring: 10, rageRing: 14, color: 0xff7043 },
      donut: { name: '炎の輪（懐が安全）', windup: 0.85, rIn: 3.8, rOut: 14, color: 0xff7043 },
      charge: { name: '滑空突進', windup: 0.6, speed: 26, time: 1.0, width: 4, trailEvery: 0.12, trailSpeed: 6, color: 0xff7043, after: 'nova' },
      fan: { name: '火炎の吐息', windup: 0.5, count: 7, spread: 0.3, volleys: 4, interval: 0.3, speed: 14, color: 0xff5722, alternate: true },
      wall: { name: '炎の壁', windup: 0.8, speed: 12, max: 48, thick: 1.4, gapW: 4.3, gapRange: 9, color: 0xff7043 },
      stalker: { name: '狙う火柱', windup: 0.4, follow: 1.4, delay: 0.45, radius: 2.6, count: 4, rageCount: 5, gap: 0.35, color: 0xff5722 },
      rain: { name: '火の雨', windup: 0.5, count: 8, rageCount: 11, radius: 2.6, spreadR: 10, delay: 0.85, burst: 4, color: 0xff7043 },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.72, countMul: 1.15 },
    restMin: 0.35, restMax: 0.75,
    look: { monster: 'dragon', scale: 1.7, horn: 0xffe0b2, eye: 0xffea00, belly: 0xffab91, wingColor: 0x8d2a0a },
  },

  // ---- 2戦目：大地獣ベヒモス（重い。叩きつけ・地割れ・突進） ----
  behemoth: {
    name: '大地獣ベヒモス', color: 0x5d4037,
    hp: 16200, def: 12, speed: 3.8, radius: 2.5, hpY: 6.5,
    shotHit: 1 / 5.5, meleeHit: 1 / 3.2,
    nearRange: 7,
    near: { sweep: 0.25, slam: 0.2, whirl: 0.15, donut: 0.15, nova: 0.15, erupt: 0.1 },
    far: { charge: 0.3, erupt: 0.3, wall: 0.2, stalker: 0.2 },
    patterns: {
      sweep: { name: '角の振り上げ', windup: 0.75, range: 7, arc: Math.PI * 1.2, after: 'slam2', color: 0xa1887f },
      slam2: { kind: 'slam', name: '踏みつけ', windup: 0.4, air: 0.5, radius: 5, height: 4, ring: 0, rageRing: 10, color: 0xa1887f },
      slam: { name: '大地震', windup: 0.85, air: 0.85, radius: 6, height: 9, ring: 12, rageRing: 16, color: 0x8d6e63 },
      whirl: { name: '暴れ回り', windup: 0.7, radius: 4.6, speed: 3.6, tick: 0.3, dur: 2.4, rageDur: 3.2, color: 0x8d6e63 },
      donut: { name: '地鳴り（懐が安全）', windup: 0.95, rIn: 4, rOut: 15, color: 0x8d6e63, after: 'erupt' },
      nova: { name: '咆哮の衝撃', windup: 0.55, max: 20, speed: 9.5, width: 0.7, waves: 2, rageWaves: 3, gap: 0.6, color: 0xbcaaa4 },
      erupt: { name: '大地の裂け目', windup: 0.5, count: 10, rageCount: 12, spacing: 2.6, gap: 0.09, radius: 2.2, color: 0x6d4c41 },
      charge: { name: '猛突進', windup: 0.7, speed: 25, time: 1.1, width: 4.6, trailEvery: 0, color: 0x8d6e63, after: 'nova' },
      wall: { name: '土の壁', windup: 0.8, speed: 11, max: 48, thick: 1.5, gapW: 4.3, gapRange: 9, color: 0x8d6e63 },
      stalker: { name: '落石', windup: 0.4, follow: 1.5, delay: 0.45, radius: 2.8, count: 4, rageCount: 6, gap: 0.35, color: 0x795548 },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.72, countMul: 1.15 },
    restMin: 0.4, restMax: 0.8,
    look: { monster: 'beast', scale: 2.2, horn: 0xfff8e1, eye: 0xff3d00, belly: 0x8d6e63, mane: 0x3e2723 },
  },

  // ---- 3戦目：三つ首ヒュドラ（3つの首から弾幕と毒） ----
  hydra: {
    name: '三つ首ヒュドラ', color: 0x00695c,
    hp: 17500, def: 9, speed: 3.2, radius: 2.3, hpY: 6.5, keep: 8,
    shotHit: 1 / 5.5, meleeHit: 1 / 3.2,
    nearRange: 6,
    near: { sweep: 0.2, donut: 0.2, pull: 0.2, nova: 0.2, ring: 0.2 },
    far: { spiral: 0.2, fan: 0.2, beam: 0.2, rain: 0.2, stalker: 0.2 },
    patterns: {
      sweep: { name: '三つ首の噛みつき', windup: 0.6, range: 6.5, arc: Math.PI * 1.3, after: 'ring', color: 0x4db6ac },
      donut: { name: '毒霧の輪（懐が安全）', windup: 0.85, rIn: 3.6, rOut: 14, color: 0x64ffda },
      pull: { name: '渦潮（吸い寄せて爆発）', windup: 0.6, dur: 2.4, strength: 5, radius: 7, color: 0x1de9b6, after: 'nova' },
      nova: { name: '三重の咆哮', windup: 0.5, max: 18, speed: 9.5, width: 0.6, waves: 3, rageWaves: 4, gap: 0.45, color: 0x64ffda },
      ring: { name: '毒弾の輪', windup: 0.65, count: 14, speed: 8.5, color: 0x1de9b6, waves: 3, rageWaves: 4, waveGap: 0.4 },
      spiral: { name: '三つ首の渦', windup: 0.75, arms: 3, dur: 2.8, interval: 0.14, turn: 0.22, speed: 8, color: 0x64ffda, twin: true },
      fan: { name: '三方向の吐息', windup: 0.5, count: 9, spread: 0.3, volleys: 4, interval: 0.3, speed: 14, color: 0x1de9b6, alternate: true },
      beam: { name: '三条の光線', windup: 0.8, dirs: 3, len: 34, width: 1.8, aim: true, twice: true, rageTwice: true, gap: 0.6, color: 0xa7ffeb },
      rain: { name: '酸の雨', windup: 0.5, count: 9, rageCount: 12, radius: 2.6, spreadR: 11, delay: 0.85, burst: 5, color: 0x1de9b6 },
      stalker: { name: '這い寄る毒', windup: 0.4, follow: 1.5, delay: 0.45, radius: 2.6, count: 5, rageCount: 6, gap: 0.3, color: 0x00bfa5 },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.72, countMul: 1.2 },
    restMin: 0.4, restMax: 0.8,
    look: { monster: 'hydra', scale: 1.8, horn: 0xe0f2f1, eye: 0xffea00, belly: 0x80cbc4 },
  },

  // ---- 4戦目（2体同時）：グリフォン（空から急襲）とマンティコア（毒の尾と弾） ----
  griffon: {
    name: '天翔けるグリフォン', color: 0xc8a165,
    hp: 10800, def: 8, speed: 5.8, radius: 1.9, hpY: 6,
    shotHit: 1 / 5.5, meleeHit: 1 / 3.2,
    nearRange: 6,
    near: { sweep: 0.3, whirl: 0.2, nova: 0.2, blink: 0.15, slam: 0.15 },
    far: { charge: 0.3, slam: 0.25, blink: 0.2, stalker: 0.25 },
    patterns: {
      sweep: { name: '鉤爪', windup: 0.55, range: 6, arc: Math.PI * 1.2, after: 'sweep2', color: 0xffe082 },
      sweep2: { kind: 'sweep', name: '鉤爪・返し', windup: 0.35, range: 6, arc: Math.PI * 1.2, color: 0xffe082 },
      whirl: { name: '旋風の羽ばたき', windup: 0.55, radius: 4, speed: 4.6, tick: 0.3, dur: 2.2, rageDur: 2.8, color: 0xffe082 },
      nova: { name: '突風', windup: 0.45, max: 16, speed: 10, width: 0.55, waves: 1, rageWaves: 2, gap: 0.55, color: 0xfff8e1 },
      blink: { kind: 'teleport', name: '急降下回り込み', windup: 0.45, dist: 4, then: 'sweep' },
      slam: { name: '天からの急襲', windup: 0.5, air: 1.0, radius: 4.6, height: 13, ring: 8, rageRing: 12, color: 0xffe082 },
      charge: { name: '低空滑空', windup: 0.55, speed: 27, time: 0.9, width: 3.4, trailEvery: 0, color: 0xffe082, after: 'whirl' },
      stalker: { name: '狙い定める影', windup: 0.4, follow: 1.3, delay: 0.4, radius: 2.4, count: 3, rageCount: 4, gap: 0.4, color: 0xffca28 },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.75, countMul: 1.15 },
    restMin: 0.75, restMax: 1.4,
    look: { monster: 'beast', wings: true, scale: 1.6, horn: 0xffca28, eye: 0xffea00, belly: 0xfff8e1, wingColor: 0xf5f5f5 },
  },
  manticore: {
    name: '毒尾のマンティコア', color: 0x8e2b2b,
    hp: 10800, def: 8, speed: 4.4, radius: 1.9, hpY: 6, keep: 9,
    shotHit: 1 / 5.5, meleeHit: 1 / 3.2,
    nearRange: 6,
    near: { sweep: 0.3, donut: 0.25, pull: 0.2, ring: 0.25 },
    far: { fan: 0.25, rain: 0.2, spiral: 0.2, wall: 0.15, beam: 0.2 },
    patterns: {
      sweep: { name: '毒尾の一撃', windup: 0.6, range: 6.5, arc: Math.PI * 1.1, after: 'ring', color: 0xce93d8 },
      donut: { name: '毒棘の輪（懐が安全）', windup: 0.85, rIn: 3.4, rOut: 13, color: 0xce93d8 },
      pull: { name: '毒の渦（吸い寄せて爆発）', windup: 0.6, dur: 2.2, strength: 4.8, radius: 6.5, color: 0xba68c8 },
      ring: { name: '毒棘の輪', windup: 0.6, count: 14, speed: 9, color: 0xce93d8, waves: 2, rageWaves: 3, waveGap: 0.4 },
      fan: { name: '毒棘の連射', windup: 0.45, count: 5, spread: 0.3, volleys: 5, interval: 0.28, speed: 16, color: 0xba68c8, alternate: true },
      rain: { name: '毒棘の雨', windup: 0.5, count: 8, rageCount: 10, radius: 2.5, spreadR: 10, delay: 0.85, burst: 0, color: 0xce93d8 },
      spiral: { name: '毒棘の渦', windup: 0.7, arms: 3, dur: 2.4, interval: 0.15, turn: 0.24, speed: 8, color: 0xba68c8, twin: false, rageTwin: true },
      wall: { name: '棘の壁', windup: 0.8, speed: 12, max: 48, thick: 1.3, gapW: 4.3, gapRange: 9, color: 0xce93d8 },
      beam: { name: '毒の貫光', windup: 0.75, dirs: 2, len: 34, width: 1.6, aim: true, twice: true, gap: 0.55, color: 0xea80fc },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.75, countMul: 1.15 },
    restMin: 0.75, restMax: 1.4,
    look: { monster: 'beast', scale: 1.7, horn: 0x212121, eye: 0xff1744, belly: 0xd7ccc8, mane: 0xbf360c },
  },

  // ---- 5戦目：古竜エルドラード（巨大。全部の技＋炎の大技） ----
  eldragon: {
    name: '古竜エルドラード', color: 0x4a148c,
    hp: 24400, def: 12, speed: 4.2, radius: 3.4, hpY: 11,
    shotHit: 1 / 5.5, meleeHit: 1 / 3,
    nearRange: 9,
    near: { sweep: 0.2, whirl: 0.15, slam: 0.15, donut: 0.15, pull: 0.1, nova: 0.15, charge: 0.1 },
    far: { beam: 0.15, wall: 0.15, rain: 0.15, stalker: 0.15, erupt: 0.15, fan: 0.1, spiral: 0.15 },
    patterns: {
      sweep: { name: '古竜の尾', windup: 0.7, range: 9, arc: Math.PI * 1.4, after: 'sweep2', color: 0xb388ff },
      sweep2: { kind: 'sweep', name: '尾の返し', windup: 0.45, range: 9, arc: Math.PI * 1.4, after: 'nova', color: 0xb388ff },
      whirl: { name: '竜巻の舞', windup: 0.7, radius: 6, speed: 3.6, tick: 0.3, dur: 2.6, rageDur: 3.4, color: 0xb388ff },
      slam: { name: '天空落とし', windup: 0.75, air: 1.1, radius: 7, height: 16, ring: 14, rageRing: 20, color: 0x7c4dff },
      donut: { name: '業火の環（懐が安全）', windup: 0.95, rIn: 5, rOut: 18, color: 0xff3d00, after: 'whirl' },
      pull: { name: '竜の吸気（吸い寄せて爆発）', windup: 0.6, dur: 2.6, strength: 5.2, radius: 8, color: 0xff6e40, after: 'nova' },
      nova: { name: '竜の咆哮', windup: 0.45, max: 24, speed: 11, width: 0.75, waves: 2, rageWaves: 3, gap: 0.5, color: 0xff6e40 },
      charge: { name: '古竜の突撃', windup: 0.7, speed: 26, time: 1.1, width: 6, trailEvery: 0.12, trailSpeed: 6, color: 0xff3d00, after: 'whirl' },
      beam: { name: '竜の息吹（十字）', windup: 0.85, dirs: 4, len: 38, width: 2.4, aim: true, twice: true, rageTwice: true, gap: 0.6, color: 0xff6e40 },
      wall: { name: '業火の壁', windup: 0.8, speed: 12, max: 52, thick: 1.6, gapW: 4.4, gapRange: 9, color: 0xff3d00 },
      rain: { name: '流星の雨', windup: 0.5, count: 10, rageCount: 14, radius: 2.8, spreadR: 12, delay: 0.85, burst: 5, color: 0xff6e40 },
      stalker: { name: '狙う業火', windup: 0.4, follow: 1.5, delay: 0.45, radius: 3, count: 5, rageCount: 7, gap: 0.3, color: 0xff3d00 },
      erupt: { name: '溶岩の裂け目', windup: 0.5, count: 11, rageCount: 13, spacing: 2.8, gap: 0.08, radius: 2.4, color: 0xff3d00 },
      fan: { name: '火炎の扇', windup: 0.5, count: 9, spread: 0.28, volleys: 4, interval: 0.3, speed: 15, color: 0xff6e40, alternate: true },
      spiral: { name: '炎の渦', windup: 0.75, arms: 4, dur: 2.6, interval: 0.15, turn: 0.22, speed: 8, color: 0xff6e40, twin: true },
    },
    rage: {
      at: 0.5, speedMul: 1.3, windupMul: 0.72, countMul: 1.2,
      summon: 'golem', summonEvery: 20, summonMax: 2, summonOffset: [7, 3],
    },
    restMin: 0.4, restMax: 0.85,
    look: { monster: 'dragon', scale: 2.9, horn: 0xffd54f, eye: 0xff3d00, belly: 0x9575cd, wingColor: 0x311b92 },
  },

  // ================= ステージ5「黄昏の古戦場」（屋外・夕方）。ステージ4 よりさらに硬く重い =================
  cerberus: {
    name: '地獄の番犬ケルベロス', color: 0x3e2723,
    hp: 16200, def: 10, speed: 6.0, radius: 2.2, hpY: 6.5,
    shotHit: 1 / 5, meleeHit: 1 / 3,
    nearRange: 7,
    near: { sweep: 0.3, whirl: 0.2, nova: 0.15, donut: 0.15, charge: 0.2 },
    far: { charge: 0.3, fan: 0.25, rain: 0.2, stalker: 0.25 },
    patterns: {
      sweep: { name: '三連噛みつき', windup: 0.55, range: 6.5, arc: Math.PI * 1.3, after: 'sweep2', color: 0xff5722 },
      sweep2: { kind: 'sweep', name: '噛みつき（二の首）', windup: 0.3, range: 6.5, arc: Math.PI * 1.3, after: 'sweep3', color: 0xff5722 },
      sweep3: { kind: 'sweep', name: '噛みつき（三の首）', windup: 0.3, range: 7, arc: Math.PI * 1.3, after: 'fan', color: 0xff3d00 },
      whirl: { name: '獄炎の旋回', windup: 0.55, radius: 4.4, speed: 4.6, tick: 0.28, dur: 2.4, rageDur: 3.2, color: 0xff5722 },
      nova: { name: '三つの咆哮', windup: 0.45, max: 18, speed: 10, width: 0.6, waves: 3, rageWaves: 4, gap: 0.4, color: 0xff7043 },
      donut: { name: '獄炎の輪（懐が安全）', windup: 0.8, rIn: 3.8, rOut: 15, color: 0xff3d00 },
      charge: { name: '地獄の突進', windup: 0.55, speed: 28, time: 1.0, width: 4.2, trailEvery: 0.1, trailSpeed: 6, color: 0xff3d00, after: 'whirl' },
      fan: { name: '三つ首の火炎', windup: 0.45, count: 9, spread: 0.28, volleys: 4, interval: 0.28, speed: 15, color: 0xff5722, alternate: true },
      rain: { name: '火の粉の雨', windup: 0.45, count: 10, rageCount: 13, radius: 2.6, spreadR: 11, delay: 0.8, burst: 4, color: 0xff7043 },
      stalker: { name: '追いかける業火', windup: 0.35, follow: 1.4, delay: 0.4, radius: 2.6, count: 5, rageCount: 7, gap: 0.3, color: 0xff3d00 },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.7, countMul: 1.2 },
    restMin: 0.3, restMax: 0.7,
    look: { monster: 'beast', scale: 2.0, horn: 0x212121, eye: 0xff3d00, belly: 0x5d4037, mane: 0xbf360c },
  },
  basilisk: {
    name: '双頭のバジリスク', color: 0x558b2f,
    hp: 16600, def: 11, speed: 3.6, radius: 2.4, hpY: 6.5, keep: 8,
    shotHit: 1 / 5, meleeHit: 1 / 3,
    nearRange: 6,
    near: { sweep: 0.25, pull: 0.2, donut: 0.2, nova: 0.15, erupt: 0.2 },
    far: { beam: 0.25, spiral: 0.15, rain: 0.2, erupt: 0.2, wall: 0.2 },
    patterns: {
      sweep: { name: '尾の打ち払い', windup: 0.6, range: 7, arc: Math.PI * 1.4, after: 'erupt', color: 0x9ccc65 },
      pull: { name: '毒霧の渦（吸い寄せて爆発）', windup: 0.55, dur: 2.4, strength: 5.2, radius: 7.5, color: 0x9ccc65, after: 'nova' },
      donut: { name: '石化の輪（懐が安全）', windup: 0.85, rIn: 4, rOut: 15, color: 0xcddc39 },
      nova: { name: '石化の波動', windup: 0.45, max: 20, speed: 10, width: 0.65, waves: 2, rageWaves: 3, gap: 0.45, color: 0xcddc39 },
      erupt: { name: '石の槍', windup: 0.45, count: 11, rageCount: 13, spacing: 2.6, gap: 0.08, radius: 2.3, color: 0x9e9d24 },
      beam: { name: '石化の眼光', windup: 0.75, dirs: 2, len: 36, width: 2.2, aim: true, twice: true, rageTwice: true, gap: 0.5, color: 0xeeff41 },
      spiral: { name: '毒の渦', windup: 0.7, arms: 4, dur: 2.6, interval: 0.14, turn: 0.22, speed: 8, color: 0x9ccc65, twin: true },
      rain: { name: '石の雨', windup: 0.45, count: 10, rageCount: 13, radius: 2.8, spreadR: 11, delay: 0.85, burst: 5, color: 0xafb42b },
      wall: { name: '石の壁', windup: 0.75, speed: 12, max: 48, thick: 1.5, gapW: 4.2, gapRange: 9, color: 0x9e9d24 },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.7, countMul: 1.2 },
    restMin: 0.35, restMax: 0.75,
    look: { monster: 'hydra', scale: 2.0, horn: 0xeeff41, eye: 0xeeff41, belly: 0x9ccc65 },
  },
  firebird: {
    name: '夕焼けの火の鳥', color: 0xff6d00,
    hp: 17500, def: 9, speed: 6.2, radius: 2.2, hpY: 7,
    shotHit: 1 / 5, meleeHit: 1 / 3,
    nearRange: 7,
    near: { nova: 0.25, whirl: 0.2, slam: 0.2, donut: 0.15, blink: 0.2 },
    far: { slam: 0.2, charge: 0.25, fan: 0.2, wall: 0.15, rain: 0.2 },
    patterns: {
      nova: { name: '炎の羽ばたき', windup: 0.4, max: 20, speed: 11, width: 0.6, waves: 2, rageWaves: 3, gap: 0.45, color: 0xffab40 },
      whirl: { name: '炎の竜巻', windup: 0.5, radius: 4.6, speed: 4.4, tick: 0.28, dur: 2.4, rageDur: 3.2, color: 0xff6d00 },
      slam: { name: '天からの急降下', windup: 0.5, air: 1.0, radius: 5.5, height: 15, ring: 14, rageRing: 20, color: 0xff6d00 },
      donut: { name: '炎の環（懐が安全）', windup: 0.8, rIn: 3.8, rOut: 15, color: 0xff6d00, after: 'nova' },
      blink: { kind: 'teleport', name: '火の粉に消える', windup: 0.45, dist: 4.5, then: 'whirl' },
      charge: { name: '炎の滑空', windup: 0.5, speed: 30, time: 1.0, width: 4, trailEvery: 0.08, trailSpeed: 6.5, color: 0xffab40, after: 'nova' },
      fan: { name: '炎の羽根', windup: 0.45, count: 11, spread: 0.26, volleys: 4, interval: 0.28, speed: 16, color: 0xffab40, alternate: true },
      wall: { name: '炎の壁', windup: 0.75, speed: 13, max: 48, thick: 1.4, gapW: 4.2, gapRange: 9, color: 0xff6d00 },
      rain: { name: '火の雨', windup: 0.45, count: 11, rageCount: 14, radius: 2.6, spreadR: 12, delay: 0.8, burst: 4, color: 0xff9100 },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.7, countMul: 1.2 },
    restMin: 0.3, restMax: 0.7,
    look: { monster: 'dragon', scale: 1.6, horn: 0xffd54f, eye: 0xffffff, belly: 0xffcc80, wingColor: 0xff9100 },
  },
  minotaur: {
    name: '猛牛ミノタウロス', color: 0x6d4c41,
    hp: 10400, def: 11, speed: 5.2, radius: 2.0, hpY: 6,
    shotHit: 1 / 5, meleeHit: 1 / 3,
    nearRange: 6,
    near: { sweep: 0.35, whirl: 0.25, slam: 0.2, nova: 0.2 },
    far: { charge: 0.45, erupt: 0.3, stalker: 0.25 },
    patterns: {
      sweep: { name: '大斧の薙ぎ', windup: 0.6, range: 6.5, arc: Math.PI * 1.3, after: 'sweep2', color: 0xbcaaa4 },
      sweep2: { kind: 'sweep', name: '大斧の返し', windup: 0.35, range: 6.5, arc: Math.PI * 1.3, color: 0xbcaaa4 },
      whirl: { name: '大斧の大回転', windup: 0.55, radius: 4.6, speed: 4.2, tick: 0.3, dur: 2.4, rageDur: 3, color: 0xbcaaa4 },
      slam: { name: '踏み砕き', windup: 0.6, air: 0.7, radius: 5, height: 6, ring: 10, rageRing: 14, color: 0x8d6e63 },
      nova: { name: '雄叫び', windup: 0.45, max: 16, speed: 10, width: 0.6, waves: 2, rageWaves: 3, gap: 0.5, color: 0xd7ccc8 },
      charge: { name: '猛牛突進', windup: 0.5, speed: 30, time: 1.1, width: 4, trailEvery: 0, color: 0x8d6e63, after: 'sweep' },
      erupt: { name: '地割れ', windup: 0.45, count: 10, rageCount: 12, spacing: 2.6, gap: 0.08, radius: 2.2, color: 0x6d4c41 },
      stalker: { name: '狙う蹄', windup: 0.35, follow: 1.3, delay: 0.4, radius: 2.6, count: 3, rageCount: 4, gap: 0.35, color: 0x8d6e63 },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.72, countMul: 1.15 },
    restMin: 0.7, restMax: 1.3,
    look: { monster: 'beast', scale: 1.8, horn: 0xfff8e1, eye: 0xff1744, belly: 0xa1887f, mane: 0x3e2723 },
  },
  harpy: {
    name: 'ハーピー女王', color: 0x7e57c2,
    hp: 11200, def: 8, speed: 6.4, radius: 1.8, hpY: 5.5, keep: 10,
    shotHit: 1 / 5, meleeHit: 1 / 3,
    nearRange: 6,
    near: { blink: 0.3, nova: 0.25, donut: 0.2, ring: 0.25 },
    far: { fan: 0.25, spiral: 0.2, beam: 0.2, wall: 0.15, rain: 0.2 },
    patterns: {
      blink: { kind: 'teleport', name: '風に乗る', windup: 0.4, dist: 9, then: 'fan' },
      nova: { name: '金切り声', windup: 0.4, max: 16, speed: 10, width: 0.55, waves: 2, rageWaves: 3, gap: 0.45, color: 0xb39ddb },
      donut: { name: '羽根の環（懐が安全）', windup: 0.8, rIn: 3.4, rOut: 13, color: 0xb39ddb },
      ring: { name: '羽根の輪', windup: 0.55, count: 14, speed: 9.5, color: 0xd1c4e9, waves: 3, rageWaves: 4, waveGap: 0.35 },
      fan: { name: '羽根の連射', windup: 0.4, count: 7, spread: 0.28, volleys: 5, interval: 0.26, speed: 17, color: 0xb39ddb, alternate: true },
      spiral: { name: '旋風の羽根', windup: 0.6, arms: 4, dur: 2.4, interval: 0.14, turn: 0.24, speed: 8.5, color: 0xd1c4e9, twin: false, rageTwin: true },
      beam: { name: '風の刃', windup: 0.65, dirs: 3, len: 34, width: 1.6, aim: true, twice: true, gap: 0.5, color: 0xede7f6 },
      wall: { name: '羽根の壁', windup: 0.7, speed: 13, max: 48, thick: 1.3, gapW: 4.2, gapRange: 9, color: 0xb39ddb },
      rain: { name: '羽根の雨', windup: 0.45, count: 9, rageCount: 12, radius: 2.4, spreadR: 11, delay: 0.8, burst: 0, color: 0xd1c4e9 },
    },
    rage: { at: 0.5, speedMul: 1.3, windupMul: 0.72, countMul: 1.2 },
    restMin: 0.7, restMax: 1.3,
    look: { monster: 'dragon', scale: 1.3, horn: 0xffd54f, eye: 0xffea00, belly: 0xd1c4e9, wingColor: 0x5e35b1 },
  },
  ragna: {
    name: '黄昏竜ラグナ', color: 0x8d1b0a,
    hp: 23800, def: 13, speed: 4.6, radius: 3.6, hpY: 11.5,
    shotHit: 1 / 5, meleeHit: 1 / 2.8,
    nearRange: 9,
    near: { sweep: 0.2, whirl: 0.15, slam: 0.15, donut: 0.15, pull: 0.1, nova: 0.15, charge: 0.1 },
    far: { beam: 0.15, wall: 0.15, rain: 0.15, stalker: 0.15, erupt: 0.15, fan: 0.1, spiral: 0.15 },
    patterns: {
      sweep: { name: '黄昏の尾', windup: 0.65, range: 9.5, arc: Math.PI * 1.4, after: 'sweep2', color: 0xff6e40 },
      sweep2: { kind: 'sweep', name: '尾の返し', windup: 0.4, range: 9.5, arc: Math.PI * 1.4, after: 'nova', color: 0xff6e40 },
      whirl: { name: '黄昏の竜巻', windup: 0.65, radius: 6.4, speed: 4, tick: 0.28, dur: 2.8, rageDur: 3.6, color: 0xff6e40 },
      slam: { name: '落日', windup: 0.7, air: 1.1, radius: 7.5, height: 18, ring: 16, rageRing: 22, color: 0xff3d00 },
      donut: { name: '日輪（懐が安全）', windup: 0.9, rIn: 5.2, rOut: 19, color: 0xff9100, after: 'whirl' },
      pull: { name: '夕闇の吸気（吸い寄せて爆発）', windup: 0.55, dur: 2.6, strength: 5.6, radius: 8.5, color: 0xff6e40, after: 'nova' },
      nova: { name: '竜の咆哮', windup: 0.4, max: 26, speed: 12, width: 0.8, waves: 3, rageWaves: 4, gap: 0.45, color: 0xff9e80 },
      charge: { name: '黄昏の突撃', windup: 0.6, speed: 28, time: 1.2, width: 6.4, trailEvery: 0.1, trailSpeed: 6.5, color: 0xff3d00, after: 'whirl' },
      beam: { name: '夕日の息吹（十字）', windup: 0.8, dirs: 4, len: 40, width: 2.6, aim: true, twice: true, rageTwice: true, gap: 0.55, color: 0xff9100 },
      wall: { name: '業火の壁', windup: 0.75, speed: 13, max: 52, thick: 1.7, gapW: 4.3, gapRange: 9, color: 0xff3d00 },
      rain: { name: '流星の雨', windup: 0.45, count: 12, rageCount: 16, radius: 2.9, spreadR: 13, delay: 0.8, burst: 5, color: 0xff6e40 },
      stalker: { name: '狙う夕日', windup: 0.35, follow: 1.5, delay: 0.4, radius: 3.1, count: 6, rageCount: 8, gap: 0.28, color: 0xff3d00 },
      erupt: { name: '溶岩の裂け目', windup: 0.45, count: 12, rageCount: 14, spacing: 2.8, gap: 0.07, radius: 2.5, color: 0xff3d00 },
      fan: { name: '火炎の扇', windup: 0.45, count: 11, spread: 0.26, volleys: 4, interval: 0.28, speed: 16, color: 0xff6e40, alternate: true },
      spiral: { name: '炎の渦', windup: 0.7, arms: 5, dur: 2.8, interval: 0.14, turn: 0.2, speed: 8.5, color: 0xff6e40, twin: true },
    },
    rage: {
      at: 0.5, speedMul: 1.3, windupMul: 0.7, countMul: 1.2,
      summon: 'golem', summonEvery: 18, summonMax: 2, summonOffset: [7, 3],
    },
    restMin: 0.35, restMax: 0.8,
    look: { monster: 'dragon', scale: 3.0, horn: 0xffab40, eye: 0xffea00, belly: 0xff8a65, wingColor: 0x4e1a0a },
  },
};

/** 1-3のボス（旧コードとの互換用） */
export const BOSS = BOSSES.galdra;
