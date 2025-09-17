/**
 * メールフォーマット機能のエッジケーステスト
 * 各フォーマット要素の詳細テストとエッジケースのテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmailFormatter } from '../src/email-formatter.js';
import { BookmarkModel } from '../src/bookmark-model.js';

describe('EmailFormatter エッジケーステスト', () => {
    describe('フォーマット要素の単体テスト', () => {
        describe('h4フォルダヘッダーフォーマット', () => {
            it('通常のフォルダ名を正しくフォーマットする', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: 'テスト',
                    url: 'https://example.com',
                    folder: '開発ツール',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain('h4. [開発ツール]');
            });

            it('英数字フォルダ名を正しくフォーマットする', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: 'Test',
                    url: 'https://example.com',
                    folder: 'JavaScript',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain('h4. [JavaScript]');
            });

            it('特殊文字を含むフォルダ名を正しくフォーマットする', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: 'テスト',
                    url: 'https://example.com',
                    folder: 'AI/ML & データサイエンス',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain('h4. [AI/ML & データサイエンス]');
            });

            it('空文字列フォルダ名は「未分類」として処理される', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: 'テスト',
                    url: 'https://example.com',
                    folder: '',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain('h4. [未分類]');
            });
        });

        describe('ブックマーク行フォーマット', () => {
            it('基本的なブックマーク行を正しくフォーマットする', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: 'テストタイトル',
                    url: 'https://example.com/test',
                    folder: 'テスト',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain('* "テストタイトル":https://example.com/test');
                expect(result).not.toContain('★');
            });

            it('お気に入りブックマーク行を正しくフォーマットする', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: 'お気に入りタイトル',
                    url: 'https://example.com/favorite',
                    folder: 'テスト',
                    isFavorite: true,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain('* "お気に入りタイトル":https://example.com/favorite %{color: red}★%');
            });

            it('引用符を含むタイトルを正しくフォーマットする', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: 'タイトル "引用符" テスト',
                    url: 'https://example.com/quotes',
                    folder: 'テスト',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain('* "タイトル "引用符" テスト":https://example.com/quotes');
            });

            it('URLパラメータを含むURLを正しくフォーマットする', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: 'パラメータテスト',
                    url: 'https://example.com/search?q=test&lang=ja&sort=date',
                    folder: 'テスト',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain('* "パラメータテスト":https://example.com/search?q=test&lang=ja&sort=date');
            });

            it('非常に長いタイトルを正しくフォーマットする', () => {
                const longTitle = 'これは非常に長いタイトルです。'.repeat(5) + '終了';
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: longTitle,
                    url: 'https://example.com/long',
                    folder: 'テスト',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain(`* "${longTitle}":https://example.com/long`);
            });
        });

        describe('お気に入りマーク付与機能', () => {
            it('isFavorite=trueの場合に★マークが付与される', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: 'お気に入り',
                    url: 'https://example.com',
                    folder: 'テスト',
                    isFavorite: true,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain(' %{color: red}★%');
            });

            it('isFavorite=falseの場合に★マークが付与されない', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: '通常',
                    url: 'https://example.com',
                    folder: 'テスト',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).not.toContain('★');
                expect(result).not.toContain('%{color: red}');
            });

            it('★マークの正確な位置と形式を確認する', () => {
                const bookmark = new BookmarkModel({
                    id: '1',
                    title: 'テスト',
                    url: 'https://example.com',
                    folder: 'テスト',
                    isFavorite: true,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                // URLの直後にスペース + %{color: red}★% が来ることを確認
                expect(result).toMatch(/https:\/\/example\.com %\{color: red\}★%/);
            });
        });
    });

    describe('フォルダ別グループ化の詳細テスト', () => {
        it('複数フォルダのブックマークが正しくグループ化される', () => {
            const bookmarks = [
                new BookmarkModel({
                    id: '1',
                    title: 'フォルダA-1',
                    url: 'https://example.com/a1',
                    folder: 'フォルダA',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                }),
                new BookmarkModel({
                    id: '2',
                    title: 'フォルダB-1',
                    url: 'https://example.com/b1',
                    folder: 'フォルダB',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T11:00:00.000Z')
                }),
                new BookmarkModel({
                    id: '3',
                    title: 'フォルダA-2',
                    url: 'https://example.com/a2',
                    folder: 'フォルダA',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T12:00:00.000Z')
                })
            ];

            const result = EmailFormatter.formatBookmarksToEmailBody(bookmarks, { includeHeader: false });

            // フォルダAのセクションが1つだけ存在することを確認
            const folderAMatches = result.match(/h4\. \[フォルダA\]/g);
            expect(folderAMatches).toHaveLength(1);

            // フォルダBのセクションが1つだけ存在することを確認
            const folderBMatches = result.match(/h4\. \[フォルダB\]/g);
            expect(folderBMatches).toHaveLength(1);

            // 各フォルダのブックマークが含まれることを確認
            expect(result).toContain('フォルダA-1');
            expect(result).toContain('フォルダA-2');
            expect(result).toContain('フォルダB-1');
        });

        it('フォルダ名が日本語の五十音順でソートされる', () => {
            const bookmarks = [
                new BookmarkModel({
                    id: '1',
                    title: 'テスト1',
                    url: 'https://example.com/1',
                    folder: 'わ行フォルダ',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                }),
                new BookmarkModel({
                    id: '2',
                    title: 'テスト2',
                    url: 'https://example.com/2',
                    folder: 'あ行フォルダ',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T11:00:00.000Z')
                }),
                new BookmarkModel({
                    id: '3',
                    title: 'テスト3',
                    url: 'https://example.com/3',
                    folder: 'か行フォルダ',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T12:00:00.000Z')
                })
            ];

            const result = EmailFormatter.formatBookmarksToEmailBody(bookmarks, { includeHeader: false });

            const aIndex = result.indexOf('h4. [あ行フォルダ]');
            const kaIndex = result.indexOf('h4. [か行フォルダ]');
            const waIndex = result.indexOf('h4. [わ行フォルダ]');

            expect(aIndex).toBeLessThan(kaIndex);
            expect(kaIndex).toBeLessThan(waIndex);
        });

        it('英数字フォルダ名が正しくソートされる', () => {
            const bookmarks = [
                new BookmarkModel({
                    id: '1',
                    title: 'テスト1',
                    url: 'https://example.com/1',
                    folder: 'Z-Folder',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                }),
                new BookmarkModel({
                    id: '2',
                    title: 'テスト2',
                    url: 'https://example.com/2',
                    folder: 'A-Folder',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T11:00:00.000Z')
                }),
                new BookmarkModel({
                    id: '3',
                    title: 'テスト3',
                    url: 'https://example.com/3',
                    folder: 'M-Folder',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T12:00:00.000Z')
                })
            ];

            const result = EmailFormatter.formatBookmarksToEmailBody(bookmarks, { includeHeader: false });

            const aIndex = result.indexOf('h4. [A-Folder]');
            const mIndex = result.indexOf('h4. [M-Folder]');
            const zIndex = result.indexOf('h4. [Z-Folder]');

            expect(aIndex).toBeLessThan(mIndex);
            expect(mIndex).toBeLessThan(zIndex);
        });

        it('各フォルダ内のブックマークが作成日時の新しい順でソートされる', () => {
            const bookmarks = [
                new BookmarkModel({
                    id: '1',
                    title: '古いブックマーク',
                    url: 'https://example.com/old',
                    folder: 'テストフォルダ',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T09:00:00.000Z')
                }),
                new BookmarkModel({
                    id: '2',
                    title: '新しいブックマーク',
                    url: 'https://example.com/new',
                    folder: 'テストフォルダ',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T12:00:00.000Z')
                }),
                new BookmarkModel({
                    id: '3',
                    title: '中間のブックマーク',
                    url: 'https://example.com/middle',
                    folder: 'テストフォルダ',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:30:00.000Z')
                })
            ];

            const result = EmailFormatter.formatBookmarksToEmailBody(bookmarks, { includeHeader: false });

            const newIndex = result.indexOf('新しいブックマーク');
            const middleIndex = result.indexOf('中間のブックマーク');
            const oldIndex = result.indexOf('古いブックマーク');

            expect(newIndex).toBeLessThan(middleIndex);
            expect(middleIndex).toBeLessThan(oldIndex);
        });
    });

    describe('エッジケース（空データ、特殊文字）', () => {
        it('空配列の場合の処理', () => {
            const result = EmailFormatter.formatBookmarksToEmailBody([]);

            expect(result).toContain('今週のブックマークダイジェスト');
            expect(result).toContain('今週は新しいブックマークがありませんでした。');
            expect(result).not.toContain('h4.');
            expect(result).not.toContain('合計');
        });

        it('nullの場合の処理', () => {
            const result = EmailFormatter.formatBookmarksToEmailBody(null);

            expect(result).toContain('今週は新しいブックマークがありませんでした。');
        });

        it('undefinedの場合の処理', () => {
            const result = EmailFormatter.formatBookmarksToEmailBody(undefined);

            expect(result).toContain('今週は新しいブックマークがありませんでした。');
        });

        it('特殊文字を含むタイトルの処理', () => {
            const specialChars = [
                '&amp;', '&lt;', '&gt;', '"', "'",
                '【】', '（）', '〈〉', '《》',
                '①②③', '★☆', '♪♫', '→←',
                'emoji 🚀 test'
            ];

            specialChars.forEach((char, index) => {
                const bookmark = new BookmarkModel({
                    id: `${index}`,
                    title: `テスト${char}タイトル`,
                    url: `https://example.com/${index}`,
                    folder: 'テスト',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain(`テスト${char}タイトル`);
            });
        });

        it('特殊文字を含むURLの処理', () => {
            const bookmark = new BookmarkModel({
                id: '1',
                title: 'URLテスト',
                url: 'https://example.com/path?query=value&other=test%20space&japanese=テスト',
                folder: 'テスト',
                isFavorite: false,
                createdAt: new Date('2024-01-01T10:00:00.000Z')
            });

            const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

            expect(result).toContain('https://example.com/path?query=value&other=test%20space&japanese=テスト');
        });

        it('特殊文字を含むフォルダ名の処理', () => {
            const specialFolders = [
                'フォルダ & テスト',
                'フォルダ < > テスト',
                'フォルダ "引用符" テスト',
                'フォルダ【括弧】テスト',
                'フォルダ★記号☆テスト'
            ];

            specialFolders.forEach((folderName, index) => {
                const bookmark = new BookmarkModel({
                    id: `${index}`,
                    title: 'テスト',
                    url: `https://example.com/${index}`,
                    folder: folderName,
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                });

                const result = EmailFormatter.formatBookmarksToEmailBody([bookmark], { includeHeader: false });

                expect(result).toContain(`h4. [${folderName}]`);
            });
        });

        it('非常に多くのブックマークの処理', () => {
            const manyBookmarks = [];
            for (let i = 0; i < 100; i++) {
                manyBookmarks.push(new BookmarkModel({
                    id: `${i}`,
                    title: `ブックマーク${i}`,
                    url: `https://example.com/${i}`,
                    folder: `フォルダ${i % 5}`, // 5つのフォルダに分散
                    isFavorite: i % 3 === 0, // 3つに1つをお気に入り
                    createdAt: new Date(`2024-01-01T${String(10 + (i % 14)).padStart(2, '0')}:00:00.000Z`)
                }));
            }

            const result = EmailFormatter.formatBookmarksToEmailBody(manyBookmarks);

            expect(result).toContain('合計 100 件のブックマークが見つかりました');

            // 各フォルダが存在することを確認
            for (let i = 0; i < 5; i++) {
                expect(result).toContain(`h4. [フォルダ${i}]`);
            }

            // お気に入りマークが適切に付与されていることを確認
            const starCount = (result.match(/%\{color: red\}★%/g) || []).length;
            expect(starCount).toBeGreaterThan(30); // 約33個のお気に入り
        });

        it('同一時刻に作成されたブックマークの処理', () => {
            const sameTimeBookmarks = [
                new BookmarkModel({
                    id: '1',
                    title: 'ブックマーク1',
                    url: 'https://example.com/1',
                    folder: 'テスト',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                }),
                new BookmarkModel({
                    id: '2',
                    title: 'ブックマーク2',
                    url: 'https://example.com/2',
                    folder: 'テスト',
                    isFavorite: false,
                    createdAt: new Date('2024-01-01T10:00:00.000Z')
                })
            ];

            const result = EmailFormatter.formatBookmarksToEmailBody(sameTimeBookmarks, { includeHeader: false });

            // 両方のブックマークが含まれることを確認
            expect(result).toContain('ブックマーク1');
            expect(result).toContain('ブックマーク2');

            // フォルダヘッダーが1つだけ存在することを確認
            const folderHeaders = result.match(/h4\. \[テスト\]/g);
            expect(folderHeaders).toHaveLength(1);
        });
    });
});
