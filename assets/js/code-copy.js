(() => {
  function initCodeCopy() {
    // 행 번호 표와 일반 pre는 건드리지 않고 Rouge가 생성한 코드만 선택한다.
    const blocks = document.querySelectorAll('#post-content .highlighter-rouge > .highlight > pre.highlight > code');
    let pendingButton = null;
    let copyDelayed = false;
    const waitingStatuses = new Set();
    const busyOther = '다른 코드 복사가 진행 중입니다. 요청이 끝나면 다시 시도해 주세요.';
    const delayed = '복사가 지연되고 있습니다. 브라우저 권한 요청을 확인해 주세요.';
    const delayedOther = '다른 코드 복사가 지연되고 있습니다. 브라우저 권한 요청을 확인하고 요청이 끝나면 다시 시도해 주세요.';
    const scrollRegions = [];
    let position = 0;

    blocks.forEach(code => {
      const pre = code.parentElement;
      const container = pre?.parentElement;
      if (!container || !code.textContent.trim()) return;

      position += 1;
      const regionLabel = `${position}번째 코드 예제, 가로 스크롤 가능`;
      const region = { pre, code, regionLabel, ownsTabIndex: false, ownsRole: false, ownsLabel: false };
      scrollRegions.push(region);
      const toolbar = document.createElement('div');
      toolbar.className = 'code-copy-toolbar';
      const status = document.createElement('span');
      status.className = 'code-copy-status';
      status.setAttribute('role', 'status');
      let statusId = `code-copy-status-${position}`;
      while (document.getElementById(statusId)) statusId += '-copy';
      status.id = statusId;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy-button';
      button.textContent = '코드 복사';
      button.setAttribute('aria-label', `코드 복사, ${position}번째 예제`);
      button.setAttribute('aria-describedby', statusId);
      toolbar.append(status, button);
      container.insertBefore(toolbar, pre);

      button.addEventListener('click', async () => {
        if (pendingButton) {
          status.textContent = pendingButton === button
            ? (copyDelayed ? delayed : '복사가 진행 중입니다. 브라우저 권한 요청을 확인해 주세요.')
            : (copyDelayed ? delayedOther : busyOther);
          if (pendingButton !== button) waitingStatuses.add(status);
          return;
        }
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
          status.textContent = '복사할 수 없습니다. 코드를 직접 선택해 복사해 주세요.';
          return;
        }

        pendingButton = button;
        copyDelayed = false;
        status.textContent = '복사 중입니다.';
        const delayTimer = window.setTimeout(() => {
          if (pendingButton === button) {
            copyDelayed = true;
            status.textContent = delayed;
            waitingStatuses.forEach(waiting => {
              if (waiting.textContent === busyOther) waiting.textContent = delayedOther;
            });
          }
        }, 8000);
        try {
          await navigator.clipboard.writeText(code.textContent);
          status.textContent = '코드를 복사했습니다.';
        } catch {
          status.textContent = '복사하지 못했습니다. 코드를 직접 선택해 복사해 주세요.';
        } finally {
          window.clearTimeout(delayTimer);
          pendingButton = null;
          copyDelayed = false;
          waitingStatuses.forEach(waiting => {
            if (waiting.textContent === busyOther || waiting.textContent === delayedOther) waiting.textContent = '';
          });
          waitingStatuses.clear();
        }
      });
    });

    // 넘치는 코드만 탭 순서에 넣어 짧은 예제마다 불필요하게 멈추지 않게 한다.
    const updateScrollRegions = () => {
      scrollRegions.forEach(region => {
        const { pre, regionLabel } = region;
        const overflows = pre.clientWidth > 0 && pre.scrollWidth > pre.clientWidth;
        if (overflows) {
          if (!pre.hasAttribute('tabindex')) {
            pre.setAttribute('tabindex', '0');
            region.ownsTabIndex = true;
          }
          if (!pre.hasAttribute('role')) {
            pre.setAttribute('role', 'group');
            region.ownsRole = true;
          }
          if (!pre.hasAttribute('aria-label') && !pre.hasAttribute('aria-labelledby')) {
            pre.setAttribute('aria-label', regionLabel);
            region.ownsLabel = true;
          }
        } else {
          if (region.ownsTabIndex && pre.getAttribute('tabindex') === '0') pre.removeAttribute('tabindex');
          if (region.ownsRole && pre.getAttribute('role') === 'group') pre.removeAttribute('role');
          if (region.ownsLabel && pre.getAttribute('aria-label') === regionLabel) pre.removeAttribute('aria-label');
          region.ownsTabIndex = false;
          region.ownsRole = false;
          region.ownsLabel = false;
        }
      });
    };
    if (scrollRegions.length) {
      let updateScheduled = false;
      const scheduleUpdate = () => {
        if (updateScheduled) return;
        updateScheduled = true;
        window.requestAnimationFrame(() => {
          updateScheduled = false;
          updateScrollRegions();
        });
      };
      updateScrollRegions();
      window.addEventListener('resize', scheduleUpdate);
      if (window.ResizeObserver) {
        const observer = new window.ResizeObserver(scheduleUpdate);
        scrollRegions.forEach(({ pre }) => observer.observe(pre));
      }
      if (window.MutationObserver) {
        const observer = new window.MutationObserver(scheduleUpdate);
        scrollRegions.forEach(({ code }) => observer.observe(code, { subtree: true, childList: true, characterData: true }));
      }
      if (document.fonts) {
        document.fonts.ready.then(scheduleUpdate);
        document.fonts.addEventListener('loadingdone', scheduleUpdate);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCodeCopy, { once: true });
  } else {
    initCodeCopy();
  }
})();
