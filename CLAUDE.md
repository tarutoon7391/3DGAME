# 3DGAME 開発規約

仕様の正本は `docs/00_並列開発計画_3DGAME.md`。共通部品の API は `shared/README.md`。

## 構成

- Express（`server.js`）で静的配信。ビルド工程なし。`npm start` で起動（PORT は環境変数、既定 3000）
- three は npm で固定し `/vendor/three` から配信。各ゲームの `index.html` の importmap で `three` / `three/addons/` を解決
- ハブ（`public/index.html`）は `games/*/meta.json` を `/api/games` 経由で自動一覧化する。**ハブは誰も編集しない**

## 規約

- コメント・コミットメッセージは日本語。ES Modules
- 外部アセット・CDN 禁止（3Dモデル・画像・音源は使わず、プリミティブのローポリ＋WebAudio 合成音）
- 追加ライブラリ禁止。ルートの `package.json` / `node_modules` は変更しない（three の addons は使用可）
- 1ファイル 400 行を目安に `src/` で分割。`main.js` は起動だけ
- 大量オブジェクトは InstancedMesh。不要な geometry/material は dispose。毎フレームの new を避ける
- 全ゲーム共通の流れ：タイトル（操作説明）→ プレイ → リザルト → リトライ／ハブへ戻る。Esc でポーズ
- セーブは `shared/save.js`（localStorage、キー `3dgame:<slug>`）

## 所有権・凍結

- `shared/`・`server.js`・`public/`（ハブ）はフェーズ1中は凍結
- ワーカーは自分の `games/<slug>/` だけ編集。例外として `docs/requests/<ワーカー名>-*.md` の新規作成は可

## 完了条件

- コンソールエラー0
- `npm run smoke`（または `npm run smoke -- <slug>`）通過
