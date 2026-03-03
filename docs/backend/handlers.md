# ハンドラーの解説

`backend/src/handler.ts` は、WebSocket APIの全てのライフサイクルイベントとカスタムアクションを処理します。

## ルート処理の要約

### ライフサイクルイベント
- **$connect**: 接続IDをDynamoDBに保存。
- **$disconnect**: 接続情報を削除し、必要に応じて他ユーザーへ通知。

### カスタムアクション
- **createRoom**: ルーム作成。
- **joinRoom**: 既存ルームへの参加。
- **sendMessage**: メッセージ転送。
- **startGame, drawCard, playCard, etc.**: ゲームプレイの進行管理。

各アクションのペイロードと振る舞いの詳細については **[WebSocket API 仕様書](../specifications/api.md)** を参照してください。
