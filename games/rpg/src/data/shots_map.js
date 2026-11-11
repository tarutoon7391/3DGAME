// どの弾にどの形を使うか（形は shots_a.js・shots_b.js）
// jobs.js の技の処理には手を入れず、「撃った人の職業」と「弾の色（技の color）」から決める
//   basic … 通常攻撃（左クリック）の弾
//   skill … Q・E・R で撃つ弾。キーは技の color（data/jobs.js・jobs.js に書いてある色）
//   書いていない技の弾 … 職業の basic → それもなければ「爆発する弾は blast／貫通する弾は lance／それ以外は orb」
export const JOB_SHOTS = {
  mage: { basic: 'magic', skill: { 0xff7043: 'fireball', 0x80deea: 'ice' } },
  priest: { basic: 'light' },
  archer: { basic: 'arrow' },
  ninja: { skill: { 0xb0bec5: 'shuriken' } },
  bard: { basic: 'note' },
  summoner: { basic: 'wisp' },
  alchemist: { basic: 'flask', skill: { 0x76ff03: 'corrode', 0xff5252: 'redflask', 0xffd740: 'bigflask' } },
  chrono: { basic: 'clock' },
  gunner: { basic: 'shell', skill: { 0xffd180: 'bullet', 0xff6f00: 'cannonball' } },
  warlock: { basic: 'skull', skill: { 0x7b1fa2: 'hexskull' } },
  reaper: { skill: { 0xb0bec5: 'scythe' } },
  trapper: { basic: 'bolt' },
  storm: { basic: 'lightning' },
  barrier: { basic: 'hex' },
  astrologer: { basic: 'star' },
  spellblade: { skill: { 0x7c4dff: 'crescent' } },
  jester: { basic: 'card', skill: { 0xffeb3b: 'juggle', 0xff5252: 'juggle', 0x40c4ff: 'juggle', 0xffffff: 'bird' } },
  gunslinger: { basic: 'bullet' },
  shaman: { basic: 'feather' },
  shifter: { basic: 'swirl', skill: { 0x80deea: 'ice' } },
  gambler: { basic: 'dice' },
  bomber: { basic: 'bomb' },
  mirror: { basic: 'shard' },
  gravity: { basic: 'blackhole' },
  cook: { basic: 'onigiri' },
  sniper: { basic: 'tracer' },
  prophet: { basic: 'eye' },
  ghost: { basic: 'ghost' },
  twins: { basic: 'heart', skill: { 0xff1744: 'orb', 0x2979ff: 'orb' } }, // ふたりの嵐：赤と青の光の玉
  machinegunner: { basic: 'bullet' },
  flamer: { basic: 'flame', skill: { 0xff5722: 'fireball' } }, // ナパームは大きな火の玉
  rocketeer: { basic: 'rocket' },
  medic: { basic: 'syringe' },
  shielder: { basic: 'shield' },
  knifer: { basic: 'knife' },
  laser: { basic: 'beam' },
  cryo: { basic: 'ice' },
  falconer: { basic: 'feather', skill: { 0x8d6e63: 'bird' } },
  gunblade: { skill: { 0xb0bec5: 'crescent', 0xffab40: 'bullet' } },
  javelin: { basic: 'javelin' },
  maid: { basic: 'bubble' },
  mimic: { basic: 'mask' },
  phoenix: { basic: 'fireball' },
  weather: { basic: 'raindrop' },
  engineer: { basic: 'nut' },
  dimension: { basic: 'portal' },
  onmyoji: { basic: 'talisman', skill: { 0xfffde7: 'bird' } },
  hunter: { basic: 'arrow', skill: { 0x8d6e63: 'net' } },
  elementalist: { basic: 'elemental', skill: { 0x80deea: 'ice', 0xfff176: 'lightning' } },
  fortress: { basic: 'slug', skill: { 0x78909c: 'cannonball' } },
  sage: { basic: 'rune', skill: { 0xfff59d: 'lance' } },
  acrobat: { skill: { 0xffd54f: 'knife' } },
  absorber: { basic: 'vortex', skill: { 0x4db6ac: 'lance' } },
  reflector: { basic: 'prism' },
  splitter: { basic: 'pellets' },
  boomeranger: { basic: 'boomerang' },
  exorcist: { basic: 'cross' },
  stickybomber: { basic: 'sticky' },
  gardener: { basic: 'petal' },
  echomage: { basic: 'soundring' },
  conductor: { basic: 'note2' },
  sacrifice: { basic: 'drop' },
};

/** 弾の形の名前を決める。o は playerShot に渡す設定（basic・color・explode・pierce） */
export function pickShotLook(jobId, o) {
  const m = JOB_SHOTS[jobId];
  if (m) {
    if (o.basic && m.basic) return m.basic;
    const byColor = m.skill?.[o.color];
    if (byColor) return byColor;
    if (m.basic && !o.explode) return m.basic;
  }
  if (o.explode) return 'blast';
  if (o.pierce) return 'lance';
  return 'orb';
}
