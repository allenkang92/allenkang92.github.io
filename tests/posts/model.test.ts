import assert from 'node:assert/strict';
import test from 'node:test';
import { Window } from 'happy-dom';
import {
  decodeFallbackPosts,
  decodeSearchText,
  getPageWindow,
  getPaginationItems,
  getRankedEntries,
  mergeSearchIndex,
  normalizePath,
  normalizeText,
  normalizedTextMap,
  parsePostsState,
  serializePostsState,
  type CatalogEntry,
} from '../../frontend/posts/model';

test('검색 텍스트의 문자 참조는 한 번만 안전하게 해독한다', async () => {
  const browser = new Window();
  const doc = browser.document as unknown as Document;
  try {
    assert.equal(decodeSearchText('&lt;h1&gt; &amp;lt;h1&amp;gt; &copy; &#x1f600;', doc), '<h1> &lt;h1&gt; © 😀');
    assert.equal(decodeSearchText('</textarea><img src=x onerror=alert(1)>&amp;', doc), '</textarea><img src=x onerror=alert(1)>&');
    assert.equal(doc.querySelector('img, script'), null);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('색인과 정적 폴백의 태그 예제를 원문으로 검색한다', async () => {
  const browser = new Window();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: browser.document, configurable: true });
  try {
    const [fallback] = decodeFallbackPosts([sciencePost({ content: '&lt;fieldset&gt; 폴백' })]);
    const fallbackOnly = mergeSearchIndex([fallback], [], 'https://blog.test/');
    assert.equal(getRankedEntries(fallbackOnly.entries, { query: '<fieldset>', category: 'all', sort: 'relevance' }).length, 1);
    const withIndex = mergeSearchIndex([fallback], [{
      type: 'post', url: '/posts/physics/', title: '역학의 기본', category: 'science', tags: [],
      description: '', content: '&lt;h1&gt; 예제', date: '2025-06-01',
    }], 'https://blog.test/');
    assert.equal(getRankedEntries(withIndex.entries, { query: '<h1>', category: 'all', sort: 'relevance' }).length, 1);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
    await browser.happyDOM.abort();
  }
});

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

const indexRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'page', url: '/tools/unit-converter/', title: '단위 변환기',
  category: 'Uncategorized', tags: [], description: '파운드 변환', content: '', date: '',
  ...overrides,
});

test('성과 목록과 임의 permalink 상세를 검색하되 글 목록·카테고리와 경계를 지킨다', () => {
  const rows = [
    indexRow({ url: 'https://blog.test/blog/achievements/', title: '성과', description: '성과 목록' }),
    indexRow({ url: 'https://blog.test/blog/profile/certs/', page_kind: 'achievement', title: 'Certifications', content: 'Information Processing Engineer', language: 'en' }),
  ];
  const merged = mergeSearchIndex([], rows, 'https://blog.test/blog', ['/blog/achievements/', '/blog/profile/certs/'], ['/blog/profile/certs/']);
  assert.equal(merged.missingPageCount, 0);
  assert.equal(merged.invalidRowCount, 0);
  assert.deepEqual(merged.entries.map(entry => entry.kind), ['achievement', 'achievement']);
  assert.equal(merged.entries[1].language, 'en');
  assert.deepEqual(getRankedEntries(merged.entries, { query: 'Information Processing Engineer', category: 'all', sort: 'relevance' }).map(item => item.entry.href), ['/blog/profile/certs/']);
  assert.equal(getRankedEntries(merged.entries, { query: '', category: 'all', sort: 'date' }).length, 0);
  assert.equal(getRankedEntries(merged.entries, { query: 'Information', category: 'science', sort: 'relevance' }).length, 0);
});

test('예상되지 않은 성과 종류와 손상된 언어 태그를 구분한다', () => {
  const expectedPages = ['/blog/profile/certs/', '/blog/tools/example/'];
  const expectedAchievements = ['/blog/profile/certs/'];
  const result = mergeSearchIndex([], [
    indexRow({ url: '/blog/profile/certs/', page_kind: 'achievement', title: 'Certifications', language: 'not valid !' }),
    indexRow({ url: '/blog/tools/example/', page_kind: 'achievement', title: '잘못 표시된 도구' }),
  ], 'https://blog.test/blog', expectedPages, expectedAchievements);
  assert.equal(result.invalidRowCount, 2);
  assert.equal(result.missingPageCount, 1);
  assert.deepEqual(result.entries.map(entry => [entry.title, entry.language]), [['Certifications', undefined]]);
  const missingKind = mergeSearchIndex([], [indexRow({ url: '/blog/profile/certs/', title: 'Certifications' })], 'https://blog.test/blog', ['/blog/profile/certs/'], expectedAchievements);
  assert.equal(missingKind.invalidRowCount, 1);
  assert.equal(missingKind.missingPageCount, 1);
  const mismatchedPost = mergeSearchIndex([sciencePost()], [{
    ...indexRow(), type: 'post', page_kind: 'achievement', url: '/posts/physics/',
  }], 'https://blog.test/');
  assert.equal(mismatchedPost.invalidRowCount, 1);
  assert.equal(mismatchedPost.entries[0].kind, 'post');
});

test('normalizeText applies NFC, case folding, and whitespace normalization', () => {
  assert.equal(normalizeText('  CAFÉ\t수 학\n'), 'café 수 학');
  assert.equal(normalizeText('cafe\u0301'), 'café');
  assert.equal(normalizeText('H\u0331'), normalizeText('ẖ'));
});

test('original offsets remain usable when grapheme segmentation is unavailable', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
  Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true });
  try {
    const original = 'İ 가 H\u0331';
    const { normalized, starts, ends } = normalizedTextMap(original);
    for (const [needle, expected] of [['가', '가'], ['ẖ', 'H\u0331']]) {
      const index = normalized.indexOf(needle);
      assert.ok(index >= 0);
      assert.equal(original.slice(starts[index], ends[index + needle.length - 1]), expected);
    }
  } finally {
    if (descriptor) Object.defineProperty(Intl, 'Segmenter', descriptor);
  }
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

test('검색에 보이지 않는 페이지 분류는 제외하고 실제 콘텐츠와 글 분류는 검색한다', () => {
  const post = sciencePost({
    path: '/posts/category/', categories: ['uncategorized'], categoryLabels: ['미분류'],
    title: '글 제목', description: '', content: '', tags: [],
  });
  const rows = [
    indexRow({ url: '/tools/plain/', title: '단위 변환기', description: '단위 안내' }),
    indexRow({ url: '/series/title/', title: 'Uncategorized 소개', description: '' }),
    indexRow({ url: '/tools/description/', title: '도구 설명', description: 'Uncategorized 설명' }),
    indexRow({ url: '/achievements/content/', page_kind: 'achievement', title: '성과 상세', description: '', content: 'Uncategorized 본문' }),
  ];
  const expectedPages = ['/tools/plain/', '/series/title/', '/tools/description/', '/achievements/content/'];
  const merged = mergeSearchIndex([post], rows, 'https://blog.test/', expectedPages, ['/achievements/content/']);
  assert.equal(merged.invalidRowCount, 0);
  assert.equal(merged.missingPageCount, 0);

  const matches = getRankedEntries(merged.entries, { query: 'uncategorized', category: 'all', sort: 'relevance' });
  assert.deepEqual(matches.map(result => result.entry.path), [
    '/series/title', '/tools/description', '/posts/category', '/achievements/content',
  ]);
  assert.equal(matches.some(result => result.entry.path === '/tools/plain'), false);
  assert.deepEqual(
    getRankedEntries(merged.entries, { query: '미분류', category: 'all', sort: 'relevance' })
      .map(result => result.entry.path),
    ['/posts/category'],
  );
  assert.deepEqual(
    getRankedEntries(merged.entries, { query: 'uncategorized 안내', category: 'all', sort: 'relevance' })
      .map(result => result.entry.path),
    [],
  );
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

test('손상된 페이지 항목은 글 본문이 모두 있어도 불완전한 인덱스로 표시한다', () => {
  const merged = mergeSearchIndex([sciencePost()], [
    indexRow({ type: 'post', url: '/posts/physics/', title: '역학의 기본', content: '전체 본문' }),
    indexRow({ url: '/tools/unit-converter/', title: null }),
    indexRow({ url: '/tools/acceleration/', title: '가속도 계산기' }),
  ], 'https://blog.test/');
  assert.equal(merged.missingPostCount, 0);
  assert.equal(merged.invalidRowCount, 1);
  assert.ok(merged.entries.some(entry => entry.title === '가속도 계산기'));
});

test('필수 검색 필드가 누락되면 사용 가능한 결과를 유지하면서 인덱스 손상을 알린다', () => {
  for (const field of ['category', 'tags', 'description', 'content', 'date']) {
    const damaged = indexRow();
    delete damaged[field];
    const result = mergeSearchIndex([], [damaged], 'https://blog.test/', ['/tools/unit-converter/']);
    assert.equal(result.invalidRowCount, 1, `${field} 누락을 감지해야 한다`);
    assert.equal(result.missingPageCount, 0, '주소와 제목이 유효한 페이지는 부분 결과로 남긴다');
    assert.equal(result.entries.length, 1);
  }
  const complete = mergeSearchIndex([], [indexRow()], 'https://blog.test/', ['/tools/unit-converter/']);
  assert.equal(complete.invalidRowCount, 0);
  assert.equal(getRankedEntries(complete.entries, { query: '파운드', category: 'all', sort: 'relevance' }).length, 1);

  const damagedPost = indexRow({ type: 'post', url: '/posts/physics/', title: '역학의 기본', content: '전체 본문' });
  delete damagedPost.description;
  const postResult = mergeSearchIndex([sciencePost()], [damagedPost], 'https://blog.test/');
  assert.equal(postResult.invalidRowCount, 1);
  assert.equal(postResult.missingPostCount, 0);
  assert.equal(postResult.entries[0].description, sciencePost().description, '정적 글 데이터로 복구 가능한 설명을 유지한다');
  assert.equal(postResult.entries[0].content, '전체 본문');
});

test('손상된 행은 종류별로 한 번씩 알리고 사용 가능한 부분 데이터는 유지한다', () => {
  const merged = mergeSearchIndex([sciencePost()], [
    indexRow({ type: 'post', url: '/posts/physics/', title: '역학의 기본', content: '전체 본문' }),
    null,
    indexRow({ url: '/tools/blank/', title: '  ' }),
    indexRow({ url: '/tools/partial/', title: '부분 계산기', tags: [42] }),
    indexRow({ type: 'unknown', url: '/ignored/', title: '지원하지 않는 항목' }),
  ], 'https://blog.test/');
  assert.equal(merged.invalidRowCount, 4);
  assert.equal(merged.missingPostCount, 0);
  assert.ok(merged.entries.some(entry => entry.title === '부분 계산기'));
  assert.ok(!merged.entries.some(entry => entry.path === '/tools/blank'));
});

test('누락된 안내 페이지를 감지하고 중복된 기대 경로는 한 번만 센다', () => {
  const rows = [
    indexRow({ type: 'post', url: 'https://blog.test/blog/posts/physics/', title: '역학', content: '본문' }),
    indexRow({ url: 'https://blog.test/blog/tools/', title: '도구' }),
  ];
  const post = sciencePost({ path: '/blog/posts/physics/', href: '/blog/posts/physics/' });
  const expectedPages = ['/blog/tools/', '/blog/tools/unit-converter/', '/blog/tools/unit-converter'];
  const merged = mergeSearchIndex([post], rows, 'https://blog.test/blog', expectedPages);
  assert.equal(merged.missingPostCount, 0);
  assert.equal(merged.invalidRowCount, 0);
  assert.equal(merged.missingPageCount, 1);
  assert.equal(mergeSearchIndex([post], rows, 'https://blog.test/blog', []).missingPageCount, 0);
});

test('중복된 색인은 본문이 잘린 행이 먼저여도 완전하다고 판단하지 않는다', () => {
  const short = indexRow({ type: 'post', url: '/posts/physics/', title: '역학', content: '짧은 본문' });
  const complete = { ...short, content: '고유 검색어가 있는 전체 본문' };
  for (const rows of [[short, complete], [complete, short]]) {
    const result = mergeSearchIndex([sciencePost()], rows, 'https://blog.test/', []);
    assert.equal(result.missingPostCount, 0);
    assert.equal(result.invalidRowCount, 1);
    assert.equal(result.entries.length, 1);
  }
  const page = indexRow();
  const duplicatePage = mergeSearchIndex([], [page, { ...page }], 'https://blog.test/', ['/tools/unit-converter/']);
  assert.equal(duplicatePage.invalidRowCount, 1);
  assert.equal(duplicatePage.entries.length, 1);
  const samePathDifferentTypes = mergeSearchIndex([sciencePost()], [
    indexRow({ type: 'post', url: '/posts/physics/', title: '역학', content: '본문' }),
    indexRow({ type: 'page', url: '/posts/physics/', title: '중복 페이지' }),
  ], 'https://blog.test/', []);
  assert.equal(samePathDifferentTypes.invalidRowCount, 1);
  assert.equal(samePathDifferentTypes.entries.length, 1);
});

test('예상 글 및 안내 페이지 밖의 오래된 항목은 검색에서 제외하고 손상을 알린다', () => {
  const result = mergeSearchIndex([sciencePost()], [
    indexRow({ type: 'post', url: '/posts/physics/', title: '역학', content: '본문' }),
    indexRow({ type: 'post', url: '/posts/old/', title: '오래된 글', content: '본문' }),
    indexRow({ url: '/tools/unit-converter/', title: '현재 도구' }),
    indexRow({ url: '/tools/old/', title: '오래된 도구' }),
    indexRow({ url: '/about/', title: '소개' }),
  ], 'https://blog.test/', ['/tools/unit-converter/']);
  assert.equal(result.invalidRowCount, 2);
  assert.equal(result.missingPostCount, 0);
  assert.equal(result.missingPageCount, 0);
  assert.deepEqual(result.entries.map(entry => entry.title), ['역학', '현재 도구']);
});

test('검색 인덱스 주소는 같은 사이트의 기저 경로만 허용하고 인코딩을 보존한다', () => {
  const result = mergeSearchIndex([sciencePost({ path: '/blog/%2Fevil.com', href: '/blog/%2Fevil.com' })], [
    indexRow({ type: 'post', url: 'https://blog.test/blog/%2Fevil.com', title: '인코딩된 슬래시' }),
    indexRow({ url: 'https://blog.test/blog/tools/%3Ffilter/', title: '인코딩된 물음표' }),
    indexRow({ url: 'https://blog.test/blog/tools/계산기/', title: '한글 경로' }),
    indexRow({ type: 'post', url: 'javascript:alert(1)', title: '스크립트' }),
    indexRow({ type: 'post', url: 'https://evil.test/blog/a/', title: '다른 사이트' }),
    indexRow({ type: 'post', url: 'https://blog.test/blog-other/a/', title: '기저 경로 외부' }),
    indexRow({ type: 'post', url: 'https://blog.test//evil.test/', title: '프로토콜 상대 경로' }),
    indexRow({ type: 'post', url: 'ftp://blog.test/blog/a/', title: '지원하지 않는 프로토콜' }),
  ], 'https://blog.test/blog');
  assert.equal(result.invalidRowCount, 5);
  assert.deepEqual(result.entries.map(entry => entry.href), [
    '/blog/%2Fevil.com', '/blog/tools/%3Ffilter/', '/blog/tools/%EA%B3%84%EC%82%B0%EA%B8%B0/',
  ]);
});

test('사이트 루트의 이중 슬래시는 외부 주소로 해석될 수 있어 제외한다', () => {
  const result = mergeSearchIndex([sciencePost({ path: '/%2Fevil.test', href: '/%2Fevil.test' })], [
    indexRow({ type: 'post', url: 'https://blog.test//evil.test/', title: '위험한 경로' }),
    indexRow({ type: 'post', url: 'https://blog.test/%2Fevil.test', title: '인코딩된 경로' }),
  ], 'https://blog.test/');
  assert.equal(result.invalidRowCount, 1);
  assert.deepEqual(result.entries.map(entry => entry.href), ['/%2Fevil.test']);
});

test('인코딩된 구분자와 이중 인코딩은 서로 다른 글 주소로 취급한다', () => {
  for (const [fallbackPath, indexPath] of [
    ['/posts/a/b/', '/posts/a%2Fb/'],
    ['/posts/a%2Fb/', '/posts/a%252Fb/'],
    ['/blog/posts/a/b/', '/blog/posts/a%2Fb/'],
  ]) {
    const base = fallbackPath.startsWith('/blog/') ? 'https://blog.test/blog' : 'https://blog.test/';
    const original = sciencePost({ path: fallbackPath, href: fallbackPath, title: '정적 글', content: '정적 본문' });
    const row = indexRow({ type: 'post', url: `https://blog.test${indexPath}`, title: '다른 글', content: '다른 본문' });
    const result = mergeSearchIndex([original], [row], base);
    assert.equal(result.missingPostCount, 1, `${fallbackPath}와 ${indexPath}는 달라야 합니다`);
    assert.equal(result.invalidRowCount, 1, '예상하지 못한 색인 글은 불완전 상태로 보고한다');
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].title, '정적 글');
    assert.equal(result.entries[0].content, '정적 본문');
    assert.equal(result.entries[0].href, fallbackPath);
  }
});

test('인코딩된 경로 구분자는 실제 도구 경로와 동일하게 분류하지 않는다', () => {
  for (const basePath of ['', '/blog']) {
    const base = `https://blog.test${basePath}`;
    const result = mergeSearchIndex([], [
      indexRow({ url: `https://blog.test${basePath}/tools%2Funit-converter/`, title: '다른 경로' }),
    ], base, [`${basePath}/tools/unit-converter/`]);
    assert.equal(result.missingPageCount, 1);
    assert.equal(result.entries.length, 0);
  }
});

test('URL 인코딩 대소문자는 통일하되 다른 한글 정규형은 합치지 않는다', () => {
  const composed = '/posts/가/';
  const decomposed = '/posts/가/';
  const composedEncoded = '/posts/%ea%b0%80/';
  assert.equal(normalizePath(composed), normalizePath(composedEncoded));
  assert.notEqual(normalizePath(composed), normalizePath(decomposed));
  const original = sciencePost({ path: composed, href: composed, title: '정적 글', content: '정적 본문' });
  const different = indexRow({ type: 'post', url: `https://blog.test${decomposed}`, title: '다른 글', content: '다른 본문' });
  assert.equal(mergeSearchIndex([original], [different], 'https://blog.test/').missingPostCount, 1);
  const same = indexRow({ type: 'post', url: `https://blog.test${composedEncoded}`, title: '색인 글', content: '완전한 본문' });
  const result = mergeSearchIndex([original], [same], 'https://blog.test/');
  assert.equal(result.missingPostCount, 0);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].content, '완전한 본문');
  assert.equal(result.entries[0].href, composed);
});

test('인코딩 대소문자가 다른 하위 경로도 같은 기저 경로로 검증한다', () => {
  const result = mergeSearchIndex([], [
    indexRow({ url: 'https://blog.test/%EA%B0%80/tools/unit-converter/', title: '단위 변환기' }),
  ], 'https://blog.test/%ea%b0%80', ['/%ea%b0%80/tools/unit-converter/']);
  assert.equal(result.invalidRowCount, 0);
  assert.equal(result.missingPageCount, 0);
  assert.equal(result.entries[0].kind, 'tool');
});

test('잘못된 퍼센트 이스케이프의 색인은 거부하고 정적 폴백을 유지한다', () => {
  for (const path of ['/posts/bad%/', '/posts/bad%2/', '/posts/bad%zz/']) {
    const fallback = sciencePost({ path, href: path, title: '정적 글', content: '정적 본문' });
    const row = indexRow({ type: 'post', url: `https://blog.test${path}`, title: '손상된 색인', content: '색인 본문' });
    const result = mergeSearchIndex([fallback], [row], 'https://blog.test/');
    assert.equal(result.invalidRowCount, 1, `${path} 색인을 거부해야 합니다`);
    assert.equal(result.missingPostCount, 1);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].title, '정적 글');
    assert.equal(result.entries[0].content, '정적 본문');
    assert.equal(result.entries[0].href, path);
  }
  const valid = indexRow({ type: 'post', url: '/posts/valid%25/', title: '유효한 퍼센트', content: '본문' });
  const result = mergeSearchIndex([sciencePost({ path: '/posts/valid%25/', href: '/posts/valid%25/' })], [valid], 'https://blog.test/');
  assert.equal(result.invalidRowCount, 0);
  assert.equal(result.entries[0].href, '/posts/valid%25/');
});

test('tool landing pages are searchable without appearing in the default archive', () => {
  const result = mergeSearchIndex([sciencePost()], [
    { type: 'page', url: 'https://blog.test/tools/unit-converter/', title: '단위 변환기', description: '온도 변환 공식과 예시' },
    { type: 'page', url: 'https://blog.test/tools/dsr-calculator/', title: 'DSR 계산기 준비 중', description: '자동 계산 기능은 준비 중입니다' },
  ], 'https://blog.test/');

  assert.deepEqual(getRankedEntries(result.entries, { query: '', category: 'all', sort: 'date' })
    .map(item => item.entry.path), ['/posts/physics']);
  const matches = getRankedEntries(result.entries, { query: '온도', category: 'all', sort: 'relevance' });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].entry.path, '/tools/unit-converter');
  assert.equal(matches[0].entry.kind, 'tool');
  assert.match(result.entries.find(entry => entry.path === '/tools/dsr-calculator')?.title || '', /준비 중/);
});

test('undated pages stay undated and follow dated posts when sorting by date', () => {
  const post = sciencePost({ title: '물리학 글', date: '2024-01-01' });
  const result = mergeSearchIndex([post], [
    { type: 'page', url: 'https://blog.test/tools/physics/', title: '물리학 계산기', date: '' },
  ], 'https://blog.test/');
  const matches = getRankedEntries(result.entries, { query: '물리학', category: 'all', sort: 'date' });
  assert.deepEqual(matches.map(item => item.entry.kind), ['post', 'tool']);
  assert.equal(matches[1].entry.date, '');
});

test('series and tool pages remain searchable when the site has a base path', () => {
  const rows = [
    { type: 'page', url: 'https://blog.test/blog/tools/unit-converter/', title: '단위 변환기' },
    { type: 'page', url: 'https://blog.test/blog/series/math/', title: '수학 시리즈' },
    { type: 'page', url: 'https://blog.test/blog-other/tools/ignored/', title: '다른 경로' },
  ];
  const result = mergeSearchIndex([], rows, 'https://blog.test/blog');
  assert.deepEqual(result.entries.map(entry => [entry.path, entry.kind]), [
    ['/blog/tools/unit-converter', 'tool'],
    ['/blog/series/math', 'series'],
  ]);
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

test('검색 URL의 대소문자와 유니코드 표기를 보존하면서 비교는 정규화한다', () => {
  const categories = new Set<string>();
  const input = 'Information Cafe\u0301';
  const parsed = parsePostsState(`https://blog.test/posts/?q=${encodeURIComponent(`  ${input}  `)}`, categories);
  assert.equal(parsed.query, input);
  assert.equal(normalizeText(parsed.query), 'information café');
  const output = serializePostsState('https://blog.test/posts/?utm_source=reader', parsed);
  const url = new URL(output, 'https://blog.test');
  assert.equal(url.searchParams.get('q'), input);
  assert.equal(url.searchParams.get('utm_source'), 'reader');
  assert.equal(parsePostsState(url, categories).query, input);
  assert.equal(parsePostsState('https://blog.test/posts/?q=information', categories).query, 'information');
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
