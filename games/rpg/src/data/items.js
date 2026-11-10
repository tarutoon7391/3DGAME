// 装備・アイテムのデータ（数値はここに集約。処理側はこの定義を読むだけ）

/** 武器3段階。color は剣身の色、len は剣身の長さ倍率 */
export const WEAPONS = {
  w1: { name: '木の剣', atk: 4, price: 0, color: 0x9c6b3c, len: 1.0 },
  w2: { name: '鉄の剣', atk: 11, price: 180, color: 0xc7d0d8, len: 1.15 },
  w3: { name: '聖騎士の剣', atk: 22, price: 650, color: 0xffd54f, len: 1.35 },
};

/** 防具3段階。color は鎧（胴・腕）の色 */
export const ARMORS = {
  a1: { name: '布の服', def: 2, price: 0, color: 0x5d7fa8 },
  a2: { name: '革の鎧', def: 7, price: 150, color: 0x8d5a2b },
  a3: { name: '鋼の鎧', def: 14, price: 550, color: 0x9fb3bf },
};

/** 消耗品・素材。use:true は Tab メニューから使える。sell は売値（無ければ price の半分） */
export const ITEMS = {
  potion: { name: '回復薬', desc: 'HPを80回復する', heal: 80, price: 20, use: true, key: '1' },
  ether: { name: '魔力水', desc: 'MPを40回復する', mp: 40, price: 35, use: true, key: '2' },
  herb: { name: '薬草', desc: '草原に生える薬の材料', price: 0, sell: 6 },
  fang: { name: '魔獣の牙', desc: '草原の魔物から取れる素材', price: 0, sell: 15 },
  bone: { name: '古い骨', desc: 'ダンジョンの魔物から取れる。売れる', price: 0, sell: 25 },
};

/** ショップの品ぞろえ（id は WEAPONS / ARMORS / ITEMS のどれか） */
export const SHOP_STOCK = ['potion', 'ether', 'w2', 'a2', 'w3', 'a3'];

/** 宿代 */
export const INN_PRICE = 20;

/** ニューゲーム時の所持品 */
export const START_KIT = {
  gold: 60,
  items: { potion: 3, ether: 1 },
  weapons: ['w1'],
  armors: ['a1'],
  weapon: 'w1',
  armor: 'a1',
};

/** id から定義と種別を引く */
export function lookup(id) {
  if (WEAPONS[id]) return { kind: 'weapon', def: WEAPONS[id] };
  if (ARMORS[id]) return { kind: 'armor', def: ARMORS[id] };
  if (ITEMS[id]) return { kind: 'item', def: ITEMS[id] };
  return null;
}

/** 売値 */
export function sellPrice(id) {
  const f = lookup(id);
  if (!f) return 0;
  if (f.def.sell !== undefined) return f.def.sell;
  return Math.floor(f.def.price / 2);
}
