/**
 * ブックマークデータモデル
 * Raindrop.io APIレスポンスからの変換とデータ検証を提供
 */

/**
 * ブックマークオブジェクトの型定義
 * @typedef {Object} Bookmark
 * @property {string} id - ブックマークID
 * @property {string} title - タイトル
 * @property {string} url - URL
 * @property {string} folder - フォルダ名
 * @property {boolean} isFavorite - お気に入りフラグ
 * @property {Date} createdAt - 作成日時
 */

/**
 * ブックマークデータモデルクラス
 */
export class BookmarkModel {
  /**
   * ブックマークオブジェクトを作成
   * @param {Object} data - ブックマークデータ
   */
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.url = data.url;
    this.folder = data.folder;
    this.isFavorite = data.isFavorite;
    this.createdAt = data.createdAt;

    // データ検証を実行
    this.validate();
  }

  /**
   * データ検証を実行
   * @throws {Error} 検証エラーの場合
   */
  validate() {
    const errors = [];

    // 必須フィールドの検証
    if (!this.id || typeof this.id !== 'number') {
      errors.push('id は必須の数値です');
    }

    if (!this.url || typeof this.url !== 'string') {
      errors.push('url は必須の文字列です');
    }

    if (typeof this.title !== 'string') {
      errors.push('title は文字列である必要があります');
    }

    if (typeof this.folder !== 'string') {
      errors.push('folder は文字列である必要があります');
    }

    if (typeof this.isFavorite !== 'boolean') {
      errors.push('isFavorite はブール値である必要があります');
    }

    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) {
      errors.push('createdAt は有効な日付である必要があります');
    }

    // URL形式の検証
    if (this.url) {
      try {
        new URL(this.url);
      } catch (e) {
        errors.push('url は有効なURL形式である必要があります');
      }
    }

    if (errors.length > 0) {
      throw new Error(`ブックマークデータ検証エラー: ${errors.join(', ')}`);
    }
  }

  /**
   * Raindrop.io APIレスポンスからブックマークオブジェクトに変換
   * @param {Object} apiItem - Raindrop.io APIからのアイテム
   * @returns {BookmarkModel} 変換されたブックマークオブジェクト
   */
  static fromRaindropApiResponse(apiItem) {
    if (!apiItem || typeof apiItem !== 'object') {
      throw new Error('APIレスポンスアイテムが無効です');
    }

    // 必須フィールドの存在確認
    if (!apiItem._id) {
      throw new Error('APIレスポンスにIDが含まれていません');
    }

    if (!apiItem.link) {
      throw new Error('APIレスポンスにリンクが含まれていません');
    }

    // データ変換
    const bookmarkData = {
      id: apiItem._id,
      title: apiItem.title || 'タイトルなし',
      url: apiItem.link,
      folder: apiItem.tags.at(0) ?? '未分類',
      isFavorite: Boolean(apiItem.important),
      createdAt: apiItem.created ? new Date(apiItem.created) : new Date()
    };

    return new BookmarkModel(bookmarkData);
  }

  /**
   * ブックマークオブジェクトの配列をRaindrop.io APIレスポンスから変換
   * @param {Array} apiItems - Raindrop.io APIからのアイテム配列
   * @returns {Array<BookmarkModel>} 変換されたブックマークオブジェクトの配列
   */
  static fromRaindropApiResponseArray(apiItems) {
    if (!Array.isArray(apiItems)) {
      throw new Error('APIレスポンスアイテムは配列である必要があります');
    }

    const bookmarks = [];
    const errors = [];

    apiItems.forEach((item, index) => {
      try {
        const bookmark = BookmarkModel.fromRaindropApiResponse(item);
        bookmarks.push(bookmark);
      } catch (error) {
        errors.push(`アイテム ${index}: ${error.message}`);
      }
    });

    // エラーがある場合は警告として記録（全体の処理は継続）
    if (errors.length > 0) {
      console.warn(`ブックマーク変換中にエラーが発生しました: ${errors.join(', ')}`);
    }

    return bookmarks;
  }

  /**
   * プレーンオブジェクトに変換
   * @returns {Object} プレーンオブジェクト
   */
  toPlainObject() {
    return {
      id: this.id,
      title: this.title,
      url: this.url,
      folder: this.folder,
      isFavorite: this.isFavorite,
      createdAt: this.createdAt
    };
  }

  /**
   * JSON文字列に変換
   * @returns {string} JSON文字列
   */
  toJSON() {
    return JSON.stringify(this.toPlainObject());
  }

  /**
   * 文字列表現を取得
   * @returns {string} 文字列表現
   */
  toString() {
    return `Bookmark(id=${this.id}, title="${this.title}", folder="${this.folder}")`;
  }
}

/**
 * ブックマークデータの検証ユーティリティ関数
 */
export class BookmarkValidator {
  /**
   * ブックマークデータが有効かチェック
   * @param {Object} data - 検証するデータ
   * @returns {boolean} 有効な場合true
   */
  static isValid(data) {
    try {
      new BookmarkModel(data);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * ブックマークデータの検証エラーを取得
   * @param {Object} data - 検証するデータ
   * @returns {Array<string>} エラーメッセージの配列
   */
  static getValidationErrors(data) {
    try {
      new BookmarkModel(data);
      return [];
    } catch (error) {
      return [error.message];
    }
  }

  /**
   * Raindrop.io APIレスポンスアイテムが有効かチェック
   * @param {Object} apiItem - APIレスポンスアイテム
   * @returns {boolean} 有効な場合true
   */
  static isValidApiItem(apiItem) {
    try {
      BookmarkModel.fromRaindropApiResponse(apiItem);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default BookmarkModel;
