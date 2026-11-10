# w4-thief：shared への要望

## 1. ui.js のパネル見出し（h1/h2）の文字色
- タイトル・ポーズ・リザルトの `.g3-panel h1, h2` に色指定がなく、オーバーレイが `.g3-layer` の外にあるため、ブラウザ既定の黒文字になって暗いパネル上で読みにくい
- 回避策：`games/thief/src/screens.js` で `.g3-panel h1,.g3-panel h2{color:#f0f4f8}` を追加注入している

## 2. ui.js にステージ選択などの「汎用メニュー」がほしい
- showTitle はボタンが最大2つなので、ステージ選択のような複数項目のメニューが作れない
- 回避策：`games/thief/src/screens.js` に独自のステージ選択画面（g3 のクラスを流用）を作った

## 3. （参考）toast の表示時間
- 現状 `toast(msg, ms)` の第2引数で指定できるが README に記載がない。README への追記だけでよい
