// レイド（協力プレイ）の通信。shared/net.js のルーム中継の上に、このゲームのやり取りを載せる
//
// 役割分担（ホスト権威＋自分のキャラは自分で動かす）：
//   ・自分のプレイヤー … 各自のブラウザで動かし、位置や行動を 'ps' で全員に配る（操作の遅れが出ない）
//   ・ボス・雑魚・召喚物 … ホストだけが動かし、'ws'（状態＋演出イベント）で参加者に配る
//   ・プレイヤー → 敵のダメージ … 当てた人のブラウザで判定し、'dmg' でホストへ
//   ・敵 → プレイヤーの攻撃 … 弾と衝撃波の輪は各自が自分の分だけ判定。それ以外はホストが判定し 'hurt' で本人へ
//   ・回復・強化・蘇生 … 'team' で全員に配り、各自が自分に当てはまるか見て適用
//   ・挑発・召喚 … 'cmd' でホストへ
// 演出のミラー：ホストでボスや雑魚が出した予兆・パーティクル・効果音・敵弾・トーストを記録し、'ws' に載せて参加者で再生する
import { playRemoteSkill } from './jobs.js';
import { createPlayer } from './player.js';

const SEND_EVERY = 1 / 15; // 状態を送る間隔（秒）
const MAX_EVENTS = 220; // 1回に送る演出イベントの上限（パーティクルは間引く）

export function createRaid(game, net, handlers) {
  const hostId = () => net.room?.hostId;
  let sendT = 0;
  let events = [];
  let burstCount = 0;
  const teles = new Map(); // 参加者：ホストの予兆 id → 手元の予兆
  let teleId = 1;
  const offs = [];

  const raid = {
    net,
    get isHost() { return net.isHost; },
    myId: net.myId,

    // ---------- 送信 ----------
    sendHurt(pl, frac, fx, fz) {
      net.send('hurt', { frac, fx: +fx.toFixed(2), fz: +fz.toFixed(2) }, { to: pl.id });
    },
    sendDamage(kind, id, dmg, brk) {
      net.send('dmg', { kind, id, dmg, brk: +brk.toFixed(1) }, { to: hostId() });
    },
    sendSkill(p, id, d) {
      net.send('skill', { id, d });
    },
    sendTeam(eff) {
      net.send('team', eff);
    },
    sendCommand(cmd) {
      net.send('cmd', cmd, { to: hostId() });
    },
    /** ホスト：参加者にも再生させる演出（衝撃波の輪・扉・集合など） */
    event(...ev) {
      if (net.isHost) events.push(ev);
    },
    bossFx(name, d) {
      raid.event('bfx', name, d);
    },
    broadcast(type, data) {
      net.send(type, data);
    },

    /** 毎フレーム：一定間隔で自分の状態（ホストは世界の状態も）を送る */
    update(dt) {
      sendT += dt;
      if (sendT < SEND_EVERY) return;
      sendT = 0;
      const me = game.me();
      if (me) net.send('ps', playerState(me));
      if (net.isHost && game.playing) {
        const ws = {
          step: game.state.progress.bossStep || 0,
          boss: game.boss ? game.boss.snapshot() : null,
          enemies: game.enemies.snapshot(),
          allies: game.allies.snapshot(),
          kills: game.state.progress.stats.kills,
          ev: events,
        };
        events = [];
        burstCount = 0;
        net.send('ws', ws);
      }
    },

    dispose() {
      offs.forEach((f) => f());
      offs.length = 0;
      unmirror();
    },
  };

  function playerState(p) {
    const buffs = {};
    for (const k of Object.keys(p.buffs)) buffs[k] = 1;
    return {
      job: p.jobId, name: p.name,
      x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), yaw: +p.yaw.toFixed(3),
      hp: Math.round(p.hp), maxHp: p.maxHp, alive: p.alive, downed: p.downed,
      action: p.action, actId: p.actId || 0, combo: p.combo, actDur: p.actDur || 0,
      dashing: p.dashing, tired: p.tired, invuln: p.invuln > 0, buffs,
    };
  }

  // ---------- 受信 ----------
  const on = (type, fn) => offs.push(net.onMessage(type, fn));

  on('ps', (s, from) => {
    let p = game.players.find((o) => o.id === from);
    if (!p) {
      // 途中参加の人：分身を作る
      p = createPlayer(game, game.players.length, { job: s.job, remote: true, id: from, name: s.name });
      p.net = { ...s };
      p.reset(s.x, s.z, s.yaw);
      game.players.push(p);
      handlers.onRosterChange?.();
    }
    p.net = s;
  });
  on('hurt', (d) => {
    const me = game.me();
    if (me) handlers.hurtLocal(me, d.frac, d.fx, d.fz);
  });
  on('dmg', (d) => {
    if (!net.isHost) return;
    withMirror(() => {
      if (d.kind === 'boss') game.boss?.applyDamage(d.dmg, d.brk);
      else game.enemies.applyDamage(d.id, d.dmg);
    });
  });
  on('skill', (d, from) => {
    const p = game.players.find((o) => o.id === from);
    if (p) playRemoteSkill(game, p, d.id, d.d);
  });
  on('team', (eff) => handlers.applyTeamEffect(eff));
  on('cmd', (cmd) => {
    if (net.isHost) withMirror(() => handlers.handleCommand(cmd));
  });
  on('ws', (ws) => {
    if (net.isHost) return;
    handlers.applyWorld(ws);
    for (const ev of ws.ev) replay(ev);
  });
  on('restart', (d) => handlers.onRestart(d));
  on('clear', (d) => handlers.onClear(d));
  on('start', (d) => handlers.onStart?.(d));

  offs.push(net.onPlayerLeave(({ id }) => {
    const i = game.players.findIndex((o) => o.id === id);
    if (i >= 0) {
      const p = game.players[i];
      game.scene.remove(p.model.group);
      game.players.splice(i, 1);
      game.localIndex = game.players.findIndex((o) => !o.remote);
      game.toast(`${p.name || 'だれか'}が抜けた`, 2000);
      handlers.onRosterChange?.();
    }
  }));
  offs.push(net.onPlayerJoin(({ id, name }) => {
    if (net.isHost && game.playing) handlers.onLateJoin?.(id, name);
  }));
  offs.push(net.onHostChange(({ isHost }) => {
    if (isHost) {
      mirror();
      game.toast('ホストが抜けたので、あなたがホストを引き継いだ（部屋の前からやり直し）', 3200);
      handlers.onBecomeHost();
    }
  }));
  offs.push(net.onDisconnect(() => handlers.onDisconnect()));

  // ---------- 演出のミラー（ホスト） ----------
  const orig = {};
  function withMirror(fn) {
    const prev = game.mirroring;
    game.mirroring = true;
    try {
      fn();
    } finally {
      game.mirroring = prev;
    }
  }
  game.withMirror = withMirror;

  function mirror() {
    if (orig.telegraph) return;
    const fx = game.fx;
    orig.telegraph = fx.telegraph;
    orig.burst = fx.burst;
    orig.shake = fx.shake;
    orig.text = fx.text;
    orig.se = game.sound.se;
    orig.bgm = game.sound.bgm;
    orig.toast = game.toast;
    orig.enemyShot = game.projectiles.enemyShot;
    orig.banner = game.hudView.banner;
    const rec = (...ev) => { if (game.mirroring && events.length < MAX_EVENTS) events.push(ev); };
    fx.telegraph = (kind, a) => {
      const h = orig.telegraph(kind, a);
      if (!game.mirroring) return h;
      const id = teleId++;
      rec('tele', id, kind, { x: +a.x.toFixed(2), z: +a.z.toFixed(2), r: a.r, arc: a.arc, len: a.len, width: a.width, angle: a.angle, dur: a.dur });
      return {
        follow(x, z, ang) {
          h.follow(x, z, ang);
          if (events.length < MAX_EVENTS) events.push(['tf', id, +x.toFixed(2), +z.toFixed(2), ang]);
        },
        end() {
          h.end();
          events.push(['te', id]);
        },
      };
    };
    fx.burst = (x, y, z, color, n, o) => {
      orig.burst(x, y, z, color, n, o);
      if (game.mirroring && burstCount < 60) {
        burstCount++;
        rec('b', +x.toFixed(1), +y.toFixed(1), +z.toFixed(1), color, n, o);
      }
    };
    fx.shake = (a) => { orig.shake(a); rec('sk', a); };
    fx.text = (...a) => { orig.text(...a); };
    game.sound.se = (n) => { orig.se(n); rec('se', n); };
    game.sound.bgm = (n) => { orig.bgm(n); rec('bgm', n); };
    game.toast = (m, ms) => { orig.toast(m, ms); rec('toast', m, ms); };
    game.projectiles.enemyShot = (x, z, yaw, speed, frac, color) => {
      orig.enemyShot(x, z, yaw, speed, frac, color);
      if (game.mirroring) events.push(['shot', +x.toFixed(2), +z.toFixed(2), +yaw.toFixed(3), speed, frac, color]);
    };
    game.hudView.banner = (t) => { orig.banner(t); rec('banner', t); };
  }
  function unmirror() {
    if (!orig.telegraph) return;
    game.fx.telegraph = orig.telegraph;
    game.fx.burst = orig.burst;
    game.fx.shake = orig.shake;
    game.fx.text = orig.text;
    game.sound.se = orig.se;
    game.sound.bgm = orig.bgm;
    game.toast = orig.toast;
    game.projectiles.enemyShot = orig.enemyShot;
    game.hudView.banner = orig.banner;
    for (const k of Object.keys(orig)) delete orig[k];
  }
  if (net.isHost) mirror();

  // ---------- 演出の再生（参加者） ----------
  function replay(ev) {
    const [type, ...a] = ev;
    switch (type) {
      case 'tele': {
        const [id, kind, o] = a;
        teles.set(id, game.fx.telegraph(kind, o));
        break;
      }
      case 'tf': teles.get(a[0])?.follow(a[1], a[2], a[3]); break;
      case 'te':
        teles.get(a[0])?.end();
        teles.delete(a[0]);
        break;
      case 'b': game.fx.burst(a[0], a[1], a[2], a[3], a[4], a[5]); break;
      case 'sk': game.fx.shake(a[0]); break;
      case 'se': game.sound.se(a[0]); break;
      case 'bgm': game.sound.bgm(a[0]); break;
      case 'toast': game.toast(a[0], a[1]); break;
      case 'banner': game.hudView.banner(a[0]); break;
      case 'shot': game.projectiles.enemyShot(a[0], a[1], a[2], a[3], a[4], a[5]); break;
      case 'bfx': game.boss?.playFx(a[0], a[1]); break;
      default: handlers.onEvent(type, a);
    }
  }

  return raid;
}
