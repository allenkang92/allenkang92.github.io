export type EntryKind = 'post' | 'series' | 'tool' | 'achievement';
export type SortMode = 'date' | 'relevance';

export interface CatalogEntry {
  path: string;
  href: string;
  title: string;
  kind: EntryKind;
  categories: string[];
  categoryLabels: string[];
  tags: string[];
  description: string;
  content: string;
  date: string;
  language?: string;
}

export interface PostsState {
  query: string;
  category: string;
  sort: SortMode;
  page: number;
}

export interface SearchOptions {
  query: string;
  category: string;
  sort: SortMode;
}

export interface RankedEntry {
  entry: CatalogEntry;
  score: number;
  originalIndex: number;
}

export interface PageWindow {
  page: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  startNumber: number;
  endNumber: number;
}

interface SearchIndexRow {
  title?: unknown;
  url?: unknown;
  category?: unknown;
  type?: unknown;
  tags?: unknown;
  description?: unknown;
  content?: unknown;
  date?: unknown;
  page_kind?: unknown;
  language?: unknown;
}

function normalizeCase(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('ko-KR').normalize('NFC');
}

export function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return normalizeCase(value).replace(/\s+/g, ' ').trim();
}

// Keep the reader's spelling for the input, URL, and history. Matching uses
// normalizeText separately so case and Unicode normalization remain tolerant.
export function normalizeQuery(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

/** Map case-folded NFC UTF-16 offsets back to unmodified displayed text. */
export function normalizedTextMap(text: string, throughOffset = Number.POSITIVE_INFINITY): { normalized: string; starts: number[]; ends: number[] } {
  const normalized = normalizeCase(text);
  const starts: number[] = [];
  const ends: number[] = [];
  // Grapheme segmentation keeps decomposed Hangul and combining sequences
  // together. The normalized text is folded as a whole to preserve context
  // such as Greek final sigma.
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ko', { granularity: 'grapheme' })
    : null;
  function* fallbackSegments(): Generator<{ segment: string; index: number }> {
    // Keep standard decomposed Hangul and combining marks with their base.
    // Verify the final length below before trusting this approximation.
    const groups = /[\u1100-\u1112][\u1161-\u1175][\u11a8-\u11c2]?\p{M}*|\P{M}\p{M}*|\p{M}+/gu;
    for (const match of text.matchAll(groups)) yield { segment: match[0], index: match.index ?? 0 };
  }
  {
    let offset = 0;
    for (const { segment, index } of segmenter ? segmenter.segment(text) : fallbackSegments()) {
      const segmentLength = normalizeCase(segment).length;
      for (let i = 0; i < segmentLength; i++) {
        starts[offset] = index;
        ends[offset] = index + segment.length;
        offset++;
      }
      // Excerpt selection needs only the start of its first match. Avoid
      // building an offset map for the remainder of a potentially long post.
      if (segmenter && offset > throughOffset) return { normalized, starts, ends };
    }
    if (offset === normalized.length) return { normalized, starts, ends };
  }

  // Compatibility fallback for older runtimes or unusual context-sensitive
  // case mappings whose length differs across grapheme boundaries.
  starts.length = 0;
  ends.length = 0;
  let previous = '';
  let originalEnd = 0;
  for (const codePoint of text) {
    const originalStart = originalEnd;
    originalEnd += codePoint.length;
    const next = normalizeCase(text.slice(0, originalEnd));
    let common = 0;
    while (common < previous.length && common < next.length && previous[common] === next[common]) common++;
    if (common > 0 && common < previous.length && /[\uD800-\uDBFF]/.test(previous[common - 1])) common--;
    const changedStart = common < starts.length ? Math.min(originalStart, starts[common]) : originalStart;
    starts.length = common;
    ends.length = common;
    for (let i = common; i < next.length; i++) {
      starts[i] = changedStart;
      ends[i] = originalEnd;
    }
    previous = next;
  }
  return { normalized, starts, ends };
}

export function normalizePath(rawUrl: string, baseUrl = 'https://blog.invalid/'): string {
  try {
    const path = new URL(rawUrl, baseUrl).pathname;
    // 주소의 구분자나 %25를 해독하면 서로 다른 자원을 같은 경로로
    // 오인한다. 같은 바이트를 표현하는 이스케이프의 대소문자만 맞춘다.
    return path.replace(/%[0-9a-f]{2}/gi, value => value.toUpperCase()).replace(/\/+$/, '') || '/';
  } catch {
    return rawUrl.trim().replace(/\/+$/, '') || '/';
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// HTML에서 추출한 색인의 문자 참조를 한 번만 해독한다. 리터럴 '<'는
// 먼저 이스케이프하여 textarea 안에 요소가 생성되지 않게 한다.
export function decodeSearchText(value: string, documentRef: Document | undefined = typeof document === 'undefined' ? undefined : document): string {
  if (!documentRef) return value;
  const textarea = documentRef.createElement('textarea');
  textarea.innerHTML = value.replace(/</g, '&lt;');
  return textarea.value;
}

// 정적 목록은 초기 표시·오류·재시도에서 공유하므로 한 번만 변환한다.
export function decodeFallbackPosts(posts: CatalogEntry[]): CatalogEntry[] {
  return posts.map(post => ({
    ...post,
    description: decodeSearchText(post.description),
    content: decodeSearchText(post.content),
  }));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

// 유효하지 않은 언어 태그는 브라우저 접근성 트리에 전달하지 않는다.
function validLanguage(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value || value.length > 64) return undefined;
  try { return Intl.getCanonicalLocales(value)[0]; } catch { return undefined; }
}

function indexedEntry(row: SearchIndexRow, path: string, href: string, fallback?: CatalogEntry): CatalogEntry | null {
  const title = stringValue(row.title).trim() || fallback?.title || '';
  if (!title || !path) return null;

  const category = stringValue(row.category);
  const categories = fallback?.categories.length
    ? fallback.categories
    : category ? [category] : [];
  const categoryLabels = fallback?.categoryLabels.length
    ? fallback.categoryLabels
    : categories;

  return {
    path,
    href: fallback?.href || href,
    title,
    kind: fallback?.kind || 'post',
    categories,
    categoryLabels,
    tags: stringArray(row.tags).length ? stringArray(row.tags) : fallback?.tags || [],
    description: stringValue(row.description) ? decodeSearchText(stringValue(row.description)) : fallback?.description || '',
    content: stringValue(row.content) ? decodeSearchText(stringValue(row.content)) : fallback?.content || '',
    date: stringValue(row.date) || fallback?.date || '',
    language: validLanguage(row.language),
  };
}

// 인덱스의 주소는 정식 사이트 기준으로 검증하되 링크는 현재 호스트에서
// 열리도록 인코딩된 경로를 보존한다. 디코딩된 경로를 href로 쓰면 %2F가
// 프로토콜 상대 주소로, %3F가 쿼리 구분자로 바뀔 수 있다.
function indexAddress(rawUrl: string, siteBaseUrl: string): { path: string; href: string } | null {
  try {
    const base = new URL(siteBaseUrl);
    if (!['http:', 'https:'].includes(base.protocol)) return null;
    if (/%(?![0-9a-f]{2})/i.test(base.pathname)) return null;
    const normalizedBasePath = normalizePath(base.href);
    const basePath = normalizedBasePath === '/' ? '' : normalizedBasePath;
    const directory = new URL(`${basePath || ''}/`, base.origin);
    const address = new URL(rawUrl, directory);
    if (!['http:', 'https:'].includes(address.protocol) || address.origin !== base.origin) return null;
    if (address.username || address.password || address.pathname.startsWith('//')) return null;
    if (/%(?![0-9a-f]{2})/i.test(address.pathname)) return null;
    const addressPath = normalizePath(address.href);
    if (basePath && addressPath !== basePath && !addressPath.startsWith(`${basePath}/`)) return null;
    return {
      path: addressPath,
      href: `${address.pathname}${address.search}${address.hash}`,
    };
  } catch {
    return null;
  }
}

function pageKind(path: string, siteBaseUrl: string): EntryKind | null {
  const basePath = normalizePath(siteBaseUrl);
  const localPath = basePath === '/'
    ? path
    : path.startsWith(`${basePath}/`) ? path.slice(basePath.length) : '';
  if (localPath === '/series' || localPath.startsWith('/series/')) return 'series';
  if (localPath === '/tools' || localPath.startsWith('/tools/')) return 'tool';
  if (localPath === '/achievements' || localPath.startsWith('/achievements/')) return 'achievement';
  return null;
}

export function mergeSearchIndex(
  fallbackPosts: CatalogEntry[],
  payload: unknown,
  siteBaseUrl: string,
  expectedPagePaths?: readonly string[],
  expectedAchievementPaths?: readonly string[],
): { entries: CatalogEntry[]; missingPostCount: number; missingPageCount: number; invalidRowCount: number } {
  if (!Array.isArray(payload)) {
    throw new TypeError('Search index must be an array.');
  }

  const normalizedFallbackPosts = fallbackPosts.map(post => ({
    ...post,
    path: normalizePath(post.path, siteBaseUrl),
  }));
  const fallbackByPath = new Map(normalizedFallbackPosts.map(post => [post.path, post]));
  const indexedPosts = new Map<string, { row: SearchIndexRow; href: string }>();
  const pages = new Map<string, CatalogEntry>();
  const expectedPages = expectedPagePaths === undefined
    ? null
    : new Set(expectedPagePaths.map(path => normalizePath(path, siteBaseUrl)));
  const expectedAchievements = expectedAchievementPaths === undefined
    ? null
    : new Set(expectedAchievementPaths.map(path => normalizePath(path, siteBaseUrl)));
  const seenPaths = new Set<string>();
  let invalidRowCount = 0;

  for (const value of payload) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      invalidRowCount += 1;
      continue;
    }
    const row = value as SearchIndexRow;
    const rawUrl = stringValue(row.url);
    const address = rawUrl.trim() ? indexAddress(rawUrl, siteBaseUrl) : null;
    const validType = row.type === 'post' || row.type === 'page';
    const validTitle = typeof row.title === 'string' && !!row.title.trim();
    // 생성된 인덱스는 검색 대상 필드를 항상 제공한다. 필드가 누락된
    // 행도 부분 결과에는 남기되 검색이 완전하다고 알리지 않는다.
    const validSearchStrings = [row.category, row.description, row.content, row.date]
      .every(field => typeof field === 'string');
    const validTags = Array.isArray(row.tags) && row.tags.every(tag => typeof tag === 'string');
    const validLanguageField = row.language === undefined || row.language === '' || !!validLanguage(row.language);
    const validPageKind = row.page_kind === undefined || (row.type === 'page' && row.page_kind === 'achievement');
    const invalidFields = !validType || !validTitle || !address || !validSearchStrings || !validTags || !validLanguageField || !validPageKind;
    if (invalidFields) invalidRowCount += 1;
    if (!validType || !address) continue;
    const { path, href } = address;
    if (seenPaths.has(path)) {
      if (!invalidFields) invalidRowCount += 1;
      continue;
    }
    seenPaths.add(path);

    if (row.type === 'post') {
      if (!fallbackByPath.has(path)) {
        if (!invalidFields) invalidRowCount += 1;
        continue;
      }
      indexedPosts.set(path, { row, href });
      continue;
    }

    if (row.type !== 'page') continue;
    const markedAchievement = row.page_kind === 'achievement';
    if (markedAchievement && expectedAchievements && !expectedAchievements.has(path)) {
      if (!invalidFields) invalidRowCount += 1;
      continue;
    }
    if (expectedAchievements?.has(path) && !markedAchievement) {
      if (!invalidFields) invalidRowCount += 1;
      continue;
    }
    const kind = markedAchievement ? 'achievement' : pageKind(path, siteBaseUrl);
    if (!kind) continue;
    if (expectedPages && !expectedPages.has(path)) {
      if (!invalidFields) invalidRowCount += 1;
      continue;
    }
    const entry = indexedEntry(row, path, href);
    if (entry) pages.set(path, { ...entry, kind });
  }

  let missingPostCount = 0;
  const posts = normalizedFallbackPosts.map(post => {
    const indexed = indexedPosts.get(post.path);
    if (!indexed || !stringValue(indexed.row.content).trim()) missingPostCount += 1;
    return indexed ? indexedEntry(indexed.row, post.path, indexed.href, post) || post : post;
  });

  const missingPageCount = expectedPages ? Array.from(expectedPages).filter(path => !pages.has(path)).length : 0;
  return { entries: [...posts, ...pages.values()], missingPostCount, missingPageCount, invalidRowCount };
}

function occurrenceCount(text: string, term: string): number {
  if (!term) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = text.indexOf(term, cursor)) !== -1) {
    count += 1;
    cursor += term.length;
  }
  return count;
}

function dateValue(entry: CatalogEntry): number {
  const value = Date.parse(entry.date);
  return Number.isFinite(value) ? value : 0;
}

export function getRankedEntries(entries: CatalogEntry[], options: SearchOptions): RankedEntry[] {
  const terms = normalizeText(options.query).split(' ').filter(Boolean);
  const candidates = entries
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .filter(({ entry }) => {
      if (options.category !== 'all') {
        return entry.kind === 'post' && entry.categories.includes(options.category);
      }
      return terms.length > 0 || entry.kind === 'post';
    });

  const ranked = candidates.flatMap(({ entry, originalIndex }) => {
    const title = normalizeText(entry.title);
    const description = normalizeText(entry.description);
    const content = normalizeText(entry.content);
    // 검색 결과에 실제로 표시하는 글 분류만 검색한다. 안내·성과의
    // 인덱스 기본값은 방문자에게 보이는 분류가 아니다.
    const category = entry.kind === 'post'
      ? normalizeText([...entry.categories, ...entry.categoryLabels].join(' '))
      : '';
    const tags = normalizeText(entry.tags.join(' '));
    let score = 0;

    for (const term of terms) {
      const inTitle = title.includes(term);
      const inDescription = description.includes(term);
      const inContent = content.includes(term);
      const inCategory = category.includes(term);
      const inTags = tags.includes(term);
      if (!inTitle && !inDescription && !inContent && !inCategory && !inTags) return [];

      if (inTitle) score += 100;
      if (inDescription) score += 20;
      if (inTags) score += 12;
      if (inCategory) score += 8;
      if (inContent) score += 1;
      score += occurrenceCount(title, term) * 2;
      score += occurrenceCount(description, term);
      score += occurrenceCount(content, term);
    }

    return [{ entry, score, originalIndex }];
  });

  return ranked.sort((left, right) => {
    if (terms.length > 0 && options.sort === 'relevance' && right.score !== left.score) {
      return right.score - left.score;
    }
    const dateDelta = dateValue(right.entry) - dateValue(left.entry);
    return dateDelta || left.originalIndex - right.originalIndex;
  });
}

export function getPageWindow(totalItems: number, requestedPage: number, pageSize: number): PageWindow {
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 10;
  const safeTotal = Number.isFinite(totalItems) && totalItems > 0 ? Math.floor(totalItems) : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const parsedPage = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.min(Math.max(parsedPage, 1), totalPages);
  const startIndex = safeTotal === 0 ? 0 : (page - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, safeTotal);

  return {
    page,
    totalPages,
    startIndex,
    endIndex,
    startNumber: safeTotal === 0 ? 0 : startIndex + 1,
    endNumber: endIndex,
  };
}

export function getPaginationItems(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const current = Math.min(Math.max(Math.floor(currentPage), 1), safeTotal);
  if (safeTotal <= 1) return [];

  const items: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(safeTotal - 1, current + 1);

  if (start > 2) items.push('ellipsis');
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < safeTotal - 1) items.push('ellipsis');
  items.push(safeTotal);
  return items;
}

export function parsePostsState(urlValue: string | URL, validCategories: ReadonlySet<string>): PostsState {
  const url = urlValue instanceof URL ? urlValue : new URL(urlValue, 'https://blog.invalid');
  const requestedPage = Number.parseInt(url.searchParams.get('page') || '1', 10);
  const categoryValue = url.searchParams.get('category') || 'all';
  const category = categoryValue === 'all' || validCategories.has(categoryValue) ? categoryValue : 'all';

  return {
    query: normalizeQuery(url.searchParams.get('q') || ''),
    category,
    sort: url.searchParams.get('sort') === 'relevance' ? 'relevance' : 'date',
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

export function serializePostsState(urlValue: string | URL, state: PostsState): string {
  const url = urlValue instanceof URL ? new URL(urlValue.href) : new URL(urlValue, 'https://blog.invalid');
  const query = normalizeQuery(state.query);

  if (state.category === 'all') url.searchParams.delete('category');
  else url.searchParams.set('category', state.category);

  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');

  if (state.sort === 'relevance') url.searchParams.set('sort', 'relevance');
  else url.searchParams.delete('sort');

  if (state.page > 1) url.searchParams.set('page', String(Math.floor(state.page)));
  else url.searchParams.delete('page');

  return `${url.pathname}${url.search}${url.hash}`;
}
