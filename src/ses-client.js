/**
 * AWS SESクライアント
 * AWS Simple Email Serviceを使用したメール送信を処理
 */

import { SESClient as AWSSESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export default class SESClient {
  /**
   * SESクライアントを初期化
   * @param {Object} options - 設定オプション
   */
  constructor(options = {}) {
    const {
      region = process.env.AWS_REGION || 'us-east-1',
      fromEmail = process.env.EMAIL_FROM,
      toEmail = process.env.EMAIL_TO
    } = options;

    // 必須環境変数の確認
    if (!fromEmail) {
      throw new Error('EMAIL_FROM環境変数が設定されていません');
    }

    if (!toEmail) {
      throw new Error('EMAIL_TO環境変数が設定されていません');
    }

    this.fromEmail = fromEmail;
    this.toEmail = toEmail;
    this.region = region;

    // AWS SES クライアントを初期化
    this.sesClient = new AWSSESClient({
      region: this.region
    });
  }

  /**
   * プレーンテキストメールを送信
   * @param {Object} emailContent - メールコンテンツ
   * @param {string} emailContent.subject - 件名
   * @param {string} emailContent.body - 本文
   * @param {string} [emailContent.from] - 送信者（省略時はデフォルト使用）
   * @param {string} [emailContent.to] - 受信者（省略時はデフォルト使用）
   * @returns {Promise<Object>} 送信結果
   */
  async sendEmail(emailContent) {
    const { subject, body, from = this.fromEmail, to = this.toEmail } = emailContent;

    // 入力検証
    if (!subject || typeof subject !== 'string') {
      throw new Error('件名は必須の文字列です');
    }

    if (!body || typeof body !== 'string') {
      throw new Error('本文は必須の文字列です');
    }

    if (!from || typeof from !== 'string') {
      throw new Error('送信者メールアドレスが無効です');
    }

    if (!to || typeof to !== 'string') {
      throw new Error('受信者メールアドレスが無効です');
    }

    // メール送信パラメータを構築
    const sendEmailParams = {
      Source: from,
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Text: {
            Data: body,
            Charset: 'UTF-8'
          }
        }
      }
    };

    try {
      const command = new SendEmailCommand(sendEmailParams);
      const result = await this.sesClient.send(command);

      return {
        success: true,
        messageId: result.MessageId,
        from: from,
        to: to,
        subject: subject
      };

    } catch (error) {
      console.error('メール送信エラー:', error.message);

      // SES固有のエラーハンドリング
      const formattedError = this.#handleSESError(error);
      throw formattedError;
    }
  }

  /**
   * SESエラーを処理し、意味のあるエラーメッセージを提供
   * @param {Error} error - SESエラーオブジェクト
   * @returns {Error} フォーマット済みエラー
   */
  #handleSESError(error) {
    let message = 'メール送信に失敗しました';
    let errorCode = error.name || 'UnknownError';

    switch (errorCode) {
      case 'MessageRejected':
        message = 'メッセージが拒否されました。メールアドレスまたは内容を確認してください。';
        break;
      case 'MailFromDomainNotVerified':
        message = '送信者ドメインが検証されていません。SESでドメインを検証してください。';
        break;
      case 'ConfigurationSetDoesNotExist':
        message = '指定された設定セットが存在しません。';
        break;
      case 'SendingPausedException':
        message = 'アカウントの送信が一時停止されています。AWSサポートにお問い合わせください。';
        break;
      case 'AccountSendingPausedException':
        message = 'アカウントの送信が無効になっています。AWSサポートにお問い合わせください。';
        break;
      case 'InvalidParameterValue':
        message = '無効なパラメータが指定されました。メールアドレスや内容を確認してください。';
        break;
      case 'AccessDenied':
      case 'UnauthorizedOperation':
        message = 'SESへのアクセス権限がありません。IAMロールの設定を確認してください。';
        break;
      case 'Throttling':
        message = 'SESの送信制限に達しました。しばらく待ってから再試行してください。';
        break;
      default:
        if (error.message) {
          message = `${message}: ${error.message}`;
        }
    }

    const sesError = new Error(message);
    sesError.code = errorCode;
    sesError.originalError = error;
    return sesError;
  }

  /**
   * SES接続をテスト
   * @returns {Promise<boolean>} 接続が成功した場合はtrue
   */
  async testConnection() {
    try {
      // SESの送信統計を取得してアクセス可能かテスト
      const { GetSendStatisticsCommand } = await import('@aws-sdk/client-ses');
      const command = new GetSendStatisticsCommand({});
      await this.sesClient.send(command);

      return true;
    } catch (error) {
      console.error('SES接続テストに失敗しました:', error.message);
      throw error;
    }
  }

  /**
   * ブックマークダイジェストメールを送信
   * @param {Array<BookmarkModel>} bookmarks - ブックマーク配列
   * @param {Object} options - 送信オプション
   * @returns {Promise<Object>} 送信結果
   */
  async sendBookmarkDigest(bookmarks, options = {}) {
    const {
      startDate = null,
      endDate = null,
      fromEmail = null,
      toEmail = null
    } = options;

    // EmailFormatterを動的にインポート（循環依存を避けるため）
    const { EmailFormatter } = await import('./email-formatter.js');

    // メールコンテンツを生成
    const emailContent = EmailFormatter.generateEmailContent(bookmarks, {
      startDate,
      endDate,
      fromEmail: fromEmail || this.fromEmail,
      toEmail: toEmail || this.toEmail
    });

    // メールを送信
    const result = await this.sendEmail({
      subject: emailContent.subject,
      body: emailContent.body,
      from: emailContent.from,
      to: emailContent.to
    });

    return {
      ...result,
      bookmarkCount: emailContent.bookmarkCount,
      dateRange: emailContent.dateRange
    };
  }

  /**
   * 週次ダイジェストメールを送信（過去7日間のブックマーク）
   * @param {Array<BookmarkModel>} bookmarks - ブックマーク配列
   * @param {Object} options - 送信オプション
   * @returns {Promise<Object>} 送信結果
   */
  async sendWeeklyDigest(bookmarks, options = {}) {
    // 過去7日間の日付範囲を計算
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    return await this.sendBookmarkDigest(bookmarks, {
      ...options,
      startDate,
      endDate
    });
  }

  /**
   * テストメールを送信
   * @param {Object} options - 送信オプション
   * @returns {Promise<Object>} 送信結果
   */
  async sendTestEmail(options = {}) {
    const {
      fromEmail = null,
      toEmail = null
    } = options;

    const now = new Date();
    const testSubject = `DropCast テストメール - ${now.toLocaleString('ja-JP')}`;
    const testBody = `これはDropCastシステムからのテストメールです。

送信日時: ${now.toLocaleString('ja-JP')}
送信者: ${fromEmail || this.fromEmail}
受信者: ${toEmail || this.toEmail}

このメールが正常に受信できている場合、SES設定は正しく動作しています。

--
DropCast Bookmark Mailer`;

    return await this.sendEmail({
      subject: testSubject,
      body: testBody,
      from: fromEmail || this.fromEmail,
      to: toEmail || this.toEmail
    });
  }

  /**
   * 設定情報を取得
   * @returns {Object} 現在の設定
   */
  getConfiguration() {
    return {
      region: this.region,
      fromEmail: this.fromEmail,
      toEmail: this.toEmail
    };
  }
}
