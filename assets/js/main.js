// 성능 최적화를 위한 조건부 모듈 로딩
document.addEventListener('DOMContentLoaded', async () => {
    // 검색 기능은 모든 페이지에서 필요 - 직접 초기화
    try {
        const { initSearch } = await import('./modules/search.js');
        initSearch();
        console.log('검색 기능 초기화 완료');
    } catch (error) {
        console.error('검색 모듈 로드 실패:', error);
        // 폴백: 기본 검색 기능
        initBasicSearch();
    }
    
    // 모달 기능 조건부 로딩
    if (document.querySelector('.modal') || document.querySelector('[data-modal]')) {
        const { initModal } = await import('./modules/modal');
        initModal();
    }
    
    // 필터 기능 조건부 로딩 (포스트/업적 페이지에서만)
    if (document.querySelector('#category-select') || document.querySelector('#achievement-category-select')) {
        const { initFilter } = await import('./modules/filter');
        initFilter();
    }
    
    // 페이지별 추가 기능 로딩
    await loadPageSpecificModules();
});

// 페이지별 특화 모듈 로딩
async function loadPageSpecificModules() {
    const path = window.location.pathname;
    
    // 포스트 페이지 전용 기능
    if (path.includes('/posts/') && document.querySelector('.post')) {
        // 목차 기능, 코드 하이라이팅 등
        console.log('포스트 페이지 모듈 로딩 준비');
    }
    
    // 프로젝트 페이지 전용 기능
    if (path.includes('/projects/')) {
        // 프로젝트 갤러리, 필터링 등
        console.log('프로젝트 페이지 모듈 로딩 준비');
    }
    
    // 도구 페이지 전용 기능
    if (path.includes('/tools/')) {
        // 계산기, 변환기 등
        console.log('도구 페이지 모듈 로딩 준비');
    }
}

// 기본 검색 기능 폴백
function initBasicSearch() {
    console.log('기본 검색 기능 초기화');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    
    if (!searchInput || !searchResults) {
        console.log('검색 요소를 찾을 수 없습니다');
        return;
    }
    
    let posts = [];
    
    // 검색 데이터 로드
    fetch('/search.json')
        .then(response => response.json())
        .then(data => {
            posts = data;
            console.log('검색 데이터 로드 완료:', posts.length + '개 포스트');
        })
        .catch(error => {
            console.error('검색 데이터 로드 실패:', error);
        });
    
    // 검색 이벤트
    searchInput.addEventListener('input', function() {
        const query = this.value.trim().toLowerCase();
        
        if (query.length < 2) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
            return;
        }
        
        const results = posts.filter(post => 
            post.title.toLowerCase().includes(query) ||
            post.content.toLowerCase().includes(query) ||
            (post.tags && post.tags.some(tag => tag.toLowerCase().includes(query)))
        ).slice(0, 5);
        
        if (results.length > 0) {
            searchResults.innerHTML = results.map(post => 
                `<div class="search-result">
                    <h4><a href="${post.url}">${post.title}</a></h4>
                    <p>${post.excerpt || ''}</p>
                </div>`
            ).join('');
            searchResults.style.display = 'block';
        } else {
            searchResults.innerHTML = '<div class="no-results">검색 결과가 없습니다.</div>';
            searchResults.style.display = 'block';
        }
    });
    
    // 검색 결과 숨기기
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}
