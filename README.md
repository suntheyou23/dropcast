# DropCast ブックマークメーラー

Raindrop.ioからブックマークを取得し、週次でダイジェストメールを自動送信するシステムです。

## 概要

このシステムは以下の処理を自動で実行します：
- Raindrop.io APIから過去7日間のブックマークを取得
- Redmine用マークダウン形式でフォーマット
- AWS SESを使用して週次ダイジェストメールを送信
- AWS Lambda + EventBridge Schedulerで毎週木曜日00:00(JST)に実行
- AWS Systems Manager Parameter Storeでセキュアな設定管理

## システム構成

```
EventBridge Scheduler (週次スケジュール)
    ↓
AWS Lambda (Node.js)
    ↓
Parameter Store (設定取得)
    ↓
Raindrop.io API (ブックマーク取得)
    ↓
データ加工・フォーマット
    ↓
AWS SES (メール送信)
    ↓
CloudWatch Logs (ログ記録)
```

## プロジェクト構造

```
├── .kiro/specs/dropcast-bookmark-mailer/
│   ├── requirements.md       # 要件定義書
│   ├── design.md            # 設計書
│   ├── tasks.md             # 実装タスク
│   └── deployment-guide.md  # デプロイ・テスト手順書
├── src/
│   ├── index.js             # メインLambdaハンドラー
│   ├── raindrop-client.js   # Raindrop.io APIクライアント
│   ├── email-formatter.js   # メールコンテンツフォーマッター
│   ├── ses-client.js        # AWS SESクライアント
│   ├── parameter-store.js   # Parameter Storeクライアント
│   ├── logger.js            # ログ機能
│   ├── error-handler.js     # エラーハンドリング
│   └── bookmark-model.js    # ブックマークデータモデル
├── tests/
│   ├── raindrop-client.test.js
│   ├── email-formatter.test.js
│   └── ses-client.test.js
├── cdk/
│   ├── lib/
│   │   └── dropcast-bookmark-mailer-stack.ts  # CDKスタック定義
│   ├── bin/
│   │   └── cdk.ts           # CDKアプリケーション
│   └── package.json         # CDK依存関係
├── .env                     # 環境変数（ローカル開発用）
├── .env.example             # 環境変数テンプレート
├── package.json
└── README.md
```

## 設定管理

### Parameter Store階層構造
```
/dropcast/config/
├── raindrop-api-token (String) - Raindrop.io APIトークン
├── email-from (String)         - 送信者メールアドレス
└── email-to (String)           - 受信者メールアドレス
```

### 環境変数（開発用）
- `RAINDROP_API_TOKEN`: Raindrop.io APIアクセストークン
- `EMAIL_FROM`: 送信者メールアドレス
- `EMAIL_TO`: 受信者メールアドレス
- `AWS_REGION`: AWSリージョン（デフォルト: us-east-1）

## 開発

```bash
# 依存関係のインストール
npm install

# テスト実行
npm test

# テスト（ウォッチモード）
npm run test:watch

# カバレッジ付きテスト
npm run test:coverage

# リンティング
npm run lint

# Lambda関数のローカル実行
npm start
```

## デプロイ

### 前提条件
- Node.js 20.x以上
- AWS CLI設定済み
- Raindrop.io APIトークン
- AWS SESで検証済みメールアドレス

### CDKデプロイ手順

```bash
# 環境変数の設定
cp .env.example .env
# .envファイルを実際の値で更新

# CDKブートストラップ（初回のみ）
cd cdk
cdk bootstrap

# デプロイ実行
cdk deploy

# スタック削除（必要時）
cdk destroy
```

### 詳細な手順
詳細なデプロイ・テスト手順は [deployment-guide.md](.kiro/specs/dropcast-bookmark-mailer/deployment-guide.md) を参照してください。

## メール形式

送信されるダイジェストメールの形式：

```
件名: 週次ブックマークダイジェスト - 2024/01/11

h4. [生成AI]
* "spec-workflow-mcpとは?":https://example.com
* "話題のSerenaを使ってみた":https://example.com %{color: red}★%

h4. [コーディング]
* "短いコードは本当に正しいのか":https://example.com
```

## 監視・運用

### CloudWatch Alarms
- **エラーアラーム**: Lambda関数でエラーが発生した場合
- **実行時間アラーム**: 実行時間が4分を超えた場合

### ログ
- **CloudWatch Logs**: `/aws/lambda/dropcast-bookmark-mailer`
- **保持期間**: 30日間
- **ログレベル**: INFO, WARN, ERROR

## トラブルシューティング

よくある問題と解決方法：

1. **Parameter Store アクセスエラー**: IAM権限を確認
2. **SES メール送信エラー**: メールアドレスの検証状態を確認
3. **Raindrop.io API エラー**: APIトークンの有効性を確認
4. **CDK デプロイエラー**: deployment-guide.mdのトラブルシューティングを参照

## ライセンス

MIT License

## 関連リンク

- [Raindrop.io API Documentation](https://developer.raindrop.io/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
