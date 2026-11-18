// 職業 97〜114（タンク・ヒーラー・バッファー各4、デバッファー・ユニーク各3）。数の少ないロールを12職にそろえる
// 書き方は data/jobs.js と同じ（kind ごとの汎用処理は src/jobs.js の GENERIC）。ここで定義して jobs.js・jobs_c.js・roles.js などが読み込む
// 火力係数 power・支援係数 support は同じロールの職を目安にした仮の値（遊んでみて docs/balance で調整）

/** 追加する職の並び（職業選択の順） */
export const ORDER_E = [
  'rampart', 'turtle', 'sohei', 'warden',
  'herbalist', 'shrine', 'angel', 'druid',
  'tactician', 'smith', 'cheer', 'geomancer',
  'hexer', 'poisoner', 'binder',
  'puppeteer', 'contrarian', 'bounty',
];

/** ロール */
export const ROLES_E = {
  rampart: 'tank', turtle: 'tank', sohei: 'tank', warden: 'tank',
  herbalist: 'healer', shrine: 'healer', angel: 'healer', druid: 'healer',
  tactician: 'buffer', smith: 'buffer', cheer: 'buffer', geomancer: 'buffer',
  hexer: 'debuffer', poisoner: 'debuffer', binder: 'debuffer',
  puppeteer: 'unique', contrarian: 'unique', bounty: 'unique',
};

const meleeCombo = (m = 1) => [{ dur: 0.34, hit: 0.12, mult: 1.0 * m }, { dur: 0.34, hit: 0.12, mult: 1.05 * m }, { dur: 0.5, hit: 0.2, mult: 1.6 * m }];

export const JOBS_E = {
  // ---------------- タンク ----------------
  rampart: {
    name: '城壁騎士', role: '弾を止める壁を立てる', color: '#8d6e63',
    power: 1.3, support: 1,
    basic: { type: 'melee', combo: [{ dur: 0.42, hit: 0.15, mult: 1.2 }, { dur: 0.58, hit: 0.24, mult: 1.9 }], range: 2.7, arc: 2.4, heavyBonus: 0.3 },
    q: { id: 'rampbash', kind: 'cone', name: '城門打ち', desc: '大盾で前方を打ち据える（ブレイク大）', cd: 6, mult: 2.0, range: 3.6, arc: 1.6, color: 0xa1887f, brkMul: 2.5 },
    e: { id: 'rampwall', kind: 'zone', zone: 'aegis', name: '城壁', desc: '足元に6秒間の城壁。中に入った敵の攻撃を消し、中の味方の被ダメージ半減', cd: 14, radius: 4.5, dur: 6, color: 0xbcaaa4 },
    r: { id: 'rampfort', kind: 'selfbuff', name: '難攻不落', desc: '8秒間 被ダメージ -60%・挑発（ボスに狙われる）', buff: 'impregnable', dur: 8, vals: { dmgMul: 0.4 }, taunt: 8, color: 0x8d6e63, sound: 'slam', msg: '難攻不落！ ボスを引きつけた' },
    trait: '被ダメージ -20%、ノックバックしない',
    dmgTaken: 0.8, noKnock: true, breakMul: 1.5,
    look: { armorColor: 0x6d4c41, swordColor: 0xbcaaa4, swordLen: 0.7, cape: 0x4e342e, weapon: 'mace', bigShield: true },
  },
  turtle: {
    name: '甲羅闘士', role: '甲羅にこもって跳ね返す', color: '#66bb6a',
    power: 1.2, support: 1,
    basic: { type: 'melee', combo: meleeCombo(1), range: 2.5, arc: 2.4, heavyBonus: 0.3 },
    q: { id: 'shellguard', kind: 'selfbuff', name: '甲羅ごもり', desc: '3秒間 被ダメージ -75%・挑発（動きは遅くなる）', cd: 11, buff: 'shell', dur: 3, vals: { dmgMul: 0.25, speedMul: 0.4 }, taunt: 3, color: 0x66bb6a, msg: '甲羅にこもった' },
    e: { id: 'shellspin', kind: 'burst', name: '甲羅回転', desc: '甲羅で回って周りを4回 打つ', cd: 7, ticks: 4, every: 0.18, mult: 1.3, radius: 4, color: 0x81c784 },
    r: { id: 'shellmirror', kind: 'reflect', name: '甲羅返し', desc: '周り9mの敵弾をはね返して一番近い敵に返し、周りの味方も 6秒間 被ダメージ -40%', radius: 9, base: 1.5, per: 0.4, cap: 20, color: 0x43a047, team: { name: 'shellback', dur: 6, vals: { dmgMul: 0.6 }, msg: '甲羅返し！' } },
    trait: '攻撃を受けるたびに、近くの敵へ甲羅のとげで反撃する（攻撃力の 1.2倍）。被ダメージ -10%',
    thorns: 1.2, dmgTaken: 0.9, breakMul: 1.2,
    look: { armorColor: 0x2e7d32, swordColor: 0xc8e6c9, swordLen: 0.5, cape: 0x1b5e20, weapon: 'fist' },
  },
  sohei: {
    name: '僧兵', role: '耐えながら周りを癒す', color: '#ffb74d',
    power: 1.3, support: 1.2,
    basic: { type: 'melee', combo: [{ dur: 0.36, hit: 0.13, mult: 1.05 }, { dur: 0.36, hit: 0.13, mult: 1.1 }, { dur: 0.52, hit: 0.2, mult: 1.7 }], range: 3.2, arc: 2.6, heavyBonus: 0.35 },
    q: { id: 'naginatadash', kind: 'dash', name: '薙刀突き', desc: '薙刀を構えて前へ6m 突く', cd: 6, mult: 1.9, dist: 6, time: 0.24, width: 1.6, color: 0xffb74d },
    e: { id: 'fudo', kind: 'selfbuff', name: '不動', desc: '6秒間 被ダメージ -45%・毎秒 HP 3% 回復・挑発', cd: 14, buff: 'fudo', dur: 6, vals: { dmgMul: 0.55, regen: 0.03 }, taunt: 6, color: 0xff9800, msg: '不動の構え！' },
    r: { id: 'kongojin', kind: 'teambuff', name: '金剛陣', desc: '周り12mの味方 8秒間 被ダメージ -35%・毎秒 HP 2% 回復', radius: 12, buff: 'kongo', dur: 8, vals: { dmgMul: 0.65, regen: 0.02 }, color: 0xffa726, msg: '金剛陣！ 守りと回復' },
    trait: '周り5mの味方は毎秒 HP 0.5% 回復。被ダメージ -10%',
    auraRegen: 0.005, auraRadius: 5, dmgTaken: 0.9, breakMul: 1.1,
    look: { armorColor: 0xfafafa, swordColor: 0xeceff1, swordLen: 1.4, cape: 0x5d4037, weapon: 'spear' },
  },
  warden: {
    name: '鎖の番人', role: '鎖で縛って引き寄せる', color: '#78909c',
    power: 1.35, support: 1,
    basic: { type: 'melee', combo: meleeCombo(1.02), range: 3.0, arc: 2.2, heavyBonus: 0.3 },
    q: { id: 'chainhook', kind: 'shots', name: '鉤鎖', desc: '鎖を投げ、当たったボスを3秒間 鈍らせる（貫通）', cd: 6, speed: 30, mult: 1.6, size: 0.35, range: 16, pierce: true, color: 0x90a4ae, debuff: { name: 'slow', dur: 3, mul: 0.6 } },
    e: { id: 'chainoath', kind: 'selfbuff', name: '鎖の誓い', desc: '6秒間 被ダメージ -45%・挑発', cd: 13, buff: 'chainoath', dur: 6, vals: { dmgMul: 0.55 }, taunt: 6, color: 0x78909c, msg: '鎖の誓い！' },
    r: { id: 'chainprison', kind: 'zone', zone: 'field', name: '鎖の牢獄', desc: '一番近いボスを最大10m 引き寄せ、6秒間 鎖で締めつける（継続ダメージ）', at: 'boss', dist: 6, radius: 5, dur: 6, every: 0.4, mult: 0.9, pullBoss: 10, color: 0x546e7a },
    trait: '攻撃を受けるたびに、近くの敵へ鎖で反撃する（攻撃力の 1倍）。被ダメージ -15%',
    thorns: 1.0, dmgTaken: 0.85, breakMul: 1.2,
    look: { armorColor: 0x37474f, swordColor: 0x90a4ae, swordLen: 0.6, cape: 0x263238, weapon: 'mace' },
  },

  // ---------------- ヒーラー ----------------
  herbalist: {
    healer: true,
    name: '薬草師', role: '薬草を投げて癒す', color: '#9ccc65',
    power: 1.45, support: 1.6,
    basic: { type: 'shot', cd: 0.5, speed: 22, mult: 0.78, color: 0xaed581, size: 0.26, range: 22 },
    q: { id: 'herbtoss', kind: 'zone', zone: 'field', name: '薬草投げ', desc: '狙った場所に薬草をまき、5秒間 回復の場にする（敵には継続ダメージ）', cd: 8, at: 'aim', dist: 7, radius: 4.5, dur: 5, every: 0.5, mult: 0.35, heal: 0.02, color: 0x9ccc65 },
    e: { id: 'herbtea', kind: 'teamheal', name: '薬湯', desc: '周り8mの味方の HP を 25% 回復', cd: 11, radius: 8, amount: 0.25, color: 0xc5e1a5 },
    r: { id: 'panacea', kind: 'teambuff', name: '万能薬', desc: '全員 10秒間 毎秒 HP 4% 回復・被ダメージ -15%', buff: 'panacea', dur: 10, vals: { regen: 0.04, dmgMul: 0.85 }, color: 0x7cb342, msg: '万能薬！ みんな回復' },
    trait: '周り6mの味方は毎秒 HP 0.6% 回復',
    auraRegen: 0.006, auraRadius: 6, breakMul: 1,
    look: { armorColor: 0x558b2f, swordColor: 0xaed581, swordLen: 0.8, cape: 0x33691e, weapon: 'flask', hat: 0x8d6e63 },
  },
  shrine: {
    healer: true,
    name: '泉の巫女', role: '水で弾を流して癒す', color: '#4fc3f7',
    power: 1.4, support: 1.6,
    basic: { type: 'shot', cd: 0.5, speed: 20, mult: 0.75, color: 0x81d4fa, size: 0.28, range: 22, wobble: true },
    q: { id: 'purestream', kind: 'cleanse', name: '清流', desc: '周り6mの敵の攻撃を水で押し流す', cd: 8, radius: 6, mult: 0.8, color: 0x4fc3f7 },
    e: { id: 'springheal', kind: 'teamheal', name: '湧き水', desc: '周り8mの味方の HP を 22% 回復', cd: 10, radius: 8, amount: 0.22, color: 0x81d4fa },
    r: { id: 'holyspring', kind: 'zone', zone: 'field', name: '癒しの泉', desc: '足元を10秒間 泉にする（毎秒 HP 6% 回復、敵には継続ダメージ）', radius: 6, dur: 10, every: 0.5, heal: 0.03, mult: 0.3, color: 0x29b6f6 },
    trait: 'Q・E のクールダウンが 20% 短い',
    cdMul: 0.8, breakMul: 1,
    look: { armorColor: 0xfafafa, swordColor: 0x81d4fa, swordLen: 0.9, cape: 0xc62828, weapon: 'staff' },
  },
  angel: {
    healer: true,
    name: '天使', role: '大きく癒して守る', color: '#fff9c4',
    power: 1.4, support: 1.8,
    basic: { type: 'shot', cd: 0.5, speed: 24, mult: 0.75, color: 0xfffde7, size: 0.26, range: 22 },
    q: { id: 'halo', kind: 'teamheal', name: '光輪の癒し', desc: '周り10mの味方の HP を 30% 回復', cd: 10, radius: 10, amount: 0.3, color: 0xfff59d },
    e: { id: 'wingguard', kind: 'teambuff', name: '翼の守り', desc: '周り10mの味方 5秒間 被ダメージ -30%', cd: 14, radius: 10, buff: 'wingguard', dur: 5, vals: { dmgMul: 0.7 }, color: 0xfffde7, msg: '翼の守り！' },
    r: { id: 'resurrection', kind: 'reviveall', name: '再臨', desc: '倒れた仲間を全員 HP 40% で起こす（1回の挑戦で1度だけ）', hp: 0.4, oncePerRun: true, color: 0xffffff },
    trait: '周り6mの味方は毎秒 HP 0.8% 回復',
    auraRegen: 0.008, auraRadius: 6, breakMul: 1,
    look: { armorColor: 0xfafafa, swordColor: 0xfff59d, swordLen: 0.9, cape: 0xfffde7, weapon: 'staff' },
  },
  druid: {
    healer: true,
    name: 'ドルイド', role: '森の力で癒して打つ', color: '#689f38',
    power: 1.5, support: 1.5,
    basic: { type: 'shot', cd: 0.5, speed: 22, mult: 0.8, color: 0x8bc34a, size: 0.28, range: 22 },
    q: { id: 'thornseed', kind: 'shots', name: '茨の種', desc: '種を3つ撃つ。当たると5秒間 茨で削る', cd: 6, count: 3, spread: 0.15, speed: 24, mult: 0.8, size: 0.28, range: 20, color: 0x7cb342, dot: { mult: 0.25, every: 0.5, dur: 5 } },
    e: { id: 'groveTotem', kind: 'zone', zone: 'totem', name: '癒しの若木', desc: 'そばの味方が毎秒 HP 3% 回復する若木を10秒植える', cd: 14, radius: 7, dur: 10, color: 0x8bc34a, buff: { name: 'grove', vals: { regen: 0.03 } } },
    r: { id: 'wildgrowth', kind: 'zone', zone: 'field', name: '森の目覚め', desc: '足元を8秒間 森にする（味方は毎秒 HP 5% 回復、敵には強い継続ダメージ）', radius: 7, dur: 8, every: 0.4, heal: 0.02, mult: 0.8, color: 0x558b2f },
    trait: '回復の技が当たると自分の必殺ゲージも少し溜まる（周り6mの味方は毎秒 HP 0.4% 回復）',
    auraRegen: 0.004, auraRadius: 6, breakMul: 1,
    look: { armorColor: 0x33691e, swordColor: 0x8d6e63, swordLen: 1.0, cape: 0x1b5e20, weapon: 'staff', hat: 0x33691e },
  },

  // ---------------- バッファー ----------------
  tactician: {
    name: '軍師', role: '陣形で全員を強くする', color: '#5c6bc0',
    power: 1.3, support: 1.3,
    basic: { type: 'shot', cd: 0.5, speed: 24, mult: 0.8, color: 0x9fa8da, size: 0.26, range: 22 },
    q: { id: 'formation', kind: 'teambuff', name: '鶴翼の陣', desc: '周り10mの味方 8秒間 攻撃力 +20%・会心率 +10%', cd: 13, radius: 10, buff: 'formation', dur: 8, vals: { atkMul: 1.2, critAdd: 0.1 }, color: 0x7986cb, msg: '鶴翼の陣！' },
    e: { id: 'stratagem', kind: 'teamgauge', name: '献策', desc: '周り10mの味方の必殺ゲージ +10', cd: 14, radius: 10, amount: 10, color: 0x5c6bc0 },
    r: { id: 'allout', kind: 'teambuff', name: '全軍突撃', desc: '全員 12秒間 攻撃力 +35%・移動 +20%', buff: 'allout', dur: 12, vals: { atkMul: 1.35, speedMul: 1.2 }, color: 0x3949ab, msg: '全軍突撃！' },
    trait: 'Q・E のクールダウンが 15% 短い',
    cdMul: 0.85, breakMul: 1,
    look: { armorColor: 0x283593, swordColor: 0xfafafa, swordLen: 0.6, cape: 0x1a237e, weapon: 'staff', hat: 0x1a237e },
  },
  smith: {
    name: '鍛冶師', role: '武器と鎧を鍛え直す', color: '#ff7043',
    power: 1.35, support: 1.2,
    basic: { type: 'melee', combo: [{ dur: 0.4, hit: 0.15, mult: 1.15 }, { dur: 0.56, hit: 0.23, mult: 1.9 }], range: 2.6, arc: 2.2, heavyBonus: 0.4 },
    q: { id: 'sharpen', kind: 'teambuff', name: '研ぎ直し', desc: '周り8mの味方 10秒間 攻撃力 +25%', cd: 14, radius: 8, buff: 'sharpen', dur: 10, vals: { atkMul: 1.25 }, color: 0xff8a65, msg: '武器を研ぎ直した！' },
    e: { id: 'anvilstrike', kind: 'burst', name: '鎚打ち', desc: '鎚を叩きつけ、周りを3回 火花で打つ（ブレイク大）', cd: 7, ticks: 3, every: 0.22, mult: 1.6, radius: 4, color: 0xff7043, brkMul: 2 },
    r: { id: 'reforge', kind: 'teambuff', name: '鎧の打ち直し', desc: '全員にバリア（最大 HP の 30%）と 10秒間 被ダメージ -20%', buff: 'reforge', dur: 10, vals: { shield: 0.3, dmgMul: 0.8 }, color: 0xff5722, msg: '鎧を打ち直した！' },
    trait: 'ブレイク値 1.4倍',
    breakMul: 1.4,
    look: { armorColor: 0x4e342e, swordColor: 0x9e9e9e, swordLen: 0.6, cape: 0x3e2723, weapon: 'mace' },
  },
  cheer: {
    name: '応援団', role: '声援で足と心を軽くする', color: '#ffca28',
    power: 1.3, support: 1.4,
    basic: { type: 'shot', cd: 0.45, speed: 22, mult: 0.75, color: 0xffe082, size: 0.26, range: 20, wobble: true },
    q: { id: 'fightsong', kind: 'teambuff', name: 'フレー！', desc: '周り10mの味方 8秒間 移動 +30%・攻撃力 +10%', cd: 12, radius: 10, buff: 'fightsong', dur: 8, vals: { speedMul: 1.3, atkMul: 1.1 }, color: 0xffca28, msg: 'フレー！フレー！' },
    e: { id: 'megaphone', kind: 'teamgauge', name: '大声援', desc: '周り12mの味方の必殺ゲージ +12', cd: 15, radius: 12, amount: 12, color: 0xffb300 },
    r: { id: 'bigcheer', kind: 'teambuff', name: '大応援', desc: '全員 12秒間 攻撃力 +30%・与ダメの10% を吸う・毎秒 HP 2% 回復', buff: 'bigcheer', dur: 12, vals: { atkMul: 1.3, lifesteal: 0.1, regen: 0.02 }, color: 0xffa000, msg: '大応援！ みんな元気いっぱい' },
    trait: '10% の確率で攻撃のダメージが2倍（声援の後押し）',
    luckyChance: 0.1, breakMul: 1,
    look: { armorColor: 0xb71c1c, swordColor: 0xffca28, swordLen: 0.6, cape: 0xffd600, weapon: 'staff', hat: 0xb71c1c },
  },
  geomancer: {
    name: '風水師', role: '地脈の力で場を整える', color: '#26a69a',
    power: 1.35, support: 1.2,
    basic: { type: 'shot', cd: 0.5, speed: 22, mult: 0.82, color: 0x4db6ac, size: 0.28, range: 22 },
    q: { id: 'leyline', kind: 'zone', zone: 'totem', name: '龍穴', desc: 'そばの味方の攻撃力 +20%・会心率 +15% の陣を10秒置く', cd: 14, radius: 7, dur: 10, color: 0x26a69a, buff: { name: 'leyline', vals: { atkMul: 1.2, critAdd: 0.15 } } },
    e: { id: 'compass', kind: 'zone', zone: 'strike', name: '羅盤の一撃', desc: '狙った場所に1秒後 地脈を噴き出させる', cd: 6, at: 'aim', dist: 8, radius: 4, dur: 1, mult: 3.2, color: 0x4db6ac },
    r: { id: 'dragonvein', kind: 'teambuff', name: '龍脈開放', desc: '全員 12秒間 攻撃力 +25%・会心率 +25%・被ダメージ -15%', buff: 'dragonvein', dur: 12, vals: { atkMul: 1.25, critAdd: 0.25, dmgMul: 0.85 }, color: 0x00897b, msg: '龍脈開放！' },
    trait: '会心率 +10%',
    critBonus: 0.1, breakMul: 1,
    look: { armorColor: 0x00695c, swordColor: 0xffd54f, swordLen: 0.8, cape: 0x004d40, weapon: 'staff', hat: 0x212121 },
  },

  // ---------------- デバッファー ----------------
  hexer: {
    name: '呪術師', role: 'ボスを呪って弱らせる', color: '#8e24aa',
    power: 1.3, support: 1,
    basic: { type: 'shot', cd: 0.55, speed: 20, mult: 0.7, color: 0xba68c8, size: 0.28, range: 22, dot: { mult: 0.12, every: 0.5, dur: 3 } },
    q: { id: 'curseweak', kind: 'debuff', name: '弱りの呪い', desc: '一番近いボスの攻撃力を6秒間 30% 下げる', cd: 12, color: 0x8e24aa, debuffs: [{ name: 'weak', dur: 6, mul: 0.7 }] },
    e: { id: 'hexbolt', kind: 'shots', name: '呪弾', desc: '当たると6秒間 呪いで削る弾を撃つ', cd: 6, speed: 24, mult: 1.2, size: 0.35, range: 22, color: 0xab47bc, dot: { mult: 0.35, every: 0.5, dur: 6 } },
    r: { id: 'grandcurse', kind: 'debuff', name: '大呪詛', desc: 'ボスに10秒間 被ダメージ +25%・攻撃力 -30%・動き -30%', color: 0x6a1b9a, debuffs: [{ name: 'vuln', dur: 10, mul: 1.25 }, { name: 'weak', dur: 10, mul: 0.7 }, { name: 'slow', dur: 10, mul: 0.7 }] },
    trait: 'ブレイク値 1.1倍',
    breakMul: 1.1,
    look: { armorColor: 0x4a148c, swordColor: 0xce93d8, swordLen: 0.8, cape: 0x311b92, weapon: 'staff', hat: 0x4a148c },
  },
  poisoner: {
    name: '毒使い', role: '毒の霧で削り続ける', color: '#76ff03',
    power: 1.35, support: 1,
    basic: { type: 'shot', cd: 0.45, speed: 24, mult: 0.7, color: 0xb2ff59, size: 0.24, range: 22, dot: { mult: 0.1, every: 0.5, dur: 3 } },
    q: { id: 'poisoncloud', kind: 'cone', name: '毒霧', desc: '前方に毒の霧を吹き、6秒間 削り続ける', cd: 6, mult: 0.8, range: 6, arc: 1.4, color: 0x76ff03, melee: false, sound: 'wave', dot: { mult: 0.35, every: 0.5, dur: 6 } },
    e: { id: 'toxicpool', kind: 'zone', zone: 'field', name: '毒沼', desc: '狙った場所を6秒間 毒沼にする（継続ダメージ）', cd: 9, at: 'aim', dist: 8, radius: 4.5, dur: 6, every: 0.4, mult: 0.6, color: 0x64dd17 },
    r: { id: 'plague', kind: 'debuff', name: '疫病', desc: 'ボスを8秒間 病にする（被ダメージ +20%・攻撃力 -20%）', color: 0x33691e, debuffs: [{ name: 'vuln', dur: 8, mul: 1.2 }, { name: 'weak', dur: 8, mul: 0.8 }] },
    trait: '会心率 +10%（弱った急所を狙う）',
    critBonus: 0.1, breakMul: 1,
    look: { armorColor: 0x33691e, swordColor: 0x76ff03, swordLen: 0.5, cape: 0x1b5e20, weapon: 'flask' },
  },
  binder: {
    name: '影縫い', role: '影を縫い止めて動きを止める', color: '#455a64',
    power: 1.35, support: 1,
    basic: { type: 'shot', cd: 0.42, speed: 32, mult: 0.75, color: 0x90a4ae, size: 0.2, range: 24 },
    q: { id: 'shadowpin', kind: 'shots', name: '影縫い針', desc: '針を3本 撃つ。当たったボスを2秒間 大きく鈍らせる', cd: 7, count: 3, spread: 0.1, speed: 34, mult: 0.8, size: 0.2, range: 24, color: 0x607d8b, debuff: { name: 'slow', dur: 2, mul: 0.4 } },
    e: { id: 'kagemuguri', kind: 'blinkbehind', name: '影潜り', desc: '一番近いボスの背後へ潜り込んで突く', cd: 8, mult: 1.8, color: 0x37474f },
    r: { id: 'shadowprison', kind: 'zone', zone: 'field', name: '影の牢', desc: '一番近いボスを最大8m 引き寄せ、6秒間 影で縛る（継続ダメージ・動き -50%）', at: 'boss', dist: 6, radius: 5, dur: 6, every: 0.4, mult: 0.8, pullBoss: 8, color: 0x263238, debuff: { name: 'slow', dur: 6, mul: 0.5 } },
    trait: 'ブレイク値 1.25倍',
    breakMul: 1.25,
    look: { armorColor: 0x212121, swordColor: 0x90a4ae, swordLen: 0.5, cape: 0x263238, weapon: 'sword' },
  },

  // ---------------- ユニーク ----------------
  puppeteer: {
    name: '人形使い', role: '人形に戦わせる', color: '#f06292',
    power: 1.5, support: 1,
    basic: { type: 'shot', cd: 0.5, speed: 22, mult: 0.75, color: 0xf8bbd0, size: 0.24, range: 22 },
    q: { id: 'puppet', kind: 'zone', zone: 'turret', name: '人形を出す', desc: '足元に12秒間 自動で糸を飛ばす人形を出す', cd: 10, radius: 1, dur: 12, every: 0.45, mult: 0.7, range: 22, color: 0xf06292 },
    e: { id: 'stringcut', kind: 'cone', name: '糸裂き', desc: '前方を鋼の糸で切り裂く', cd: 5, mult: 1.8, range: 5, arc: 1.6, color: 0xf8bbd0, melee: false },
    r: { id: 'bigpuppet', kind: 'zone', zone: 'turret', name: '大操り人形', desc: '15秒間 爆発する弾を撃つ大きな人形を出す', radius: 1, dur: 15, every: 0.6, mult: 1.5, range: 24, explode: 2.6, color: 0xec407a },
    trait: '回避の無敵時間が 0.1秒 長い（糸で身をかわす）',
    dodgeInvulnBonus: 0.1, breakMul: 1,
    look: { armorColor: 0x880e4f, swordColor: 0xf8bbd0, swordLen: 0.5, cape: 0x4a148c, weapon: 'staff', hat: 0x212121 },
  },
  contrarian: {
    name: '天邪鬼', role: '受けて返す、裏をかく', color: '#e53935',
    power: 1.55, support: 1,
    basic: { type: 'melee', combo: [{ dur: 0.28, hit: 0.1, mult: 0.95 }, { dur: 0.28, hit: 0.1, mult: 1.0 }, { dur: 0.45, hit: 0.17, mult: 1.6 }], range: 2.6, arc: 2.4, heavyBonus: 0.3 },
    q: { id: 'sakasa', kind: 'counter', name: '逆さ返し', desc: '0.8秒 構え、受けたら3倍で返す', cd: 8, dur: 0.8, mult: 3, range: 5, color: 0xe53935 },
    e: { id: 'uragaeri', kind: 'blinkbehind', name: '裏返り', desc: '一番近いボスの背後へ回り込んで斬る', cd: 7, mult: 1.9, color: 0xc62828 },
    r: { id: 'amanojaku', kind: 'reflect', name: 'あべこべ', desc: '周り10mの敵弾をはね返して一番近い敵に返し、周りの味方も 8秒間 攻撃力 +30%', radius: 10, base: 2, per: 0.4, cap: 20, color: 0xd50000, team: { name: 'abekobe', dur: 8, vals: { atkMul: 1.3 }, msg: 'あべこべ！' } },
    trait: '25% の確率で攻撃がすり抜ける',
    evade: 0.25, breakMul: 1,
    look: { armorColor: 0xb71c1c, swordColor: 0xeceff1, swordLen: 0.8, cape: 0x212121, weapon: 'sword' },
  },
  bounty: {
    name: '賞金稼ぎ', role: '獲物に印を付けて仕留める', color: '#a1887f',
    power: 1.5, support: 1,
    basic: { type: 'shot', cd: 0.4, speed: 34, mult: 0.85, color: 0xffcc80, size: 0.2, range: 26 },
    q: { id: 'wanted', kind: 'mark', name: '手配書', desc: '一番近いボスに印。12秒間 そのボスへの自分のダメージ 1.5倍', cd: 14, dur: 12, color: 0xff7043 },
    e: { id: 'lasso', kind: 'shots', name: '投げ縄', desc: '当たったボスを3秒間 鈍らせる縄を投げる', cd: 7, speed: 26, mult: 1.0, size: 0.45, range: 18, color: 0xbcaaa4, debuff: { name: 'slow', dur: 3, mul: 0.5 } },
    r: { id: 'deadoralive', kind: 'zone', zone: 'strike', name: '生死不問', desc: '一番近いボスの周りに1.2秒後 銃弾を8発 撃ち込む', at: 'boss', dist: 8, count: 8, scatter: 3, radius: 3, dur: 1.2, mult: 3.4, color: 0xffab40 },
    trait: '15% の確率で攻撃のダメージが2倍（急所撃ち）',
    luckyChance: 0.15, breakMul: 1,
    look: { armorColor: 0x5d4037, swordColor: 0x8d6e63, swordLen: 0.6, cape: 0x3e2723, weapon: 'gun', hat: 0x5d4037 },
  },
};

// ---------------- C キー（3つ目の通常技） ----------------
const sb = (id, name, desc, cd, color, buff, dur, vals, extra = {}) => ({ id, kind: 'selfbuff', name, desc, cd, color, buff, dur, vals, ...extra });
const tb = (id, name, desc, cd, color, buff, dur, vals, radius, extra = {}) => ({ id, kind: 'teambuff', name, desc, cd, color, buff, dur, vals, radius, ...extra });

export const C_SKILLS_E = {
  rampart: { id: 'c_rampart', kind: 'cleanse', name: '盾の押し返し', desc: '大盾で周り5mの敵の攻撃を押し返す', cd: 8, radius: 5, color: 0xbcaaa4 },
  turtle: { id: 'c_turtle', kind: 'dash', name: '甲羅すべり', desc: '甲羅で前へ8m 滑る（無敵）', cd: 9, mult: 1.2, dist: 8, time: 0.3, width: 1.8, color: 0x66bb6a },
  sohei: { id: 'c_sohei', kind: 'teamheal', name: '加持', desc: '周り6mの味方を 12% 回復', cd: 14, radius: 6, amount: 0.12, color: 0xffb74d },
  warden: { id: 'c_warden', kind: 'debuff', name: '足枷', desc: 'ボスに足枷をはめ、2秒 ほとんど動けなくする', cd: 16, color: 0x78909c, debuffs: [{ name: 'slow', dur: 2, mul: 0.2 }] },
  herbalist: sb('c_herbalist', '気付け薬', '4秒間 移動 +30%・毎秒 HP 4% 回復', 12, 0x9ccc65, 'smellingsalt', 4, { speedMul: 1.3, regen: 0.04 }),
  shrine: { id: 'c_shrine', kind: 'blink', name: '水渡り', desc: '向いている方へ6m 水の上を渡る', cd: 9, dist: 6, color: 0x4fc3f7 },
  angel: { id: 'c_angel', kind: 'leap', name: '羽ばたき', desc: '翼で後ろへ10m 大きく跳ぶ（無敵）', cd: 10, back: true, dist: 10, time: 0.6, height: 4, color: 0xfff9c4 },
  druid: tb('c_druid', '樹皮の守り', '4秒間 周りの味方の被ダメ -30%', 16, 0x689f38, 'bark', 4, { dmgMul: 0.7 }, 7),
  tactician: { id: 'c_tactician', kind: 'debuff', name: '偽報', desc: '偽の情報でボスを惑わせ、3秒間 鈍らせる', cd: 15, color: 0x5c6bc0, debuffs: [{ name: 'slow', dur: 3, mul: 0.5 }] },
  smith: sb('c_smith', '焼き入れ', '4秒間 攻撃 +30%', 14, 0xff7043, 'quench', 4, { atkMul: 1.3 }),
  cheer: tb('c_cheer', 'ウェーブ', '3秒間 周りの味方の移動 +40%', 12, 0xffca28, 'wave', 3, { speedMul: 1.4 }, 8),
  geomancer: { id: 'c_geomancer', kind: 'recall', name: '方違え', desc: '1回目で方角を定め、2回目でそこへ戻る（20秒以内）', cd: 14, color: 0x26a69a },
  hexer: { id: 'c_hexer', kind: 'debuff', name: '呪いの釘', desc: 'ボスに釘を打ち、4秒間 被ダメ +15%', cd: 15, color: 0x8e24aa, debuffs: [{ name: 'vuln', dur: 4, mul: 1.15 }] },
  poisoner: { id: 'c_poisoner', kind: 'blink', name: '煙玉', desc: '毒の煙にまぎれて向いている方へ6m 移る', cd: 10, dist: 6, color: 0x76ff03 },
  binder: { id: 'c_binder', kind: 'blinkbehind', name: '影移し', desc: '影を渡って一番近いボスの背後へ（0.6秒 無敵）', cd: 12, color: 0x455a64, after: { invuln: 0.6 } },
  puppeteer: sb('c_puppeteer', '身代わり人形', '人形を置き、3秒間 敵に気づかれない', 18, 0xf06292, 'pdoll', 3, {}, { after: { unseen: 3 } }),
  contrarian: sb('c_contrarian', '開き直り', '3秒間 攻撃 +40%・被ダメ +20%', 14, 0xe53935, 'hirakinaori', 3, { atkMul: 1.4, dmgMul: 1.2 }),
  bounty: { id: 'c_bounty', kind: 'recoil', name: '早抜き跳び', desc: '前へ一発撃ち、反動で後ろへ8m 跳ぶ（跳ぶ間は無敵）', cd: 10, mult: 2.0, size: 0.35, speed: 34, dist: 8, time: 0.4, height: 2, color: 0xffab40 },
};

/** 弾の見た目（data/shots_map.js の JOB_SHOTS に足す） */
export const SHOTS_E = {
  rampart: {},
  turtle: {},
  sohei: {},
  warden: { skill: { 0x90a4ae: 'javelin' } },
  herbalist: { basic: 'petal' },
  shrine: { basic: 'drop' },
  angel: { basic: 'feather' },
  druid: { basic: 'nut', skill: { 0x7cb342: 'petal' } },
  tactician: { basic: 'card' },
  smith: {},
  cheer: { basic: 'star' },
  geomancer: { basic: 'talisman' },
  hexer: { basic: 'hex', skill: { 0xab47bc: 'hexskull' } },
  poisoner: { basic: 'flask' },
  binder: { basic: 'knife', skill: { 0x607d8b: 'knife' } },
  puppeteer: { basic: 'juggle' },
  contrarian: {},
  bounty: { basic: 'bullet', skill: { 0xbcaaa4: 'net' } },
};

/** 銃を構える職（一人称の銃口の光） */
export const GUN_JOBS_E = ['bounty'];

// ---------------- 技の演出（data/skillvis.js と同じ書き方） ----------------
const V = Math.PI / 2;
const vm = (kind, dur, extra) => ['vm', { kind, dur, extra }];
const shake = (amt) => ['shake', { amt }];
const ring = (glyph, color, r = 4, o = {}) => ['ring', { glyph, color, r, n: 10, ...o }];
const flashAt = (where, color, size = 4, o = {}) => ['flash', { where, color, size, ...o }];
const aura = (color, o = {}) => ['orbit', { tex: 'smoke', color, n: 12, r: 1, h: 2.4, rise: 0.6, size: 1.1, opacity: 0.7, dur: 3, ...o }];
const dome = (color, r = 2, dur = 1.2) => ['dome', { color, r, dur }];
const side = (toRight, o = {}) => ['slash', { roll: 0, sweep: toRight ? -1.8 : 1.8, arc: 2.6, ...o }];
const vert = (o = {}) => ['slash', { roll: V, sweep: 1.1, arc: 1.4, y: 1.4, ...o }];

export const SKILLVIS_E = {
  // 城壁騎士
  rampbash: { cast: [vm('bigchop', 0.4), vert({ r: 4, color: 0xbcaaa4, at: 0.1 }), ['slam', { where: 'front', dist: 2.5, r: 3, color: 0xa1887f, at: 0.12 }], shake(0.45)] },
  rampwall: { cast: [vm('plant', 0.6, { hit: 0.3 }), ['shieldwall', { color: 0xbcaaa4, dur: 1.5 }], ring('▦', 0xbcaaa4, 4.5, { n: 12 }), shake(0.4)] },
  rampfort: { cast: [vm('raise', 0.8), ['whiteout', { css: '#8d6e63', max: 0.3 }], dome(0x8d6e63, 2.4, 1.2), ['scatter', { glyph: ['!', '⛨'], css: '#d7ccc8', n: 10 }], shake(0.6)] },
  // 甲羅闘士
  shellguard: { cast: [vm('raise', 0.5), dome(0x66bb6a, 1.8, 1.4), ring('⬢', 0x81c784, 2.5, { n: 8 })] },
  shellspin: { tick: () => [side(true, { r: 4, color: 0x81c784, dur: 0.2 }), ['burst', { color: 0xa5d6a7, n: 10, speed: 7 }], shake(0.15)], noSpin: true },
  shellmirror: { cast: [vm('raise', 0.6), dome(0x43a047, 3, 1), ring('↩', 0x66bb6a, 9, { n: 14 }), ['whiteout', { css: '#66bb6a', max: 0.25 }]] },
  // 僧兵
  naginatadash: { cast: [['streak', { where: 'front', dist: 6, color: 0xffb74d, w: 0.4 }], ['flash', { where: 'front', dist: 6, color: 0xffcc80, size: 4, at: 0.15 }], shake(0.3)] },
  fudo: { cast: [vm('raise', 0.7), aura(0xff9800), ring('卍', 0xffb74d, 2.5, { n: 8 }), ['column', { color: 0xffcc80, r: 1, h: 5, dur: 0.6 }]] },
  kongojin: { cast: [vm('cheer', 1), ring('◇', 0xffa726, 12, { n: 14, dur: 1.4 }), dome(0xffa726, 3, 1.2), shake(0.4)] },
  // 鎖の番人
  chainhook: { cast: [vm('throwdown', 0.4), ['streak', { where: 'front', dist: 10, color: 0x90a4ae, w: 0.2 }]] },
  chainoath: { cast: [vm('raise', 0.6), ['orbit', { glyph: '⛓', color: 0x90a4ae, n: 8, r: 1.4, h: 2, dur: 1.2, spin: 3, size: 0.5 }], dome(0x78909c, 2, 1)] },
  chainprison: { cast: [vm('chainswing', 0.6), ['bind', { color: 0x90a4ae }], shake(0.5)] },
  // 薬草師
  herbtoss: { cast: [vm('throwdown', 0.4), ['lob', { color: 0x9ccc65 }]], zone: { loop: { type: 'rise', tex: 'petal', color: 0x9ccc65, every: 0.12, h: 2, size: 0.4, life: 1.2, spin: 3 } } },
  herbtea: { cast: [vm('raise', 0.6), ring('✚', 0xc5e1a5, 8, { n: 12, rise: 1 }), ['burst', { color: 0xc5e1a5, n: 24, speed: 3, up: 3 }]] },
  panacea: { cast: [vm('cheer', 1), ['whiteout', { css: '#aed581', max: 0.35 }], ['scatter', { glyph: ['✚', '❀'], css: '#9ccc65', n: 16 }], ['column', { color: 0x9ccc65, r: 2, h: 10, dur: 1 }]] },
  // 泉の巫女
  purestream: { cast: [vm('raise', 0.5), ['suck', { color: 0x4fc3f7 }], ring('〜', 0x4fc3f7, 6, { n: 14 })] },
  springheal: { cast: [vm('raise', 0.6), ['column', { color: 0x81d4fa, r: 1.2, h: 6, dur: 0.6 }], ring('✚', 0x81d4fa, 8, { n: 12, rise: 1 })] },
  holyspring: { cast: [vm('plant', 0.6, { hit: 0.3 }), ['flash', { color: 0x29b6f6, size: 5, at: 0.3 }]], zone: { loop: [{ type: 'rise', glyph: '✚', every: 0.25, h: 2.5, size: 0.5, life: 1.2 }, { type: 'swirl', tex: 'smoke', every: 0.12, out: true, lift: 1.5, size: 0.7, opacity: 0.4 }] } },
  // 天使
  halo: { cast: [vm('raise', 0.7), ['ring', { glyph: '◯', color: 0xfff59d, r: 10, n: 14, rise: 1.2 }], ['column', { color: 0xfffde7, r: 1.5, h: 8, dur: 0.7 }]] },
  wingguard: { cast: [vm('cheer', 0.8), ['orbit', { tex: 'petal', color: 0xffffff, n: 14, r: 1.6, h: 2.4, dur: 1.2, spin: 2, size: 0.5 }], dome(0xfffde7, 3, 1)] },
  resurrection: { cast: [vm('cheer', 1.2), ['whiteout', { css: '#ffffff', max: 0.75, dur: 0.6 }], ['column', { color: 0xffffff, r: 3, h: 16, dur: 1.4 }], ['scatter', { glyph: ['✦', '✚'], css: '#fff59d', n: 18 }]] },
  // ドルイド
  thornseed: { cast: [vm('kiblast', 0.35), ['burst', { where: 'front', dist: 1, color: 0x7cb342, n: 14 }]] },
  groveTotem: { cast: [vm('plant', 0.6, { hit: 0.3 }), ['flash', { color: 0x8bc34a, size: 4, at: 0.3 }]], zone: { loop: { type: 'rise', tex: 'petal', color: 0x8bc34a, every: 0.2, h: 2.5, size: 0.45, life: 1.4, spin: 2 } } },
  wildgrowth: { cast: [vm('plant', 0.7, { hit: 0.35 }), ['slam', { r: 7, color: 0x558b2f, at: 0.35 }], shake(0.5)], zone: { loop: [{ type: 'rise', tex: 'petal', color: 0x7cb342, every: 0.06, h: 3, size: 0.45, life: 1.3, spin: 4 }, { type: 'rise', glyph: '✿', color: 0xc5e1a5, every: 0.2, h: 0.6, size: 0.6, life: 1.4 }] } },
  // 軍師
  formation: { cast: [vm('raise', 0.7), ring('⚑', 0x7986cb, 10, { n: 12 }), ['scatter', { glyph: ['⚑', '↗'], css: '#9fa8da', n: 10 }]] },
  stratagem: { cast: [vm('raise', 0.6), ['ring', { glyph: '✎', color: 0x5c6bc0, r: 10, n: 12, rise: 1.2 }]] },
  allout: { cast: [vm('cheer', 1), ['whiteout', { css: '#3949ab', max: 0.35 }], ['ring', { glyph: '⚔', color: 0x3949ab, r: 12, n: 14, dur: 1.4 }], ['scatter', { glyph: ['!', '⚔'], css: '#7986cb', n: 14 }], shake(0.6)] },
  // 鍛冶師
  sharpen: { cast: [vm('bigchop', 0.4), ['burst', { color: 0xffab40, n: 30, speed: 8, up: 3 }], ring('⚒', 0xff8a65, 8, { n: 12 })] },
  anvilstrike: { tick: () => [vm('bigchop', 0.3), ['slam', { r: 4, color: 0xff7043, at: 0.08 }], ['burst', { color: 0xffd180, n: 18, speed: 9, up: 4, at: 0.08 }], shake(0.4)], noSpin: true },
  reforge: { cast: [vm('cheer', 1), ['whiteout', { css: '#ff5722', max: 0.3 }], ['ring', { glyph: '⛨', color: 0xff7043, r: 12, n: 14 }], ['burst', { color: 0xffab40, n: 40, speed: 6, up: 4 }]] },
  // 応援団
  fightsong: { cast: [vm('cheer', 0.9), ['song', { r: 10, mood: 'hype' }], ring('!', 0xffca28, 10, { n: 12 })] },
  megaphone: { cast: [vm('cheer', 0.9), ['ring', { glyph: '📣', color: 0xffb300, r: 12, n: 10, rise: 1 }], shake(0.3)] },
  bigcheer: { cast: [vm('cheer', 1.2), ['confetti', { n: 80 }], ['whiteout', { css: '#ffca28', max: 0.3 }], ['scatter', { glyph: ['♪', '!', '★'], css: '#ffca28', n: 18 }]] },
  // 風水師
  leyline: { cast: [vm('plant', 0.6, { hit: 0.3 }), ['flash', { color: 0x26a69a, size: 4, at: 0.3 }]], zone: { loop: { type: 'rise', glyph: '☯', every: 0.3, h: 2.5, size: 0.5, life: 1.3 } } },
  compass: { cast: [vm('raise', 0.4)], land: [['column', { color: 0x4db6ac, r: 2, h: 8, dur: 0.6 }], shake(0.4)] },
  dragonvein: { cast: [vm('cheer', 1), ['whiteout', { css: '#00897b', max: 0.3 }], ['orbit', { glyph: '龍', color: 0x26a69a, n: 8, r: 2, h: 3, dur: 1.4, spin: 2, size: 0.6 }], ring('☯', 0x00897b, 12, { n: 12 })] },
  // 呪術師
  curseweak: { cast: [vm('raise', 0.5), ['skulls', { color: 0x8e24aa }]] },
  hexbolt: { cast: [vm('kiblast', 0.35), ['flash', { where: 'front', dist: 1, color: 0xab47bc, size: 3 }]] },
  grandcurse: { cast: [vm('raise', 0.9), ['whiteout', { css: '#4a148c', max: 0.45 }], ['skulls', { color: 0x6a1b9a }], ['scatter', { glyph: ['☠', '呪'], css: '#ce93d8', n: 14 }], shake(0.5)] },
  // 毒使い
  poisoncloud: { cast: [vm('kiblast', 0.4), ['fire', { color: 0x76ff03 }]] },
  toxicpool: { cast: [vm('throwdown', 0.4), ['lob', { color: 0x64dd17 }]], zone: { loop: { type: 'rise', tex: 'smoke', color: 0x76ff03, every: 0.1, h: 1.5, size: 0.8, life: 1.2 } } },
  plague: { cast: [vm('raise', 0.7), ['drain', { color: 0x33691e }], ['scatter', { glyph: ['☣'], css: '#76ff03', n: 12 }]] },
  // 影縫い
  shadowpin: { cast: [vm('throwdown', 0.35), ['streak', { where: 'front', dist: 8, color: 0x607d8b, w: 0.15 }]] },
  kagemuguri: { cast: [['flash', { color: 0x37474f, size: 4 }], ['burst', { color: 0x455a64, n: 20 }]] },
  shadowprison: { cast: [vm('raise', 0.7), ['bind', { color: 0x263238 }], ['whiteout', { css: '#263238', max: 0.4 }], shake(0.4)] },
  // 人形使い
  puppet: { cast: [vm('plant', 0.5, { hit: 0.25 }), ['flash', { color: 0xf06292, size: 3, at: 0.25 }], ['confetti', { n: 20 }]] },
  stringcut: { cast: [vm('drawcut', 0.45), side(true, { r: 5, arc: 1.6, color: 0xf8bbd0, at: 0.06 }), side(false, { r: 5, arc: 1.6, color: 0xf8bbd0, at: 0.14 })] },
  bigpuppet: { cast: [vm('cheer', 1), ['column', { color: 0xec407a, r: 1.6, h: 8, dur: 0.8 }], ['confetti', { n: 50 }], shake(0.5)] },
  // 天邪鬼
  sakasa: { cast: [vm('sheathe', 0.6), ring('↺', 0xe53935, 2.5, { n: 8 })] },
  uragaeri: { cast: [['flash', { color: 0xc62828, size: 4 }], vert({ r: 4, color: 0xe53935, at: 0.1 })] },
  amanojaku: { cast: [vm('raise', 0.7), dome(0xd50000, 3, 1), ring('↩', 0xe53935, 10, { n: 14 }), ['whiteout', { css: '#d50000', max: 0.3 }]] },
  // 賞金稼ぎ
  wanted: { cast: [vm('raise', 0.4), ['scatter', { glyph: ['$', 'WANTED'], css: '#ffab40', n: 8 }]] },
  lasso: { cast: [vm('chainswing', 0.45), ['net', { color: 0xbcaaa4 }]] },
  deadoralive: { cast: [vm('raise', 0.5)], land: [['explode', { color: 0xffab40, r: 2.5 }], shake(0.4)] },
};

/** C キーの演出（キーは職業 id。data/skillvis_c.js の書き方） */
export const SKILLVIS_C_E = {
  rampart: [vm('raise', 0.4), ['shieldwall', { color: 0xbcaaa4, dur: 1 }], ring('⛨', 0xbcaaa4, 5)],
  turtle: [['streak', { where: 'front', dist: 8, color: 0x66bb6a, w: 0.6 }], ['burst', { color: 0x81c784, n: 24 }]],
  sohei: [vm('raise', 0.5), ring('✚', 0xffb74d, 6, { rise: 1 })],
  warden: [vm('chainswing', 0.4), ['bind', { color: 0x78909c }]],
  herbalist: [vm('raise', 0.4), aura(0x9ccc65, { dur: 2 })],
  shrine: [flashAt('self', 0x4fc3f7, 5), flashAt('front', 0x4fc3f7, 5, { dist: 6, at: 0.05 }), ['burst', { color: 0x81d4fa, n: 30 }]],
  angel: [['orbit', { tex: 'petal', color: 0xffffff, n: 10, r: 1.2, h: 2, dur: 0.8, spin: 3, size: 0.45 }]],
  druid: [vm('raise', 0.5), dome(0x689f38, 2.5, 1.2), ring('❧', 0x8bc34a, 7)],
  tactician: [vm('raise', 0.4), ['scatter', { glyph: ['?', '✎'], css: '#9fa8da', n: 10 }]],
  smith: [vm('bigchop', 0.35), ['burst', { color: 0xff7043, n: 30, speed: 8 }], aura(0xff7043, { dur: 2 })],
  cheer: [vm('cheer', 0.6), ['song', { r: 8, mood: 'hype' }]],
  geomancer: [vm('plant', 0.5, { hit: 0.25 }), ring('☯', 0x26a69a, 3)],
  hexer: [vm('throwdown', 0.4), ['skulls', { color: 0x8e24aa }]],
  poisoner: [['orbit', { tex: 'smoke', color: 0x76ff03, n: 14, r: 1.2, h: 2, rise: 0.4, size: 1.3, opacity: 0.6, dur: 1 }], flashAt('front', 0x76ff03, 4, { dist: 6, at: 0.05 })],
  binder: [flashAt('self', 0x37474f, 4), ['burst', { color: 0x455a64, n: 24 }]],
  puppeteer: [vm('plant', 0.4, { hit: 0.2 }), ['confetti', { n: 16 }]],
  contrarian: [vm('raise', 0.4), aura(0xe53935, { dur: 2.5 })],
  bounty: [['flash', { where: 'front', dist: 1, color: 0xffab40, size: 3 }], ['streak', { where: 'front', dist: 6, color: 0xffab40, w: 0.2 }]],
};

/** C キーのバフ中の画面の縁の色 */
export const C_FRAMES_E = {
  smellingsalt: '156,204,101', bark: '104,159,56', quench: '255,112,67', wave: '255,202,40', pdoll: '240,98,146', hirakinaori: '229,57,53',
};
