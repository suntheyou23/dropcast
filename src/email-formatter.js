/**
 * メールフォーマット機能
 * ブックマークデータをRedmine用マークダウン形式でフォーマット
 */

/**
 * メールフォーマッタークラス
 */
export class EmailFormatter {
  /**
   * ブックマーク配列をメール本文にフォーマット
   * @param {Array<BookmarkModel>} bookmarks - ブックマーク配列
   * @param {Object} options - フォーマットオプション
   * @returns {string} フォーマット済みメール本文
   */
  static formatBookmarksToEmailBody(bookmarks, options = {}) {
    const {
      dateRange = null,
      includeHeader = true
    } = options;

    // 空データの処理
    if (!bookmarks || bookmarks.length === 0) {
      return EmailFormatter.#formatEmptyMessage(dateRange);
    }

    let emailBody = '';

    // ヘッダーの追加
    if (includeHeader) {
      emailBody += EmailFormatter.#formatHeader(bookmarks.length, dateRange);
      emailBody += '\n\n';
    }

    // フォルダ別にグループ化
    const groupedBookmarks = EmailFormatter.#groupBookmarksByFolder(bookmarks);

    // 各フォルダのブックマークをフォーマット
    const folderSections = [];
    for (const [folderName, folderBookmarks] of Object.entries(groupedBookmarks)) {
      const section = EmailFormatter.#formatFolderSection(folderName, folderBookmarks);
      folderSections.push(section);
    }

    emailBody += folderSections.join('\n\n');

    return emailBody;
  }

  /**
   * ブックマークをフォルダ別にグループ化
   * @param {Array<BookmarkModel>} bookmarks - ブックマーク配列
   * @returns {Object} フォルダ名をキーとするブックマーク配列のオブジェクト
   */
  static #groupBookmarksByFolder(bookmarks) {
    const grouped = {};

    bookmarks.forEach(bookmark => {
      const folderName = bookmark.folder || '未分類';

      if (!grouped[folderName]) {
        grouped[folderName] = [];
      }

      grouped[folderName].push(bookmark);
    });

    // フォルダ名でソート（日本語対応）
    const sortedGrouped = {};
    const sortedFolderNames = Object.keys(grouped).sort((a, b) => {
      return a.localeCompare(b, 'ja');
    });

    sortedFolderNames.forEach(folderName => {
      // 各フォルダ内のブックマークも作成日時でソート（新しい順）
      grouped[folderName].sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      sortedGrouped[folderName] = grouped[folderName];
    });

    return sortedGrouped;
  }

  /**
   * フォルダセクションをフォーマット
   * @param {string} folderName - フォルダ名
   * @param {Array<BookmarkModel>} bookmarks - そのフォルダのブックマーク配列
   * @returns {string} フォーマット済みフォルダセクション
   */
  static #formatFolderSection(folderName, bookmarks) {
    // h4. [フォルダ名] 形式
    let section = `h4. ${folderName}`;

    // 各ブックマークをフォーマット
    bookmarks.forEach(bookmark => {
      const formattedBookmark = EmailFormatter.#formatSingleBookmark(bookmark);
      section += '\n' + formattedBookmark;
    });

    return section;
  }

  /**
   * 単一ブックマークをフォーマット
   * @param {BookmarkModel} bookmark - ブックマークオブジェクト
   * @returns {string} フォーマット済みブックマーク行
   */
  static #formatSingleBookmark(bookmark) {
    // * "[タイトル]":[URL] 形式
    let formattedLine = `* "${bookmark.title}":${bookmark.url}`;

    // お気に入りマークの付与
    if (bookmark.isFavorite) {
      formattedLine += ' %{color: red}★%';
    }

    return formattedLine;
  }

  /**
   * ヘッダーをフォーマット
   * @param {number} bookmarkCount - ブックマーク数
   * @param {string|null} dateRange - 日付範囲
   * @returns {string} フォーマット済みヘッダー
   */
  static #formatHeader(bookmarkCount, dateRange = null) {
    let header = `今週のブックマークダイジェスト`;

    if (dateRange) {
      header += ` (${dateRange})`;
    }

    header += `\n\n合計 ${bookmarkCount} 件のブックマークが見つかりました。`;

    return header;
  }

  /**
   * 空データ時のメッセージをフォーマット
   * @param {string|null} dateRange - 日付範囲
   * @returns {string} 空データメッセージ
   */
  static #formatEmptyMessage(dateRange = null) {
    let message = '今週のブックマークダイジェスト';

    if (dateRange) {
      message += ` (${dateRange})`;
    }

    message += '\n\n今週は新しいブックマークがありませんでした。';

    return message;
  }

  /**
   * メール件名を生成
   * @param {Date} startDate - 開始日
   * @param {Date} endDate - 終了日
   * @returns {string} メール件名
   */
  static generateEmailSubject(startDate = null, endDate = null) {
    const now = new Date();
    const targetDate = endDate || now;

    // YYYY/MM/DD 形式
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');

    return `週次ブックマークダイジェスト - ${year}/${month}/${day}`;
  }

  /**
   * 日付範囲の文字列を生成
   * @param {Date} startDate - 開始日
   * @param {Date} endDate - 終了日
   * @returns {string} 日付範囲文字列
   */
  static formatDateRange(startDate, endDate) {
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    };

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }

  /**
   * 完全なメールコンテンツオブジェクトを生成
   * @param {Array<BookmarkModel>} bookmarks - ブックマーク配列
   * @param {Object} options - オプション
   * @returns {Object} メールコンテンツオブジェクト
   */
  static generateEmailContent(bookmarks, options = {}) {
    const {
      startDate = null,
      endDate = null,
      fromEmail = null,
      toEmail = null
    } = options;

    const dateRange = (startDate && endDate) ?
      EmailFormatter.formatDateRange(startDate, endDate) : null;

    return {
      subject: EmailFormatter.generateEmailSubject(startDate, endDate),
      body: EmailFormatter.formatBookmarksToEmailBody(bookmarks, {
        dateRange,
        includeHeader: true
      }),
      from: fromEmail,
      to: toEmail,
      bookmarkCount: bookmarks ? bookmarks.length : 0,
      dateRange: dateRange
    };
  }
}

export default EmailFormatter;
