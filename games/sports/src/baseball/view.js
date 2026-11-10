// 野球の見た目の同期：カメラ（打席視点・投手視点・打球追従）、選手の動き、バットのスイング
import * as THREE from 'three';
import { BASES, MOUND_Z } from './field.js';

const SWING_DUR = 0.26;

export function createBaseballView({ field, pl, director }) {
  const cur = pl.fielders.map((f) => f.home.clone()); // 野手の現在位置（見た目用）
  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();
  const camP = new THREE.Vector3();
  let mode = 'bat';
  let batted = null; // judgeBatted の結果

  // バットは打者の手元を軸に回す
  const pivot = new THREE.Group();
  field.bat.removeFromParent();
  pivot.add(field.bat);
  pl.batter.root.parent.add(pivot);

  function faceHome(fig, p) {
    fig.root.rotation.y = Math.atan2(p.x, p.z);
  }

  function setMode(m, snap = false) {
    mode = m;
    batted = null;
    if (m === 'bat') {
      // 捕手の後ろ・少し一塁側の高めから（打者が本塁を隠さない位置）
      director.set([0.45, 1.75, 3.4], [0, -0.6, -18], { snap, speed: 6 });
      director.setFov(40, snap);
    } else if (m === 'pitch') {
      director.set([1.6, 3.6, MOUND_Z - 7], [0, 0.6, 0], { snap, speed: 6 }); // 投手の右後ろ・高め（本塁が隠れない）
      director.setFov(34, snap);
    }
  }

  function startBatted(r) {
    batted = r;
    mode = 'follow';
    director.setFov(55);
  }

  /**
   * @param {object} st 野球の状態
   */
  function sync(st, dt, time, ballPos, userBatting, swingHit) {
    // ボール
    pl.ball.position.copy(ballPos);
    pl.ball.visible = st.phase !== 'change';
    pl.ballShadow.position.set(ballPos.x, 0.02, ballPos.z);

    // 打席のカーソル・ゾーン
    const aiming = userBatting && (st.phase === 'ready' || st.phase === 'windup' || st.phase === 'pitch');
    field.cursor.visible = aiming;
    field.zone.visible = userBatting && st.phase !== 'batted';
    field.cursor.position.set(st.aim.x, st.aim.y, 0.02);

    // 野手：打球のときは担当野手が落下点へ走る。それ以外は定位置へ戻る
    pl.fielders.forEach((f, i) => {
      const target = batted && st.phase !== 'ready' && i === batted.fielder && batted.catchAt
        ? tmp.set(batted.catchAt.x, 0, batted.catchAt.z)
        : f.home;
      const d = target.distanceTo(cur[i]);
      if (d > 0.05) cur[i].lerp(target, Math.min(1, (7.5 * dt) / d));
      f.root.position.copy(cur[i]);
      f.sh.position.set(cur[i].x, 0.02, cur[i].z);
      if (d > 0.3) f.root.rotation.y = Math.atan2(cur[i].x - target.x, cur[i].z - target.z);
      else faceHome(f, cur[i]);
      f.body.position.y = 1.1 + (d > 0.3 ? Math.abs(Math.sin(time * 14 + i)) * 0.06 : 0);
    });
    // 投手の投球モーション
    const p = pl.fielders[0];
    const wind = st.phase === 'windup' ? 1 - st.timer / 0.55 : st.phase === 'pitch' ? 1 : 0;
    p.armR.rotation.x = wind < 1 ? wind * 2.8 : -1.2;
    p.root.position.y = 0.25;

    // 捕手
    pl.catcher.root.visible = pl.catcher.sh.visible = mode !== 'bat'; // 打席視点では視界をふさぐので隠す
    pl.catcher.root.position.copy(pl.catcher.home);
    pl.catcher.root.rotation.y = Math.PI;
    pl.catcher.root.scale.y = 0.75;
    pl.catcher.sh.position.set(0, 0.02, 1);

    // 打者とバット（右打ち：三塁側に立ち、一塁方向 +x を向く）
    const bt = pl.batter;
    bt.root.position.copy(bt.home);
    bt.root.rotation.y = -Math.PI / 2;
    bt.sh.position.set(bt.home.x, 0.02, bt.home.z);
    pivot.position.set(bt.home.x + 0.3, Math.max(0.6, Math.min(1.3, userBatting ? st.aim.y : st.pitch?.ty ?? 0.9)), 0.1);
    let s = -1;
    if (st.swingAt >= 0 && (st.phase === 'pitch' || st.phase === 'after' || st.phase === 'batted')) {
      s = Math.min(1, (st.clock - st.swingAt) / SWING_DUR);
    }
    if (s < 0) {
      pivot.rotation.set(0, -1.7, 0);
      field.bat.rotation.set(0, 0, -0.5);
    } else {
      // 振り始め（背中側）→ swingHit 秒後に本塁上（+x 方向）→ 振り抜き
      const k = swingHit / SWING_DUR;
      const phi = s < k ? -1.7 + (s / k) * 1.7 : ((s - k) / (1 - k)) * 2.2;
      pivot.rotation.set(0, phi, 0);
      field.bat.rotation.set(0, 0, -Math.PI / 2);
    }
    bt.armR.rotation.x = s < 0 ? -1.2 : -1.5;
    bt.armL.rotation.x = s < 0 ? -1.2 : -1.5;

    // 走者
    pl.runners.forEach((r, i) => {
      r.root.visible = st.bases[i];
      r.sh.visible = st.bases[i];
      const b = BASES[i + 1];
      r.root.position.set(b.x * 0.97, 0, b.z * 0.97 + 0.6);
      faceHome(r, b);
      r.sh.position.set(r.root.position.x, 0.02, r.root.position.z);
    });

    // カメラ：打球を追う
    if (mode === 'follow') {
      const bp = ballPos;
      const dist = Math.hypot(bp.x, bp.z);
      camP.set(bp.x * 0.45, Math.max(5, bp.y * 0.6 + 6), bp.z * 0.45 + 14 + dist * 0.12);
      look.copy(bp);
      director.set(camP, look, { speed: 3.5 });
    }
  }

  return { setMode, startBatted, sync };
}
