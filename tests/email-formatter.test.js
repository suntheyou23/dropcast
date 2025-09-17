/**
 * メールフォーマット機能のテスト
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EmailFormatter } from "../src/email-formatter.js";
import { BookmarkModel } from "../src/bookmark-model.js";

describe("EmailFormatter", () => {
  let testBookmarks;

  beforeEach(() => {
    // テスト用のブックマークデータを準備
    testBookmarks = [
      new BookmarkModel({
        id: "1",
        title: "spec-workflow-mcpとは?",
        url: "https://example.com/spec-workflow",
        folder: "生成AI",
        isFavorite: false,
        createdAt: new Date("2024-01-01T10:00:00.000Z"),
      }),
      new BookmarkModel({
        id: "2",
        title: "話題のSerenaを使ってみた",
        url: "https://example.com/serena",
        folder: "生成AI",
        isFavorite: true,
        createdAt: new Date("2024-01-01T11:00:00.000Z"),
      }),
      new BookmarkModel({
        id: "3",
        title: "短いコードは本当に正しいのか",
        url: "https://example.com/short-code",
        folder: "コーディング",
        isFavorite: false,
        createdAt: new Date("2024-01-01T12:00:00.000Z"),
      }),
      new BookmarkModel({
        id: "4",
        title: "TypeScript最新機能",
        url: "https://example.com/typescript",
        folder: "コーディング",
        isFavorite: true,
        createdAt: new Date("2024-01-01T09:00:00.000Z"),
      }),
    ];
  });

  describe("formatBookmarksToEmailBody", () => {
    it("ブックマークを正しいフォーマットでメール本文に変換する", () => {
      const result = EmailFormatter.formatBookmarksToEmailBody(testBookmarks);

      // ヘッダーの確認
      expect(result).toContain("今週のブックマークダイジェスト");
      expect(result).toContain("合計 4 件のブックマークが見つかりました");

      // フォルダセクションの確認（アルファベット順）
      expect(result).toContain("h4. [コーディング]");
      expect(result).toContain("h4. [生成AI]");

      // ブックマーク形式の確認
      expect(result).toContain(
        '* "短いコードは本当に正しいのか":https://example.com/short-code'
      );
      expect(result).toContain(
        '* "TypeScript最新機能":https://example.com/typescript %{color: red}★%'
      );
      expect(result).toContain(
        '* "話題のSerenaを使ってみた":https://example.com/serena %{color: red}★%'
      );
      expect(result).toContain(
        '* "spec-workflow-mcpとは?":https://example.com/spec-workflow'
      );
    });

    it("フォルダ名でアルファベット順にソートされる", () => {
      const result = EmailFormatter.formatBookmarksToEmailBody(testBookmarks);
      const codingIndex = result.indexOf("h4. [コーディング]");
      const aiIndex = result.indexOf("h4. [生成AI]");

      expect(codingIndex).toBeLessThan(aiIndex);
    });

    it("各フォルダ内のブックマークが作成日時の新しい順にソートされる", () => {
      const result = EmailFormatter.formatBookmarksToEmailBody(testBookmarks);

      // 生成AIフォルダ内で、Serena（11:00）がspec-workflow（10:00）より先に来る
      const serenaIndex = result.indexOf("話題のSerenaを使ってみた");
      const specIndex = result.indexOf("spec-workflow-mcpとは?");
      expect(serenaIndex).toBeLessThan(specIndex);

      // コーディングフォルダ内で、短いコード（12:00）がTypeScript（09:00）より先に来る
      const shortCodeIndex = result.indexOf("短いコードは本当に正しいのか");
      const typescriptIndex = result.indexOf("TypeScript最新機能");
      expect(shortCodeIndex).toBeLessThan(typescriptIndex);
    });

    it("お気に入りブックマークに★マークが付与される", () => {
      const result = EmailFormatter.formatBookmarksToEmailBody(testBookmarks);

      expect(result).toContain(
        '* "話題のSerenaを使ってみた":https://example.com/serena %{color: red}★%'
      );
      expect(result).toContain(
        '* "TypeScript最新機能":https://example.com/typescript %{color: red}★%'
      );
    });

    it("お気に入りでないブックマークに★マークが付与されない", () => {
      const result = EmailFormatter.formatBookmarksToEmailBody(testBookmarks);

      expect(result).toContain(
        '* "spec-workflow-mcpとは?":https://example.com/spec-workflow'
      );
      expect(result).not.toContain(
        '* "spec-workflow-mcpとは?":https://example.com/spec-workflow %{color: red}★%'
      );
    });

    it("日付範囲オプションが指定された場合はヘッダーに含まれる", () => {
      const result = EmailFormatter.formatBookmarksToEmailBody(testBookmarks, {
        dateRange: "2024/01/01 - 2024/01/07",
      });

      expect(result).toContain(
        "今週のブックマークダイジェスト (2024/01/01 - 2024/01/07)"
      );
    });

    it("ヘッダーを含めないオプションが指定された場合はヘッダーが省略される", () => {
      const result = EmailFormatter.formatBookmarksToEmailBody(testBookmarks, {
        includeHeader: false,
      });

      expect(result).not.toContain("今週のブックマークダイジェスト");
      expect(result).not.toContain("合計 4 件のブックマークが見つかりました");
      expect(result).toContain("h4. [コーディング]");
    });

    it("空のブックマーク配列の場合は空データメッセージを返す", () => {
      const result = EmailFormatter.formatBookmarksToEmailBody([]);

      expect(result).toContain("今週のブックマークダイジェスト");
      expect(result).toContain("今週は新しいブックマークがありませんでした。");
    });

    it("nullまたはundefinedの場合は空データメッセージを返す", () => {
      const resultNull = EmailFormatter.formatBookmarksToEmailBody(null);
      const resultUndefined =
        EmailFormatter.formatBookmarksToEmailBody(undefined);

      expect(resultNull).toContain(
        "今週は新しいブックマークがありませんでした。"
      );
      expect(resultUndefined).toContain(
        "今週は新しいブックマークがありませんでした。"
      );
    });

    it("フォルダが未分類のブックマークは「未分類」フォルダに分類される", () => {
      const unsortedBookmark = new BookmarkModel({
        id: "5",
        title: "未分類のブックマーク",
        url: "https://example.com/unsorted",
        folder: "",
        isFavorite: false,
        createdAt: new Date("2024-01-01T13:00:00.000Z"),
      });

      const result = EmailFormatter.formatBookmarksToEmailBody([
        unsortedBookmark,
      ]);

      expect(result).toContain("h4. [未分類]");
      expect(result).toContain(
        '* "未分類のブックマーク":https://example.com/unsorted'
      );
    });
  });

  describe("generateEmailSubject", () => {
    it("現在日付を使用してメール件名を生成する", () => {
      const testDate = new Date("2024-01-15T10:00:00.000Z");
      const result = EmailFormatter.generateEmailSubject(null, testDate);

      expect(result).toBe("週次ブックマークダイジェスト - 2024/01/15");
    });

    it("指定された終了日を使用してメール件名を生成する", () => {
      const startDate = new Date("2024-01-01T00:00:00.000Z");
      const endDate = new Date("2024-01-07T00:00:00.000Z");
      const result = EmailFormatter.generateEmailSubject(startDate, endDate);

      expect(result).toBe("週次ブックマークダイジェスト - 2024/01/07");
    });

    it("月と日が1桁の場合は0埋めされる", () => {
      const testDate = new Date("2024-03-05T10:00:00.000Z");
      const result = EmailFormatter.generateEmailSubject(null, testDate);

      expect(result).toBe("週次ブックマークダイジェスト - 2024/03/05");
    });
  });

  describe("formatDateRange", () => {
    it("開始日と終了日から日付範囲文字列を生成する", () => {
      const startDate = new Date("2024-01-01T00:00:00.000Z");
      const endDate = new Date("2024-01-07T00:00:00.000Z");
      const result = EmailFormatter.formatDateRange(startDate, endDate);

      expect(result).toBe("2024/01/01 - 2024/01/07");
    });

    it("月と日が1桁の場合は0埋めされる", () => {
      const startDate = new Date("2024-03-05T00:00:00.000Z");
      const endDate = new Date("2024-03-09T00:00:00.000Z");
      const result = EmailFormatter.formatDateRange(startDate, endDate);

      expect(result).toBe("2024/03/05 - 2024/03/09");
    });
  });

  describe("generateEmailContent", () => {
    it("完全なメールコンテンツオブジェクトを生成する", () => {
      const startDate = new Date("2024-01-01T00:00:00.000Z");
      const endDate = new Date("2024-01-07T00:00:00.000Z");
      const options = {
        startDate,
        endDate,
        fromEmail: "sender@example.com",
        toEmail: "recipient@example.com",
      };

      const result = EmailFormatter.generateEmailContent(
        testBookmarks,
        options
      );

      expect(result.subject).toBe("週次ブックマークダイジェスト - 2024/01/07");
      expect(result.body).toContain(
        "今週のブックマークダイジェスト (2024/01/01 - 2024/01/07)"
      );
      expect(result.body).toContain("h4. [コーディング]");
      expect(result.from).toBe("sender@example.com");
      expect(result.to).toBe("recipient@example.com");
      expect(result.bookmarkCount).toBe(4);
      expect(result.dateRange).toBe("2024/01/01 - 2024/01/07");
    });

    it("空のブックマーク配列の場合はbookmarkCountが0になる", () => {
      const result = EmailFormatter.generateEmailContent([]);

      expect(result.bookmarkCount).toBe(0);
      expect(result.body).toContain(
        "今週は新しいブックマークがありませんでした。"
      );
    });

    it("日付が指定されない場合はdateRangeがnullになる", () => {
      const result = EmailFormatter.generateEmailContent(testBookmarks);

      expect(result.dateRange).toBeNull();
      expect(result.body).not.toContain("(2024/");
    });

    it("メールアドレスが指定されない場合はnullになる", () => {
      const result = EmailFormatter.generateEmailContent(testBookmarks);

      expect(result.from).toBeNull();
      expect(result.to).toBeNull();
    });
  });

  describe("エッジケース", () => {
    it("特殊文字を含むタイトルとURLを正しく処理する", () => {
      const specialBookmark = new BookmarkModel({
        id: "1",
        title: 'タイトル "引用符" & アンパサンド',
        url: "https://example.com/path?param=value&other=123",
        folder: "テスト",
        isFavorite: false,
        createdAt: new Date("2024-01-01T10:00:00.000Z"),
      });

      const result = EmailFormatter.formatBookmarksToEmailBody([
        specialBookmark,
      ]);

      expect(result).toContain(
        '* "タイトル "引用符" & アンパサンド":https://example.com/path?param=value&other=123'
      );
    });

    it("非常に長いタイトルを正しく処理する", () => {
      const longTitleBookmark = new BookmarkModel({
        id: "1",
        title: "これは非常に長いタイトルです。".repeat(10),
        url: "https://example.com/long-title",
        folder: "テスト",
        isFavorite: false,
        createdAt: new Date("2024-01-01T10:00:00.000Z"),
      });

      const result = EmailFormatter.formatBookmarksToEmailBody([
        longTitleBookmark,
      ]);

      expect(result).toContain("h4. [テスト]");
      expect(result).toContain(longTitleBookmark.title);
    });

    it("同じフォルダ名の複数ブックマークを正しくグループ化する", () => {
      const sameFolder = [
        new BookmarkModel({
          id: "1",
          title: "ブックマーク1",
          url: "https://example.com/1",
          folder: "同じフォルダ",
          isFavorite: false,
          createdAt: new Date("2024-01-01T10:00:00.000Z"),
        }),
        new BookmarkModel({
          id: "2",
          title: "ブックマーク2",
          url: "https://example.com/2",
          folder: "同じフォルダ",
          isFavorite: true,
          createdAt: new Date("2024-01-01T11:00:00.000Z"),
        }),
      ];

      const result = EmailFormatter.formatBookmarksToEmailBody(sameFolder);

      // h4.ヘッダーが1つだけ存在することを確認
      const folderHeaders = result.match(/h4\. \[同じフォルダ\]/g);
      expect(folderHeaders).toHaveLength(1);

      // 両方のブックマークが含まれることを確認
      expect(result).toContain("ブックマーク1");
      expect(result).toContain("ブックマーク2");
    });
  });
});
