import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';
import { act, createElement } from 'react';

const posts = Array.from({ length: 12 }, (_, index) => ({
  path: `/posts/entry-${index + 1}/`,
  href: `/posts/entry-${index + 1}/`,
  title: `기록 ${index + 1}`,
  kind: 'post',
  categories: ['mathematics_philosophy_history'],
  categoryLabels: ['수학·철학사'],
  tags: [],
  description: '',
  content: index < 2 ? 'needle 요약' : '일반 요약',
  date: `2026-09-${String(12 - index).padStart(2, '0')}`,
}));

const indexedRows = posts.map(post => ({
  type: 'post',
  url: `https://blog.test${post.path}`,
  title: post.title,
  category: post.categories[0],
  tags: post.tags,
  description: post.description,
  content: 'needle 전체 본문',
  date: post.date,
}));

test('records a category change after the React archive mounts', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const { window: browser } = globalThis;
  const events = [];
  let mounted;

  try {
    browser.gtag = (...args) => events.push(args);
    await browser.happyDOM.whenAsyncComplete();
    browser.eval(await readFile(new URL('../../assets/js/analytics-events.js', import.meta.url), 'utf8'));
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    assert.deepEqual(events, [], 'mounting must not count as a filter action');

    const category = mounted.rootElement.querySelector('#react-posts-category-select');
    await act(async () => {
      category.value = 'mathematics_philosophy_history';
      category.dispatchEvent(new browser.Event('change', { bubbles: true }));
    });
    assert.equal(events.length, 1);
    assert.equal(events[0][0], 'event');
    assert.equal(events[0][1], 'post_category_filter');
    assert.equal(events[0][2].category, 'mathematics_philosophy_history');
    assert.deepEqual(Object.keys(events[0][2]), ['category']);
    assert.equal(new URL(browser.location.href).searchParams.get('category'), 'mathematics_philosophy_history');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

function installBrowser(url) {
  const browser = new Window({ url });
  browser.scrollTo = () => {};
  browser.matchMedia = () => ({ matches: true, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });

  const names = ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const values = {
    window: browser,
    document: browser.document,
    navigator: browser.navigator,
    HTMLElement: browser.HTMLElement,
    Node: browser.Node,
    Event: browser.Event,
    MouseEvent: browser.MouseEvent,
    MutationObserver: browser.MutationObserver,
    getComputedStyle: browser.getComputedStyle.bind(browser),
    requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
    cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }

  return async () => {
    await browser.happyDOM.abort();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
}

async function mountPostsApp(browser, fallbackPosts, fetchImpl, categoryLabels = new Map([['mathematics_philosophy_history', '수학·철학사']])) {
  browser.document.body.innerHTML = '<div id="mount" hidden></div><section id="fallback"><p>정적 글 목록</p></section>';
  browser.fetch = fetchImpl;
  const rootElement = browser.document.getElementById('mount');
  const fallbackElement = browser.document.getElementById('fallback');
  const [{ createRoot }, { PostsApp, PostsAppBoundary }] = await Promise.all([
    import('react-dom/client'),
    import('../../build/tests/frontend/posts/PostsApp.js'),
  ]);
  const root = createRoot(rootElement);
  const props = {
    fallbackPosts,
    categoryLabels,
    searchIndexUrl: '/search.json',
    siteBaseUrl: 'https://blog.test/',
    postsUrl: '/posts/',
    rootElement,
    fallbackElement,
  };

  await act(async () => {
    root.render(createElement(PostsAppBoundary, { fallbackElement, rootElement }, createElement(PostsApp, props)));
  });

  return { root, rootElement, fallbackElement };
}

test('keeps a deep result page until the full index loads and updates pagination URLs', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=2');
  let resolveFetch;
  const pendingIndex = new Promise(resolve => { resolveFetch = resolve; });
  const { window: browser } = globalThis;
  let mounted;

  try {
    mounted = await mountPostsApp(browser, posts, () => pendingIndex);
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
    assert.equal(mounted.rootElement.hidden, false);
    assert.equal(mounted.fallbackElement.hidden, true);

    await act(async () => {
      resolveFetch({ ok: true, status: 200, json: async () => indexedRows });
      await pendingIndex;
    });

    assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 2);
    assert.match(mounted.rootElement.querySelector('#react-posts-page-info').textContent, /전체 12건 중 11–12건/);

    await act(async () => {
      mounted.rootElement.querySelector('a[aria-label="1페이지"]').dispatchEvent(
        new browser.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    assert.equal(new URL(browser.location.href).searchParams.has('page'), false);
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 10);
    assert.equal(
      browser.document.activeElement,
      mounted.rootElement.querySelector('#react-posts-list .post-preview h2 a'),
      'an explicit page change should move keyboard focus to the new result list',
    );

    const historyLength = browser.history.length;
    await act(async () => {
      mounted.rootElement.querySelector('#react-posts-search-form').dispatchEvent(
        new browser.Event('submit', { bubbles: true, cancelable: true }),
      );
    });
    assert.equal(browser.history.length, historyLength, 'submitting an already-applied query must not add duplicate history');

    const ids = Array.from(browser.document.querySelectorAll('[id]'), element => element.id);
    assert.equal(new Set(ids).size, ids.length, 'static fallback and React controls must not duplicate IDs');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('shows a retry after an index error and replaces fallback data after recovery', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  let requestCount = 0;
  const { window: browser } = globalThis;
  let mounted;

  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), async () => {
      requestCount += 1;
      if (requestCount === 1) return { ok: false, status: 503, json: async () => [] };
      return { ok: true, status: 200, json: async () => [indexedRows[0]] };
    });

    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    assert.match(mounted.rootElement.textContent, /본문 인덱스를 불러오지 못했습니다/);
    const retryButton = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    assert.ok(retryButton);

    await act(async () => {
      retryButton.dispatchEvent(new browser.MouseEvent('click', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(requestCount, 2);
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 1);
    assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('keeps the search target available with no matches and lets visitors reset their conditions', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=missing');
  const { window: browser } = globalThis;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const search = mounted.rootElement.querySelector('#react-posts-search-input');
    assert.equal(search.getAttribute('aria-controls'), 'react-posts-list');
    assert.ok(mounted.rootElement.querySelector('#react-posts-list #react-posts-empty-state'));

    await act(async () => {
      mounted.rootElement.querySelector('#react-posts-clear-filters').click();
    });
    assert.equal(search.value, '');
    assert.equal(browser.document.activeElement, search);
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 10);
    assert.equal(new URL(browser.location.href).searchParams.has('q'), false);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('defers Korean IME search until composition ends and restores filter state on popstate', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const categoryLabels = new Map([
    ['mathematics_philosophy_history', '수학·철학사'],
    ['science_philosophy_history', '과학·물리학'],
  ]);
  const categorizedPosts = posts.map((post, index) => ({
    ...post,
    categories: [index % 2 === 0 ? 'mathematics_philosophy_history' : 'science_philosophy_history'],
    categoryLabels: [index % 2 === 0 ? '수학·철학사' : '과학·물리학'],
  }));
  const rows = categorizedPosts.map((post, index) => ({
    type: 'post',
    url: `https://blog.test${post.path}`,
    title: post.title,
    category: post.categories[0],
    tags: [],
    description: '',
    content: index < 3 ? 'rare keyword' : 'needle keyword',
    date: post.date,
  }));
  const { window: browser } = globalThis;
  let mounted;

  try {
    mounted = await mountPostsApp(browser, categorizedPosts, async () => ({ ok: true, status: 200, json: async () => rows }), categoryLabels);
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));

    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    await act(async () => {
      input.dispatchEvent(new browser.CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      input.value = 'rare';
      input.dispatchEvent(new browser.InputEvent('input', {
        bubbles: true,
        inputType: 'insertCompositionText',
        data: 'e',
        isComposing: true,
      }));
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 20)));
    assert.equal(new URL(browser.location.href).searchParams.has('q'), false);

    await act(async () => input.dispatchEvent(new browser.CompositionEvent('compositionend', { bubbles: true, data: 'rare' })));
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'rare');
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 3);

    const category = mounted.rootElement.querySelector('#react-posts-category-select');
    category.value = 'science_philosophy_history';
    await act(async () => category.dispatchEvent(new browser.Event('change', { bubbles: true })));
    assert.equal(new URL(browser.location.href).searchParams.get('category'), 'science_philosophy_history');
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 1);

    browser.history.pushState({}, '', '/posts/?q=needle');
    await act(async () => browser.dispatchEvent(new browser.PopStateEvent('popstate', { state: null })));
    assert.equal(mounted.rootElement.querySelector('#react-posts-search-input').value, 'needle');
    assert.equal(mounted.rootElement.querySelector('#react-posts-category-select').value, 'all');
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 9);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});
