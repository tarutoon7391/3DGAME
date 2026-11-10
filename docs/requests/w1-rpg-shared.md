# w1-rpg → shared への要望（待たずに games/rpg/src 内で対応済み）

1. **ui.js：汎用モーダル（会話・選択肢・リスト）**
   RPG では会話ウィンドウ・ショップ・メニューを `games/rpg/src/ui/dialog.js` に自作した。開閉時のキー入力の付け外しやポインタロック解除を含む汎用モーダルが shared にあると他ゲームでも使い回せる。
2. **input.js：ポインタロックが外れた時のコールバック**
   Esc でブラウザがロックを外すと keydown が届かないことがあるため、ゲーム側で `pointerlockchange` を直接監視してポーズしている。`input.onUnlock(fn)` のようなフックがあると楽。
3. **ui.js：トーストの位置指定**
   トーストが画面下中央固定のため、スキル欄を左下に逃がした。`toast(msg, ms, {position})` があると HUD と被らない配置にしやすい。
4. **ui.js：showPause のボタン名変更**
   `onRetry` のボタン名が「最初から」固定。RPG では「最後のセーブから」にしたかったので未使用。`retryLabel` 引数があると良い。
