/**
 * Raindrop.io APIクライアントのテスト
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { vi as vitest } from 'vitest';

// インポート前にaxiosをモック
vi.mock('axios', () => ({
  default: {
    create: vi.fn()
  }
}));

const { default: RaindropClient } = await import('../src/raindrop-client.js');
const axios = await import('axios');

describe('RaindropClient', () => {
  let client;
  const mockApiToken = 'test-api-token';

  beforeEach(() => {
    // モックをリセット
    vi.clearAllMocks();

    // axios.createがモッククライアントを返すようにモック
    const mockAxiosInstance = {
      get: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn()
        }
      }
    };
    axios.default.create.mockReturnValue(mockAxiosInstance);

    client = new RaindropClient(mockApiToken);
  });

  describe('コンストラクタ', () => {
    test('提供されたAPIトークンで初期化される', () => {
      expect(client.apiToken).toBe(mockApiToken);
      expect(client.baseURL).toBe('https://api.raindrop.io/rest/v1');
    });

    test('トークンが提供されない場合は環境変数を使用する', () => {
      process.env.RAINDROP_API_TOKEN = 'env-token';
      const envClient = new RaindropClient();
      expect(envClient.apiToken).toBe('env-token');
      delete process.env.RAINDROP_API_TOKEN;
    });

    test('APIトークンが提供されない場合はエラーを投げる', () => {
      delete process.env.RAINDROP_API_TOKEN;
      expect(() => new RaindropClient()).toThrow('Raindrop.io APIトークンが必要です');
    });

    test('正しいヘッダーでaxiosクライアントを設定する', () => {
      expect(axios.default.create).toHaveBeenCalledWith({
        baseURL: 'https://api.raindrop.io/rest/v1',
        headers: {
          'Authorization': `Bearer ${mockApiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
    });
  });

  describe('接続テスト', () => {
    test('接続成功時にtrueを返す', async () => {
      client.client.get.mockResolvedValue({ status: 200 });

      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(client.client.get).toHaveBeenCalledWith('/user');
    });

    test('接続失敗時にエラーを投げる', async () => {
      const error = new Error('Network error');
      client.client.get.mockRejectedValue(error);

      await expect(client.testConnection()).rejects.toThrow('Network error');
    });
  });

  describe('最近のブックマーク取得', () => {
    const mockBookmarkResponse = {
      data: {
        result: true,
        items: [
          {
            _id: 'bookmark1',
            title: 'テストブックマーク1',
            link: 'https://example.com/1',
            collection: { title: 'テック' },
            important: true,
            created: '2024-01-01T00:00:00.000Z'
          },
          {
            _id: 'bookmark2',
            title: 'テストブックマーク2',
            link: 'https://example.com/2',
            collection: { title: 'ニュース' },
            important: false,
            created: '2024-01-02T00:00:00.000Z'
          }
        ],
        count: 2
      }
    };

    test('デフォルトの日付範囲（過去7日間）でブックマークを取得する', async () => {
      client.client.get.mockResolvedValue(mockBookmarkResponse);

      const result = await client.getRecentBookmarks();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'bookmark1',
        title: 'テストブックマーク1',
        url: 'https://example.com/1',
        folder: 'テック',
        isFavorite: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z')
      });

      expect(client.client.get).toHaveBeenCalledWith('/raindrops/0', {
        params: expect.objectContaining({
          perpage: 50,
          page: 0,
          created: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\.\.\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        })
      });
    });

    test('カスタム日付範囲でブックマークを取得する', async () => {
      client.client.get.mockResolvedValue(mockBookmarkResponse);

      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-07');

      await client.getRecentBookmarks(fromDate, toDate);

      expect(client.client.get).toHaveBeenCalledWith('/raindrops/0', {
        params: {
          created: '2024-01-01T00:00:00.000Z..2024-01-07T00:00:00.000Z',
          perpage: 50,
          page: 0
        }
      });
    });

    test('ページネーションを正しく処理する', async () => {
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
            created: '2024-01-01T00:00:00.000Z'
          })),
          count: 75 // 総数は次のページがあることを示す
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
            created: '2024-01-01T00:00:00.000Z'
          })),
          count: 75
        }
      };

      client.client.get
        .mockResolvedValueOnce(firstPageResponse)
        .mockResolvedValueOnce(secondPageResponse);

      const result = await client.getRecentBookmarks();

      expect(result).toHaveLength(75);
      expect(client.client.get).toHaveBeenCalledTimes(2);

      // 1ページ目の呼び出しをチェック
      expect(client.client.get).toHaveBeenNthCalledWith(1, '/raindrops/0', {
        params: expect.objectContaining({ page: 0 })
      });

      // 2ページ目の呼び出しをチェック
      expect(client.client.get).toHaveBeenNthCalledWith(2, '/raindrops/0', {
        params: expect.objectContaining({ page: 1 })
      });
    });

    test('空のレスポンスを処理する', async () => {
      const emptyResponse = {
        data: {
          result: true,
          items: [],
          count: 0
        }
      };

      client.client.get.mockResolvedValue(emptyResponse);

      const result = await client.getRecentBookmarks();

      expect(result).toHaveLength(0);
    });

    test('無効なレスポンス形式を処理する', async () => {
      const invalidResponse = {
        data: {
          result: true,
          // itemsが欠落
          count: 0
        }
      };

      client.client.get.mockResolvedValue(invalidResponse);

      await expect(client.getRecentBookmarks()).rejects.toThrow('Raindrop.io APIからの無効なレスポンス形式');
    });

    test('APIエラーを処理する', async () => {
      const apiError = new Error('APIエラー');
      client.client.get.mockRejectedValue(apiError);

      await expect(client.getRecentBookmarks()).rejects.toThrow('APIエラー');
    });
  });

  describe('ブックマーク解析（getRecentBookmarks経由）', () => {
    test('有効なブックマークを正しく解析する', async () => {
      const mockResponse = {
        data: {
          result: true,
          items: [
            {
              _id: 'test-id',
              title: 'テストタイトル',
              link: 'https://example.com',
              collection: { title: 'テストフォルダ' },
              important: true,
              created: '2024-01-01T00:00:00.000Z'
            }
          ],
          count: 1
        }
      };

      client.client.get.mockResolvedValue(mockResponse);
      const result = await client.getRecentBookmarks();

      expect(result[0]).toEqual({
        id: 'test-id',
        title: 'テストタイトル',
        url: 'https://example.com',
        folder: 'テストフォルダ',
        isFavorite: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z')
      });
    });

    test('タイトルがないブックマークを処理する', async () => {
      const mockResponse = {
        data: {
          result: true,
          items: [
            {
              _id: 'test-id',
              link: 'https://example.com',
              collection: { title: 'テストフォルダ' },
              important: false
            }
          ],
          count: 1
        }
      };

      client.client.get.mockResolvedValue(mockResponse);
      const result = await client.getRecentBookmarks();

      expect(result[0].title).toBe('タイトルなし');
    });

    test('コレクションがないブックマークを処理する', async () => {
      const mockResponse = {
        data: {
          result: true,
          items: [
            {
              _id: 'test-id',
              title: 'テストタイトル',
              link: 'https://example.com',
              important: false
            }
          ],
          count: 1
        }
      };

      client.client.get.mockResolvedValue(mockResponse);
      const result = await client.getRecentBookmarks();

      expect(result[0].folder).toBe('未分類');
    });

    test('無効なブックマークは警告を出して処理を継続する', async () => {
      const mockResponse = {
        data: {
          result: true,
          items: [
            {
              // 必須フィールドが欠落
              title: 'テストタイトル'
            }
          ],
          count: 1
        }
      };

      // console.warnをモック
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      client.client.get.mockResolvedValue(mockResponse);
      const result = await client.getRecentBookmarks();

      expect(result).toHaveLength(0); // 無効なアイテムは除外される
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ブックマーク変換中にエラーが発生しました')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('コレクション別ブックマーク取得', () => {
    test('コレクションIDでブックマークを取得する', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              _id: 'bookmark1',
              title: 'テストブックマーク',
              link: 'https://example.com',
              collection: { title: 'テック' },
              important: false,
              created: '2024-01-01T00:00:00.000Z'
            }
          ]
        }
      };

      client.client.get.mockResolvedValue(mockResponse);

      const result = await client.getBookmarksByCollection(123);

      expect(result).toHaveLength(1);
      expect(client.client.get).toHaveBeenCalledWith('/raindrops/123', {
        params: {
          perpage: 50,
          page: 0
        }
      });
    });

    test('コレクションクエリで日付フィルタを処理する', async () => {
      const mockResponse = { data: { items: [] } };
      client.client.get.mockResolvedValue(mockResponse);

      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-07');

      await client.getBookmarksByCollection(123, { fromDate, toDate });

      expect(client.client.get).toHaveBeenCalledWith('/raindrops/123', {
        params: {
          perpage: 50,
          page: 0,
          created: '2024-01-01T00:00:00.000Z..2024-01-07T00:00:00.000Z'
        }
      });
    });
  });
});
