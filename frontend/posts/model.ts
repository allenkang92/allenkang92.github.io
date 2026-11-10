export type EntryKind = 'post' | 'series' | 'tool';
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
}

export function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
}

export function normalizePath(rawUrl: string, baseUrl = 'https://blog.invalid/'): string {
  try {
    const path = new URL(rawUrl, baseUrl).pathname;
    let decodedPath = path;
    try {
      decodedPath = decodeURIComponent(path);
    } catch {
      // Keep the encoded path when an invalid escape is present.
    }
    return decodedPath.replace(/\/+$/, '') || '/';
  } catch {
    return rawUrl.trim().replace(/\/+$/, '') || '/';
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function indexedEntry(row: SearchIndexRow, path: string, fallback?: CatalogEntry): CatalogEntry | null {
  const title = stringValue(row.title) || fallback?.title || '';
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
    href: fallback?.href || path,
    title,
    kind: fallback?.kind || 'post',
    categories,
    categoryLabels,
    tags: stringArray(row.tags).length ? stringArray(row.tags) : fallback?.tags || [],
    description: stringValue(row.description) || fallback?.description || '',
    content: stringValue(row.content) || fallback?.content || '',
    date: stringValue(row.date) || fallback?.date || '',
  };
}

function pageKind(path: string, siteBaseUrl: string): EntryKind | null {
  const basePath = normalizePath(siteBaseUrl);
  const localPath = basePath === '/'
    ? path
    : path.startsWith(`${basePath}/`) ? path.slice(basePath.length) : '';
  if (localPath === '/series' || localPath.startsWith('/series/')) return 'series';
  if (localPath === '/tools' || localPath.startsWith('/tools/')) return 'tool';
  return null;
}

export function mergeSearchIndex(
  fallbackPosts: CatalogEntry[],
  payload: unknown,
  siteBaseUrl: string,
): { entries: CatalogEntry[]; missingPostCount: number } {
  if (!Array.isArray(payload)) {
    throw new TypeError('Search index must be an array.');
  }

  const normalizedFallbackPosts = fallbackPosts.map(post => ({
    ...post,
    path: normalizePath(post.path, siteBaseUrl),
  }));
  const fallbackByPath = new Map(normalizedFallbackPosts.map(post => [post.path, post]));
  const indexedPosts = new Map<string, SearchIndexRow>();
  const pages = new Map<string, CatalogEntry>();

  for (const value of payload) {
    if (!value || typeof value !== 'object') continue;
    const row = value as SearchIndexRow;
    const rawUrl = stringValue(row.url);
    if (!rawUrl) continue;
    const path = normalizePath(rawUrl, siteBaseUrl);

    if (row.type === 'post') {
      if (!indexedPosts.has(path)) indexedPosts.set(path, row);
      continue;
    }

    if (row.type !== 'page') continue;
    const kind = pageKind(path, siteBaseUrl);
    if (!kind || pages.has(path)) continue;
    const entry = indexedEntry(row, path);
    if (entry) pages.set(path, { ...entry, kind });
  }

  let missingPostCount = 0;
  const posts = normalizedFallbackPosts.map(post => {
    const row = indexedPosts.get(post.path);
    if (!row || !stringValue(row.content).trim()) missingPostCount += 1;
    return row ? indexedEntry(row, post.path, post) || post : post;
  });

  for (const [path, row] of indexedPosts) {
    if (fallbackByPath.has(path)) continue;
    const entry = indexedEntry(row, path);
    if (entry) posts.push(entry);
  }

  return { entries: [...posts, ...pages.values()], missingPostCount };
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
    const category = normalizeText([...entry.categories, ...entry.categoryLabels].join(' '));
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
    query: normalizeText(url.searchParams.get('q') || ''),
    category,
    sort: url.searchParams.get('sort') === 'relevance' ? 'relevance' : 'date',
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

export function serializePostsState(urlValue: string | URL, state: PostsState): string {
  const url = urlValue instanceof URL ? new URL(urlValue.href) : new URL(urlValue, 'https://blog.invalid');
  const query = normalizeText(state.query);

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
