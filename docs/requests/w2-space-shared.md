# w2-space → shared への要望（急ぎではない）

1. **showTitle に複数の開始ボタンを渡したい**（例：`buttons: [{label, onClick}]`）。難易度選択をタイトル画面の中で済ませたい。今は games/space/src/hud.js の中に、g3-overlay/g3-panel を流用した自前の選択画面を作っている
2. **isOverlayOpen() に、ゲーム側が自前で出したオーバーレイも数えてもらいたい**（または、登録用の API がほしい）。Esc ポーズとの判定がぶつからないようにするため
3. **engine.js で update と render を分けて呼べる仕組み（stepOnly）**。テストのときにフレームを手動で進めたい（今は ?debug のときだけ、ゲーム側の loop 関数を外から呼べるようにしている）
