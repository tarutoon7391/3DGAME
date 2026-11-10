// 1ステージ分のプレイ：ルール進行（入力は intent としてデータで受け取る）
import { T, PLAYER, SHADOW_VIS, COVER_VIS, ALARM_RADIUS, LOW } from './config.js';
import { buildLevel } from './level.js';
import { createPlayer } from './player.js';
import { createGuard } from './guards.js';
import { createCameras, createLasers } from './security.js';
import { createGadgets } from './gadgets.js';

/**
 * @param {{scene, fx, sfx, stage, stageNo, playerCount?:number}} o
 */
export function createSession({ scene, fx, sfx, stage, stageNo, playerCount = 1 }) {
  const level = buildLevel(scene, stage);
  const { grid, group } = level;
  const gadgets = createGadgets(group);
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    const p = createPlayer(group);
    p.reset(level.start.x + i * 0.6, level.start.z);
    players.push(p);
  }
  const guards = (stage.guards || []).map((def) => createGuard(group, level, def, fx, gadgets));
  const cameras = createCameras(group, level, gadgets);
  const lasers = createLasers(group, level);

  // ゲームの状態（JSON 化できる値）
  const state = {
    stageNo,
    phase: 'play', // play | clear | caught
    time: 0,
    found: 0,
    keys: 0,
    coin: stage.gadgets?.coin ?? 3,
    smoke: stage.gadgets?.smoke ?? 1,
    mainTaken: false,
    subTaken: 0,
    subTotal: level.treasures.filter((t) => !t.main).length,
    tipsShown: [],
    guardStepT: 0,
  };
  const messages = []; // UI へ出すトースト
  let alarmFlash = 0;

  // ---- 見つかりやすさ
  function visOf(pl) {
    let v = PLAYER.vis[pl.mode] * (pl.moving ? 1 : 0.85);
    v *= level.isLit(pl.pos.x, pl.pos.z) ? 1 : 0.75;
    if (level.isShadow(pl.pos.x, pl.pos.z)) v *= SHADOW_VIS;
    if (pl.mode === 'crouch' && nearLow(pl.pos.x, pl.pos.z)) v *= COVER_VIS;
    return v;
  }
  function nearLow(x, z) {
    const c = grid.toTile(x);
    const r = grid.toTile(z);
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) if (grid.flag(c + ox, r + oz) & LOW) return true;
    return false;
  }

  // ---- 音と警報
  function noise(x, z, radius, strength) {
    for (const g of guards) {
      const d = Math.hypot(g.s.x - x, g.s.z - z);
      const r = grid.los(g.s.x, g.s.z, x, z) ? radius : radius * 0.6;
      if (d < r) g.hear(x, z, strength);
    }
  }
  function alarm(x, z, why) {
    state.found++;
    alarmFlash = 2.2;
    sfx.alarm();
    fx.shake(0.4);
    fx.ripple(x, z, 6, 0xff3030, 1.2);
    messages.push(`警報！（${why}）`);
    for (const g of guards) if (Math.hypot(g.s.x - x, g.s.z - z) < ALARM_RADIUS) g.alarm(x, z);
  }

  // ---- 近くの調べられる物
  function nearest(pl) {
    let best = null;
    let bd = PLAYER.interactRange + 0.05;
    const consider = (kind, obj, x, z) => {
      const d = Math.hypot(x - pl.pos.x, z - pl.pos.z);
      if (d < bd) { bd = d; best = { kind, obj }; }
    };
    for (const t of level.treasures) if (!t.taken) consider('treasure', t, t.x, t.z);
    for (const k of level.keys) if (!k.taken) consider('key', k, k.x, k.z);
    for (const d of level.doors) consider('door', d, d.x, d.z);
    for (const l of level.lockers) consider('locker', l, l.x, l.z);
    return best;
  }
  function hintFor(pl) {
    if (pl.hidden) return 'F：ロッカーから出る';
    const n = nearest(pl);
    if (!n) return '';
    if (n.kind === 'treasure') return `F：盗む（${n.obj.name}）`;
    if (n.kind === 'key') return 'F：カードキーを取る';
    if (n.kind === 'locker') return 'F：ロッカーに隠れる';
    if (n.obj.locked && !n.obj.open && state.keys === 0) return '鍵がかかっている（カードキーが必要）';
    return n.obj.open ? 'F：扉を閉める' : 'F：扉を開ける';
  }
  function occupied(door) {
    const near = (x, z) => Math.abs(x - door.x) < T / 2 + 0.4 && Math.abs(z - door.z) < T / 2 + 0.4;
    return players.some((p) => near(p.pos.x, p.pos.z)) || guards.some((g) => near(g.s.x, g.s.z));
  }

  function act(pl, idx) {
    if (pl.hidden) {
      pl.unhide();
      sfx.hide();
      return;
    }
    const n = nearest(pl);
    if (!n) return;
    const o = n.obj;
    if (n.kind === 'treasure') {
      o.taken = true;
      o.gem.visible = false;
      if (o.gem.userData.glass) o.gem.userData.glass.visible = false;
      if (o.main) state.mainTaken = true;
      else state.subTaken++;
      sfx.steal(o.main);
      fx.sparkle(o.x, 1.5, o.z, o.color, o.main ? 60 : 30);
      messages.push(o.main ? `${o.name}を盗んだ！ 出口へ急げ` : `${o.name}を盗んだ`);
      noise(o.x, o.z, 2.5, 0.1);
    } else if (n.kind === 'key') {
      pickKey(o);
    } else if (n.kind === 'locker') {
      pl.hide(o);
      sfx.hide();
      const li = level.lockers.indexOf(o);
      for (const g of guards) g.sawHiding(idx, li);
    } else if (n.kind === 'door') {
      if (o.locked && !o.open && state.keys === 0) {
        sfx.locked();
        messages.push('鍵がかかっている。カードキーを探そう');
        return;
      }
      if (o.open && occupied(o)) return;
      level.setDoor(o, !o.open);
      sfx.door(o.open);
      noise(o.x, o.z, 3, 0.1);
    }
  }
  function pickKey(k) {
    k.taken = true;
    k.mesh.visible = false;
    state.keys++;
    sfx.key();
    fx.sparkle(k.x, 1, k.z, 0xffeb3b, 20);
    messages.push('カードキーを手に入れた（鍵付き扉が開けられる）');
  }

  /**
   * 1フレーム進める。intents[i] = { mx, mz, run, crouch, act, coin, smoke }（players[i] の入力）
   */
  function update(dt, time, intents) {
    if (state.phase !== 'play') return;
    state.time += dt;
    alarmFlash = Math.max(0, alarmFlash - dt);

    players.forEach((pl, i) => {
      const it = intents[i];
      if (!it) return;
      if (it.act) act(pl, i);
      pl.update(dt, time, it, grid, (mode, x, z) => {
        sfx.step(mode);
        const r = PLAYER.noise[mode];
        fx.ripple(x, z, r || 0.6, mode === 'run' ? 0xff9d5c : 0xffffff, mode === 'run' ? 0.9 : 0.6);
        if (r) noise(x, z, r, mode === 'run' ? 0.3 : 0.12);
      });
      if (pl.hidden) return;
      if (it.coin) {
        if (state.coin > 0) {
          state.coin--;
          gadgets.throwCoin(grid, pl.pos.x, pl.pos.z, pl.angle);
          sfx.coinThrow();
        } else { sfx.gadgetEmpty(); messages.push('コインはもうない'); }
      }
      if (it.smoke) {
        if (state.smoke > 0) {
          state.smoke--;
          gadgets.dropSmoke(pl.pos.x, pl.pos.z);
          sfx.smoke();
          fx.ripple(pl.pos.x, pl.pos.z, 2.4, 0xb0b8c0, 0.8);
        } else { sfx.gadgetEmpty(); messages.push('煙玉はもうない'); }
      }
      // 床のギミック
      const c = grid.toTile(pl.pos.x);
      const r = grid.toTile(pl.pos.z);
      for (const k of level.keys) if (!k.taken && Math.hypot(k.x - pl.pos.x, k.z - pl.pos.z) < 0.8) pickKey(k);
      for (const p of level.plates) {
        if (p.c === c && p.r === r) {
          if (p.armed) { p.armed = false; p.flash = 2; alarm(p.x, p.z, '圧力床'); }
        } else p.armed = true;
      }
      if (c === level.exit.c && r === level.exit.r) {
        if (state.mainTaken) state.phase = 'clear';
        else if (!state.exitWarned) { state.exitWarned = true; messages.push('メインのお宝を盗んでから脱出しよう'); }
      } else state.exitWarned = false;
      // ヒント
      (stage.tips || []).forEach((tip, ti) => {
        if (state.tipsShown.includes(ti)) return;
        if (Math.hypot(grid.center(tip.at[0]) - pl.pos.x, grid.center(tip.at[1]) - pl.pos.z) < (tip.r ?? 2) * T * 0.5 + 1) {
          state.tipsShown.push(ti);
          messages.push({ text: tip.text, ms: 4500 });
        }
      });
    });

    gadgets.update(dt, time, (x, z) => {
      sfx.coinLand();
      fx.ripple(x, z, 10, 0xffd54f, 1.3);
      noise(x, z, 10, 0.35);
    });
    lasers.update(dt, time, players, (x, z) => alarm(x, z, 'レーザー'));
    cameras.update(dt, time, players, visOf, (x, z) => alarm(x, z, '監視カメラ'));

    for (const g of guards) {
      g.update(dt, time, players, visOf);
      for (const ev of g.events) {
        if (ev.type === 'detect') {
          state.found++;
          sfx.detect();
          sfx.alarm();
          fx.shake(0.6);
          alarmFlash = 2;
          messages.push('見つかった！ 逃げろ！');
          // 近くの仲間も駆けつける
          for (const o of guards) if (o !== g && Math.hypot(o.s.x - ev.x, o.s.z - ev.z) < 14) o.alarm(g.s.tx, g.s.tz);
        } else if (ev.type === 'suspicious') sfx.suspicious();
        else if (ev.type === 'door') sfx.door(true);
        else if (ev.type === 'catch' && state.phase === 'play') {
          state.phase = 'caught';
          sfx.caught();
          fx.shake(0.8);
        }
      }
      g.events.length = 0;
    }

    // 警備員の足音（近くにいる時だけ）
    state.guardStepT -= dt;
    if (state.guardStepT <= 0) {
      state.guardStepT = 0.5;
      const me = players[0];
      for (const g of guards) {
        if (g.s.waitT > 0 && g.s.state === 'patrol') continue;
        if (Math.hypot(g.s.x - me.pos.x, g.s.z - me.pos.z) < 8) {
          sfx.guardStep();
          fx.ripple(g.s.x, g.s.z, 1.2, 0x6fa8ff, 0.5);
        }
      }
    }
    level.update(dt, time, state.mainTaken);
  }

  return {
    state,
    level,
    players,
    guards,
    messages,
    get alarmFlash() { return alarmFlash; },
    get chasing() { return guards.some((g) => g.s.state === 'chase'); },
    get maxGauge() { return guards.reduce((m, g) => Math.max(m, g.s.state === 'chase' ? 1 : g.s.gauge), 0); },
    hintFor,
    update,
    /** 状態を JSON 化できる形で取り出す（オンライン化の下準備） */
    snapshot() {
      return {
        ...state,
        players: players.map((p) => ({ x: p.pos.x, z: p.pos.z, angle: p.angle, mode: p.mode, hidden: p.hidden ? level.lockers.indexOf(p.hidden) : -1 })),
        guards: guards.map((g) => ({ ...g.s, path: [...g.s.path] })),
        doors: level.doors.map((d) => d.open),
        treasures: level.treasures.map((t) => t.taken),
        keysTaken: level.keys.map((k) => k.taken),
        gadgets: gadgets.snapshot(),
      };
    },
    dispose() {
      level.dispose();
    },
  };
}
