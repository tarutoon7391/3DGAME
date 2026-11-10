// アーチェリー：一人称。長押しで引き絞り（引くほど手ブレ増）、離して発射。風と重力で矢が流れる
// 5射×3ラウンド（交互に射つ）。ラウンドごとに的が遠くなる。CPU 対戦と同一PC 2人交代に対応
import * as THREE from 'three';
import { hud } from '/shared/ui.js';
import { setBoard, callout, meter } from '../core/scoreboard.js';
import { setSky, disposeTree } from '../core/env.js';
import { gauss, rand } from '../core/difficulty.js';
import { buildRange, makeArrowMesh, makeBow, TARGET_R, TARGET_Y, EYE } from './range.js';

const DIST = [18, 28, 40];
const SHOTS = 5;
const G = 9.8;
const slow = 0.55; // 矢の飛行中のスロー演出

export function createArchery(ctx) {
  const { scene, renderer, input, sound, director, fx, diff, mode } = ctx;
  const group = new THREE.Group();
  scene.add(group);
  setSky(scene, 0xa8d8ff, 50, 160);
  const { target, flags } = buildRange(group);
  const bow = makeBow();
  bow.group.scale.setScalar(0.42); // 画面をふさがない大きさ
  group.add(bow.group);
  const arrowColors = [0x2f81f7, 0xe5383b];
  const arrows = []; // このラウンドに刺さった矢（見た目）
  const flying = makeArrowMesh(0xffd166);
  flying.visible = false;
  group.add(flying);

  // 状態（JSON 化できる値だけ）。players[local] が操作中の自分。2人モードでは手番の人が操作する
  const pvp = mode === 'pvp';
  const st = {
    players: [
      { name: pvp ? 'プレイヤー1' : 'あなた', cpu: false, rounds: [[], [], []], total: 0 },
      { name: pvp ? 'プレイヤー2' : 'CPU', cpu: !pvp, rounds: [[], [], []], total: 0 },
    ],
    local: 0,
    turn: 0,
    round: 0,
    shot: 0, // ラウンド内で何本目か（各自）
    wind: 0, // 横風の強さ m/s（+ が右へ流れる）
    phase: 'intro', // intro | aim | cpu | flight | hit | over | done
    timer: 1.8,
    draw: 0,
    hold: 0,
    aim: { yaw: 0, pitch: 0 },
    sway: { x: 0, y: 0 },
    arrow: { p: { x: 0, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 } },
    last: null, // 直前の得点
  };
  const dist = () => DIST[st.round];
  const shooter = () => st.players[st.turn];

  const dir = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();

  function newWind() {
    const strength = rand(0.3, 1.6 + st.round * 0.8) * diff.wind;
    st.wind = (Math.random() < 0.5 ? -1 : 1) * Math.round(strength * 10) / 10;
  }

  function aimDir(yaw, pitch, out) {
    return out.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  }

  function startRound() {
    target.position.z = -dist();
    arrows.forEach((a) => {
      a.removeFromParent();
      a.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    });
    arrows.length = 0;
    callout(`ラウンド ${st.round + 1}`, { color: '#ffffff', sub: `的まで ${dist()} m`, ms: 1600 });
    sound.whistle();
    st.phase = 'intro';
    st.timer = 1.7;
  }

  function beginTurn() {
    newWind();
    st.draw = 0;
    st.hold = 0;
    if (shooter().cpu) {
      st.phase = 'cpu';
      st.timer = rand(1.1, 1.6);
    } else {
      st.phase = 'aim';
      if (pvp) callout(`${shooter().name} の番`, { color: st.turn === 0 ? '#7cc4ff' : '#ff8a80', ms: 1000 });
    }
  }

  /** 入力 → コマンド */
  function readInput() {
    const r = renderer.domElement.getBoundingClientRect();
    const nx = ((input.mouse.x - r.left) / r.width) * 2 - 1;
    const ny = -((input.mouse.y - r.top) / r.height) * 2 + 1;
    return { nx, ny, press: input.wasPressed('Mouse0'), hold: input.isDown('Mouse0') };
  }

  function fire(yaw, pitch, power) {
    aimDir(yaw, pitch, dir);
    const speed = 30 + 45 * power;
    st.arrow.p = { x: EYE.x + dir.x * 0.5, y: EYE.y - 0.05 + dir.y * 0.5, z: EYE.z + dir.z * 0.5 };
    st.arrow.v = { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed };
    st.phase = 'flight';
    st.draw = 0;
    sound.bowRelease();
    flying.visible = true;
  }

  function cpuShoot() {
    // 重力と風を見越して狙う（強いほど補正が正確・ブレが小さい）
    const power = 0.9;
    const speed = 30 + 45 * power;
    const t = dist() / speed;
    const comp = diff.archComp;
    const ax = st.wind * 0.9;
    const aimX = -0.5 * ax * t * t * comp + gauss() * diff.archAim * (dist() / 20);
    const aimY = TARGET_Y + 0.5 * G * t * t * comp + gauss() * diff.archAim * (dist() / 20);
    tmp.set(aimX - EYE.x, aimY - EYE.y, -dist() - EYE.z).normalize();
    fire(Math.atan2(-tmp.x, -tmp.z), Math.asin(tmp.y), power);
  }

  function score(x, y) {
    const r = Math.hypot(x, y - TARGET_Y);
    if (r > TARGET_R) return 0;
    return Math.min(10, 10 - Math.floor(r / (TARGET_R / 10)));
  }

  function land(points, pos, stuckInTarget) {
    const pl = shooter();
    pl.rounds[st.round].push(points);
    pl.total += points;
    st.last = points;
    st.phase = 'hit';
    st.timer = 1.6;
    flying.visible = false;
    const a = makeArrowMesh(arrowColors[st.turn]);
    a.position.set(pos.x, pos.y, pos.z);
    tmp.set(st.arrow.v.x, st.arrow.v.y, st.arrow.v.z).normalize();
    a.lookAt(tmp.add(a.position));
    if (stuckInTarget) a.position.z += 0.25; // 先端がめり込む
    group.add(a);
    arrows.push(a);
    if (stuckInTarget) {
      sound.thunk();
      director.shake(0.04);
      fx.burst({ x: pos.x, y: pos.y, z: pos.z + 0.05 }, { count: 10, color: 0xd9c9a3, speed: 1, up: 1, size: 0.03, life: 0.5 });
    } else sound.bounce();
    const mine = st.turn === st.local || pvp;
    const label = points === 10 ? '10点！ど真ん中！' : points >= 8 ? `${points}点！` : points > 0 ? `${points}点` : 'ミス';
    callout(label, { color: points >= 9 ? '#ffd166' : points > 0 ? '#ffffff' : '#ff8a80', sub: `${pl.name}`, ms: 1300 });
    if (points >= 9 && mine) sound.good();
    if (points === 0 && mine) sound.bad();
  }

  function nextTurn() {
    // 交互に射つ：P1 → P2 → P1 …
    if (st.turn === 0) st.turn = 1;
    else {
      st.turn = 0;
      st.shot++;
    }
    if (st.shot >= SHOTS) {
      st.shot = 0;
      st.round++;
      if (st.round >= DIST.length) {
        st.round = DIST.length - 1;
        st.phase = 'over';
        st.timer = 1.8;
        const [a, b] = st.players;
        callout('試合終了', { color: '#ffffff', sub: `${a.total} - ${b.total}`, ms: 1800 });
        return;
      }
      startRound();
      return;
    }
    beginTurn();
  }

  function update(dt, time, cmd) {
    switch (st.phase) {
      case 'intro':
        st.timer -= dt;
        if (st.timer <= 0) beginTurn();
        break;
      case 'aim': {
        st.aim.yaw = -cmd.nx * 0.2;
        st.aim.pitch = cmd.ny * 0.14 + 0.02;
        if (cmd.press && st.draw === 0) {
          st.draw = 0.001;
          sound.bowDraw();
        }
        if (st.draw > 0) {
          if (cmd.hold) {
            st.draw = Math.min(1, st.draw + dt / 1.1);
            st.hold += dt;
          } else {
            if (st.draw > 0.15) fire(st.aim.yaw + st.sway.x, st.aim.pitch + st.sway.y, st.draw);
            else st.draw = 0;
            st.hold = 0;
          }
        }
        // 手ブレ：引くほど・長く構えるほど大きい
        const amp = 0.0015 + st.draw * 0.006 + Math.max(0, st.hold - 1.6) * 0.007;
        st.sway.x = amp * (Math.sin(time * 1.7) + 0.6 * Math.sin(time * 3.3 + 1.3));
        st.sway.y = amp * (Math.sin(time * 2.1 + 0.5) + 0.5 * Math.sin(time * 4.1));
        break;
      }
      case 'cpu':
        st.timer -= dt;
        st.draw = Math.min(0.9, st.draw + dt / 1.1);
        if (st.timer <= 0) cpuShoot();
        break;
      case 'flight': {
        const a = st.arrow;
        const n = 4;
        const h = (dt * slow) / n;
        for (let i = 0; i < n && st.phase === 'flight'; i++) {
          a.v.y -= G * h;
          a.v.x += st.wind * 0.9 * h;
          const pz = a.p.z;
          a.p.x += a.v.x * h;
          a.p.y += a.v.y * h;
          a.p.z += a.v.z * h;
          const tz = -dist();
          if (pz > tz && a.p.z <= tz) {
            const k = (pz - tz) / (pz - a.p.z);
            const hx = a.p.x - a.v.x * h * (1 - k);
            const hy = a.p.y - a.v.y * h * (1 - k);
            const onBoard = Math.abs(hx) < 1.05 && Math.abs(hy - TARGET_Y) < 1.05;
            if (onBoard) land(score(hx, hy), { x: hx, y: hy, z: tz }, true);
          }
          if (st.phase === 'flight' && (a.p.y <= 0.02 || a.p.z < -dist() - 25)) land(0, { x: a.p.x, y: Math.max(0.05, a.p.y), z: a.p.z }, false);
        }
        break;
      }
      case 'hit':
        st.timer -= dt;
        if (st.timer <= 0) nextTurn();
        break;
      case 'over':
        st.timer -= dt;
        if (st.timer <= 0) {
          st.phase = 'done';
          finish();
        }
        break;
      default:
        break;
    }
  }

  function finish() {
    const [a, b] = st.players;
    const lines = [`${a.name} ${a.total} 点　／　${b.name} ${b.total} 点`, `（5射×3ラウンド・${diff.label}）`];
    if (pvp) {
      const best = Math.max(a.total, b.total);
      ctx.finish({
        outcome: null,
        celebrate: true,
        title: a.total === b.total ? '引き分け' : `${a.total > b.total ? a.name : b.name} の勝ち！`,
        lines: [...lines, '2人対戦は勝敗の記録に数えません'],
        best,
        bestText: `${best}点`,
      });
      return;
    }
    ctx.finish({
      outcome: a.total > b.total ? 'win' : a.total < b.total ? 'lose' : 'draw',
      title: a.total > b.total ? 'あなたの勝ち！' : a.total < b.total ? 'CPU の勝ち…' : '引き分け',
      lines,
      best: a.total,
      bestText: `${a.total}点`,
    });
  }

  function view(dt, time) {
    // 吹き流しは風下を向き、強いほど水平に
    const w = st.wind;
    flags.forEach((f, i) => {
      f.rotation.y = w >= 0 ? Math.PI : 0;
      // 吹き流しは -x 向きに作ってある。z 回転で垂れ下がり（無風ほど垂れる）
      f.rotation.z = 1.3 - Math.min(1, Math.abs(w) / 3) * 1.2 + Math.sin(time * 6 + i) * 0.05;
    });
    // カメラ
    if (st.phase === 'flight') {
      const a = st.arrow;
      tmp.set(a.v.x, a.v.y, a.v.z).normalize();
      flying.position.set(a.p.x, a.p.y, a.p.z);
      flying.lookAt(a.p.x + tmp.x, a.p.y + tmp.y, a.p.z + tmp.z);
      director.set([a.p.x - tmp.x * 1.6, a.p.y + 0.35, a.p.z - tmp.z * 1.6], [a.p.x + tmp.x * 6, a.p.y + tmp.y * 6, a.p.z + tmp.z * 6], { snap: true });
      director.setFov(50, true);
      bow.group.visible = false;
    } else if (st.phase === 'hit') {
      director.set([0.6, TARGET_Y + 0.5, -dist() + 3.2], [0, TARGET_Y, -dist()], { speed: 7 });
      director.setFov(45);
      bow.group.visible = false;
    } else {
      const yaw = st.aim.yaw + st.sway.x;
      const pitch = st.aim.pitch + st.sway.y;
      const human = st.phase === 'aim';
      aimDir(human ? yaw : 0, human ? pitch : 0.02, dir);
      director.set(EYE, tmp.copy(EYE).addScaledVector(dir, 10), { snap: true });
      director.setFov(60 - st.draw * 28, true);
      // 弓は視点の少し右下
      right.crossVectors(dir, up).normalize();
      bow.group.visible = human || st.phase === 'cpu';
      bow.group.position.copy(EYE).addScaledVector(dir, 0.6).addScaledVector(right, 0.17).addScaledVector(up, -0.13);
      bow.group.lookAt(tmp.copy(bow.group.position).addScaledVector(dir, 5));
      bow.setDraw(st.draw);
    }
  }

  function board() {
    const row = (p, i) => {
      const r = p.rounds.map((x, n) => (n <= st.round || x.length ? `<td>${x.reduce((s, v) => s + v, 0)}</td>` : '<td class="dim">-</td>')).join('');
      const mark = st.turn === i && st.phase !== 'over' && st.phase !== 'done' ? '▶ ' : '';
      return `<tr class="${i === 0 ? 'me' : 'cpu'}"><td>${mark}${p.name}</td>${r}<td><b>${p.total}</b></td></tr>`;
    };
    const arrow = st.wind > 0 ? '→' : st.wind < 0 ? '←' : '・';
    setBoard(
      `<table><tr><th></th><th>R1</th><th>R2</th><th>R3</th><th>計</th></tr>${st.players.map(row).join('')}</table>` +
        `風 <b style="color:#ffd166">${arrow} ${Math.abs(st.wind).toFixed(1)} m/s</b>　距離 ${dist()} m`,
    );
    const p = shooter();
    hud(
      `<b>アーチェリー</b>（${pvp ? '2人対戦' : diff.label}）<br>` +
        `ラウンド ${st.round + 1}/3　${Math.min(st.shot + 1, SHOTS)}/${SHOTS} 射目　手番：${p.name}<br>` +
        `引き絞り ${meter(st.draw)}<br>` +
        (p.cpu ? 'CPU が狙っています…' : 'マウスで狙う／長押しで引く／離して発射<br>引きすぎ・構えすぎは手ブレ大'),
    );
  }

  // 照準（画面中央の十字）
  const cross = document.createElement('div');
  cross.style.cssText = 'position:fixed;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;z-index:9;pointer-events:none;' +
    'background:linear-gradient(#fff,#fff) center/2px 100% no-repeat,linear-gradient(#fff,#fff) center/100% 2px no-repeat;opacity:.85;mix-blend-mode:difference';
  document.body.appendChild(cross);

  startRound();

  return {
    state: st,
    update(dt, time) {
      update(dt, time, readInput());
      view(dt, time);
      cross.style.display = st.phase === 'aim' ? '' : 'none';
      board();
    },
    onPause() {
      // 引き絞り中にポーズしたら構え直し
      st.draw = 0;
      st.hold = 0;
    },
    dispose() {
      cross.remove();
      disposeTree(group);
    },
  };
}
