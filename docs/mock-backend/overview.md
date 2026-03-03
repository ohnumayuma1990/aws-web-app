# モックバックエンドの概要

`mock-backend` は、AWS環境にデプロイすることなく、ローカルでフロントエンドの開発やテストを行うための簡易的なWebSocketサーバーです。

## 技術
- **Node.js**: 実行環境。
- **ws (WebSocket library)**: WebSocketサーバーの実装。

## 特徴
- 実際のLambdaハンドラーと同様のアクション（`createRoom`, `joinRoom`, `sendMessage`）をシミュレートします。
- メモリ上でルーム情報と接続情報を管理するため、サーバーを再起動するとデータはリセットされます。
- 接続時にランダムなUUIDを `connectionId` として割り当てます。

## 使用方法
1. モックサーバーの起動:
   ```bash
   cd mock-backend
   npm install
   node server.js
   ```
2. フロントエンドの設定:
   `.env` ファイルなどで `REACT_APP_WSS_URL` を `ws://localhost:8080` に設定して起動します。
