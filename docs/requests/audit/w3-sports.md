# 監査レポート：w3-sports（games/sports/）

対象：C:\dev\3DGAME-w3-sports（ブランチ feat/w3-sports、最新 13ebcb8）
照合元：docs/00_並列開発計画_3DGAME.md §6-W3、完了条件（全員共通）、CLAUDE.md、shared/README.md
方法：静的確認（全ファイルを読み、import 名の解決と外部参照を grep で確認）。ブラウザ実行と `npm run smoke` は本監査では未実施。

## 判定：合格

差し戻し事由（必須機能の欠落／外部アセット・CDN 使用／1周の流れが通らない）は見つからなかった。

## 不一致の一覧（重要度順）

差し戻しに該当するものはなし。以下は差し戻し不要の指摘。

1. **1ファイル400行目安の超過（軽微）**：`src/baseball/game.js` が 402 行（Read 表示で末尾に空行あり、実質 401 行）。他のファイルはすべて 400 行以下（最大は `src/archery/game.js` の 363 行）。
2. **毎フレームの new（軽微、CLAUDE.md 規約）**：
   - `src/baseball/game.js:69-86` `readInput()` が毎フレーム新しいオブジェクトを返す
   - `src/baseball/pitchui.js:56-58` `drain()` が毎フレーム新しい配列を返す（`splice`）
   - `src/archery/game.js:95-100` `readInput()` が毎フレーム新しいオブジェクトを返す
   - `src/tennis/shots.js:33-41` `readTennisInput()` が毎フレーム新しいオブジェクトを返す
   - 描画・計算の本体は既存の Vector3 を再利用しており、フレーム毎のジオメトリ生成はない。ホットパスの GC 負荷は小さいと見られる。
3. **操作説明の文言（軽微）**：`src/core/app.js:26` の「投球：1/2/3 で球種、マウスでコース、クリックで投球」は、実装（右下パネルの 3×3 マスをクリック、`src/baseball/pitchui.js:40-50`）と表現がずれている。ゲーム内 HUD（`src/baseball/game.js:271-272`）の文言は正しい。
4. **データと処理の分離（任意）**：球種定義 `PITCHES`（`src/baseball/pitch.js:7-11`）は処理ファイル内にある。§6-W3 の制約では `src/data/` 分離は求められていない（§6-W1/W2 の制約）ため、差し戻しの対象ではない。
5. **検証の未実施**：ブラウザでのコンソールエラー 0、`npm run smoke -- sports` は本監査では未実行。モジュール間の import 名はすべて export と一致していることを静的に確認済み（`src/core/app.js` ほか全件）。実行確認は manager 側で行うこと。
6. **決めたことの妥当性（指摘なし、確認結果）**：下記「確認できた項目」の README「決めたこと」欄を参照。仕様の必須項目を欠落させる簡略化はなかった。

## 確認できた項目

### 共通（§6-W3 必須機能（共通））

- **競技選択→難易度→試合→結果→再戦／競技選択：あり**
  - 競技選択：`src/core/menu.js:69-81`（`showSportMenu`）、戦績表示は `menu.js:74`
  - 難易度：`src/core/menu.js:87-116`（`showDifficulty`）、`src/core/app.js:63-79`
  - 試合開始：`src/core/app.js:82-100`
  - 結果：`src/core/app.js:103-132`（`finishMatch`）、`src/core/app.js:129-130` で「再戦する」「競技選択へ」、`shared/ui.js:162` で「ハブへ戻る」
- **難易度3段階（やさしい・ふつう・つよい）：あり**
  - `src/core/difficulty.js:3-66`（`DIFFICULTIES` と `DIFF_KEYS`）
  - 競技ごとの係数：テニス（`tennisSpeed` `tennisReact` `tennisError` `tennisAim` `tennisPace`）、野球（`pitchSpeed` `batContact` `batPower` `batChase` `batRead` など）、アーチェリー（`archAim` `archComp` `wind`）
- **戦績の保存とメニュー表示：あり**
  - 保存：`src/core/records.js:12-56`、キーは `shared/save.js:7` の `3dgame:sports`
  - 競技別の勝・敗・分、ベスト：`records.js:10`、`add` は `records.js:37-48`
  - メニュー表示：`records.js:50-54` の `summary` を `menu.js:74` で表示
- **共通処理の分割（core/ と各競技）：あり**
  - `src/core/` に app・menu・scoreboard・director・difficulty・records・fx・sound・env・backdrop
  - `src/tennis/`（court・physics・shots・game）、`src/baseball/`（field・pitch・outcome・pitchui・view・game）、`src/archery/`（range・game）

### テニス：あり

- 後方視点：`src/tennis/game.js:204-211`（`camPos` と `camLook`）
- WASD 移動：`src/tennis/shots.js:35-36`、移動処理 `shots.js:47-59`
- Space ショットのタイミングで強さ：`shots.js:77-80`（打点距離から品質 `q`）、`shots.js:93-112`（`playerShot`、`q` で速さとブレを決定）
- 方向キーで左右打ち分け：`shots.js:39`（`dir`）、`shots.js:100`（`tx = dir * rand(3.0, 4.4)`）
- Shift ロブ：`shots.js:38`（`lob`）、`shots.js:101-102`（ロブの軌道）
- サーブ（トス→打点）：`shots.js:61-73`、`game.js:70`（案内文）、`shots.js:23`（サーブはノーバウンドで返せない）
- バウンド・ネット・アウト判定：`src/tennis/physics.js:26-34`（ネット）、`physics.js:40-51`（着地）、`game.js:166-202`（`judge`：ネット・アウト・ツーバウンド）
- 4ポイント先取で1ゲーム、3ゲーム先取で勝ち：`game.js:147-158`
- CPU の難易度差：移動速度 `shots.js:213`、反応 `shots.js:166`、ミス率 `shots.js:135`、狙いのブレ `shots.js:149-151`、見送り `shots.js:201`

### 野球：あり

- 3イニング制、表裏の攻守交代：`src/baseball/game.js:14`（`INNINGS = 3`）、`game.js:215-237`（`next`）、攻守の表示 `game.js:88-105`（`startHalf`）
- 最終回表終了時のリード判定：`game.js:222-223`、サヨナラ：`game.js:216-217`
- 打撃（マウスでバット位置、クリックでスイング）：`game.js:69-86`（`readInput`）、`game.js:311-327`（接触判定と打球の生成）
- タイミングと芯のズレ：`game.js:315-326`（`err` と `dist` から速さ・角度・方向を算出）
- 判定（アウト・ヒット・二塁打・ホームラン・ファウル）：`src/baseball/outcome.js:46-99`（`judgeBatted`）。ファウルは `outcome.js:47-49`、ホームランは `outcome.js:59-61`、二塁打は `outcome.js:97-98`、野手との距離による判定は `outcome.js:63-96`
- ランナー表示：`src/baseball/view.js:108-116`（3D）、`game.js:261-266`（スコアボードの塁表示）
- 自動進塁：`src/baseball/outcome.js:107-131`（`advance`）、`game.js:153`（四球）、`game.js:191-201`
- 投球（球種3・コース9分割）：`src/baseball/pitch.js:7-11`（`PITCHES`）、`pitch.js:14-20`（`cellCenter`）、`src/baseball/pitchui.js:40-50`（3×3 パネル）、`game.js:287-289`
- CPU 打者の難易度と配球の読み：`pitch.js:82-99`（`createReader` の傾向学習）、`pitch.js:104-121`（`cpuBat`、`read` によるボーナス）、`game.js:116-119`
- S/B/O カウントとスコアボード：`game.js:138-160`（`call`）、`game.js:263-267`（`board`）

### アーチェリー：あり

- 一人称：`src/archery/game.js:307-313`（視点を `EYE` に置き、弓は右下に配置）、`range.js:7`（`EYE`）
- マウスで狙い：`game.js:95-99`（`readInput`）、`game.js:190-191`（`aim.yaw` と `aim.pitch`）
- 長押しで引き絞り、離して発射：`game.js:192-205`
- 引くほど・長く構えるほど手ブレ：`game.js:207-209`（`amp` は `draw` と `hold` の関数）
- 風（向き・強さを表示、毎射変化）：`game.js:59-62`（`newWind`、`beginTurn` から毎射呼ぶ `game.js:82`）、表示は `game.js:323-326`
- 風と重力で矢が流れる：`game.js:221-223`（`G` と `wind`）
- 5射×3ラウンド：`game.js:11`（`SHOTS = 5`）、`game.js:159-181`（`nextTurn`）、`game.js:169`（3ラウンド）
- ラウンドごとに的が遠くなる（18m→28m→40m）：`game.js:10`（`DIST`）、`game.js:68-79`（`startRound`）
- CPU 対戦：`game.js:85-87`、`game.js:113-124`（`cpuShoot`、重力と風を見越して狙う）
- 同一PC 2人交代：`game.js:31`（`pvp`）、`game.js:34-35`（プレイヤー1・2）、`game.js:81-92`（手番の表示）、`src/core/menu.js:99-107`（対戦モードの選択）、`game.js:259-269`（2人対戦は勝敗に数えない）

### README「決めたこと」の判断

- テニス：デュースなし（4ポイント先取）は §6-W3 の「4ポイント先取で1ゲーム」と矛盾しない。サーブのノーバウンド返球不可は `shots.js:23` のとおり。判断は妥当。
- 野球：1イニング5点でチェンジ（`game.js:15`、`game.js:218`）は必須項目（3イニング制、表裏攻守交代）を欠落させない。三塁打なし（長打はツーベース、`outcome.js:97-98`）は必須の「二塁打」を満たす。併殺なしは必須外。走者の進塁規則（`outcome.js:101-131`）は自動進塁の要件を満たす。判断は妥当。
- アーチェリー：2人対戦を勝敗に数えないのは仕様外の扱いで、記録処理（`game.js:259-269`、`records.js:37-48` の `outcome: null`）と整合。判断は妥当。

### 1周の流れ・操作

- タイトル（操作説明）：`src/core/app.js:22-29`（`CONTROLS`）、`app.js:159-165`（`showTitle`、`shared/ui.js:106-117`）
- 競技選択→難易度→試合→結果：上記「共通」のとおり
- リザルトからの経路：再戦（`app.js:129`）、競技選択へ（`app.js:130`）、ハブへ戻る（`shared/ui.js:162`、`location.href='/'`）
- Esc ポーズ：`app.js:149`（検知）、`app.js:134-145`（`togglePause`）、ポーズ画面 `shared/ui.js:133-146`（つづける・最初から・ハブへ戻る）
- 常設のハブへ戻るリンク：`shared/ui.js:52-56`
- M でミュート：`app.js:148`
- 3競技すべてが最後まで遊べる：テニスは3ゲーム先取で終了（`game.js:151-158`、`game.js:274-288`）、野球は3イニング終了で終了（`game.js:217-230`、`game.js:352-364`）、アーチェリーは3ラウンド終了で終了（`game.js:169-176`、`game.js:244-269`）

### 制約・規約

- `main.js` は起動のみ：`games/sports/main.js:1-4`（`boot()` を呼ぶだけ）
- 外部アセット・CDN なし：`games/sports/` 全体を grep（`https?://`、画像・音声・モデル拡張子、`TextureLoader`、`fetch`、`Audio(`、`GLTFLoader` など）。ヒットなし。
- three 以外の import なし：`three`（`src/**` 内の全ファイル）と `/shared/*`（`src/core/app.js:3-6`、`menu.js:2`、`records.js:2`、`tennis/game.js:4`、`archery/game.js:4`、`baseball/game.js:4`）のみ。`/shared/*` は共通部品で、CDN ではない。
- importmap は `/vendor/three` を向く：`games/sports/index.html:8`
- 1ファイル400行目安：超過は `src/baseball/game.js`（402 行）のみ。他はすべて 400 行以下。行数は `src/archery/game.js` 363、`src/tennis/game.js` 309、`src/baseball/outcome.js` 131、`src/baseball/view.js` 129、`src/tennis/court.js` 128、`src/tennis/physics.js` 124、`src/baseball/pitch.js` 121、`src/core/env.js` 177、`src/core/app.js` 166、`src/archery/range.js` 158 など。
- 共通の dispose・掃除：`clearGame()`（`app.js:46-55`）が `game.dispose()` を呼び、各競技は `disposeTree(group)` で解放（`tennis/game.js:305-307`、`baseball/game.js:396-399`、`archery/game.js:358-361`）。アーチェリーの矢は `archery/game.js:70-73` で解放。
- セーブは `shared/save.js` 経由：`records.js:13-14`

## 補足

- 本監査は静的確認のみ。コンソールエラー 0 とスモークテストは manager 側で `npm run smoke -- sports` とブラウザ確認を行うこと。
- 所有権違反は本監査の対象外（manager が git で確認）。
