export function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const searchForm = document.getElementById('search-form');
    const searchContainer = document.getElementById('search-container');
    
    if (!searchInput || !searchResults || !searchForm) {
        console.log('Search elements not found, skipping search initialization');
        return;
    }
    
    let posts = [];
    let debounceTimer;
    let isLoading = false;

    // 검색 로딩 상태 표시
    function showLoading() {
        searchResults.innerHTML = '<p class="search-loading">Searching...</p>';
        searchResults.style.display = 'block';
        isLoading = true;
    }

    // 검색 데이터 로드 - 템플릿에서 전달된 URL 우선 사용
    async function loadSearchData() {
        try {
            showLoading();
            
            // 템플릿에서 주입된 data-search-url 사용, 없으면 기본값
            const currentPath = window.location.pathname;
            const dataUrl = (searchContainer && searchContainer.dataset) ? searchContainer.dataset.searchUrl : null;
            const searchUrl = dataUrl || '/search.json';
            
            console.log('Attempting to load search data:', searchUrl);
            console.log('Current path:', currentPath);
            console.log('Using data-url:', !!dataUrl);
            
            const response = await fetch(searchUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Invalid search data format');
            }
            
            posts = data;
            console.log('Search data loaded:', posts.length + ' posts');
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
        } catch (error) {
            console.error('Search data load failed:', error);
            searchResults.innerHTML = `
                <div class="error-message" role="alert">
                    <p>Failed to load search data.</p>
                    <p>Please try again later.</p>
                </div>
            `;
            searchResults.style.display = 'block';
        } finally {
            isLoading = false;
        }
    }

    // 페이지 로드 시 검색 데이터 로드
    loadSearchData();

    // 검색 폼 제출 이벤트 처리
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        performSearch();
    });

    // 검색 입력 이벤트 처리
    searchInput.addEventListener('input', function(e) {
        // 로딩 중이면 처리하지 않음
        if (isLoading) return;
        
        // 이전 타이머 취소
        clearTimeout(debounceTimer);
        
        // 300ms 디바운싱 적용
        debounceTimer = setTimeout(performSearch, 300);
    });

    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        if (query.length < 1) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
            return;
        }
        
        // 데이터가 없으면 로드 후 재시도
        if (posts.length === 0) {
            loadSearchData().then(performSearch);
            return;
        }

        const results = posts.filter(post => {
            const title = (post.title || '').toLowerCase();
            const content = (post.content || '').toLowerCase();
            const category = (post.category || '').toLowerCase();
            const tags = Array.isArray(post.tags) ? post.tags.join(' ').toLowerCase() : '';
            return title.includes(query) || content.includes(query) || category.includes(query) || tags.includes(query);
        });

        displayResults(results, query);
    }

    // 중복 리스너 제거됨: 상단 디바운스 입력 리스너 사용

    // 중복 performSearch 제거됨: 상단의 단일 구현 사용

    function truncateContent(content, limit) {
        if (!content) return '';
        return content.length > limit ? content.substring(0, limit) + '...' : content;
    }

    function highlightText(text, query) {
        if (!text) return '';
        return text.replace(new RegExp(query, 'gi'), match => `<mark>${match}</mark>`);
    }

    function displayResults(results, query) {
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="no-results" role="alert">No results found.</div>';
            searchResults.style.display = 'block';
            return;
        }
        var html = '<ul>';
        results.forEach(function(result) {
            html += '<li>';
            html += '<div class="search-result">';
            html += `<h4><a href="${result.url}">${highlightText(result.title, query)}</a></h4>`;
            html += `<p>${highlightText(truncateContent(result.content, 100), query)}</p>`;
            if (result.category) {
                html += `<span class="category">Category: ${result.category}</span>`;
            }
            if (result.tags && result.tags.length > 0) {
                html += `<span class="tags">Tags: ${result.tags.join(', ')}</span>`;
            }
            html += '</div>';
            html += '</li>';
        });
        html += '</ul>';
        searchResults.innerHTML = html;
        searchResults.style.display = 'block';
    }

    // 키보드 내비게이션
    document.addEventListener('keydown', function(e) {
        if (!searchResults.style.display || searchResults.style.display === 'none') return;
        
        var focused = searchResults.querySelector('a:focus');
        var links = searchResults.querySelectorAll('a');
        if (links.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!focused) {
                links[0].focus();
                return;
            }
            var idx = Array.prototype.indexOf.call(links, focused);
            var next = links[Math.min(idx + 1, links.length - 1)];
            next.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!focused) {
                links[links.length - 1].focus();
                return;
            }
            var idxUp = Array.prototype.indexOf.call(links, focused);
            var prev = links[Math.max(idxUp - 1, 0)];
            prev.focus();
        }
    });
    
    // 문서 클릭 시 검색 결과 닫기
    document.addEventListener('click', function(e) {
        if (!searchForm.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}