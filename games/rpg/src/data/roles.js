// 職業のロール（7種）と、ロールごとの基本ステータス
// 方針は docs/balance/policy.md：基本ステータスはロール共通（攻撃は全ロール 50）。職ごとの差は技と特性だけで付ける
// ロールはステータスの区分。ロールに必須の技は決めない

export const ROLE_INFO = {
  attacker: { name: 'アタッカー', color: '#ef5350' },
  gunner: { name: 'ガンナー', color: '#ffa726' },
  tank: { name: 'タンク', color: '#78909c' },
  healer: { name: 'ヒーラー', color: '#66bb6a' },
  buffer: { name: 'バッファー', color: '#ffee58' },
  debuffer: { name: 'デバッファー', color: '#ab47bc' },
  unique: { name: 'ユニーク', color: '#26c6da' },
};

/** ロールごとの基本ステータス（unique は通常攻撃が近接なら attacker、飛び道具なら gunner と同じ） */
export const ROLE_STATS = {
  attacker: { hp: 300, atk: 50, speed: 6.6, dmgTaken: 1 },
  gunner: { hp: 200, atk: 50, speed: 6.4, dmgTaken: 1 },
  tank: { hp: 480, atk: 50, speed: 5.8, dmgTaken: 0.8 },
  healer: { hp: 220, atk: 50, speed: 6.4, dmgTaken: 1 },
  buffer: { hp: 230, atk: 50, speed: 6.4, dmgTaken: 1 },
  debuffer: { hp: 230, atk: 50, speed: 6.4, dmgTaken: 1 },
};

/**
 * 例外：特性そのものがステータスの差になっている職だけ、ロールの値に倍率を掛ける
 * 鬼＝HP 特盛で回避できない／幽霊＝すり抜けるかわりに HP がとても低い／韋駄天＝足が速いかわりに HP が低い
 */
export const ROLE_EXCEPTIONS = {
  oni: { hp: 1.25, speed: 0.95 },
  ghost: { hp: 0.6 },
  speedster: { hp: 0.65, speed: 1.4 },
};

/** 職業 → ロール（仕分けの理由は docs/balance/roles.md） */
export const ROLES = {
  // アタッカー（近接火力）
  swordsman: 'attacker', ninja: 'attacker', lancer: 'attacker', monk: 'attacker', berserker: 'attacker',
  reaper: 'attacker', samurai: 'attacker', dancer: 'attacker', spellblade: 'attacker', dragonkin: 'attacker',
  chainer: 'attacker', darkknight: 'attacker', whip: 'attacker', souleater: 'attacker', speedster: 'attacker',
  cursed: 'attacker', drunkard: 'attacker', hammer: 'attacker', dualblade: 'attacker', vampire: 'attacker',
  gunblade: 'attacker', assassin: 'attacker', werewolf: 'attacker', acrobat: 'attacker', driller: 'attacker',
  charger: 'attacker', vanguard: 'attacker',
  // ガンナー（遠距離火力）
  mage: 'gunner', archer: 'gunner', summoner: 'gunner', gunner: 'gunner', storm: 'gunner',
  bomber: 'gunner', gunslinger: 'gunner', sniper: 'gunner', prophet: 'gunner', twins: 'gunner',
  machinegunner: 'gunner', flamer: 'gunner', rocketeer: 'gunner', knifer: 'gunner', laser: 'gunner',
  falconer: 'gunner', javelin: 'gunner', engineer: 'gunner', dimension: 'gunner', onmyoji: 'gunner',
  hunter: 'gunner', elementalist: 'gunner', splitter: 'gunner', boomeranger: 'gunner', stickybomber: 'gunner',
  gardener: 'gunner', echomage: 'gunner',
  // タンク
  knight: 'tank', paladin: 'tank', oni: 'tank', gladiator: 'tank', asura: 'tank',
  thornknight: 'tank', shielder: 'tank', fortress: 'tank',
  // ヒーラー
  priest: 'healer', medic: 'healer', cook: 'healer', healfist: 'healer', warlock: 'healer',
  barrier: 'healer', maid: 'healer', sacrifice: 'healer',
  // バッファー
  bard: 'buffer', shaman: 'buffer', drummer: 'buffer', sage: 'buffer', conductor: 'buffer',
  thief: 'buffer', astrologer: 'buffer', weather: 'buffer',
  // デバッファー
  alchemist: 'debuffer', chrono: 'debuffer', trapper: 'debuffer', cryo: 'debuffer', gravity: 'debuffer',
  shredder: 'debuffer', exorcist: 'debuffer', bellringer: 'debuffer', mirror: 'debuffer',
  // ユニーク
  jester: 'unique', shifter: 'unique', gambler: 'unique', mimic: 'unique', ghost: 'unique',
  phoenix: 'unique', absorber: 'unique', reflector: 'unique', desperado: 'unique',
};

/** その職の基本ステータス（ロールの値＋例外の倍率） */
export function roleStats(jobId, basicType) {
  const role = ROLES[jobId];
  const key = role === 'unique' ? (basicType === 'melee' ? 'attacker' : 'gunner') : role;
  const s = { ...ROLE_STATS[key] };
  const ex = ROLE_EXCEPTIONS[jobId];
  if (ex) {
    if (ex.hp) s.hp = Math.round(s.hp * ex.hp);
    if (ex.speed) s.speed = Math.round(s.speed * ex.speed * 10) / 10;
  }
  return s;
}
