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
  decodeFallbackPosts,
  getPageWindow,
  getPaginationItems,
  getRankedEntries,
  mergeSearchIndex,
  normalizeText,
  normalizeQuery,
  normalizedTextMap,
  parsePostsState,
  serializePostsState,
} from './model';
import type { CatalogEntry, PostsState, SortMode } from './model';

const POSTS_PER_PAGE = 10;
const SEARCH_INPUT_DELAY_MS = 250;
const SEARCH_INDEX_TIMEOUT_MS = 12000;
const SCROLL_STATE_KEY = 'postsListState';
const DYNAMIC_POST_CONTROL = '#react-posts-results a[href], #react-posts-results button, #react-posts-achievements-link, #react-posts-retry-search-index, #react-posts-restore-scroll, .posts-reset, .posts-scroll-location';

function isUnavailableControl(control: HTMLElement): boolean {
  return !control.isConnected || control.matches(':disabled')
    || !!control.closest('[hidden], [inert], [aria-hidden="true"]');
}

type SearchIndexStatus = 'loading' | 'ready' | 'incomplete' | 'failed';
type HistoryMode = 'push' | 'replace';

interface PostsAppProps {
  fallbackPosts: CatalogEntry[];
  categoryLabels: Map<string, string>;
  searchIndexUrl: string;
  siteBaseUrl: string;
  postsUrl: string;
  achievementsUrl: string;
  expectedPagePaths: readonly string[];
  expectedAchievementPaths: readonly string[];
  rootElement: HTMLElement;
  fallbackElement: HTMLElement;
}

interface StoredScrollState extends PostsState {
  path: string;
  scrollY: number;
  entryKey: string;
  entryId: string;
}

interface TextSegment {
  text: string;
  highlighted: boolean;
}

function normalizedTextContent(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function textSegments(value: string, query: string): TextSegment[] {
  const text = value;
  const terms = normalizeText(query).split(' ').filter(Boolean);
  if (!text || terms.length === 0) return [{ text, highlighted: false }];

  const { normalized: searchable, starts, ends } = normalizedTextMap(text);
  const ranges: Array<[number, number]> = [];
  terms.forEach(term => {
    let start = 0;
    let match = -1;
    while ((match = searchable.indexOf(term, start)) !== -1) {
      ranges.push([starts[match], ends[match + term.length - 1]]);
      start = match + 1;
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

  const searchable = normalizeText(source);
  const firstMatch = terms
    .map(term => searchable.indexOf(term))
    .filter(index => index >= 0)
    .reduce((minimum, index) => Math.min(minimum, index), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(firstMatch)) return `${source.slice(0, 177)}…`;

  const { starts } = normalizedTextMap(source, firstMatch);
  const start = Math.max(0, starts[firstMatch] - 60);
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
  if (href === currentHref) return;
  if (mode === 'push') window.history.pushState(window.history.state, '', href);
  else window.history.replaceState(window.history.state, '', href);
}

interface SearchDraftOrigin {
  lastHref: string;
  entryKey: string | null;
  entryId: string | null;
}

// 이력 항목과 슬롯을 모두 확인한다. 식별값이 없거나 중복되면 추측해 복원하지 않는다.
function currentHistoryIdentity(): { key: string; id: string } | null {
  try {
    const navigation = (window as unknown as { navigation?: {
      currentEntry: { key: string; id: string } | null;
      entries: () => Array<{ key: string; id: string }>;
    } }).navigation;
    const entry = navigation?.currentEntry;
    if (!entry || typeof entry.key !== 'string' || !entry.key
      || typeof entry.id !== 'string' || !entry.id) return null;
    const entries = navigation.entries();
    if (!Array.isArray(entries)
      || entries.filter(item => item.key === entry.key).length !== 1
      || entries.filter(item => item.id === entry.id).length !== 1) return null;
    return { key: entry.key, id: entry.id };
  } catch {
    return null;
  }
}

function readScrollRecords(): StoredScrollState[] {
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(SCROLL_STATE_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return [];
    const envelope = stored as { version?: unknown; entries?: unknown };
    if (envelope.version !== 2 || !Array.isArray(envelope.entries)) return [];
    return envelope.entries.filter((value: Partial<StoredScrollState> | null): value is StoredScrollState =>
      !!value && typeof value.entryKey === 'string' && !!value.entryKey
      && typeof value.entryId === 'string' && !!value.entryId
      && typeof value.path === 'string' && typeof value.category === 'string'
      && typeof value.query === 'string' && typeof value.sort === 'string'
      && Number.isInteger(value.page) && (value.page ?? 0) >= 1
      && typeof value.scrollY === 'number' && Number.isFinite(value.scrollY)
      && value.scrollY > 0 && value.scrollY <= Number.MAX_SAFE_INTEGER).slice(-50);
  } catch {
    return [];
  }
}

function currentScrollSnapshot(state: PostsState): StoredScrollState | null {
  const identity = currentHistoryIdentity();
  if (!identity) return null;
  return {
    ...state,
    path: window.location.pathname,
    scrollY: window.scrollY || window.pageYOffset || 0,
    entryKey: identity.key,
    entryId: identity.id,
  };
}

function saveScrollSnapshot(stored: StoredScrollState | null): void {
  try {
    if (!stored) return;
    const remaining = readScrollRecords().filter(item => item.entryKey !== stored.entryKey);
    if (stored.scrollY > 0 && Number.isFinite(stored.scrollY) && stored.scrollY <= Number.MAX_SAFE_INTEGER) remaining.push(stored);
    window.sessionStorage.setItem(SCROLL_STATE_KEY, JSON.stringify({ version: 2, entries: remaining.slice(-50) }));
  } catch {
    // Storage can be unavailable in private browsing or constrained webviews.
  }
}

function saveScrollState(state: PostsState): void {
  saveScrollSnapshot(currentScrollSnapshot(state));
}

function readScrollState(): StoredScrollState | null {
  const identity = currentHistoryIdentity();
  if (!identity) return null;
  return readScrollRecords().find(value => value.entryKey === identity.key && value.entryId === identity.id) || null;
}

function isCurrentDraft(origin: SearchDraftOrigin): boolean {
  if (origin.lastHref !== window.location.href) return false;
  const identity = currentHistoryIdentity();
  return !origin.entryKey || (!!identity && origin.entryKey === identity.key && origin.entryId === identity.id);
}

function scrollStateMatches(stored: StoredScrollState | null, state: PostsState): boolean {
  const identity = currentHistoryIdentity();
  return !!stored && !!identity && stored.entryKey === identity.key && stored.entryId === identity.id
    && stored.path === window.location.pathname && stored.category === state.category && stored.page === state.page
    && stored.query === state.query && stored.sort === state.sort;
}

// 이동한 화면에 실제로 보이는 내용을 포커스해 키보드 사용자의 위치를 맞춘다.
function focusVisibleScrollDestination(): void {
  const focusableSelector = 'a[href], button, input, select, textarea, summary, [tabindex]';
  // 컨테이너 자체에 포커스하면 화면 위쪽의 자식부터 Tab이 다시 시작될 수 있다.
  const isLeaf = (element: HTMLElement) => !element.querySelector(focusableSelector);
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(
    '#react-posts-list .post-preview h2 a, #react-posts-list .post-excerpt, #react-posts-pagination, footer',
  ));
  const isVisible = (element: HTMLElement) => {
    if (element.closest('[hidden], [inert], [aria-hidden="true"]') || element.matches(':disabled')) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  };
  const visible = candidates.filter(element => isVisible(element) && isLeaf(element))
    .sort((left, right) => Math.abs(left.getBoundingClientRect().top) - Math.abs(right.getBoundingClientRect().top));
  const point = typeof document.elementFromPoint === 'function'
    ? document.elementFromPoint(Math.max(0, window.innerWidth / 2), Math.max(0, window.innerHeight / 2))
    : null;
  const pointTarget = point instanceof HTMLElement && point !== document.body
    && point !== document.documentElement && isVisible(point) && isLeaf(point) ? point : null;
  // 빈 공간을 클릭 위치로 선택했더라도 가능한 한 문서 순서 안의 실제 내용을 사용한다.
  const otherVisible = Array.from(document.querySelectorAll<HTMLElement>(
    'main a[href], main button, main p, main h1, main h2, main h3, main article, main nav, footer, footer a[href]',
  )).filter(element => isVisible(element) && isLeaf(element)).sort((left, right) => Math.abs(left.getBoundingClientRect().top) - Math.abs(right.getBoundingClientRect().top));
  const target = visible[0] || pointTarget || otherVisible[0];
  if (target) {
    const previousTabIndex = target.getAttribute('tabindex');
    const cleanup = () => {
      target.classList.remove('posts-restore-focus');
      if (previousTabIndex === null) target.removeAttribute('tabindex');
      else target.setAttribute('tabindex', previousTabIndex);
    };
    if (target.tabIndex < 0) target.setAttribute('tabindex', '-1');
    target.classList.add('posts-restore-focus');
    target.addEventListener('blur', cleanup, { once: true });
    target.focus({ preventScroll: true });
    if (document.activeElement === target) return;
    target.removeEventListener('blur', cleanup);
    cleanup();
  }
  // 화면에 보이는 본문 요소를 찾지 못한 드문 경우에도 포커스를 화면 안에 둔다.
  const marker = document.createElement('span');
  marker.className = 'posts-scroll-location posts-restore-focus';
  marker.tabIndex = -1;
  marker.textContent = '이동한 위치';
  marker.addEventListener('blur', () => marker.remove(), { once: true });
  // 다음 조작 대상 앞에 두어, 고정 위치에 보이는 표식에서 Tab을 누를 때
  // 화면 뒤쪽 본문을 건너뛰고 푸터로 이동하지 않도록 한다.
  const following = Array.from(document.querySelectorAll<HTMLElement>(
    'main a[href], main button, main input, main select, main textarea, main summary, main [tabindex], footer a[href], footer button, footer input, footer select, footer textarea, footer summary, footer [tabindex]',
  )).filter(element => {
    if (isUnavailableControl(element) || element.tabIndex < 0) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
      && rect.bottom > 0 && rect.right > 0 && rect.left < window.innerWidth
      && rect.right > rect.left && rect.bottom > rect.top;
  }).sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top)[0];
  // 제목·레이블 등 안에 표식을 넣으면 접근 가능한 이름이 일시적으로 바뀐다.
  const namingAncestor = following?.parentElement?.closest('h1, h2, h3, h4, h5, h6, label, legend, summary, a, button');
  const insertionPoint = namingAncestor || following || document.querySelector('footer');
  if (insertionPoint?.parentNode) insertionPoint.parentNode.insertBefore(marker, insertionPoint);
  else document.body.append(marker);
  marker.focus({ preventScroll: true });
  if (document.activeElement !== marker) marker.remove();
}

function StatusMessage({
  query,
  status,
  missingPostCount,
  missingPageCount,
  invalidRowCount,
  totalPosts,
}: {
  query: string;
  status: SearchIndexStatus;
  missingPostCount: number;
  missingPageCount: number;
  invalidRowCount: number;
  totalPosts: number;
}) {
  if (!query) return null;
  if (status === 'ready') return null;

  let message = '검색 인덱스를 불러오는 중입니다. 지금은 글 목록의 제목·요약·태그와 본문 앞부분만 검색하며, 성과·시리즈·도구 페이지는 아직 검색되지 않습니다.';
  if (status === 'failed') {
    message = '전체 본문 인덱스를 불러오지 못했습니다. 현재 글 목록의 제목·요약·태그와 본문 앞부분에서 검색합니다. 성과·시리즈·도구 페이지는 검색되지 않습니다.';
  } else if (status === 'incomplete') {
    const missingPosts = missingPostCount > 0
      ? `전체 ${totalPosts}개 글 중 ${missingPostCount}개의 본문 인덱스를 불러오지 못했습니다. `
      : '';
    const missingPages = missingPageCount > 0 ? `${missingPageCount}개 안내 페이지(성과 포함)가 검색 인덱스에서 누락됐습니다. ` : '';
    const invalidRows = invalidRowCount > 0 ? '검색 인덱스 일부를 읽지 못해 결과가 누락될 수 있습니다. ' : '';
    message = `${missingPosts}${missingPages}${invalidRows}현재 확인된 데이터와 글 목록을 함께 검색합니다.`;
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
  achievementsUrl,
  expectedPagePaths,
  expectedAchievementPaths,
  rootElement,
  fallbackElement,
}: PostsAppProps) {
  const decodedFallbackPosts = useMemo(() => decodeFallbackPosts(fallbackPosts), [fallbackPosts]);
  const validCategories = useMemo(() => new Set(categoryLabels.keys()), [categoryLabels]);
  const [state, setState] = useState(() => parsePostsState(window.location.href, validCategories));
  const [draftQuery, setDraftQuery] = useState(state.query);
  const [entries, setEntries] = useState(decodedFallbackPosts);
  const [indexStatus, setIndexStatus] = useState<SearchIndexStatus>('loading');
  const [missingPostCount, setMissingPostCount] = useState(0);
  const [missingPageCount, setMissingPageCount] = useState(0);
  const [invalidRowCount, setInvalidRowCount] = useState(0);
  const [canRetry, setCanRetry] = useState(false);
  const [savedScroll, setSavedScroll] = useState<StoredScrollState | null>(readScrollState);
  const [restoreMessage, setRestoreMessage] = useState('');
  const stateRef = useRef(state);
  const flushPendingScrollRef = useRef<() => void>(() => {});
  // 실시간 검색은 URL을 갱신하되 명시적으로 제출하기 전의 이력을 보존한다.
  const searchDraftOriginRef = useRef<SearchDraftOrigin | null>(null);
  const queryTimerRef = useRef<number | null>(null);
  const isComposingRef = useRef(false);
  const navigationRevisionRef = useRef(0);
  const compositionRevisionRef = useRef(0);
  const indexRequestRef = useRef<{ id: number; cancel: () => void } | null>(null);
  const indexRequestIdRef = useRef(0);
  const focusResultsAfterPageChangeRef = useRef(false);
  const entriesRef = useRef(entries);
  const pendingIndexFocusRef = useRef<{ control: HTMLElement; resultLink: boolean; cancelled: boolean; cleanup: () => void } | null>(null);
  const pendingHistoryFocusRef = useRef<{ control: HTMLElement; cancelled: boolean; cleanup: () => void } | null>(null);
  const restoreControlFocusRef = useRef(false);
  stateRef.current = state;
  entriesRef.current = entries;

  const rankedEntries = useMemo(
    () => getRankedEntries(entries, { query: state.query, category: state.category, sort: state.sort }),
    [entries, state.category, state.query, state.sort],
  );
  const pageWindow = getPageWindow(rankedEntries.length, state.page, POSTS_PER_PAGE);
  const visibleEntries = rankedEntries.slice(pageWindow.startIndex, pageWindow.endIndex);
  const categoryOptions = Array.from(categoryLabels.entries()).sort((left, right) => left[1].localeCompare(right[1], 'ko-KR'));
  const isLoading = indexStatus === 'loading';
  const statusMessage = state.query && indexStatus !== 'ready';
  // 입력과 결과가 일치할 때까지 기존 결과를 보존하되 선택할 수 없게 한다.
  // 대소문자와 공백만 다른 검색은 같은 결과로 취급한다.
  const searchPending = normalizeText(draftQuery) !== normalizeText(state.query);
  const hasSavedScroll = scrollStateMatches(savedScroll, state);
  const restoreUnavailable = isLoading || searchPending;
  const showRetry = canRetry && (state.query.length > 0 || hasSavedScroll);


  useLayoutEffect(() => {
    rootElement.hidden = false;
    fallbackElement.hidden = true;
  }, [fallbackElement, rootElement]);

  useLayoutEffect(() => {
    if (hasSavedScroll || !restoreControlFocusRef.current) return;
    restoreControlFocusRef.current = false;
    if (document.activeElement === document.body) {
      rootElement.querySelector<HTMLInputElement>('#react-posts-search-input')?.focus();
    }
  }, [hasSavedScroll, rootElement]);

  useLayoutEffect(() => {
    if (!focusResultsAfterPageChangeRef.current) return;
    const focusTarget = rootElement.querySelector<HTMLElement>(
      '#react-posts-list .post-preview h2 a, #react-posts-clear-filters',
    ) || rootElement.querySelector<HTMLInputElement>('#react-posts-search-input');
    focusTarget?.focus();
    focusResultsAfterPageChangeRef.current = false;
  }, [rootElement, state.page, state.query]);

  // 이력 이동으로 포커스한 결과·페이지·임시 안내의 조작 대상이 제거되거나
  // 비활성화된 경우에만 검색 입력으로 복구한다.
  useLayoutEffect(() => {
    const pending = pendingHistoryFocusRef.current;
    if (!pending) return;
    pendingHistoryFocusRef.current = null;
    pending.cleanup();
    const control = pending.control;
    if (pending.cancelled || !isUnavailableControl(control)
      || (document.activeElement !== document.body && document.activeElement !== control)) return;
    rootElement.querySelector<HTMLInputElement>('#react-posts-search-input')?.focus();
  }, [rootElement, state]);

  // 색인 갱신으로 기존 조작 대상이 없어지거나 비활성화될 때만 포커스를 복구한다.
  useLayoutEffect(() => {
    const pending = pendingIndexFocusRef.current;
    if (!pending) return;
    pendingIndexFocusRef.current = null;
    pending.cleanup();
    const control = pending.control;
    if (pending.cancelled || !isUnavailableControl(control)
      || (document.activeElement !== document.body && document.activeElement !== control)) return;
    const links = Array.from(rootElement.querySelectorAll<HTMLElement>('#react-posts-list .post-preview h2 a'));
    const target = !pending.resultLink || searchPending
      ? rootElement.querySelector<HTMLInputElement>('#react-posts-search-input')
      : links.find(link => link.getAttribute('href') === control.getAttribute('href'))
        || links[0]
        || rootElement.querySelector<HTMLElement>('#react-posts-clear-filters')
        || rootElement.querySelector<HTMLInputElement>('#react-posts-search-input');
    target?.focus();
  }, [entries, rootElement, searchPending]);

  const replaceIndexEntries = useCallback((nextEntries: CatalogEntry[]) => {
    pendingIndexFocusRef.current?.cleanup();
    pendingIndexFocusRef.current = null;
    const active = document.activeElement;
    if (nextEntries !== entriesRef.current && active instanceof HTMLElement
      && rootElement.contains(active) && active.matches(DYNAMIC_POST_CONTROL)) {
      const pending = { control: active, resultLink: active.matches('#react-posts-list .post-preview h2 a'), cancelled: false, cleanup: () => {} };
      const cancelRecovery = () => { pending.cancelled = true; };
      const eventTypes = ['focusin', 'pointerdown', 'keydown'] as const;
      eventTypes.forEach(type => document.addEventListener(type, cancelRecovery, true));
      pending.cleanup = () => eventTypes.forEach(type => document.removeEventListener(type, cancelRecovery, true));
      pendingIndexFocusRef.current = pending;
    }
    setEntries(nextEntries);
  }, [rootElement]);

  const loadSearchIndex = useCallback(async (retry = false): Promise<boolean> => {
    indexRequestRef.current?.cancel();
    const id = ++indexRequestIdRef.current;
    const controller = new AbortController();
    let rejectInterruption: (reason?: unknown) => void = () => {};
    const interruption = new Promise<never>((_, reject) => { rejectInterruption = reject; });
    const timeout = window.setTimeout(() => {
      controller.abort();
      rejectInterruption(new Error('Search index request timed out.'));
    }, SEARCH_INDEX_TIMEOUT_MS);
    indexRequestRef.current = {
      id,
      cancel: () => {
        controller.abort();
        rejectInterruption(new Error('Search index request cancelled.'));
      },
    };
    setIndexStatus('loading');
    try {
      const resolvedUrl = new URL(searchIndexUrl, window.location.href).href;
      const payload: unknown = await Promise.race([
        window.fetch(resolvedUrl, { signal: controller.signal, cache: retry ? 'reload' : 'default' }).then(response => {
          if (!response.ok) throw new Error(`Search index request failed: ${response.status}`);
          return response.json();
        }),
        interruption,
      ]);
      if (indexRequestRef.current?.id !== id) return false;
      const merged = mergeSearchIndex(decodedFallbackPosts, payload, siteBaseUrl, expectedPagePaths, expectedAchievementPaths);
      replaceIndexEntries(merged.entries);
      setMissingPostCount(merged.missingPostCount);
      setMissingPageCount(merged.missingPageCount);
      setInvalidRowCount(merged.invalidRowCount);
      const incomplete = merged.missingPostCount > 0 || merged.missingPageCount > 0 || merged.invalidRowCount > 0;
      setCanRetry(incomplete);
      setIndexStatus(incomplete ? 'incomplete' : 'ready');
      return !incomplete;
    } catch {
      if (indexRequestRef.current?.id !== id) return false;
      replaceIndexEntries(decodedFallbackPosts);
      setMissingPostCount(decodedFallbackPosts.length);
      setMissingPageCount(0);
      setInvalidRowCount(0);
      setCanRetry(true);
      setIndexStatus('failed');
      return false;
    } finally {
      window.clearTimeout(timeout);
      if (indexRequestRef.current?.id === id) indexRequestRef.current = null;
    }
  }, [expectedPagePaths, expectedAchievementPaths, decodedFallbackPosts, replaceIndexEntries, searchIndexUrl, siteBaseUrl]);

  useEffect(() => {
    void loadSearchIndex();
    return () => {
      const pending = indexRequestRef.current;
      indexRequestRef.current = null;
      pending?.cancel();
      pendingIndexFocusRef.current?.cleanup();
      pendingIndexFocusRef.current = null;
      pendingHistoryFocusRef.current?.cleanup();
      pendingHistoryFocusRef.current = null;
    };
  }, [loadSearchIndex]);

  useEffect(() => {
    if (state.query && indexStatus === 'loading') return;
    const clampedPage = pageWindow.page;
    if (clampedPage === state.page) return;
    const normalizedState = { ...state, page: clampedPage };
    stateRef.current = normalizedState;
    setState(normalizedState);
    const origin = searchDraftOriginRef.current;
    if (origin && !isCurrentDraft(origin)) searchDraftOriginRef.current = null;
    writeHistory(normalizedState, 'replace');
    if (searchDraftOriginRef.current) {
      const identity = currentHistoryIdentity();
      searchDraftOriginRef.current = { lastHref: window.location.href, entryKey: identity?.key || null, entryId: identity?.id || null };
    }
    setSavedScroll(readScrollState());
  }, [indexStatus, pageWindow.page, state]);

  useEffect(() => {
    let pending: StoredScrollState | null = null;
    const flush = () => {
      saveScrollSnapshot(pending);
      pending = null;
    };
    flushPendingScrollRef.current = flush;
    const onScroll = () => {
      const current = stateRef.current;
      const actual = parsePostsState(window.location.href, validCategories);
      if (actual.query !== current.query || actual.category !== current.category
        || actual.sort !== current.sort || actual.page !== current.page) return;
      const next = currentScrollSnapshot(current);
      if (!next) return;
      if (pending && (pending.entryKey !== next.entryKey || pending.entryId !== next.entryId)) flush();
      pending = next;
    };
    // pagehide에서는 현재 항목이 이미 바뀌었을 수 있어 포착해 둔 값만 기록한다.
    const saveOnExit = () => flush();
    const refreshOnReturn = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setSavedScroll(readScrollState());
        setRestoreMessage('');
      }
    };
    window.addEventListener('pagehide', saveOnExit);
    window.addEventListener('pageshow', refreshOnReturn);
    window.addEventListener('scroll', onScroll, { passive: true });
    // popstate에서는 이미 목적 이력이 활성화되어 있으므로 이전 스냅샷을 먼저 기록한다.
    window.addEventListener('popstate', flush);
    return () => {
      flush();
      flushPendingScrollRef.current = () => {};
      window.removeEventListener('pagehide', saveOnExit);
      window.removeEventListener('pageshow', refreshOnReturn);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('popstate', flush);
    };
  }, [validCategories]);

  useEffect(() => {
    const handlePopState = () => {
      if (queryTimerRef.current !== null) window.clearTimeout(queryTimerRef.current);
      queryTimerRef.current = null;
      navigationRevisionRef.current += 1;
      searchDraftOriginRef.current = null;
      isComposingRef.current = false;
      focusResultsAfterPageChangeRef.current = false;
      pendingHistoryFocusRef.current?.cleanup();
      pendingHistoryFocusRef.current = null;
      const active = document.activeElement;
      if (active instanceof HTMLElement && rootElement.contains(active)
        && active.matches(DYNAMIC_POST_CONTROL)) {
        const pending = { control: active, cancelled: false, cleanup: () => {} };
        const cancelRecovery = () => { pending.cancelled = true; };
        const eventTypes = ['focusin', 'pointerdown', 'keydown'] as const;
        eventTypes.forEach(type => document.addEventListener(type, cancelRecovery, true));
        pending.cleanup = () => eventTypes.forEach(type => document.removeEventListener(type, cancelRecovery, true));
        pendingHistoryFocusRef.current = pending;
      }
      setRestoreMessage('');
      setSavedScroll(readScrollState());
      const restored = parsePostsState(window.location.href, validCategories);
      stateRef.current = restored;
      setState(restored);
      setDraftQuery(restored.query);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [rootElement, validCategories]);

  useEffect(() => () => {
    if (queryTimerRef.current !== null) window.clearTimeout(queryTimerRef.current);
  }, []);

  const transition = useCallback((
    changes: Partial<PostsState>,
    historyMode: HistoryMode,
    preserveDraft = false,
  ) => {
    const current = stateRef.current;
    const next: PostsState = {
      ...current,
      ...changes,
      query: normalizeQuery(changes.query ?? current.query),
      page: changes.page ?? current.page,
    };
    stateRef.current = next;
    setRestoreMessage('');
    setState(next);
    if (!preserveDraft) setDraftQuery(next.query);
    let origin = searchDraftOriginRef.current;
    // 다른 코드가 주소를 바꿨다면 이미 다른 이력일 수 있어 덮어쓰지 않는다.
    if (origin && !isCurrentDraft(origin)) {
      searchDraftOriginRef.current = null;
      origin = null;
    }
    // 분류·정렬·페이지 이동은 사용자가 이미 본 검색 결과 다음의 별도 이력이다.
    if (historyMode === 'push' && origin) searchDraftOriginRef.current = null;
    const changesUrl = serializePostsState(window.location.href, next)
      !== `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (changesUrl) flushPendingScrollRef.current();
    if (historyMode === 'push' && changesUrl) saveScrollState(current);
    writeHistory(next, historyMode);
    if (searchDraftOriginRef.current) {
      const identity = currentHistoryIdentity();
      searchDraftOriginRef.current = { lastHref: window.location.href, entryKey: identity?.key || null, entryId: identity?.id || null };
    }
    setSavedScroll(readScrollState());
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
      // Applying the search must not erase a trailing space while the reader
      // is still typing the next term.
      const current = stateRef.current;
      const sameSearch = normalizeText(value) === normalizeText(current.query);
      if (searchDraftOriginRef.current && !isCurrentDraft(searchDraftOriginRef.current)) {
        searchDraftOriginRef.current = null;
      }
      if (!sameSearch && !searchDraftOriginRef.current) {
        // 최초 변경은 별도 항목으로 남겨, 제출 전 뒤로 가기도 이전 검색을 복원한다.
        transition({ query: value, page: 1 }, 'push', true);
        const identity = currentHistoryIdentity();
        searchDraftOriginRef.current = { lastHref: window.location.href, entryKey: identity?.key || null, entryId: identity?.id || null };
        return;
      }
      transition({ query: value, page: sameSearch ? current.page : 1 }, 'replace', true);
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
    const current = stateRef.current;
    const sameSearch = normalizeText(draftQuery) === normalizeText(current.query);
    const hasDraft = !!searchDraftOriginRef.current && isCurrentDraft(searchDraftOriginRef.current);
    transition({ query: draftQuery, page: sameSearch ? current.page : 1 }, sameSearch || hasDraft ? 'replace' : 'push');
    searchDraftOriginRef.current = null;
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

  const applyPageChange = (page: number) => {
    // Pagination still describes the previous results while an IME composition
    // is active. Let the composition finish before changing the result set.
    if (isComposingRef.current) return;
    clearQueryTimer();
    const current = stateRef.current;
    const query = normalizeQuery(draftQuery);
    const sameSearch = normalizeText(query) === normalizeText(current.query);
    const nextPage = sameSearch ? page : 1;
    // Reselecting the current page creates no render to consume a focus request.
    // Do not let that stale request move focus after a later search.
    if (query === current.query && nextPage === current.page) return;
    if (sameSearch && nextPage === current.page) {
      // A spelling-only change doesn't move the user to the results or add a
      // duplicate history entry, but it must be reflected in the input and URL.
      transition({ query, page: nextPage }, 'replace');
      return;
    }
    focusResultsAfterPageChangeRef.current = true;
    // A pending search changes the result set, so start at its first page
    // rather than navigating to a page number from the old results.
    transition({ query, page: nextPage }, 'push');
  };

  const handlePageClick = (event: MouseEvent<HTMLAnchorElement>, page: number) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    applyPageChange(page);
  };

  const handleStepPage = (page: number) => {
    if (page < 1 || page > pageWindow.totalPages) return;
    applyPageChange(page);
  };

  const handleRestoreScroll = () => {
    const latest = readScrollState();
    const actualState = parsePostsState(window.location.href, validCategories);
    if (!hasSavedScroll || !savedScroll || restoreUnavailable || !scrollStateMatches(latest, actualState)
      || latest?.scrollY !== savedScroll.scrollY) {
      setSavedScroll(latest);
      return;
    }
    try {
      window.scrollTo({ top: savedScroll.scrollY, behavior: 'auto' });
      const limited = window.scrollY < savedScroll.scrollY - 1;
      setRestoreMessage(limited
        ? '페이지 길이가 달라 이전 위치까지 이동하지 못했습니다. 현재 가능한 위치로 이동했습니다.'
        : '이전 위치로 이동했습니다.');
      focusVisibleScrollDestination();
    } catch {
      setRestoreMessage('이전 위치로 이동하지 못했습니다. 직접 스크롤해 주세요.');
    }
  };

  const handleRetry = async () => {
    // state 렌더 전에 연속 입력이 들어와도 진행 중인 요청을 중복하지 않는다.
    if (isLoading || indexRequestRef.current) return;
    const retryButton = rootElement.querySelector<HTMLButtonElement>('#react-posts-retry-search-index');
    const hadFocus = document.activeElement === retryButton;
    let userMovedOn = false;
    const noteInteraction = () => { userMovedOn = true; };
    const eventTypes = ['focusin', 'pointerdown', 'keydown'] as const;
    if (hadFocus) eventTypes.forEach(type => document.addEventListener(type, noteInteraction, true));
    try {
      const complete = await loadSearchIndex(true);
      if (hadFocus && !userMovedOn && complete && (document.activeElement === retryButton || document.activeElement === document.body)) {
        rootElement.querySelector<HTMLInputElement>('#react-posts-search-input')?.focus();
      }
    } finally {
      if (hadFocus) eventTypes.forEach(type => document.removeEventListener(type, noteInteraction, true));
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
                      placeholder="글·성과·도구 검색"
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
                  <span id="react-posts-search-instructions" className="visually-hidden">글과 성과, 시리즈, 도구의 제목과 내용에서 검색합니다. 입력하면 결과가 자동으로 바뀝니다.</span>
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
            <span id="react-posts-count" role="status" aria-live="polite">{searchPending ? '검색어를 반영하고 있습니다.' : countLabel}</span>
            {state.query && state.category !== 'all' && (
              <span className="posts-search-status">카테고리는 글에만 적용됩니다. 성과·시리즈·도구를 검색하려면 전체 주제를 선택하세요.</span>
            )}
            <StatusMessage
              query={state.query}
              status={indexStatus}
              missingPostCount={missingPostCount}
              missingPageCount={missingPageCount}
              invalidRowCount={invalidRowCount}
              totalPosts={fallbackPosts.length}
            />
            {state.query && indexStatus !== 'ready' && (
              <a id="react-posts-achievements-link" className="posts-search-status" href={achievementsUrl}>성과 목록 보기</a>
            )}
            {showRetry && (
              <button
                id="react-posts-retry-search-index"
                className="inline-action-btn posts-search-retry"
                type="button"
                aria-controls="react-posts-list"
                aria-disabled={isLoading || undefined}
                onClick={handleRetry}
              >
                {isLoading ? '검색 인덱스를 다시 불러오는 중…' : '검색 인덱스 다시 시도'}
              </button>
            )}
          <span id="react-posts-restore-status" className="posts-restore-status" role="status" aria-live="polite">
            {hasSavedScroll && restoreUnavailable
              ? isLoading ? '검색 목록을 불러온 뒤 이전 위치로 이동할 수 있습니다.' : '검색어를 반영한 뒤 이전 위치로 이동할 수 있습니다.'
              : hasSavedScroll && (indexStatus === 'failed' || indexStatus === 'incomplete')
                ? restoreMessage
                  ? `${restoreMessage} 현재 불러온 내용 기준이며, 검색 인덱스를 다시 불러오면 결과가 달라질 수 있습니다.`
                  : '현재 불러온 내용에서 이전 위치로 이동합니다. 검색 인덱스를 다시 불러오면 결과가 달라질 수 있습니다.'
                : hasSavedScroll ? restoreMessage : ''}
          </span>
          </div>
          <div className="posts-meta-actions">
            {hasSavedScroll && (
              <button
                id="react-posts-restore-scroll"
                type="button"
                className="inline-action-btn posts-restore"
                aria-disabled={restoreUnavailable || undefined}
                aria-describedby="react-posts-restore-status"
                onFocus={() => { restoreControlFocusRef.current = true; }}
                onBlur={() => { restoreControlFocusRef.current = false; }}
                onClick={handleRestoreScroll}
              >이전 위치로 이동</button>
            )}
            {(state.query || state.category !== 'all' || state.sort !== 'date') && rankedEntries.length > 0 && (
              <button type="button" className="inline-action-btn posts-reset" onClick={handleReset}>검색 조건 초기화</button>
            )}
          </div>
        </div>
      </div>

      <div id="react-posts-results" hidden={searchPending} style={{ display: searchPending ? 'none' : undefined }}>
      <div id="react-posts-list" className={rankedEntries.length > 0 ? 'posts-list' : undefined}>
        {rankedEntries.length > 0 ? (
          <>
          {visibleEntries.map(({ entry }) => {
            const excerpt = getExcerpt(entry, state.query);
            const metaLabels = entry.kind === 'post'
              ? entry.categories.map(category => categoryLabelFor(category, categoryLabels))
              : [entry.kind === 'series' ? '시리즈' : entry.kind === 'achievement' ? '성과' : '도구'];
            return (
              <article className="post-preview visible" key={`${entry.kind}:${entry.path}`}>
                <h2><a href={entry.href}><span className="post-title-text" lang={entry.language}><HighlightedText text={entry.title} query={state.query} /></span></a></h2>
                <div className="post-meta">
                  {entry.date && <time dateTime={entry.date}>{formatDate(entry.date)}</time>}
                  {metaLabels.map((label, index) => <span className="category" key={`${label}:${index}`}>{label}</span>)}
                </div>
                <p className="post-excerpt" lang={entry.language}><HighlightedText text={excerpt} query={state.query} /></p>
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
