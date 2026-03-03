# コンポーネントの解説

フロントエンドの主要なロジックは `frontend/src/App.tsx` に集約されています。

## App コンポーネント

このコンポーネントは、WebSocketの接続状態管理、ルームへの入退出、メッセージの送受信を担当します。

### ステート管理
- `roomId`: 現在参加しているルームのID。
- `messages`: 受信したメッセージのリスト。
- `connected`: WebSocketの接続状態。
- `users`: 現在のルームに参加しているユーザーの接続IDリスト。

### WebSocket 接続 (useEffect)
コンポーネントのマウント時にWebSocket接続を確立し、各種イベントハンドラーを設定します。
- `onmessage`: 受信したデータのアクション（`roomCreated`, `roomJoined`, `userJoined`, `userLeft`, `messageReceived`）に応じてステートを更新します。

### 主要機能
- **ルーム作成 (`createRoom`)**: `action: "createRoom"` を送信します。
- **ルーム参加 (`joinRoom`)**: 指定したIDで `action: "joinRoom"` を送信します。
- **メッセージ送信 (`sendMessage`)**: `action: "sendMessage"` と共に入力されたテキストを送信します。

## UI構成
- 接続前/ルーム未参加時: ルーム作成ボタンと参加フォームを表示。
- ルーム参加中: ルームID、参加者リスト、チャット履歴、メッセージ入力欄を表示。
