// 空と光：時刻による朝〜夜の光の変化、天気（雨のパーティクル・暗さ）
import * as THREE from 'three';

// 時刻（時）ごとのキーフレーム
const KEYS = [
  { h: 6, sky: 0xffd2a0, sun: 0xffc080, si: 1.5, hemi: 0.75 },
  { h: 8.5, sky: 0x8ecdf7, sun: 0xfff6e6, si: 2.3, hemi: 0.95 },
  { h: 16, sky: 0x8ecdf7, sun: 0xffffff, si: 2.3, hemi: 0.95 },
  { h: 18, sky: 0xff9a5c, sun: 0xff8a50, si: 1.2, hemi: 0.6 },
  { h: 20, sky: 0x1b2444, sun: 0x7d93d6, si: 0.45, hemi: 0.28 },
  { h: 26, sky: 0x0f1530, sun: 0x6f86c9, si: 0.35, hemi: 0.22 },
].map((k) => ({ ...k, sky: new THREE.Color(k.sky), sun: new THREE.Color(k.sun) }));
const RAIN_TINT = new THREE.Color(0x77838f);
const DROPS = 900;
const WHITE = new THREE.Color(1, 1, 1);

export function createSky(scene) {
  const hemi = new THREE.HemisphereLight(0xdff1ff, 0x5a7a3a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(-2, 0, 0);
  scene.add(sun, sun.target);

  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0x8ecdf7, 40, 90);

  // 雨：線分の集まりを毎フレーム落とす（配列は使い回す）
  const pos = new Float32Array(DROPS * 6);
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < DROPS; i++) {
    const x = rnd(-22, 22), y = rnd(0, 18), z = rnd(-20, 20);
    pos.set([x, y, z, x + 0.05, y + 0.6, z], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xbfd7ea, transparent: true, opacity: 0.55 }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  const sky = new THREE.Color();
  const sunC = new THREE.Color();
  let rainMix = 0;

  return {
    /**
     * @param {number} hour 6〜26
     * @param {boolean} raining
     * @param {THREE.Vector3} focus カメラの注視点（雨の範囲を追従）
     * @returns {number} 夜の度合い 0〜1（街灯などに使う）
     */
    update(dt, hour, raining, focus) {
      let a = KEYS[0];
      let b = KEYS[KEYS.length - 1];
      for (let k = 0; k < KEYS.length - 1; k++) {
        if (hour >= KEYS[k].h && hour <= KEYS[k + 1].h) { a = KEYS[k]; b = KEYS[k + 1]; break; }
      }
      const t = b.h === a.h ? 0 : Math.min(1, Math.max(0, (hour - a.h) / (b.h - a.h)));
      rainMix += ((raining ? 1 : 0) - rainMix) * Math.min(1, dt * 2);
      sky.copy(a.sky).lerp(b.sky, t).lerp(RAIN_TINT, rainMix * 0.6 * (hour < 19 ? 1 : 0.3));
      sunC.copy(a.sun).lerp(b.sun, t);
      scene.background.copy(sky);
      scene.fog.color.copy(sky);
      scene.fog.near = raining ? 20 : 40;
      scene.fog.far = raining ? 60 : 90;
      hemi.intensity = (a.hemi + (b.hemi - a.hemi) * t) * (1 - rainMix * 0.25);
      hemi.color.copy(sky).lerp(WHITE, 0.5);
      sun.color.copy(sunC);
      sun.intensity = (a.si + (b.si - a.si) * t) * (1 - rainMix * 0.55);
      // 太陽は 6時に東、18時に西。夜は月として高めに置く
      const ang = Math.min(1, Math.max(0, (hour - 6) / 12)) * Math.PI;
      const day = hour < 19;
      const cx = sun.target.position.x;
      if (day) sun.position.set(cx + Math.cos(ang) * 22, 6 + Math.sin(ang) * 24, 12);
      else sun.position.set(cx - 8, 28, 14);

      rain.visible = rainMix > 0.05;
      if (rain.visible) {
        rain.material.opacity = 0.55 * rainMix;
        rain.position.set(focus.x, 0, focus.z);
        const fall = dt * 22;
        for (let i = 0; i < DROPS; i++) {
          const o = i * 6;
          pos[o + 1] -= fall;
          pos[o + 4] -= fall;
          if (pos[o + 1] < 0) {
            const y = 16 + Math.random() * 3;
            pos[o + 1] = y;
            pos[o + 4] = y + 0.6;
          }
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
      // 夜の度合い
      if (hour < 7) return Math.max(0, (7 - hour) * 0.4);
      if (hour < 17.5) return raining ? 0.3 : 0;
      return Math.min(1, (hour - 17.5) / 2);
    },
  };
}
