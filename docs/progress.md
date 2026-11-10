# 進捗記録

## 公開情報

| 項目 | 内容 |
|---|---|
| 公開URL | https://web-production-eb834.up.railway.app |
| GitHub | https://github.com/tarutoon7391/3DGAME（private） |
| Railway | プロジェクト `3DGAME` ／ サービス `web` ／ 環境 `production` |
| デプロイ方式 | **自動**（Railway の GitHub 連携。`main` への push で自動ビルド・デプロイ） |
| 起動 | Railway が `npm start` を実行（PORT は Railway が注入） |

## タグ・ブランチ

- `phase0`（9cf51f6）：フェーズ0初回／`phase0.1`（ba7d4f6）：express 4.22.3 に更新（audit 0件）。ワーカーは phase0.1 から開始
- `feat/online-base`（489ebdf）：オンライン土台（Socket.io ルーム中継・shared/net.js）。**5本マージ後に main へマージ**（計画書 §10）

## フェーズ0（2026-11-10 完了）

- [x] 骨格・共通部品（shared/）・規約ファイル作成
- [x] npm install / npm start / npm run smoke 通過（OK 30 / NG 0）
- [x] GitHub リポジトリへ push（main）・`phase0` タグ push
- [x] Railway プロジェクト作成・GitHub main 連携・公開ドメイン発行
- [x] 公開URLで `/healthz`・`/api/games`・5本の `/games/<slug>/` がすべて 200

## フェーズ1（ワーカー完了記録）

| ワーカー | ブランチ | 監査 | マージ | 公開確認 |
|---|---|---|---|---|
| w1-rpg | feat/w1-rpg（cae0f1c） | 合格（[audit](requests/audit/w1-rpg.md)） | ae15f48 | 確認中 |
| w2-space | feat/w2-space（e0effad） | 合格（[audit](requests/audit/w2-space.md)） | 8673d59 | 200・ハブ掲載 OK |
| w3-sports | feat/w3-sports | 作業中 | | |
| w4-thief | feat/w4-thief（cdf2b2a） | 合格（[audit](requests/audit/w4-thief.md)） | 7f08ab2 | 200・ハブ掲載 OK |
| w5-farm | feat/w5-farm（2ae5261） | 合格（[audit](requests/audit/w5-farm.md)） | e4b46bd | 200・ハブ掲載 OK |

所有権違反：4本ともなし（games/<slug>/ 以外の変更は docs/requests/<名前>-shared.md の新規作成のみ）。マージ時の smoke：w5 後 OK 47／w4 後 OK 66／w2 後 OK 85／w1 後 OK 115、NG 0。

### 申し送り（フェーズ1後に判断）

- **shared/ui.js の不具合**：オーバーレイのパネルに文字色が無く、見出し（h1/h2）が黒字になる（w4 報告）。全ゲームに影響、遊べなくなるほどではない。凍結解除後に修正候補
- shared への要望：docs/requests/w1-rpg-shared.md・w2-space-shared.md・w4-thief-shared.md・w5-farm-shared.md（汎用メニュー／モーダル、トースト位置など共通の要望が多い）
- 監査の軽微な指摘（差し戻し不要）：各 audit レポート参照。thief はステージ追加に stages/index.js への登録が必要、space は clear 音の二重再生の可能性、farm は一部数値が src/data 外、rpg はボス「魔弾の輪」2波目の予告が弱い・shared の「ハブへ戻る」が保存せず遷移
- 手触り（FPS・難易度・テンポ）は自動操作のブラウザでは測れていない。人間が公開URLで確認する
