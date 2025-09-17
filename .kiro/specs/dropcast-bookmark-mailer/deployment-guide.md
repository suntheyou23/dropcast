# DropCast デプロイ・テスト手順書

## 1. デプロイ前の準備

### 環境変数の設定

```bash
# .env ファイルを実際の値で更新
RAINDROP_API_TOKEN=your_actual_raindrop_api_token
EMAIL_FROM=your_verified_sender@example.com
EMAIL_TO=recipient@example.com
AWS_REGION=us-east-1
```

### Raindrop.io API トークンの取得

1. [Raindrop.io](https://raindrop.io) → Settings → Integrations → Create new app
2. Test Token をコピーして.env に設定

### AWS SES メールアドレス検証

```bash
# 送信者メールアドレスを検証
aws ses verify-email-identity --email-address your_sender@example.com

# 検証状態の確認
aws ses get-identity-verification-attributes --identities your_sender@example.com
```

## 2. CDK デプロイ

```bash
# CDK ブートストラップ（初回のみ）
cd cdk
cdk bootstrap

# デプロイ実行
cdk deploy
```

## 3. 手動実行テスト（タスク 7.1）

### Lambda 関数の手動実行

```bash
# AWS CLI での実行
aws lambda invoke \
  --function-name dropcast-bookmark-mailer \
  --payload '{}' \
  response.json

# 実行結果の確認
cat response.json
```

### 実行結果の確認

- ステータスコード: 200
- メール送信: 指定したメールアドレスに送信される
- ログ: CloudWatch Logs で確認

### CloudWatch Logs の確認

```bash
# 最新のログを確認
aws logs tail /aws/lambda/dropcast-bookmark-mailer --follow
```

## 4. スケジュール実行の確認（タスク 7.2）

### EventBridge Scheduler の確認

```bash
# スケジュールの確認
aws scheduler get-schedule --name dropcast-weekly-schedule
```

### 実行スケジュール

- 毎週木曜日 00:00 JST
- 次回実行時刻を確認し、実行後にログとメール送信を確認

## トラブルシューティング

### CDK デプロイエラー

**ROLLBACK_COMPLETE 状態の場合**: 直接再デプロイ可能

```bash
cdk deploy
```

### Parameter Store アクセスエラー

IAM 権限を確認

### SES メール送信エラー

- メールアドレスの検証状態を確認
- サンドボックスモードの場合、受信者も検証が必要

### Raindrop.io API エラー

API トークンの有効性を確認

## 完了チェックリスト

### デプロイ完了

- [ ] CDK デプロイが成功した
- [ ] Parameter Store に設定が保存された

### 手動実行テスト完了

- [ ] Lambda 関数が正常に実行された
- [ ] メールが正常に送信された
- [ ] CloudWatch Logs に正常なログが記録された

### スケジュール実行確認完了

- [ ] EventBridge Scheduler が正しく設定された
- [ ] 初回スケジュール実行が成功した
