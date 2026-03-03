# バックエンドの概要

バックエンドは、AWS Lambdaを使用してサーバーレスで構築されています。API Gateway WebSocket APIからのリクエストを処理し、DynamoDBと連携してルーム管理やリアルタイム通信を実現します。

## 主要技術
- **Node.js**: 実行ランタイム。
- **AWS SDK v3**: DynamoDBやAPI Gateway Management APIとの通信に使用。
- **TypeScript**: 型安全な開発。

## 配置
ソースコードは `backend/src` ディレクトリに配置されています。
- `handler.ts`: 全てのWebSocketルートを処理するメインのエントリーポイント。

詳細なロジックについては **[バックエンド設計](../design/backend.md)** を参照してください。
