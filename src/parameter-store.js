/**
 * AWS Systems Manager Parameter Store ヘルパー
 * 階層パスから一括でパラメータを取得
 */

import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';

export class ParameterStore {
  constructor(region = 'us-east-1') {
    this.ssmClient = new SSMClient({ region });
  }

  /**
   * 階層パスから全パラメータを一括取得
   * @param {string} path - Parameter Storeの階層パス
   * @param {boolean} decrypt - SecureStringを復号化するか
   * @returns {Object} パラメータのキー・バリューオブジェクト
   */
  async getParametersByPath(path, decrypt = true) {
    try {
      const command = new GetParametersByPathCommand({
        Path: path,
        Recursive: true,
        WithDecryption: decrypt,
      });

      const response = await this.ssmClient.send(command);

      // パラメータを使いやすい形式に変換
      const parameters = {};
      for (const param of response.Parameters || []) {
        // パス部分を除いてキー名のみを取得
        const key = param.Name.split('/').pop();
        parameters[key] = param.Value;
      }

      return parameters;
    } catch (error) {
      throw new Error(`Parameter Store取得エラー: ${error.message}`);
    }
  }

  /**
   * DropCast設定を取得
   * @returns {Object} DropCast設定オブジェクト
   */
  async getDropCastConfig() {
    const path = process.env.PARAMETER_STORE_PATH || '/dropcast/config';
    const parameters = await this.getParametersByPath(path);

    return {
      RAINDROP_API_TOKEN: parameters['raindrop-api-token'],
      EMAIL_FROM: parameters['email-from'],
      EMAIL_TO: parameters['email-to'],
    };
  }
}

export default ParameterStore;
