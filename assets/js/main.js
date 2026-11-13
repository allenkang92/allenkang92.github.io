// 사이트 검색은 simple-search.js, /posts/ 목록 검색·페이지네이션은 React가 담당한다.

// 사이드바 토글 기능
function initSidebarToggle() {
    const sidebar = document.querySelector('.sidebar-right');
    const toggleBtn = document.querySelector('.sidebar-toggle');
    const contentWrapper = document.querySelector('.content-wrapper');
    const skipLink = document.querySelector('.skip-link');
    // 필수 요소나 반응형 API가 없으면 정적 내비게이션을 그대로 유지한다.
    if (!sidebar || !toggleBtn || typeof window.matchMedia !== 'function') return;
    let mobileQuery;
    try {
        mobileQuery = window.matchMedia('(max-width: 768px)');
    } catch {
        return;
    }
    if (!mobileQuery || typeof mobileQuery.matches !== 'boolean') return;
    // Storage may be unavailable in private or restricted browsing contexts.
    // The drawer must remain usable even when persistence fails.
    const readSavedState = () => {
        try {
            return window.localStorage.getItem('sidebarCollapsed');
        } catch {
            return null;
        }
    };
    const saveState = collapsed => {
        try {
            window.localStorage.setItem('sidebarCollapsed', String(collapsed));
        } catch {
            // Keep the current UI state for this page without persistence.
        }
    };
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

    const getSidebarFocusable = () => Array.from(sidebar.querySelectorAll(focusableSelector))
        .filter(element => element.tabIndex >= 0 && isVisible(element));

    const backgroundElements = [contentWrapper, skipLink].filter(Boolean);
    const originalBackgroundStates = new Map();
    const setBackgroundAvailability = collapsed => {
        const shouldLockBackground = mobileQuery.matches && !collapsed;
        document.body.classList.toggle('sidebar-modal-open', shouldLockBackground);
        backgroundElements.forEach(element => {
            if (shouldLockBackground) {
                if (!originalBackgroundStates.has(element)) {
                    originalBackgroundStates.set(element, {
                        inert: element.inert,
                        ariaHidden: element.getAttribute('aria-hidden')
                    });
                }
                element.inert = true;
                element.setAttribute('aria-hidden', 'true');
            } else if (originalBackgroundStates.has(element)) {
                const original = originalBackgroundStates.get(element);
                element.inert = original.inert;
                if (original.ariaHidden === null) element.removeAttribute('aria-hidden');
                else element.setAttribute('aria-hidden', original.ariaHidden);
                originalBackgroundStates.delete(element);
            }
        });
    };

    const setCollapsed = (collapsed, persist = true, moveFocus = false) => {
        sidebar.classList.toggle('sidebar-collapsed', collapsed);
        if (contentWrapper) {
            contentWrapper.classList.toggle('full-width', collapsed);
        }
        toggleBtn.setAttribute('aria-expanded', String(!collapsed));
        toggleBtn.setAttribute('aria-label', collapsed ? '사이드바 열기' : '사이드바 닫기');

        // 모바일에서 접힌(화면 밖) 사이드바는 aria-hidden과 함께 inert로
        // 키보드 포커스 진입도 차단한다 (WCAG 2.4.3 Focus Order)
        const hiddenFromView = mobileQuery.matches && collapsed;
        sidebar.setAttribute('aria-hidden', String(hiddenFromView));
        sidebar.inert = hiddenFromView;

        // Move focus before hiding the background from assistive technology.
        if (moveFocus && !collapsed && mobileQuery.matches) {
            const [firstFocusable] = getSidebarFocusable();
            (firstFocusable || sidebar).focus();
        }
        setBackgroundAvailability(collapsed);

        if (persist) {
            saveState(collapsed);
        }

        if (!moveFocus) return;

        if (collapsed) {
            toggleBtn.focus();
            return;
        }

    };

    let pendingSidebarNavigation = null;
    const rememberSidebarNavigation = event => {
        const anchor = event.target.closest('a[href]');
        if (!anchor) return;
        pendingSidebarNavigation = null;
        if (!mobileQuery.matches || event.button !== 0 || event.metaKey || event.ctrlKey
            || event.shiftKey || event.altKey || anchor.hasAttribute('download')) return;

        const target = (anchor.target || document.querySelector('base[target]')?.target || '_self').trim().toLowerCase();
        if (target !== '_self') return;

        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        let destination;
        try {
            destination = new URL(href, document.baseURI);
        } catch {
            return;
        }
        if (destination.protocol !== 'http:' && destination.protocol !== 'https:') return;
        const current = new URL(window.location.href);
        // URL.hash is empty both when the fragment is absent and when it is
        // explicitly empty (`#`). Only the latter is a fragment navigation.
        if (destination.href.includes('#') && destination.origin === current.origin
            && destination.pathname === current.pathname && destination.search === current.search) return;

        // Wait for an actual page departure and let later handlers cancel the click.
        pendingSidebarNavigation = event;
    };

    const rememberSearchSubmission = event => {
        if (mobileQuery.matches && event.target.matches('.search-form')) {
            pendingSidebarNavigation = event;
        }
    };
    const collapseSidebarOnPageHide = () => {
        // Check after all click or submit listeners have had an opportunity to cancel.
        // A pagehide also avoids closing the drawer when no navigation happens.
        if (pendingSidebarNavigation && !pendingSidebarNavigation.defaultPrevented
            && mobileQuery.matches && !sidebar.classList.contains('sidebar-collapsed')) {
            setCollapsed(true, true, true);
        }
        pendingSidebarNavigation = null;
    };

    const applyResponsiveState = () => {
        const savedState = readSavedState();
        const shouldCollapse = mobileQuery.matches
            ? savedState === null || savedState === 'true'
            : false;

        const active = document.activeElement;
        // A desktop sidebar link can hold focus as the mobile layout restores a
        // collapsed drawer. Move focus before making that sidebar inert.
        if (mobileQuery.matches && shouldCollapse && sidebar.contains(active)) {
            toggleBtn.focus();
        }
        const moveFocus = mobileQuery.matches && !shouldCollapse
            && active !== toggleBtn && !sidebar.contains(active);
        setCollapsed(shouldCollapse, false, moveFocus);

        // The toggle is mobile-only. When it had focus at the breakpoint,
        // keep keyboard navigation on a visible control instead of the page.
        if (!mobileQuery.matches && active === toggleBtn) {
            const [firstFocusable] = getSidebarFocusable();
            (firstFocusable || sidebar).focus();
        }
    };

    // 반응형 리스너 등록이 실패하면 다른 입력 리스너를 붙이기 전에 중단한다.
    try {
        if (typeof mobileQuery.addEventListener === 'function') {
            mobileQuery.addEventListener('change', applyResponsiveState);
        } else if (typeof mobileQuery.addListener === 'function') {
            mobileQuery.addListener(applyResponsiveState);
        } else {
            return;
        }
    } catch {
        return;
    }

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            setCollapsed(!sidebar.classList.contains('sidebar-collapsed'), true, true);
        });

        document.addEventListener('keydown', event => {
            if (!mobileQuery.matches || sidebar.classList.contains('sidebar-collapsed')) return;

            if (event.key === 'Escape') {
                if (event.defaultPrevented || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey
                    || event.isComposing || event.keyCode === 229) return;
                setCollapsed(true, true, true);
                return;
            }

            // The close button is outside the aside in DOM order. Keep both it and
            // the drawer in the keyboard loop, excluding the obscured skip link.
            if (event.key === 'Tab' && !event.defaultPrevented && !event.isComposing && event.keyCode !== 229
                && !event.altKey && !event.ctrlKey && !event.metaKey) {
                const focusable = [toggleBtn, ...getSidebarFocusable()];
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const active = document.activeElement;
                if (!focusable.includes(active) || (event.shiftKey && active === first)) {
                    event.preventDefault();
                    (event.shiftKey ? last : first).focus();
                } else if (!event.shiftKey && active === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });

        sidebar.addEventListener('click', rememberSidebarNavigation);
        sidebar.addEventListener('submit', rememberSearchSubmission);
        window.addEventListener('pagehide', collapseSidebarOnPageHide);
        document.documentElement.classList.add('sidebar-enhanced');
        applyResponsiveState();
    }
  }

// 페이지 로드 시 사이드바 토글 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebarToggle);
} else {
    initSidebarToggle();
}
