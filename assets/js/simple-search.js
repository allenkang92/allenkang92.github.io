/**
 * Simple Search Functionality
 * A lightweight, accessible search implementation for Jekyll sites
 */

(function() {
    'use strict';
    
    // DOM Elements
    let searchInput;
    let searchForm;
    let searchContainer;
    let searchResults;
    let searchSubmitBtn;
    let searchLoading;
    const MAX_VISIBLE_SEARCH_RESULTS = 50;
    const SEARCH_INDEX_TIMEOUT_MS = 10000;
    
    // State
    let searchData = [];
    let searchTimeout;
    let searchRevision = 0;
    let lastRenderedQuery = '';
    let searchStatus;
    let searchIndexReady = false;
    let searchIndexFailed = false;
    let shouldShowSearchFeedback = false;
    let suppressSearchFocus = false;
    let isComposing = false;
    let compositionCanceledByHistory = false;
    let pendingIndexHistoryMode = 'replace';
    let pendingIndexTrackDraft = false;
    let originalSearchParams = null;
    let categoryLabels = Object.create(null);
    let indexCompletenessUnknown = false;
    let currentResults = [];
    let visibleResults = 0;

    // 결과 수 요약만 보조기술에 알린다 (결과 목록 전체 낭독 방지)
    function announceStatus(message) {
        if (!searchStatus) {
            searchStatus = document.getElementById('search-status');
        }
        if (searchStatus) {
            searchStatus.textContent = message || '';
        }
    }
    
    // Initialize the search functionality
    function initSearch() {
        // Get DOM elements
        searchForm = document.querySelector('.search-form');
        // 글 목록은 사이드바 검색 폼을 렌더링하지 않는다. URL은 404 등에서
        // 실제 페이지와 다를 수 있으므로 표시된 폼을 기준으로 초기화한다.
        if (!searchForm) return;
        // 배포 중 예전 HTML과 새 스크립트가 섞인 경우에만 종전 라벨을 사용한다.
        // 현재 템플릿이 속성을 제공하면 실제 설정만 진실원으로 취급한다.
        if (!searchForm.hasAttribute('data-category-labels')) {
            Object.assign(categoryLabels, {
                mathematics_philosophy_history: '수학철학·수학사',
                science_philosophy_history: '과학철학·현대물리학',
                web_technologies: '웹 기술',
                daily_life: '일상'
            });
        } else {
            try {
                const labels = JSON.parse(searchForm.dataset.categoryLabels);
                if (labels && typeof labels === 'object' && !Array.isArray(labels)) {
                    for (const [key, label] of Object.entries(labels)) {
                        if (typeof label === 'string' && label.trim()) categoryLabels[key] = label;
                    }
                }
            } catch {
                // 손상된 속성은 분류 키를 표시하는 폴백을 사용한다.
            }
        }
        searchContainer = document.getElementById('search-container');
        searchInput = document.getElementById('search-input');
        searchSubmitBtn = document.querySelector('.search-button');
        searchResults = document.getElementById('search-results');
        searchLoading = document.querySelector('.search-spinner');
        
        if (!searchInput || !searchResults) {
            console.error('Required search elements not found');
            return;
        }
        
        // Initialize the URL query before asynchronous loading so that a later
        // response cannot overwrite text entered while the request is pending.
        const searchQuery = new URLSearchParams(window.location.search).get('q');
        if (searchQuery) {
            searchInput.value = searchQuery;
            updateSearchInputState();
            shouldShowSearchFeedback = !!searchQuery.trim();
        }

        // Load search data
        loadSearchData();
        
        // Set up event listeners
        setupEventListeners();
    }

    // 정식 사이트의 주소만 허용하고 인코딩된 경로를 현재 미리보기 호스트에서 연다.
    function indexEntryHref(rawUrl) {
        try {
            const base = new URL(searchForm.dataset.siteBaseUrl || window.location.origin);
            if (base.protocol !== 'http:' && base.protocol !== 'https:') return null;
            const basePath = base.pathname.replace(/\/+$/, '');
            const directory = new URL(`${basePath || ''}/`, base.origin);
            const address = new URL(rawUrl, directory);
            if ((address.protocol !== 'http:' && address.protocol !== 'https:') || address.origin !== base.origin) return null;
            if (address.username || address.password || address.pathname.startsWith('//')) return null;
            if (basePath && address.pathname !== basePath && !address.pathname.startsWith(`${basePath}/`)) return null;
            return `${address.pathname}${address.search}${address.hash}`;
        } catch {
            return null;
        }
    }

    // 손상된 인덱스를 완전한 검색 결과로 취급하지 않고 글 목록의 제한 검색으로 넘긴다.
    function isValidIndexEntry(entry) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
        if (typeof entry.title !== 'string' || !entry.title.trim()) return false;
        if (typeof entry.url !== 'string' || !entry.url.trim()) return false;
        if (!indexEntryHref(entry.url)) return false;
        for (const key of ['category', 'type', 'description', 'content', 'date']) {
            if (typeof entry[key] !== 'string') return false;
        }
        if (entry.page_kind !== undefined && (entry.type !== 'page' || entry.page_kind !== 'achievement')) return false;
        if (entry.language !== undefined && typeof entry.language !== 'string') return false;
        // 글 목록 검색과 동일하게 빈 본문은 불완전한 색인으로 취급한다.
        if (entry.type === 'post' && !entry.content.trim()) return false;
        return ['post', 'page'].includes(entry.type) && Array.isArray(entry.tags) && entry.tags.every(tag => typeof tag === 'string');
    }

    // 페이지 생성 시점의 검색 대상 경로와 색인을 비교해 부분 응답·중복·버전 차이를 감지한다.
    function normalizedIndexPath(rawUrl) {
        const href = indexEntryHref(rawUrl);
        if (!href) return null;
        try {
            const pathname = new URL(href, window.location.origin).pathname;
            // URL.pathname은 한글을 UTF-8로 인코딩한다. 이중 인코딩된 %25를
            // 해독하면 다른 경로와 충돌하므로 이스케이프의 대소문자만 통일한다.
            if (/%(?![0-9a-f]{2})/i.test(pathname)) return null;
            return pathname.replace(/%[0-9a-f]{2}/gi, value => value.toUpperCase()).replace(/\/+$/, '') || '/';
        } catch {
            return null;
        }
    }

    function hasCompleteIndexType(data, type, expectedJson) {
        let expected;
        try {
            expected = JSON.parse(expectedJson);
        } catch {
            return false;
        }
        if (!Array.isArray(expected) || !expected.every(path =>
            typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !/[?#]/.test(path)
        )) return false;

        const expectedPaths = expected.map(normalizedIndexPath);
        const actualPaths = data.filter(entry => entry.type === type).map(entry => normalizedIndexPath(entry.url));
        if (expectedPaths.includes(null) || actualPaths.includes(null)) return false;
        const expectedSet = new Set(expectedPaths);
        const actualSet = new Set(actualPaths);
        if (expectedSet.size !== expectedPaths.length || actualSet.size !== actualPaths.length) return false;
        return expectedSet.size === actualSet.size && [...expectedSet].every(path => actualSet.has(path));
    }

    // 이전 HTML에는 예상 경로 목록이 없다. 완전성은 검증할 수 없지만
    // 각 경로가 유효하고 같은 종류 안에서 중복되지 않는지는 확인한다.
    function hasValidDistinctIndexPaths(data) {
        return ['post', 'page'].every(type => {
            const paths = data.filter(entry => entry.type === type).map(entry => normalizedIndexPath(entry.url));
            return !paths.includes(null) && new Set(paths).size === paths.length;
        });
    }

    // 검색 색인은 HTML 태그를 제거한 텍스트이며 문자 참조를 한 번 해독한다.
    // 리터럴 <를 먼저 이스케이프해 파서가 요소를 만들지 않도록 한다.
    function decodeSearchText(value) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = value.replace(/</g, '&lt;');
        return textarea.value;
    }
        
    // Load search data from search.json
    function loadSearchData() {
        // Show loading state
        showLoading(true);
        
        // Get the correct path to search.json
        const searchJsonPath = getSearchJsonPath();
        
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        let timeoutId;
        const deadline = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('Search index request timed out'));
                controller?.abort();
            }, SEARCH_INDEX_TIMEOUT_MS);
        });
        // Include response body parsing in the deadline. Some fetch implementations
        // ignore abort, so the race also prevents a late response from taking over.
        const indexRequest = fetch(searchJsonPath, controller ? { signal: controller.signal } : undefined)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load search data: ${response.status} ${response.statusText}`);
                }
                return response.json();
            });
        Promise.race([indexRequest, deadline])
            .then(data => {
                // 실제 이전 검색 폼에는 세 속성이 모두 없다. 새 폼의 일부만
                // 손상된 경우와 구분해 기존 완전성 검사를 우회하지 않는다.
                const legacyForm = !searchForm.hasAttribute('data-expected-post-paths')
                    && !searchForm.hasAttribute('data-expected-page-paths')
                    && !searchForm.hasAttribute('data-category-labels');
                if (!Array.isArray(data) || data.length === 0 || !data.every(isValidIndexEntry)
                    || (legacyForm
                        ? !hasValidDistinctIndexPaths(data)
                        : !hasCompleteIndexType(data, 'post', searchForm.dataset.expectedPostPaths)
                            || !hasCompleteIndexType(data, 'page', searchForm.dataset.expectedPagePaths))) {
                    throw new Error('Search index is empty or invalid');
                }
                indexCompletenessUnknown = legacyForm;
                searchData = data.map(entry => ({
                    ...entry,
                    url: indexEntryHref(entry.url),
                    description: decodeSearchText(entry.description),
                    content: decodeSearchText(entry.content)
                }));
                searchIndexReady = true;
                if (shouldShowSearchFeedback && searchInput.value.trim() && !isComposing) {
                    clearTimeout(searchTimeout);
                    updateSearchInputState();
                    performSearch(searchInput.value.trim(), { historyMode: pendingIndexHistoryMode, trackDraft: pendingIndexTrackDraft });
                }
            })
            .catch(error => {
                searchIndexFailed = true;
                console.error('Error loading search data:', error);
                if (shouldShowSearchFeedback) showIndexError();
            })
            .finally(() => {
                clearTimeout(timeoutId);
                showLoading(false);
            });
    }
    
    // Get the correct path to search.json
    function getSearchJsonPath() {
        return searchForm?.dataset.searchUrl || searchContainer?.dataset.searchUrl || '/search.json';
    }
    
    // Set up event listeners
    function setupEventListeners() {
        // Input event with debounce
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('focus', handleSearchFocus);
        searchInput.addEventListener('compositionstart', handleCompositionStart);
        searchInput.addEventListener('compositionend', handleCompositionEnd);
        searchContainer.addEventListener('keydown', handleSearchEscape);
        searchResults.addEventListener('click', handleMoreResults);
        
        // Form submission
        searchForm.addEventListener('submit', handleFormSubmit);
        
        // Close search when clicking outside
        document.addEventListener('click', handleClickOutside);
        
        // Keyboard navigation
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('popstate', restoreSearchFromUrl);
    }

    function handleCompositionStart() {
        isComposing = true;
        compositionCanceledByHistory = false;
        searchRevision += 1;
        clearTimeout(searchTimeout);
        showLoading(false);
    }

    function handleCompositionEnd() {
        isComposing = false;
        if (compositionCanceledByHistory) {
            compositionCanceledByHistory = false;
            restoreSearchFromUrl();
            return;
        }
        handleSearchInput();
    }

    // A history navigation is a read of state, never a new history write.
    function restoreSearchFromUrl() {
        // 결과 링크가 숨겨지고 교체되기 전에 보이는 입력란으로 포커스를 옮긴다.
        // 검색 영역 밖의 포커스와 닫힌 모바일 메뉴는 건드리지 않는다.
        if (!isComposing && searchResults.contains(document.activeElement)
            && searchInput.isConnected && !searchInput.disabled
            && !searchInput.closest('[hidden], [inert], [aria-hidden="true"]')) {
            let visible = true;
            for (let element = searchInput; element; element = element.parentElement) {
                const style = window.getComputedStyle(element);
                if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
                    visible = false;
                    break;
                }
            }
            if (visible) {
                suppressSearchFocus = true;
                try {
                    searchInput.focus({ preventScroll: true });
                } finally {
                    suppressSearchFocus = false;
                }
            }
        }
        hideResults();
        if (isComposing) compositionCanceledByHistory = true;
        pendingIndexHistoryMode = 'none';
        pendingIndexTrackDraft = false;
        originalSearchParams = null;
        searchInput.value = new URLSearchParams(window.location.search).get('q') || '';
        updateSearchInputState();
        const query = searchInput.value.trim();
        shouldShowSearchFeedback = !!query;
        if (query && searchIndexReady) {
            performSearch(query, { historyMode: 'none' });
        } else if (query && searchIndexFailed) {
            showIndexError();
        }
    }
    
    // Handle search input with debounce
    function handleSearchInput(event) {
        shouldShowSearchFeedback = true;
        updateSearchInputState();
        searchRevision += 1;
        pendingIndexHistoryMode = 'replace';

        // A previous query's links must not remain clickable or keyboard
        // focusable while the new query is waiting for its debounce or IME.
        if (searchInput.value.trim() !== lastRenderedQuery) {
            currentResults = [];
            visibleResults = 0;
            searchResults.replaceChildren();
            searchResults.style.display = 'none';
            searchResults.classList.remove('active');
            lastRenderedQuery = '';
            announceStatus('');
        }
        
        // Clear any existing timeout
        clearTimeout(searchTimeout);

        if (isComposing || event?.isComposing) {
            showLoading(false);
            return;
        }

        pendingIndexTrackDraft = true;
        
        const query = searchInput.value.trim();

        // Whitespace-only edits do not change the effective query. Keeping
        // the existing results avoids replacing a link after it is focused.
        if (query && query === lastRenderedQuery && searchResults.classList.contains('active')) {
            showLoading(false);
            return;
        }
        
        // Hide results if input is empty
        if (query.length === 0) {
            hideResults();
            updateUrl('', { mode: 'replace', trackDraft: true });
            return;
        }

        if (searchIndexFailed) {
            showIndexError();
            return;
        }
        
        // Show loading state
        showLoading(true);
        
        // Debounce the search
        searchTimeout = setTimeout(() => {
            performSearch(query, { historyMode: 'replace', trackDraft: true });
        }, 300);
    }

    // Re-open existing results when users return to the search box.
    function handleSearchFocus() {
        if (suppressSearchFocus) return;
        const query = searchInput.value.trim();
        if (!query) return;

        shouldShowSearchFeedback = true;
        if (searchIndexFailed) {
            showIndexError();
            return;
        }

        if (searchResults && lastRenderedQuery === query) {
            searchResults.style.display = 'block';
            searchResults.classList.add('active');
            return;
        }

        performSearch(query, { historyMode: 'replace', trackDraft: pendingIndexTrackDraft });
    }
    
    // Handle form submission
    function handleFormSubmit(e) {
        if (isComposing) {
            e.preventDefault();
            return;
        }
        // Keep the form's native /posts/ fallback available while the index is
        // unavailable; that page can search its embedded post data.
        if (!searchIndexReady) return;
        e.preventDefault();
        clearTimeout(searchTimeout);
        const query = searchInput.value.trim();
        if (query) {
            // 같은 결과의 포커스를 유지하면서 중복 없는 검색 기록을 남긴다.
            if (query === lastRenderedQuery && searchResults.classList.contains('active')
                && searchResults.querySelector('.search-results-list')) {
                searchRevision += 1;
                showLoading(false);
                updateUrl(query, { mode: 'push' });
                return;
            }
            performSearch(query, { historyMode: 'push' });
        } else {
            // 빈 검색을 명시적으로 제출하면 지우기 전 검색도 기록에 남긴다.
            hideResults();
            updateUrl('', { mode: 'push' });
        }
    }
    
    // Keep visible state in sync with the current query.
    // (aria-expanded는 textbox role에서 유효하지 않아 제거 — WAI-ARIA 1.2)
    function updateSearchInputState() {
        const hasQuery = searchInput.value.trim().length > 0;
        searchInput.closest('.search-input-wrapper')?.classList.toggle('has-query', hasQuery);
    }
    
    // Handle clicks outside the search container
    function handleClickOutside(e) {
        if (e.target.closest && e.target.closest('.sidebar-toggle')) {
            return;
        }

        if (searchContainer && !searchContainer.contains(e.target)) {
            hideResults();
        }
    }
    
    // Close the results before allowing Escape to close the surrounding sidebar.
    function handleSearchEscape(e) {
        if (e.key !== 'Escape' || e.defaultPrevented || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
        if (isComposing || e.isComposing || e.keyCode === 229) {
            // The surrounding drawer also listens for Escape. Keep this event
            // available to the IME without allowing the drawer to close.
            e.stopPropagation();
            return;
        }
        if (!searchResults.classList.contains('active')) return;
        e.stopPropagation();
        hideResults();
        suppressSearchFocus = true;
        try {
            searchInput.focus();
        } finally {
            suppressSearchFocus = false;
        }
    }

    // Handle keyboard navigation
    function handleKeyDown(e) {
        // Preserve editing shortcuts, assistive-technology commands and events
        // already handled by a focused control.
        if (e.defaultPrevented || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey
            || isComposing || e.isComposing || e.keyCode === 229) return;
        const isInsideSearch = searchContainer && searchContainer.contains(document.activeElement);
        
        // Handle arrow key navigation in results
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!isInsideSearch || !searchResults || !searchResults.classList.contains('active')) return;

            const activeElement = document.activeElement;
            const resultItems = Array.from(searchResults.querySelectorAll('.search-result-item a'));
            
            if (resultItems.length === 0) return;
            if (activeElement !== searchInput && !resultItems.includes(activeElement)) return;
            
            const currentIndex = resultItems.indexOf(activeElement);
            let nextIndex;
            
            if (e.key === 'ArrowDown') {
                nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, resultItems.length - 1);
            } else {
                nextIndex = currentIndex === -1 ? resultItems.length - 1 : Math.max(currentIndex - 1, 0);
            }
            
            resultItems[nextIndex].focus();
            e.preventDefault();
        }
    }
    
    // Perform the search
    function performSearch(query, options = {}) {
        if (!searchData || searchData.length === 0) {
            // Keep the in-progress indication visible until the request settles
            // or its deadline makes the native form fallback available.
            showLoading(!searchIndexFailed);
            return;
        }

        const revision = ++searchRevision;
        
        // Show loading state
        showLoading(true);
        
        // Use requestAnimationFrame to prevent UI blocking
        requestAnimationFrame(() => {
            if (revision !== searchRevision) return;
            try {
                const queryLower = normalizeSearchText(query);
                const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);
                
                if (queryTerms.length === 0) {
                    showNoResults('검색어를 입력하세요');
                    return;
                }
                
                // Score and filter results
                const scoredResults = searchData.map(post => {
                    const title = normalizeSearchText(post.title);
                    const description = normalizeSearchText(post.description);
                    const content = normalizeSearchText(post.content);
                    // 페이지의 category는 색인 형식을 위한 값으로 화면에 표시되지 않는다.
                    const category = post.type === 'post'
                        ? normalizeSearchText(`${post.category || ''} ${formatCategoryLabel(post.category)}`)
                        : '';
                    const tags = normalizeSearchText(Array.isArray(post.tags) ? post.tags.join(' ') : '');
                    
                    let score = 0;
                    let matchCount = 0;
                    
                    for (const term of queryTerms) {
                        let termScore = 0;
                        
                        // Title matches (highest weight)
                        if (title.includes(term)) {
                            termScore += 5;
                            // Exact match bonus
                            if (title === term) termScore += 10;
                            // Match at start of title bonus
                            if (title.startsWith(term)) termScore += 5;
                        }
                        
                        // Category matches (high weight)
                        if (category.includes(term)) {
                            termScore += 3;
                        }
                        
                        // Tag matches (medium weight)
                        if (tags.includes(term)) {
                            termScore += 2;
                        }

                        // Description matches (medium weight)
                        if (description.includes(term)) {
                            termScore += 2;
                        }
                        
                        // Content matches (lowest weight)
                        if (content.includes(term)) {
                            termScore += 1;
                        }
                        
                        // If no matches for this term, exclude the post
                        if (termScore === 0) {
                            return { post, score: 0 };
                        }
                        
                        score += termScore;
                        matchCount++;
                    }
                    
                    // Only include posts that match all terms (AND search)
                    return matchCount === queryTerms.length ? { post, score } : { post, score: 0 };
                });
                
                // Filter, sort and limit results
                const allResults = scoredResults
                    .filter(item => item.score > 0)
                    .sort((a, b) => {
                      if (b.score !== a.score) {
                        return b.score - a.score;
                      }

                      const bDate = b.post.date || '';
                      const aDate = a.post.date || '';
                      if (bDate !== aDate) {
                        return bDate.localeCompare(aDate);
                      }

                      return String(b.post.title || '').localeCompare(a.post.title || '');
                    });

                const filteredResults = allResults.map(item => item.post);
                
                // Display results
                if (filteredResults.length > 0) {
                    displayResults(filteredResults, query);
                } else {
                    showNoResults(`'${query}'에 대한 검색 결과가 없습니다`, query);
                }
                if (options.historyMode !== 'none') {
                    updateUrl(query, { mode: options.historyMode || 'replace', trackDraft: options.trackDraft });
                }
            } catch (error) {
                console.error('Search error:', error);
                searchIndexReady = false;
                searchIndexFailed = true;
                showIndexError();
            } finally {
                showLoading(false);
            }
        });
    }
    
    // Display search results
    function legacyIndexNotice(query) {
        if (!indexCompletenessUnknown) return '';
        let link = '';
        try {
            const target = new URL(searchForm.getAttribute('action') || '/posts/', window.location.href);
            // 이전 폼은 별도의 baseurl 속성이 없으므로 검색 색인의 주소에서
            // 사이트의 하위 경로를 확인한다. 확인할 수 없으면 링크를 생략한다.
            const index = new URL(getSearchJsonPath(), window.location.href);
            const indexSuffix = '/search.json';
            const indexPathIsSafe = (index.protocol === 'http:' || index.protocol === 'https:')
                && index.origin === window.location.origin && !index.username && !index.password
                && !index.pathname.startsWith('//') && index.pathname.endsWith(indexSuffix);
            const basePath = indexPathIsSafe ? index.pathname.slice(0, -indexSuffix.length).replace(/\/+$/, '') : null;
            if ((target.protocol === 'http:' || target.protocol === 'https:')
                && target.origin === window.location.origin && !target.username && !target.password
                && !target.pathname.startsWith('//') && basePath !== null
                && (!basePath || target.pathname === basePath || target.pathname.startsWith(`${basePath}/`))) {
                if (query) target.searchParams.set('q', query);
                else target.searchParams.delete('q');
                // 절대 주소를 사용해 문서의 <base>가 링크 출처를 바꾸지 못하게 한다.
                link = ` <a href="${escapeHtml(target.href)}">글 목록에서 확인</a>`;
            }
        } catch {
            // 잘못된 폼 주소는 링크로 출력하지 않는다.
        }
        return `<p>검색 색인의 완전성을 확인할 수 없습니다.${link}</p>`;
    }

    function displayResults(results, query) {
        if (!searchResults) return;
        currentResults = results;
        visibleResults = Math.min(results.length, MAX_VISIBLE_SEARCH_RESULTS);
        // Build results HTML
        let html = `
                <div class="search-results-header">
                <div class="search-results-count">검색 결과: ${results.length}건${results.length > visibleResults ? ` 중 <span class="search-visible-summary">${visibleResults}</span>건 표시. 목록 끝에서 결과 더 보기` : ''}</div>
                ${legacyIndexNotice(query)}
            </div>
            <ul class="search-results-list">`;
        html += renderResultItems(results.slice(0, visibleResults), query);
        html += `</ul>`;

        if (results.length > visibleResults) {
            html += `
                <div class="search-results-footer">
                    <p>총 ${results.length}개 중 <span class="search-visible-count">${visibleResults}</span>개 표시 중</p>
                    <button type="button" class="inline-action-btn search-more-results">결과 더 보기</button>
                </div>`;
        }

        searchResults.innerHTML = html;
        lastRenderedQuery = query;
        searchResults.style.display = 'block';
        searchResults.classList.add('active');
        announceStatus(`검색 결과 ${results.length}건${results.length > visibleResults ? ` 중 ${visibleResults}건 표시. 목록 끝에서 결과 더 보기` : ''}${indexCompletenessUnknown ? '. 검색 색인의 완전성을 확인할 수 없습니다.' : ''}`);
    }

    function renderResultItems(results, query) {
        const queryTerms = normalizeSearchText(query).split(/\s+/).filter(term => term.length > 0);
        let html = '';
        results.forEach(result => {
            // Highlight matches in title and excerpt
            const highlightedTitle = highlightText(result.title || '제목 없음', queryTerms);
            const excerptResult = searchExcerpt(result, queryTerms);
            const excerpt = highlightText(excerptResult.text, excerptResult.highlightTerms);
            const formattedDate = formatDate(result.date);
            const language = validLanguage(result.language);
            const languageAttribute = language ? ` lang="${escapeHtml(language)}"` : '';
            
            // Build result item HTML
            html += `
                <li class="search-result-item">
                    <h3 class="search-result-title"${languageAttribute}>
                        <a href="${escapeHtml(result.url || '#')}"><span class="search-result-title-text">${highlightedTitle}</span></a>
                    </h3>`;
            
            // Add metadata (category and date)
                const typeLabel = formatResultType(result.type, result.page_kind);
                if (result.category || formattedDate || typeLabel) {
                    html += `
                        <div class="search-result-meta">`;
                
                if (typeLabel) {
                    html += `
                        <span class="category-tag">${escapeHtml(typeLabel)}</span>`;
                }

                if (result.category && result.type !== 'page') {
                    html += `
                        <span class="category-chip">${escapeHtml(formatCategoryLabel(result.category))}</span>`;
                }
                
                if (formattedDate) {
                    html += `
                        <span class="search-result-date">${formattedDate}</span>`;
                }
                
                html += `
                    </div>`;
            }
            
            // Add excerpt
            html += `
                    <div class="search-result-content"${languageAttribute}>${excerpt}${excerptResult.notice ? ` <span>${escapeHtml(excerptResult.notice)}</span>` : ''}</div>`;
            
            // Add tags if available
            if (Array.isArray(result.tags) && result.tags.length > 0) {
                html += `
                    <div class="search-result-tags">
                        ${result.tags.map(tag => 
                            `<span class="tag">${escapeHtml(tag)}</span>`
                        ).join('\n')}
                    </div>`;
            }
            
            html += `
                </li>`;
        });
        
        return html;
    }

    function handleMoreResults(event) {
        const button = event.target.closest('.search-more-results');
        if (!button || !searchResults.contains(button) || !searchResults.classList.contains('active')) return;
        if (!lastRenderedQuery || searchInput.value.trim() !== lastRenderedQuery) return;
        const list = searchResults.querySelector('.search-results-list');
        if (!list || visibleResults >= currentResults.length) return;

        const previousCount = visibleResults;
        visibleResults = Math.min(currentResults.length, previousCount + MAX_VISIBLE_SEARCH_RESULTS);
        list.insertAdjacentHTML('beforeend', renderResultItems(currentResults.slice(previousCount, visibleResults), lastRenderedQuery));
        const count = searchResults.querySelector('.search-visible-count');
        if (count) count.textContent = String(visibleResults);
        const summary = searchResults.querySelector('.search-results-count');
        if (summary) {
            summary.textContent = visibleResults < currentResults.length
                ? `검색 결과: ${currentResults.length}건 중 ${visibleResults}건 표시. 목록 끝에서 결과 더 보기`
                : `검색 결과: ${currentResults.length}건 모두 표시`;
        }
        if (visibleResults === currentResults.length) {
            // 버블링 중 노드를 제거하면 문서의 바깥 클릭 처리에서 내부 클릭을
            // 오인할 수 있다. 비활성화·숨김으로 포커스와 접근성 트리에서 제외한다.
            button.disabled = true;
            button.hidden = true;
        }

        // 새 결과가 버튼 앞에 추가되므로 첫 추가 항목으로 이동해야 다음 Tab이 자연스럽다.
        list.children[previousCount]?.querySelector('a')?.focus();
        announceStatus(`총 ${currentResults.length}개 중 ${visibleResults}개 표시 중`);
    }
    
    // Show error message
    function showIndexError() {
        showError('검색 데이터를 불러오지 못했습니다. 검색 버튼을 누르면 글 목록에서 검색할 수 있습니다.');
    }

    function showError(message) {
        if (!searchResults) return;
        
        searchResults.innerHTML = `
            <div class="no-results">
                <p>${escapeHtml(message)}</p>
            </div>`;
        lastRenderedQuery = searchInput ? searchInput.value.trim() : '';
        searchResults.style.display = 'block';
        searchResults.classList.add('active');
        announceStatus(message);
    }
    
    // Show no results message
    function showNoResults(message, query = '') {
        if (!searchResults) return;
        
        searchResults.innerHTML = `
            <div class="no-results">
                <p>${escapeHtml(message)}</p>
                <p>다른 검색어로 시도해 보세요.</p>
                ${legacyIndexNotice(query)}
            </div>`;
        lastRenderedQuery = searchInput ? searchInput.value.trim() : '';
        searchResults.style.display = 'block';
        searchResults.classList.add('active');
        announceStatus(`${message}${indexCompletenessUnknown ? '. 검색 색인의 완전성을 확인할 수 없습니다.' : ''}`);
    }
    
    // Hide search results
    function hideResults() {
        shouldShowSearchFeedback = false;
        searchRevision += 1;
        clearTimeout(searchTimeout);
        showLoading(false);
        if (searchResults) {
            searchResults.style.display = 'none';
            searchResults.classList.remove('active');
        }
        announceStatus('');
    }
    
    // Update URL with search query
    function updateUrl(query, options = {}) {
        if (!history.pushState) return;
        
        const url = new URL(window.location);
        const before = url.href;
        const originalValues = url.searchParams.getAll('q');
        
        if (query) {
            url.searchParams.set('q', query);
        } else {
            url.searchParams.delete('q');
        }
        
        if (options.mode === 'push') {
            if (originalSearchParams) {
                const originalUrl = new URL(window.location);
                originalUrl.searchParams.delete('q');
                originalSearchParams.forEach(value => originalUrl.searchParams.append('q', value));
                originalSearchParams = null;
                if (originalUrl.href !== before) window.history.replaceState(window.history.state, '', originalUrl);
                if (originalUrl.href !== url.href) window.history.pushState(window.history.state, '', url);
            } else if (url.href !== before) {
                window.history.pushState(window.history.state, '', url);
            }
            pendingIndexTrackDraft = false;
        } else {
            if (url.href === before) return;
            if (options.trackDraft && originalSearchParams === null) originalSearchParams = originalValues;
            window.history.replaceState(window.history.state, '', url);
            if (originalSearchParams && originalSearchParams.length === (query ? 1 : 0)
                && (!query || originalSearchParams[0] === query)) {
                originalSearchParams = null;
            }
        }
    }
    
    // Format date (YYYY-MM-DD)
    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    }

    // Format category keys for display
    function formatCategoryLabel(category) {
        if (!category) return '';
        if (categoryLabels[category]) return categoryLabels[category];
        const fallback = category.replace(/_/g, ' ').toLowerCase();
        return fallback.charAt(0).toUpperCase() + fallback.slice(1);
    }

    function formatResultType(type, pageKind) {
        if (type === 'page' && pageKind === 'achievement') return '성과';
        const typeLabels = {
            post: '포스트',
            page: '페이지'
        };

        return typeLabels[type] || '';
    }

    // Invalid or unsafe language tags are ignored rather than inserted in markup.
    function validLanguage(value) {
        if (typeof value !== 'string' || !value || value.length > 255) return '';
        try {
            return Intl.getCanonicalLocales(value)[0] || '';
        } catch {
            return '';
        }
    }

    // 긴 본문 전체에 이차 시간의 강조 위치 지도를 만들지 않고,
    // 정규화된 단어 안의 일치 위치를 원문 UTF-16 위치로 되돌린다.
    function originalOffsetForMatch(text, normalizedOffset) {
        if (normalizedOffset <= 0) return 0;
        let low = 0;
        let high = text.length;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (normalizeSearchText(text.slice(0, middle)).length > normalizedOffset) high = middle;
            else low = middle + 1;
        }
        let offset = Math.max(0, low - 1);
        if (offset > 0 && /[\uDC00-\uDFFF]/.test(text[offset]) && /[\uD800-\uDBFF]/.test(text[offset - 1])) offset--;
        return offset;
    }

    // 설명이나 본문에 일치한 위치를 발췌해 검색 결과가 나온 이유를 보여준다.
    function searchExcerpt(result, terms) {
        const description = String(result.description || '');
        const content = String(result.content || '');
        const fallback = text => ({ text: truncateText(text, 150), highlightTerms: terms, notice: '' });
        const searchableDescription = normalizeSearchText(description);
        const source = terms.some(term => searchableDescription.includes(term))
            ? description : content;
        if (!source) return fallback(description);
        // 검색어는 공백을 기준으로 나뉘므로 단어마다 정규화해 위치를 찾는다.
        let matchOffset = -1;
        let matchEnd = -1;
        let matchedTerm = '';
        for (const segment of source.matchAll(/\S+/gu)) {
            const normalized = normalizeSearchText(segment[0]);
            let firstPosition = Infinity;
            for (const term of terms) {
                const position = normalized.indexOf(term);
                if (position >= 0 && position < firstPosition) {
                    firstPosition = position;
                    matchedTerm = term;
                }
            }
            if (Number.isFinite(firstPosition)) {
                // 결합 문자가 재정렬될 수 있으므로 원문에 같은 문자열이 있으면
                // 길이 기반의 근사 위치보다 원문 위치를 먼저 사용한다.
                const exactPosition = segment[0].indexOf(matchedTerm);
                const localStart = exactPosition >= 0 ? exactPosition : originalOffsetForMatch(segment[0], firstPosition);
                const normalizedEnd = firstPosition + matchedTerm.length;
                let localEnd = exactPosition >= 0 ? exactPosition + matchedTerm.length
                    : normalizedEnd >= normalized.length ? segment[0].length
                        : originalOffsetForMatch(segment[0], normalizedEnd);
                if (localEnd <= localStart) localEnd = localStart + (segment[0].codePointAt(localStart) > 0xFFFF ? 2 : 1);
                matchOffset = segment.index + localStart;
                matchEnd = segment.index + localEnd;
                break;
            }
        }
        if (matchOffset < 0) return fallback(description || content);
        // 분해된 한글처럼 원문이 정규화된 검색어보다 길 수 있어
        // 150자 이하 검색어는 필요한 범위만 최대 600 코드 단위까지 허용한다.
        const maxExcerpt = matchedTerm.length <= 150 ? Math.max(150, Math.min(600, matchEnd - matchOffset)) : 150;
        const preceding = Math.min(35, Math.max(0, maxExcerpt - (matchEnd - matchOffset)));
        let start = Math.max(0, matchOffset - preceding);
        if (start > 0 && /[\uDC00-\uDFFF]/.test(source[start]) && /[\uD800-\uDBFF]/.test(source[start - 1])) start--;
        const excerpt = truncateText(source.slice(start), maxExcerpt);
        const text = start ? `…${excerpt}` : excerpt;
        const normalizedExcerpt = normalizeSearchText(text);
        if (normalizedExcerpt.includes(matchedTerm)) return { text, highlightTerms: terms, notice: '' };
        if (matchedTerm.length > 150) {
            // 전체 검색어가 발췌 한도를 넘으면 실제로 보이는 앞부분만 강조한다.
            const codePoints = Array.from(matchedTerm.slice(0, 200)).slice(0, 100);
            while (codePoints.length && !normalizedExcerpt.includes(codePoints.join(''))) codePoints.pop();
            if (codePoints.length) {
                return { text, highlightTerms: [...terms, codePoints.join('')], notice: '긴 검색어의 일부만 표시합니다.' };
            }
        }
        // 드문 정규화 재정렬로 위치를 특정하지 못해도 잘못된 강조를 만들지 않는다.
        return { text, highlightTerms: terms, notice: '일치 위치를 표시하지 못했습니다.' };
    }
    
    // Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        if (unsafe == null) return '';
        return unsafe.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    function normalizeSearchText(value) {
        return typeof value === 'string' ? value.normalize('NFC').toLocaleLowerCase('ko-KR').normalize('NFC') : '';
    }

    // Record how normalized UTF-16 positions map to the original text.
    // NFC composition and case conversion can change the number of code units.
    function normalizedTextMap(text) {
        let normalized = '';
        let originalEnd = 0;
        const starts = [];
        const ends = [];
        for (const codePoint of text) {
            const originalStart = originalEnd;
            originalEnd += codePoint.length;
            const next = normalizeSearchText(text.slice(0, originalEnd));
            let common = 0;
            while (common < normalized.length && common < next.length && normalized[common] === next[common]) common++;
            // Keep a surrogate pair together when a changed character shares its high surrogate.
            if (common > 0 && common < normalized.length && /[\uD800-\uDBFF]/.test(normalized[common - 1])) common--;
            const changedStart = common < starts.length ? Math.min(originalStart, starts[common]) : originalStart;
            starts.length = common;
            ends.length = common;
            for (let i = common; i < next.length; i++) {
                starts[i] = changedStart;
                ends[i] = originalEnd;
            }
            normalized = next;
        }
        return { normalized, starts, ends };
    }

    // Match normalized plain text, then escape original slices exactly once.
    function highlightText(value, terms) {
        const text = String(value);
        const { normalized, starts, ends } = normalizedTextMap(text);
        const ranges = [];
        for (const term of new Set(terms)) {
            if (!term) continue;
            let position = 0;
            let match;
            while ((match = normalized.indexOf(term, position)) !== -1) {
                ranges.push([starts[match], ends[match + term.length - 1]]);
                position = match + 1;
            }
        }
        ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const merged = [];
        for (const range of ranges) {
            const last = merged[merged.length - 1];
            if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
            else merged.push(range);
        }
        let output = '';
        let cursor = 0;
        for (const [start, end] of merged) {
            output += escapeHtml(text.slice(cursor, start));
            output += `<mark>${escapeHtml(text.slice(start, end))}</mark>`;
            cursor = end;
        }
        return output + escapeHtml(text.slice(cursor));
    }
    
    // Truncate text to specified length
    function truncateText(text, maxLength) {
        if (!text) return '';
        text = text.trim();
        if (text.length <= maxLength) return text;
        
        // Try to truncate at word boundary
        let truncated = text.substring(0, maxLength);
        if (/[\uD800-\uDBFF]/.test(truncated[truncated.length - 1]) && /[\uDC00-\uDFFF]/.test(text[truncated.length])) {
            truncated = truncated.slice(0, -1);
        }
        const lastSpace = truncated.lastIndexOf(' ');
        
        if (lastSpace > maxLength * 0.7) { // Only truncate if we're not too far into the word
            truncated = truncated.substring(0, lastSpace);
        }
        
        return truncated + '...';
    }
    
    // Show loading state
    function showLoading(show) {
        if (searchLoading) {
            searchLoading.style.display = show ? 'flex' : 'none';
        }
        if (searchSubmitBtn) {
            searchSubmitBtn.setAttribute('aria-busy', show ? 'true' : 'false');
        }
    }
    
    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSearch);
    } else {
        initSearch();
    }
    
    // Make functions available globally if needed
    window.searchFunctions = {
        initSearch: initSearch,
        performSearch: performSearch,
        updateUrl: updateUrl
    };
    
})();
