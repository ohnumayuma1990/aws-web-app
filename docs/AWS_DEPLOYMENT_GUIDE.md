# AWS デプロイガイド

本ドキュメントでは、本アプリケーションを AWS にデプロイするための手順を、AWS アカウントの作成から実際に画面で動作確認できるまで、ステップバイステップで説明します。

## 前提条件
- インターネットに接続されたPC
- クレジットカード（AWS アカウント作成に必要）

---

## ステップ 1: AWS アカウントの作成と初期設定

### 1.1 AWS アカウントの作成
1. [AWS 公式サイト](https://aws.amazon.com/jp/) にアクセスし、「AWS アカウントを作成」をクリックします。
2. 画面の指示に従い、メールアドレス、パスワード、連絡先情報、クレジットカード情報を入力します。
3. 本人確認（SMSまたは電話）を完了させます。
4. サポートプランは「ベーシック（無料）」を選択します。

### 1.2 IAM ユーザーの作成
ルートユーザー（作成したばかりのアカウント）での作業はセキュリティ上のリスクがあるため、作業用の IAM ユーザーを作成します。
1. AWS コンソールにログインし、検索窓で「IAM」を検索して開きます。
2. 左メニューの「ユーザー」から「ユーザーの作成」をクリックします。
3. ユーザー名（例: `deploy-user`）を入力し、次へ。
4. 「ポリシーを直接アタッチする」を選択し、`AdministratorAccess` を選択します。
   - ※本番環境ではより制限された権限が推奨されますが、初回デプロイをスムーズにするために管理権限を使用します。
5. 作成完了後、ユーザー一覧から作成したユーザーをクリックし、「セキュリティ認証情報」タブを開きます。
6. 「アクセスキー」セクションで「アクセスキーを作成」をクリックし、AWS CLI 用のアクセスキーとシークレットアクセスキーを生成し、必ずメモまたは CSV をダウンロードしておきます。

---

## ステップ 2: ローカル開発環境のセットアップ

以下のツールがインストールされていることを確認してください。

1. **Node.js (v20以上)**:
   - [Node.js 公式](https://nodejs.org/) からインストール。
2. **AWS CLI**:
   - [AWS CLI インストールガイド](https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/getting-started-install.html) に従いインストール。
3. **AWS CLI の設定**:
   ```bash
   aws configure
   # 先ほど作成したアクセスキー、シークレットアクセスキー、リージョン（ap-northeast-1等）を入力
   ```

---

## ステップ 3: バックエンドのデプロイ (AWS CDK)

まず、WebSocket API や DynamoDB などのバックエンド基盤をデプロイします。

1. **依存関係のインストール**:
   プロジェクトのルートディレクトリで実行します。
   ```bash
   npm install
   ```

2. **CDK のブートストラップ**:
   AWS 環境で CDK を初めて使用する場合に一度だけ必要です。
   ```bash
   cd infra
   npx cdk bootstrap
   ```

3. **デプロイの実行**:
   ```bash
   npx cdk deploy
   ```
   デプロイの途中で「Do you wish to deploy these changes? (y/n)」と聞かれるので `y` と入力します。

4. **エンドポイントの確認**:
   デプロイ完了後、ターミナルに以下のような出力が表示されます。
   - `ServerlessOnlineGameStack.WebSocketApiEndpoint = wss://xxxx.execute-api.ap-northeast-1.amazonaws.com/prod/`
   - `ServerlessOnlineGameStack.FrontendBucketName = ...`
   - `ServerlessOnlineGameStack.FrontendUrl = https://yyyy.cloudfront.net`

   **`WebSocketApiEndpoint` の値をメモしておきます。**

---

## ステップ 4: フロントエンドのビルドとデプロイ

### 4.1 フロントエンドのビルド
バックエンドの URL を環境変数にセットして React アプリをビルドします。

1. `frontend` ディレクトリへ移動します。
   ```bash
   cd ../frontend
   ```

2. ビルドの実行（`REACT_APP_WSS_URL` に先ほどのメモした値を入れます）:
   ```bash
   REACT_APP_WSS_URL=wss://xxxx.execute-api.ap-northeast-1.amazonaws.com/prod/ npm run build
   ```
   これにより、`frontend/build` ディレクトリに公開用ファイルが生成されます。

### 4.2 フロントエンド資産のアップロード
ビルドされたファイルを S3 にアップロードします。

1. S3 バケット名を確認します（CDK の出力、または AWS コンソールで確認）。
2. ファイルを同期します（`YOUR_BUCKET_NAME` を実際の名前に置換）:
   ```bash
   aws s3 sync build/ s3://YOUR_BUCKET_NAME --delete
   ```

---

## ステップ 5: 動作確認

1. CDK の出力に表示された `FrontendUrl`（例: `https://yyyy.cloudfront.net`）にブラウザでアクセスします。
2. 画面が表示され、ステータスが「接続済み」になれば成功です！
3. 別のブラウザウィンドウまたはスマホから同じ URL にアクセスし、ルームを作成・参加してリアルタイムに対戦ができるか確認してください。

---

## お片付け (リソースの削除)
課金を防ぐために、不要になったらリソースを削除してください。

```bash
cd infra
npx cdk destroy
```
※ S3 バケット内のファイルなどは手動で削除が必要な場合があります。
