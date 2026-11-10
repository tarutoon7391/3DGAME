# w1-rpg 改良版（v2）監査

判定：合格（条件付き）

条件：`npm run smoke` とコンソールエラー 0 は監査者が実行できなかったため未確認。マネージャーが `npm run smoke -- rpg` と実機のコンソール確認を行うこと。静的に見た範囲では、人間の改良要望 13 項目はすべて対応しており、差し戻しに当たる不具合は見つからなかった。

## 監査範囲と方法

- 対象：`C:\dev\3DGAME-w1-rpg\games\rpg\`（ブランチ feat/w1-rpg、コミット 796b7e1 と 62b0118）
- 比較元：`C:\dev\3DGAME\games\rpg\`（改良前の M4 版）。旧値はここから読んだ
- 制約：この監査役には実行手段（Bash・Node）がないため、ゲームの起動・smoke・コンソール確認はしていない。git のファイル単位の差分も取れなかった（reflog でコミット名のみ確認）。コードは一切編集していない
- 確認は grep（level / exp / mp / gold / potion / quest / shop / inn / lever ほか）と全 .js・index.html・README の通読による

## 不一致の一覧（重要度順）

1. 【確認必要・中】完了条件の未確認。`npm run smoke` とコンソールエラー 0 は未実行。
2. 【確認必要・中】ボスの魔弾（`ring`）1発が 40 ダメージ。改良前は約 25（`BOSS.atk 30 × mult 0.9 − def/2`、旧 `src/combat.js:7`、旧 `src/data/enemies.js:53`）。ボスの薙ぎ払い・跳躍は旧約 36・約 45 から 40 に統一されている。要望 2（旧 Lv4 くらい）と要望 13（1撃 1/3）は満たすが、魔弾は 14 発撃つうえ 1 発あたりの重みが旧比で約 1.6 倍になる。意図どおりか人間が判断すること。
3. 【低】消し残し（表示ではなく名前のみ）。
   - `src/ui/hudview.js:66`：エリア名を `class="rpg-lv"` で出している（表示は area 名で、レベルではない）。
   - `index.html:14`：`.rpg-lv` の CSS。`index.html:15` の `.rpg-area` は未使用の CSS。
   - 改名または削除を推奨。
4. 【低】能力値のコメントと値が一致しない。`src/data/player.js:2` と `:6` は「旧 Lv4 相当」と書くが、`maxHp` は 120。旧 `statsAt(4).maxHp` は 128（旧 `src/data/levels.js:13`）。README:29 の「最大 HP 120」は意図した値なので、コメントの方を直すこと。
5. 【低】調整値が `src/data/` の外にある（CLAUDE.md の「調整用の数値は src/data」）。
   - `src/player.js:138`（攻撃中の移動倍率 0.2）、`:157`（回転斬り中 0.5）、`:66-67`（被弾ノックバック 7）、`:172`（ダッシュ粒子の確率 0.3）
   - `src/boss.js:172`（追跡の停止距離 4）、`:118`（魔弾の出現半径 2）
   - `src/enemies.js:180`（近接の突っ込み速度 6、時間 0.08）
6. 【低】毎フレームの new（規約「毎フレームの new を避ける」）。
   - `src/camera.js:27`：`toWorld` が毎フレーム `{x, z}` を返す（呼び出しは `src/game.js:223`）
   - `src/world/build.js:84`：`collide` 内で `grid.each(...)` の closure を毎回作る（プレイヤーと敵の全員が毎フレーム呼ぶ）
   - `src/projectiles.js:103`：波の当たり判定で `forEachTarget` の closure を毎フレーム作る
   - `src/player.js:172`：ダッシュ粒子の `burst` にオブジェクトリテラルを渡す（確率的に発生）
   - いずれも GC 負荷は小さい。頻度が高い `collide` と `toWorld` を先に直すとよい。

以上は重大な不具合ではない。全体として差し戻しの理由になるものはない。

## 要望 13 項目の判定

| # | 要望 | 判定 | 根拠（ファイル:行） |
|---|---|---|---|
| 1 | レベル・EXP の完全撤廃 | 対応（名前の残り 3 は上記 3） | `src/state.js:8-14`（進行データは `kills/deaths/time` のみ）。`src/data/` に `levels.js` なし。`src/game.js:37`（旧形式は到達エリアだけ移行）。`src/ui/hudview.js:66` は名前のみ |
| 2 | ボスの強さは旧 Lv4 程度 | 対応（要確認：不一致 2） | `src/data/enemies.js:61`（HP 1400・防御 8 は改良前と同じ）。`src/data/player.js:6`（攻撃 15 = 旧 Lv4 の 11 + 木の剣 4）。ボス攻撃 40 は `src/data/player.js:50` で `HIT.boss = 1/3`、`src/boss.js:118, 130, 230` |
| 3 | Shift でダッシュ・Space で回避 | 対応 | `src/game.js:229-230`（`dodge = Space`、`dash = ShiftLeft/Right`）。`src/player.js:96-106`（回避）、`:168`（ダッシュ）。操作説明は `src/game.js:23-26` と `games/rpg/meta.json` |
| 4 | スタミナゲージ・バテ | 対応 | `src/data/player.js:31-39`（STAMINA）。`src/player.js:72-81`（0 で `tired`）、`:93`（`canStamina` は tired でないこと）、`:176-177`（満タンで解除）、`:180`（移動 0.55 倍）。HUD は `src/ui/hudview.js:64-68` |
| 5 | 回復薬の削除 | 対応 | `src/data/` に items なし。回復の入力・UI なし（grep 0 件）。`README.md:32` に「回復薬はない」 |
| 6 | 雑魚の1撃 1/4、速さ・頻度アップ | 対応 | `src/data/player.js:49`（`HIT.enemy = 1/4`）→ `src/combat.js:65`（`ceil(120 × 0.25) = 30`）。速さは旧比 ×1.3（`src/data/enemies.js:10` slime 2.6→3.4、`:15` goblin 3.0→3.9、`:20` boar 2.8→3.6）。予備動作は windup 0.7→0.55（`:10`）。攻撃間隔は `AI.meleeCd [0.25, 0.6]`（`:48`、旧 `src/enemies.js:215` は 0.4〜1.0）。弓兵の cooldown は 2.3→1.5（`:16`） |
| 7 | クエスト全廃・ボス撃破でクリア | 対応 | クエスト関連ファイルなし。`src/game.js:162-186`（`onBossDefeated` でクリア）。`src/game.js:21`（タイトル） |
| 8 | ゴールド・経験値・ドロップ・店・売買の撤去 | 対応 | `src/data/enemies.js` に `exp/gold/drops` なし。`src/enemies.js:43-55`（`kill` は撃破数だけ数える）。pickups・店・宿・NPC のファイルなし |
| 9 | MP の削除 | 対応 | `src/data/player.js:41`（コメントのみ）、`:43-44`（SKILLS に `mp` なし） |
| 10 | スキルのクールタイムを少し長く | 対応 | `src/data/player.js:43`（回転斬り 4→5）、`:44`（衝撃波 6→7.5）。旧値は旧 `src/data/levels.js:22-23` |
| 11 | ステージ1・2 を入り組んだ迷路に、雑魚は多め | 対応 | `src/data/areas.js:24-54`（maze 設定）。`src/world/maze.js:10-36`（穴掘り法の完全迷路。ループなし）、`:124-165`（正解ルート上の結界と番人）、`:170-183`（脇道の雑魚）。雑魚数：ステージ1 は番人 8＋うろつき 12＝20、ステージ2 は番人 10＋うろつき 13＝23（旧草原は 18）。結界は `maze.js:146` で当たり判定に入り、`src/world/build.js:81-91` で通過を止める |
| 12 | 洞窟のレバーの撤廃 | 対応 | `src/world/dungeon.js:45-47`（扉は最初から開き、ボス部屋に入ると閉まる）。`src/data/areas.js:56-78`（レバー・宝箱なし）。`src/area.js:123-128` |
| 13 | ボスの1撃は最大 HP の 1/3 | 対応 | `src/data/player.js:50`（`HIT.boss = 1/3`）。`src/boss.js:130, 230`（薙ぎ払い・跳躍）、`:118`（魔弾）。`src/combat.js:65` で `ceil(120/3) = 40` |

## 共通の完了条件

| 項目 | 判定 | 根拠 |
|---|---|---|
| 外部アセット・CDN なし | 対応 | `https?://`、`fetch(`、`import(` は games/rpg に 0 件。音は `src/sound.js` と `shared/audio.js` の WebAudio。`index.html:8` の importmap は `/vendor/three` のローカル配信 |
| 全体の流れ（タイトル→プレイ→リザルト→リトライ／ハブ） | 対応 | タイトルは `src/game.js:202-214`（操作説明つき）。死亡は `:142-160`（「入口からやり直す」）。クリアは `:162-186`（「はじめから遊ぶ」）。どちらも `shared/ui.js:158-165` のリザルトに「ハブへ戻る」あり |
| Esc でポーズ | 対応 | `src/game.js:260-268`（Esc でポーズ・解除）、`:90-99`（ポインタロック解除＝自動ポーズ）。ポーズ画面に「ハブへ戻る」（`shared/ui.js:137`） |
| 操作説明 | 対応 | `src/game.js:21-28`（`CONTROLS`）。`README.md:7-18` |
| dispose | 対応 | 敵は `src/enemies.js:57-63`（個体の material を解放、共有 geometry はキャッシュ）。ボスは `src/boss.js:52-56`。エリアは `src/world/build.js:138-151`（group の geometry・InstancedMesh のバッファ・material を解放）。結界・ゲートは `src/world/maze.js:152`、`src/world/build.js:194` の `extraDispose` |
| InstancedMesh | 対応 | 壁は `src/world/maze.js:105-121`、木・岩は `src/world/build.js:51-67` と `src/world/maze.js:233-237`、パーティクルは `src/effects.js:10`、魔弾は `src/projectiles.js` のプール |
| セーブは shared/save.js | 対応 | `src/game.js:34`（`createSave('rpg')`、キー `3dgame:rpg`）、`:75-82`（到達エリアと記録だけ保存）、`:173`（クリアで progress を消す） |
| 旧セーブの移行 | 対応 | `src/state.js:20-33`（version 1 は村・草原・魔窟をステージ1・2・3へ写像）。`src/data/areas.js:86`（`OLD_AREA_MAP`）。旧の version 1 と村・草原・魔窟は改良前の `src/state.js:13,25` と `src/data/areas.js:5,33,54` で確認。未知の形式は `null`（つづきからを出さない） |
| エリアを進むと HP・スタミナ全回復 | 対応 | `src/area.js:43-73`（`loadArea` で `p.reset`）、`src/player.js:49-62`（HP と stamina を全快） |
| main.js は起動だけ | 対応 | `main.js` は 4 行（import と `createGame()`） |
| 1ファイル 400 行目安 | 対応 | 最長は `src/enemies.js` の 302 行、`src/game.js` の 325 行 |
| ES Modules・日本語コメント | 対応 | 全ファイルで確認 |
| 消し残し grep（level/exp/mp/gold/potion/quest/shop/inn/lever） | 概ね対応 | コードに残るのはコメントのみ（`src/state.js:18`、`src/game.js:37`、`src/world/dungeon.js:1,45`、`src/data/areas.js:56`、`src/data/player.js:2,6,41`、`src/data/enemies.js:58`）。表示上の残りは不一致 3 の名前のみ |
| 存在しない関数・変数の参照 | なし（静的確認） | `src/game.js` の import・`game.*` の参照（`fx`・`hudView`・`cam`・`lights`・`projectiles`・`enemies`・`sound`・`world`・`ui`）を通読で照合。`shared/ui.js` の export（`showTitle`・`showPause`・`hidePause`・`isPaused`・`showResult`・`toast`・`isOverlayOpen`・`hud`）、`shared/input.js`、`shared/audio.js` の API と一致 |

## 確認できた項目（要約）

- 13 項目の仕様はコード上で全て実装されている。旧データの移行も対応している。
- ステージ1・2 は完全迷路で、正解ルートは 1 本。結界の番人を全滅させないと出口に届かない。
- ステージ3 の構造（入口通路・柱の大広間・ボス部屋）は変わっていない。レバーと宝箱は撤去、扉は最初から開いている。
- 外部アセットは使っていない。ハブ・`server.js`・`shared/` の変更は、この監査では確認できていない（不一致 1 の差分の確認と合わせて、マネージャーが `git diff --stat 796b7e1^ HEAD -- ':!games/rpg'` で確認すること）。

## 未確認の項目

- `npm run smoke`、コンソールエラー 0、実際の操作感（ブラウザでの動作）
- コミット 796b7e1・62b0118 で games/rpg 外のファイルを変えていないこと（git 実行手段がないため）
