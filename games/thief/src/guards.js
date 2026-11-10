// 警備員 AI：巡回 → 不審 → 調査 → 追跡 → 捜索 → 巡回復帰。視野コーンを床に表示し、壁越しには見えない
import * as THREE from 'three';
import { T, GUARD } from './config.js';
import { createCone } from './cone.js';

const COLORS = { calm: 0xffe082, warn: 0xffa040, chase: 0xff3030 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function buildModel(parent, fx) {
  const g = new THREE.Group();
  const uni = new THREE.MeshStandardMaterial({ color: 0x1f3a68, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 10), uni);
  torso.position.y = 0.75;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe0b896 }));
  head.position.y = 1.5;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 12), new THREE.MeshStandardMaterial({ color: 0x0d1b33 }));
  cap.position.y = 1.7;
  g.add(cap);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.2), cap.material);
  visor.position.set(0, 1.64, 0.25);
  g.add(visor);
  const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6c0 }));
  torch.position.set(0.3, 1.0, 0.35);
  g.add(torch);
  const light = new THREE.SpotLight(0xfff0c0, 18, 10, 0.5, 0.5, 1.5);
  light.position.set(0.3, 1.1, 0.4);
  light.target.position.set(0, 0, 4);
  g.add(light, light.target);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: fx.icons.question, depthTest: false, transparent: true }));
  icon.position.y = 2.4;
  icon.scale.set(0.8, 0.8, 0.8);
  icon.renderOrder = 11;
  icon.visible = false;
  g.add(icon);
  parent.add(g);
  return { g, torso, icon };
}

export function createGuard(parent, level, def, fx, smokes) {
  const { grid } = level;
  const model = buildModel(parent, fx);
  const cone = createCone(parent, COLORS.calm, 0.2);
  const route = def.route.map(([c, r]) => ({ x: grid.center(c), z: grid.center(r) }));
  const pathBuf = [];

  // JSON 化できる状態
  const s = {
    x: route[0].x,
    z: route[0].z,
    angle: 0,
    state: 'patrol', // patrol | suspicious | investigate | chase | search
    gauge: 0,
    wp: 0,
    waitT: 0,
    lookBase: 0,
    stateT: 0,
    tx: 0,
    tz: 0,
    lostT: 0,
    alarmed: false,
    path: [],
    pathI: 0,
    repathT: 0,
    targetId: -1, // 追跡中のプレイヤー番号
    seenT: 9, // 最後にプレイヤーを見てからの秒
    hideLocker: -1, // 隠れるのを見たロッカー
    alertShow: 0,
    walkT: 0,
  };
  model.g.position.set(s.x, 0, s.z);
  const pos = model.g.position;

  function goTo(x, z) {
    s.tx = x;
    s.tz = z;
    const sc = grid.toTile(s.x);
    const sr = grid.toTile(s.z);
    const t = grid.nearestWalkable(grid.toTile(x), grid.toTile(z), level.guardWalk);
    s.path.length = 0;
    s.pathI = 0;
    if (t && grid.path(sc, sr, t.c, t.r, level.guardWalk, pathBuf)) s.path.push(...pathBuf);
  }

  /** 経路に沿って進む。到着したら true */
  function follow(dt, speed) {
    if (s.pathI >= s.path.length) {
      // 最後は目標点へ直接
      return stepToward(s.tx, s.tz, dt, speed, 0.2, true);
    }
    const i = s.path[s.pathI];
    const c = i % grid.w;
    const r = (i / grid.w) | 0;
    const door = grid.ch(c, r) === 'o' ? level.doorAt(c, r) : null;
    if (door && !door.open && Math.hypot(grid.center(c) - s.x, grid.center(r) - s.z) < 1.8) {
      level.setDoor(door, true);
      api.events.push({ type: 'door', x: door.x, z: door.z });
    }
    if (stepToward(grid.center(c), grid.center(r), dt, speed, 0.3, false)) s.pathI++;
    return false;
  }

  function stepToward(x, z, dt, speed, eps, isFinal) {
    const dx = x - s.x;
    const dz = z - s.z;
    const d = Math.hypot(dx, dz);
    if (d < eps) return true;
    const st = Math.min(d, speed * dt);
    pos.x = s.x;
    pos.z = s.z;
    grid.move(pos, (dx / d) * st, (dz / d) * st, GUARD.radius);
    const moved = Math.hypot(pos.x - s.x, pos.z - s.z);
    s.x = pos.x;
    s.z = pos.z;
    turnTo(Math.atan2(dz, dx), dt, 8);
    s.walkT += dt * speed;
    // 引っかかって進めない時は到着扱い
    if (moved < speed * dt * 0.1 && isFinal) return true;
    return false;
  }

  function turnTo(a, dt, rate) {
    s.angle = wrap(s.angle + wrap(a - s.angle) * Math.min(1, dt * rate));
  }

  function setState(st) {
    s.state = st;
    s.stateT = 0;
  }

  /** プレイヤーが見えるか（見えた時の見つかりやすさ係数を返す。見えなければ 0） */
  function sees(pl, vis) {
    if (pl.hidden) return 0;
    const dx = pl.pos.x - s.x;
    const dz = pl.pos.z - s.z;
    const d = Math.hypot(dx, dz);
    if (d > GUARD.viewRange) return 0;
    const inCone = Math.abs(wrap(Math.atan2(dz, dx) - s.angle)) < GUARD.viewHalf;
    const near = d < GUARD.nearSense && pl.mode !== 'crouch';
    if (!inCone && !near) return 0;
    if (smokes.inSmoke(s.x, s.z) || smokes.blocks(s.x, s.z, pl.pos.x, pl.pos.z)) return 0;
    if (!grid.los(s.x, s.z, pl.pos.x, pl.pos.z, pl.mode === 'crouch')) return 0;
    return vis * (0.55 + 2.4 * (1 - d / GUARD.viewRange));
  }

  const api = {
    s,
    events: [], // セッションへ通知するイベント（detect / suspicious / door / catch）
    /** 音を聞いた */
    hear(x, z, strength = 0.2) {
      if (s.state === 'chase') return;
      s.gauge = Math.min(0.95, Math.max(s.gauge, GUARD.suspiciousAt + strength));
      s.tx = x;
      s.tz = z;
      if (s.state === 'investigate' || s.state === 'suspicious') { s.repathT = 0; if (s.state === 'investigate') goTo(x, z); return; }
      setState('suspicious');
      api.events.push({ type: 'suspicious' });
    },
    /** 警報で駆けつける */
    alarm(x, z) {
      if (s.state === 'chase') return;
      s.alarmed = true;
      s.gauge = Math.max(s.gauge, 0.7);
      setState('investigate');
      goTo(x, z);
    },
    /** プレイヤーがロッカーに隠れた */
    sawHiding(id, lockerIndex) {
      if (s.state === 'chase' && s.targetId === id && s.seenT < 0.3) s.hideLocker = lockerIndex;
    },
    update(dt, time, players, visOf) {
      s.stateT += dt;
      s.repathT -= dt;
      s.alertShow = Math.max(0, s.alertShow - dt);

      // ---- 知覚：一番よく見えるプレイヤー
      let best = 0;
      let bestId = -1;
      players.forEach((pl, i) => {
        const v = sees(pl, visOf(pl));
        if (v > best) { best = v; bestId = i; }
      });
      if (bestId >= 0) {
        s.seenT = 0;
        const pl = players[bestId];
        if (s.state === 'chase') {
          s.gauge = 1;
          s.targetId = bestId;
        } else {
          s.gauge = Math.min(1, s.gauge + best * dt * 0.75);
        }
        s.tx = pl.pos.x;
        s.tz = pl.pos.z;
        if (s.state !== 'chase' && s.gauge >= 1) {
          setState('chase');
          s.targetId = bestId;
          s.lostT = 0;
          s.alertShow = 1.5;
          api.events.push({ type: 'detect', x: s.x, z: s.z, player: bestId });
        } else if (s.gauge > GUARD.suspiciousAt && (s.state === 'patrol' || s.state === 'search')) {
          setState('suspicious');
          api.events.push({ type: 'suspicious' });
        } else if (s.state === 'investigate' && s.repathT <= 0) {
          s.repathT = 0.5;
          goTo(s.tx, s.tz);
        }
      } else {
        s.seenT += dt;
        if (s.state !== 'chase') s.gauge = Math.max(0, s.gauge - GUARD.gaugeDecay * dt);
      }

      // ---- 行動
      const sp = GUARD.speed;
      switch (s.state) {
        case 'patrol': {
          if (s.waitT > 0) {
            s.waitT -= dt;
            turnTo(s.lookBase + Math.sin(s.waitT * 2.2) * 0.8, dt, 3);
            if (s.waitT <= 0) { s.wp = (s.wp + 1) % route.length; goTo(route[s.wp].x, route[s.wp].z); }
            break;
          }
          if (s.path.length === 0 && s.pathI === 0 && Math.hypot(route[s.wp].x - s.x, route[s.wp].z - s.z) > 0.3 && s.tx !== route[s.wp].x) goTo(route[s.wp].x, route[s.wp].z);
          if (follow(dt, sp.patrol)) {
            s.waitT = def.wait ?? 1.2;
            s.lookBase = s.angle;
            s.path.length = 0;
            s.pathI = 0;
          }
          break;
        }
        case 'suspicious':
          turnTo(Math.atan2(s.tz - s.z, s.tx - s.x), dt, 5);
          if (s.stateT > 0.9) { setState('investigate'); goTo(s.tx, s.tz); }
          break;
        case 'investigate':
          if (follow(dt, s.alarmed ? sp.chase * 0.9 : sp.investigate)) { s.alarmed = false; setState('search'); s.lookBase = s.angle; s.waitT = 1.2; s.searchX = s.x; s.searchZ = s.z; }
          break;
        case 'chase': {
          const pl = players[s.targetId];
          if (s.hideLocker >= 0) {
            const lk = level.lockers[s.hideLocker];
            if (s.repathT <= 0) { s.repathT = 0.5; goTo(lk.front.x, lk.front.z); }
            follow(dt, sp.chase);
            if (pl && pl.hidden === lk && Math.hypot(lk.front.x - s.x, lk.front.z - s.z) < 1.2) api.events.push({ type: 'catch', player: s.targetId });
            else if (!pl || pl.hidden !== lk) s.hideLocker = -1;
            break;
          }
          if (s.seenT === 0 && pl) {
            // 見えている間はまっすぐ追う
            stepToward(pl.pos.x, pl.pos.z, dt, sp.chase, 0.01, false);
            s.path.length = 0;
            s.pathI = 0;
            if (Math.hypot(pl.pos.x - s.x, pl.pos.z - s.z) < GUARD.catchDist) api.events.push({ type: 'catch', player: s.targetId });
          } else {
            s.lostT += dt;
            if (s.repathT <= 0) { s.repathT = 0.6; goTo(s.tx, s.tz); }
            const arrived = follow(dt, sp.chase);
            if (arrived || s.lostT > GUARD.lostTime) {
              setState('search');
              s.gauge = 0.6;
              s.lookBase = s.angle;
              s.waitT = 1.2;
              s.searchX = s.x;
              s.searchZ = s.z;
              api.events.push({ type: 'lost' });
            }
          }
          break;
        }
        case 'search': {
          if (s.waitT > 0) {
            s.waitT -= dt;
            turnTo(s.lookBase + Math.sin(s.stateT * 2.5) * 1.3, dt, 4);
            if (s.waitT <= 0) {
              // 近くのランダムな床へ
              const c0 = grid.toTile(s.searchX);
              const r0 = grid.toTile(s.searchZ);
              for (let k = 0; k < 8; k++) {
                const c = c0 + Math.floor(Math.random() * 7) - 3;
                const r = r0 + Math.floor(Math.random() * 7) - 3;
                if (level.guardWalk(c, r) && grid.ch(c, r) !== 'o') { goTo(grid.center(c), grid.center(r)); break; }
              }
            }
          } else if (follow(dt, sp.search)) {
            s.waitT = 1.3;
            s.lookBase = s.angle;
          }
          if (s.stateT > GUARD.searchTime) {
            setState('patrol');
            s.gauge = Math.min(s.gauge, 0.2);
            s.waitT = 0;
            goTo(route[s.wp].x, route[s.wp].z);
          }
          break;
        }
      }

      // ---- 見た目
      pos.set(s.x, 0, s.z);
      model.g.rotation.y = Math.PI / 2 - s.angle;
      model.torso.position.y = 0.75 + Math.abs(Math.sin(s.walkT * 3)) * 0.05;
      const st = s.state;
      const col = st === 'chase' ? COLORS.chase : st === 'patrol' && s.gauge < 0.1 ? COLORS.calm : COLORS.warn;
      cone.mat.color.setHex(col);
      cone.mat.opacity = st === 'chase' ? 0.32 : 0.16 + s.gauge * 0.15;
      cone.update(grid, s.x, s.z, s.angle, GUARD.viewHalf, GUARD.viewRange, smokes);
      const icon = model.icon;
      if (st === 'chase' || s.alertShow > 0) {
        icon.visible = true;
        icon.material.map = fx.icons.alert;
        icon.material.opacity = 1;
        icon.scale.setScalar(0.9 + (s.alertShow > 0 ? Math.sin(time * 20) * 0.15 : 0));
      } else if (s.gauge > 0.05 || st === 'investigate' || st === 'search' || st === 'suspicious') {
        icon.visible = true;
        icon.material.map = fx.icons.question;
        icon.material.opacity = Math.max(0.35, s.gauge);
        icon.scale.setScalar(0.5 + s.gauge * 0.5);
      } else icon.visible = false;
    },
  };
  return api;
}
