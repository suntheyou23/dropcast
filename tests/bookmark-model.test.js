/**
 * ブックマークデータモデルのテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookmarkModel, BookmarkValidator } from '../src/bookmark-model.js';

describe('BookmarkModel', () => {
    const validBookmarkData = {
        id: 'test-id-123',
        title: 'テストタイトル',
        url: 'https://example.com',
        folder: 'テストフォルダ',
        isFavorite: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z')
    };

    describe('コンストラクタ', () => {
        it('有効なデータでブックマークオブジェクトを作成できる', () => {
            const bookmark = new BookmarkModel(validBookmarkData);

            expect(bookmark.id).toBe('test-id-123');
            expect(bookmark.title).toBe('テストタイトル');
            expect(bookmark.url).toBe('https://example.com');
            expect(bookmark.folder).toBe('テストフォルダ');
            expect(bookmark.isFavorite).toBe(true);
            expect(bookmark.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
        });

        it('IDが無い場合はエラーを投げる', () => {
            const invalidData = { ...validBookmarkData, id: null };

            expect(() => new BookmarkModel(invalidData)).toThrow('id は必須の文字列です');
        });

        it('URLが無い場合はエラーを投げる', () => {
            const invalidData = { ...validBookmarkData, url: null };

            expect(() => new BookmarkModel(invalidData)).toThrow('url は必須の文字列です');
        });

        it('無効なURL形式の場合はエラーを投げる', () => {
            const invalidData = { ...validBookmarkData, url: 'invalid-url' };

            expect(() => new BookmarkModel(invalidData)).toThrow('url は有効なURL形式である必要があります');
        });

        it('isFavoriteがブール値でない場合はエラーを投げる', () => {
            const invalidData = { ...validBookmarkData, isFavorite: 'true' };

            expect(() => new BookmarkModel(invalidData)).toThrow('isFavorite はブール値である必要があります');
        });

        it('createdAtが無効な日付の場合はエラーを投げる', () => {
            const invalidData = { ...validBookmarkData, createdAt: 'invalid-date' };

            expect(() => new BookmarkModel(invalidData)).toThrow('createdAt は有効な日付である必要があります');
        });
    });

    describe('fromRaindropApiResponse', () => {
        const validApiItem = {
            _id: 'api-id-123',
            title: 'APIテストタイトル',
            link: 'https://api-example.com',
            collection: {
                title: 'APIテストフォルダ'
            },
            important: true,
            created: '2024-01-01T00:00:00.000Z'
        };

        it('有効なAPIレスポンスからブックマークオブジェクトを作成できる', () => {
            const bookmark = BookmarkModel.fromRaindropApiResponse(validApiItem);

            expect(bookmark.id).toBe('api-id-123');
            expect(bookmark.title).toBe('APIテストタイトル');
            expect(bookmark.url).toBe('https://api-example.com');
            expect(bookmark.folder).toBe('APIテストフォルダ');
            expect(bookmark.isFavorite).toBe(true);
            expect(bookmark.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
        });

        it('タイトルが無い場合はデフォルト値を設定する', () => {
            const apiItemWithoutTitle = { ...validApiItem, title: null };
            const bookmark = BookmarkModel.fromRaindropApiResponse(apiItemWithoutTitle);

            expect(bookmark.title).toBe('タイトルなし');
        });

        it('フォルダが無い場合はデフォルト値を設定する', () => {
            const apiItemWithoutCollection = { ...validApiItem, collection: null };
            const bookmark = BookmarkModel.fromRaindropApiResponse(apiItemWithoutCollection);

            expect(bookmark.folder).toBe('未分類');
        });

        it('作成日が無い場合は現在日時を設定する', () => {
            const apiItemWithoutCreated = { ...validApiItem, created: null };
            const bookmark = BookmarkModel.fromRaindropApiResponse(apiItemWithoutCreated);

            expect(bookmark.createdAt).toBeInstanceOf(Date);
        });

        it('importantがfalseの場合はisFavoriteがfalseになる', () => {
            const apiItemNotImportant = { ...validApiItem, important: false };
            const bookmark = BookmarkModel.fromRaindropApiResponse(apiItemNotImportant);

            expect(bookmark.isFavorite).toBe(false);
        });

        it('IDが無い場合はエラーを投げる', () => {
            const invalidApiItem = { ...validApiItem, _id: null };

            expect(() => BookmarkModel.fromRaindropApiResponse(invalidApiItem))
                .toThrow('APIレスポンスにIDが含まれていません');
        });

        it('リンクが無い場合はエラーを投げる', () => {
            const invalidApiItem = { ...validApiItem, link: null };

            expect(() => BookmarkModel.fromRaindropApiResponse(invalidApiItem))
                .toThrow('APIレスポンスにリンクが含まれていません');
        });

        it('無効なオブジェクトの場合はエラーを投げる', () => {
            expect(() => BookmarkModel.fromRaindropApiResponse(null))
                .toThrow('APIレスポンスアイテムが無効です');
        });
    });

    describe('fromRaindropApiResponseArray', () => {
        const validApiItems = [
            {
                _id: 'id-1',
                title: 'タイトル1',
                link: 'https://example1.com',
                collection: { title: 'フォルダ1' },
                important: true,
                created: '2024-01-01T00:00:00.000Z'
            },
            {
                _id: 'id-2',
                title: 'タイトル2',
                link: 'https://example2.com',
                collection: { title: 'フォルダ2' },
                important: false,
                created: '2024-01-02T00:00:00.000Z'
            }
        ];

        it('有効なAPIレスポンス配列からブックマーク配列を作成できる', () => {
            const bookmarks = BookmarkModel.fromRaindropApiResponseArray(validApiItems);

            expect(bookmarks).toHaveLength(2);
            expect(bookmarks[0].id).toBe('id-1');
            expect(bookmarks[1].id).toBe('id-2');
        });

        it('空配列の場合は空配列を返す', () => {
            const bookmarks = BookmarkModel.fromRaindropApiResponseArray([]);

            expect(bookmarks).toHaveLength(0);
        });

        it('無効なアイテムがある場合は警告を出力して処理を継続する', () => {
            const mixedApiItems = [
                validApiItems[0],
                { _id: null, link: 'https://invalid.com' }, // 無効なアイテム
                validApiItems[1]
            ];

            // console.warnをモック
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const bookmarks = BookmarkModel.fromRaindropApiResponseArray(mixedApiItems);

            expect(bookmarks).toHaveLength(2); // 有効なアイテムのみ
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('配列でない場合はエラーを投げる', () => {
            expect(() => BookmarkModel.fromRaindropApiResponseArray('not-array'))
                .toThrow('APIレスポンスアイテムは配列である必要があります');
        });
    });

    describe('インスタンスメソッド', () => {
        let bookmark;

        beforeEach(() => {
            bookmark = new BookmarkModel(validBookmarkData);
        });

        it('toPlainObject()でプレーンオブジェクトに変換できる', () => {
            const plainObject = bookmark.toPlainObject();

            expect(plainObject).toEqual(validBookmarkData);
            expect(plainObject).not.toBeInstanceOf(BookmarkModel);
        });

        it('toJSON()でJSON文字列に変換できる', () => {
            const jsonString = bookmark.toJSON();
            const parsed = JSON.parse(jsonString);

            expect(parsed.id).toBe(validBookmarkData.id);
            expect(parsed.title).toBe(validBookmarkData.title);
        });

        it('toString()で文字列表現を取得できる', () => {
            const stringRepresentation = bookmark.toString();

            expect(stringRepresentation).toBe('Bookmark(id=test-id-123, title="テストタイトル", folder="テストフォルダ")');
        });
    });
});

describe('BookmarkValidator', () => {
    const validData = {
        id: 'test-id',
        title: 'テストタイトル',
        url: 'https://example.com',
        folder: 'テストフォルダ',
        isFavorite: false,
        createdAt: new Date()
    };

    describe('isValid', () => {
        it('有効なデータの場合はtrueを返す', () => {
            expect(BookmarkValidator.isValid(validData)).toBe(true);
        });

        it('無効なデータの場合はfalseを返す', () => {
            const invalidData = { ...validData, id: null };
            expect(BookmarkValidator.isValid(invalidData)).toBe(false);
        });
    });

    describe('getValidationErrors', () => {
        it('有効なデータの場合は空配列を返す', () => {
            const errors = BookmarkValidator.getValidationErrors(validData);
            expect(errors).toEqual([]);
        });

        it('無効なデータの場合はエラーメッセージ配列を返す', () => {
            const invalidData = { ...validData, id: null };
            const errors = BookmarkValidator.getValidationErrors(invalidData);

            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('id は必須の文字列です');
        });
    });

    describe('isValidApiItem', () => {
        const validApiItem = {
            _id: 'api-id',
            title: 'APIタイトル',
            link: 'https://api-example.com',
            collection: { title: 'APIフォルダ' },
            important: false,
            created: '2024-01-01T00:00:00.000Z'
        };

        it('有効なAPIアイテムの場合はtrueを返す', () => {
            expect(BookmarkValidator.isValidApiItem(validApiItem)).toBe(true);
        });

        it('無効なAPIアイテムの場合はfalseを返す', () => {
            const invalidApiItem = { ...validApiItem, _id: null };
            expect(BookmarkValidator.isValidApiItem(invalidApiItem)).toBe(false);
        });
    });
});
