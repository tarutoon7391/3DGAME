// テニス：ルール進行（サーブ・判定・得点）と描画の同期
// 決めたこと：4ポイント先取で1ゲーム（デュースなし）、3ゲーム先取で勝ち。ゲームごとにサーブ交代
import * as THREE from 'three';
import { hud } from '/shared/ui.js';
import { setBoard, callout } from '../core/scoreboard.js';
import { setSky, disposeTree } from '../core/env.js';
import { COURT, makeBallState, stepBall, predict } from './physics.js';
import { buildCourt, buildPlayer, buildBall } from './court.js';
import { createPlayerControl, createCpu, readTennisInput } from './shots.js';

const CALL = ['0', '15', '30', '40', 'G'];
const NAMES = { me: 'あなた', cpu: 'CPU' };

export function createTennis(ctx) {
  const { scene, input, sound, director, fx, diff } = ctx;
  const group = new THREE.Group();
  scene.add(group);
  setSky(scene, 0x9fd3ff, 40, 140);
  const { crowd } = buildCourt(group);
  const meFig = buildPlayer(group, 0x2f81f7, 0xffffff);
  const cpuFig = buildPlayer(group, 0xe5383b, 0x222222);
  const ballV = buildBall(group);
  const pred = {};

  const m = {
    ball: makeBallState(),
    me: { side: 'me', pos: new THREE.Vector3(), swing: 0, moving: false },
    cpu: { side: 'cpu', pos: new THREE.Vector3(), swing: 0, moving: false },
    phase: 'serve', // serve | rally | pointEnd | over
    server: 'me',
    serveStage: 'hold', // hold | toss
    serveTry: 1,
    boxSign: -1,
    isServe: false,
    lastHitter: null,
    bounces: 0,
    points: { me: 0, cpu: 0 },
    games: { me: 0, cpu: 0 },
    timer: 0,
    pending: null, // ポイント終了後に実行する処理
    lastQuality: -1,
    toss,
    hit,
  };
  const player = createPlayerControl(m);
  const cpu = createCpu(m, diff);
  const other = (s) => (s === 'me' ? 'cpu' : 'me');

  function setupServe(keepTry = false) {
    if (!keepTry) m.serveTry = 1;
    m.phase = 'serve';
    m.serveStage = 'hold';
    m.isServe = false;
    m.lastHitter = null;
    m.bounces = 0;
    ballV.marker.visible = false;
    const n = m.points.me + m.points.cpu;
    const s = n % 2 === 0 ? 1 : -1; // デュースサイド／アドサイド
    const sx = (m.server === 'me' ? s : -s) * 1.2;
    m.boxSign = -Math.sign(sx);
    if (m.server === 'me') {
      m.me.pos.set(sx, 0, COURT.HALF_L + 0.4);
      m.cpu.pos.set(m.boxSign * 2.6, 0, -COURT.HALF_L - 0.5);
    } else {
      m.cpu.pos.set(sx, 0, -COURT.HALF_L - 0.4);
      m.me.pos.set(m.boxSign * 2.6, 0, COURT.HALF_L + 0.5);
    }
    holdBall();
    cpu.onServeSetup();
    const who = m.server === 'me' ? 'あなたのサーブ：Space でトス → もう一度 Space で打つ' : 'CPU のサーブ';
    m.serveMsg = m.serveTry === 2 ? `セカンドサーブ（${who}）` : who;
    director.set(camPos(), camLook(), { snap: true });
  }

  function holdBall() {
    const sv = m[m.server];
    const f = m.server === 'me' ? -1 : 1;
    m.ball.p.set(sv.pos.x + f * 0.35, 1.2, sv.pos.z + f * 0.3);
    m.ball.v.set(0, 0, 0);
    m.ball.netHit = false;
    m.ball.rolling = false;
  }

  function toss() {
    m.serveStage = 'toss';
    m.ball.v.set(0, 5.2, 0);
    sound.whoosh();
  }

  /** who が打った（vel は初速） */
  function hit(who, vel, power) {
    const b = m.ball;
    m.isServe = m.phase === 'serve';
    m.phase = 'rally';
    b.v.copy(vel);
    b.netHit = false;
    b.rolling = false;
    m.lastHitter = who;
    m.bounces = 0;
    sound.hit(power);
    fx.burst(b.p, { count: 6, color: 0xffffff, speed: 1.5, up: 1, size: 0.04, life: 0.3 });
    if (who === 'me') {
      cpu.onPlayerHit();
      ballV.marker.visible = false;
    } else {
      // 着地予測マーカー（相手の打球だけ表示）
      predict(b, pred, 1.0);
      if (pred.bounce && !pred.net) {
        ballV.marker.position.set(pred.bx, 0.02, pred.bz);
        ballV.marker.visible = true;
      }
    }
  }

  function endPoint(winner, reason) {
    if (m.phase === 'pointEnd' || m.phase === 'over') return;
    m.phase = 'pointEnd';
    m.timer = 1.7;
    ballV.marker.visible = false;
    const good = winner === 'me';
    callout(reason, { color: good ? '#7cc4ff' : '#ff8a80', sub: `${NAMES[winner]} のポイント`, ms: 1400 });
    if (good) {
      sound.good();
      crowd.cheer(0.8);
      sound.cheer(0.6);
    } else sound.bad();
    m.pending = () => awardPoint(winner);
  }

  function fault() {
    if (m.serveTry === 1) {
      m.phase = 'pointEnd';
      m.timer = 1.0;
      callout('フォルト', { color: '#ffd166', ms: 900 });
      sound.whistle();
      m.pending = () => {
        m.serveTry = 2;
        setupServe(true);
      };
    } else {
      endPoint(other(m.server), 'ダブルフォルト');
    }
  }

  function awardPoint(winner) {
    m.points[winner] += 1;
    if (m.points[winner] >= 4) {
      m.games[winner] += 1;
      m.points.me = 0;
      m.points.cpu = 0;
      if (m.games[winner] >= 3) {
        m.phase = 'over';
        m.timer = 2.2;
        const won = winner === 'me';
        callout(won ? 'ゲームセット！' : 'ゲームセット', { color: won ? '#ffd166' : '#ff8a80', sub: `${m.games.me} - ${m.games.cpu}`, ms: 2000 });
        crowd.cheer(won ? 2 : 0.6);
        return;
      }
      callout(`ゲーム ${NAMES[winner]}`, { color: '#ffffff', sub: `${m.games.me} - ${m.games.cpu}`, ms: 1300 });
      m.server = other(m.server);
    }
    setupServe();
  }

  /** ボールの着地・ネットの判定 */
  function judge(ev) {
    const b = m.ball;
    if (m.phase !== 'rally') return;
    const hitter = m.lastHitter;
    const recv = other(hitter);
    if (ev === 'net') {
      sound.bounce();
      if (m.isServe) fault();
      else endPoint(recv, 'ネット');
      return;
    }
    if (ev !== 'bounce') return;
    sound.bounce();
    fx.burst(b.p, { count: 5, color: 0xd0e4ff, speed: 0.8, up: 0.6, size: 0.04, life: 0.35 });
    ballV.marker.visible = false;
    const side = b.p.z > 0 ? 'me' : 'cpu';
    if (m.bounces === 0) {
      if (m.isServe) {
        const inBox = side === recv && Math.abs(b.p.z) <= COURT.SERVICE_L + 0.03 && Math.sign(b.p.x) === m.boxSign && Math.abs(b.p.x) <= COURT.HALF_W + 0.03;
        if (!inBox) {
          fault();
          return;
        }
      } else {
        const inCourt = side === recv && Math.abs(b.p.x) <= COURT.HALF_W + 0.03 && Math.abs(b.p.z) <= COURT.HALF_L + 0.03;
        if (!inCourt) {
          endPoint(recv, 'アウト');
          return;
        }
      }
      m.bounces = 1;
      m.isServe = false; // 有効なサーブ後は通常のラリー
    } else {
      // ツーバウンド：受け手の失点
      endPoint(hitter, hitter === 'me' ? 'ナイスショット！' : 'ツーバウンド');
    }
  }

  function camPos() {
    const me = m.me.pos;
    return [me.x * 0.7, 3.3, me.z + 6.3];
  }
  function camLook() {
    const me = m.me.pos;
    return [me.x * 0.35, 0.6, me.z - 9];
  }

  function syncFigure(pl, f, dt, time, faceSign) {
    f.root.position.copy(pl.pos);
    f.root.rotation.y = faceSign;
    f.shadow.position.set(pl.pos.x, 0.015, pl.pos.z);
    // 走りの上下動
    f.body.position.y = 1.1 + (pl.moving ? Math.abs(Math.sin(time * 14)) * 0.05 : 0);
    // スイング：腕を横から前へ振る
    if (pl.swing > 0) pl.swing = Math.max(0, pl.swing - dt * 4);
    const s = pl.swing > 0 ? 1 - pl.swing : 0;
    f.armR.rotation.set(-0.9 - Math.sin(s * Math.PI) * 0.5, 0, 1.5 - s * 2.4);
    f.armL.rotation.set(0, 0, -0.2);
  }

  function updateBoard() {
    const srv = (s) => (m.server === s ? '●' : '');
    setBoard(
      `<table><tr><th></th><th>ゲーム</th><th>ポイント</th></tr>` +
        `<tr class="me"><td>${srv('me')} あなた</td><td>${m.games.me}</td><td>${CALL[m.points.me]}</td></tr>` +
        `<tr class="cpu"><td>${srv('cpu')} CPU</td><td>${m.games.cpu}</td><td>${CALL[m.points.cpu]}</td></tr></table>`,
    );
    const q = m.lastQuality >= 0 ? `直前のショット：${Math.round(m.lastQuality * 100)}%` : '';
    hud(
      `<b>テニス</b>（${diff.label}）<br>WASD 移動／Space ショット／←→ 打ち分け／Shift ロブ<br>` +
        (m.phase === 'serve' ? m.serveMsg : q),
    );
  }

  setupServe();

  return {
    state: m,
    update(dt, time) {
      player.update(dt, readTennisInput(input));
      cpu.update(dt);
      // ボール
      const b = m.ball;
      if (m.phase === 'serve') {
        if (m.serveStage === 'hold') holdBall();
        else {
          stepBall(b, dt);
          if (b.p.y < 0.9 && b.v.y < 0) {
            // トスを打たずに落とした：やり直し
            m.serveStage = 'hold';
            holdBall();
            cpu.onServeSetup();
          }
        }
      } else if (m.phase === 'rally') {
        // 速い球のすり抜け防止に分割して進める
        const n = 3;
        for (let i = 0; i < n && m.phase === 'rally'; i++) judge(stepBall(b, dt / n));
        if (m.phase === 'rally' && m.bounces === 1 && (Math.abs(b.p.z) > COURT.HALF_L + 9 || Math.abs(b.p.x) > COURT.HALF_W + 8)) {
          endPoint(m.lastHitter, m.lastHitter === 'me' ? 'ナイスショット！' : '返せなかった');
        }
        if (m.phase === 'rally' && b.rolling && b.v.lengthSq() < 0.5) {
          endPoint(m.lastHitter, '返せなかった');
        }
      } else {
        stepBall(b, dt);
        m.timer -= dt;
        if (m.timer <= 0) {
          if (m.phase === 'over') {
            m.phase = 'done';
            const won = m.games.me > m.games.cpu;
            ctx.finish({
              outcome: won ? 'win' : 'lose',
              title: won ? 'あなたの勝ち！' : 'CPU の勝ち…',
              lines: [`ゲームカウント ${m.games.me} - ${m.games.cpu}（${diff.label}）`],
              best: won ? m.games.me - m.games.cpu : undefined, // ベスト（最大ゲーム差）は勝ったときだけ
              bestText: `${m.games.me}-${m.games.cpu}`,
            });
          } else if (m.pending) {
            const p = m.pending;
            m.pending = null;
            p();
          }
        }
      }

      ballV.ball.position.copy(b.p);
      ballV.ball.rotation.x += dt * 20;
      ballV.shadow.position.set(b.p.x, 0.016, b.p.z);
      ballV.marker.scale.setScalar(1 + Math.sin(time * 10) * 0.08);
      syncFigure(m.me, meFig, dt, time, 0);
      syncFigure(m.cpu, cpuFig, dt, time, Math.PI);
      crowd.update(dt, time);
      director.set(camPos(), camLook(), { speed: 5 });
      updateBoard();
    },
    idle(dt, time) {
      crowd.update(dt, time);
    },
    dispose() {
      disposeTree(group);
    },
  };
}
