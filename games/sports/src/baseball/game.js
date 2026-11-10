// 野球：打撃と投球の対決（3イニング制、表＝あなたの攻撃、裏＝CPU の攻撃）
// 決めたこと：1イニング5点でチェンジ（時間短縮）。3回終了で同点なら引き分け。三塁打は無し（長打はツーベース）
import * as THREE from 'three';
import { hud } from '/shared/ui.js';
import { setBoard, callout } from '../core/scoreboard.js';
import { setSky, disposeTree } from '../core/env.js';
import { CONFETTI } from '../core/fx.js';
import { buildField, buildPlayers, paintTeams } from './field.js';
import { PITCHES, makePitch, pitchPos, cpuChoosePitch, createReader, cpuBat } from './pitch.js';
import { judgeBatted, makeBatted, stepBatted, advance } from './outcome.js';
import { createPitchPanel } from './pitchui.js';
import { createBaseballView } from './view.js';

const INNINGS = 3;
const RUN_CAP = 5;
const SWING_HIT = 0.1; // クリックからバットが本塁上に来るまでの秒数

export function createBaseball(ctx) {
  const { scene, camera, renderer, input, sound, director, fx, diff } = ctx;
  const group = new THREE.Group();
  scene.add(group);
  setSky(scene, 0x87c5f5, 120, 400);
  const field = buildField(group);
  const pl = buildPlayers(group);
  const panel = createPitchPanel();
  const view = createBaseballView({ field, pl, director });
  const reader = createReader();

  // ゲームの状態（JSON 化できる値だけ）。players[local] が自分
  const st = {
    players: [
      { id: 'me', name: 'あなた', cpu: false, color: 0x2f81f7 },
      { id: 'cpu', name: 'CPU', cpu: true, color: 0xe5383b },
    ],
    local: 0,
    inning: 1,
    top: true,
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [false, false, false],
    score: [0, 0],
    line: [[], []],
    halfRuns: 0,
    phase: 'change', // change | ready | windup | pitch | batted | after | over | done
    timer: 2,
    clock: 0,
    pitchType: 0,
    pitch: null,
    pu: 0, // 投球の進み（0〜1.1）
    crossed: false,
    swingAt: -1, // 打者がスイングを始めた時刻
    aim: { x: 0, y: 0.8 },
    cpuSwing: null,
    batted: null,
    result: null,
  };
  const batIdx = () => (st.top ? 0 : 1); // 表は players[0]、裏は players[1] が攻撃
  const userBatting = () => !st.players[batIdx()].cpu;
  const ballPos = new THREE.Vector3();

  // マウス → ストライクゾーン平面（z=0）への投影
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hitPt = new THREE.Vector3();

  /** 入力をコマンドに変換（状態は触らない） */
  function readInput() {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((input.mouse.x - r.left) / r.width) * 2 - 1, -((input.mouse.y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const ok = ray.ray.intersectPlane(plane, hitPt);
    let type = -1;
    if (input.wasPressed('Digit1')) type = 0;
    if (input.wasPressed('Digit2')) type = 1;
    if (input.wasPressed('Digit3')) type = 2;
    const cmds = panel.drain();
    if (type >= 0) cmds.push({ kind: 'type', type });
    return {
      aimX: ok ? hitPt.x : null,
      aimY: ok ? hitPt.y : null,
      swing: input.wasPressed('Mouse0'),
      cmds,
    };
  }

  function startHalf() {
    st.outs = 0;
    st.balls = 0;
    st.strikes = 0;
    st.bases = [false, false, false];
    st.halfRuns = 0;
    st.line[batIdx()][st.inning - 1] = 0;
    const bat = st.players[batIdx()];
    const fld = st.players[1 - batIdx()];
    paintTeams(pl, fld.color, bat.color);
    callout(`${st.inning}回${st.top ? '表' : '裏'}`, { color: '#ffffff', sub: userBatting() ? 'あなたの攻撃' : 'あなたの守備', ms: 1600 });
    sound.whistle();
    st.phase = 'ready';
    st.timer = 1.6;
    view.setMode(userBatting() ? 'bat' : 'pitch', true);
    panel.show(!userBatting());
    panel.setType(st.pitchType);
  }

  function release(pt) {
    st.pitch = pt;
    st.pu = 0;
    st.crossed = false;
    st.swingAt = -1;
    st.phase = 'windup';
    st.timer = 0.55;
    st.cpuSwing = null;
    if (!userBatting()) {
      // CPU 打者：読み（配球の傾向）から判断
      st.cpuSwing = cpuBat(pt, diff, reader.guess(), st.strikes);
      reader.learn(pt);
    }
    panel.show(false);
  }

  function addRuns(n) {
    if (n <= 0) return;
    const i = batIdx();
    st.score[i] += n;
    st.line[i][st.inning - 1] += n;
    st.halfRuns += n;
  }

  /** 1球の結果を反映して次へ */
  function settle(label, color, sub = '') {
    callout(label, { color, sub, ms: 1300 });
    st.phase = 'after';
    st.timer = 1.5;
  }

  function call(kind) {
    if (kind === 'strike' || kind === 'swing') {
      st.strikes++;
      if (st.strikes >= 3) {
        st.outs++;
        resetCount();
        settle('三振！', userBatting() ? '#ff8a80' : '#7cc4ff');
        (userBatting() ? sound.bad : sound.good)();
        return;
      }
      settle(kind === 'swing' ? '空振り' : 'ストライク', '#ffd166');
    } else {
      st.balls++;
      if (st.balls >= 4) {
        resetCount();
        addRuns(advance(st.bases, 1, true));
        settle('フォアボール', '#9fb1c2');
        return;
      }
      settle('ボール', '#9fb1c2');
    }
    sound.mitt();
  }

  function resetCount() {
    st.balls = 0;
    st.strikes = 0;
  }

  /** 打った */
  function contact(v, angle, spray) {
    sound.bat(Math.min(1, v / 46));
    const r = judgeBatted(v, angle, spray);
    st.result = r;
    st.batted = makeBatted(v, angle, spray);
    st.phase = 'batted';
    st.timer = r.foul ? 1.3 : Math.min(4.5, Math.max(1.8, r.hang + 0.5));
    view.startBatted(r);
    if (r.kind === 'hr' || r.kind === 'double') director.shake(0.15);
  }

  function applyResult() {
    const r = st.result;
    const good = userBatting();
    if (r.foul) {
      if (st.strikes < 2) st.strikes++;
      settle('ファウル', '#ffd166');
      return;
    }
    resetCount();
    if (r.out) {
      st.outs++;
      let sub = '';
      if (r.sacFly && st.outs < 3 && st.bases[2]) {
        st.bases[2] = false;
        addRuns(1);
        sub = '犠牲フライで1点';
      }
      settle(r.label, good ? '#ff8a80' : '#7cc4ff', sub);
      (good ? sound.bad : sound.good)();
      return;
    }
    const runs = advance(st.bases, r.bases);
    addRuns(runs);
    settle(r.label, good ? '#ffd166' : '#ff8a80', runs > 0 ? `${runs}点入った！` : '');
    if (good) {
      sound.cheer(r.kind === 'hr' ? 1.5 : 0.8);
      field.cheer(r.kind === 'hr' ? 3 : 1);
      if (r.kind === 'hr') {
        sound.fanfare();
        fx.burst({ x: r.catchAt.x, y: 8, z: r.catchAt.z }, { count: 120, color: CONFETTI, speed: 6, up: 6, size: 0.4, life: 2.5, gravity: 4 });
      }
    } else sound.bad();
  }

  /** 1球が終わったあとの進行：チェンジ・試合終了の判定 */
  function next() {
    const cpuIdx = 1;
    // サヨナラ（最終回裏に CPU が勝ち越し）
    if (!st.top && st.inning >= INNINGS && st.score[cpuIdx] > st.score[0]) return gameOver('サヨナラ！');
    if (st.outs >= 3 || st.halfRuns >= RUN_CAP) {
      const reason = st.outs >= 3 ? 'スリーアウト チェンジ' : `${RUN_CAP}点でチェンジ`;
      if (st.top) {
        st.top = false;
        // 最終回表終了時に CPU がリードしていれば裏は無し
        if (st.inning >= INNINGS && st.score[cpuIdx] > st.score[0]) return gameOver('ゲームセット');
      } else {
        st.top = true;
        st.inning++;
        if (st.inning > INNINGS) {
          st.inning = INNINGS;
          return gameOver('ゲームセット');
        }
      }
      callout(reason, { color: '#ffffff', ms: 1400 });
      st.phase = 'change';
      st.timer = 1.6;
      panel.show(false);
      return;
    }
    st.phase = 'ready';
    st.timer = 0.9;
    view.setMode(userBatting() ? 'bat' : 'pitch');
    if (!userBatting()) panel.show(true);
  }

  function gameOver(label) {
    st.phase = 'over';
    st.timer = 2.4;
    panel.show(false);
    const [me, cpu] = st.score;
    callout(label, { color: me > cpu ? '#ffd166' : '#ffffff', sub: `${me} - ${cpu}`, ms: 2200 });
    field.cheer(me > cpu ? 3 : 1);
  }

  function board() {
    const cell = (i, n) => {
      const v = st.line[i][n];
      return v === undefined ? '<td class="dim">-</td>' : `<td>${v}</td>`;
    };
    const row = (i, cls) =>
      `<tr class="${cls}"><td>${st.players[i].name}</td>${[0, 1, 2].map((n) => cell(i, n)).join('')}<td><b>${st.score[i]}</b></td></tr>`;
    const dots = (n, max, col) => Array.from({ length: max }, (_, k) => (k < n ? `<span style="color:${col}">●</span>` : '<span class="dim">○</span>')).join('');
    const b = st.bases;
    const base = (on) => (on ? '<span style="color:#ffd166">◆</span>' : '<span class="dim">◇</span>');
    setBoard(
      `<table><tr><th></th><th>1</th><th>2</th><th>3</th><th>計</th></tr>${row(0, 'me')}${row(1, 'cpu')}</table>` +
        `B ${dots(st.balls, 3, '#3fb950')} S ${dots(st.strikes, 2, '#ffd166')} O ${dots(st.outs, 2, '#ff6b6b')}` +
        `　塁 ${base(b[2])}${base(b[1])}${base(b[0])}<span class="dim">（三二一）</span>`,
    );
    hud(
      `<b>野球</b>（${diff.label}）　${st.inning}回${st.top ? '表' : '裏'}<br>` +
        (userBatting()
          ? 'マウス：バット位置（黄色の輪）<br>クリック：スイング（早いと引っ張り・遅いと流し）'
          : `球種：<b>${PITCHES[st.pitchType].label}</b>（1/2/3）<br>右下のマスをクリックで投球`),
    );
  }

  function update(dt, cmd) {
    st.clock += dt;
    if (cmd.aimX !== null) {
      st.aim.x = Math.max(-0.6, Math.min(0.6, cmd.aimX));
      st.aim.y = Math.max(0.25, Math.min(1.45, cmd.aimY));
    }
    for (const c of cmd.cmds) {
      if (c.kind === 'type') {
        st.pitchType = c.type;
        panel.setType(c.type);
        sound.click();
      } else if (c.kind === 'pitch' && st.phase === 'ready' && !userBatting()) {
        release(makePitch(st.pitchType, c.cell, 0.06, 1));
      }
    }
    switch (st.phase) {
      case 'change':
        st.timer -= dt;
        if (st.timer <= 0) startHalf();
        break;
      case 'ready':
        st.timer -= dt;
        if (userBatting() && st.timer <= 0) release(cpuChoosePitch(diff, st.balls, st.strikes));
        break;
      case 'windup':
        st.timer -= dt;
        if (st.timer <= 0) {
          st.phase = 'pitch';
          sound.whoosh();
        }
        break;
      case 'pitch': {
        const pt = st.pitch;
        st.pu += dt / pt.time;
        // 打者のスイング
        if (userBatting() && cmd.swing && st.swingAt < 0) st.swingAt = st.clock;
        if (!userBatting() && st.cpuSwing && st.swingAt < 0 && st.pu >= 1 - SWING_HIT / pt.time) st.swingAt = st.clock;
        if (!st.crossed && st.pu >= 1) {
          st.crossed = true;
          const tc = st.clock - ((st.pu - 1) * pt.time);
          if (userBatting()) {
            if (st.swingAt >= 0) {
              const err = tc - st.swingAt - SWING_HIT; // + は振り遅れではなく早い
              const dist = Math.hypot(pt.tx - st.aim.x, pt.ty - st.aim.y);
              if (Math.abs(err) < 0.1 && dist < 0.17) {
                const sweet = 1 - dist / 0.17;
                const tq = 1 - Math.abs(err) / 0.1;
                const v = (20 + 26 * sweet) * (0.6 + 0.4 * tq);
                const angle = 12 + ((pt.ty - st.aim.y) / 0.17) * 32 + (Math.random() - 0.5) * 8;
                const spray = -(err / 0.1) * 50 + (Math.random() - 0.5) * 10;
                contact(v, angle, spray);
                break;
              }
            }
          } else if (st.cpuSwing && st.cpuSwing.contact) {
            contact(st.cpuSwing.v, st.cpuSwing.angle, st.cpuSwing.spray);
            break;
          }
        }
        if (userBatting() && cmd.swing && st.swingAt < 0) st.swingAt = st.clock; // 本塁通過後の振り遅れ
        if (st.pu >= 1.12) {
          st.pu = 1.12;
          call(st.swingAt >= 0 ? 'swing' : pt.strike ? 'strike' : 'ball');
          if (st.swingAt >= 0) sound.swingMiss();
        }
        break;
      }
      case 'batted':
        stepBatted(st.batted, dt);
        st.timer -= dt;
        if (st.timer <= 0) applyResult();
        break;
      case 'after':
        st.timer -= dt;
        if (st.timer <= 0) next();
        break;
      case 'over':
        st.timer -= dt;
        if (st.timer <= 0) {
          st.phase = 'done';
          const [me, cpu] = st.score;
          ctx.finish({
            outcome: me > cpu ? 'win' : me < cpu ? 'lose' : 'draw',
            title: me > cpu ? 'あなたの勝ち！' : me < cpu ? 'CPU の勝ち…' : '引き分け',
            lines: [`スコア ${me} - ${cpu}（${diff.label}・${INNINGS}イニング）`],
            best: me > 0 ? me : undefined,
            bestText: `${me}点`,
          });
        }
        break;
      default:
        break;
    }
  }

  st.phase = 'change';
  st.timer = 0.3;
  view.setMode('bat', true);

  return {
    state: st,
    update(dt, time) {
      update(dt, readInput());
      // 描画の同期
      if (st.pitch && (st.phase === 'pitch' || st.phase === 'windup' || (st.phase === 'after' && !st.result))) {
        pitchPos(st.pitch, st.phase === 'windup' ? -0.02 : st.pu, ballPos);
      } else if (st.phase === 'batted' || (st.phase === 'after' && st.result)) {
        ballPos.set(st.batted.p.x, st.batted.p.y, st.batted.p.z);
      } else {
        ballPos.set(0.15, 1.85, -17.1);
      }
      if (st.phase === 'ready' || st.phase === 'change') st.result = null;
      view.sync(st, dt, time, ballPos, userBatting(), SWING_HIT);
      field.update(dt, time);
      board();
    },
    idle(dt, time) {
      field.update(dt, time);
    },
    onPause() {},
    dispose() {
      panel.dispose();
      disposeTree(group);
    },
  };
}

