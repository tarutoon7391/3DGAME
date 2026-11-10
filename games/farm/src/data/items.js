// アイテム定義（作物・種・畜産物・食べ物・エサ）
// base: 依頼の判定に使う種類（品質違いの卵などは同じ base）
// sell: 出荷額（0 は出荷不可）、eat: 食べたときのスタミナ回復量（0 は食べられない）
import { CROPS, seedId } from './crops.js';

export const ITEMS = {};

for (const [id, c] of Object.entries(CROPS)) {
  ITEMS[id] = { name: c.name, icon: c.icon, sell: c.sell, eat: c.eat, base: id, kind: 'crop' };
  ITEMS[seedId(id)] = { name: `${c.name}の種`, icon: '🌱', sell: 0, eat: 0, base: seedId(id), kind: 'seed', crop: id };
}

// 畜産物：品質3段階（なつき度で決まる）
const PRODUCTS = [
  { base: 'egg', names: ['卵', '良い卵', '極上の卵'], icon: '🥚', sell: 50, eat: 12 },
  { base: 'milk', names: ['牛乳', '良い牛乳', '極上の牛乳'], icon: '🥛', sell: 130, eat: 20 },
];
for (const p of PRODUCTS) {
  p.names.forEach((name, q) => {
    const id = q === 0 ? p.base : `${p.base}${q + 1}`;
    ITEMS[id] = { name, icon: p.icon, sell: Math.round(p.sell * [1, 1.5, 2][q]), eat: p.eat + q * 5, base: p.base, kind: 'product', quality: q };
  });
}

ITEMS.onigiri = { name: 'おにぎり', icon: '🍙', sell: 0, eat: 35, base: 'onigiri', kind: 'food' };
ITEMS.bento = { name: 'おべんとう', icon: '🍱', sell: 0, eat: 80, base: 'bento', kind: 'food' };
ITEMS.feed = { name: '飼料', icon: '🌾', sell: 0, eat: 0, base: 'feed', kind: 'feed' };

/** 品質 q（0〜2）の畜産物 id */
export const productId = (base, q) => (q === 0 ? base : `${base}${q + 1}`);

/** 依頼などで表示する種類名 */
export const baseName = (base) => ITEMS[base]?.name ?? base;
