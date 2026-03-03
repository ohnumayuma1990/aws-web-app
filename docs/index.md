# プロジェクトドキュメント

このドキュメントは、AWSサーバーレス構成によるオンライン対戦ゲームプロジェクトの構成とコードについて解説するものです。

## 目次

- **[システム仕様](specifications/functional.md)**: ゲームの機能とルール、および [WebSocket API 仕様](specifications/api.md)。
- **[システム設計](architecture.md)**: 全体アーキテクチャ。
  - **[データベース設計](design/database.md)**: DynamoDBのデータモデルとアクセスパターン。
  - **[バックエンド設計](design/backend.md)**: AWS Lambdaのロジックとハンドラー。
  - **[フロントエンド設計](design/frontend.md)**: Reactコンポーネントと状態管理。
- **[インフラ構成](infra/overview.md)**: AWS CDKを使用したInfrastructure as Code。
- **[モックバックエンド](mock-backend/overview.md)**: ローカル開発用のモックサーバー。
- **[テスト計画](TEST_PLAN.md)**: 品質保証のためのテスト戦略。

## ディレクトリ構造

```text
.
├── docs/            # プロジェクトドキュメント
├── backend/         # バックエンドコード (AWS Lambda)
├── frontend/        # フロントエンドコード (React)
├── infra/           # インフラ構成コード (AWS CDK)
└── mock-backend/    # ローカル開発用モックサーバー
```
