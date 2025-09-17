/**
 * AWS SESクライアントのテスト
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';

// AWS SDK v3をモック
const mockSend = vi.fn();
const mockSESClient = vi.fn().mockImplementation(() => ({
  send: mockSend
}));

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: mockSESClient,
  SendEmailCommand: vi.fn().mockImplementation((params) => params),
  GetSendStatisticsCommand: vi.fn().mockImplementation((params) => params)
}));

// SESClientをインポート（モック後）
const { default: SESClient } = await import('../src/ses-client.js');
const { BookmarkModel } = await import('../src/bookmark-model.js');

describe('SESClient', () => {
  let sesClient;

  beforeEach(() => {
    // モックをリセット
    vi.clearAllMocks();

    // 環境変数を設定
    process.env.EMAIL_FROM = 'sender@example.com';
    process.env.EMAIL_TO = 'recipient@example.com';
    process.env.AWS_REGION = 'us-east-1';
  });

  afterEach(() => {
    // 環境変数をクリア
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_TO;
    delete process.env.AWS_REGION;
  });

  describe('コンストラクタ', () => {
    test('環境変数から設定を読み込んで初期化される', () => {
      sesClient = new SESClient();

      expect(sesClient.fromEmail).toBe('sender@example.com');
      expect(sesClient.toEmail).toBe('recipient@example.com');
      expect(sesClient.region).toBe('us-east-1');
    });

    test('カスタムオプションで初期化される', () => {
      sesClient = new SESClient({
        region: 'ap-northeast-1',
        fromEmail: 'custom@example.com',
        toEmail: 'custom-recipient@example.com'
      });

      expect(sesClient.fromEmail).toBe('custom@example.com');
      expect(sesClient.toEmail).toBe('custom-recipient@example.com');
      expect(sesClient.region).toBe('ap-northeast-1');
    });

    test('EMAIL_FROM環境変数が無い場合はエラーを投げる', () => {
      delete process.env.EMAIL_FROM;

      expect(() => new SESClient()).toThrow('EMAIL_FROM環境変数が設定されていません');
    });

    test('EMAIL_TO環境変数が無い場合はエラーを投げる', () => {
      delete process.env.EMAIL_TO;

      expect(() => new SESClient()).toThrow('EMAIL_TO環境変数が設定されていません');
    });
  });

  describe('sendEmail', () => {
    beforeEach(() => {
      sesClient = new SESClient();
    });

    test('正常にメールを送信する', async () => {
      const mockResult = { MessageId: 'test-message-id-123' };
      mockSend.mockResolvedValue(mockResult);

      const emailContent = {
        subject: 'テスト件名',
        body: 'テスト本文'
      };

      const result = await sesClient.sendEmail(emailContent);

      expect(result).toEqual({
        success: true,
        messageId: 'test-message-id-123',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'テスト件名'
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('カスタム送信者・受信者でメールを送信する', async () => {
      const mockResult = { MessageId: 'test-message-id-456' };
      mockSend.mockResolvedValue(mockResult);

      const emailContent = {
        subject: 'カスタムテスト',
        body: 'カスタム本文',
        from: 'custom-sender@example.com',
        to: 'custom-recipient@example.com'
      };

      const result = await sesClient.sendEmail(emailContent);

      expect(result.from).toBe('custom-sender@example.com');
      expect(result.to).toBe('custom-recipient@example.com');
    });

    test('件名が無い場合はエラーを投げる', async () => {
      const emailContent = {
        body: 'テスト本文'
      };

      await expect(sesClient.sendEmail(emailContent)).rejects.toThrow('件名は必須の文字列です');
    });

    test('本文が無い場合はエラーを投げる', async () => {
      const emailContent = {
        subject: 'テスト件名'
      };

      await expect(sesClient.sendEmail(emailContent)).rejects.toThrow('本文は必須の文字列です');
    });

    test('SESエラーを適切に処理する', async () => {
      const sesError = new Error('MessageRejected');
      sesError.name = 'MessageRejected';
      mockSend.mockRejectedValue(sesError);

      const emailContent = {
        subject: 'テスト件名',
        body: 'テスト本文'
      };

      await expect(sesClient.sendEmail(emailContent)).rejects.toThrow(
        'メッセージが拒否されました。メールアドレスまたは内容を確認してください。'
      );
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      sesClient = new SESClient();
    });

    test('SES接続テストが成功する', async () => {
      mockSend.mockResolvedValue({});

      const result = await sesClient.testConnection();

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('SES接続テストが失敗する', async () => {
      const connectionError = new Error('AccessDenied');
      mockSend.mockRejectedValue(connectionError);

      await expect(sesClient.testConnection()).rejects.toThrow('AccessDenied');
    });
  });

  describe('sendBookmarkDigest', () => {
    beforeEach(() => {
      sesClient = new SESClient();
    });

    test('ブックマークダイジェストメールを送信する', async () => {
      const mockResult = { MessageId: 'digest-message-id' };
      mockSend.mockResolvedValue(mockResult);

      const testBookmarks = [
        new BookmarkModel({
          id: '1',
          title: 'テストブックマーク1',
          url: 'https://example.com/1',
          folder: 'テストフォルダ',
          isFavorite: true,
          createdAt: new Date('2024-01-01T10:00:00.000Z')
        }),
        new BookmarkModel({
          id: '2',
          title: 'テストブックマーク2',
          url: 'https://example.com/2',
          folder: 'テストフォルダ',
          isFavorite: false,
          createdAt: new Date('2024-01-01T11:00:00.000Z')
        })
      ];

      const result = await sesClient.sendBookmarkDigest(testBookmarks);

      expect(result.success).toBe(true);
      expect(result.bookmarkCount).toBe(2);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('空のブックマーク配列でもメールを送信する', async () => {
      const mockResult = { MessageId: 'empty-digest-id' };
      mockSend.mockResolvedValue(mockResult);

      const result = await sesClient.sendBookmarkDigest([]);

      expect(result.success).toBe(true);
      expect(result.bookmarkCount).toBe(0);
    });
  });

  describe('sendWeeklyDigest', () => {
    beforeEach(() => {
      sesClient = new SESClient();
    });

    test('週次ダイジェストメールを送信する', async () => {
      const mockResult = { MessageId: 'weekly-digest-id' };
      mockSend.mockResolvedValue(mockResult);

      const testBookmarks = [
        new BookmarkModel({
          id: '1',
          title: '週次テストブックマーク',
          url: 'https://example.com/weekly',
          folder: '週次フォルダ',
          isFavorite: false,
          createdAt: new Date()
        })
      ];

      const result = await sesClient.sendWeeklyDigest(testBookmarks);

      expect(result.success).toBe(true);
      expect(result.bookmarkCount).toBe(1);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendTestEmail', () => {
    beforeEach(() => {
      sesClient = new SESClient();
    });

    test('テストメールを送信する', async () => {
      const mockResult = { MessageId: 'test-email-id' };
      mockSend.mockResolvedValue(mockResult);

      const result = await sesClient.sendTestEmail();

      expect(result.success).toBe(true);
      expect(result.subject).toContain('DropCast テストメール');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('カスタムメールアドレスでテストメールを送信する', async () => {
      const mockResult = { MessageId: 'custom-test-id' };
      mockSend.mockResolvedValue(mockResult);

      const result = await sesClient.sendTestEmail({
        fromEmail: 'test-sender@example.com',
        toEmail: 'test-recipient@example.com'
      });

      expect(result.from).toBe('test-sender@example.com');
      expect(result.to).toBe('test-recipient@example.com');
    });
  });

  describe('getConfiguration', () => {
    test('現在の設定を取得する', () => {
      sesClient = new SESClient();
      const config = sesClient.getConfiguration();

      expect(config).toEqual({
        region: 'us-east-1',
        fromEmail: 'sender@example.com',
        toEmail: 'recipient@example.com'
      });
    });
  });

  describe('エラーハンドリング', () => {
    beforeEach(() => {
      sesClient = new SESClient();
    });

    test('MessageRejectedエラーを適切に処理する', async () => {
      const error = new Error('Message rejected');
      error.name = 'MessageRejected';
      mockSend.mockRejectedValue(error);

      const emailContent = { subject: 'テスト', body: 'テスト' };

      await expect(sesClient.sendEmail(emailContent)).rejects.toThrow(
        'メッセージが拒否されました。メールアドレスまたは内容を確認してください。'
      );
    });

    test('AccessDeniedエラーを適切に処理する', async () => {
      const error = new Error('Access denied');
      error.name = 'AccessDenied';
      mockSend.mockRejectedValue(error);

      const emailContent = { subject: 'テスト', body: 'テスト' };

      await expect(sesClient.sendEmail(emailContent)).rejects.toThrow(
        'SESへのアクセス権限がありません。IAMロールの設定を確認してください。'
      );
    });

    test('Throttlingエラーを適切に処理する', async () => {
      const error = new Error('Throttling');
      error.name = 'Throttling';
      mockSend.mockRejectedValue(error);

      const emailContent = { subject: 'テスト', body: 'テスト' };

      await expect(sesClient.sendEmail(emailContent)).rejects.toThrow(
        'SESの送信制限に達しました。しばらく待ってから再試行してください。'
      );
    });

    test('未知のエラーを適切に処理する', async () => {
      const error = new Error('Unknown error occurred');
      error.name = 'UnknownError';
      mockSend.mockRejectedValue(error);

      const emailContent = { subject: 'テスト', body: 'テスト' };

      await expect(sesClient.sendEmail(emailContent)).rejects.toThrow(
        'メール送信に失敗しました: Unknown error occurred'
      );
    });
  });
});
