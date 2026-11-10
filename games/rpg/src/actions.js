// ゲーム内の行動：会話・宿屋・アイテム使用・取得・EXP（game に生やすメソッド群）
import { NPCS, TALK } from './data/dialogs.js';
import { ITEMS, INN_PRICE } from './data/items.js';
import { talkFor, refreshQuests } from './questlog.js';
import { yawTo } from './util.js';
import { openMenu } from './ui/menu.js';

export function installActions(game) {
  const toastTimes = new Map();

  /** 同じ文を短時間に何度も出さないトースト */
  game.toastOnce = (msg, ms = 2000) => {
    const now = performance.now();
    if (now - (toastTimes.get(msg) || 0) < ms + 400) return;
    toastTimes.set(msg, now);
    game.toast(msg, ms);
  };

  game.giveExp = (n) => {
    const ups = game.state.gainExp(n);
    if (ups > 0) {
      const me = game.me();
      game.sound.se('level');
      game.toast(`レベル ${game.state.progress.level} に上がった！ HP・MP 全回復`, 2600);
      game.fx.burst(me.pos.x, 1, me.pos.z, 0xffd54f, 40, { speed: 5, up: 7, life: 1, size: 0.18, grav: 4 });
      game.fx.text(me.pos.x, 2.8, me.pos.z, 'LEVEL UP!', '#ffd54f', true);
    }
  };

  game.collectItem = (id, n, x, z) => {
    const before = game.state.progress.quests.gather.status;
    game.state.addItem(id, n);
    game.sound.se('pickup');
    game.fx.text(x, 2, z, `${ITEMS[id].name} +${n}`, '#b9f6ca');
    refreshQuests(game.state);
    if (before === 'active' && game.state.progress.quests.gather.status === 'done') {
      game.toast('素材がそろった！ 薬師ミナに届けよう');
      game.sound.se('quest');
    }
  };

  game.useItem = (id) => {
    const st = game.state;
    const pr = st.progress;
    const d = st.derived();
    const it = ITEMS[id];
    if (!it || !it.use) return false;
    if (st.count(id) <= 0) {
      game.toastOnce(`${it.name}を持っていない`);
      game.sound.se('error');
      return false;
    }
    if (it.heal && pr.hp >= d.maxHp) { game.toastOnce('HP は満タンだ'); return false; }
    if (it.mp && pr.mp >= d.maxMp) { game.toastOnce('MP は満タンだ'); return false; }
    st.removeItem(id, 1);
    if (it.heal) pr.hp = Math.min(d.maxHp, pr.hp + it.heal);
    if (it.mp) pr.mp = Math.min(d.maxMp, pr.mp + it.mp);
    const me = game.me();
    game.sound.se('potion');
    game.fx.burst(me.pos.x, 1, me.pos.z, it.heal ? 0x69f0ae : 0x448aff, 20, { speed: 2, up: 4, life: 0.8, grav: -2 });
    game.fx.text(me.pos.x, 2.4, me.pos.z, it.heal ? `+${it.heal} HP` : `+${it.mp} MP`, it.heal ? '#69f0ae' : '#82b1ff');
    return true;
  };

  game.onEquipChanged = () => {
    game.players.forEach((p) => p.applyEquipment());
    const d = game.state.derived();
    const pr = game.state.progress;
    pr.hp = Math.min(pr.hp, d.maxHp);
    pr.mp = Math.min(pr.mp, d.maxMp);
    game.hudView.refresh();
  };

  game.openMenu = () => openMenu(game, game.modal);

  /** NPC と話す */
  game.talkTo = (id, npc) => {
    const def = NPCS[id];
    const me = game.me();
    if (npc) npc.model.group.rotation.y = yawTo(npc.x, npc.z, me.pos.x, me.pos.z);
    const dlg = game.dialog;
    if (def.role === 'shop') {
      dlg.talk(def.name, TALK.shop.default, () => dlg.shop(def.name));
      return;
    }
    if (def.role === 'inn') {
      dlg.choice(def.name, TALK.inn.default[0], [
        { label: `泊まる（${INN_PRICE}G）`, onClick: () => stay(def.name) },
        { label: '記録だけする', onClick: () => { game.autosave(); game.toast('冒険を記録した'); } },
        { label: 'やめる' },
      ]);
      return;
    }
    const t = talkFor(game, id);
    dlg.talk(def.name, t.lines, () => {
      t.after?.();
      game.autosave();
    });
  };

  function stay(name) {
    const pr = game.state.progress;
    if (pr.gold < INN_PRICE) {
      game.sound.se('error');
      game.dialog.talk(name, ['おや、お金が足りないようだね。']);
      return;
    }
    pr.gold -= INN_PRICE;
    game.state.healFull();
    game.sound.se('inn');
    game.flashFade();
    game.autosave();
    game.toast('ぐっすり休んだ！ HP・MP が全回復し、冒険を記録した', 2800);
  }
}
