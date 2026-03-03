# システムアーキテクチャ

本プロジェクトは、AWSの無料枠（Free Tier）を最大限に活用し、スケーラブルかつ低コストなリアルタイムオンライン対戦ゲームの基盤を構築します。

## 技術スタック

### バックエンド
- **AWS Lambda**: Node.js 20.x を使用したサーバーレス関数。
- **Amazon DynamoDB**: `PAY_PER_REQUEST` モードを利用し、ルーム情報と接続情報を管理。
- **API Gateway (WebSocket)**: クライアントとの双方向リアルタイム通信を実現。

### フロントエンド
- **React (TypeScript)**: モダンなUIライブラリ。
- **WebSocket API**: ブラウザ標準のWebSocketを使用した通信。

### インフラ
- **AWS CDK (TypeScript)**: TypeScriptを使用してインフラを定義。

## データ構造 (DynamoDB)

DynamoDBは単一テーブル設計（Single Table Design）を採用しています。

- **接続情報**: `PK: CONN#{connectionId}`, `SK: CONN#{connectionId}`
- **ルーム内接続情報**: `PK: ROOM#{roomId}`, `SK: CONN#{connectionId}`
- **ルーム情報**: `PK: ROOM#{roomId}`, `SK: ROOM#{roomId}`

## 通信フロー

1. **接続 ($connect)**: クライアントが接続すると、Lambdaが起動し、接続IDをDynamoDBに保存します。
2. **ルーム作成 (createRoom)**: クライアントがアクションを送信すると、新しいルームIDを生成し、DynamoDBに登録します。
3. **ルーム参加 (joinRoom)**: クライアントが既存のルームIDを指定して参加すると、その接続IDをルームに関連付けます。
4. **メッセージ送信 (sendMessage)**: 同じルーム内の全クライアント（送信者を除く）に対してメッセージを転送します。
5. **切断 ($disconnect)**: クライアントが切断されると、DynamoDBから接続情報を削除し、必要に応じてルームからの退出を他者に通知します。
