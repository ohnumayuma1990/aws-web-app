# データベース設計 (DynamoDB)

本プロジェクトでは、Amazon DynamoDB を使用し、単一テーブル設計（Single Table Design）を採用しています。

## 1. テーブル構成

### 1.1 基本構成
- **テーブル名**: `GameTable`
- **パーティションキー (PK)**: `PK` (String)
- **ソートキー (SK)**: `SK` (String)
- **請求モード**: `PAY_PER_REQUEST`

### 1.2 グローバルセカンダリインデックス (GSI)
公開ルームの検索を効率的に行うため、以下のGSIを定義しています。

- **インデックス名**: `TypeIndex`
- **パーティションキー**: `type` (String)
- **ソートキー**: `createdAt` (Number)
- **射影**: `ALL` (全ての属性を射影)

---

## 2. データアイテムのパターン

### 2.1 接続情報 (Connection)
クライアントのWebSocket接続IDを管理します。

- **PK**: `CONN#{connectionId}`
- **SK**: `CONN#{connectionId}`
- **属性**:
  - `type`: "Connection"
  - `createdAt`: number (Unix timestamp)
  - `roomId`: string (参加中の場合のみ)

### 2.2 ルーム情報 (Room)
ルームの状態とゲーム全体の進行状況を管理します。

- **PK**: `ROOM#{roomId}`
- **SK**: `ROOM#{roomId}`
- **属性**:
  - `type`: "Room"
  - `createdAt`: number
  - `isPrivate`: boolean
  - `gameState`: map (詳細下記)

#### gameState の構造
```json
{
  "deck": [{ "suit": string, "value": string }, ...],
  "field": [{ "suit": string, "value": string }, ...],
  "currentTurnIndex": number,
  "turnStartTime": number,
  "status": "waiting" | "playing" | "ended",
  "winnerId": string (optional)
}
```

### 2.3 ルーム内接続情報 (RoomConnection)
ルームごとのプレイヤーの状態を管理します。

- **PK**: `ROOM#{roomId}`
- **SK**: `CONN#{connectionId}`
- **属性**:
  - `type`: "RoomConnection"
  - `score`: number
  - `hand`: [{ "suit": string, "value": string }, ...]

---

## 3. 主要なアクセスパターン

- **接続保存**: `PutItem (PK=CONN#{cid}, SK=CONN#{cid})`
- **切断削除**: `DeleteItem (PK=CONN#{cid}, SK=CONN#{cid})`
- **ルーム作成**: `PutItem (PK=ROOM#{rid}, SK=ROOM#{rid})`
- **ルーム参加**: `PutItem (PK=ROOM#{rid}, SK=CONN#{cid})`
- **ルーム内メンバー取得**: `Query (PK=ROOM#{rid}, SK begins_with CONN#)`
- **公開ルーム一覧取得**: `Query (TypeIndex, PK=Room, SortKey=createdAt desc)`
- **ゲーム状態更新**: `UpdateItem (PK=ROOM#{rid}, SK=ROOM#{rid})`
- **プレイヤースコア更新**: `UpdateItem (PK=ROOM#{rid}, SK=CONN#{cid})`
