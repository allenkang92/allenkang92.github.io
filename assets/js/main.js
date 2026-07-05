// 검색은 simple-search.js, 글 목록 필터/페이지네이션은 posts.js가 담당한다.
// (과거 modules/filter.js와 posts.js가 같은 select를 이중 제어하던 구조를 posts.js로 단일화)

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

        // 모바일에서 접힌(화면 밖) 사이드바는 aria-hidden과 함께 inert로
        // 키보드 포커스 진입도 차단한다 (WCAG 2.4.3 Focus Order)
        const hiddenFromView = mobileQuery.matches && collapsed;
        sidebar.setAttribute('aria-hidden', String(hiddenFromView));
        sidebar.inert = hiddenFromView;

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
