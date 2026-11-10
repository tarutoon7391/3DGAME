// プレイヤーの行動：道具を使う（F／クリック）・話す／調べる（E）と、対象の探索
import * as THREE from 'three';
import { CROPS, CROP_IDS, seedId } from './data/crops.js';
import { ITEMS } from './data/items.js';
import { TOOLS, CAN_CAPACITY } from './data/balance.js';
import { count, takeItem } from './state.js';
import { stageOf } from './field.js';

const front = new THREE.Vector3();
const tmp = new THREE.Vector3();
const UNFED = (l) => !l.a.fed;

/**
 * @param {object} g { state, field, animals, particles, sfx, toast, interactables, openMenu, shake }
 */
export function createActions(g) {
  const { state, field, animals, particles, sfx } = g;
  let sickleWarn = { key: '', t: 0 };

  /** 向き（ラジアン）を4方向のマス方向に */
  function gridDir(facing) {
    const sx = Math.sin(facing);
    const sz = Math.cos(facing);
    return Math.abs(sx) > Math.abs(sz) ? [Math.sign(sx), 0] : [0, Math.sign(sz)];
  }

  /** 目の前の状況を調べる（カーソル・ヒント・行動で共用） */
  function look(player) {
    const [dx, dz] = gridDir(player.facing);
    front.set(player.pos.x + dx * 0.8, 0, player.pos.z + dz * 0.8);
    const target = field.tileAt(front.x, front.z);
    const lv = state.tool === 0 ? state.tools.hoe : state.tool === 1 ? state.tools.can : 1;
    const tiles = target ? field.targetTiles(target.i, target.j, dx, dz, lv) : [];
    tmp.set(player.pos.x + Math.sin(player.facing) * 0.9, 0, player.pos.z + Math.cos(player.facing) * 0.9);
    const animal = (state.tool === 4 && animals.nearestAnimal(tmp.x, tmp.z, 1.2, UNFED)) || animals.nearestAnimal(tmp.x, tmp.z, 1.2);
    let product = animals.nearestProduct(tmp.x, tmp.z, 0.9);
    if (product === null) product = animals.nearestProduct(player.pos.x, player.pos.z, 0.8);
    let spot = null;
    for (const it of g.interactables) {
      const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z);
      if (d < it.r && (!spot || d < spot.d)) spot = { ...it, d };
    }
    const mature = target && stageOf(field.tile(target)) === 3;
    return { target, tiles, animal, product, spot, mature, dx, dz };
  }

  function spend(cost) {
    if (cost <= 0) return true;
    if (state.stamina <= 0) {
      sfx.ng();
      g.toast('つかれて道具が使えない…食べ物を食べるか寝よう');
      return false;
    }
    state.stamina = Math.max(0, state.stamina - cost);
    if (state.stamina === 0) g.toast('へとへとだ…（Tab で食べ物を食べよう）');
    return true;
  }

  function pickup(i) {
    const p = animals.productPos(i);
    if (p) particles.burst(p.x, 0.3, p.z, 0xffffff, { n: 8, up: 2.5 });
    const id = animals.collect(i);
    if (id) { sfx.harvest(); g.toast(`${ITEMS[id].icon}${ITEMS[id].name}を拾った`); }
  }

  function refill() {
    state.water = CAN_CAPACITY[state.tools.can - 1];
    sfx.water();
    particles.burst(9, 0.8, 3, 0x4fc3f7, { n: 14, up: 3 });
    g.toast('ジョウロに水をくんだ');
  }

  function harvestAt(pos) {
    const id = field.harvest(pos);
    if (!id) return false;
    field.center(pos, tmp);
    particles.burst(tmp.x, 0.4, tmp.z, CROPS[id].fruit, { n: 12, up: 3.5, size: 1.2 });
    particles.burst(tmp.x, 0.6, tmp.z, 0xfff59d, { n: 6, up: 2, gravity: 2, life: 0.8 });
    sfx.harvest();
    g.toast(`${CROPS[id].icon}${CROPS[id].name}を収穫！`);
    return true;
  }

  function feedAnimal(animal) {
    if (!animal) { sfx.ng(); g.toast('動物の前で使おう'); return; }
    if (animal.a.fed) { g.toast(`${animal.a.name}は今日はもうおなかいっぱい`); return; }
    if (count(state, 'feed') <= 0) { sfx.ng(); g.toast('飼料がない（ショップで買おう）'); return; }
    takeItem(state, 'feed', 1);
    animals.feed(animal);
    const p = animal.mesh.position;
    particles.burst(p.x, 1.2, p.z, 0xff6f91, { n: 6, up: 2, gravity: 1, life: 1 });
    animal.a.type === 'cow' ? sfx.moo() : sfx.cluck();
    g.toast(`${animal.a.name}にエサをあげた（なつき度 ${animal.a.aff}）`);
  }

  /** F／クリック：道具を使う */
  function use(player) {
    const L = look(player);
    if (L.product !== null) { pickup(L.product); return; }
    if (state.tool === 4) { feedAnimal(L.animal); player.swing(); return; }
    if (state.tool === 1 && L.spot?.id === 'well') { refill(); player.swing(); return; }
    if (L.mature && state.tool !== 0) { harvestAt(L.target); player.swing(); return; }
    if (!L.target) {
      if (state.tool <= 3) { sfx.ng(); g.toast('畑（木の枠の中）で使おう'); }
      return;
    }
    const tool = TOOLS[state.tool];
    const lv = state.tool === 0 ? state.tools.hoe : state.tool === 1 ? state.tools.can : 1;
    const cost = tool.cost[lv - 1];
    player.swing();
    switch (tool.id) {
      case 'hoe': {
        if (state.stamina <= 0) { spend(1); return; }
        const n = field.till(L.tiles, state.weather === 'rain');
        if (!n) { if (L.mature) harvestAt(L.target); return; }
        spend(cost);
        sfx.till();
        g.shake(0.08);
        for (const t of L.tiles) { field.center(t, tmp); particles.burst(tmp.x, 0.1, tmp.z, 0x8d6e43, { n: 5, up: 2 }); }
        break;
      }
      case 'can': {
        if (state.weather === 'rain') { g.toast('今日は雨。水やりはいらない'); return; }
        if (state.water <= 0) { sfx.ng(); g.toast('ジョウロが空っぽ。井戸で水をくもう（F）'); return; }
        if (state.stamina <= 0) { spend(1); return; }
        const n = field.water(L.tiles, state.water);
        if (!n) return;
        state.water -= n;
        spend(cost);
        sfx.water();
        for (const t of L.tiles) { field.center(t, tmp); particles.burst(tmp.x, 0.5, tmp.z, 0x4fc3f7, { n: 6, up: 1.5 }); }
        break;
      }
      case 'seed': {
        let crop = state.seed;
        if (count(state, seedId(crop)) <= 0) {
          crop = CROP_IDS.find((id) => count(state, seedId(id)) > 0);
          if (!crop) { sfx.ng(); g.toast('タネを持っていない（ショップで買おう）'); return; }
          state.seed = crop;
        }
        const t = field.tile(L.target);
        if (t.t !== 1) { g.toast('先にクワで耕そう'); return; }
        if (t.c) return;
        field.plant(L.target, crop);
        takeItem(state, seedId(crop), 1);
        sfx.plant();
        field.center(L.target, tmp);
        particles.burst(tmp.x, 0.15, tmp.z, 0x6d4c41, { n: 4, up: 1.2 });
        break;
      }
      case 'sickle': {
        const t = field.tile(L.target);
        if (!spend(cost)) return;
        sfx.cut();
        if (t.c) {
          const key = `${L.target.i},${L.target.j}`;
          const now = performance.now();
          if (sickleWarn.key !== key || now - sickleWarn.t > 1500) {
            sickleWarn = { key, t: now };
            g.toast(`まだ育っていない。もう一度で${CROPS[t.c].name}を抜く`);
            return;
          }
          field.remove(L.target);
        } else if (t.t) {
          t.t = 0;
          t.w = 0;
          field.markDirty();
        }
        field.center(L.target, tmp);
        particles.burst(tmp.x, 0.3, tmp.z, 0x7cb342, { n: 8, up: 2 });
        break;
      }
      default:
        break;
    }
  }

  /** E：話す・調べる */
  function interact(player) {
    const L = look(player);
    if (L.product !== null) { pickup(L.product); return; }
    if (L.animal) {
      const a = L.animal;
      if (animals.pet(a)) {
        const p = a.mesh.position;
        particles.burst(p.x, 1.2, p.z, 0xff6f91, { n: 5, up: 2, gravity: 1, life: 1 });
        a.a.type === 'cow' ? sfx.moo() : sfx.cluck();
        g.toast(`${a.a.name}をなでた（なつき度 ${a.a.aff}）${a.a.fed ? '' : '　※エサは 5:エサ で'}`);
      } else g.toast(`${a.a.name}：なつき度 ${a.a.aff}／${a.a.fed ? '満腹' : 'おなかがすいている'}`);
      return;
    }
    if (L.spot) {
      if (L.spot.id === 'well') refill();
      else g.openMenu(L.spot.id);
    }
  }

  /** 右下に出すヒント */
  function hint(player) {
    const L = look(player);
    const lines = [];
    if (L.product !== null) lines.push('F／E：拾う');
    if (L.animal) lines.push(`E：${L.animal.a.name}をなでる` + (state.tool === 4 ? '　F：エサをやる' : ''));
    if (L.spot) lines.push(`E：${L.spot.label}`);
    if (L.mature) lines.push('F：収穫する');
    return { text: lines.join('\n'), look: L };
  }

  return { use, interact, hint, look };
}
