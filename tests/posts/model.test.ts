import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPageWindow,
  getPaginationItems,
  getRankedEntries,
  mergeSearchIndex,
  normalizeText,
  parsePostsState,
  serializePostsState,
  type CatalogEntry,
} from '../../frontend/posts/model';

const sciencePost = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  path: '/posts/physics/',
  href: '/posts/physics/',
  title: '역학의 기본',
  kind: 'post',
  categories: ['science_philosophy_history'],
  categoryLabels: ['과학 철학·현대 물리학'],
  tags: ['힘'],
  description: '운동과 힘을 소개합니다.',
  content: '고전 역학의 기본을 설명합니다.',
  date: '2025-06-01',
  ...overrides,
});

test('normalizeText applies NFC, case folding, and whitespace normalization', () => {
  assert.equal(normalizeText('  CAFÉ\t수 학\n'), 'café 수 학');
  assert.equal(normalizeText('cafe\u0301'), 'café');
});

test('getRankedEntries requires every query term and searches full text metadata', () => {
  const titleMatch = sciencePost({ title: '물리학 입문', content: '기초 개념' });
  const bodyMatch = sciencePost({ path: '/posts/body/', title: '과학 노트', content: '물리학의 역학과 운동' });
  const partialMatch = sciencePost({ path: '/posts/partial/', title: '물리학 노트', content: '운동만 다룹니다' });

  const results = getRankedEntries([titleMatch, bodyMatch, partialMatch], {
    query: '물리학 역학', category: 'all', sort: 'date',
  });

  assert.deepEqual(results.map(result => result.entry.path), ['/posts/body/']);
});

test('category filtering applies to posts and leaves site pages out of the unfiltered archive', () => {
  const post = sciencePost();
  const series = sciencePost({ path: '/series/physics/', kind: 'series', categories: [], categoryLabels: [] });
  const math = sciencePost({ path: '/posts/math/', categories: ['mathematics'], categoryLabels: ['수학'], title: '수학' });

  assert.deepEqual(
    getRankedEntries([post, series, math], { query: '', category: 'science_philosophy_history', sort: 'date' })
      .map(result => result.entry.path),
    ['/posts/physics/'],
  );
  assert.deepEqual(
    getRankedEntries([post, series], { query: '', category: 'all', sort: 'date' })
      .map(result => result.entry.path),
    ['/posts/physics/'],
  );
});

test('relevance sort prioritizes title matches and uses date as a stable tie-breaker', () => {
  const bodyMatch = sciencePost({
    path: '/posts/body/', title: '과학 노트', content: '광합성 광합성 광합성', date: '2026-01-01',
  });
  const titleOlder = sciencePost({
    path: '/posts/title/', title: '광합성 이야기', content: '식물 노트', date: '2025-01-01',
  });
  const titleNewer = sciencePost({
    path: '/posts/title-newer/', title: '광합성 원리', content: '기초 노트', date: '2025-06-01',
  });

  const results = getRankedEntries([bodyMatch, titleOlder, titleNewer], {
    query: '광합성', category: 'all', sort: 'relevance',
  });

  assert.deepEqual(results.map(result => result.entry.path), ['/posts/title-newer/', '/posts/title/', '/posts/body/']);
  assert.ok(results[0].score > results[2].score);
});

test('mergeSearchIndex enriches static posts and only indexes series/tool pages', () => {
  const fallback = [
    sciencePost(),
    sciencePost({ path: '/posts/missing/', href: '/posts/missing/', title: '누락된 글' }),
  ];
  const rows = [
    { type: 'post', url: 'https://blog.test/posts/physics/', title: '역학의 기본', content: '전체 본문', category: 'science_philosophy_history', description: '설명', tags: ['힘'], date: '2025-06-01' },
    { type: 'post', url: 'https://blog.test/posts/missing/', title: '누락된 글', content: '', category: 'science_philosophy_history', description: '설명', tags: [], date: '2025-06-01' },
    { type: 'page', url: 'https://blog.test/series/physics/', title: '물리 시리즈', content: '본문', description: '설명', date: '2025-01-01' },
    { type: 'page', url: 'https://blog.test/tools/calculator/', title: '계산 도구', content: '본문', description: '설명', date: '2025-01-01' },
    { type: 'page', url: 'https://blog.test/about/', title: '소개', content: '본문', description: '설명', date: '2025-01-01' },
  ];

  const merged = mergeSearchIndex(fallback, rows, 'https://blog.test/');

  assert.equal(merged.missingPostCount, 1);
  assert.deepEqual(merged.entries.map(entry => entry.kind), ['post', 'post', 'series', 'tool']);
  assert.equal(merged.entries[0].content, '전체 본문');
  assert.equal(merged.entries[0].categories[0], 'science_philosophy_history');
  assert.equal(merged.entries[0].href, '/posts/physics/');
});

test('pagination clamps invalid pages and reports an empty range for zero results', () => {
  assert.deepEqual(getPageWindow(19, 2, 10), {
    page: 2, totalPages: 2, startIndex: 10, endIndex: 19, startNumber: 11, endNumber: 19,
  });
  assert.deepEqual(getPageWindow(0, 50, 10), {
    page: 1, totalPages: 1, startIndex: 0, endIndex: 0, startNumber: 0, endNumber: 0,
  });
  assert.equal(getPageWindow(21, -5, 10).page, 1);
  assert.equal(getPageWindow(21, 200, 10).page, 3);
});

test('pagination numbers retain first, last, neighbors, and ellipses', () => {
  assert.deepEqual(getPaginationItems(5, 10), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  assert.deepEqual(getPaginationItems(2, 3), [1, 2, 3]);
});

test('parsePostsState reads deep links and normalizes unsupported values', () => {
  const categories = new Set(['science_philosophy_history', 'mathematics_philosophy_history']);
  assert.deepEqual(
    parsePostsState('https://blog.test/posts/?q=%20%EC%97%AD%ED%95%99%20&category=science_philosophy_history&sort=relevance&page=2', categories),
    { query: '역학', category: 'science_philosophy_history', sort: 'relevance', page: 2 },
  );
  assert.deepEqual(
    parsePostsState('https://blog.test/posts/?category=deleted&sort=unknown&page=0', categories),
    { query: '', category: 'all', sort: 'date', page: 1 },
  );
  assert.equal(parsePostsState('https://blog.test/posts/?page=abc', categories).page, 1);
});

test('serializePostsState preserves unrelated URL data and omits default parameters', () => {
  const href = serializePostsState('https://blog.test/posts/?utm_source=reader&q=old&page=4', {
    query: '', category: 'all', sort: 'date', page: 1,
  });
  const url = new URL(href, 'https://blog.test');
  assert.equal(url.pathname, '/posts/');
  assert.equal(url.searchParams.get('utm_source'), 'reader');
  assert.equal(url.searchParams.has('q'), false);
  assert.equal(url.searchParams.has('category'), false);
  assert.equal(url.searchParams.has('sort'), false);
  assert.equal(url.searchParams.has('page'), false);
});
