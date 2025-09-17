# 設計書

## 概要

DropCastは、Raindrop.io APIから週次でブックマークを取得し、フォーマットしてメール配信するサーバーレスアプリケーションです。AWS Lambda、EventBridge、SESを活用し、コスト効率的で保守しやすいアーキテクチャを採用します。

## アーキテクチャ

### システム構成図

```
EventBridge Scheduler (週次スケジュール)
    ↓
AWS Lambda (Node.js)
    ↓
AWS Systems Manager Parameter Store (設定取得)
    ↓
Raindrop.io API (ブックマーク取得)
    ↓
データ加工・フォーマット
    ↓
AWS SES (メール送信)
    ↓
CloudWatch Logs (ログ記録)
```

### 実行フロー

1. **トリガー**: EventBridge Schedulerが毎週木曜日00:00(JST)にLambda関数を実行
2. **設定取得**: Parameter Storeから設定情報を一括取得（APIトークン、メールアドレス）
3. **認証**: Parameter Storeから取得したRaindrop.io APIトークンを使用
4. **データ取得**: Raindrop.io APIから過去7日間のブックマークを取得
5. **データ加工**: 取得したブックマークを指定フォーマットに変換
6. **メール送信**: AWS SESでフォーマット済みコンテンツを送信
7. **ログ記録**: 実行結果をCloudWatch Logsに記録

### インフラストラクチャ管理

**AWS CDK (TypeScript)を使用:**
- Lambda関数の定義とデプロイ
- EventBridge Schedulerの作成（JSTタイムゾーン対応）
- Parameter Storeパラメータの作成と管理
- IAMロールとポリシーの管理（Parameter Store読み取り権限含む）
- CloudWatch Logsグループの設定
- CloudWatch Alarmsの設定（エラー・実行時間監視）

## コンポーネントと インターフェース

### 1. Lambda関数 (index.js)

**主要機能:**
- Parameter Storeからの設定取得
- Raindrop.io APIクライアント
- ブックマークデータ取得・フィルタリング
- メールコンテンツフォーマット
- SESメール送信
- エラーハンドリング・ログ記録

**環境変数:**
- `PARAMETER_STORE_PATH`: Parameter Store階層パス (/dropcast/config)

**Parameter Store設定:**
- `/dropcast/config/raindrop-api-token`: Raindrop.io APIアクセストークン (SecureString)
- `/dropcast/config/email-from`: 送信者メールアドレス
- `/dropcast/config/email-to`: 受信者メールアドレス

### 2. Raindrop.io API インターフェース

**エンドポイント:** `GET https://api.raindrop.io/rest/v1/raindrops/0`

**パラメータ:**
- `created`: 作成日フィルタ (ISO 8601形式)
- `perpage`: 取得件数 (最大50)
- `page`: ページ番号 (0から開始)

**レスポンス構造:**
```json
{
  "result": true,
  "items": [
    {
      "_id": "bookmark_id",
      "title": "ブックマークタイトル",
      "link": "https://example.com",
      "collection": {
        "title": "フォルダ名"
      },
      "important": true,
      "created": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 150,
  "collectionId": 0
}
```

**ページネーション処理:**
- `count`: フィルタ条件に合致した総件数（過去7日間のブックマーク数）
- 50件を超える場合は `page` パラメータを使用して複数回APIを呼び出し
- 全データ取得まで `page` を0, 1, 2... と順次インクリメント
- `items.length < perpage` になるまで継続（最後のページで件数が50未満になる）

### 3. AWS Systems Manager Parameter Store

**階層構造:**
```
/dropcast/config/
├── raindrop-api-token (SecureString) - 暗号化保存
├── email-from (String)
└── email-to (String)
```

**取得方法:**
- `GetParametersByPath` APIで一括取得
- 1回のAPI呼び出しで全設定を取得し、効率的な処理を実現
- SecureStringは自動復号化

**Parameter Storeクライアント (parameter-store.js):**
- 階層パスからの一括取得機能
- エラーハンドリング
- 設定値の検証

### 4. AWS SES インターフェース

**送信パラメータ:**
- Source: 送信者メールアドレス
- Destination: 受信者メールアドレス
- Message: 件名とプレーンテキスト本文

## データモデル

### ブックマークオブジェクト

```javascript
{
  id: String,           // ブックマークID
  title: String,        // タイトル
  url: String,          // URL
  folder: String,       // フォルダ名
  isFavorite: Boolean,  // お気に入りフラグ
  createdAt: Date       // 作成日時
}
```

### メールコンテンツ構造

```javascript
{
  subject: String,      // 件名: "週次ブックマークダイジェスト - YYYY/MM/DD"
  body: String,         // 本文: フォーマット済みブックマークリスト
  from: String,         // 送信者
  to: String           // 受信者
}
```

## エラーハンドリング

### エラー分類と対応

1. **Parameter Store エラー**
   - アクセス権限エラー: IAMロールのParameter Store読み取り権限を確認
   - パラメータ不存在: 必要なパラメータの作成をログに記録
   - 復号化エラー: SecureStringの復号化権限を確認

2. **Raindrop.io API エラー**
   - 認証エラー (401): Parameter StoreのAPIトークンの確認をログに記録
   - レート制限 (429): リトライ機能は実装せず、次回実行まで待機
   - サーバーエラー (5xx): エラー詳細をログに記録

3. **AWS SES エラー**
   - 認証エラー: IAMロール設定の確認をログに記録
   - 送信制限: 無料枠制限の警告をログに記録
   - 無効なメールアドレス: Parameter Store設定確認の指示をログに記録

4. **Lambda実行エラー**
   - タイムアウト: 実行時間の最適化が必要
   - メモリ不足: メモリ設定の調整が必要

### ログレベル

- **INFO**: 正常実行、取得件数、送信完了
- **WARN**: API制限接近、データなし
- **ERROR**: API エラー、送信失敗、設定エラー

### ログ保持期間

- **CloudWatch Logs保持期間**: 30日間
  - 週次実行のため、約4回分の実行履歴を保持
  - コスト最適化のため長期保存は行わない
  - トラブルシューティングに十分な期間を確保
- **ログ容量**: 1回の実行あたり約1KB程度を想定
- **月間ログ容量**: 約4KB（無料枠内で十分対応可能）

## テスト戦略

### 単体テスト

1. **Parameter Store機能**
   - 階層パスからの一括取得
   - SecureStringの復号化
   - エラーハンドリング（パラメータ不存在、権限エラー）

2. **ブックマーク取得機能**
   - APIレスポンスの正常パース
   - 日付フィルタリングの正確性
   - エラーレスポンスの適切な処理

3. **フォーマット機能**
   - フォルダ別グループ化
   - お気に入りマーク付与
   - 空データの処理

4. **メール送信機能**
   - SESパラメータの正確性
   - エラー時の適切なログ出力

### 統合テスト

1. **エンドツーエンドテスト**
   - 実際のRaindrop.io APIを使用したデータ取得
   - 実際のSESを使用したメール送信
   - CloudWatch Logsでのログ確認

2. **スケジュールテスト**
   - EventBridgeトリガーの動作確認
   - 定期実行の安定性確認

### テスト環境

- **開発環境**: ローカルでのLambda関数テスト
- **本番環境**: 実際のAWS環境での統合テストとスケジュール実行確認
