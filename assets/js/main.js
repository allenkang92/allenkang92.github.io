// 성능 최적화를 위한 조건부 모듈 로딩
document.addEventListener('DOMContentLoaded', async () => {
    // 검색 기능은 모든 페이지에서 필요
    const { initSearch } = await import('./modules/search');
    initSearch();
    
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
