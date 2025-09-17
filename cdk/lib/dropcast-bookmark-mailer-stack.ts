/**
 * DropCast ブックマークメーラー CDK スタック
 * Lambda関数、EventBridge、CloudWatch Logsなどのリソースを定義
 */

import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export class DropcastBookmarkMailerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 環境変数の取得（.envファイルから）
    const raindropApiToken = process.env.RAINDROP_API_TOKEN;
    const emailFrom = process.env.EMAIL_FROM;
    const emailTo = process.env.EMAIL_TO;
    const awsRegion = process.env.AWS_REGION || "us-east-1";

    // 環境変数の検証
    if (!raindropApiToken || !emailFrom || !emailTo) {
      throw new Error(
        "必要な環境変数が設定されていません。\n" +
          ".envファイルを作成し、以下の変数を設定してください:\n" +
          "  RAINDROP_API_TOKEN=your_token\n" +
          "  EMAIL_FROM=sender@example.com\n" +
          "  EMAIL_TO=recipient@example.com\n" +
          "\n.env.exampleファイルを参考にしてください。"
      );
    }

    // Parameter Store パラメータの作成（階層構造）
    // シンプルなStringParameterを使用（CDK v2対応）
    const raindropApiTokenParameter = new ssm.StringParameter(
      this,
      "RaindropApiTokenParameter",
      {
        parameterName: "/dropcast/config/raindrop-api-token",
        stringValue: raindropApiToken,
        description: "Raindrop.io API Token for DropCast",
        // 注意: 実際の本番環境では、手動でSecureStringに変更することを推奨
      }
    );

    const emailFromParameter = new ssm.StringParameter(
      this,
      "EmailFromParameter",
      {
        parameterName: "/dropcast/config/email-from",
        stringValue: emailFrom,
        description: "Sender email address for DropCast",
      }
    );

    const emailToParameter = new ssm.StringParameter(this, "EmailToParameter", {
      parameterName: "/dropcast/config/email-to",
      stringValue: emailTo,
      description: "Recipient email address for DropCast",
    });

    // CloudWatch Logs グループ（シンプルな設定）
    const logGroup = new logs.LogGroup(this, "DropcastLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH, // 30日間保持（要件通り）
      removalPolicy: cdk.RemovalPolicy.DESTROY, // スタック削除時にログも削除
    });

    // Lambda関数（NodejsFunction使用）
    const bookmarkMailerFunction = new nodejs.NodejsFunction(
      this,
      "DropcastBookmarkMailerFunction",
      {
        functionName: "dropcast-bookmark-mailer",
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset("../src"),
        handler: "index.handler",
        timeout: cdk.Duration.minutes(5),
        logGroup: logGroup,
        environment: {
          PARAMETER_STORE_PATH: "/dropcast/config",
        },
        description:
          "Raindrop.ioから週次ブックマークを取得してダイジェストメールを送信",
        bundling: {
          externalModules: [],
          nodeModules: ["@aws-sdk/client-ses", "@aws-sdk/client-ssm", "axios"],
        },
      }
    );

    // SESメール送信権限を追加
    bookmarkMailerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: [`arn:aws:ses:${awsRegion}:${this.account}:identity/*`],
      })
    );

    // Parameter Store階層読み取り権限を追加（一括取得用）
    bookmarkMailerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
          "ssm:GetParameter",
        ],
        resources: [
          `arn:aws:ssm:${awsRegion}:${this.account}:parameter/dropcast/config`,
          `arn:aws:ssm:${awsRegion}:${this.account}:parameter/dropcast/config/*`,
        ],
      })
    );

    // EventBridge Scheduler用のIAMロール
    const schedulerRole = new iam.Role(this, "DropcastSchedulerRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
      inlinePolicies: {
        LambdaInvokePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["lambda:InvokeFunction"],
              resources: [bookmarkMailerFunction.functionArn],
            }),
          ],
        }),
      },
    });

    // EventBridge Scheduler（毎週木曜日 00:00 JST）
    const schedule = new scheduler.CfnSchedule(this, "DropcastWeeklySchedule", {
      name: "dropcast-weekly-schedule",
      description: "毎週木曜日00:00(JST)にDropCastブックマークメーラーを実行",
      scheduleExpression: "cron(0 0 ? * THU *)", // 毎週木曜日00:00
      scheduleExpressionTimezone: "Asia/Tokyo", // JSTタイムゾーン
      flexibleTimeWindow: {
        mode: "OFF", // 柔軟な時間ウィンドウを無効化
      },
      target: {
        arn: bookmarkMailerFunction.functionArn,
        roleArn: schedulerRole.roleArn,
      },
    });

    // Lambda関数のエラーアラーム（シンプルな設定）
    const errorAlarm = bookmarkMailerFunction
      .metricErrors()
      .createAlarm(this, "DropcastErrorAlarm", {
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: "DropCast ブックマークメーラーでエラーが発生しました",
      });

    // Lambda関数の実行時間アラーム
    const durationAlarm = bookmarkMailerFunction
      .metricDuration()
      .createAlarm(this, "DropcastDurationAlarm", {
        threshold: cdk.Duration.minutes(4).toMilliseconds(),
        evaluationPeriods: 1,
        alarmDescription: "DropCast ブックマークメーラーの実行時間が長すぎます",
      });
  }
}
