export function initSearch() {
    var searchInput = document.getElementById('search-input');
    var searchResults = document.getElementById('search-results');
    
    if (!searchInput || !searchResults) {
        console.error('Search elements not found in the DOM');
        return;
    }
    
    var posts = [];
    var debounceTimer;

    // 포스트 데이터 로드 - Jekyll baseurl 고려
    // 절대 경로 대신 상대 경로 사용 - 로컬 & 기투허페이지 호환성 확보
    let rootPath = '';
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute('src');
        if (src && src.includes('/assets/js/main.js')) {
            rootPath = src.split('/assets/js/main.js')[0];
            break;
        }
    }
    
    const searchJsonUrl = rootPath + '/search.json';
    
    fetch(searchJsonUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            posts = data;
            console.log('검색 데이터 로드 완료:', posts.length);
        })
        .catch(error => {
            console.error('검색 데이터 로드 실패:', error);
            searchResults.innerHTML = '<p>검색 데이터를 불러오는 데 실패했습니다. 나중에 다시 시도해 주세요.</p>';
        });

    // 검색 폼 제출 이벤트 처리
    const searchForm = document.getElementById('search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            performSearch();
        });
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