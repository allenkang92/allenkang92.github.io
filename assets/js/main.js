// 성능 최적화를 위한 조건부 모듈 로딩
document.addEventListener('DOMContentLoaded', async () => {
    // 검색 기능은 simple-search.js에서 자동으로 초기화됨

    // 모달 기능 조건부 로딩
    if (document.querySelector('.modal') || document.querySelector('[data-modal]')) {
        const { initModal } = await import('./modules/modal.js');
        initModal();
    }
    
    // 필터 기능 조건부 로딩 (포스트/업적 페이지에서만)
    if (document.querySelector('#category-select') || document.querySelector('#achievement-category-select')) {
        const { initFilter } = await import('./modules/filter.js');
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
    }
    
    // 프로젝트 페이지 전용 기능
    if (path.includes('/projects/')) {
        // 프로젝트 갤러리, 필터링 등
    }
    
    // 도구 페이지 전용 기능
    if (path.includes('/tools/')) {
        // 계산기, 변환기 등
    }
}

// 사이드바 토글 기능
function initSidebarToggle() {
    document.documentElement.classList.add('sidebar-enhanced');

    const sidebar = document.querySelector('.sidebar-right');
    const toggleBtn = document.querySelector('.sidebar-toggle');
    const contentWrapper = document.querySelector('.content-wrapper');
    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const focusableSelector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const isVisible = element => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return !element.hidden
            && rect.width > 0
            && rect.height > 0
            && style.display !== 'none'
            && style.visibility !== 'hidden';
    };

    const getSidebarFocusable = () => Array.from(sidebar.querySelectorAll(focusableSelector)).filter(isVisible);

    const setBackgroundAvailability = collapsed => {
        const shouldLockBackground = mobileQuery.matches && !collapsed;
        document.body.classList.toggle('sidebar-modal-open', shouldLockBackground);

        if (!contentWrapper) return;
        contentWrapper.inert = shouldLockBackground;
        if (shouldLockBackground) {
            contentWrapper.setAttribute('aria-hidden', 'true');
        } else {
            contentWrapper.removeAttribute('aria-hidden');
        }
    };

    const setCollapsed = (collapsed, persist = true, moveFocus = false) => {
        sidebar.classList.toggle('sidebar-collapsed', collapsed);
        if (contentWrapper) {
            contentWrapper.classList.toggle('full-width', collapsed);
        }
        setBackgroundAvailability(collapsed);

        toggleBtn.setAttribute('aria-expanded', String(!collapsed));
        toggleBtn.setAttribute('aria-label', collapsed ? '사이드바 열기' : '사이드바 닫기');
        sidebar.setAttribute('aria-hidden', String(mobileQuery.matches && collapsed));

        if (persist) {
            localStorage.setItem('sidebarCollapsed', String(collapsed));
        }

        if (!moveFocus) return;

        if (collapsed) {
            toggleBtn.focus();
            return;
        }

        if (mobileQuery.matches) {
            const [firstFocusable] = getSidebarFocusable();
            (firstFocusable || sidebar).focus();
        }
    };

    const applyResponsiveState = () => {
        const savedState = localStorage.getItem('sidebarCollapsed');
        const shouldCollapse = mobileQuery.matches
            ? savedState === null || savedState === 'true'
            : false;

        setCollapsed(shouldCollapse, false);
    };
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            setCollapsed(!sidebar.classList.contains('sidebar-collapsed'), true, true);
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && mobileQuery.matches && !sidebar.classList.contains('sidebar-collapsed')) {
                setCollapsed(true, true, true);
            }
        });

        applyResponsiveState();

        if (typeof mobileQuery.addEventListener === 'function') {
            mobileQuery.addEventListener('change', applyResponsiveState);
        } else if (typeof mobileQuery.addListener === 'function') {
            mobileQuery.addListener(applyResponsiveState);
        }
    }
}

// 페이지 로드 시 사이드바 토글 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarToggle);
} else {
    initSidebarToggle();
}
