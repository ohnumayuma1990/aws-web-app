# システムアーキテクチャ

本プロジェクトは、AWSの無料枠（Free Tier）を最大限に活用し、スケーラブルかつ低コストなリアルタイムオンライン対戦ゲームの基盤を構築します。

## 技術スタック

### バックエンド
- **AWS Lambda**: Node.js 20.x を使用したサーバーレス関数。
- **Amazon DynamoDB**: `PAY_PER_REQUEST` モードを利用し、ルーム情報と接続情報を管理。
- **API Gateway (WebSocket)**: クライアントとの双方向リアルタイム通信を実現。

詳細は [バックエンド設計](design/backend.md) を参照してください。

### フロントエンド
- **React (TypeScript)**: モダンなUIライブラリ。
- **WebSocket API**: ブラウザ標準のWebSocketを使用した通信。

詳細は [フロントエンド設計](design/frontend.md) を参照してください。

### インフラ
- **AWS CDK (TypeScript)**: TypeScriptを使用してインフラを定義。

詳細は [インフラ構成の概要](infra/overview.md) を参照してください。

## データ構造 (DynamoDB)

DynamoDBは単一テーブル設計（Single Table Design）を採用しています。

- **接続情報**: `PK: CONN#{connectionId}`, `SK: CONN#{connectionId}`
- **ルーム内接続情報**: `PK: ROOM#{roomId}`, `SK: CONN#{connectionId}`
- **ルーム情報**: `PK: ROOM#{roomId}`, `SK: ROOM#{roomId}`

詳細は [データベース設計](design/database.md) を参照してください。

## 通信フロー

1. **接続 ($connect)**: クライアントが接続すると、Lambdaが起動し、接続IDをDynamoDBに保存します。
2. **ルーム作成 (createRoom)**: クライアントがアクションを送信すると、新しいルームIDを生成し、DynamoDBに登録します。
3. **ルーム参加 (joinRoom)**: クライアントが既存のルームIDを指定して参加すると、その接続IDをルームに関連付けます。
4. **メッセージ送信 (sendMessage)**: 同じルーム内の全クライアント（送信者を除く）に対してメッセージを転送します。
5. **切断 ($disconnect)**: クライアントが切断されると、DynamoDBから接続情報を削除し、必要に応じてルームからの退出を他者に通知します。

各アクションの詳細は [WebSocket API 仕様書](specifications/api.md) を参照してください。
