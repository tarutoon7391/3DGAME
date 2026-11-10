// テニスのショット：プレイヤー操作（移動・ショット・サーブ）と CPU の思考
import * as THREE from 'three';
import { COURT, solveShot, predict } from './physics.js';
import { gauss, clamp, rand } from '../core/difficulty.js';

const REACH = 1.75; // ラケットが届く水平距離
const tmpV = new THREE.Vector3();
const racketPt = new THREE.Vector3();

/** 打点（体の利き手側・少し前） */
function racketPoint(pl, out) {
  const f = pl.side === 'me' ? -1 : 1; // 前方向 z
  return out.set(pl.pos.x - f * 0.5, 0, pl.pos.z + f * 0.25);
}

/**
 * pl がいま打てるか。打てるなら打点との距離を返す（打てなければ -1）
 */
export function hitDistance(m, pl) {
  const b = m.ball;
  if (m.phase !== 'rally') return -1;
  if (m.lastHitter === pl.side) return -1;
  if (m.isServe && m.bounces === 0) return -1; // サーブはノーバウンドで返せない
  if (b.netHit) return -1;
  const onMySide = pl.side === 'me' ? b.p.z > 0 : b.p.z < 0;
  if (!onMySide || b.p.y > 2.6) return -1;
  racketPoint(pl, racketPt);
  const d = Math.hypot(b.p.x - racketPt.x, b.p.z - racketPt.z);
  return d < REACH ? d : -1;
}

/** 入力をデータ（コマンド）に変換する。状態更新はコマンドだけを見る（オンライン化に備えて分離） */
export function readTennisInput(input) {
  return {
    mx: (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0),
    mz: (input.isDown('KeyS') ? 1 : 0) - (input.isDown('KeyW') ? 1 : 0),
    shot: input.wasPressed('Space'),
    lob: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
    dir: (input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('ArrowLeft') ? 1 : 0),
  };
}

export function createPlayerControl(m) {
  let swingWindow = 0;
  return {
    /** cmd は readTennisInput の戻り値 */
    update(dt, cmd) {
      const me = m.me;
      // 移動（自陣のみ）
      if (m.phase === 'rally' || (m.phase === 'serve' && m.server === 'cpu')) {
        const { mx, mz } = cmd;
        const len = Math.hypot(mx, mz) || 1;
        const sp = 7.2;
        me.pos.x = clamp(me.pos.x + (mx / len) * sp * dt, -COURT.HALF_W - 3.5, COURT.HALF_W + 3.5);
        me.pos.z = clamp(me.pos.z + (mz / len) * sp * dt, 1.0, COURT.HALF_L + 4);
        me.moving = mx !== 0 || mz !== 0;
      } else {
        me.moving = false;
      }

      // 自分のサーブ
      if (m.phase === 'serve' && m.server === 'me') {
        if (m.serveStage === 'hold' && cmd.shot) m.toss();
        else if (m.serveStage === 'toss' && cmd.shot && m.ball.p.y > 1.5) {
          const q = clamp(1 - Math.abs(m.ball.v.y) / 5, 0, 1);
          const aim = cmd.dir * 1.4;
          const tx = clamp(m.boxSign * 2.7 + aim + gauss() * (1 - q) * 1.1, -6, 6);
          const tz = -(COURT.SERVICE_L - 1.1) + gauss() * (1 - q) * 1.0;
          solveShot(m.ball.p, tx, tz, 0.7 + (1 - q) * 0.3, tmpV, true, 0.12);
          me.swing = 1;
          m.hit('me', tmpV, q);
        }
        return;
      }

      // ショット（Space を押したら短い時間だけ振る構えになり、その間に届けば打つ）
      if (cmd.shot) {
        swingWindow = 0.2;
        if (hitDistance(m, me) < 0) me.swing = Math.max(me.swing, 0.01); // 空振りモーション
      }
      if (swingWindow > 0) {
        swingWindow -= dt;
        const d = hitDistance(m, me);
        if (d >= 0) {
          swingWindow = 0;
          playerShot(m, cmd, d);
        }
      }
    },
  };
}

function playerShot(m, cmd, d) {
  const me = m.me;
  const b = m.ball;
  // タイミング：打点に近いほど強く正確。高さも 0.6〜1.4m が打ちごろ
  const hPen = b.p.y < 0.5 ? (0.5 - b.p.y) * 0.8 : b.p.y > 1.5 ? (b.p.y - 1.5) * 0.4 : 0;
  const q = clamp(1 - d / REACH - hPen, 0, 1);
  const { lob, dir } = cmd;
  let tx = dir !== 0 ? dir * rand(3.0, 4.4) : clamp(-me.pos.x * 0.3 + rand(-1.2, 1.2), -3, 3);
  let tz = -(lob ? 9.8 : 6.8 + 3.6 * q);
  let T = lob ? 2.1 : 1.15 - 0.4 * q;
  // 打ち損じほどブレる
  const err = (1 - q) * 1.5 + (q < 0.15 ? 1.6 : 0);
  tx += gauss() * err;
  tz += gauss() * err * 0.8;
  const clearNet = !(q < 0.12 && Math.random() < 0.4);
  solveShot(b.p, tx, tz, T, tmpV, clearNet, lob ? 1.5 : 0.25);
  me.swing = 1;
  m.lastQuality = q;
  m.hit('me', tmpV, 0.4 + q * 0.6);
}

/** CPU の思考：落下点を予測して移動し、届けば打ち返す */
export function createCpu(m, diff) {
  const pred = {};
  const target = new THREE.Vector3(0, 0, -COURT.HALF_L - 0.6);
  let react = 0;
  let planned = false;
  let leave = false;
  let serveWait = 0;

  function inMyCourt(x, z) {
    return Math.abs(x) <= COURT.HALF_W && z <= 0 && z >= -COURT.HALF_L;
  }

  function cpuShot() {
    const b = m.ball;
    const me = m.me;
    let tx;
    let tz;
    let T = rand(1.0, 1.3) / diff.tennisPace;
    let clearNet = true;
    let margin = 0.3;
    if (Math.random() < diff.tennisError) {
      // ミス：アウトかネット
      if (Math.random() < 0.55) {
        tx = Math.random() < 0.5 ? rand(-4, 4) : (Math.random() < 0.5 ? -1 : 1) * rand(5.9, 7);
        tz = Math.abs(tx) > 5.5 ? rand(5, 10) : rand(12.3, 14);
      } else {
        tx = rand(-3, 3);
        tz = 1.2;
        T = 0.35;
        clearNet = false;
      }
    } else {
      // プレイヤーのいない側を狙う（強いほど正確）
      const away = -Math.sign(me.pos.x || (Math.random() - 0.5));
      tx = Math.random() < 0.65 ? away * rand(1.8, 4.6) : rand(-4.4, 4.4);
      tx = clamp(tx + gauss() * diff.tennisAim * 0.6, -5.1, 5.1);
      tz = clamp(rand(6.5, 10.8) + gauss() * diff.tennisAim * 0.4, 3.5, 11.3);
      if (Math.random() < 0.1) {
        T = 2.0;
        tz = rand(9.5, 11);
        margin = 1.5;
      }
    }
    solveShot(b.p, tx, tz, T, tmpV, clearNet, margin);
    m.cpu.swing = 1;
    m.hit('cpu', tmpV, 0.7);
  }

  return {
    /** プレイヤーが打った直後に呼ぶ */
    onPlayerHit() {
      react = diff.tennisReact;
      planned = false;
      leave = false;
    },
    /** サーブ待ち時間をセット */
    onServeSetup() {
      serveWait = rand(0.9, 1.4);
    },
    update(dt) {
      const cpu = m.cpu;
      const b = m.ball;
      if (m.phase === 'serve') {
        if (m.server === 'cpu') {
          if (m.serveStage === 'hold') {
            serveWait -= dt;
            if (serveWait <= 0) m.toss();
          } else if (m.serveStage === 'toss' && b.v.y <= 0 && b.p.y > 1.5) {
            // CPU のサーブ
            const fault = Math.random() < diff.tennisError * 1.2;
            const tx = m.boxSign * rand(0.7, 4.4);
            const tz = fault ? COURT.SERVICE_L + rand(0.4, 1.4) : rand(4.2, 5.9);
            solveShot(b.p, tx, tz, 0.8 / diff.tennisPace, tmpV, true, 0.15);
            cpu.swing = 1;
            m.hit('cpu', tmpV, 0.8);
          }
        } else {
          target.set(m.boxSign * 2.6, 0, -COURT.HALF_L - 0.5);
        }
      } else if (m.phase === 'rally') {
        if (m.lastHitter === 'me') {
          if (react > 0) react -= dt;
          else if (!planned) {
            planned = true;
            predict(b, pred, 1.0);
            // アウトになる球は見送る（つよいほど見極めが正確）
            leave = pred.bounce && !inMyCourt(pred.bx, pred.bz) && Math.random() > diff.tennisError;
            target.set(pred.hx + 0.5, 0, clamp(pred.hz - 0.4, -COURT.HALF_L - 4, -1.2));
          }
        } else {
          // 打った後はセンターへ戻る
          target.set(clamp(b.p.x * 0.3, -2, 2), 0, -COURT.HALF_L - 0.3);
        }
      }
      // 移動
      if (m.phase !== 'pointEnd' && !(m.phase === 'serve' && m.server === 'cpu')) {
        tmpV.set(target.x - cpu.pos.x, 0, target.z - cpu.pos.z);
        const dist = tmpV.length();
        const step = diff.tennisSpeed * dt;
        if (dist > 0.05) cpu.pos.addScaledVector(tmpV, Math.min(1, step / dist));
        cpu.moving = dist > 0.1;
      } else cpu.moving = false;
      // 打つ（バウンド後のみ）
      if (m.phase === 'rally' && m.lastHitter === 'me' && m.bounces === 1 && !leave && hitDistance(m, cpu) >= 0) {
        cpuShot();
      }
    },
  };
}
