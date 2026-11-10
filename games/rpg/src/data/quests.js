// クエスト3本（討伐・収集・ボス）
// type: kill は area 内の敵を count 体、collect は needs の素材を集めて報告、boss はボス撃破

export const QUESTS = {
  hunt: {
    name: '草原の魔物退治', giver: 'chief', type: 'kill', area: 'field', count: 10,
    desc: '風の草原の魔物を10体倒す',
    reward: { gold: 100, exp: 50, items: { potion: 2 } },
  },
  gather: {
    name: '薬師のおつかい', giver: 'healer', type: 'collect', needs: { herb: 5, fang: 3 },
    desc: '薬草5個と魔獣の牙3個を薬師ミナに届ける',
    reward: { gold: 120, exp: 50, items: { ether: 2, potion: 2 } },
  },
  boss: {
    name: '魔窟の主を討て', giver: 'chief', type: 'boss', requires: 'hunt',
    desc: 'ダンジョン最深部の魔窟の主ガルドラを倒す',
    reward: { gold: 0, exp: 0, items: {} },
  },
};

/** HUD・メニューの表示順 */
export const QUEST_ORDER = ['hunt', 'gather', 'boss'];
