# WebSocket API 仕様書

本ドキュメントでは、クライアントとサーバー間のWebSocket APIのプロトコルについて記述します。

## 1. 共通事項

### 1.1 エンドポイント
API Gateway WebSocket APIのエンドポイント（例: `wss://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`）

### 1.2 メッセージ形式
全てのメッセージは JSON 形式で送受信されます。
クライアントからのメッセージには、ルート選択のための `action` キーが含まれている必要があります。

---

## 2. クライアントからサーバーへのアクション (Request)

### 2.1 createRoom
新しいゲームルームを作成します。
- **Payload:**
  ```json
  {
    "action": "createRoom",
    "isPrivate": boolean (optional)
  }
  ```

### 2.2 joinRoom
既存のルームに参加します。
- **Payload:**
  ```json
  {
    "action": "joinRoom",
    "roomId": string
  }
  ```

### 2.3 searchRooms
公開されているルームのリストを検索します。
- **Payload:**
  ```json
  { "action": "searchRooms" }
  ```

### 2.4 leaveRoom
参加中のルームから退出します。
- **Payload:**
  ```json
  {
    "action": "leaveRoom",
    "roomId": string
  }
  ```

### 2.5 sendMessage
ルーム内のユーザーにメッセージを送信します。
- **Payload:**
  ```json
  {
    "action": "sendMessage",
    "roomId": string,
    "message": string
  }
  ```

### 2.6 startGame
ゲームを開始します。
- **Payload:**
  ```json
  {
    "action": "startGame",
    "roomId": string
  }
  ```

### 2.7 drawCard
山札からカードを引きます。
- **Payload:**
  ```json
  {
    "action": "drawCard",
    "roomId": string
  }
  ```

### 2.8 playCard
手札からカードを場に出します。
- **Payload:**
  ```json
  {
    "action": "playCard",
    "roomId": string,
    "cardIndex": number
  }
  ```

### 2.9 selectCard
カードを選択し、ビジュアル的なフィードバックを共有します。
- **Payload:**
  ```json
  {
    "action": "selectCard",
    "roomId": string,
    "cardIndex": number
  }
  ```

### 2.10 actOnCard
カードに対してアクションを行い、スコアを加算します。
- **Payload:**
  ```json
  {
    "action": "actOnCard",
    "roomId": string,
    "cardIndex": number
  }
  ```

### 2.11 resetGame
ゲームをリセットして初期状態に戻します。
- **Payload:**
  ```json
  {
    "action": "resetGame",
    "roomId": string
  }
  ```

---

## 3. サーバーからクライアントへのアクション (Response/Broadcast)

### 3.1 roomCreated
ルーム作成が成功した際に送信されます。
- **Payload:**
  ```json
  {
    "action": "roomCreated",
    "roomId": string,
    "users": [connectionId, ...]
  }
  ```

### 3.2 roomJoined
自身がルームに参加した際に送信されます。
- **Payload:**
  ```json
  {
    "action": "roomJoined",
    "roomId": string,
    "users": [connectionId, ...]
  }
  ```

### 3.3 userJoined
他のユーザーがルームに参加した際にブロードキャストされます。
- **Payload:**
  ```json
  {
    "action": "userJoined",
    "connectionId": string,
    "roomId": string
  }
  ```

### 3.4 userLeft
ユーザーがルームから退出（または切断）した際にブロードキャストされます。
- **Payload:**
  ```json
  {
    "action": "userLeft",
    "connectionId": string,
    "roomId": string
  }
  ```

### 3.5 roomsList
公開ルームのリストが返却されます。
- **Payload:**
  ```json
  {
    "action": "roomsList",
    "rooms": [{ "roomId": string, "createdAt": number }, ...]
  }
  ```

### 3.6 gameStarted
ゲームが開始された際にブロードキャストされます。
- **Payload:**
  ```json
  {
    "action": "gameStarted",
    "gameState": {
      "field": [],
      "currentTurnIndex": 0,
      "turnStartTime": number,
      "status": "playing",
      "deckCount": number
    },
    "players": [connectionId, ...]
  }
  ```

### 3.7 cardDrawn
カードが引かれた際にブロードキャストされます。
- **Payload:**
  ```json
  {
    "action": "cardDrawn",
    "connectionId": string,
    "deckCount": number,
    "card": { "suit": string, "value": string } | null (引いた本人以外は null)
  }
  ```

### 3.8 cardPlayed
カードが場に出された際にブロードキャストされます。
- **Payload:**
  ```json
  {
    "action": "cardPlayed",
    "connectionId": string,
    "card": { "suit": string, "value": string },
    "nextTurnIndex": number,
    "turnStartTime": number
  }
  ```

### 3.9 scoreUpdated
スコアが更新された際にブロードキャストされます。
- **Payload:**
  ```json
  {
    "action": "scoreUpdated",
    "connectionId": string,
    "score": number,
    "winnerId": string | null
  }
  ```

### 3.10 messageReceived
チャットメッセージを受信した際に転送されます。
- **Payload:**
  ```json
  {
    "action": "messageReceived",
    "from": string (connectionId),
    "message": string
  }
  ```
