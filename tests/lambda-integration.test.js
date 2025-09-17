/**
 * Lambda関数の統合テスト
 * エンドツーエンドテストとエラーシナリオのテスト
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

// axiosをモック
const mockAxiosGet = vi.fn();
const mockAxiosCreate = vi.fn().mockImplementation(() => ({
  get: mockAxiosGet,
  interceptors: {
    response: {
      use: vi.fn()
    }
  }
}));

vi.mock('axios', () => ({
  default: {
    create: mockAxiosCreate
  }
}));

// Lambda関数をインポート（モック後）
const { handler } = await import('../src/index.js');

describe('Lambda関数統合テスト', () => {
  let mockEvent;
  let mockContext;

  beforeEach(() => {
    // モックをリセット
    vi.clearAllMocks();

    // 環境変数を設定
    process.env.RAINDROP_API_TOKEN = 'test-raindrop-token';
    process.env.EMAIL_FROM = 'sender@example.com';
    process.env.EMAIL_TO = 'recipient@example.com';
    process.env.AWS_REGION = 'us-east-1';

    // モックイベントとコンテキスト
    mockEvent = {
      source: 'aws.events',
      'detail-type': 'Scheduled Event'
    };

    mockContext = {
      requestId: 'test-request-id-123',
      functionName: 'dropcast-bookmark-mailer',
      functionVersion: '1',
      remainingTimeInMillis: 30000
    };

    // デフォルトのモックレスポンス
    mockSend.mockResolvedValue({ MessageId: 'test-message-id' });
  });

  afterEach(() => {
    // 環境変数をクリア
    delete process.env.RAINDROP_API_TOKEN;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_TO;
    delete process.env.AWS_REGION;
  });

  describe('正常系テスト', () => {
    test('ブックマークありの場合の正常実行', async () => {
      // Raindrop.io APIのモックレスポンス
      const mockBookmarks = {
        data: {
          result: true,
          items: [
            {
              _id: 'bookmark1',
              title: 'テストブックマーク1',
              link: 'https://example.com/1',
              collection: { title: 'テック' },
              important: true,
              created: '2024-01-01T10:00:00.000Z'
            },
            {
              _id: 'bookmark2',
              title: 'テストブックマーク2',
              link: 'https://example.com/2',
              collection: { title: 'ニュース' },
              important: false,
              created: '2024-01-01T11:00:00.000Z'
            }
          ],
          count: 2
        }
      };

      mockAxiosGet.mockResolvedValue(mockBookmarks);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.message).toBe('DropCast ブックマークメーラーが正常に実行されました');
      expect(body.stats.bookmarkCount).toBe(2);
      expect(body.stats.emailSent).toBe(true);
      expect(body.stats.messageId).toBe('test-message-id');
      expect(body.stats.executionTime).toBeGreaterThan(0);

      // API呼び出しの確認
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test('ブックマークなしの場合の正常実行', async () => {
      // 空のブックマークレスポンス
      const emptyBookmarks = {
        data: {
          result: true,
          items: [],
          count: 0
        }
      };

      mockAxiosGet.mockResolvedValue(emptyBookmarks);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.stats.bookmarkCount).toBe(0);
      expect(body.stats.emailSent).toBe(true); // 空でもメールは送信される
    });

    test('大量のブックマークの処理（ページネーション）', async () => {
      // 1ページ目のレスポンス（50件）
      const firstPageResponse = {
        data: {
          result: true,
          items: Array(50).fill().map((_, i) => ({
            _id: `bookmark${i}`,
            title: `テストブックマーク${i}`,
            link: `https://example.com/${i}`,
            collection: { title: 'テック' },
            important: false,
            created: '2024-01-01T10:00:00.000Z'
          })),
          count: 75
        }
      };

      // 2ページ目のレスポンス（25件）
      const secondPageResponse = {
        data: {
          result: true,
          items: Array(25).fill().map((_, i) => ({
            _id: `bookmark${i + 50}`,
            title: `テストブックマーク${i + 50}`,
            link: `https://example.com/${i + 50}`,
            collection: { title: 'テック' },
            important: false,
            created: '2024-01-01T10:00:00.000Z'
          })),
          count: 75
        }
      };

      mockAxiosGet
        .mockResolvedValueOnce(firstPageResponse)
        .mockResolvedValueOnce(secondPageResponse);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.stats.bookmarkCount).toBe(75);
      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('エラーシナリオテスト', () => {
    test('環境変数不足エラー', async () => {
      delete process.env.RAINDROP_API_TOKEN;

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body.message).toBe('設定エラーが発生しました');
      expect(body.error.type).toBe('CONFIGURATION_ERROR');
      expect(body.error.severity).toBe('CRITICAL');
    });

    test('Raindrop.io API エラー', async () => {
      const apiError = new Error('Authentication failed. Please check your API token.');
      apiError.status = 401;
      mockAxiosGet.mockRejectedValue(apiError);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(502);

      const body = JSON.parse(result.body);
      expect(body.message).toBe('ブックマーク取得サービスでエラーが発生しました');
    });

    test('SES メール送信エラー', async () => {
      // 正常なブックマーク取得
      const mockBookmarksResponse = {
        data: {
          result: true,
          items: [
            {
              _id: 'bookmark1',
              title: 'テストブックマーク',
              link: 'https://example.com',
              collection: { title: 'テスト' },
              important: false,
              created: '2024-01-01T10:00:00.000Z'
            }
          ],
          count: 1
        }
      };

      mockAxiosGet.mockResolvedValue(mockBookmarksResponse);

      // SESエラー
      const sesError = new Error('MessageRejected');
      sesError.name = 'MessageRejected';
      mockSend.mockRejectedValue(sesError);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(502);

      const body = JSON.parse(result.body);
      expect(body.message).toBe('メール送信サービスでエラーが発生しました');
    });

    test('ネットワークエラー', async () => {
      const networkError = new Error('Network error: Unable to connect to Raindrop.io API');
      mockAxiosGet.mockRejectedValue(networkError);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(502);

      const body = JSON.parse(result.body);
      expect(body.message).toBe('ブックマーク取得サービスでエラーが発生しました');
    });

    test('予期しないエラー', async () => {
      const unexpectedError = new Error('Unexpected system error');
      mockAxiosGet.mockRejectedValue(unexpectedError);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body.message).toBe('システムエラーが発生しました');
    });
  });

  describe('実行統計とログ', () => {
    test('実行統計が正しく記録される', async () => {
      const mockBookmarksResponse = {
        data: {
          result: true,
          items: [
            {
              _id: 'bookmark1',
              title: 'テストブックマーク',
              link: 'https://example.com',
              collection: { title: 'テスト' },
              important: false,
              created: '2024-01-01T10:00:00.000Z'
            }
          ],
          count: 1
        }
      };

      mockAxiosGet.mockResolvedValue(mockBookmarksResponse);

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.stats).toHaveProperty('executionTime');
      expect(body.stats).toHaveProperty('bookmarkCount');
      expect(body.stats).toHaveProperty('emailSent');
      expect(body.stats).toHaveProperty('messageId');

      expect(typeof body.stats.executionTime).toBe('number');
      expect(body.stats.executionTime).toBeGreaterThanOrEqual(0);
    });

    test('エラー時の統計記録', async () => {
      delete process.env.EMAIL_FROM;

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body.error).toHaveProperty('type');
      expect(body.error).toHaveProperty('severity');
      expect(body.error).toHaveProperty('timestamp');
    });
  });

  describe('イベント処理', () => {
    test('EventBridge スケジュールイベントの処理', async () => {
      const scheduledEvent = {
        source: 'aws.events',
        'detail-type': 'Scheduled Event',
        detail: {},
        resources: ['arn:aws:events:us-east-1:123456789012:rule/dropcast-weekly-schedule']
      };

      const mockBookmarksResponse = {
        data: {
          result: true,
          items: [],
          count: 0
        }
      };

      mockAxiosGet.mockResolvedValue(mockBookmarksResponse);

      const result = await handler(scheduledEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });

    test('手動実行イベントの処理', async () => {
      const manualEvent = {
        source: 'manual',
        'detail-type': 'Manual Execution'
      };

      const mockBookmarksResponse = {
        data: {
          result: true,
          items: [],
          count: 0
        }
      };

      mockAxiosGet.mockResolvedValue(mockBookmarksResponse);

      const result = await handler(manualEvent, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('パフォーマンステスト', () => {
    test('実行時間が妥当な範囲内', async () => {
      const mockBookmarksResponse = {
        data: {
          result: true,
          items: Array(10).fill().map((_, i) => ({
            _id: `bookmark${i}`,
            title: `テストブックマーク${i}`,
            link: `https://example.com/${i}`,
            collection: { title: 'テスト' },
            important: false,
            created: '2024-01-01T10:00:00.000Z'
          })),
          count: 10
        }
      };

      mockAxiosGet.mockResolvedValue(mockBookmarksResponse);

      const startTime = Date.now();
      const result = await handler(mockEvent, mockContext);
      const endTime = Date.now();

      expect(result.statusCode).toBe(200);

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000); // 5秒以内

      const body = JSON.parse(result.body);
      expect(body.stats.executionTime).toBeLessThan(5000);
    });
  });
});
