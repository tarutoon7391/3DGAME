# w5-farm → shared への要望（待たずに games/farm/src/ 内で対応済み）

- ui.js：汎用のメニューパネル（タイトル付き・行リスト・ボタン・Esc で閉じる）が欲しい。店・持ち物・依頼など多くのゲームで使う（farm は src/panel.js で自作）
- ui.js：toast の表示位置をオプションで変えたい（画面下中央は道具バーと重なりやすい）
- ui.js：hud() とは別に右下・左下など他の隅に置ける HUD 枠
- engine.js：自動テスト用に「フレームを手動で進める」口（自動操作のブラウザだと rAF が 2fps 程度まで間引かれ、キー入力での動作確認が難しい。farm は ?debug 時だけ window.__farm.tick を出している）
