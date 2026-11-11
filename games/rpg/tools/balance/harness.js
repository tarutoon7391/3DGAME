// バランス計測：ブラウザの中で動く部分（games/rpg/index.html?debug を開いたページに読み込む）
// 本物のゲームのコード（技・弾・設置物・ゲージ）をそのまま使い、動かない木人ボスに一定時間攻撃させて数値を取る
// 使い方は tools/balance/README.md
(function () {
  const ROOM = { area: 'abyss', bx: 0, bz: 13 }; // ステージ3 の第1の間（ボスの防御はステージ3相当）
  const MELEE_GAP = 1.0; // 近接はボスの表面からこの距離で殴る
  const RANGED_DIST = 9; // 飛び道具の通常攻撃はボスの中心からこの距離で撃つ
  const HIT_EVERY = 4; // 木人の反撃：この秒数ごとに1発（反撃・被弾で強くなる職のため）
  const HIT_FRAC = 0.3; // 1発の重さ（基準 HP 110 × 0.3 ≒ 33）
  const HP_PIN = 0.6; // 自分の HP はこの割合に保つ（HP 依存の特性を「戦闘の中盤」で測る）

  async function mods() {
    const [combat, ui, jobs] = await Promise.all([import('/games/rpg/src/combat.js'), import('/shared/ui.js'), import('/games/rpg/src/jobs.js')]);
    return { combat, ui, jobs };
  }

  /** 1職を secs 秒計測する */
  async function runJob(jobId, secs = 60, opts = {}) {
    const g = window.rpg;
    const { combat, ui, jobs } = await mods();
    const dt = 1 / 60;
    g.debug.startSolo(g.debug.newProgress(ROOM.area), jobId);
    ui.showPause({ onResume() {} }); // 通常のループを止め、こちらで1フレームずつ進める
    const me = g.me();
    const J = me.job;
    // ---- 木人：最初の部屋のボスを起こして、動かない的にする ----
    const boss = g.bosses[0];
    boss.wake();
    boss.state = 'idle';
    boss.t = 0;
    boss.maxHp = 1e9;
    boss.hp = 0.6e9; // 処刑人などの「HP が少ないほど強い」は効かない帯で測る
    boss.brkMax = Infinity; // 気絶（被ダメ1.5倍）は起こさない。ブレイク値は別に数える
    boss.update = (rawDt) => {
      for (const [k, d] of Object.entries(boss.debuffs)) {
        d.t -= rawDt;
        if (d.t <= 0) delete boss.debuffs[k];
      }
      if (boss.freezeImmune > 0) boss.freezeImmune -= rawDt;
      if (boss.shred && (boss.shred.t -= rawDt) <= 0) boss.shred = null;
      if (boss.taunt && (boss.taunt.t -= rawDt) <= 0) boss.taunt = null;
      if (boss.state === 'frozen') {
        boss.stopT = (boss.stopT || 0) + rawDt;
        if ((boss.frozenFor -= rawDt) <= 0) boss.state = 'idle';
      }
      boss.pos.set(ROOM.bx, 0, ROOM.bz);
    };
    boss.pos.set(ROOM.bx, 0, ROOM.bz);
    g.enemies.list.forEach((e) => { e.alive = false; });

    // ---- 計測用のフック ----
    const stat = { team: { heal: 0, shield: 0 }, teamBuffNames: new Set(), rCasts: 0, qCasts: 0, eCasts: 0 };
    const origTeam = g.teamEffect;
    g.teamEffect = (eff0) => {
      const eff = jobs.scaleSupport(eff0, J.support ?? 1); // 支援係数を掛けた後の量で数える
      if (eff.kind === 'heal') stat.team.heal += eff.amount;
      if (eff.kind === 'prayer') stat.team.heal += 1;
      if (eff.kind === 'reviveall') stat.team.heal += eff.hp || 0.3;
      if (eff.kind === 'buff') {
        stat.teamBuffNames.add(eff.name);
        if (eff.vals?.shield) stat.team.shield += eff.vals.shield;
      }
      origTeam(eff0);
    };
    // トーテム・回復の場（設置物）からの強化も味方への効果として数える
    const origBuff = me.buff.bind(me);
    me.buff = (name, dur, vals) => {
      const st = new Error().stack || '';
      if (st.includes('updateJobZones') || st.includes('applyTeamEffect')) stat.teamBuffNames.add(name);
      return origBuff(name, dur, vals);
    };
    // 設置物の回復（花壇・知恵の泉など）は HP の変化で数える
    let hpVal = me.hp;
    Object.defineProperty(me, 'hp', {
      configurable: true,
      get: () => hpVal,
      set: (v) => {
        if (v > hpVal) {
          const st = new Error().stack || '';
          if (st.includes('updateJobZones')) stat.team.heal += (v - hpVal) / me.maxHp;
        }
        hpVal = v;
      },
    });

    const critMul = 1.5;
    // ゲームの一部（鎧砕きの間隔・技のゲージ上限など）は performance.now で時間を数えるので、計測中はシミュの時間を返す
    const realNow = performance.now.bind(performance);
    let simMs = realNow();
    performance.now = () => simMs;
    let t = 0;
    let dealt = 0;
    let brk = 0;
    const perSec = [];
    let secAcc = 0;
    let ampSum = 0; // 味方への強化（攻撃力）× ボスの弱体化（被ダメ増）の時間平均
    let teamAtkSum = 0;
    let bossAmpSum = 0;
    let slowSum = 0;
    let regenSum = 0; // 味方への継続回復（毎秒、最大HP比）
    let takenMulSum = 0;
    let nextHit = HIT_EVERY;
    const intent = { moveX: 0, moveZ: 0, aimYaw: Math.PI, lockYaw: true, attack: true, dodge: false, dash: false, skillQ: false, skillE: false, skillR: false, interact: false };
    const surface = boss.radius + MELEE_GAP;
    const basicDist = J.basic.type === 'melee' ? surface : RANGED_DIST;
    const castDist = (slot) => {
      const sk = J[slot];
      const aim = slot === 'q' ? 2 : slot === 'e' ? sk.dist || 2 : sk.dist || 3;
      // 狙った場所に落とす技は、狙いがボスに重なる距離から。近接の技はボスの目の前から
      return Math.max(surface, aim);
    };
    const place = (dist) => {
      me.pos.set(ROOM.bx, 0, ROOM.bz + dist);
      me.yaw = Math.PI;
    };
    place(basicDist);

    while (t < secs) {
      // 行動の選び方：使えるものから R → Q → E、なければ通常攻撃
      const idle = me.action === 'none' || me.action === 'shoot';
      intent.skillQ = intent.skillE = intent.skillR = false;
      if (idle) {
        const rOk = me.gauge >= 100 && !(J.r.oncePerRun && g.state.progress.usedOnce?.[J.r.id]);
        if (rOk) { place(castDist('r')); intent.skillR = true; }
        else if (me.cd.q <= 0) { place(castDist('q')); intent.skillQ = true; }
        else if (me.cd.e <= 0) { place(castDist('e')); intent.skillE = true; }
        else place(basicDist);
      }
      // 向きは常にボスへ
      intent.aimYaw = Math.atan2(ROOM.bx - me.pos.x, ROOM.bz - me.pos.z);
      // 木人の反撃
      nextHit -= dt;
      if (nextHit <= 0) {
        nextHit += HIT_EVERY;
        if (me.alive) combat.hurtPlayer(g, me, HIT_FRAC, boss.pos.x, boss.pos.z);
      }
      if (!me.alive || me.downed) { me.alive = true; me.downed = false; }
      // HP を戦闘の中盤（60%）に保つ
      me.hp = me.maxHp * HP_PIN;
      takenMulSum += me.dmgTakenMul() * dt;

      const before = boss.hp;
      const brkBefore = boss.brk;
      const cdq = me.cd.q, cde = me.cd.e, gBefore = me.gauge;
      g.debug.stepWith(intent, dt);
      if (me.cd.q > cdq + 0.5) stat.qCasts++;
      if (me.cd.e > cde + 0.5) stat.eCasts++;
      if (intent.skillR && me.gauge < gBefore) stat.rCasts++;
      const d = Math.max(0, before - boss.hp);
      dealt += d;
      secAcc += d;
      brk += Math.max(0, boss.brk - brkBefore);
      boss.brk = 0;

      // 味方への強化と、ボスの弱体化（時間で平均）
      let teamAtk = 1;
      for (const [name, b] of Object.entries(me.buffs)) {
        if (!stat.teamBuffNames.has(name)) continue;
        if (b.atkMul) teamAtk *= b.atkMul;
        if (name === 'courage' && b.mul) teamAtk *= b.mul;
        if (b.critAdd) teamAtk *= 1 + b.critAdd * (critMul - 1);
        if (b.regen) regenSum += b.regen * dt;
      }
      if (J.auraRegen) regenSum += J.auraRegen * (J.support ?? 1) * dt; // 僧侶：周りの味方が少しずつ回復
      let bossAmp = 1;
      if (boss.debuffs.vuln) bossAmp *= boss.debuffs.vuln.mul;
      if (boss.shred) bossAmp *= 1 + boss.shred.n * boss.shred.per;
      teamAtkSum += teamAtk * dt;
      bossAmpSum += bossAmp * dt;
      ampSum += teamAtk * bossAmp * dt;
      if (boss.debuffs.slow) slowSum += (1 - boss.debuffs.slow.mul) * dt;

      t += dt;
      simMs += dt * 1000;
      if (Math.floor(t) !== Math.floor(t - dt)) { perSec.push(secAcc); secAcc = 0; }
    }
    g.teamEffect = origTeam;
    performance.now = realNow;
    // 10秒間の最大火力
    let burst10 = 0;
    for (let i = 0; i + 10 <= perSec.length; i++) burst10 = Math.max(burst10, perSec.slice(i, i + 10).reduce((a, c) => a + c, 0) / 10);
    const takenMul = takenMulSum / secs;
    return {
      job: jobId,
      name: J.name,
      role: J.roleKey || '',
      melee: J.basic.type === 'melee',
      hp: me.maxHp,
      atk: J.stats.atk,
      power: J.power ?? 1,
      support: J.support ?? 1,
      dps: dealt / secs,
      burst10,
      brkPerSec: brk / secs,
      takenMul,
      ehp: me.maxHp / takenMul,
      teamHealPerSec: (stat.team.heal + regenSum) / secs, // 味方1人あたり、最大HP比
      teamShieldPerSec: stat.team.shield / secs,
      teamAtk: teamAtkSum / secs - 1, // 味方の攻撃力アップ（時間平均）
      bossAmp: bossAmpSum / secs - 1, // ボスの被ダメ増（時間平均）
      amp: ampSum / secs - 1,
      slow: slowSum / secs,
      stop: (boss.stopT || 0) / secs,
      casts: { q: stat.qCasts, e: stat.eCasts, r: stat.rCasts },
    };
  }

  /**
   * ボスの痛さを測る：剣士ひとりがボスの 7m 手前で棒立ち（避けない・攻撃しない）のとき、毎秒どれだけ HP を削られるか
   * 前半は通常、後半は怒り状態。戻り値は部屋のボス全体の合計（2体同時の部屋は2体ぶん）
   */
  async function runBoss(area, stepN, secs = 60) {
    const g = window.rpg;
    const { ui } = await mods();
    const dt = 1 / 60;
    const pr = g.debug.newProgress(area);
    pr.bossStep = stepN;
    g.debug.startSolo(pr, 'swordsman');
    ui.showPause({ onResume() {} });
    const me = g.me();
    const bosses = g.bosses;
    const cx = bosses.reduce((a, b) => a + b.pos.x, 0) / bosses.length;
    const cz = bosses.reduce((a, b) => a + b.pos.z, 0) / bosses.length;
    me.pos.set(cx, 0, cz + 7);
    for (const b of bosses) b.wake();
    let hpVal = me.maxHp;
    const taken = [0, 0];
    let phase = 0;
    Object.defineProperty(me, 'hp', { configurable: true, get: () => hpVal, set: (v) => { if (v < hpVal) taken[phase] += hpVal - v; hpVal = me.maxHp; } });
    const realNow = performance.now.bind(performance);
    let simMs = realNow();
    performance.now = () => simMs;
    const idle = { moveX: 0, moveZ: 0, aimYaw: Math.PI, lockYaw: true };
    const half = secs / 2;
    const warm = 4; // 登場演出ぶんは数えない
    for (let t = -warm; t < secs; t += dt) {
      if (t >= half && phase === 0) {
        phase = 1;
        for (const b of bosses) { b.hp = Math.round(b.maxHp * 0.4); b.applyDamage(1, 0); }
      }
      if (t < 0) taken[0] = 0;
      me.alive = true; me.downed = false; me.invuln = Math.min(me.invuln, 0.3);
      for (const b of bosses) { b.brk = 0; if (b.hp < b.maxHp * 0.2) b.hp = Math.round(b.maxHp * 0.4); }
      g.debug.stepWith(idle, dt);
      simMs += dt * 1000;
    }
    performance.now = realNow;
    return { area, step: stepN, names: bosses.map((b) => b.name), keys: bosses.map((b) => b.key), maxHp: bosses.map((b) => b.maxHp), def: bosses.map((b) => b.defense),
      dpsNormal: taken[0] / half, dpsRage: taken[1] / half, myHp: me.maxHp };
  }

  window.__balance = { runJob, runBoss };
})();
