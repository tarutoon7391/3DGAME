# 進捗記録

## 公開情報

| 項目 | 内容 |
|---|---|
| 公開URL | https://web-production-eb834.up.railway.app |
| GitHub | https://github.com/tarutoon7391/3DGAME（private） |
| Railway | プロジェクト `3DGAME` ／ サービス `web` ／ 環境 `production` |
| デプロイ方式 | **自動**（Railway の GitHub 連携。`main` への push で自動ビルド・デプロイ） |
| 起動 | Railway が `npm start` を実行（PORT は Railway が注入） |

## フェーズ0（2026-11-10 完了）

- [x] 骨格・共通部品（shared/）・規約ファイル作成
- [x] npm install / npm start / npm run smoke 通過（OK 30 / NG 0）
- [x] GitHub リポジトリへ push（main）・`phase0` タグ push
- [x] Railway プロジェクト作成・GitHub main 連携・公開ドメイン発行
- [x] 公開URLで `/healthz`・`/api/games`・5本の `/games/<slug>/` がすべて 200

## フェーズ1（ワーカー完了記録）

| ワーカー | ブランチ | 監査 | マージ | 公開確認 |
|---|---|---|---|---|
| w1-rpg | feat/w1-rpg | | | |
| w2-space | feat/w2-space | | | |
| w3-sports | feat/w3-sports | | | |
| w4-thief | feat/w4-thief | | | |
| w5-farm | feat/w5-farm | | | |
