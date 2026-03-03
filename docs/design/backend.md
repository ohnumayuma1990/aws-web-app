# バックエンド設計 (AWS Lambda)

本ドキュメントでは、バックエンドのLambdaハンドラーの構成とロジックについて記述します。

## 1. 全体構成

### 1.1 技術スタック
- **Node.js 20.x**: Lambdaランタイム。
- **AWS SDK for JavaScript v3**: DynamoDBおよびAPI Gateway Management APIとの通信。
- **TypeScript**: 型定義の導入による堅牢な開発。

### 1.2 エントリーポイント
`backend/src/handler.ts`: 全てのWebSocketイベント（`$connect`, `$disconnect`, `$default`）とカスタムアクションを一手に引き受けるモノリス構成です。

---

## 2. ライフサイクルハンドラー

### 2.1 $connect
- **役割**: クライアントが接続した際に呼び出されます。
- **処理**: `connectionId` をDynamoDBの `PK=CONN#{cid}` に保存します。

### 2.2 $disconnect
- **役割**: クライアントが切断した際に呼び出されます。
- **処理**:
  1. `PK=CONN#{cid}` のアイテムを読み込み、`roomId` を取得します。
  2. `PK=CONN#{cid}` のアイテムを削除します。
  3. `roomId` が存在する場合、`PK=ROOM#{rid}, SK=CONN#{cid}` のアイテムを削除します。
  4. ルーム内の他のユーザーに対し、`action: "userLeft"` をブロードキャストします。

---

## 3. アクションハンドラー

### 3.1 createRoom / joinRoom
- **ルーム作成**: 新しい `roomId` を生成し、`Room` アイテムと `RoomConnection` アイテムを作成します。
- **ルーム参加**: 指定された `roomId` に対し、新しい `RoomConnection` アイテムを作成します。
- **通知**: 既存の参加者に `userJoined` を通知し、自身に `roomCreated` / `roomJoined` を返却します。

### 3.2 startGame
- デッキを生成・シャッフルし、`Room` アイテムの `gameState` を `playing` に更新します。
- 全参加者に `gameStarted` をブロードキャストします。

### 3.3 drawCard / playCard
- **drawCard**: `Room` の `deck` から1枚取り出し、本人の `RoomConnection` の `hand` に追加します。
- **playCard**: `RoomConnection` の `hand` から1枚取り出し、`Room` の `field` に追加します。
- 次のターンへの更新（`currentTurnIndex` のインクリメント）を行います。

### 3.4 actOnCard
- プレイヤーのスコアを更新します。
- スコアが100に達した場合、`gameState.status` を `ended` に更新し、勝利を宣言します。

---

## 4. 通信ユーティリティ

### 4.1 sendMessageToClient
- `ApiGatewayManagementApiClient` を使用し、特定の `connectionId` に JSON データを送信します。
- 送信に失敗し、HTTP 410 (Gone) が返された場合、DynamoDB からその接続情報を自動的に削除（クリーンアップ）します。
