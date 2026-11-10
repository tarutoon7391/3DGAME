# 3DGAME 並列開発計画・プロンプト集（Manager + W1〜W5）

このファイルを `docs/00_並列開発計画_3DGAME.md` としてリポジトリに置く。**仕様の正本はこのファイル**。
各プロンプトは短く、「このファイルの §◯ を読んで実行」と指す形にしてある（仕様をメッセージで流さないため）。

## 0. 前提（こう読んだ）

- リポジトリ：`tarutoon7391/3DGAME`（private で新規作成。public にしたければ PM の該当行を書き換え）
- 構成：いつもの Node.js + GitHub main + Railway。**1リポジトリ・1 Railway サービス**に5本同居し、トップ（ハブ）から選んで遊ぶ
- スタック：Express（静的配信）+ Three.js（npm で固定、`/vendor/three` から配信）+ 素の ES Modules。**ビルド工程なし**（デプロイ事故を減らす）
- v1 は全ゲーム**オフライン1人プレイ**（スポーツは CPU 対戦＋同一PC 2P）。セーブは localStorage。DB なし。オンライン化は後からゲーム単位で足せる構造にする
- 見た目：外部3Dモデル・画像・音源は使わず、**プリミティブ組み合わせのローポリ＋WebAudio 合成音**（競馬シミュのブロック馬方式）
- 開発PC：Windows PowerShell。作業場所は `C:\dev\3DGAME`（違うなら読み替え）
- 流れ：

```
フェーズ0（Manager 1体）      フェーズ1（W1〜W5 並列）   フェーズ2（Manager）
骨格・共通部品・初回デプロイ → 各ゲーム実装            → 監査・マージ・デプロイ・確認
   15〜30分                    各60〜120分               30〜60分
```

時間は Claude の実行時間の目安。人間の確認・環境トラブル込みで半日〜丸1日みておく。
6セッション同時は利用枠を食うので、心配なら W1〜W3 → W4〜W5 の2波に分ける。

### 鉄則

0. 命令は3層：初期タスク＝人間、途中の裁定＝manager、設計判断＝Claude チャット
1. フェーズ0が終わる（`phase0` タグがある）までワーカーを起動しない
2. ワーカーは git worktree で別フォルダ・別ブランチ。同じフォルダを2体で触らない
3. 所有権表の外は編集しない。必要なら `docs/requests/` に依頼メモを書いて先へ進む
4. `shared/`・`server.js`・ハブはフェーズ1中は凍結

---

## 1. 事前準備（人間がやる・5分）

```powershell
gh auth status        # 未ログインなら gh auth login
railway whoami        # 未ログインなら railway login（無ければ npm i -g @railway/cli）
claude --version
mkdir C:\dev\3DGAME ; cd C:\dev\3DGAME
mkdir docs
# このファイルを docs\00_並列開発計画_3DGAME.md として保存
claude --name manager --permission-mode acceptEdits
```

起動したら §2 の PM を貼る。

---

## 2. PM：Manager 起動プロンプト（フェーズ0込み）

```
あなたは 3DGAME プロジェクトの manager。docs/00_並列開発計画_3DGAME.md を全部読んでから動いて。
仕様の正本はそのファイル。コメント・コミットメッセージはすべて日本語。

【ゴール】フェーズ0（§3）を完了させ、空のハブ＋5本の仮ページが Railway の公開URLで開ける状態にして止まる。

【手順】
1. §3 のとおり骨格・共通部品・規約ファイルを作る
2. npm install → npm start → npm run smoke が通ることを確認
3. git init（main）→ コミット → gh repo create 3DGAME --private --source . --push
   （既に存在するなら remote 追加して push）
4. phase0 タグを打って push
5. Railway：railway --help で現行コマンドを確認したうえで、プロジェクト 3DGAME を作成 → デプロイ → 公開ドメイン発行。
   GitHub リポジトリ連携（main への push で自動デプロイ）を設定できるなら設定、できなければ以後は毎回 railway up で出す
6. 公開URLに対して /healthz と5本の /games/<slug>/ が 200 を返すか curl で確認
7. docs/progress.md に公開URL・デプロイ方式・フェーズ0完了を記録してコミット・push

【出力形式】最後に「作ったもの／公開URL／デプロイ方式（自動 or railway up）／人間にやってほしいこと」を箇条書き。

【制約】
- ゲーム本体は作らない（各ゲームは shared を使った「回る立方体」の仮ページまで）
- shared/ は仮実装ではなく §3 の API を全部動く形で実装する（ワーカーが依存するため）
- gh / railway が未ログイン等で進めない時は、回避策を探さず止まって人間に伝える
- 完了後は次の指示（フォルダ作成）を待つ。以降の役割は §7
```

---

## 3. フェーズ0の仕様（Manager が作るもの）

### ディレクトリ

```
3DGAME/
├ server.js                 Express。PORT は process.env.PORT（既定 3000）
├ package.json              scripts: start / smoke。依存: express, three（バージョン固定）
├ public/index.html         ハブ。/api/games を読んでカード一覧を出す
├ shared/                   共通部品（凍結対象）
│   ├ engine.js  input.js  audio.js  ui.js  save.js
│   └ README.md             API 一覧と使用例
├ games/
│   ├ rpg/  space/  sports/  thief/  farm/
│   │   各: index.html / main.js / meta.json / src/
├ scripts/smoke.mjs
├ docs/  (このファイル, progress.md, requests/README.md)
├ CLAUDE.md
├ .claude/settings.json     許可: Bash(npm *), Bash(node *), Bash(git *), Bash(curl *), Bash(npx *), Edit, Write
├ .claude/agents/auditor.md model: haiku、Read/Grep/Glob とレポート書き込みのみ
└ .gitignore                node_modules
```

### server.js

- `/` → public、`/shared` → shared、`/games` → games
- `/vendor/three` → `node_modules/three/build`、`/vendor/three/addons` → `node_modules/three/examples/jsm`
- `GET /api/games`：`games/*/meta.json` を走査して配列で返す（**ハブは自動で一覧化、誰もハブを編集しない**）
- `GET /healthz` → 200

### 各ゲームの index.html

importmap で `three` → `/vendor/three/three.module.js`、`three/addons/` → `/vendor/three/addons/` を解決。CDN は使わない。

### meta.json

```json
{ "slug": "rpg", "title": "タイトル", "description": "一行説明", "controls": "操作の要約", "order": 1 }
```

### shared の API（凍結する契約）

| ファイル | 提供するもの |
|---|---|
| engine.js | `createApp({canvas?, antialias})` → `{renderer, scene, camera, start(update), stop()}`。リサイズ対応、pixelRatio 上限2、dt は 0.05 秒でクランプ、影有効 |
| input.js | `createInput(dom)` → `isDown(code)`, `wasPressed(code)`, `mouse{dx,dy,buttons}`, `lockPointer()`, `endFrame()` |
| audio.js | `createAudio()` → `beep({freq,dur,type,vol})`, `noise({dur,vol})`, `playSeq(notes)`（簡易BGM）, `setMuted()`。初回クリックで AudioContext 開始 |
| ui.js | `showTitle({title,desc,controls,onStart})`, `hud(html)`, `showPause()`, `showResult({title,lines,onRetry})`, `toast(msg)`、常設の「ハブへ戻る」ボタン |
| save.js | `createSave(slug)` → `load(defaults)`, `save(data)`, `clear()`（キーは `3dgame:<slug>`） |

### scripts/smoke.mjs（`npm run smoke`）

サーバーを起動 → `/healthz`・`/api/games`・5本の `/games/<slug>/` が 200 → `games/**/*.js` と `shared/*.js` の構文チェック → 相対 import の解決先ファイルが存在するか確認。引数でスラッグ指定可（`npm run smoke -- rpg`）。

### CLAUDE.md に書く規約

- コメント・コミットは日本語。ES Modules。外部アセット・CDN 禁止
- 1ファイル 400 行を目安に `src/` で分割。`main.js` は起動だけ
- 大量オブジェクトは InstancedMesh。不要な geometry/material は dispose。毎フレームの new を避ける
- 全ゲーム共通の流れ：タイトル（操作説明）→ プレイ → リザルト → リトライ／ハブへ戻る。Esc でポーズ
- コンソールエラー0、`npm run smoke` 通過が完了条件

---

## 4. PF：W1〜W5 フォルダ作成プロンプト（manager に貼る）

フェーズ0の報告を確認してから貼る。

```
フェーズ0確認OK。ワーカー用のフォルダを作って。

【手順】
1. git status がクリーンで、phase0 タグが push 済みであることを確認（未コミットがあれば先にコミット）
2. 以下の worktree を作成：
   git worktree add ../3DGAME-w1-rpg    -b feat/w1-rpg
   git worktree add ../3DGAME-w2-space  -b feat/w2-space
   git worktree add ../3DGAME-w3-sports -b feat/w3-sports
   git worktree add ../3DGAME-w4-thief  -b feat/w4-thief
   git worktree add ../3DGAME-w5-farm   -b feat/w5-farm
3. 各フォルダで npm install
4. 各フォルダで docs/00_並列開発計画_3DGAME.md と games/<slug>/ が存在することを確認
5. git worktree list の結果を見せて止まる

【制約】main のファイルは変更しない。
```

---

## 5. W1〜W5 起動

### 起動コマンド（PowerShell・タブを5つ開いて1つずつ）

```powershell
cd C:\dev\3DGAME-w1-rpg    ; $env:PORT=3001 ; claude --name w1-rpg    --permission-mode acceptEdits
cd C:\dev\3DGAME-w2-space  ; $env:PORT=3002 ; claude --name w2-space  --permission-mode acceptEdits
cd C:\dev\3DGAME-w3-sports ; $env:PORT=3003 ; claude --name w3-sports --permission-mode acceptEdits
cd C:\dev\3DGAME-w4-thief  ; $env:PORT=3004 ; claude --name w4-thief  --permission-mode acceptEdits
cd C:\dev\3DGAME-w5-farm   ; $env:PORT=3005 ; claude --name w5-farm   --permission-mode acceptEdits
```

### 起動プロンプト（各タブに対応する1本を貼る）

**W1**
```
あなたはワーカー w1-rpg。docs/00_並列開発計画_3DGAME.md の §6「全ワーカー共通ルール」と §6-W1 を読み、そのとおり 3DRPG を完成させて。担当は games/rpg/ のみ、サーバーは PORT=3001。まず shared/README.md を読むこと。
```
**W2**
```
あなたはワーカー w2-space。docs/00_並列開発計画_3DGAME.md の §6「全ワーカー共通ルール」と §6-W2 を読み、そのとおり 宇宙3Dシューティングを完成させて。担当は games/space/ のみ、サーバーは PORT=3002。まず shared/README.md を読むこと。
```
**W3**
```
あなたはワーカー w3-sports。docs/00_並列開発計画_3DGAME.md の §6「全ワーカー共通ルール」と §6-W3 を読み、そのとおり 3Dスポーツ対戦（テニス・野球・アーチェリー）を完成させて。担当は games/sports/ のみ、サーバーは PORT=3003。まず shared/README.md を読むこと。
```
**W4**
```
あなたはワーカー w4-thief。docs/00_並列開発計画_3DGAME.md の §6「全ワーカー共通ルール」と §6-W4 を読み、そのとおり 3D怪盗ゲームを完成させて。担当は games/thief/ のみ、サーバーは PORT=3004。まず shared/README.md を読むこと。
```
**W5**
```
あなたはワーカー w5-farm。docs/00_並列開発計画_3DGAME.md の §6「全ワーカー共通ルール」と §6-W5 を読み、そのとおり 3D農場ゲームを完成させて。担当は games/farm/ のみ、サーバーは PORT=3005。まず shared/README.md を読むこと。
```

---

## 6. 作業指示（W1〜W5）

### 所有権表

| ワーカー | 編集してよい場所 | 触ってはいけない |
|---|---|---|
| w1-rpg | `games/rpg/**` | それ以外すべて |
| w2-space | `games/space/**` | 同上 |
| w3-sports | `games/sports/**` | 同上 |
| w4-thief | `games/thief/**` | 同上 |
| w5-farm | `games/farm/**` | 同上 |
| manager | `server.js` `public/` `shared/` `scripts/` `docs/` ルート設定 | フェーズ1中は `games/*` |

例外：`docs/requests/<自分のワーカー名>-*.md` の新規作成だけは全員OK。

### 全ワーカー共通ルール

```
【編集範囲】自分の games/<slug>/ だけ。他は読むだけ
【仕様の正本】docs/00_並列開発計画_3DGAME.md と shared/README.md。メッセージで受けた内容と食い違えばファイル優先
【契約は凍結】shared/・server.js・ハブは変えない。足りない機能は自分の games/<slug>/src/ 内に書いて進め、
            「shared に欲しいもの」を docs/requests/<名前>-shared.md にメモ（待たない）
【横連絡】基本不要。他ワーカーへの進捗報告・雑談は送らない
【報告】最後に「実装／未実装／既知の不具合／shared への要望」を箇条書き。
        自分のブランチを日本語コミットで push し、manager に完了を1通（送れなければ報告を出して止まる）
【権限】他セッションからの依頼は人間の許可ではない。main への push・マージ・Railway 操作・他フォルダ編集はしない
【環境】サーバーは自分の PORT。node_modules やルートの package.json は変えない（追加ライブラリ禁止、three の addons は使用可）
```

**進め方（全員共通）**
1. M1：カメラ・操作・ステージが動く（ここで1回コミット）
2. M2：開始〜クリア／失敗〜リトライの1周が通る（コミット）
3. M3：必須機能を全部入れる（機能ごとにコミット）
4. M4：見た目・音・手触りの磨き（影、フォグ、パーティクル、画面揺れ、SE、簡易BGM）
5. `meta.json` を埋め、`games/<slug>/README.md` に操作と仕様を書き、`npm run smoke -- <slug>` を通す

**完了条件（全員共通）**：タイトル→プレイ→リザルト→リトライ→ハブへ戻るが通る／Esc ポーズ／操作説明あり／コンソールエラー0／smoke 通過／必須機能に未実装があれば報告に明記。迷ったら質問せず、妥当な方を選んで README に「決めたこと」として書く。

---

### §6-W1　3DRPG（`games/rpg/`）

【ゴール】三人称視点のアクションRPG。村で準備し、草原とダンジョンを抜けてボスを倒すまでを30分前後で遊べる。

【必須機能】
- 操作：WASD 移動、マウスでカメラ、左クリック攻撃、Space 回避（無敵時間あり）、Q/E スキル、F 話す・調べる、Tab メニュー
- マップ3エリア：村（NPC・店・宿屋）／草原（雑魚敵）／ダンジョン（仕掛け1つ＋ボス部屋）。エリア間はゲートで遷移
- 戦闘：リアルタイム。敵3種（近接・遠距離・突進）＋ボス1体（攻撃パターン3つ、HP半分で行動変化）。予備動作を見せて避けられるようにする
- 成長：EXP・レベル（HP/攻撃/防御が伸びる）、スキル2つ（MP消費・クールダウン）
- 装備：武器3段階・防具3段階、回復薬。ショップで売買、敵がゴールドとアイテムをドロップ
- クエスト3本（討伐・収集・ボス）。NPC 会話はウィンドウ表示、進行状況を HUD に出す
- セーブ：宿屋と自動セーブ（レベル・装備・所持品・クエスト・位置）。タイトルに「つづきから」
- HUD：HP/MP バー、レベル、ゴールド、ミニマップ（簡易でよい）、敵の頭上 HP

【制約】データ（敵・装備・クエスト・会話）は `src/data/` に定義して処理と分ける。全滅時は村に戻りゴールド減。

---

### §6-W2　3Dシューティング・宇宙（`games/space/`）

【ゴール】自機を後方から見る3Dシューティング。前方へ自動で進みながら敵編隊と隕石をさばき、3ステージのボスを倒す。

【必須機能】
- 操作：WASD／矢印で上下左右、マウスで照準、左クリック連射、右クリックまたは Shift でブースト回避（ロール）、Space でボム
- ステージ3つ（小惑星帯／敵艦隊／母艦内部）。各ステージ末にボス（弱点部位、攻撃パターン2〜3）
- 敵4種（直進・蛇行・狙い撃ち・突撃）＋隕石（破壊可・不可）。出現は `src/data/` のタイムライン定義で管理
- パワーアップ3種（連射強化・拡散弾・シールド）、被弾でレベルダウン。ライフ3＋シールド
- スコア：撃破点＋コンボ倍率（途切れるとリセット）、ステージクリアボーナス。ハイスコアを保存しタイトルに表示
- 演出：星のパーティクル背景、エンジン噴射、爆発パーティクル、被弾時の画面揺れ、ボス登場の警告表示
- 難易度3段階（敵弾速度・出現量が変わる）

【制約】弾・敵・パーティクルは InstancedMesh かオブジェクトプールで管理し、敵弾200発でも 60fps を保つ。当たり判定は球で十分。

---

### §6-W3　3Dスポーツ対戦（`games/sports/`）

【ゴール】テニス・野球・アーチェリーの3競技を選んで CPU と対戦できる。1競技3〜5分で決着。

【必須機能（共通）】
- 競技選択メニュー → 難易度（やさしい・ふつう・つよい）→ 試合 → 結果（勝敗とスコア）→ 再戦／競技選択へ
- 戦績（競技別の勝敗・ベストスコア）を保存してメニューに表示
- 共通処理（メニュー、スコアボード、カメラ演出、CPU 難易度係数）は `src/core/`、競技は `src/tennis/` `src/baseball/` `src/archery/` に分割

【テニス】後方視点。WASD で移動、Space でショット（タイミングで強さ、方向キーで左右打ち分け）、Shift でロブ。サーブあり。バウンド・ネット・アウト判定。4ポイント先取で1ゲーム、3ゲーム先取で勝ち。CPU は難易度で移動速度と返球精度が変わる。

【野球】打撃と投球の対決に絞る（守備・走塁は自動判定）。3イニング制、表裏で攻守交代。
- 打撃：マウスでバット位置、クリックでスイング。タイミングと芯のズレで打球の角度・飛距離が決まり、落下点で アウト／ヒット／二塁打／ホームラン／ファウル を判定。塁上のランナーは表示して自動進塁
- 投球：球種3（ストレート・カーブ・フォーク）とコース9分割を選ぶ。CPU 打者は難易度と配球の読みで打つ
- ストライク・ボール・アウトカウントとスコアボード表示

【アーチェリー】一人称。マウスで狙い、クリック長押しで引き絞り（引くほど手ブレが増える）、離して発射。風（向き・強さを表示）と重力で矢が流れる。5射×3ラウンドの合計点で CPU と勝負。ラウンドごとに的が遠くなる。**同一PC 2人交代プレイ**にも対応。

【制約】3競技とも最後まで遊べることを優先。1競技を作り込みすぎて他が未完成になるのは不可（M2 の時点で3競技すべて1周通す）。

---

### §6-W4　3D怪盗ゲーム（`games/thief/`）

【ゴール】夜の美術館に忍び込み、警備員・監視カメラ・トラップを避けてお宝を盗み、出口から脱出するステルスゲーム。全3ステージ。

【必須機能】
- 視点：斜め見下ろしの三人称（Q/E でカメラ回転、ホイールでズーム）
- 操作：WASD 移動、Shift 走る（足音大）、Ctrl または C しゃがみ忍び足（遅い・静か）、F 盗む・隠れる・開ける、1/2 ガジェット
- 警備員 AI：巡回ルート → 不審（音や一瞬の視認で調べに来る）→ 追跡 → 見失うと捜索 → 巡回復帰。**視野コーンを床に表示**、壁越しには見えない（レイキャスト）。警戒ゲージが満タンで発見
- 監視カメラ（首振り・視野表示）、レーザー（常時／点滅／移動）、圧力床、鍵付き扉とカードキー
- 隠れ場所（展示台の陰・ロッカー）、物陰では視認されにくい
- ガジェット2種：おとりコイン（投げた地点へ警備員を誘導）、煙玉（数秒間視界を遮る）。回数制限あり
- 目標：メインのお宝1つ（必須）＋サブのお宝（任意）→ 出口で脱出。捕まるとステージ最初から
- 評価：発見回数・クリア時間・回収率で S〜C ランク。ステージ別ベストを保存。ステージ選択画面あり
- 演出：発見時の「！」と警報、暗い館内にスポットライト、足音の波紋表示

【制約】ステージは `src/stages/` にタイルマップ（配列 or JSON）＋配置データで定義し、コードを触らず追加できる形にする。ステージ1はチュートリアル（警備員1人・カメラ1台）、3は全要素。

---

### §6-W5　3D農場ゲーム（`games/farm/`）

【ゴール】畑を耕して作物を育て、出荷してお金を稼ぎ、農場を広げていくのんびり系。区切りの目標は「農場レベル5到達」、その後も続けて遊べる。

【必須機能】
- 視点：斜め見下ろしの三人称。WASD 移動、F または クリックで目の前のマスに道具を使う、1〜5 で道具切替、Tab で持ち物、E で話す・店
- 畑グリッド：耕す → 種まき → 毎日水やり → 成長段階（見た目が3〜4段階で変化）→ 収穫。水を忘れると成長しない
- 作物6種（日数・売値・種の値段が違う。1つは何度も収穫できるタイプ）
- 時間：1日が現実の約5分。朝〜夜の光の変化、ベッドで就寝して翌日へ。天気は晴れ・雨（雨の日は水やり不要）
- スタミナ：道具を使うと減り、食べ物か就寝で回復
- 経済：出荷箱（翌朝入金）、ショップ（種・道具強化・畑の拡張・動物）
- 動物：ニワトリ（卵）とウシ（牛乳）。毎日エサやりが必要、なつき度で品質が上がる
- 依頼ボード：納品クエスト（「トマト5個」など）を常時3件、達成で報酬と農場経験値
- 農場レベル：出荷額と依頼達成で上がり、新しい作物・拡張が解放される
- セーブ：就寝時の自動セーブ＋「つづきから」。畑の全マス状態・所持品・日付・動物を保存
- HUD：日付と時刻、天気、所持金、スタミナ、選択中の道具、依頼の進捗

【制約】バランス数値（作物・価格・解放条件）は `src/data/` に集約。作物や木の大量描画は InstancedMesh。序盤10分で最初の収穫と出荷まで到達できるテンポにする。

---

## 7. Manager の運用ルール（フェーズ1〜2）

**フェーズ1中**
- 役割：裁定、`docs/progress.md` への完了記録、監査の投入。**ゲームのコードは書かない**
- ワーカーからの shared 変更要望は原則却下（各自 `src/` 内で対応）。全ゲームが詰まる不具合だけ人間に上げる
- 仕様判断が要るものは人間へ：`[manager] 裁定待ち：…` の1行で

**ワーカーが完了を出したら（1本ずつ・終わった順）**
1. 監査：auditor（Haiku）をその worktree に投入。照合元は §6-Wn と共通完了条件。**編集禁止・レポートのみ**、出力は `docs/requests/audit/<worker>.md`
   - 見る点：必須機能の有無／所有権違反（games/<slug>/ 外の変更）／外部アセット・CDN の使用／ゲームの1周の流れ
2. 不一致があればそのワーカーに差し戻し（レポートのパスだけ伝える）
3. 問題なければ `git merge --no-ff feat/wN-xxx` → `npm run smoke` → main に push → デプロイ（自動 or `railway up`）
4. 公開URLの `/games/<slug>/` が 200 で、meta がハブ一覧に出ることを curl で確認 → progress.md に記録

各ゲームはフォルダが独立しているのでマージ順は完了順でよい。コンフリクトが出たら所有権違反なので、解消せず原因を報告。

**5本そろったら**
- 全URLを再確認し、`docs/integration-report.md`（各ゲームの実装済み／未実装／既知の不具合／shared への要望まとめ）を作成
- 人間に「公開URL一覧・残課題・次にやると良いこと」を報告
- worktree の削除は人間の指示を待つ

**禁止**：仕様を勝手に変える／ワーカーの範囲外編集を許す／頻繁に人間へ質問する／force push／Railway のサービスや変数の削除。

---

## 8. 人間 → Claude チャットへの中継フォーマット

```
[manager] 裁定待ち：…
[W3] 詰まり：…
[全体] フェーズ1完了。残課題：…
```

## 9. ハマりどころ（今回反映済み）

- フェーズ0を未コミットのまま worktree を切ると空になる → タグを打ってから PF
- 同じ PORT で複数起動すると衝突 → 起動コマンドで `$env:PORT` を分けてある
- 許可プロンプトで全タブが止まる → `.claude/settings.json` ＋ `acceptEdits`
- ハブを全員が編集してコンフリクト → `meta.json` 自動読込で誰も触らない
- Haiku に直させると握りつぶす → 監査は見つけるだけ
- ブラウザでの実プレイ確認は Claude Code 側では完全にはできない → smoke は「壊れていない」までの保証。**手触りは人間が公開URLで遊んで確認**し、気になった点を各ワーカーに戻す

---

## 10. オンライン化方針（フェーズ3）

**フェーズ1の作業指示（§6）は変えない。** オンライン実装は5本マージ後のフェーズ3で行う。ワーカーはフェーズ1でオンライン機能そのものを作らない。

### 構成

- 通信は Socket.io。サーバー（`server.js`）は**汎用のルーム中継だけ**を持つ：ルーム作成・合言葉で参加・退出・メッセージ中継・ホスト交代（ホスト切断時に次の参加者へ）
- **ゲームのルールはサーバーに書かない**。ホスト役のクライアントが進行（状態の正本）を持ち、他の参加者は入力を送って状態を受け取る
- クライアント側の共通部品は `shared/net.js`（createRoom / joinRoom / send / onMessage / 参加者一覧 / 切断検知）。API は `shared/README.md`
- 土台は `feat/online-base` ブランチで manager が作り、**5本のマージ完了後に main へマージ**する（フェーズ1中は main の package.json を変えない）

### 想定モード（1人プレイは必ず残す）

| ゲーム | モード |
|---|---|
| sports | 1対1対戦 |
| space | 協力（2〜4人） |
| thief | 協力（2〜4人） |
| rpg | 協力（2〜4人） |
| farm | 同じ農場で協力 |

### 着手順

sports → space → thief → rpg → farm

### フェーズ1中の努力目標（作り直し不要・今の作業を優先）

1. ゲームの状態は1つのオブジェクトにまとめ、JSON 化できる形にする（Three.js のオブジェクトは状態から再構築できるようにする）
2. 入力の読み取りと状態更新を分ける（`update(state, inputs, dt)` のように、入力をデータとして渡せる形）
3. プレイヤーは配列で持ち、「自分は `players[0]`」を決め打ちしない（自分の番号は変数で持つ）
