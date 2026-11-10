# 監査レポート：w5-farm（games/farm）

判定：合格

対象：C:\dev\3DGAME-w5-farm（feat/w5-farm、最新 2ae5261）／照合元：docs/00_並列開発計画_3DGAME.md §6-W5 と完了条件（全員共通）、CLAUDE.md
注：この監査はコード読解のみ。実行（smoke・ブラウザでのコンソールエラー確認・実プレイ）は未実施。下記「確認できなかった項目」を参照。

---

## 不一致（重要度順）

差し戻し事由（必須機能の欠落／外部アセット・CDN 使用／1周の流れが通らない）は**なし**。

---

## 指摘（差し戻し不要）

1. **バランス数値が src/data/ 外に残っている**（制約違反の軽微版）
   - `src/quests.js:38` 初回依頼「カブ3個・報酬220・EXP40」を直書き（data へ移す候補）
   - `src/quests.js:29` 依頼EXP の式 `20 + round(reward/12)` が直書き
   - `src/menus.js:59` 動物購入時の飼料 `addItem(state,'feed',5)` が直書き（toast の「飼料+5」も同じ数値）
   - `src/animals.js:163` 地面の生産物上限 `20`、`src/animals.js:123,131` なつき度上限 `100`
   - `src/actions.js:113,125` 道具が使えないときの消費 `spend(1)`
   - `src/data/balance.js:60,62` のショップ説明文（例 `'スタミナ +35'`）は items.js の eat 値と二重管理になっている。値を変えたときにずれる恐れ
2. **ポーズの「最初から」は確認なしで現在の進行を捨てる**（`src/game.js:285`, `shared/ui.js:136` の経路）。セーブは就寝時のみのため、前回就寝からの作業が失われる。UX 上の注意点として README に明記されているか要確認（README「決めたこと」には記載なし）。
3. **収穫の挙動が道具で揃っていない**（`src/actions.js:102,113-115`）。クワで複数マス（Lv2 以上）を使うと、正面の成熟作物より先に隣の未耕作マスを耕してしまい、その回は収穫されない（耕せる分が0のときだけ収穫）。README の「決めたこと」（クワのときは耕せない場合のみ収穫）と一致はしているが、体験としては取りこぼしに見える。
4. **「序盤10分で最初の収穫と出荷」**は未検証（推定では可能：カブ2日＋ベッドで早めに就寝）。実プレイで確認推奨。
5. **`game.js` が 316 行**で 400 行目安に近い。今後機能を足すなら分割（例：1日の流れ `endDay` / `showClear` の切り出し）を検討。
6. **`?debug` で `window.__farm` を出す口**（`src/game.js:296-303`）は README に明記済みで開発用。本番で露出するのは許容範囲だが、気になるなら外す。

---

## §6-W5 必須機能の判定

| # | 必須機能 | 判定 | 根拠（games/farm/ 内） |
|---|---|---|---|
| 1 | 斜め見下ろし三人称、カメラ追従 | あり | `src/game.js:24` CAM_OFFSET(0,11,8.5)、`:255-261` 追従と lookAt |
| 2 | WASD 移動（矢印も可） | あり | `src/game.js:200-205` readIntent、`src/player.js:72-79` |
| 3 | F／クリックで目の前のマスに道具 | あり | `src/game.js:208` (`KeyF`/`Mouse0`)、`src/actions.js:97-102` use()、`look()` は `:28-45` |
| 4 | 1〜5 で道具切替 | あり | `src/game.js:25,210`（Digit1〜5）、`src/game.js:225-228` setTool、3再押しでタネ切替 `:243-248` |
| 5 | Tab で持ち物 | あり | `src/game.js:211,229`、`src/menus.js:139-165` inventory |
| 6 | E で話す・店 | あり | `src/game.js:209,234`、`src/actions.js:178-196` interact()、interactables `src/world.js:242-248`（bed/ship/board/shop/well） |
| 7 | 耕す | あり | `src/actions.js:112-121`、`src/field.js:198-205` till() |
| 8 | 種まき | あり | `src/actions.js:134-150`、`src/field.js:215-222` plant() |
| 9 | 毎日水やり・水を忘れると成長しない | あり | 水やり `src/actions.js:122-133`、`src/field.js:206-214` water()、成長は `t.w` 必須 `src/field.js:250`、翌朝にリセット `:251` |
| 10 | 成長段階（3〜4段階で見た目変化） | あり | `src/field.js:15-22` stageOf()（0種/1芽/2成長中/3収穫可）、描画 `:98-137` |
| 11 | 収穫 | あり | `src/field.js:224-234` harvest()、`src/actions.js:73-82,102` |
| 12 | 作物6種（日数・売値・種値段が違う、1つ再収穫型） | あり | `src/data/crops.js:5-30`（カブ・ジャガイモ・トマト(regrow 2)・トウモロコシ・カボチャ・メロン） |
| 13 | 1日≒5分、朝〜夜の光の変化 | あり | `src/data/balance.js:5-8`（DAY_SECONDS=300）、`src/sky.js:5-12` KEYS、`src/sky.js:58-104` update() |
| 14 | ベッドで就寝→翌日 | あり | `src/menus.js:167-179` sleepConfirm、`src/game.js:131-166` endDay()、`src/world.js:243` ベッド |
| 15 | 天気（晴れ・雨、雨の日は水やり不要） | あり | `src/game.js:138-139`、`src/actions.js:123` 雨で水やり拒否、`src/field.js:251` 雨で全濡れ、`src/sky.js` 雨粒 |
| 16 | スタミナ（道具で減る、食べ物・就寝で回復） | あり | 消費 `src/actions.js:47-57` spend()、食べ物 `src/menus.js:157-163`、就寝回復 `src/game.js:144`、0で歩行低下 `src/game.js:230` |
| 17 | 出荷箱（翌朝入金） | あり | `src/menus.js:100-117`、入金 `src/game.js:133-137` |
| 18 | ショップ（種・道具強化・畑の拡張・動物） | あり | `src/menus.js:67-91`（タブ3種）、`src/data/balance.js:54-72` shopEntries()、購入 `src/menus.js:38-65` |
| 19 | 動物：ニワトリ（卵）・ウシ（牛乳） | あり | `src/animals.js:18-47` 見た目、`src/data/balance.js:44-47` ANIMALS、生産 `src/animals.js:146-166` |
| 20 | 毎日エサ・なつき度で品質 | あり | エサ `src/actions.js:84-94` feedAnimal()、なつき `src/animals.js:120-134`、品質 `src/data/balance.js:50` qualityOf()、未エサで減少 `src/animals.js:156` |
| 21 | 依頼ボード（常時3件・納品で報酬とEXP） | あり | `src/data/balance.js:76-77` QUEST_COUNT=3、`src/quests.js:35-51`（fillQuests / deliver）、納品 `src/menus.js:119-137` |
| 22 | 農場レベル（出荷額・依頼で上がり、作物・拡張が解放） | あり | `src/state.js:84-92` addExp()、`src/game.js:94-111` 解放通知、EXP加算 `src/game.js:149`・`src/menus.js:135`、解放は `CROPS[].level` と shopEntries の level |
| 23 | 農場レベル5到達でクリア | あり | `src/data/balance.js:32` CLEAR_LEVEL=5、`src/game.js:106-109` と `:113-128` showClear() |
| 24 | セーブ（就寝時自動セーブ＋つづきから、畑全マス・所持品・日付・動物） | あり | `src/game.js:31` createSave('farm')（キー `3dgame:farm`）、保存 `:151` `:116`、読込 `:190-197`、つづきから `:314`、保存内容 `src/state.js:12-36` |
| 25 | HUD（日付・時刻・天気・所持金・スタミナ・道具・依頼進捗） | あり | `src/hud.js:40-56` buildHud()、道具バー `:58-68`、呼び出し `src/game.js:273-274` |

「一部」「なし」と判定した項目は**なし**。

---

## 外部アセット・CDN

- http:// / https:// の読み込み：**なし**（games/farm/ 全体を検索、ヒット0）
- 画像・音声・モデルファイル：**なし**（`.png/.jpg/.mp3/.wav/.ogg/.glb/.gltf` の参照なし）。3D はすべてプリミティブ、音は shared/audio.js の WebAudio 合成（`src/sound.js:2`）
- three 以外の import：**なし**。`three` のみ（`src/*.js` 各所の `from 'three'`）。`three/addons/` の利用もなし
- `/shared/*` の import はローカル配信（`src/game.js:3-6`、`src/sound.js:2`）で CDN ではない
- index.html の importmap は `/vendor/three/...` のみ（`games/farm/index.html:8`）
- CSS の webfont 参照なし（`system-ui` 指定のみ）

---

## 1周の流れ

| 段階 | 判定 | 根拠 |
|---|---|---|
| タイトル（操作説明） | 通る | `src/game.js:305-315` showTitle（controls に操作一覧）、`meta.json` の controls も記載 |
| プレイ（M2 相当の1周） | 通る（コード上） | 耕す→植える→水→就寝→収穫→出荷 or 依頼 の経路は `src/game.js:199-241`、`src/hud.js:20-36` nextGoal が案内 |
| 就寝 → リザルト | 通る | `src/game.js:131-166` endDay → showResult（1日のリザルト） |
| リザルト → リトライ（朝をむかえる） | 通る | `src/game.js:164` onRetry、shared の showResult は「ハブへ戻る」も自動で付く（`shared/ui.js:162`） |
| クリア（Lv5） | 通る | `src/game.js:113-128` showClear：続けて遊ぶ／最初から／ハブへ戻る |
| ハブへ戻る | 通る | リザルト `shared/ui.js:162`、ポーズ `shared/ui.js:137` |
| Esc ポーズ | 通る | `src/game.js:212,282-285`（パネル開いている間は Esc でパネルを閉じる）、解除は `shared/ui.js:143` hidePause |
| 操作説明 | あり | タイトルの controls（`src/game.js:312`）、README の操作表 |

ゲームオーバー（失敗）は設計上なし（2:00 に力尽きると翌朝スタミナ半分で続行、`src/game.js:154`）。§6-W5 に失敗画面の要件はないため不一致ではない。

---

## 制約

- **バランス数値の src/data/ 集約**：概ね **あり**（`src/data/balance.js` `crops.js` `items.js` に作物・価格・時間・道具・依頼・ショップ・解放条件）。例外は「指摘1」の数か所。差し戻しとはしない
- **作物・木の大量描画が InstancedMesh**：**あり**。作物 `src/field.js:25-29`（soil/mound/leaf/stalk/fruit）、カーソル `:55`、外周の木 `src/world.js:194,196`、草むら・花 `src/world.js:212`、柵 `src/world.js:161-162`、パーティクル `src/particles.js:7`
- **1ファイル400行目安**：**全ファイル 400 行未満**。最大は `src/game.js` 316 行、次いで `src/world.js` 299、`src/field.js` 258、`src/actions.js` 210、`src/animals.js` 198、`src/menus.js` 189。超過なし
- **main.js は起動だけ**：**あり**。`main.js` 5 行（import 1 行＋`startGame()` 呼び出し）

---

## 確認できなかった項目

- smoke（`npm run smoke -- farm`）の実行：本監査環境では実行手段がなく未実施。`scripts/smoke.mjs:11` に farm は登録済みのみ確認
- ブラウザでのコンソールエラー0：未確認（コードの import 名・export は全て照合して一致を確認。実行時エラーは検出できず）
- 序盤10分テンポ、手触り、バランス：実プレイでの確認が必要（manager 方針どおり、人間が公開URLで確認）
- 所有権違反（games/farm/ 外の変更）：manager が git で確認するため本監査では対象外

以上。
