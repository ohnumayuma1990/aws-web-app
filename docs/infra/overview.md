# インフラ構成の概要

インフラはAWS CDK (Cloud Development Kit) を使用して定義されており、プログラムコードによってAWSリソースのプロビジョニングを行います。

## リソース構成

### DynamoDB (`gameTable`)
- パーティションキー: `PK` (String)
- ソートキー: `SK` (String)
- 請求モード: `PAY_PER_REQUEST`
- 削除ポリシー: `DESTROY` (開発用)

### Lambda (`backendLambda`)
- `backend/src/handler.ts` をソースとして、Node.js 20.x ランタイムで動作します。
- 環境変数としてDynamoDBのテーブル名（`TABLE_NAME`）を保持します。
- DynamoDBへの読み書き権限が付与されています。

### API Gateway WebSocket (`webSocketApi`)
- WebSocket APIのエンドポイントを提供します。
- ルート選択式: `$request.body.action`
- 以下のルートがLambdaに統合されています:
  - `$connect`
  - `$disconnect`
  - `createRoom`
  - `joinRoom`
  - `sendMessage`
  - `$default`
- Lambdaに対して、接続情報の管理（メッセージ送信など）を行う権限を付与しています。

## デプロイ方法
`infra/` ディレクトリで以下のコマンドを実行します。
```bash
npx cdk deploy
```
デプロイ後、WebSocketのエンドポイントURLが出力されます。
