# ハンドラーの解説

`backend/src/handler.ts` は、WebSocket APIの全てのライフサイクルイベントとカスタムアクションを処理します。

## ルート処理

### $connect
クライアントからの新規接続時に呼び出されます。
- `connectionId` をDynamoDBのテーブルに保存します。

### $disconnect
クライアントの切断時に呼び出されます。
- DynamoDBから接続情報を削除します。
- ユーザーがルームに参加していた場合、ルーム内の他のユーザーに通知を送信し、ルームの接続リストからも削除します。

### createRoom
新しいゲームルームを作成します。
- ランダムな6文字のルームIDを生成します。
- ルーム情報と、作成者の接続情報をDynamoDBに保存します。

### joinRoom
既存のルームに参加します。
- 指定された `roomId` に接続IDを紐付けます。
- ルーム内の既存ユーザーに新ユーザーの参加を通知します。

### sendMessage
同じルーム内の全ユーザーにメッセージを送信します。
- ルームIDに基づいてDynamoDBから参加者のリストを取得します。
- `ApiGatewayManagementApiClient` を使用して、各参加者にメッセージをプッシュします。

## ヘルパー関数

### `sendMessageToClient`
API Gateway Management APIを使用して、特定の接続IDに対してメッセージを送信します。送信に失敗し、ステータスが410（Gone）の場合は、無効な接続としてDynamoDBから削除します。
