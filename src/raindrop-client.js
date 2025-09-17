/**
 * Raindrop.io APIクライアント
 * 認証とRaindrop.io APIからのブックマーク取得を処理
 */

import axios from 'axios';
import { BookmarkModel } from './bookmark-model.js';

export default class RaindropClient {
  constructor(apiToken = null) {
    this.apiToken = apiToken || process.env.RAINDROP_API_TOKEN;
    this.baseURL = 'https://api.raindrop.io/rest/v1';

    if (!this.apiToken) {
      throw new Error('Raindrop.io APIトークンが必要です。RAINDROP_API_TOKEN環境変数を設定するか、コンストラクタに渡してください。');
    }

    // 認証付きでaxiosクライアントを設定
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30秒タイムアウト
    });

    // エラーハンドリング用のレスポンスインターセプターを追加
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        return this.#handleError(error);
      }
    );
  }

  /**
   * HTTPエラーを処理し、意味のあるエラーメッセージを提供
   * @param {Error} error - Axiosエラーオブジェクト
   * @returns {Promise} - フォーマット済みエラーで拒否されたPromise
   */
  #handleError(error) {
    if (error.response) {
      // サーバーがエラーステータスで応答
      const { status, data } = error.response;
      let message = `Raindrop.io APIエラー (${status})`;

      switch (status) {
        case 401:
          message = '認証に失敗しました。APIトークンを確認してください。';
          break;
        case 403:
          message = 'アクセスが禁止されています。API権限を確認してください。';
          break;
        case 429:
          message = 'レート制限を超過しました。しばらく待ってから再試行してください。';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          message = 'Raindrop.ioサーバーエラーです。しばらく待ってから再試行してください。';
          break;
        default:
          if (data && data.errorMessage) {
            message = `${message}: ${data.errorMessage}`;
          }
      }

      const apiError = new Error(message);
      apiError.status = status;
      apiError.originalError = error;
      return Promise.reject(apiError);
    } else if (error.request) {
      // ネットワークエラー
      const networkError = new Error('ネットワークエラー: Raindrop.io APIに接続できません');
      networkError.originalError = error;
      return Promise.reject(networkError);
    } else {
      // その他のエラー
      return Promise.reject(error);
    }
  }

  /**
   * API接続と認証をテスト
   * @returns {Promise<boolean>} - 接続が成功した場合はtrue
   */
  async testConnection() {
    try {
      const response = await this.client.get('/user');
      return response.status === 200;
    } catch (error) {
      console.error('接続テストに失敗しました:', error.message);
      throw error;
    }
  }

  /**
   * ページネーション対応で過去7日間のブックマークを取得
   * @param {Date} fromDate - フィルタリング開始日（デフォルト: 7日前）
   * @param {Date} toDate - フィルタリング終了日（デフォルト: 現在）
   * @returns {Promise<Array>} - ブックマークオブジェクトの配列
   */
  async getRecentBookmarks(fromDate = null, toDate = null) {
    // 日付が提供されない場合は過去7日間をデフォルトとする
    if (!fromDate) {
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
    }

    if (!toDate) {
      toDate = new Date();
    }

    // API用に日付をフォーマット（ISO 8601形式）
    const fromDateStr = fromDate.toISOString();
    const toDateStr = toDate.toISOString();

    let allBookmarks = [];
    let page = 0;
    let hasMorePages = true;
    const perPage = 50; // Raindrop.io APIで許可される最大値

    try {
      while (hasMorePages) {
        const response = await this.client.get('/raindrops/0', {
          params: {
            created: `${fromDateStr}..${toDateStr}`,
            perpage: perPage,
            page: page
          }
        });

        const { items, count } = response.data;

        if (!items || !Array.isArray(items)) {
          throw new Error('Raindrop.io APIからの無効なレスポンス形式');
        }

        // BookmarkModelを使用してブックマークデータを解析・検証
        const parsedBookmarks = BookmarkModel.fromRaindropApiResponseArray(items);
        allBookmarks = allBookmarks.concat(parsedBookmarks);

        // 次のページがあるかチェック
        // items.length < perPageの場合、最後のページに到達
        hasMorePages = items.length === perPage && allBookmarks.length < count;
        page++;

        // 無限ループを防ぐ安全チェック
        if (page > 100) {
          console.warn('最大ページ制限（100）に到達しました。ページネーションを停止します。');
          break;
        }
      }

      return allBookmarks;

    } catch (error) {
      console.error('ブックマーク取得エラー:', error.message);
      throw error;
    }
  }

  // 注意: #parseBookmarkメソッドはBookmarkModel.fromRaindropApiResponseに置き換えられました

  /**
   * 特定のコレクション/フォルダIDでブックマークを取得
   * @param {number} collectionId - コレクションID（全ブックマークの場合は0）
   * @param {Object} options - 追加オプション（作成日フィルタ、ページネーション）
   * @returns {Promise<Array>} - ブックマークオブジェクトの配列
   */
  async getBookmarksByCollection(collectionId = 0, options = {}) {
    const {
      fromDate = null,
      toDate = null,
      page = 0,
      perPage = 50
    } = options;

    try {
      const params = {
        perpage: perPage,
        page: page
      };

      // 日付フィルタが提供された場合は追加
      if (fromDate && toDate) {
        const fromDateStr = fromDate.toISOString();
        const toDateStr = toDate.toISOString();
        params.created = `${fromDateStr}..${toDateStr}`;
      }

      const response = await this.client.get(`/raindrops/${collectionId}`, {
        params: params
      });

      const { items } = response.data;

      if (!items || !Array.isArray(items)) {
        return [];
      }

      return BookmarkModel.fromRaindropApiResponseArray(items);

    } catch (error) {
      console.error(`コレクション${collectionId}のブックマーク取得エラー:`, error.message);
      throw error;
    }
  }
}
