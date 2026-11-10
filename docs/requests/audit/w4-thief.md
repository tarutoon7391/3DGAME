# 監査レポート：w4-thief（games/thief/）

判定：合格

対象：C:\dev\3DGAME-w4-thief（feat/w4-thief、最新 cdf2b2a）／照合元：docs/00_並列開発計画_3DGAME.md §6-W4 と完了条件（全員共通）、CLAUDE.md
方法：静的確認のみ（ファイルの読み取りと grep）。ブラウザ実行と `npm run smoke` は未実施。

---

## 1. 差し戻し理由

なし。「必須機能の欠落」「外部アセット・CDN 使用」「1周の流れが通らない」のいずれも確認されなかった。

---

## 2. §6-W4 必須機能の判定

| 項目 | 判定 | 根拠（games/thief/ 内） |
|---|---|---|
| 視点：斜め見下ろし三人称、Q/E 回転、ホイールズーム | あり | view.js:22-24（Q/E で yaw、wheel で dist）、config.js:49（VIEW） |
| WASD 移動 | あり | app.js:142-145 |
| Shift 走る（足音大） | あり | app.js:146、player.js:91、config.js:16（noise.run 8.5） |
| Ctrl または C しゃがみ（遅い・静か） | あり | app.js:147-148、app.js:158（C は切替、Ctrl は押下中）、config.js:14, 16 |
| F：盗む・隠れる・開ける | あり | app.js:159、session.js:106-143（act）、session.js:91-100（hintFor） |
| 1/2 ガジェット | あり | app.js:160-161 |
| 警備員 巡回 | あり | guards.js:218-233（patrol、route・wait は stage データ） |
| 警備員 不審（音・一瞬の視認） | あり | guards.js:154-160（hear）、guards.js:203-205（視認で suspicious） |
| 警備員 調査 | あり | guards.js:236-240（suspicious → investigate → goTo） |
| 警備員 追跡 | あり | guards.js:241-272（chase） |
| 警備員 見失うと捜索 → 巡回復帰 | あり | guards.js:258-270（lost → search）、guards.js:273-296（search → patrol） |
| 視野コーンを床に表示 | あり | cone.js:7-42、guards.js:309 |
| 壁越しには見えない（レイキャスト） | あり | guards.js:144-145（煙・grid.los）、cone.js:32（DDA で各レイを切る）、grid.js:65-100 |
| 警戒ゲージ満タンで発見 | あり | guards.js:193-202（gauge >= 1 で chase と detect イベント） |
| 監視カメラ（首振り・視野表示） | あり | security.js:35（sweep）、security.js:58-63（cone 表示）、security.js:9-67 |
| レーザー 常時／点滅／移動 | あり | security.js:120-128（blink・move）、security.js:123（always）、security.js:69-149 |
| 圧力床 | あり | session.js:191-195、level.js:180-189 |
| 鍵付き扉とカードキー | あり | session.js:98, 133-137（D は鍵が必要）、session.js:144-151（pickKey）、level.js:146-156 |
| 隠れ場所：ロッカー | あり | session.js:127-131（hide）、player.js:59-70（hide/unhide）、guards.js:171-172, 243-249（見られたまま入ると引きずり出し） |
| 隠れ場所：展示台の陰 | あり | session.js:49（しゃがみ＋LOW 隣接で COVER_VIS）、grid.js:99（しゃがみ時は LOW も視線を遮る）、config.js:47 |
| 物陰で見つかりにくい | あり | session.js:48（SHADOW_VIS）、level.js:240-242（isShadow）、config.js:46 |
| ガジェット：おとりコイン（投げた地点へ誘導） | あり | gadgets.js:50-58（throwCoin）、session.js:172-178、session.js:210-214（着地で noise）、guards.js:153-160 |
| ガジェット：煙玉（数秒間視界を遮る） | あり | gadgets.js:6（SMOKE_TIME 6 秒）、gadgets.js:59-64, 66-93、session.js:179-186、guards.js:144、security.js:44、cone.js:33 |
| ガジェットの回数制限 | あり | session.js:33-34（stage.gadgets）、session.js:173-185（残数 0 で不発） |
| メインのお宝（必須）＋サブ（任意）→ 出口で脱出 | あり | session.js:37, 115-120（treasure）、session.js:196-199（exit は mainTaken が条件） |
| 捕まるとステージ最初から | あり | session.js:232-236（catch → caught）、app.js:126-134（つかまった…／onRetry = startStage(i)） |
| 評価：発見回数・クリア時間・回収率で S〜C | あり | rank.js:7-13（calcRank）、app.js:108-112 |
| ステージ別ベストを保存 | あり | rank.js:4, 16-28（shared/save.js の createSave('thief')、キー 3dgame:thief）、app.js:113 |
| ステージ選択画面 | あり | screens.js:70-110（showStageSelect）、app.js:80-86（openSelect） |
| 演出：発見時の「！」と警報 | あり | guards.js:33（alert icon）、guards.js:311-315、fx.js:64、session.js:221-229（sfx.alarm、alarmFlash）、app.js:205 |
| 演出：暗い館内のスポットライト | あり | level.js:202-216（SpotLight）、app.js:36-39（暗い背景・フォグ）、guards.js:29（警備員の懐中電灯） |
| 演出：足音の波紋 | あり | session.js:165-170（onStep で ripple）、session.js:248-251（警備員の波紋）、fx.js:72-81 |

必須機能は全項目「あり」。「一部」「なし」はなし。

---

## 3. 1周の流れ（コードで確認）

| 段階 | 根拠 | 判定 |
|---|---|---|
| タイトル（操作説明） | app.js:15-25（CONTROLS）、app.js:88-97（openTitle → showTitle の controls）、ui.js:106-117 | 通る |
| ステージ選択 | app.js:80-86（openSelect）、screens.js:70-110、ui.js の「タイトルへ」は screens.js:96-104 | 通る |
| プレイ開始 | app.js:70-78（startStage → load → playing=true） | 通る |
| プレイ中の更新 | app.js:199-211（session.update、phase !== 'play' で finish） | 通る |
| リザルト（クリア） | app.js:99-125（脱出成功・ランク・回収率・ベスト更新）、ui.js:158-165 | 通る |
| リザルト（捕まり） | app.js:126-135（つかまった…、ステージ最初から） | 通る |
| リトライ | app.js:123, 132（onRetry → startStage） | 通る |
| 次のステージ／ステージ選択 | app.js:104, 114（extra ボタン） | 通る |
| ハブへ戻る | ui.js:162（リザルトの「ハブへ戻る」→ location.href='/'）、ui.js:52-56（常設の「← ハブへ戻る」リンク） | 通る |
| Esc ポーズ | app.js:195-198（Esc で showPause／hidePause）、ui.js:133-140（つづける／最初から／ハブへ戻る） | 通る |
| 操作説明の常時参照 | app.js:23（ヒントの文言）、screens.js:6-14, 85-87（ステージ選択の説明） | 通る |

main.js は起動だけ（main.js:1-4）。`window.__thief` は `?debug` 時のみ（app.js:189-191）。

---

## 4. 制約

| 項目 | 判定 | 根拠 |
|---|---|---|
| ステージは src/stages/ のタイルマップ＋配置データ | あり | stage1.js:3-40、stage2.js:2-43、stage3.js:2-48（map と guards、cameras、lasers、lights、tips、treasureNames）、凡例は grid.js:5-13 |
| コードを触らず追加できる | 一部 | 定義ファイルの追加だけでは足りず、stages/index.js:2-6 に import と配列への登録が必要。stages/README.md:3 は「配列に足すだけ」と書いている。詳細は 5-A |
| マップの行の長さが揃っている | あり | stage1 13行×18列、stage2 15行×22列、stage3 17行×26列を grep で確認 |
| ステージ1：チュートリアル（警備員1・カメラ1） | あり | stage1.js:24-26（guards 1 件）、stage1.js:27-29（cameras 1 件）、stage1.js:32-40（tips 7 件） |
| ステージ3：全要素 | あり | 警備員4（stage3.js:27-32）、カメラ3（stage3.js:33-37）、レーザー3種 always／blink／move（stage3.js:38-43）、圧力床 `=`（stage3.js:16）、カードキー K（stage3.js:16）、鍵付き扉 D（stage3.js:14, 16）、ロッカー L（stage3.js:13, 18）、展示台 S、物陰 `,`、サブのお宝 3 種（stage3.js:26） |
| ステージ2 | あり | 警備員2、カメラ2、レーザー3（blink 2・always 1）、圧力床、鍵付き扉（stage2.js:25-42） |
| 1ファイル400行目安 | あり | 最大は guards.js 325 行、次が session.js 284 行、level.js 273 行。400 行超えはなし |
| main.js は起動だけ | あり | main.js 4 行（import 1 行と boot() の呼び出し） |
| データの分離 | あり | 定数は config.js（PLAYER、GUARD、CAM、VIEW など）。ステージ値は stages/*.js |
| 外部アセット・CDN 不使用 | あり | 下記 5 章 |
| 所有権 | 対象外 | manager が git で確認する |

---

## 5. 指摘（差し戻し不要）

**A. ステージ追加に index.js の編集が必要（制約の一部不一致、重要度：中）**
- 場所：stages/index.js:2-6（import 文と配列への登録）、stages/README.md:3
- 内容：README は「stageN.js を作って配列に足すだけ」「ゲーム本体のコード変更は不要」と書いているが、実際には index.js の編集が必要。§6-W4 の「コードを触らず追加できる形」とは厳密には一致しない。
- 推奨：次回以降に直すなら、index.js の一箇所だけで済む形（manifest 的なデータ化など）にする。ただし今回は差し戻しの対象外。

**B. 毎フレームの小さな new（軽微）**
- app.js:139-163：readIntent が毎フレーム新しいオブジェクトを返す。app.js:200 でも `const intents = []` を毎フレーム作る。
- session.js:201-207：tips の forEach が毎フレーム閉包を作る。
- CLAUDE.md「毎フレームの new を避ける」に対しては軽微。ゲーム性には影響しない。

**C. 検証の限界**
- ブラウザ実行、コンソールエラーの実測、`npm run smoke -- thief` は未実施（この監査環境では実行できない）。
- 静的確認では、import・export の対応（ui.js、engine.js、input.js、audio.js、save.js、config.js）はすべて一致していた。
- 手触り（警備員の反応の速さ、ステージ難度）は人間が公開URLで確認する必要がある。

---

## 6. 確認できた項目（まとめ）

- 必須機能 §6-W4 は全項目あり（2章）
- 1周の流れは、タイトル→ステージ選択→プレイ→リザルト→リトライ／次のステージ／ステージ選択／ハブへ戻る まで通る。Esc ポーズもある（3章）
- 外部アセット・CDN：games/thief/ 内に http(s)://、画像・音声・モデル・フォントの読み込みはなし。url()、@import もなし。index.html の importmap は /vendor/three/ のローカル配信のみ。import は `three` と `/shared/*`（共通部品）と相対パスだけ
- 1ファイル400行超えなし（最大 guards.js 325 行）。main.js は 4 行
- ステージ1 はチュートリアル（警備員1・カメラ1）。ステージ3 は全要素
- ベスト保存は shared/save.js 経由（キー 3dgame:thief）
- 通常プレイに影響しない ?debug フック
