(function() {
  'use strict';

  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]', '']);
  const ALLOWED_PARAMS = new Set(['tool_name', 'tab_name', 'category', 'query_length', 'link_url']);
  let selectedToolTab = null;

  function isProductionHost() {
    return !LOCAL_HOSTS.has(window.location.hostname);
  }

  function canSendAnalytics() {
    const gaDisabled = Object.keys(window).some(key => key.startsWith('ga-disable-') && window[key]);
    return isProductionHost() && !gaDisabled && typeof window.gtag === 'function';
  }

  function normalizeParamValue(key, value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value !== 'string') return undefined;

    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const maxLength = key === 'link_url' ? 300 : 100;
    return trimmed.slice(0, maxLength);
  }

  function eventParams(params) {
    return Object.entries(params || {}).reduce((safeParams, entry) => {
      const [key, value] = entry;
      if (!ALLOWED_PARAMS.has(key)) return safeParams;

      const normalizedValue = normalizeParamValue(key, value);
      if (normalizedValue !== undefined) {
        safeParams[key] = normalizedValue;
      }
      return safeParams;
    }, {});
  }

  function sendAnalyticsEvent(name, params) {
    if (!canSendAnalytics()) return;

    try {
      window.gtag('event', name, eventParams(params));
    } catch (error) {
      // Analytics should never block the site experience.
    }
  }

  function getToolName(button) {
    if (button.matches('[data-equals]')) return 'basic_calculator';
    if (button.id === 'physics-calculate') return 'physics_calculator';
    if (button.id === 'unit-convert') return 'unit_converter';
    return null;
  }

  function selectedTabName() {
    const selectedTab = document.querySelector('.calculator-container [data-tab][aria-selected="true"]');
    return selectedTab ? selectedTab.dataset.tab : null;
  }

  function recordTabChange() {
    const tabName = selectedTabName();
    if (!tabName || tabName === selectedToolTab) return;

    selectedToolTab = tabName;
    sendAnalyticsEvent('tool_tab_change', { tab_name: tabName });
  }

  function scheduleTabChangeCheck() {
    window.setTimeout(recordTabChange, 0);
  }

  function sanitizedOutboundUrl(url) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.origin === window.location.origin) return null;
    return `${url.origin}${url.pathname}`;
  }

  function handleClick(event) {
    if (!(event.target instanceof Element)) return;

    const calculateButton = event.target.closest('[data-equals], #physics-calculate, #unit-convert');
    if (calculateButton) {
      const toolName = getToolName(calculateButton);
      if (toolName) {
        sendAnalyticsEvent('tool_calculate', { tool_name: toolName });
      }
    }

    const toolTab = event.target.closest('[data-tab]');
    if (toolTab && toolTab.closest('.calculator-container')) {
      scheduleTabChangeCheck();
    }

    const link = event.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    try {
      const linkUrl = sanitizedOutboundUrl(new URL(href, window.location.href));
      if (linkUrl) {
        sendAnalyticsEvent('outbound_link_click', { link_url: linkUrl });
      }
    } catch (error) {
      // Ignore malformed links.
    }
  }

  function handleKeydown(event) {
    if (!(event.target instanceof Element)) return;
    const toolTab = event.target.closest('[data-tab]');
    if (!toolTab || !toolTab.closest('.calculator-container')) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    scheduleTabChangeCheck();
  }

  function handleSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.matches('.search-form, form[role="search"]')) return;

    const input = form.querySelector('input[type="search"], #search-input');
    const queryLength = input ? input.value.trim().length : 0;
    sendAnalyticsEvent('search_submit', { query_length: queryLength });
  }

  function handleChange(event) {
    if (!(event.target instanceof Element)) return;

    const categorySelect = event.target.closest('#category-select');
    if (!categorySelect) return;

    sendAnalyticsEvent('post_category_filter', { category: categorySelect.value });
  }

  function initAnalyticsEvents() {
    selectedToolTab = selectedTabName();
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('change', handleChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalyticsEvents);
  } else {
    initAnalyticsEvents();
  }
})();
