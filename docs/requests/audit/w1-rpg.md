# 監査レポート：w1-rpg（games/rpg）

判定：合格

差し戻し条件（必須機能の欠落／外部アセット・CDN 使用／1周の流れが通らない）のいずれにも該当しない。
ただし静的読解のみで、ブラウザ実行・コンソールエラー確認・`npm run smoke -- rpg` は未実施（監査役は実行手段を持たない）。手触りと約30分の長さも未確認。manager 側で smoke と実プレイを確認すること。

照合元：`C:\dev\3DGAME-w1-rpg\docs\00_並列開発計画_3DGAME.md` の §6-W1、完了条件（全員共通）、CLAUDE.md の規約。対象：`C:\dev\3DGAME-w1-rpg\games\rpg\`

---

## 不一致（差し戻し対象）

なし。

---

## 必須機能の判定（§6-W1）

| 項目 | 判定 | 根拠（games/rpg/ 内） |
|---|---|---|
| 操作：WASD 移動 | あり | game.js:229-230 |
| 操作：マウスでカメラ | あり | game.js:285-287、camera.js:12-16 |
| 操作：左クリック攻撃（3段コンボ） | あり | game.js:236、player.js:108-121、data/levels.js:38-42 |
| 操作：Space 回避（無敵あり） | あり | game.js:237、player.js:79-86、data/levels.js:31-32 |
| 操作：Q/E スキル | あり | game.js:238-239、player.js:90-107、data/levels.js:21-24 |
| 操作：F 話す・調べる | あり | game.js:240、area.js:95-107 |
| 操作：Tab メニュー | あり | game.js:241,252、ui/menu.js:9-77 |
| マップ3エリア（村・草原・ダンジョン） | あり | data/areas.js:4-77、world/village.js、world/field.js、world/dungeon.js |
| エリア間のゲート遷移 | あり | area.js:81-94（ゲート判定・遷移開始）、game.js:128-132、game.js:289-303（暗転） |
| 村：NPC・店・宿屋 | あり | data/areas.js:13-20（NPC 6人）、ui/dialog.js:89-158（店）、actions.js:101-114（宿屋） |
| 草原：雑魚敵 | あり | data/areas.js:43-48（18体）、data/areas.js:49（薬草12か所） |
| ダンジョン：仕掛け1つ | あり | レバー3本で奥の扉が開く。dungeon.js:81-116（レバー）、dungeon.js:74（扉の初期状態）、dungeon.js:101-107（3本揃うと開く） |
| ダンジョン：ボス部屋 | あり | data/areas.js:75（boss）、area.js:110-116（入室で戦闘開始・扉を閉じる） |
| 戦闘：リアルタイム | あり | game.js:249-269（step）、game.js:271-315 |
| 敵：近接 | あり | スライム・ガイコツ兵：data/enemies.js:7-11, 26-31。AI は enemies.js:138-145、予備動作は enemies.js:163-171 |
| 敵：遠距離 | あり | ゴブリン弓兵・亡霊術師：data/enemies.js:13-18, 32-37。AI は enemies.js:141-145、射撃は enemies.js:172-179 |
| 敵：突進 | あり | 突進イノシシ・岩ゴーレム：data/enemies.js:19-24, 38-43。AI は enemies.js:146-150、突進は enemies.js:187-208 |
| ボス：攻撃パターン3つ | あり | 薙ぎ払い boss.js:103-107 / 魔弾の輪 boss.js:113-120, 139-143 / 跳躍叩きつけ boss.js:105-106, 213-238。定義は data/enemies.js:51-55 |
| ボス：HP半分で行動変化 | あり | 発動 boss.js:38-40（takeHit で enrage）、enrage 処理 boss.js:61-73。怒り時の速度・予備動作の短縮 boss.js:58-59、手下召喚 boss.js:183-195、魔弾2波 boss.js:141、叩きつけ後の追加弾 boss.js:234。閾値は data/enemies.js:57（at: 0.5） |
| ボス：予備動作 | あり | 薙ぎ払い・叩きつけは地面の予兆 boss.js:103-107（sector）、boss.js:105-107（circle）。しゃがみ・腕上げ boss.js:197-217 |
| 成長：EXP・レベル（HP/攻撃/防御が伸びる） | あり | data/levels.js:3-18（statsAt）、state.js:59-75（gainExp、上がると全回復） |
| スキル2つ（MP消費・クールダウン） | あり | data/levels.js:21-24、player.js:188-200（trySkill） |
| 装備：武器3段階・防具3段階 | あり | data/items.js:4-15 |
| 装備：回復薬 | あり | data/items.js:19、actions.js:42-63（useItem）、game.js:242-243 |
| ショップで売買 | あり | data/items.js:27（SHOP_STOCK）、ui/dialog.js:89-158（buy / sell） |
| ドロップ（ゴールド・アイテム） | あり | enemies.js:56-57、data/enemies.js の drops・gold |
| クエスト：討伐 | あり | data/quests.js:5-9、questlog.js:19-29（onKill） |
| クエスト：収集 | あり | data/quests.js:10-14、questlog.js:6-15（gatherReady）、questlog.js:79-93（薬師）、actions.js:30-40（collectItem） |
| クエスト：ボス | あり | data/quests.js:15-19、questlog.js:64-77（村長）、game.js:167-194（onBossDefeated） |
| NPC 会話はウィンドウ表示 | あり | ui/dialog.js:40-62（talk）、ui/dialog.js:65-86（choice） |
| HUD に進行状況 | あり | questlog.js:98-113（questLines）、ui/hudview.js:50-52 |
| セーブ：宿屋 | あり | actions.js:101-114（stay）、actions.js:86-93（宿屋の選択肢） |
| セーブ：自動 | あり | game.js:68-79（autosave）、game.js:264-268（45秒ごと）、game.js:298、game.js:161 |
| セーブ内容（レベル・装備・所持品・クエスト・位置） | あり | state.js:12-30（level, exp, hp, mp, gold, items, weapons, armors, weapon, armor, quests, area, x, z, dungeon, stats） |
| タイトルに「つづきから」 | あり | game.js:213-223（title。onContinue は保存がある時だけ） |
| HUD：HP/MP バー・レベル・ゴールド | あり | ui/hudview.js:45-77 |
| HUD：ミニマップ | あり | ui/hudview.js:79-137（右下 canvas）、ui/hudview.js:110-120（敵・ボス） |
| HUD：敵の頭上 HP | あり | ui/bars.js:1-43、enemies.js:249 |
| 全滅：村に戻りゴールド減 | あり | game.js:143-165（finishDown。30%減）、game.js:155-160（村の respawn へ）、data/levels.js:48、data/areas.js:11 |

---

## 1周の流れ（コードの経路を追跡）

1. タイトル：game.js:212-224（showTitle）。操作説明は game.js:26-32（CONTROLS）。「はじめる」「つづきから」は game.js:221-222。shared/ui.js:106-117 で表示。
2. 開始：game.js:197-210（begin）。村へ入る。
3. 村長から討伐を受注：questlog.js:64-66 → accept（questlog.js:47-53）。
4. 草原で10体討伐：questlog.js:19-29（onKill）。草原へのゲートは data/areas.js:12。
5. 村長に報告：questlog.js:67-73（報酬＋ボス討伐を受注）。
6. 魔窟ゲートの解禁：area.js:84（gateOpen）、data/areas.js:41（requires: 'boss'）。
7. レバー3本で扉が開く：dungeon.js:81-116、dungeon.js:101-107。ボス部屋へは area.js:110-116 で入室判定し戦闘開始。
8. ボス撃破：boss.js:258-261 → game.js:167-194（onBossDefeated）。リザルトは ui.js:158-165（「はじめから遊ぶ」＋「ハブへ戻る」）。
9. 全滅：game.js:135-141（onPlayerDown）→ game.js:143-165（finishDown）。リザルトは「村で目覚める」（ui.js:158-165）。
10. Esc ポーズ：game.js:273-281（Esc で pause / 再度 Esc で再開）。ポインタロック解除（ブラウザの Esc）でも自動ポーズ：game.js:89-98。ポーズ画面は ui.js:133-151（「つづける」「ハブへ戻る」）。Esc の操作説明は game.js:31。

いずれもコード上の経路は通る。ただし実行確認はしていない。

---

## 外部アセット・CDN

- 使用なし。
- `games/rpg/` 全体で `http://` `https://` の読み込みは 0 件。
- 画像・音声・モデルファイルは 0 件（拡張子は .js / .json / .html / .md のみ）。
- import は `three`（area.js:2 ほか）と `/shared/*`（game.js:3-7、ui/hudview.js:3）だけ。`three/addons` は未使用。
- index.html の importmap は `three` と `three/addons/` のみ（index.html:7-9）。script は `./main.js`（index.html:72）。

---

## 制約

- データ分離：`src/data/` に enemies.js / items.js / quests.js / dialogs.js / areas.js / levels.js がある。処理側（enemies.js、boss.js、questlog.js、ui/dialog.js、state.js）はこれを読むだけ。
- 400行目安：超過 0 件。最大は game.js 342 行、enemies.js 287 行、boss.js 285 行、models.js 263 行、player.js 234 行、effects.js 223 行。
- main.js は 4 行（import と createGame() の呼び出しだけ）。起動のみ。

---

## 指摘（差し戻し不要）

1. 検証範囲：静的読解のみ。ブラウザ実行、コンソールエラー 0、`npm run smoke -- rpg` は未確認。
2. データ外のハードコード（データ分離がわずかに漏れている）：
   - dungeon.js:134 の宝箱取得文「魔力水×2・回復薬×2」は、data/areas.js:69 の chest.items から生成していない。
   - boss.js:141（2波目の遅延 0.45）、boss.js:188-189（手下の出現位置）、enemies.js:109-112（索敵倍率 1.8、リーシュ距離 28）、player.js:137,143（スピンの判定時間 0.15 / 0.5）は data 側に出すとよい。
3. 式の誤り（軽微）：player.js:121 の `c.mult * (p.combo === 2 ? 1 : 1)` は常に `c.mult`。意味がなく、紛らわしい。
4. 毎フレームの new（軽微）：game.js:232 の readIntent() で emptyIntent() を毎フレーム生成。game.js:258 でも非操作プレイヤー分を毎フレーム生成。CLAUDE.md「毎フレームの new を避ける」に反する。
5. dispose 漏れ（軽微）：pickups.js:11,20（金貨・素材の material）、projectiles.js:9,13,18-25（弾の geometry・material）、effects.js:76-91（予兆の geometry キャッシュ）は解放されない。全体で一度だけ作られるものが多く、影響は小さい。
6. ボス「魔弾の輪」の予備動作が弱い：boss.js:108-110 は中心に半径3mの円とポーズだけ。弾の放射方向や怒り時の2波目（boss.js:141）は予告されない。「予備動作を見せて避けられる」は満たすが、手触りで不足を感じる可能性がある。
7. デバッグ用フック：game.js:336-340 の `?debug` で `window.rpg` を公開し、自動ポーズを無効化する。README.md:54 に記載済み。リリース前に外してよい。
8. 未保存の進行：shared の「ハブへ戻る」（ui.js:137,162）は保存せず遷移する。最後の自動セーブ以降の進行は失われる。仕様上の要件はないが、遊び手には注意が要る。

---

## 確認できた項目（まとめ）

- §6-W1 の必須機能は、敵3種（近接・遠距離・突進）、ボス（攻撃3パターン・HP50%で行動変化・予備動作）、クエスト3本（討伐・収集・ボス）、ダンジョン仕掛け（レバー3本）、セーブ内容、全滅時の村送りとゴールド減まで、すべてコードで確認できた。
- 外部アセット・CDN の使用はない。
- 1周（タイトル→プレイ→結果→リトライ／ハブ）と Esc ポーズの経路はコード上で通る。
- データは src/data/ に分離。400行超えのファイルはない。main.js は起動のみ。
- 未確認：実ブラウザでの動作、コンソールエラー 0、smoke 通過、30分前後の長さ、手触り。
