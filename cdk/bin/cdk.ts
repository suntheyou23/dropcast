#!/usr/bin/env node
/**
 * DropCast ブックマークメーラー CDK アプリケーション
 * AWS インフラストラクチャをコードとして管理
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DropcastBookmarkMailerStack } from '../lib/dropcast-bookmark-mailer-stack';
import * as dotenv from 'dotenv';

// .envファイルから環境変数を読み込み（親ディレクトリの.envファイル）
dotenv.config({ path: '../.env' });

const app = new cdk.App();

// スタックを作成
new DropcastBookmarkMailerStack(app, 'DropcastBookmarkMailerStack', {
  // 環境設定
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
  },

  // スタックの説明
  description: 'DropCast ブックマークメーラー - 週次ダイジェストメール自動送信システム',

  // タグ
  tags: {
    Project: 'DropCast',
    Component: 'BookmarkMailer',
    Environment: 'production'
  }
});
