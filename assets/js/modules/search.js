export function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const searchForm = document.getElementById('search-form');
    
    if (!searchInput || !searchResults || !searchForm) {
        console.error('Search elements not found in the DOM');
        return;
    }
    
    let posts = [];
    let debounceTimer;
    let isLoading = false;

    // 검색 로딩 상태 표시
    function showLoading() {
        searchResults.innerHTML = '<p class="search-loading">검색중...</p>';
        isLoading = true;
    }

    // 검색 데이터 로드
    async function loadSearchData() {
        try {
            showLoading();
            // 상대 경로를 사용하여 모든 환경에서 동작하게 함
            const baseUrl = window.location.pathname.includes('/allenkang92.github.io') ? '/allenkang92.github.io' : '';
            const response = await fetch(`${baseUrl}/search.json`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            posts = await response.json();
            console.log('검색 데이터 로드 완료:', posts.length);
            searchResults.innerHTML = '';
        } catch (error) {
            console.error('검색 데이터 로드 실패:', error);
            searchResults.innerHTML = `
                <div class="error-message" role="alert">
                    <p>검색 데이터를 불러오는 데 실패했습니다.</p>
                    <p>나중에 다시 시도해 주세요.</p>
                </div>
            `;
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
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (!searchTerm) {
            searchResults.innerHTML = '';
            searchResults.classList.remove('active');
            return;
        }
        
        // 검색 결과 표시 전 로딩 상태
        searchResults.innerHTML = '<p class="search-loading">검색중...</p>';
        searchResults.classList.add('active');

        // 데이터가 없으면 로드
        if (posts.length === 0) {
            loadSearchData().then(performSearch);
            return;
        }

        const results = posts.filter(post => {
            const title = post.title.toLowerCase();
            const content = (post.content || '').toLowerCase();
            const tags = (post.tags || []).join(' ').toLowerCase();
            const categories = (post.categories || []).join(' ').toLowerCase();
            
            // 타이틀, 콘텐츠, 태그, 카테고리 모두에서 검색
            return title.includes(searchTerm) || 
                   content.includes(searchTerm) || 
                   tags.includes(searchTerm) ||
                   categories.includes(searchTerm);
        });
        
        // 검색 결과가 없을 경우
        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="no-results" role="alert">
                    <p>검색 결과가 없습니다.</p>
                    <p>다른 검색어를 시도해 보세요.</p>
                </div>
            `;
            return;
        }

        // 검색 결과 표시 - 접근성 개선
        const html = results.map(post => `
            <article class="search-result-item">
                <h3><a href="${post.url}" aria-label="${post.title} 게시물 읽기">${post.title}</a></h3>
                <div class="result-excerpt">
                    ${post.content ? `<p>${post.content.substring(0, 150)}${post.content.length > 150 ? '...' : ''}</p>` : ''}
                </div>
                <footer class="result-meta">
                    ${post.date ? `<time datetime="${post.date}">${new Date(post.date).toLocaleDateString('ko-KR')}</time>` : ''}
                    ${post.categories && post.categories.length > 0 ? `<span class="categories">카테고리: ${post.categories.join(', ')}</span>` : ''}
                    ${post.tags && post.tags.length > 0 ? `<span class="tags">태그: ${post.tags.join(', ')}</span>` : ''}
                </footer>
            </article>
        `).join('');

        searchResults.innerHTML = `<div class="search-results-count" role="status" aria-live="polite">검색 결과: ${results.length}개</div>${html}`;
    }

    // 검색 이벤트 리스너 (디바운싱 적용)
    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(performSearch, 300);  // 300ms 디바운스
    });

    function performSearch() {
        var query = searchInput.value.toLowerCase().trim();
        if (query.length < 1) {
            searchResults.style.display = 'none';
            return;
        }
        
        var results = posts.filter(function(post) {
            return post.title.toLowerCase().includes(query) ||
                   post.content.toLowerCase().includes(query) ||
                   (post.category && post.category.toLowerCase().includes(query)) ||
                   (post.tags && post.tags.some(tag => tag.toLowerCase().includes(query)));
        });
        
        displayResults(results, query);
    }

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
            searchResults.innerHTML = '<p>검색 결과가 없습니다.</p>';
        } else {
            var html = '<ul>';
            results.forEach(function(result) {
                html += '<li>';
                html += `<a href="${result.url}">${highlightText(result.title, query)}</a>`;
                html += `<p>${highlightText(truncateContent(result.content, 100), query)}</p>`;
                if (result.category) {
                    html += `<span class="category">카테고리: ${result.category}</span>`;
                }
                if (result.tags && result.tags.length > 0) {
                    html += `<span class="tags">태그: ${result.tags.join(', ')}</span>`;
                }
                html += '</li>';
            });
            html += '</ul>';
            searchResults.innerHTML = html;
        }
        searchResults.style.display = 'block';
    }

    // 키보드 내비게이션
    document.addEventListener('keydown', function(e) {
        if (!searchResults.style.display || searchResults.style.display === 'none') return;
        
        var focused = searchResults.querySelector('a:focus');
        var links = searchResults.querySelectorAll('a');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (focused && focused.parentElement.nextElementSibling) {
                focused.parentElement.nextElementSibling.querySelector('a').focus();
            } else if (links.length > 0) {
                links[0].focus();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (focused && focused.parentElement.previousElementSibling) {
                focused.parentElement.previousElementSibling.querySelector('a').focus();
            } else if (links.length > 0) {
                links[links.length - 1].focus();
            }
        }
    });
    
    // 문서 클릭 시 검색 결과 닫기
    document.addEventListener('click', function(e) {
        if (!searchForm.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}