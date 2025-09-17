/**
 * ログユーティリティ
 * CloudWatch Logsへの構造化ログ出力を提供
 */

/**
 * ログレベル定義
 */
export const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * ログ出力クラス
 */
export class Logger {
  constructor(context = {}) {
    this.context = context;
    this.requestId = context.requestId || 'unknown';
  }

  /**
   * 構造化ログを出力
   * @param {string} level - ログレベル
   * @param {string} message - メッセージ
   * @param {Object} data - 追加データ
   */
  #log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      requestId: this.requestId,
      message: message,
      ...data
    };

    // CloudWatch Logsに出力（JSON形式）
    console.log(JSON.stringify(logEntry));
  }

  /**
   * INFOレベルログ
   * @param {string} message - メッセージ
   * @param {Object} data - 追加データ
   */
  info(message, data = {}) {
    this.#log(LogLevel.INFO, message, data);
  }

  /**
   * WARNレベルログ
   * @param {string} message - メッセージ
   * @param {Object} data - 追加データ
   */
  warn(message, data = {}) {
    this.#log(LogLevel.WARN, message, data);
  }

  /**
   * ERRORレベルログ
   * @param {string} message - メッセージ
   * @param {Object} data - 追加データ
   */
  error(message, data = {}) {
    this.#log(LogLevel.ERROR, message, data);
  }

  /**
   * DEBUGレベルログ
   * @param {string} message - メッセージ
   * @param {Object} data - 追加データ
   */
  debug(message, data = {}) {
    this.#log(LogLevel.DEBUG, message, data);
  }

  /**
   * 実行開始ログ
   * @param {Object} event - Lambdaイベント
   */
  logExecutionStart(event) {
    this.info('Lambda実行開始', {
      event: event,
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      region: process.env.AWS_REGION
    });
  }

  /**
   * 実行完了ログ
   * @param {Object} stats - 実行統計
   */
  logExecutionComplete(stats) {
    this.info('Lambda実行完了', {
      stats: stats,
      success: true
    });
  }

  /**
   * 実行エラーログ
   * @param {Error} error - エラーオブジェクト
   * @param {Object} stats - 実行統計
   */
  logExecutionError(error, stats) {
    this.error('Lambda実行エラー', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      stats: stats,
      success: false
    });
  }

  /**
   * ステップ実行ログ
   * @param {number} step - ステップ番号
   * @param {string} description - ステップ説明
   * @param {Object} data - 追加データ
   */
  logStep(step, description, data = {}) {
    this.info(`ステップ${step}: ${description}`, {
      step: step,
      ...data
    });
  }

  /**
   * API呼び出しログ
   * @param {string} apiName - API名
   * @param {Object} params - パラメータ
   * @param {Object} result - 結果
   */
  logApiCall(apiName, params, result) {
    this.info(`API呼び出し: ${apiName}`, {
      api: apiName,
      params: params,
      result: result
    });
  }

  /**
   * メトリクスログ
   * @param {string} metricName - メトリクス名
   * @param {number} value - 値
   * @param {string} unit - 単位
   */
  logMetric(metricName, value, unit = 'Count') {
    this.info(`メトリクス: ${metricName}`, {
      metric: {
        name: metricName,
        value: value,
        unit: unit
      }
    });
  }
}

/**
 * デフォルトロガーインスタンス
 */
let defaultLogger = new Logger();

/**
 * デフォルトロガーを設定
 * @param {Object} context - Lambdaコンテキスト
 */
export function setDefaultLogger(context) {
  defaultLogger = new Logger(context);
}

/**
 * デフォルトロガーを取得
 * @returns {Logger} ロガーインスタンス
 */
export function getLogger() {
  return defaultLogger;
}

export default Logger;
