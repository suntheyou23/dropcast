/**
 * DropCast ブックマークメーラー
 * Raindrop.ioからブックマークを取得し、週次ダイジェストメールを送信するAWS Lambda関数
 */

import RaindropClient from './raindrop-client.js';
import SESClient from './ses-client.js';
import ParameterStore from './parameter-store.js';
import { Logger, setDefaultLogger, getLogger } from './logger.js';
import { ErrorHandler, setDefaultErrorHandler, getErrorHandler, AppError, ErrorType, ErrorSeverity } from './error-handler.js';

/**
 * Parameter Storeから設定を取得し、検証
 * @param {Logger} logger - ロガーインスタンス
 * @returns {Object} 検証済み設定オブジェクト
 */
async function loadConfiguration(logger) {
  try {
    // Parameter Storeから設定を取得
    const paramStore = new ParameterStore();
    const config = await paramStore.getDropCastConfig();

    // 必須設定の確認
    const requiredConfig = {
      RAINDROP_API_TOKEN: config.RAINDROP_API_TOKEN,
      EMAIL_FROM: config.EMAIL_FROM,
      EMAIL_TO: config.EMAIL_TO
    };

    const optionalConfig = {
      AWS_REGION: process.env.AWS_REGION || 'us-east-1'
    };

    // 必須設定の検証
    const missingConfig = [];
    for (const [key, value] of Object.entries(requiredConfig)) {
      if (!value) {
        missingConfig.push(key);
      }
    }

    if (missingConfig.length > 0) {
      throw new AppError(
        `必須設定が取得できませんでした: ${missingConfig.join(', ')}`,
        ErrorType.CONFIGURATION_ERROR,
        ErrorSeverity.CRITICAL
      );
    }

    return {
      ...requiredConfig,
      ...optionalConfig
    };
  } catch (error) {
    throw new AppError(
      `設定取得エラー: ${error.message}`,
      ErrorType.CONFIGURATION_ERROR,
      ErrorSeverity.CRITICAL
    );
  }
}

/**
 * 実行統計を記録
 * @param {Object} stats - 実行統計
 * @param {Logger} logger - ロガーインスタンス
 */
function logExecutionStats(stats, logger) {
  // メトリクスとして記録
  logger.logMetric('ExecutionDuration', stats.duration, 'Milliseconds');
  logger.logMetric('BookmarkCount', stats.bookmarkCount, 'Count');
  logger.logMetric('EmailSent', stats.emailSent ? 1 : 0, 'Count');
}

/**
 * メインのLambdaハンドラー
 * @param {Object} event - Lambda イベントオブジェクト
 * @param {Object} context - Lambda コンテキストオブジェクト
 * @returns {Object} レスポンスオブジェクト
 */
export const handler = async (event, context) => {
  const startTime = new Date();

  // ロガーとエラーハンドラーを初期化
  setDefaultLogger(context);
  const logger = getLogger();
  setDefaultErrorHandler(logger);
  const errorHandler = getErrorHandler();

  let stats = {
    startTime: startTime.toISOString(),
    endTime: null,
    duration: 0,
    bookmarkCount: 0,
    emailSent: false,
    messageId: null
  };

  try {
    // 1. Parameter Storeから設定を取得
    const config = await loadConfiguration(logger);

    // 2. Raindrop.io クライアントの初期化
    const raindropClient = new RaindropClient(config.RAINDROP_API_TOKEN);

    // 3. SES クライアントの初期化
    const sesClient = new SESClient({
      region: config.AWS_REGION,
      fromEmail: config.EMAIL_FROM,
      toEmail: config.EMAIL_TO
    });

    // 4. 過去7日間のブックマークを取得
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const bookmarks = await raindropClient.getRecentBookmarks(startDate, endDate);
    stats.bookmarkCount = bookmarks.length;

    // 5. 週次ダイジェストメールを送信
    const emailResult = await sesClient.sendWeeklyDigest(bookmarks, {
      startDate,
      endDate
    });

    stats.emailSent = emailResult.success;
    stats.messageId = emailResult.messageId;

    logger.logApiCall('SES.sendWeeklyDigest', {
      bookmarkCount: bookmarks.length
    }, {
      success: emailResult.success,
      messageId: emailResult.messageId
    });

    // 6. 実行統計の記録
    const endTime = new Date();
    stats.endTime = endTime.toISOString();
    stats.duration = endTime.getTime() - startTime.getTime();

    logExecutionStats(stats, logger);

    // 7. 成功レスポンスを返す
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'DropCast ブックマークメーラーが正常に実行されました',
        stats: {
          executionTime: stats.duration,
          bookmarkCount: stats.bookmarkCount,
          emailSent: stats.emailSent,
          messageId: stats.messageId
        }
      })
    };

  } catch (error) {
    // エラー統計の記録
    const endTime = new Date();
    stats.endTime = endTime.toISOString();
    stats.duration = endTime.getTime() - startTime.getTime();

    // エラーを処理
    const appError = errorHandler.handleError(error, {
      event: event,
      stats: stats
    });

    logExecutionStats(stats, logger);
    logger.logExecutionError(appError, stats);

    // エラーレスポンスを生成
    return errorHandler.generateErrorResponse(appError);
  }
};
