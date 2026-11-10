import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ChangeEvent,
  CompositionEvent,
  FormEvent,
  MouseEvent,
  ReactNode,
} from 'react';
import {
  getPageWindow,
  getPaginationItems,
  getRankedEntries,
  mergeSearchIndex,
  normalizeText,
  parsePostsState,
  serializePostsState,
} from './model';
import type { CatalogEntry, PostsState, SortMode } from './model';

const POSTS_PER_PAGE = 10;
const SEARCH_INPUT_DELAY_MS = 250;
const SCROLL_STATE_KEY = 'postsListState';

type SearchIndexStatus = 'loading' | 'ready' | 'incomplete' | 'failed';
type HistoryMode = 'push' | 'replace';

interface PostsAppProps {
  fallbackPosts: CatalogEntry[];
  categoryLabels: Map<string, string>;
  searchIndexUrl: string;
  siteBaseUrl: string;
  postsUrl: string;
  rootElement: HTMLElement;
  fallbackElement: HTMLElement;
}

interface StoredScrollState extends PostsState {
  path: string;
  scrollY: number;
}

interface TextSegment {
  text: string;
  highlighted: boolean;
}

function normalizedTextContent(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function textSegments(value: string, query: string): TextSegment[] {
  const text = value.normalize('NFC');
  const terms = normalizeText(query).split(' ').filter(Boolean);
  if (!text || terms.length === 0) return [{ text, highlighted: false }];

  const searchable = text.toLocaleLowerCase('ko-KR');
  const ranges: Array<[number, number]> = [];
  terms.forEach(term => {
    let start = 0;
    let match = -1;
    while ((match = searchable.indexOf(term, start)) !== -1) {
      ranges.push([match, match + term.length]);
      start = match + term.length;
    }
  });
  if (ranges.length === 0) return [{ text, highlighted: false }];

  ranges.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const merged: Array<[number, number]> = [];
  ranges.forEach(([start, end]) => {
    const previous = merged[merged.length - 1];
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  });

  const segments: TextSegment[] = [];
  let cursor = 0;
  merged.forEach(([start, end]) => {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), highlighted: false });
    segments.push({ text: text.slice(start, end), highlighted: true });
    cursor = end;
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlighted: false });
  return segments;
}

function getExcerpt(entry: CatalogEntry, query: string): string {
  const description = normalizedTextContent(entry.description);
  const content = normalizedTextContent(entry.content);
  if (!query) return (description || content).slice(0, 180);

  const terms = normalizeText(query).split(' ').filter(Boolean);
  const descriptionSearch = normalizeText(description);
  const source = terms.some(term => descriptionSearch.includes(term)) ? description : content || description;
  if (source.length <= 180) return source;

  const searchable = source.normalize('NFC').toLocaleLowerCase('ko-KR');
  const firstMatch = terms
    .map(term => searchable.indexOf(term))
    .filter(index => index >= 0)
    .reduce((minimum, index) => Math.min(minimum, index), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(firstMatch)) return `${source.slice(0, 177)}…`;

  const start = Math.max(0, firstMatch - 60);
  const end = Math.min(source.length, start + 170);
  const excerpt = source.slice(start, end).trim();
  return `${start > 0 ? '…' : ''}${excerpt}${end < source.length ? '…' : ''}`;
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '';
  return `${match[1]}년 ${match[2]}월 ${match[3]}일`;
}

function categoryLabelFor(category: string, labels: Map<string, string>): string {
  return labels.get(category) || category.replace(/_/g, ' ');
}

function writeHistory(nextState: PostsState, mode: HistoryMode): void {
  const href = serializePostsState(window.location.href, nextState);
  const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (mode === 'push' && href === currentHref) return;
  if (mode === 'push') window.history.pushState({}, '', href);
  else window.history.replaceState({}, '', href);
}

function saveScrollState(state: PostsState): void {
  try {
    const stored: StoredScrollState = {
      ...state,
      path: window.location.pathname,
      scrollY: window.scrollY || window.pageYOffset || 0,
    };
    window.sessionStorage.setItem(SCROLL_STATE_KEY, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable in private browsing or constrained webviews.
  }
}

function StatusMessage({
  query,
  status,
  missingPostCount,
  totalPosts,
}: {
  query: string;
  status: SearchIndexStatus;
  missingPostCount: number;
  totalPosts: number;
}) {
  if (!query) return null;
  if (status === 'ready') return null;

  let message = '전체 본문 인덱스를 불러오는 중입니다. 지금은 제목·요약·태그와 본문 앞부분을 검색합니다.';
  if (status === 'failed') {
    message = '전체 본문 인덱스를 불러오지 못했습니다. 현재 목록의 제목·요약·태그와 본문 앞부분에서 검색합니다.';
  } else if (status === 'incomplete') {
    message = `전체 ${totalPosts}개 글 중 ${missingPostCount}개의 본문 인덱스를 불러오지 못했습니다. 현재 목록 데이터도 함께 검색합니다.`;
  }

  return <span id="react-posts-search-status" className="posts-search-status" role="status" aria-live="polite">{message}</span>;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  return <>{textSegments(text, query).map((segment, index) => (
    segment.highlighted
      ? <mark key={index}>{segment.text}</mark>
      : <span key={index}>{segment.text}</span>
  ))}</>;
}

function PostsFallbackBoundary({
  children,
  onError,
}: {
  children: ReactNode;
  onError: () => void;
}) {
  return <PostsErrorBoundary onError={onError}>{children}</PostsErrorBoundary>;
}

class PostsErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError();
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export function PostsApp({
  fallbackPosts,
  categoryLabels,
  searchIndexUrl,
  siteBaseUrl,
  postsUrl,
  rootElement,
  fallbackElement,
}: PostsAppProps) {
  const validCategories = useMemo(() => new Set(categoryLabels.keys()), [categoryLabels]);
  const [state, setState] = useState(() => parsePostsState(window.location.href, validCategories));
  const [draftQuery, setDraftQuery] = useState(state.query);
  const [entries, setEntries] = useState(fallbackPosts);
  const [indexStatus, setIndexStatus] = useState<SearchIndexStatus>('loading');
  const [missingPostCount, setMissingPostCount] = useState(0);
  const [canRetry, setCanRetry] = useState(false);
  const stateRef = useRef(state);
  const queryTimerRef = useRef<number | null>(null);
  const isComposingRef = useRef(false);
  const navigationRevisionRef = useRef(0);
  const compositionRevisionRef = useRef(0);
  const focusResultsAfterPageChangeRef = useRef(false);
  stateRef.current = state;

  const rankedEntries = useMemo(
    () => getRankedEntries(entries, { query: state.query, category: state.category, sort: state.sort }),
    [entries, state.category, state.query, state.sort],
  );
  const pageWindow = getPageWindow(rankedEntries.length, state.page, POSTS_PER_PAGE);
  const visibleEntries = rankedEntries.slice(pageWindow.startIndex, pageWindow.endIndex);
  const categoryOptions = Array.from(categoryLabels.entries()).sort((left, right) => left[1].localeCompare(right[1], 'ko-KR'));
  const isLoading = indexStatus === 'loading';
  const showRetry = canRetry && state.query.length > 0;
  const statusMessage = state.query && indexStatus !== 'ready';

  useLayoutEffect(() => {
    rootElement.hidden = false;
    fallbackElement.hidden = true;

    try {
      const saved = window.sessionStorage.getItem(SCROLL_STATE_KEY);
      if (!saved) return;
      const stored = JSON.parse(saved) as StoredScrollState;
      if (
        stored.path !== window.location.pathname ||
        stored.category !== stateRef.current.category ||
        stored.page !== stateRef.current.page ||
        stored.query !== stateRef.current.query ||
        stored.sort !== stateRef.current.sort ||
        !Number.isFinite(stored.scrollY)
      ) return;
      window.requestAnimationFrame(() => window.scrollTo({ top: stored.scrollY, behavior: 'auto' }));
    } catch {
      // Ignore stale or malformed navigation state.
    }
  }, [fallbackElement, rootElement]);

  useLayoutEffect(() => {
    if (!focusResultsAfterPageChangeRef.current) return;
    rootElement.querySelector<HTMLAnchorElement>('#react-posts-list .post-preview h2 a')?.focus();
    focusResultsAfterPageChangeRef.current = false;
  }, [rootElement, state.page]);

  const loadSearchIndex = useCallback(async (): Promise<boolean> => {
    setIndexStatus('loading');
    try {
      const resolvedUrl = new URL(searchIndexUrl, window.location.href).href;
      const response = await window.fetch(resolvedUrl);
      if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
      const payload: unknown = await response.json();
      const merged = mergeSearchIndex(fallbackPosts, payload, siteBaseUrl);
      setEntries(merged.entries);
      setMissingPostCount(merged.missingPostCount);
      setCanRetry(merged.missingPostCount > 0);
      setIndexStatus(merged.missingPostCount > 0 ? 'incomplete' : 'ready');
      return merged.missingPostCount === 0;
    } catch {
      setEntries(fallbackPosts);
      setMissingPostCount(fallbackPosts.length);
      setCanRetry(true);
      setIndexStatus('failed');
      return false;
    }
  }, [fallbackPosts, searchIndexUrl, siteBaseUrl]);

  useEffect(() => {
    void loadSearchIndex();
  }, [loadSearchIndex]);

  useEffect(() => {
    if (state.query && indexStatus === 'loading') return;
    const clampedPage = pageWindow.page;
    if (clampedPage === state.page) return;
    const normalizedState = { ...state, page: clampedPage };
    stateRef.current = normalizedState;
    setState(normalizedState);
    writeHistory(normalizedState, 'replace');
  }, [indexStatus, pageWindow.page, state]);

  useEffect(() => {
    const saveOnExit = () => saveScrollState(stateRef.current);
    window.addEventListener('pagehide', saveOnExit);
    return () => window.removeEventListener('pagehide', saveOnExit);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (queryTimerRef.current !== null) window.clearTimeout(queryTimerRef.current);
      queryTimerRef.current = null;
      navigationRevisionRef.current += 1;
      isComposingRef.current = false;
      const restored = parsePostsState(window.location.href, validCategories);
      stateRef.current = restored;
      setState(restored);
      setDraftQuery(restored.query);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [validCategories]);

  useEffect(() => () => {
    if (queryTimerRef.current !== null) window.clearTimeout(queryTimerRef.current);
  }, []);

  const transition = useCallback((
    changes: Partial<PostsState>,
    historyMode: HistoryMode,
  ) => {
    const current = stateRef.current;
    const next: PostsState = {
      ...current,
      ...changes,
      query: normalizeText(changes.query ?? current.query),
      page: changes.page ?? current.page,
    };
    stateRef.current = next;
    setState(next);
    setDraftQuery(next.query);
    writeHistory(next, historyMode);
  }, []);

  const clearQueryTimer = useCallback(() => {
    if (queryTimerRef.current !== null) window.clearTimeout(queryTimerRef.current);
    queryTimerRef.current = null;
  }, []);

  const scheduleSearch = useCallback((value: string) => {
    clearQueryTimer();
    const revision = navigationRevisionRef.current;
    queryTimerRef.current = window.setTimeout(() => {
      queryTimerRef.current = null;
      if (revision !== navigationRevisionRef.current) return;
      transition({ query: value, page: 1 }, 'replace');
    }, SEARCH_INPUT_DELAY_MS);
  }, [clearQueryTimer, transition]);

  const handleSearchInput = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    setDraftQuery(value);
    const nativeEvent = event.nativeEvent as InputEvent;
    if (isComposingRef.current || nativeEvent.isComposing) return;
    scheduleSearch(value);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nativeEvent = event.nativeEvent as SubmitEvent & { isComposing?: boolean };
    if (isComposingRef.current || nativeEvent.isComposing) return;
    clearQueryTimer();
    transition({ query: draftQuery, page: 1 }, 'push');
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
    compositionRevisionRef.current = navigationRevisionRef.current;
    clearQueryTimer();
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    if (compositionRevisionRef.current !== navigationRevisionRef.current) return;
    isComposingRef.current = false;
    const value = event.currentTarget.value;
    setDraftQuery(value);
    scheduleSearch(value);
  };

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    clearQueryTimer();
    transition({ category: event.currentTarget.value, query: draftQuery, page: 1 }, 'push');
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    clearQueryTimer();
    transition({ sort: event.currentTarget.value as SortMode, query: draftQuery, page: 1 }, 'push');
  };

  const handleReset = () => {
    clearQueryTimer();
    isComposingRef.current = false;
    transition({ query: '', category: 'all', sort: 'date', page: 1 }, 'push');
    rootElement.querySelector<HTMLInputElement>('#react-posts-search-input')?.focus();
  };

  const handlePageClick = (event: MouseEvent<HTMLAnchorElement>, page: number) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    clearQueryTimer();
    saveScrollState(stateRef.current);
    focusResultsAfterPageChangeRef.current = true;
    transition({ page }, 'push');
  };

  const handleStepPage = (page: number) => {
    if (page < 1 || page > pageWindow.totalPages) return;
    clearQueryTimer();
    saveScrollState(stateRef.current);
    focusResultsAfterPageChangeRef.current = true;
    transition({ page }, 'push');
  };

  const handleRetry = async () => {
    if (isLoading) return;
    const retryButton = rootElement.querySelector<HTMLButtonElement>('#react-posts-retry-search-index');
    const hadFocus = document.activeElement === retryButton;
    const complete = await loadSearchIndex();
    if (hadFocus && complete) {
      rootElement.querySelector<HTMLInputElement>('#react-posts-search-input')?.focus();
    }
  };

  const countLabel = state.query
    ? state.category === 'all'
      ? `"${state.query}" 검색 결과 ${rankedEntries.length}개`
      : `${categoryLabelFor(state.category, categoryLabels)}에서 "${state.query}" 검색 결과 ${rankedEntries.length}개`
    : state.category === 'all'
      ? `전체 ${rankedEntries.length}개 글`
      : `${categoryLabelFor(state.category, categoryLabels)} ${rankedEntries.length}개 글`;

  let emptyMessage = '검색 조건과 일치하는 글이 없습니다.';
  if (rankedEntries.length === 0) {
    if (!state.query) {
      emptyMessage = `"${categoryLabelFor(state.category, categoryLabels)}" 카테고리에서 글을 찾지 못했습니다.`;
    } else if (indexStatus === 'loading' || indexStatus === 'failed' || indexStatus === 'incomplete') {
      emptyMessage = `현재 검색 범위에서 "${state.query}"와 일치하는 결과를 찾지 못했습니다. 검색 인덱스를 확인하면 결과가 달라질 수 있습니다.`;
    } else {
      emptyMessage = `"${state.query}" 검색어와 일치하는 글이나 안내가 없습니다.`;
    }
  }

  return (
    <div className="posts-container">
      <div className="posts-controls">
        <div className="posts-filter-row">
          <div className="posts-search-control">
            <div className="search-widget">
              <div className="search-container">
                <form
                  id="react-posts-search-form"
                  className="search-form"
                  role="search"
                  aria-label="글 목록 검색"
                  action={postsUrl}
                  method="get"
                  onSubmit={handleSearchSubmit}
                >
                  <label htmlFor="react-posts-search-input" className="posts-search-label">검색</label>
                  <div className="search-input-wrapper">
                    <input
                      id="react-posts-search-input"
                      className="search-input"
                      type="search"
                      name="q"
                      value={draftQuery}
                      placeholder="글 제목이나 본문 키워드"
                      autoComplete="off"
                      inputMode="search"
                      aria-describedby="react-posts-search-instructions"
                      aria-controls="react-posts-list"
                      onChange={handleSearchInput}
                      onCompositionStart={handleCompositionStart}
                      onCompositionEnd={handleCompositionEnd}
                    />
                    <button className="search-button" type="submit" aria-label="검색 실행">
                      <svg className="search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                      </svg>
                    </button>
                  </div>
                  <span id="react-posts-search-instructions" className="visually-hidden">제목과 본문에서 검색합니다. 입력하면 결과가 자동으로 바뀝니다.</span>
                </form>
              </div>
            </div>
          </div>

          <div className="posts-filter-selects">
            <label className="posts-select-field" htmlFor="react-posts-category-select">
              <span>카테고리</span>
              <select id="react-posts-category-select" value={state.category} onChange={handleCategoryChange}>
                <option value="all">전체 주제</option>
                {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="posts-select-field" htmlFor="react-posts-sort-select">
              <span>정렬</span>
              <select id="react-posts-sort-select" value={state.sort} onChange={handleSortChange}>
                <option value="date">최신순</option>
                <option value="relevance">관련도순</option>
              </select>
            </label>
          </div>
        </div>

        <div className="posts-controls-meta">
          <div className="posts-info">
            <span id="react-posts-count" role="status" aria-live="polite">{countLabel}</span>
            <StatusMessage
              query={state.query}
              status={indexStatus}
              missingPostCount={missingPostCount}
              totalPosts={fallbackPosts.length}
            />
            {showRetry && (
              <button
                id="react-posts-retry-search-index"
                className="inline-action-btn posts-search-retry"
                type="button"
                aria-controls="react-posts-list"
                disabled={isLoading}
                onClick={handleRetry}
              >
                {isLoading ? '검색 인덱스를 다시 불러오는 중…' : '검색 인덱스 다시 시도'}
              </button>
            )}
          </div>
          {(state.query || state.category !== 'all' || state.sort !== 'date') && rankedEntries.length > 0 && (
            <button type="button" className="inline-action-btn posts-reset" onClick={handleReset}>검색 조건 초기화</button>
          )}
        </div>
      </div>

      <div id="react-posts-list" className={rankedEntries.length > 0 ? 'posts-list' : undefined}>
        {rankedEntries.length > 0 ? (
          <>
          {visibleEntries.map(({ entry }) => {
            const excerpt = getExcerpt(entry, state.query);
            const metaLabels = entry.kind === 'post'
              ? entry.categories.map(category => categoryLabelFor(category, categoryLabels))
              : [entry.kind === 'series' ? '시리즈' : '도구'];
            return (
              <article className="post-preview visible" key={`${entry.kind}:${entry.path}`}>
                <h2><a href={entry.href}><span className="post-title-text"><HighlightedText text={entry.title} query={state.query} /></span></a></h2>
                <div className="post-meta">
                  {entry.date && <time dateTime={entry.date}>{formatDate(entry.date)}</time>}
                  {metaLabels.map((label, index) => <span className="category" key={`${label}:${index}`}>{label}</span>)}
                </div>
                <p className="post-excerpt"><HighlightedText text={excerpt} query={state.query} /></p>
              </article>
            );
          })}
          </>
        ) : (
          <div id="react-posts-empty-state" className="posts-empty-state">
            <p id="react-posts-empty-message" role="status" aria-live="polite">{emptyMessage}</p>
            <button type="button" id="react-posts-clear-filters" className="inline-action-btn" onClick={handleReset}>검색 조건 초기화</button>
          </div>
        )}
      </div>

      {pageWindow.totalPages > 1 && (
        <nav id="react-posts-pagination" className="pagination" aria-label="글 목록 페이지">
          <button id="react-posts-prev-page" className="page-btn" type="button" disabled={pageWindow.page === 1} onClick={() => handleStepPage(pageWindow.page - 1)}>이전</button>
          <span id="react-posts-page-info" aria-live="polite" aria-atomic="true">전체 {rankedEntries.length}건 중 {pageWindow.startNumber}–{pageWindow.endNumber}건</span>
          <span id="react-posts-page-links" className="page-links" aria-label="페이지 번호">
            {getPaginationItems(pageWindow.page, pageWindow.totalPages).map((item, index) => item === 'ellipsis'
              ? <span className="page-btn page-ellipsis" aria-hidden="true" key={`ellipsis-${index}`}>…</span>
              : (
                <a
                  className={`page-btn${item === pageWindow.page ? ' is-current' : ''}`}
                  href={serializePostsState(window.location.href, { ...state, page: item })}
                  aria-label={`${item}페이지`}
                  aria-current={item === pageWindow.page ? 'page' : undefined}
                  key={item}
                  onClick={event => handlePageClick(event, item)}
                >
                  {item}
                </a>
              ))}
          </span>
          <button id="react-posts-next-page" className="page-btn" type="button" disabled={pageWindow.page === pageWindow.totalPages} onClick={() => handleStepPage(pageWindow.page + 1)}>다음</button>
        </nav>
      )}
    </div>
  );
}

export function PostsAppBoundary({ children, fallbackElement, rootElement }: {
  children: ReactNode;
  fallbackElement: HTMLElement;
  rootElement: HTMLElement;
}) {
  return (
    <PostsFallbackBoundary onError={() => {
      fallbackElement.hidden = false;
      rootElement.hidden = true;
    }}>
      {children}
    </PostsFallbackBoundary>
  );
}
