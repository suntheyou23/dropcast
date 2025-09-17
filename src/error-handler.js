/**
 * エラーハンドリングユーティリティ
 * 各種エラーの分類と適切な処理を提供
 */

import { getLogger } from './logger.js';

/**
 * エラー分類
 */
export const ErrorType = {
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  RAINDROP_API_ERROR: 'RAINDROP_API_ERROR',
  SES_ERROR: 'SES_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * エラー重要度
 */
export const ErrorSeverity = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

/**
 * アプリケーションエラークラス
 */
export class AppError extends Error {
  constructor(message, type = ErrorType.UNKNOWN_ERROR, severity = ErrorSeverity.MEDIUM, originalError = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * エラーハンドラークラス
 */
export class ErrorHandler {
  constructor(logger = null) {
    this.logger = logger || getLogger();
  }

  /**
   * エラーを分類
   * @param {Error} error - エラーオブジェクト
   * @returns {Object} 分類結果
   */
  classifyError(error) {
    let type = ErrorType.UNKNOWN_ERROR;
    let severity = ErrorSeverity.MEDIUM;

    // エラーメッセージやプロパティに基づく分類
    if (error.message.includes('環境変数') || error.message.includes('設定')) {
      type = ErrorType.CONFIGURATION_ERROR;
      severity = ErrorSeverity.CRITICAL;
    } else if (error.message.includes('Raindrop') || error.message.includes('API')) {
      type = ErrorType.RAINDROP_API_ERROR;
      severity = ErrorSeverity.HIGH;
    } else if (error.message.includes('SES') || error.message.includes('メール')) {
      type = ErrorType.SES_ERROR;
      severity = ErrorSeverity.HIGH;
    } else if (error.message.includes('Network') || error.message.includes('ネットワーク')) {
      type = ErrorType.NETWORK_ERROR;
      severity = ErrorSeverity.MEDIUM;
    } else if (error.message.includes('timeout') || error.message.includes('タイムアウト')) {
      type = ErrorType.TIMEOUT_ERROR;
      severity = ErrorSeverity.MEDIUM;
    }

    // AWS SDK エラーの分類
    if (error.name) {
      switch (error.name) {
        case 'AccessDenied':
        case 'UnauthorizedOperation':
          type = ErrorType.CONFIGURATION_ERROR;
          severity = ErrorSeverity.CRITICAL;
          break;
        case 'Throttling':
        case 'TooManyRequestsException':
          type = ErrorType.RAINDROP_API_ERROR;
          severity = ErrorSeverity.MEDIUM;
          break;
        case 'MessageRejected':
        case 'SendingPausedException':
          type = ErrorType.SES_ERROR;
          severity = ErrorSeverity.HIGH;
          break;
        case 'NetworkingError':
        case 'TimeoutError':
          type = ErrorType.NETWORK_ERROR;
          severity = ErrorSeverity.MEDIUM;
          break;
      }
    }

    return { type, severity };
  }

  /**
   * エラーを処理
   * @param {Error} error - エラーオブジェクト
   * @param {Object} context - 追加コンテキスト
   * @returns {AppError} 処理済みエラー
   */
  handleError(error, context = {}) {
    const { type, severity } = this.classifyError(error);

    // AppErrorの場合はそのまま使用
    if (error instanceof AppError) {
      this.logError(error, context);
      return error;
    }

    // 新しいAppErrorを作成
    const appError = new AppError(
      error.message,
      type,
      severity,
      error
    );

    this.logError(appError, context);
    return appError;
  }

  /**
   * エラーをログに記録
   * @param {AppError} error - アプリケーションエラー
   * @param {Object} context - 追加コンテキスト
   */
  logError(error, context = {}) {
    const errorData = {
      type: error.type,
      severity: error.severity,
      timestamp: error.timestamp,
      originalError: error.originalError ? {
        name: error.originalError.name,
        message: error.originalError.message,
        stack: error.originalError.stack
      } : null,
      context: context
    };

    this.logger.error(error.message, errorData);
  }

  /**
   * 復旧可能なエラーかどうかを判定
   * @param {AppError} error - アプリケーションエラー
   * @returns {boolean} 復旧可能な場合はtrue
   */
  isRecoverable(error) {
    const recoverableTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR
    ];

    const recoverableNames = [
      'Throttling',
      'TooManyRequestsException',
      'ServiceUnavailable'
    ];

    return recoverableTypes.includes(error.type) ||
           (error.originalError && recoverableNames.includes(error.originalError.name));
  }

  /**
   * エラーレスポンスを生成
   * @param {AppError} error - アプリケーションエラー
   * @returns {Object} HTTPレスポンス
   */
  generateErrorResponse(error) {
    let statusCode = 500;
    let userMessage = 'システムエラーが発生しました';

    switch (error.type) {
      case ErrorType.CONFIGURATION_ERROR:
        statusCode = 500;
        userMessage = '設定エラーが発生しました';
        break;
      case ErrorType.RAINDROP_API_ERROR:
        statusCode = 502;
        userMessage = 'ブックマーク取得サービスでエラーが発生しました';
        break;
      case ErrorType.SES_ERROR:
        statusCode = 502;
        userMessage = 'メール送信サービスでエラーが発生しました';
        break;
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT_ERROR:
        statusCode = 503;
        userMessage = 'ネットワークエラーが発生しました';
        break;
    }

    return {
      statusCode: statusCode,
      body: JSON.stringify({
        message: userMessage,
        error: {
          type: error.type,
          severity: error.severity,
          timestamp: error.timestamp
        }
      })
    };
  }

  /**
   * 重要度に基づくアラート判定
   * @param {AppError} error - アプリケーションエラー
   * @returns {boolean} アラートが必要な場合はtrue
   */
  shouldAlert(error) {
    return error.severity === ErrorSeverity.CRITICAL ||
           error.severity === ErrorSeverity.HIGH;
  }
}

/**
 * デフォルトエラーハンドラーインスタンス
 */
let defaultErrorHandler = new ErrorHandler();

/**
 * デフォルトエラーハンドラーを設定
 * @param {Logger} logger - ロガーインスタンス
 */
export function setDefaultErrorHandler(logger) {
  defaultErrorHandler = new ErrorHandler(logger);
}

/**
 * デフォルトエラーハンドラーを取得
 * @returns {ErrorHandler} エラーハンドラーインスタンス
 */
export function getErrorHandler() {
  return defaultErrorHandler;
}

export default ErrorHandler;
