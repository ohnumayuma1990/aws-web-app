# プロジェクトドキュメント

このドキュメントは、AWSサーバーレス構成によるオンライン対戦ゲームプロジェクトの構成とコードについて解説するものです。

## 構成

ドキュメントは以下のセクションに分かれています。

- [アーキテクチャ](architecture.md): システム全体の設計と技術スタック。
- [バックエンド](backend/overview.md): AWS Lambdaを使用したビジネスロジック。
- [フロントエンド](frontend/overview.md): Reactを使用したユーザーインターフェース。
- [インフラ](infra/overview.md): AWS CDKを使用したInfrastructure as Code。
- [モックバックエンド](mock-backend/overview.md): ローカル開発用のモックサーバー。

## ディレクトリ構造

```text
.
├── docs/            # プロジェクトドキュメント
├── backend/         # バックエンドコード (AWS Lambda)
├── frontend/        # フロントエンドコード (React)
├── infra/           # インフラ構成コード (AWS CDK)
└── mock-backend/    # ローカル開発用モックサーバー
```
