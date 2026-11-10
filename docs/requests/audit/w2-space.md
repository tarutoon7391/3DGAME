# 監査レポート：w2-space（games/space／宇宙3Dシューティング）

判定：合格

対象：C:\dev\3DGAME-w2-space（feat/w2-space）／担当 games/space/
照合元：docs/00_並列開発計画_3DGAME.md §6-W2、完了条件（全員共通）、CLAUDE.md、shared/*.js
注記：本監査はコード読解のみ。ブラウザ実行、コンソールエラー確認、`npm run smoke` は未実行（auditor に Bash なし）。ランタイムの確認は manager 側で行うこと。

---

## 指摘（差し戻し不要）

1. **ボス第2形態の攻撃パターンが仕様の「2〜3」を超える**：games/space/src/data/bosses.js:30（ガルガン patterns2 は4件）、:47（ヴァルキス patterns2 は4件）、:67（マザーコア patterns2 は4件）。通常形態の patterns は3件で仕様どおり。HP半分以下の第2形態で4件になる点を README の「決めたこと」に書くか、2〜3件に揃えると仕様と一致する。
2. **フレームごとのクロージャ生成（GC 負荷は小）**：games/space/src/game.js:301 `(kind) => pickItem(g, p, kind)` を毎フレーム生成。games/space/src/combat.js:204 `g.enemies.forEach((e) => {...})` を毎フレーム生成（プレイヤーごと）。THREE の new は update 経路にはない。
3. **ボス撃破演出で毎回オブジェクトリテラル**：games/space/src/boss.js:202 `tmpA.copy(p.wpos).add({ x: rand(-3, 3), ... })`。撃破演出中の 0.12 秒ごとだけなので影響は小さい。
4. **ステージクリア時の二重処理**：games/space/src/game.js:286 `finish(true)` の後に return がなく、同じフレームで以降の更新が1回走る。`stageClear()`（game.js:204）と `finish()`（game.js:215）の両方で clear 音が鳴る。害は小さい。
5. **InstancedMesh の usage 未設定（描画性能の余地）**：games/space/src/env.js:28（scroller の InstancedMesh は毎フレーム行列を書くが DynamicDrawUsage 未設定）、games/space/src/fx.js:25（スピード線）、games/space/src/bullets.js:22（敵弾の光輪 halo）。pool.js 系は設定済み。
6. **README の性能値は未検証**：games/space/README.md:41「敵弾350発で更新 約0.4ms」は実測の根拠が見当たらない。manager が `?debug&stress` で確認するか、数値を削る。
7. **400行目安**：超過ファイルなし。最長は games/space/src/game.js の 394 行で目安にかなり近い。次に長いのは boss.js 278 行。

---

## §6-W2 必須機能の判定

| 項目 | 判定 | 根拠（games/space/ 内） |
|---|---|---|
| 操作：WASD／矢印で上下左右 | あり | src/player.js:21-22（readControls） |
| マウスで照準 | あり | src/game.js:329-339（updateAim）、src/game.js:343-348 |
| 左クリック連射 | あり | src/player.js:23（fire=Mouse0）、src/player.js:189-203 |
| 右クリック／Shift でロール（回避） | あり | src/player.js:24（roll）、src/player.js:137-146、無敵 src/player.js:127 |
| Space でボム | あり | src/player.js:25（bomb）、src/game.js:254、src/combat.js:97-116 |
| ステージ3つ（小惑星帯／敵艦隊／母艦内部） | あり | src/data/stages.js:17,47,77（name）、src/env.js:9-13（3環境）、src/env.js:162（BUILDERS） |
| 各ステージ末にボス | あり | src/data/stages.js:19,49,79（boss 0/1/2 と bossAt）、src/game.js:262-273（warning→boss）、src/game.js:277-282（撃破→clear） |
| ボス：弱点部位 | あり | src/data/bosses.js:27（core）、:42-44（podL/podR/bridge）、:61（core）、src/boss.js:151（isVulnerable）、src/boss.js:242-251（hitTest） |
| ボス：攻撃パターン2〜3 | あり（指摘1 参照） | src/data/bosses.js:29-30、:46-47、:66-67。パターン実装は src/boss.js:21-64 |
| 敵4種（直進・蛇行・狙い撃ち・突撃） | あり | src/enemies.js:57（straight）、:64（snake）、:73（sniper）、:98（rammer）。定義は src/data/enemies.js:3-11 |
| 隕石（破壊可・不可） | あり | src/data/enemies.js:13（rock）、:15（ironRock・indestructible）、src/combat.js:45-50（破壊不可は弾をはじく） |
| 出現はタイムライン（src/data/） | あり | src/data/stages.js:15-107（タイムライン定義）、src/spawner.js:13-58（実行） |
| パワーアップ3種（連射・拡散・シールド） | あり | src/items.js:5-9（種類）、src/combat.js:135-155（取得効果）、src/combat.js:8,38-40（ドロップ） |
| 被弾でレベルダウン | あり | src/combat.js:76-78（rapid／spread を -1） |
| ライフ3＋シールド | あり | src/player.js:92（lives=3）、:93（shield）、src/combat.js:67-75（シールドが先に減る） |
| スコア：撃破点＋コンボ倍率（途切れるとリセット） | あり | src/combat.js:6,10-11（倍率）、:19-25（onKill）、:64-65（被弾でリセット）、src/game.js:305-309（時間切れ） |
| ステージクリアボーナス | あり | src/game.js:193-197 |
| ハイスコア保存・タイトル表示 | あり | src/game.js:34（load）、:216-221（保存）、:134-137（タイトルに表示）。保存先は shared/save.js のキー 3dgame:space |
| 演出：星のパーティクル背景 | あり | src/fx.js:11-22（Points 星）、:24-31（スピード線） |
| 演出：エンジン噴射 | あり | src/player.js:59-69（炎コーン）、:171-177（噴射粒） |
| 演出：爆発パーティクル | あり | src/fx.js:40-46（プール）、:66-74（explode） |
| 演出：被弾時の画面揺れ | あり | src/combat.js:83（shake 1.3）、src/fx.js:86-89,137-139（揺れ量）、src/game.js:345（カメラに適用） |
| 演出：ボス登場の警告表示 | あり | src/game.js:263-268（warning 表示と警告音）、src/hud.js:15-18,90-92（WARNING 表示） |
| 難易度3段階（敵弾速度・出現量） | あり | src/data/difficulty.js:4-8（bulletSpeed／density など）、src/spawner.js:21-22（出現数）、src/game.js:88（敵弾速度）、src/game.js:146-152（選択画面） |

必須機能の欠落：なし。

---

## 外部アセット・CDN・import

- games/space/ 内に http:// および https:// の参照なし（grep で 0 件）。
- 画像・音声・モデル・フォントの読み込みなし。音は shared/audio.js の WebAudio 合成のみ（src/sfx.js）。
- import は次のみ：`three`（各 src）、`three/addons/utils/BufferGeometryUtils.js`（src/env.js:6、importmap の three/addons/ 経由）、`/shared/*.js`（src/game.js:4-8）。three 以外のライブラリなし。
- index.html の importmap は `/vendor/three/` のローカル配信（index.html:8）。

判定：問題なし。

---

## 1周の流れ（コードで確認。ブラウザ実行は未確認）

- タイトル：src/game.js:126-143。操作説明は controls に記載（src/game.js:138-141）。ハイスコアを表示。
- 難易度選択：src/game.js:145-153（shared の overlay を使わず src/hud.js:140-180 で実装）。
- プレイ開始：src/game.js:166-176 → beginStage（178-191）。
- ステージクリア→次ステージ、全ステージクリア：src/game.js:193-205、283-287。
- 死亡：src/game.js:111-117（全プレイヤー dead で phase=dead）、288-291（2.2秒後に finish(false)）。
- リザルト：src/game.js:207-233。shared の showResult（shared/ui.js:158-165）を使い、ボタンは「同じ難易度でリトライ」（game.js:229）、「難易度を変える」（game.js:231）、「タイトルへ」（game.js:231）、そして shared が出す「ハブへ戻る」（shared/ui.js:162）。
- リトライ：game.js:229 → beginGame（game.js:166）。
- Esc ポーズ：src/game.js:356-359（Escape の検知）、:235-238（pause）、shared/ui.js:133-146（つづける／最初から／ハブへ戻る）。フォーカス喪失で自動ポーズ：src/game.js:239-241。
- 操作説明の常時表示：プレイ中のヒント（src/hud.js:58、:71 で表示切替）。

判定：コード上は全経路がつながっている。実行による確認は未実施。

---

## 制約（§6-W2 と CLAUDE.md）

- **弾・敵・パーティクル・アイテムはプールまたは InstancedMesh**：
  - 自機弾 320・敵弾 600（src/bullets.js:5-6,12-25）。InstPool（src/pool.js:10-96）を使用。
  - 敵は種類ごとに InstPool（src/enemies.js:132-142）。
  - パーティクル 1800（src/fx.js:8,40-46）。
  - アイテム 24 と枠（src/items.js:11-28）。
  - 敵弾の光輪は InstancedMesh（src/bullets.js:22-30）。
- **毎フレームの new**：update 経路で THREE オブジェクトの生成はなし（pool.js:30-41 の初期化時のみ）。クロージャ生成は指摘2・3 を参照。
- **当たり判定は球**：
  - 自機弾と敵・ボス：線分と球（src/util.js:11-19、src/combat.js:170、src/boss.js:248）。
  - 敵弾と自機：距離の2乗（src/combat.js:193-196）。
  - 敵と自機：距離の2乗（src/combat.js:205-206）。
  - アイテム取得：距離の2乗 < 6.5（src/items.js:57）。
- **敵出現は src/data/ のタイムライン**：src/data/stages.js（3ステージ分の timeline）、src/spawner.js で実行。
- **1ファイル400行目安**：超過なし（JS 20 ファイルすべて 400 行未満。最長 src/game.js 394 行）。内訳は指摘7 を参照。
- **main.js は起動だけ**：games/space/main.js は4行（import して boot() を呼ぶのみ）。
- **meta.json**：games/space/meta.json に slug／title／description／controls／order あり。

---

## 確認できた項目（まとめ）

- 必須機能は全項目について「あり」（ボス第2形態のパターン数のみ指摘1）。
- 外部アセット・CDN なし。three と three/addons 以外の import なし。
- 1周の流れ、Esc ポーズ、操作説明はコード上で確認。
- 弾・敵・パーティクルはプールまたは InstancedMesh。当たり判定は球。敵出現はタイムライン定義。
- main.js は起動のみ。400行超のファイルなし。
- 未確認：コンソールエラー0、`npm run smoke -- space` の通過、実プレイの手触りと60fps（manager が実行して確認すること）。
