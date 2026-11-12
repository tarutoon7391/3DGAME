// ボスの固有技（kind: 'seq'）と必殺技（patterns.ult）を「台本」で動かす
// 台本 steps は { at（当たる時刻）, tele（その何秒前から予兆）, do（やること）, ... } の並び。時刻は技の開始からの秒（怒り中は windupMul 倍）
// ホストだけが当たり判定をし、見た目は vfx（参加者にも送る）・予兆（ミラー）・弾（ミラー）で揃える
// 参加者のボスは姿勢だけ poseSeq で同じ台本から作る（b.t と pattern は届いた状態）
import { angleDiff, yawTo, rand } from './util.js';

const DEF_TELE = { hit: 0.5, zones: 0.6, mover: 0.5, rot: 0.6, safe: 0, check: 0, facing: 0, all: 0, still: 0.8 };

/** 台本の時刻（怒り・必殺技の倍率込み）。arm：予兆を出す時刻、at：当たる時刻 */
export function stepTimes(s, mul) {
  const at = s.at * mul;
  const tele = (s.tele ?? DEF_TELE[s.do] ?? 0) * mul;
  return { arm: Math.max(0, at - tele), at };
}

/** 台本が全部終わる時刻 */
export function seqEnd(p, mul) {
  let end = 0;
  for (const s of p.steps) end = Math.max(end, s.at * mul + (s.dur ?? 0) * mul + (s.life ?? 0));
  return end + (p.recover ?? 0.5);
}

/**
 * 姿勢（ホスト・参加者共通）。いま効いている pose 付きの step を探して、
 * k = -1（構え始め）〜 0（当たる瞬間）〜 1（振り抜き）で形を決める
 */
export function poseSeq(m, p, t, mul) {
  let cur = null;
  for (const s of p.steps) {
    if (!s.pose) continue;
    const { arm, at } = stepTimes(s, mul);
    const end = at + Math.max(0.35, (s.dur ?? 0) * mul);
    if (t >= arm - 0.05 && t <= end) {
      const k = t < at ? -1 + (t - arm) / Math.max(0.01, at - arm) : (t - at) / Math.max(0.01, end - at);
      cur = { pose: s.pose, k: Math.max(-1, Math.min(1, k)), s };
    }
  }
  const { root, armL, armR, legL, legR } = m;
  root.rotation.set(0, 0, 0);
  root.position.y = 0;
  armL.rotation.set(0, 0, 0);
  armR.rotation.set(0, 0, 0);
  legL.rotation.x = 0;
  legR.rotation.x = 0;
  if (m.heads) for (const h of m.heads) h.rotation.x = h.userData.rx ?? 0;
  if (!cur) return;
  const { k } = cur;
  const wind = k < 0 ? 1 + k : 0; // 0→1 で溜める
  const hit = k >= 0 ? 1 - k : 0; // 当たった直後 1 → 0
  const side = cur.s.a ? Math.sign(cur.s.a) : 1;
  switch (cur.pose) {
    case 'bite': // 首を引いて、前へ突き出す
      root.rotation.x = -0.25 * wind + 0.35 * hit;
      root.rotation.y = (cur.s.a || 0) * 0.6;
      root.position.y = 0.1 * wind;
      if (m.heads) for (const h of m.heads) h.rotation.x = (h.userData.rx ?? 0) - 0.5 * wind + 0.6 * hit;
      break;
    case 'lunge': // 体ごと前に
      root.rotation.x = -0.15 * wind + 0.4 * hit;
      armL.rotation.x = -1.2 * wind + 0.6 * hit;
      armR.rotation.x = -1.2 * wind + 0.6 * hit;
      break;
    case 'swing': // 横に振りかぶって薙ぐ
      root.rotation.y = side * (0.9 * wind - 1.1 * hit);
      armR.rotation.set(-1.4, side * (1.2 * wind - 1.5 * hit), 0);
      armL.rotation.set(-0.6 * wind, 0, 0.4);
      break;
    case 'over': // 両腕を振り上げて振り下ろす
      armL.rotation.x = -2.9 * wind - 0.8 * hit;
      armR.rotation.x = -2.9 * wind - 0.8 * hit;
      root.rotation.x = -0.2 * wind + 0.35 * hit;
      break;
    case 'tail': // 後ろを向いて尾を振る
      root.rotation.y = Math.PI * (k < 0 ? wind * 0.8 : 0.8 + hit * 0.2) * side;
      root.rotation.z = 0.15 * hit;
      break;
    case 'rear': // 立ち上がって咆哮
      root.rotation.x = -0.6 * wind - 0.4 * hit;
      root.position.y = 0.4 * wind;
      armL.rotation.x = -1.6 * wind;
      armR.rotation.x = -1.6 * wind;
      if (m.heads) for (const h of m.heads) h.rotation.x = (h.userData.rx ?? 0) - 0.7 * (wind + hit);
      break;
    case 'wings': // 翼（腕）を大きく広げる
      armL.rotation.set(0, 0, 1.1 * wind - 0.6 * hit);
      armR.rotation.set(0, 0, -1.1 * wind + 0.6 * hit);
      root.position.y = 0.3 * wind;
      root.rotation.x = -0.25 * wind;
      break;
    case 'crouch': // 身を低くして溜める
      root.position.y = -0.25 * wind;
      root.rotation.x = 0.25 * wind - 0.3 * hit;
      armL.rotation.x = 0.5 * wind;
      armR.rotation.x = 0.5 * wind;
      legL.rotation.x = 0.4 * wind;
      legR.rotation.x = -0.4 * wind;
      break;
    case 'spin':
      root.rotation.y = (k + 1) * Math.PI * 4;
      armL.rotation.set(0, 0, 1.3);
      armR.rotation.set(0, 0, -1.3);
      break;
    case 'cast': // 両手を掲げる
      armL.rotation.set(-2.8, 0, 0.3);
      armR.rotation.set(-2.8, 0, -0.3);
      root.position.y = 0.15 * Math.sin(t * 8);
      break;
    case 'charge': // 必殺技の溜め：震えながら光る
      root.position.y = 0.3 + 0.08 * Math.sin(t * 30);
      root.rotation.x = -0.35;
      armL.rotation.set(-2.6, 0, 0.9);
      armR.rotation.set(-2.6, 0, -0.9);
      if (m.heads) for (const h of m.heads) h.rotation.x = (h.userData.rx ?? 0) - 0.8;
      break;
    default:
      break;
  }
}

/**
 * ホストの台本の実行役。ctx は boss.js から：
 * { game, b, C, P, hitAll, inCircle, inRect, shot, ring, emit, nova, hazard, vfx, meleeHit, wm, cm, target }
 */
export function createMoveRunner(ctx) {
  const { game, b, C, P } = ctx;
  let run = null; // { name, p, mul, steps: [{s, armed, done, spots}], active: [] , safe: [] , aim }

  const alivePlayers = () => game.players.filter((o) => o.alive);

  function aimAt(tgt) {
    if (tgt) b.yaw = yawTo(b.pos.x, b.pos.z, tgt.pos.x, tgt.pos.z);
    return b.yaw;
  }

  /** 予兆・当たりの基準点 */
  function spots(s, tgt) {
    const yaw = s.reaim === false && run.aim !== undefined ? run.aim : aimAt(tgt);
    run.aim = yaw;
    const a = yaw + (s.a || 0);
    const fwd = (x, z, ang, d, sd = 0) => ({ x: x + Math.sin(ang) * d + Math.cos(ang) * sd, z: z + Math.cos(ang) * d - Math.sin(ang) * sd, yaw: ang });
    switch (s.o || 'boss') {
      case 'tgt': return tgt ? [fwd(tgt.pos.x, tgt.pos.z, a, s.dist || 0)] : [];
      case 'each': return alivePlayers().map((pl) => fwd(pl.pos.x, pl.pos.z, a, 0));
      case 'rand': {
        const c = tgt || b;
        return Array.from({ length: s.n || 3 }, (_, i) => {
          const ang = rand(0, Math.PI * 2);
          const r = i === 0 && s.first !== false ? 0 : rand(2, s.spread || 8);
          return fwd(c.pos.x, c.pos.z, ang, r);
        });
      }
      case 'ring': {
        const off = s.off ?? rand(0, Math.PI * 2);
        return Array.from({ length: s.n || 6 }, (_, i) => {
          const ang = off + (i / (s.n || 6)) * Math.PI * 2;
          return fwd(b.pos.x, b.pos.z, ang, s.rr || 8);
        });
      }
      case 'fan': // ボスから扇状に並ぶ方向（ブレス・裂け目）
        return Array.from({ length: s.n || 3 }, (_, i) => {
          const ang = a + (i - ((s.n || 3) - 1) / 2) * (s.spread || 0.5);
          return fwd(b.pos.x, b.pos.z, ang, s.dist || 0);
        });
      case 'grid': { // 裂け目：標的を通る十字・平行線
        const c = tgt || b;
        const n = s.n || 3;
        return Array.from({ length: n }, (_, i) => {
          const ang = a + (i % 2 ? Math.PI / 2 : 0);
          const sd = (Math.floor(i / 2) - (n > 2 ? 0.5 : 0)) * (s.gapW || 6);
          return fwd(c.pos.x, c.pos.z, ang, -(s.len || 30) / 2, sd);
        });
      }
      default: return [fwd(b.pos.x, b.pos.z, a, s.dist || 0, s.side || 0)];
    }
  }

  // 台本が終わったあとに時間差で当たる分（emit）もあるので、run は見ない
  const fracOf = (s) => ctx.meleeHit * (s.k ?? (s.ultK ? 3 : 1));

  /** 形ごとの当たり判定 */
  function testOf(s, sp) {
    switch (s.shape) {
      case 'sector': return (x, z, pr) => {
        const d = Math.hypot(x - sp.x, z - sp.z);
        return d < s.r + pr && (d < 1.2 || Math.abs(angleDiff(sp.yaw, yawTo(sp.x, sp.z, x, z))) < s.arc / 2);
      };
      case 'rect': return ctx.inRect(sp.x, sp.z, sp.yaw, s.len, s.w);
      case 'donut': return (x, z, pr) => {
        const d = Math.hypot(x - sp.x, z - sp.z);
        return d > s.rIn - pr * 0.5 && d < s.rOut + pr;
      };
      default: return ctx.inCircle(sp.x, sp.z, s.r);
    }
  }

  function teleFor(s, sp, dur) {
    if (s.noTele) return null;
    switch (s.shape) {
      case 'sector': return game.fx.telegraph('sector', { x: sp.x, z: sp.z, r: s.r, arc: s.arc, angle: sp.yaw, dur });
      case 'rect': return game.fx.telegraph('rect', { x: sp.x, z: sp.z, len: s.len, width: s.w, angle: sp.yaw, dur });
      case 'donut':
        ctx.hazard('donut', { x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), rIn: s.rIn, rOut: s.rOut, dur });
        return null;
      default: return game.fx.telegraph('circle', { x: sp.x, z: sp.z, r: s.r, dur });
    }
  }

  const color = (s) => s.color ?? run?.p.color ?? C.color;

  /** 予兆を出す（arm の時刻） */
  function arm(st, tgt) {
    const s = st.s;
    const left = Math.max(0.05, st.at - b.t);
    switch (s.do) {
      case 'hit':
      case 'zones': {
        st.spots = spots(s, tgt);
        st.teles = st.spots.map((sp, i) => teleFor(s.do === 'zones' ? { ...s, shape: 'circle' } : s, sp, left + i * (s.stagger || 0)));
        if (s.do === 'zones' && s.fx === 'meteor') st.spots.forEach((sp, i) => ctx.vfx('meteor', { x: sp.x, z: sp.z, r: s.r, color: color(s), fall: left + i * (s.stagger || 0) }));
        if (s.follow) st.followT = s.follow * run.mul;
        break;
      }
      case 'move': armMove(st, tgt, left); break;
      case 'still': // 動くな：今の位置を覚えておく
        st.pos = new Map(game.players.filter((o) => o.alive).map((o) => [o, { x: o.pos.x, z: o.pos.z }]));
        break;
      case 'mover': {
        const sp = spots(s, tgt)[0];
        const ang = sp.yaw;
        const len = s.len ?? (tgt ? Math.min(30, Math.hypot(tgt.pos.x - sp.x, tgt.pos.z - sp.z) + 4) : 14);
        st.path = { x0: sp.x, z0: sp.z, x1: sp.x + Math.sin(ang) * len, z1: sp.z + Math.cos(ang) * len, speed: s.speed, back: !!s.back };
        st.teles = [game.fx.telegraph('rect', { x: sp.x, z: sp.z, len, width: s.r * 2, angle: ang, dur: left })];
        break;
      }
      case 'rot': {
        st.a0 = run.aim = aimAt(tgt);
        st.a0 += s.a || 0;
        if (s.sweepTele) {
          // なぎ払うブレス：通る範囲をまとめて1枚で見せる
          const sweep = s.speed * s.dur;
          st.teles = [game.fx.telegraph('sector', { x: b.pos.x, z: b.pos.z, r: s.len, arc: Math.min(Math.PI * 2, s.arc + Math.abs(sweep)), angle: st.a0 + sweep / 2, dur: left + s.dur })];
        } else st.teles = Array.from({ length: s.arms }, (_, i) => game.fx.telegraph('sector', { x: b.pos.x, z: b.pos.z, r: s.len, arc: s.arc, angle: st.a0 + (i / s.arms) * Math.PI * 2, dur: left }));
        break;
      }
      case 'safe': {
        // 安全地帯をボスのまわりに置く（groups：[{ kind, n, rr }]）
        const list = [];
        for (const g of s.groups) {
          const off = rand(0, Math.PI * 2);
          for (let i = 0; i < g.n; i++) {
            const a = off + (i / g.n) * Math.PI * 2 + rand(-0.2, 0.2);
            let x = b.pos.x + Math.sin(a) * g.rr;
            let z = b.pos.z + Math.cos(a) * g.rr;
            for (let tries = 0; tries < 6 && game.world.blocked(x, z); tries++) {
              x = b.pos.x + (x - b.pos.x) * 0.8;
              z = b.pos.z + (z - b.pos.z) * 0.8;
            }
            list.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: g.r ?? s.r ?? 2.6, kind: g.kind });
          }
        }
        run.safe = list;
        ctx.vfx('safe', { list, dur: s.show ?? 3 });
        break;
      }
      default: break;
    }
  }

  function armMove(st, tgt, left) {
    const s = st.s;
    const m = s.m;
    if (m === 'leap' || m === 'dive' || m === 'warp') {
      let sp;
      if (s.to === 'back' && tgt) {
        const back = (tgt.yaw ?? 0) + Math.PI;
        sp = { x: tgt.pos.x + Math.sin(back) * (s.dist || 4), z: tgt.pos.z + Math.cos(back) * (s.dist || 4) };
        if (game.world.blocked(sp.x, sp.z)) sp = { x: tgt.pos.x - Math.sin(back) * (s.dist || 4), z: tgt.pos.z - Math.cos(back) * (s.dist || 4) };
      } else if (s.to === 'self') sp = { x: b.pos.x, z: b.pos.z };
      else if (s.to === 'rand' && tgt) {
        // 標的のまわりのどこか（見えにくい横・後ろ寄り）
        for (let i = 0; i < 8; i++) {
          const a = (tgt.yaw ?? 0) + Math.PI * rand(0.45, 1.55);
          sp = { x: tgt.pos.x + Math.sin(a) * (s.dist || 7), z: tgt.pos.z + Math.cos(a) * (s.dist || 7) };
          if (!game.world.blocked(sp.x, sp.z)) break;
        }
      }
      else sp = tgt ? { x: tgt.pos.x, z: tgt.pos.z } : { x: b.pos.x, z: b.pos.z };
      st.dest = sp;
      st.from = { x: b.pos.x, z: b.pos.z, y: b.pos.y };
      if (s.r) st.teles = [game.fx.telegraph('circle', { x: sp.x, z: sp.z, r: s.r, dur: left + (s.dur || 0) * run.mul })];
      if (s.follow) st.followT = s.follow * run.mul;
    } else if (m === 'dash') {
      run.aim = aimAt(tgt);
      b.yaw += s.a || 0; // 斜めに走る（ジグザグ・挟み込み）
      if ((s.hitR ?? 0) < 0) return; // 当たらない移動（回転斧の前進）は予兆なし
      const len = s.speed * s.dur * run.mul;
      st.teles = [game.fx.telegraph('rect', { x: b.pos.x, z: b.pos.z, len, width: s.w || b.radius * 2, angle: b.yaw, dur: left })];
    }
  }

  /** 当たる時刻 */
  function fire(st, tgt) {
    const s = st.s;
    const col = color(s);
    st.teles?.forEach((t) => t?.end());
    st.teles = null;
    switch (s.do) {
      case 'hit':
        for (const sp of st.spots) {
          ctx.hitAll(testOf(s, sp), fracOf(s), sp.x, sp.z);
          if (s.fx) {
            const fd = s.fxDist || 0;
            ctx.vfx(s.fx, { x: +(sp.x + Math.sin(sp.yaw) * fd).toFixed(2), z: +(sp.z + Math.cos(sp.yaw) * fd).toFixed(2), yaw: +sp.yaw.toFixed(3), r: s.r, arc: s.arc, len: s.len, w: s.w, color: col, dur: s.fxDur, dir: s.a ? Math.sign(s.a) : 1, ...s.fxd });
          }
          if (s.impact !== false && s.shape !== 'rect' && s.shape !== 'sector') ctx.vfx('impact', { x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), r: s.r ?? s.rOut ?? 3, color: col });
        }
        game.fx.shake(s.shake ?? 0.4);
        game.sound.se(s.se || 'slam');
        break;
      case 'zones':
        // 予兆はもう出ているので、ここで落とす（stagger ごとに少しずつ）
        st.spots.forEach((sp, i) => {
          const hitIt = () => {
            ctx.hitAll(ctx.inCircle(sp.x, sp.z, s.r), fracOf(s), sp.x, sp.z);
            ctx.vfx('impact', { x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), r: s.r, color: col });
            if (s.fx && s.fx !== 'meteor') ctx.vfx(s.fx, { x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), r: s.r * 0.8, color: col });
            game.fx.burst(sp.x, 0.4, sp.z, col, 16, { speed: 6, up: 8, life: 0.6, size: 0.22 });
            game.sound.se('slam');
            const n = Math.round((s.burst || 0) * ctx.cm());
            const off = rand(0, 1);
            for (let k = 0; k < n; k++) ctx.shot(sp.x, sp.z, off + (k / n) * Math.PI * 2, s.shotSpeed || 7, col);
          };
          if (!s.stagger || i === 0) hitIt();
          else ctx.emit(i * s.stagger * run.mul, 1, 1, hitIt);
        });
        break;
      case 'shots': fireShots(s, col, tgt); break;
      case 'nova':
        ctx.emit(0, s.gap ?? 0.45, s.waves ?? 1, () => {
          ctx.nova(b.pos.x, b.pos.z, s.max, s.speed, s.width ?? 0.6, col);
          game.sound.se('slam');
          game.fx.shake(0.3);
        });
        break;
      case 'pull':
        ctx.hazard('pull', { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), strength: s.strength, t: s.dur * run.mul, color: col });
        game.sound.se('roar');
        break;
      case 'wall': {
        const yaw = aimAt(tgt) + (s.a || 0);
        const back = s.back ?? 0;
        ctx.hazard('wall', {
          x: +(b.pos.x - Math.sin(yaw) * back).toFixed(2), z: +(b.pos.z - Math.cos(yaw) * back).toFixed(2), yaw: +yaw.toFixed(3),
          wait: (s.wait ?? 0.6) * run.mul, speed: s.speed, max: s.max ?? 50, thick: s.thick ?? 1.4,
          gapC: +(s.gapC ?? rand(-(s.gapRange ?? 7), s.gapRange ?? 7)).toFixed(2), gapW: s.gapW ?? 4.4, frac: fracOf(s), color: col,
        });
        break;
      }
      case 'mover': {
        const p = st.path;
        const len = Math.hypot(p.x1 - p.x0, p.z1 - p.z0);
        const life = (p.back ? 2 : 1) * len / p.speed;
        ctx.vfx(s.fx || 'twister', { ...p, r: s.r, color: col, life, yaw: Math.atan2(p.x1 - p.x0, p.z1 - p.z0) });
        run.active.push({ kind: 'mover', s, p, t: 0, life, hit: new Set() });
        break;
      }
      case 'rot':
        ctx.vfx('rot', { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), a0: +st.a0.toFixed(3), speed: s.speed, arms: s.arms, arc: s.arc, len: s.len, dur: s.dur, color: col, colors: s.colors });
        run.active.push({ kind: 'rot', s, a0: st.a0, x: b.pos.x, z: b.pos.z, t: 0, hit: new Set() });
        break;
      case 'move': fireMove(st, tgt); break;
      case 'heal': {
        const add = Math.round(b.maxHp * s.frac);
        b.hp = Math.min(b.maxHp, b.hp + add);
        game.fx.text(b.pos.x, C.hpY, b.pos.z, `+${add}`, '#69f0ae', true);
        game.fx.burst(b.pos.x, C.hpY * 0.6, b.pos.z, col, 40, { speed: 4, up: 6, life: 0.9 });
        break;
      }
      case 'check': { // 安全地帯の外にいる人に当てる（need：その種類の円の中だけ安全）
        const safe = (run.safe || []).filter((o) => !s.need || o.kind === s.need);
        ctx.hitAll((x, z, pr) => !safe.some((o) => Math.hypot(x - o.x, z - o.z) < o.r - pr * 0.3), fracOf(s), b.pos.x, b.pos.z);
        game.fx.shake(1.2);
        game.sound.se('slam');
        if (s.flash !== false) ctx.vfx('flash', { color: col, dur: 0.6 });
        break;
      }
      case 'facing': // ボスの方を向いている人に当てる（背を向けていれば無事）。invert なら背を向けている人に当てる
        ctx.hitAll((x, z, pr, pl) => {
          if (!pl || pl.yaw === undefined) return true;
          const looking = Math.abs(angleDiff(pl.yaw, yawTo(x, z, b.pos.x, b.pos.z))) < Math.PI / 2;
          return s.invert ? !looking : looking;
        }, fracOf(s), b.pos.x, b.pos.z);
        game.fx.shake(1);
        game.sound.se('gate');
        ctx.vfx('flash', { color: col, dur: 0.8, peak: 0.85 });
        break;
      case 'cover': { // 岩陰：ボスから見て岩の後ろにいれば無事
        const rocks = (run.safe || []).filter((o) => o.kind === 'rock');
        ctx.hitAll((x, z) => !rocks.some((o) => {
          const dx = o.x - b.pos.x;
          const dz = o.z - b.pos.z;
          const L = Math.hypot(dx, dz) || 1;
          const px = x - b.pos.x;
          const pz = z - b.pos.z;
          const along = (px * dx + pz * dz) / L;
          const side = Math.abs(px * dz - pz * dx) / L;
          return along > L - o.r * 0.5 && along < L + 7 && side < o.r * 0.95;
        }), fracOf(s), b.pos.x, b.pos.z);
        game.fx.shake(1.2);
        game.sound.se('wave');
        ctx.vfx('flash', { color: col, dur: 0.7, peak: 0.6 });
        break;
      }
      case 'still': { // 動くな：予兆のあいだに動いた人（回避も）に当てる
        const pos = st.pos || new Map();
        ctx.hitAll((x, z, pr, pl) => {
          const o = pl && pos.get(pl);
          if (!o) return false;
          return Math.hypot(x - o.x, z - o.z) > (s.tol ?? 0.6);
        }, fracOf(s), b.pos.x, b.pos.z);
        game.sound.se('gate');
        ctx.vfx('flash', { color: col, dur: 0.5, peak: 0.5 });
        break;
      }
      case 'all': // 全体：回避の無敵でしか避けられない
        ctx.hitAll(() => true, fracOf(s), b.pos.x, b.pos.z);
        game.fx.shake(0.9);
        game.sound.se(s.se || 'slam');
        if (s.flash) ctx.vfx('flash', { color: col, dur: 0.35, peak: 0.45 });
        break;
      case 'vfx': {
        const sp = s.o ? spots(s, tgt)[0] || b.pos : b.pos;
        ctx.vfx(s.type, { x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), y: s.y ?? C.hpY, yaw: +b.yaw.toFixed(3), color: col, ...s.d });
        if (s.se) game.sound.se(s.se);
        break;
      }
      case 'banner':
        game.hudView.banner(s.text);
        game.sound.se(s.se || 'windup');
        break;
      case 'se':
        game.sound.se(s.se);
        if (s.shake) game.fx.shake(s.shake);
        break;
      default: break;
    }
  }

  function fireShots(s, col, tgt) {
    const pat = s.pat || 'fan';
    const from = () => {
      const [sd, fw] = s.from || [0, 1.5];
      return { x: b.pos.x + Math.sin(b.yaw) * fw + Math.cos(b.yaw) * sd, z: b.pos.z + Math.cos(b.yaw) * fw - Math.sin(b.yaw) * sd };
    };
    if (pat === 'ring') {
      const n = Math.round(s.n * ctx.cm());
      const off = rand(0, 1);
      ctx.emit(0, s.gap ?? 0.35, s.waves ?? 1, (i) => {
        const o = from();
        ctx.ring(o.x, o.z, n, off + (i % 2) * (Math.PI / n) + (s.turn || 0) * i, s.speed, col);
      });
    } else if (pat === 'spiral') {
      const base = rand(0, Math.PI * 2);
      const steps = Math.round(s.dur / s.interval);
      ctx.emit(0, s.interval, steps, (i) => {
        const o = from();
        for (let k = 0; k < s.arms; k++) {
          const a = base + i * s.turn * (s.dir || 1) + (k / s.arms) * Math.PI * 2;
          ctx.shot(o.x, o.z, a, s.speed, col);
        }
        if (i % 4 === 0) game.sound.se('shoot');
      });
    } else {
      const n = Math.round(s.n * ctx.cm());
      ctx.emit(0, s.gap ?? 0.3, s.volleys ?? 1, (i) => {
        if (s.track !== false) aimAt(ctx.target());
        const o = from();
        const shift = s.alternate && i % 2 ? s.spread / 2 : 0;
        for (let k = 0; k < n; k++) {
          const a = b.yaw + (s.a || 0) + (k - (n - 1) / 2) * s.spread + shift;
          ctx.shot(o.x, o.z, a, s.speed, col);
        }
        game.sound.se('shoot');
      });
    }
  }

  function fireMove(st, tgt) {
    const s = st.s;
    switch (s.m) {
      case 'leap':
      case 'dive':
        st.from = { x: b.pos.x, z: b.pos.z, y: b.pos.y };
        run.active.push({ kind: 'jump', st, s, t: 0, dur: s.dur * run.mul });
        game.sound.se('swing');
        break;
      case 'warp':
        b.pos.x = st.dest.x;
        b.pos.z = st.dest.z;
        b.pos.y = 0;
        b.hidden = false;
        aimAt(tgt);
        st.teles?.forEach((t) => t?.end());
        game.fx.burst(b.pos.x, 2, b.pos.z, s.color ?? C.color, 40, { speed: 6, up: 4, life: 0.7 });
        game.sound.se('gate');
        if (s.r) {
          // 地中から飛び出す：出た場所のまわりに当たる
          ctx.hitAll(ctx.inCircle(b.pos.x, b.pos.z, s.r), fracOf(s), b.pos.x, b.pos.z);
          ctx.vfx('impact', { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), r: s.r, color: color(s) });
          if (s.fx) ctx.vfx(s.fx, { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), r: s.r, color: color(s) });
          game.fx.shake(0.9);
          game.sound.se('slam');
          if (s.ring) ctx.ring(b.pos.x, b.pos.z, Math.round(s.ring * ctx.cm()), rand(0, 1), 8, color(s));
        }
        break;
      case 'dash':
        run.active.push({ kind: 'dash', s, t: 0, dur: s.dur * run.mul, hit: new Set() });
        game.sound.se('swing');
        break;
      case 'rise':
        run.active.push({ kind: 'rise', s, t: 0, dur: s.dur * run.mul, y0: b.pos.y });
        game.sound.se('spin');
        break;
      case 'hide':
        b.hidden = true;
        game.fx.burst(b.pos.x, 0.5, b.pos.z, s.color ?? C.color, 40, { speed: 6, up: 5, life: 0.7 });
        game.sound.se('slam');
        break;
      case 'orbit':
        run.active.push({ kind: 'orbit', s, t: 0, dur: s.dur * run.mul, ang: tgt ? yawTo(tgt.pos.x, tgt.pos.z, b.pos.x, b.pos.z) : 0 });
        break;
      case 'back':
        run.active.push({ kind: 'back', s, t: 0, dur: s.dur * run.mul, yaw: b.yaw + Math.PI });
        break;
      default: break;
    }
  }

  /** 続いている動き（跳躍・突進・竜巻・回るブレス） */
  function updateActive(dt, tgt) {
    for (let i = run.active.length - 1; i >= 0; i--) {
      const a = run.active[i];
      a.t += dt;
      let done = false;
      switch (a.kind) {
        case 'jump': {
          const { st, s } = a;
          const k = Math.min(1, a.t / a.dur);
          b.pos.x = st.from.x + (st.dest.x - st.from.x) * k;
          b.pos.z = st.from.z + (st.dest.z - st.from.z) * k;
          b.pos.y = s.m === 'dive' ? st.from.y * (1 - k * k) : Math.sin(k * Math.PI) * (s.h ?? 6);
          b.hidden = false;
          if (k >= 1) {
            b.pos.y = 0;
            st.teles?.forEach((t) => t?.end());
            if (s.r) {
              ctx.hitAll(ctx.inCircle(b.pos.x, b.pos.z, s.r), fracOf(s), b.pos.x, b.pos.z);
              ctx.vfx('impact', { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), r: s.r, color: color(s) });
              if (s.fx) ctx.vfx(s.fx, { x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), r: s.r, color: color(s) });
              game.fx.burst(b.pos.x, 0.3, b.pos.z, color(s), 40, { speed: 10, up: 6, life: 0.8, size: 0.25 });
              game.fx.shake(1);
              game.sound.se('slam');
              if (s.ring) ctx.ring(b.pos.x, b.pos.z, Math.round(s.ring * ctx.cm()), rand(0, 1), 8, color(s));
            }
            done = true;
          }
          break;
        }
        case 'dash': {
          const s = a.s;
          const sx = Math.sin(b.yaw);
          const sz = Math.cos(b.yaw);
          b.pos.x += sx * s.speed * dt;
          b.pos.z += sz * s.speed * dt;
          const r = s.hitR ?? b.radius + 0.3;
          ctx.hitAll((x, z, pr, who) => {
            if (a.hit.has(who) || Math.hypot(x - b.pos.x, z - b.pos.z) >= r + pr) return false;
            a.hit.add(who);
            return true;
          }, fracOf(s), b.pos.x - sx, b.pos.z - sz);
          if (Math.random() < 0.7) game.fx.burst(b.pos.x, 0.5, b.pos.z, color(s), 3, { speed: 2, up: 2, life: 0.4 });
          const px = b.pos.x;
          const pz = b.pos.z;
          game.world.collide(b.pos, b.radius);
          const bumped = Math.abs(px - b.pos.x) + Math.abs(pz - b.pos.z) > 0.01;
          if (bumped && s.bumpStun) {
            // 壁に激突して怯む：残りの台本はやめて気絶
            game.fx.shake(1);
            game.sound.se('slam');
            game.fx.burst(b.pos.x, C.hpY * 0.7, b.pos.z, 0xffee58, 40, { speed: 6, up: 5, life: 0.9 });
            game.toast(`${C.name}が壁に激突して怯んだ！ 今がチャンス`, 2000);
            run.stunned = s.bumpStun;
            return;
          }
          if (a.t >= a.dur || bumped) done = true;
          break;
        }
        case 'rise': {
          const k = Math.min(1, a.t / a.dur);
          b.pos.y = a.y0 + (a.s.h - a.y0) * Math.sin((k * Math.PI) / 2);
          done = k >= 1;
          break;
        }
        case 'orbit': {
          const s = a.s;
          if (tgt) {
            a.ang += (s.speed ?? 1.6) * dt;
            const tx = tgt.pos.x + Math.sin(a.ang) * (s.rr ?? 8);
            const tz = tgt.pos.z + Math.cos(a.ang) * (s.rr ?? 8);
            const kk = Math.min(1, dt * 4);
            b.pos.x += (tx - b.pos.x) * kk;
            b.pos.z += (tz - b.pos.z) * kk;
            b.pos.y = s.h ?? 0;
            b.yaw = a.ang + Math.PI / 2;
          }
          done = a.t >= a.dur;
          break;
        }
        case 'back': {
          const k = Math.min(1, a.t / a.dur);
          b.pos.x += Math.sin(a.yaw) * (a.s.dist / a.dur) * dt;
          b.pos.z += Math.cos(a.yaw) * (a.s.dist / a.dur) * dt;
          b.pos.y = Math.sin(k * Math.PI) * 1.5;
          game.world.collide(b.pos, b.radius);
          done = k >= 1;
          break;
        }
        case 'mover': {
          const p = game.bossVfx.moverPos(a.p, a.t);
          ctx.hitAll((x, z, pr, who) => {
            if (a.hit.has(who) || Math.hypot(x - p.x, z - p.z) >= a.s.r + pr) return false;
            a.hit.add(who);
            return true;
          }, fracOf(a.s), p.x, p.z);
          if (a.s.back && a.t > a.life / 2 && !a.cleared) {
            a.cleared = true;
            a.hit.clear(); // 戻りでも当たる
          }
          done = a.t >= a.life;
          break;
        }
        case 'rot': {
          const s = a.s;
          const tt = Math.min(a.t, s.dur);
          ctx.hitAll((x, z, pr, who) => {
            if (a.hit.has(who)) return false;
            const d = Math.hypot(x - a.x, z - a.z);
            if (d > s.len + pr || d < 1) return false;
            const ang = yawTo(a.x, a.z, x, z);
            for (let k = 0; k < s.arms; k++) {
              const arm = a.a0 + (k / s.arms) * Math.PI * 2 + s.speed * tt;
              if (Math.abs(angleDiff(arm, ang)) < s.arc / 2 + pr / Math.max(1, d)) {
                a.hit.add(who);
                return true;
              }
            }
            return false;
          }, fracOf(s), a.x, a.z);
          done = a.t >= s.dur;
          break;
        }
        default: done = true;
      }
      if (done) run.active.splice(i, 1);
    }
  }

  return {
    get running() { return !!run; },
    start(name, tgt) {
      const p = P[name];
      run = { name, p, mul: p.ult ? 1 : ctx.wm(), steps: [], active: [], safe: null, aim: aimAt(tgt) };
      for (const s of p.steps) {
        if (p.ult) s.ultK = true; // 必殺技は既定で 3倍
        run.steps.push({ s, ...stepTimes(s, run.mul), armed: false, done: false });
      }
      run.end = seqEnd(p, run.mul);
      b.pattern = name;
      b.state = 'seq';
      b.t = 0;
      if (p.ult) {
        ctx.vfx('warn', { boss: C.name, name: p.name, hint: p.hint || '', dur: p.charge });
        game.sound.se('roar');
        game.fx.shake(0.6);
      } else game.sound.se('windup');
    },
    /** 毎フレーム（state === 'seq'）。終わったら true */
    update(dt, tgt) {
      if (!run) return true;
      for (const st of run.steps) {
        if (!st.armed && b.t >= st.arm) {
          st.armed = true;
          arm(st, tgt);
        }
        // 追いかける予兆（落下・急降下）：follow 秒だけ標的の足元を追う
        if (st.armed && !st.done && st.followT > 0 && tgt && b.t - st.arm < st.followT) {
          const k = Math.min(1, dt * 3);
          const tgtSp = st.spots?.[0] || st.dest;
          if (tgtSp) {
            tgtSp.x += (tgt.pos.x - tgtSp.x) * k;
            tgtSp.z += (tgt.pos.z - tgtSp.z) * k;
            st.teles?.[0]?.follow(tgtSp.x, tgtSp.z, tgtSp.yaw ?? 0);
          }
        }
        if (st.armed && !st.done && b.t >= st.at) {
          st.done = true;
          fire(st, tgt);
        }
      }
      updateActive(dt, tgt);
      if (run.stunned) {
        const s = run.stunned;
        this.cancel();
        b.stunFor = s;
        b.state = 'stun';
        b.t = 0;
        return false;
      }
      if (b.t >= run.end && run.active.length === 0) {
        run = null;
        b.hidden = false;
        b.pos.y = 0;
        return true;
      }
      return false;
    },
    cancel() {
      if (!run) return;
      for (const st of run.steps) st.teles?.forEach((t) => t?.end());
      run = null;
      b.hidden = false;
    },
    get mul() { return run?.mul ?? 1; },
  };
}
