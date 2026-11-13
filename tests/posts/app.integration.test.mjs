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

const indexedPage = overrides => ({
  type: 'page', category: 'Uncategorized', tags: [], description: '', content: '', date: '',
  ...overrides,
});

// 브라우저의 스크롤 제한과 프레임 실행을 명시적으로 모의한다.
function installScrollHarness(browser, initialLimit = 100) {
  let limit = initialLimit;
  let nextFrame = 1;
  const frames = new Map();
  const calls = [];
  Object.defineProperty(browser, 'scrollY', { configurable: true, writable: true, value: 0 });
  Object.defineProperty(browser, 'innerHeight', { configurable: true, value: 600 });
  Object.defineProperty(browser.document.documentElement, 'scrollHeight', { configurable: true, get: () => 600 + limit });
  browser.scrollTo = ({ top }) => {
    calls.push(top);
    browser.scrollY = Math.min(Math.max(0, top), limit);
  };
  browser.requestAnimationFrame = callback => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  };
  browser.cancelAnimationFrame = id => frames.delete(id);
  return {
    calls,
    setLimit(value) { limit = value; },
    async flush() {
      const pending = [...frames.values()];
      frames.clear();
      await act(async () => pending.forEach(callback => callback(0)));
    },
  };
}

function saveTestScroll(browser, scrollY = 600, query = 'needle') {
  browser.sessionStorage.setItem('postsListState', JSON.stringify({
    path: '/posts/', query, category: 'all', sort: 'date', page: 1, scrollY,
  }));
}

// happy-dom은 텍스트 fragment의 사용자 활성화·강조·이동을 재현하지 못한다.
// 실제 Chrome은 스크립트 URL에서 지시자를 숨기므로 해시 없는 진입도 함께 검사한다.
test('저장 위치가 있어도 페이지 진입과 색인 완료는 자동으로 스크롤하지 않는다', async () => {
  for (const suffix of ['', '#main-content', '#', '#:~:text=needle']) {
    const cleanup = installBrowser(`https://blog.test/posts/?q=needle${suffix}`);
    const browser = globalThis.window;
    const scroll = installScrollHarness(browser, 900);
    let release;
    let mounted;
    try {
      saveTestScroll(browser);
      mounted = await mountPostsApp(browser, posts, () => new Promise(resolve => { release = resolve; }));
      await scroll.flush();
      assert.deepEqual(scroll.calls, [], `${suffix || '해시 없음'}: 진입 시 강제 이동하지 않음`);
      await act(async () => { release({ ok: true, json: async () => indexedRows }); });
      await scroll.flush();
      assert.deepEqual(scroll.calls, [], `${suffix || '해시 없음'}: 색인 완료 후에도 강제 이동하지 않음`);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  }
});

function restoreButton(mounted) {
  return mounted.rootElement.querySelector('#react-posts-restore-scroll');
}

function writeStoredState(browser, overrides = {}) {
  browser.sessionStorage.setItem('postsListState', JSON.stringify({
    path: '/posts/', query: 'needle', category: 'all', sort: 'date', page: 1, scrollY: 600, ...overrides,
  }));
}

test('유효한 저장 위치는 사용자가 선택했을 때에만 한 번 이동한다', async () => {
  for (const [query, savedQuery] of [['needle', 'needle'], ['needle%23memo', 'needle#memo']]) {
    const cleanup = installBrowser(`https://blog.test/posts/?q=${query}`);
    const browser = globalThis.window;
    const scroll = installScrollHarness(browser, 900);
    let mounted;
    try {
      saveTestScroll(browser, 600, savedQuery);
      mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
      await scroll.flush();
      const button = restoreButton(mounted);
      assert.ok(button, '일치하는 저장 위치를 복원하는 조작을 제공한다');
      assert.equal(button.textContent.trim(), '이전 위치로 이동');
      assert.deepEqual(scroll.calls, []);
      await act(async () => { button.click(); });
      await scroll.flush();
      assert.deepEqual(scroll.calls, [600]);
      assert.equal(browser.scrollY, 600);
      browser.scrollY = 300;
      browser.dispatchEvent(new browser.Event('scroll'));
      await scroll.flush();
      assert.equal(browser.scrollY, 300, '이후 사용자가 이동한 위치를 덮지 않는다');
      assert.deepEqual(scroll.calls, [600], '사용자 요청 없이 다시 이동하지 않는다');
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  }
});

test('조건이 다르거나 유효하지 않은 저장 위치는 복원 조작을 제공하지 않는다', async () => {
  const cases = [
    ['다른 경로', { path: '/other/' }],
    ['다른 검색어', { query: 'other' }],
    ['다른 분류', { category: 'mathematics_philosophy_history' }],
    ['다른 정렬', { sort: 'relevance' }],
    ['다른 페이지', { page: 2 }],
    ['첫 위치', { scrollY: 0 }],
    ['음수 위치', { scrollY: -1 }],
    ['숫자가 아닌 위치', { scrollY: '600' }],
    ['숫자가 아닌 수', { scrollY: NaN }],
    ['무한 위치', { scrollY: Infinity }],
    ['안전 범위를 벗어난 위치', { scrollY: Number.MAX_VALUE }],
  ];
  for (const [label, overrides] of cases) {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle');
    const browser = globalThis.window;
    const scroll = installScrollHarness(browser, 900);
    let mounted;
    try {
      writeStoredState(browser, overrides);
      mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
      await scroll.flush();
      assert.equal(Boolean(restoreButton(mounted)), false, label);
      assert.deepEqual(scroll.calls, [], label);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  }
});

test('저장 데이터 손상이나 저장소 오류는 검색 기능을 막지 않는다', async () => {
  for (const failure of ['malformed', 'unavailable']) {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle');
    const browser = globalThis.window;
    let mounted;
    try {
      if (failure === 'malformed') browser.sessionStorage.setItem('postsListState', '{not-json');
      else Object.defineProperty(browser.sessionStorage, 'getItem', { configurable: true, value() { throw new Error('unavailable'); } });
      mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
      assert.equal(Boolean(restoreButton(mounted)), false, failure);
      assert.ok(mounted.rootElement.querySelector('#react-posts-list .post-preview'), '검색 결과는 계속 사용 가능');
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  }
});

test('색인 로딩 중 복원 요청은 이동하지 않고 완료 후에만 선택할 수 있다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 900);
  let release;
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, () => new Promise(resolve => { release = resolve; }));
    let button = restoreButton(mounted);
    assert.ok(button);
    assert.ok(button.disabled || button.getAttribute('aria-disabled') === 'true');
    await act(async () => { button.click(); });
    await scroll.flush();
    assert.deepEqual(scroll.calls, []);
    await act(async () => { release({ ok: true, json: async () => indexedRows }); });
    await scroll.flush();
    assert.deepEqual(scroll.calls, [], '색인이 준비됐다는 이유만으로 이동하지 않는다');
    button = restoreButton(mounted);
    assert.ok(button && !button.disabled && button.getAttribute('aria-disabled') !== 'true');
    await act(async () => { button.click(); });
    await scroll.flush();
    assert.deepEqual(scroll.calls, [600]);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('색인 실패와 부족한 문서 높이에서도 제한을 알리고 한 번만 이동한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 100);
  let reject;
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, () => new Promise((_resolve, fail) => { reject = fail; }));
    await act(async () => { reject(new Error('offline')); });
    const button = restoreButton(mounted);
    assert.ok(button && !button.disabled && button.getAttribute('aria-disabled') !== 'true');
    await act(async () => { button.click(); });
    await scroll.flush();
    assert.deepEqual(scroll.calls, [600]);
    assert.equal(browser.scrollY, 100);
    const restoreStatus = mounted.rootElement.querySelector('#react-posts-restore-status');
    assert.match(restoreStatus.textContent, /페이지 길이가 달라 이전 위치까지 이동하지 못했습니다/);
    assert.match(restoreStatus.textContent, /검색 인덱스.*결과가 달라질 수 있습니다/, '색인 실패와 높이 제한을 함께 안내한다');
    scroll.setLimit(900);
    browser.dispatchEvent(new browser.Event('resize'));
    await scroll.flush();
    assert.deepEqual(scroll.calls, [600], '늦은 레이아웃 변경으로 강제 이동하지 않는다');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('검색어 없이 저장 위치가 있고 색인이 실패해도 다시 불러올 수 있다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let requests = 0;
  let mounted;
  try {
    saveTestScroll(browser, 600, '');
    mounted = await mountPostsApp(browser, posts, async () => {
      requests += 1;
      if (requests === 1) throw new Error('offline');
      return { ok: true, json: async () => indexedRows };
    });
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    assert.ok(retry, '저장 위치가 있으면 검색어가 없어도 실패한 색인을 다시 불러올 수 있다');
    await act(async () => { retry.click(); });
    assert.equal(requests, 2);
    assert.equal(Boolean(mounted.rootElement.querySelector('#react-posts-retry-search-index')), false);
    assert.ok(mounted.rootElement.querySelector('#react-posts-list .post-preview'));
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('색인 실패 중 복원한 뒤 재시도에 성공하면 이전 실패 안내를 남기지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  installScrollHarness(browser, 900);
  let requests = 0;
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => {
      requests += 1;
      if (requests === 1) throw new Error('offline');
      return { ok: true, json: async () => indexedRows };
    });
    const status = mounted.rootElement.querySelector('#react-posts-restore-status');
    await act(async () => { restoreButton(mounted).click(); });
    assert.match(status.textContent, /검색 인덱스.*결과가 달라질 수 있습니다/);
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    assert.ok(retry);
    await act(async () => { retry.click(); });
    assert.equal(requests, 2);
    assert.equal(Boolean(mounted.rootElement.querySelector('#react-posts-retry-search-index')), false);
    assert.doesNotMatch(status.textContent, /검색 인덱스.*결과가 달라질 수 있습니다/, '성공한 재시도 이후 이전 오류 상태를 표시하지 않는다');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('명시적 위치 이동은 보이는 결과로 키보드 포커스를 옮긴다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const result = mounted.rootElement.querySelector('#react-posts-list .post-preview h2 a');
    assert.ok(result);
    result.getBoundingClientRect = () => ({ top: 100, bottom: 125, left: 10, right: 300, width: 290, height: 25 });
    const button = restoreButton(mounted);
    button.focus();
    await act(async () => { button.click(); });
    await scroll.flush();
    assert.equal(browser.document.activeElement, result, '화면 밖의 이전 위치 버튼에 포커스를 남기지 않는다');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('숨겨진 결과는 복원 후 포커스 대상으로 선택하지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const links = mounted.rootElement.querySelectorAll('#react-posts-list .post-preview h2 a');
    assert.ok(links.length >= 2);
    links[0].closest('.post-preview').hidden = true;
    links[0].getBoundingClientRect = () => ({ top: 10, bottom: 35, left: 10, right: 300, width: 290, height: 25 });
    links[1].getBoundingClientRect = () => ({ top: 100, bottom: 125, left: 10, right: 300, width: 290, height: 25 });
    await act(async () => { restoreButton(mounted).click(); });
    assert.equal(browser.document.activeElement === links[1], true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('보이는 본문을 찾지 못하면 위치 표식에 포커스하고 벗어날 때 정리한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    await act(async () => { restoreButton(mounted).click(); });
    const marker = browser.document.querySelector('.posts-scroll-location');
    assert.ok(marker);
    assert.equal(browser.document.activeElement === marker, true);
    mounted.rootElement.querySelector('#react-posts-search-input').focus();
    assert.equal(browser.document.querySelector('.posts-scroll-location'), null);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('검색 조건이나 이력 변경 후 일치하지 않는 저장 위치는 이용할 수 없다', async () => {
  for (const action of ['sort', 'history']) {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle');
    const browser = globalThis.window;
    const scroll = installScrollHarness(browser, 900);
    let mounted;
    try {
      saveTestScroll(browser);
      mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
      assert.ok(restoreButton(mounted));
      await act(async () => {
        if (action === 'sort') {
          const select = mounted.rootElement.querySelector('#react-posts-sort-select');
          select.value = 'relevance';
          select.dispatchEvent(new browser.Event('change', { bubbles: true }));
        } else {
          browser.history.pushState({}, '', '/posts/?q=other');
          browser.dispatchEvent(new browser.PopStateEvent('popstate'));
        }
      });
      await scroll.flush();
      assert.equal(Boolean(restoreButton(mounted)), false, action);
      assert.deepEqual(scroll.calls, [], action);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  }
});

test('검색어 입력이 반영되기 전에는 이전 조건의 위치로 이동할 수 없다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, '다른 검색어');
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    });
    const button = restoreButton(mounted);
    if (button) {
      assert.ok(button.disabled || button.getAttribute('aria-disabled') === 'true');
      await act(async () => { button.click(); });
    }
    await scroll.flush();
    assert.deepEqual(scroll.calls, []);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('뒤로 가기 조건이 저장값과 다시 일치해도 사용자가 선택하기 전에는 이동하지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=other');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    assert.equal(Boolean(restoreButton(mounted)), false);
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=needle');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    await scroll.flush();
    assert.ok(restoreButton(mounted));
    assert.deepEqual(scroll.calls, []);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('복원 안내는 검색 조건이나 이력 변경 이후 남지 않는다', async () => {
  for (const action of ['sort', 'history']) {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle');
    const browser = globalThis.window;
    installScrollHarness(browser, 900);
    let mounted;
    try {
      saveTestScroll(browser);
      mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
      await act(async () => { restoreButton(mounted).click(); });
      assert.match(mounted.rootElement.textContent, /이전 위치로 이동했습니다/);
      await act(async () => {
        if (action === 'sort') {
          const select = mounted.rootElement.querySelector('#react-posts-sort-select');
          select.value = 'relevance';
          select.dispatchEvent(new browser.Event('change', { bubbles: true }));
        } else {
          browser.history.pushState({}, '', '/posts/?q=other');
          browser.dispatchEvent(new browser.PopStateEvent('popstate'));
        }
      });
      assert.doesNotMatch(mounted.rootElement.textContent, /이전 위치로 이동했습니다/, action);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  }
});

test('캐시에서 돌아와 저장 조건이 달라져도 복원 버튼의 포커스를 잃지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const button = restoreButton(mounted);
    assert.ok(button);
    button.focus();
    writeStoredState(browser, { query: '다른 검색' });
    await act(async () => {
      const event = new browser.Event('pageshow');
      Object.defineProperty(event, 'persisted', { value: true });
      browser.dispatchEvent(event);
    });
    await scroll.flush();
    assert.equal(Boolean(restoreButton(mounted)), false);
    assert.equal(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), true);
    assert.deepEqual(scroll.calls, []);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('스크롤 API 실패가 복원 이후 검색을 막지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let mounted;
  try {
    saveTestScroll(browser);
    browser.scrollTo = () => { throw new Error('scroll unavailable'); };
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const button = restoreButton(mounted);
    assert.ok(button);
    button.focus();
    await act(async () => { button.click(); });
    assert.match(mounted.rootElement.textContent, /이전 위치로 이동하지 못했습니다/);
    assert.equal(browser.document.activeElement === button, true, '실패 시 포커스를 유지한다');
    assert.ok(mounted.rootElement.querySelector('#react-posts-list .post-preview'));
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

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

async function mountPostsApp(browser, fallbackPosts, fetchImpl, categoryLabels = new Map([['mathematics_philosophy_history', '수학·철학사']]), expectedPagePaths = [], searchIndexUrl = '/search.json', expectedAchievementPaths = [], achievementsUrl = '/achievements/') {
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
    searchIndexUrl,
    siteBaseUrl: 'https://blog.test/',
    postsUrl: '/posts/',
    achievementsUrl,
    rootElement,
    fallbackElement,
    expectedPagePaths,
    expectedAchievementPaths,
  };

  await act(async () => {
    root.render(createElement(PostsAppBoundary, { fallbackElement, rootElement }, createElement(PostsApp, props)));
  });

  return { root, rootElement, fallbackElement };
}

test('성과 내용 검색에서 임의 경로·언어·한국어 유형 라벨을 보존한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=Information');
  const browser = globalThis.window;
  const achievement = indexedPage({ url: 'https://blog.test/profile/certs/', page_kind: 'achievement', title: 'Certifications', content: 'Information Processing Engineer', language: 'en' });
  let mounted;
  try {
    mounted = await mountPostsApp(browser, [posts[0]], async () => ({ ok: true, json: async () => [indexedRows[0], achievement] }), undefined, ['/profile/certs/'], '/search.json', ['/profile/certs/']);
    const card = mounted.rootElement.querySelector('#react-posts-list .post-preview');
    assert.ok(card);
    assert.equal(card.querySelector('h2 a').getAttribute('href'), '/profile/certs/');
    assert.equal(card.querySelector('.post-title-text').getAttribute('lang'), 'en');
    assert.equal(card.querySelector('.post-excerpt').getAttribute('lang'), 'en');
    assert.equal(card.querySelector('.category').textContent, '성과');
    assert.equal(card.querySelector('.category').closest('[lang]'), null);
    assert.match(card.textContent, /Information Processing Engineer/);
    await act(async () => {
      browser.history.pushState({}, '', '/posts/');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    assert.doesNotMatch(mounted.rootElement.querySelector('#react-posts-list').textContent, /Certifications/);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('이력 이동으로 포커스한 검색 결과가 사라지면 입력란으로 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=alpha');
  const browser = globalThis.window;
  const rows = indexedRows.map((row, index) => ({ ...row, content: index === 0 ? 'alpha' : index === 1 ? 'beta' : 'none' }));
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => rows }));
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=beta');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    const previousLink = mounted.rootElement.querySelector('#react-posts-list .post-preview h2 a');
    previousLink.focus();
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    assert.equal(previousLink.isConnected, false);
    assert.equal(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), true);
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /기록 1/);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('이력 이동에서 결과 링크가 유지되거나 사용자가 이동한 포커스는 건드리지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=common');
  const browser = globalThis.window;
  const rows = indexedRows.map((row, index) => ({ ...row, content: index === 0 ? 'common alpha' : index === 1 ? 'common beta' : 'none' }));
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => rows }));
    const link = mounted.rootElement.querySelector('#react-posts-list .post-preview h2 a');
    link.focus();
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=alpha');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    assert.equal(link.isConnected, true);
    assert.equal(browser.document.activeElement === link, true);
    const category = mounted.rootElement.querySelector('#react-posts-category-select');
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=beta');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
      category.focus();
    });
    assert.equal(browser.document.activeElement === category, true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('이력 복원 중 입력란·목록 밖 포커스와 빈 공간 선택을 보존한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=alpha');
  const browser = globalThis.window;
  const rows = indexedRows.map((row, index) => ({ ...row, content: index === 0 ? 'alpha' : index === 1 ? 'beta' : 'none' }));
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => rows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    input.focus();
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=beta');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    assert.equal(browser.document.activeElement === input, true);
    const outside = browser.document.createElement('button');
    browser.document.body.append(outside);
    outside.focus();
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=alpha');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    assert.equal(browser.document.activeElement === outside, true);
    mounted.rootElement.querySelector('#react-posts-list .post-preview h2 a').focus();
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=beta');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
      browser.document.body.dispatchEvent(new browser.Event('pointerdown', { bubbles: true }));
      browser.document.activeElement.blur();
    });
    assert.equal(browser.document.activeElement === browser.document.body, true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

for (const indexStatus of ['loading', 'failed']) {
  test(`이력 복원 후 빈 결과에서도 검색 포커스를 복구한다: 색인 ${indexStatus}`, async () => {
    const cleanup = installBrowser('https://blog.test/posts/?q=없음');
    const browser = globalThis.window;
    let mounted;
    try {
      const fetchIndex = indexStatus === 'loading'
        ? () => new Promise(() => {})
        : async () => ({ ok: false, status: 503 });
      mounted = await mountPostsApp(browser, posts, fetchIndex);
      await act(async () => {
        browser.history.pushState({}, '', '/posts/?q=기록');
        browser.dispatchEvent(new browser.PopStateEvent('popstate'));
      });
      mounted.rootElement.querySelector('#react-posts-list .post-preview h2 a').focus();
      await act(async () => {
        const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
        browser.history.back();
        await popped;
      });
      assert.equal(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), true);
      assert.ok(mounted.rootElement.querySelector('#react-posts-clear-filters'));
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  });
}

for (const [description, previousUrl, activeUrl, selector] of [
  ['페이지 번호', '/posts/?q=solo', '/posts/', '#react-posts-page-links a[aria-label="2페이지"]'],
  ['다음 페이지 버튼', '/posts/?q=solo', '/posts/', '#react-posts-next-page'],
  ['이전 페이지 버튼', '/posts/?q=solo', '/posts/?page=2', '#react-posts-prev-page'],
  ['조건 초기화', '/posts/', '/posts/?q=needle', '.posts-reset'],
  ['빈 결과 초기화', '/posts/', '/posts/?q=없는검색어', '#react-posts-clear-filters'],
]) {
  test(`이력 복원으로 ${description} 조작 대상이 사라지면 검색 입력으로 복구한다`, async () => {
    const cleanup = installBrowser(`https://blog.test${previousUrl}`);
    const browser = globalThis.window;
    const rows = indexedRows.map((row, index) => ({ ...row, content: index === 0 ? 'solo needle' : 'needle' }));
    let mounted;
    try {
      mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => rows }));
      await act(async () => {
        browser.history.pushState({}, '', activeUrl);
        browser.dispatchEvent(new browser.PopStateEvent('popstate'));
      });
      const control = mounted.rootElement.querySelector(selector);
      assert.ok(control, `${description}이 존재해야 한다`);
      assert.equal(control.matches(':disabled'), false, `${description}을 사용할 수 있어야 한다`);
      control.focus();
      assert.equal(browser.document.activeElement === control, true);
      await act(async () => {
        const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
        browser.history.back();
        await popped;
      });
      assert.equal(control.isConnected, false);
      assert.equal(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), true);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  });
}

for (const [indexStatus, selector] of [
  ['loading', '#react-posts-achievements-link'],
  ['failed', '#react-posts-achievements-link'],
  ['failed', '#react-posts-retry-search-index'],
]) {
  test(`이력 복원으로 색인 ${indexStatus}의 ${selector}가 사라지면 포커스를 복구한다`, async () => {
    const cleanup = installBrowser('https://blog.test/posts/');
    const browser = globalThis.window;
    let mounted;
    try {
      const fetchIndex = indexStatus === 'loading'
        ? () => new Promise(() => {})
        : async () => ({ ok: false, status: 503 });
      mounted = await mountPostsApp(browser, posts, fetchIndex);
      await act(async () => {
        browser.history.pushState({}, '', '/posts/?q=needle');
        browser.dispatchEvent(new browser.PopStateEvent('popstate'));
      });
      const control = mounted.rootElement.querySelector(selector);
      assert.ok(control);
      control.focus();
      assert.equal(browser.document.activeElement === control, true);
      await act(async () => {
        const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
        browser.history.back();
        await popped;
      });
      assert.equal(control.isConnected, false);
      assert.equal(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), true);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  });
}

test('이력 복원 시 유지되는 페이지 버튼의 포커스를 보존한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const next = mounted.rootElement.querySelector('#react-posts-next-page');
    next.focus();
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=needle');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    assert.equal(next.isConnected, true);
    assert.equal(browser.document.activeElement === next, true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('이력 복원으로 포커스된 페이지 버튼이 비활성화되면 입력란으로 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?page=2');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    const previous = mounted.rootElement.querySelector('#react-posts-prev-page');
    assert.equal(previous.disabled, false);
    previous.focus();
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    assert.equal(previous.isConnected, true);
    assert.equal(previous.disabled, true);
    assert.equal(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('검색어 대소문자를 표시와 URL에 보존하고 대소문자 무관하게 찾는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  const achievement = indexedPage({ url: 'https://blog.test/profile/certs/', page_kind: 'achievement', title: 'Certifications', content: 'Information Processing Engineer', language: 'en' });
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => [...indexedRows, achievement] }), undefined, ['/profile/certs/'], '/search.json', ['/profile/certs/']);
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    input.focus();
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'Information Processing Engineer');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'Information Processing Engineer' }));
      mounted.rootElement.querySelector('#react-posts-search-form').dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    });
    assert.equal(input.value, 'Information Processing Engineer');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'Information Processing Engineer');
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /Certifications/);
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /Information Processing Engineer/);
    assert.equal(browser.document.activeElement, input);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('단어 사이 공백을 입력하고 잠시 멈춰도 다음 단어와 검색 결과가 유지된다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  const rows = indexedRows.map(row => ({ ...row, content: 'SQL Query 학습' }));
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => rows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    input.focus();
    const type = async value => act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: value }));
    });
    await type('SQL ');
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(input.value, 'SQL ', '검색 적용 후에도 입력 중인 공백을 보존한다');
    await type(`${input.value}Query`);
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(input.value, 'SQL Query');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'SQL Query');
    assert.match(mounted.rootElement.querySelector('#react-posts-count').textContent, /검색 결과 12개/);
    assert.equal(browser.document.activeElement, input);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('대소문자만 바꾼 검색은 같은 결과 페이지를 유지하고 기록에서 입력 표기를 복원한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=Needle&page=2');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    assert.equal(input.value, 'Needle');
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 2);
    const historyLength = browser.history.length;
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'nEeDlE');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'nEeDlE' }));
      mounted.rootElement.querySelector('a[aria-label="2페이지"]').click();
    });
    assert.equal(input.value, 'nEeDlE');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'nEeDlE');
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
    assert.equal(browser.history.length, historyLength, '같은 검색의 표기만 변경하면 중복 이력을 추가하지 않는다');
    await act(async () => mounted.rootElement.querySelector('a[aria-label="1페이지"]').click());
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'nEeDlE');
    assert.equal(new URL(browser.location.href).searchParams.has('page'), false);
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    assert.equal(input.value, 'nEeDlE');
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.forward();
      await popped;
    });
    assert.equal(input.value, 'nEeDlE');
    assert.equal(new URL(browser.location.href).searchParams.has('page'), false);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('같은 검색어의 표기와 공백을 바꾸고 기다리거나 제출해도 현재 페이지와 포커스를 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=Needle&page=2');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    const historyLength = browser.history.length;
    input.focus();
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'nEeDlE ');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'nEeDlE ' }));
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(input.value, 'nEeDlE ');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'nEeDlE');
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 2);
    assert.equal(browser.document.activeElement, input);
    assert.equal(browser.history.length, historyLength);
    await act(async () => mounted.rootElement.querySelector('#react-posts-search-form').dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(input.value, 'nEeDlE');
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
    assert.equal(browser.document.activeElement, input);
    assert.equal(browser.history.length, historyLength);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('검색어가 바뀌는 동안 이전 결과와 페이지 링크를 숨기고 최신 검색만 표시한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=2');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    const results = mounted.rootElement.querySelector('#react-posts-results');
    const oldLink = results.querySelector('#react-posts-list .post-preview a');
    const pageLink = results.querySelector('a[aria-label="1페이지"]');
    const type = async value => act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: value }));
    });
    input.focus();
    await type('  NEEDLE ');
    assert.equal(results.hidden, false, '검색 의미가 같으면 결과를 유지한다');
    assert.equal(results.querySelector('#react-posts-list .post-preview a'), oldLink);
    await type('기록');
    assert.equal(results.hidden, true);
    assert.equal(browser.getComputedStyle(results).display, 'none');
    assert.equal(results.contains(oldLink), true, '대기 중 결과 노드를 불필요하게 버리지 않는다');
    assert.equal(results.contains(pageLink), true, '기존 페이지 링크도 숨겨 키보드 및 새 탭 탐색을 막는다');
    assert.equal(mounted.rootElement.querySelector('#react-posts-count').textContent, '검색어를 반영하고 있습니다.');
    assert.equal(browser.document.activeElement, input);
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'needle');
    await type('NEEDLE');
    assert.equal(results.hidden, false, '검색을 원래 의미로 되돌리면 기다리지 않고 결과를 복원한다');
    assert.equal(results.querySelector('#react-posts-list .post-preview a'), oldLink);
    assert.equal(browser.document.activeElement, input);
    await type('기록');
    await type('기록 1');
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(results.hidden, false);
    assert.equal(input.value, '기록 1');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '기록 1');
    assert.equal(new URL(browser.location.href).searchParams.has('page'), false);
    assert.match(mounted.rootElement.querySelector('#react-posts-count').textContent, /검색 결과/);
    assert.equal(browser.document.activeElement, input);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('색인 실패 및 한글 조합 중에도 이전 검색 결과를 노출하지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => { throw new Error('offline'); });
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    const results = mounted.rootElement.querySelector('#react-posts-results');
    input.focus();
    await act(async () => {
      input.dispatchEvent(new browser.CompositionEvent('compositionstart', { bubbles: true }));
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, '기록');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, isComposing: true }));
    });
    assert.equal(results.hidden, true);
    assert.equal(browser.document.activeElement, input);
    await act(async () => input.dispatchEvent(new browser.CompositionEvent('compositionend', { bubbles: true, data: '기록' })));
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(results.hidden, false);
    assert.equal(input.value, '기록');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '기록');
    assert.ok(results.querySelector('#react-posts-list .post-preview'), '색인 실패 시 기본 글 목록에서 검색한다');
    assert.ok(mounted.rootElement.querySelector('#react-posts-retry-search-index'));
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('입력기 조합 중에는 URL을 바꾸지 않고 완료 뒤 원래 대소문자로 검색한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    await act(async () => {
      input.dispatchEvent(new browser.CompositionEvent('compositionstart', { bubbles: true }));
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'Needle');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'Needle', isComposing: true }));
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(input.value, 'Needle');
    assert.equal(new URL(browser.location.href).searchParams.has('q'), false);
    await act(async () => input.dispatchEvent(new browser.CompositionEvent('compositionend', { bubbles: true, data: 'Needle' })));
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(input.value, 'Needle');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'Needle');
    assert.match(mounted.rootElement.querySelector('#react-posts-count').textContent, /검색 결과 12개/);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('색인 대기 중에는 글만 검색됨을 알리고 성과 목록 링크의 포커스를 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/blog/posts/?q=Information');
  const browser = globalThis.window;
  const achievement = indexedPage({ url: 'https://blog.test/profile/certs/', page_kind: 'achievement', title: 'Certifications', content: 'Information Processing Engineer', language: 'en' });
  let resolveIndex;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, [posts[0]], () => new Promise(resolve => { resolveIndex = resolve; }), undefined, ['/profile/certs/'], '/search.json', ['/profile/certs/'], '/blog/achievements/');
    const status = mounted.rootElement.querySelector('#react-posts-search-status');
    assert.equal(status?.getAttribute('role'), 'status');
    assert.equal(status?.getAttribute('aria-live'), 'polite');
    assert.match(status.textContent, /글 목록/);
    assert.match(status.textContent, /성과·시리즈·도구.*아직 검색되지 않습니다/);
    const link = [...mounted.rootElement.querySelectorAll('a')].find(item => item.textContent === '성과 목록 보기');
    assert.equal(link?.getAttribute('href'), '/blog/achievements/');
    link.focus();
    assert.equal(browser.document.activeElement, link);
    await act(async () => {
      resolveIndex({ ok: true, json: async () => [indexedRows[0], achievement] });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /Certifications/);
    assert.equal(mounted.rootElement.querySelector('#react-posts-search-status'), null);
    assert.equal([...mounted.rootElement.querySelectorAll('a')].find(item => item.textContent === '성과 목록 보기'), undefined);
    assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('#react-posts-search-input'));
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('색인 대기 중 다른 곳으로 이동한 포커스는 완료 후에도 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let resolveIndex;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, [posts[0]], () => new Promise(resolve => { resolveIndex = resolve; }));
    const link = mounted.rootElement.querySelector('#react-posts-achievements-link');
    const category = mounted.rootElement.querySelector('#react-posts-category-select');
    link.focus();
    category.focus();
    await act(async () => {
      resolveIndex({ ok: true, json: async () => [indexedRows[0]] });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(browser.document.activeElement, category);
    assert.equal(mounted.rootElement.querySelector('#react-posts-achievements-link'), null);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('빠른 색인 성공 후에는 제한 검색 안내와 복구 링크가 남지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, [posts[0]], async () => ({ ok: true, json: async () => [indexedRows[0]] }));
    assert.equal(mounted.rootElement.querySelector('#react-posts-search-status'), null);
    assert.equal(mounted.rootElement.querySelector('#react-posts-achievements-link'), null);
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /needle 전체 본문/);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('색인 오류 시 검색 범위와 성과 복구 링크를 제공하고 재시도 성공 뒤 제거한다', async () => {
  const cleanup = installBrowser('https://blog.test/blog/posts/?q=Information');
  const browser = globalThis.window;
  const achievement = indexedPage({ url: 'https://blog.test/profile/certs/', page_kind: 'achievement', title: 'Certifications', content: 'Information Processing Engineer', language: 'en' });
  let attempt = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, [posts[0]], async () => {
      attempt++;
      if (attempt === 1) return { ok: false, status: 503 };
      return { ok: true, json: async () => [indexedRows[0], achievement] };
    }, undefined, ['/profile/certs/'], '/search.json', ['/profile/certs/'], '/blog/achievements/');
    assert.match(mounted.rootElement.textContent, /성과·시리즈·도구 페이지는 검색되지 않습니다/);
    assert.equal([...mounted.rootElement.querySelectorAll('a')].find(link => link.textContent === '성과 목록 보기')?.getAttribute('href'), '/blog/achievements/');
    await act(async () => { mounted.rootElement.querySelector('#react-posts-retry-search-index').click(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /Certifications/);
    assert.equal([...mounted.rootElement.querySelectorAll('a')].find(link => link.textContent === '성과 목록 보기'), undefined);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('색인 재시도는 같은 빌드 주소를 브라우저 캐시 우회로 다시 요청한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const requests = [];
  let mounted;
  try {
    mounted = await mountPostsApp(browser, [posts[0]], async (url, options) => {
      requests.push({ url, cache: options.cache, signal: options.signal });
      return { ok: true, json: async () => options.cache === 'reload' ? [indexedRows[0]] : [] };
    }, undefined, [], '/search.json?v=build-123');
    assert.match(mounted.rootElement.textContent, /본문 인덱스를 불러오지 못했습니다/);
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    assert.ok(retry, '불완전한 색인에서 재시도를 제공해야 합니다');
    await act(async () => { retry.click(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.deepEqual(requests.map(({ url, cache }) => [url, cache]), [
      ['https://blog.test/search.json?v=build-123', 'default'],
      ['https://blog.test/search.json?v=build-123', 'reload'],
    ]);
    assert.ok(requests.every(request => request.signal), '두 요청 모두 취소 신호를 유지해야 합니다');
    assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
    assert.match(mounted.rootElement.textContent, /needle 전체 본문/);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('본문 인덱스 대기·오류·재시도에서 태그 검색과 한 번만 해독된 폴백을 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=%3Ch1%3E');
  const browser = globalThis.window;
  const fallback = [{ ...posts[0], description: '', content: '&lt;h1&gt; &amp;lt;fieldset&amp;gt; 예제' }];
  let resolveFirst;
  let attempt = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, fallback, () => {
      attempt++;
      if (attempt === 1) return new Promise(resolve => { resolveFirst = resolve; });
      return Promise.resolve({ ok: true, json: async () => [{
        ...indexedRows[0], description: '', content: '&lt;h1&gt; &amp;lt;fieldset&amp;gt; 예제',
      }] });
    });
    const resultText = () => mounted.rootElement.querySelector('#react-posts-list').textContent;
    assert.match(resultText(), /<h1>/);
    assert.match(resultText(), /&lt;fieldset&gt;/);
    await act(async () => { resolveFirst({ ok: false, status: 503 }); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.match(resultText(), /<h1>/);
    assert.match(resultText(), /&lt;fieldset&gt;/);
    assert.match(mounted.rootElement.textContent, /불러오지 못했습니다/);
    await act(async () => { mounted.rootElement.querySelector('#react-posts-retry-search-index').click(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.match(resultText(), /<h1>/);
    assert.match(resultText(), /&lt;fieldset&gt;/);
    assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('늦게 도착한 본문 인덱스가 포커스된 결과를 밀어내면 보이는 결과로 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const fallback = posts.map((post, index) => ({ ...post, content: index >= 10 ? 'needle 요약' : '일반 요약' }));
  let resolveFetch;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, fallback, () => new Promise(resolve => { resolveFetch = resolve; }));
    const previousLink = mounted.rootElement.querySelector('.post-preview h2 a');
    assert.ok(previousLink);
    previousLink.focus();
    assert.equal(browser.document.activeElement, previousLink);
    await act(async () => {
      resolveFetch({ ok: true, json: async () => indexedRows });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(previousLink.isConnected, false);
    assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('.post-preview h2 a'));
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

for (const selector of ['#react-posts-page-links a[aria-label="2페이지"]', '#react-posts-next-page']) {
  test(`색인 갱신으로 ${selector}가 제거되면 입력란으로 포커스를 복구한다`, async () => {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle');
    const browser = globalThis.window;
    const fallback = posts.map(post => ({ ...post, content: 'needle 임시 본문' }));
    const rows = indexedRows.map((row, index) => ({ ...row, content: index === 0 ? 'needle 본문' : '다른 본문' }));
    let resolveFetch;
    let mounted;
    try {
      mounted = await mountPostsApp(browser, fallback, () => new Promise(resolve => { resolveFetch = resolve; }));
      const control = mounted.rootElement.querySelector(selector);
      assert.ok(control);
      control.focus();
      assert.equal(browser.document.activeElement === control, true);
      await act(async () => {
        resolveFetch({ ok: true, json: async () => rows });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      assert.equal(control.isConnected, false);
      assert.equal(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), true);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  });
}

test('색인 갱신 후 페이지 버튼이 유지되지만 비활성화되면 입력란으로 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=2');
  const browser = globalThis.window;
  const fallback = Array.from({ length: 21 }, (_, index) => ({ ...posts[index % posts.length], path: `/posts/focus-${index}/`, href: `/posts/focus-${index}/`, title: `글 ${index}`, content: 'needle 임시 본문' }));
  const rows = fallback.map((post, index) => ({ type: 'post', url: `https://blog.test${post.path}`, title: post.title, category: post.categories[0], tags: [], description: '', content: index < 11 ? 'needle 본문' : '다른 본문', date: post.date }));
  let resolveFetch;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, fallback, () => new Promise(resolve => { resolveFetch = resolve; }));
    const next = mounted.rootElement.querySelector('#react-posts-next-page');
    assert.equal(next.disabled, false);
    next.focus();
    await act(async () => {
      resolveFetch({ ok: true, json: async () => rows });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(next.isConnected, true);
    assert.equal(next.disabled, true);
    assert.equal(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('이력 복원과 색인 응답이 겹쳐 페이지 링크가 사라져도 포커스를 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&sort=relevance');
  const browser = globalThis.window;
  const fallback = posts.map(post => ({ ...post, content: 'needle 임시 본문' }));
  const rows = indexedRows.map((row, index) => ({ ...row, content: index === 0 ? 'needle 본문' : '다른 본문' }));
  let resolveFetch;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, fallback, () => new Promise(resolve => { resolveFetch = resolve; }));
    const link = mounted.rootElement.querySelector('#react-posts-page-links a[aria-label="2페이지"]');
    assert.ok(link);
    link.focus();
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=needle');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
      resolveFetch({ ok: true, json: async () => rows });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(link.isConnected, false);
    assert.match(mounted.rootElement.querySelector('#react-posts-count').textContent, /검색 결과 1개/);
    assert.equal(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

for (const response of ['ready', 'failed']) {
  test(`색인 ${response} 응답 후 페이지 링크가 유지되면 포커스를 보존한다`, async () => {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle');
    const browser = globalThis.window;
    const fallback = posts.map(post => ({ ...post, content: 'needle 임시 본문' }));
    let resolveFetch;
    let mounted;
    try {
      mounted = await mountPostsApp(browser, fallback, () => new Promise(resolve => { resolveFetch = resolve; }));
      const link = mounted.rootElement.querySelector('#react-posts-page-links a[aria-label="2페이지"]');
      link.focus();
      await act(async () => {
        resolveFetch(response === 'ready' ? { ok: true, json: async () => indexedRows } : { ok: false, status: 503 });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      assert.equal(link.isConnected, true);
      assert.equal(browser.document.activeElement === link, true);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  });
}

test('실패 후 재시도로 결과가 축소될 때 페이지 링크 포커스를 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const fallback = posts.map(post => ({ ...post, content: 'needle 임시 본문' }));
  const rows = indexedRows.map((row, index) => ({ ...row, content: index === 0 ? 'needle 본문' : '다른 본문' }));
  let resolveRetry;
  let attempt = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, fallback, () => {
      attempt++;
      return attempt === 1 ? Promise.resolve({ ok: false, status: 503 }) : new Promise(resolve => { resolveRetry = resolve; });
    });
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    assert.ok(retry);
    retry.focus();
    await act(async () => retry.click());
    const link = mounted.rootElement.querySelector('#react-posts-page-links a[aria-label="2페이지"]');
    link.focus();
    await act(async () => {
      resolveRetry({ ok: true, json: async () => rows });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(link.isConnected, false);
    assert.equal(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('검색어 입력 중 색인 갱신은 입력 포커스와 대기 상태를 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const fallback = posts.map(post => ({ ...post, content: 'needle 임시 본문' }));
  const rows = indexedRows.map((row, index) => ({ ...row, content: index === 0 ? 'needle 본문' : '다른 본문' }));
  let resolveFetch;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, fallback, () => new Promise(resolve => { resolveFetch = resolve; }));
    mounted.rootElement.querySelector('#react-posts-page-links a[aria-label="2페이지"]').focus();
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    input.focus();
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'needle extra');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: ' extra' }));
      resolveFetch({ ok: true, json: async () => rows });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(browser.document.activeElement === input, true);
    assert.equal(input.value, 'needle extra');
    assert.equal(mounted.rootElement.querySelector('#react-posts-results').hidden, true);
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(mounted.rootElement.querySelector('#react-posts-results').hidden, false);
    assert.equal(browser.document.activeElement === input, true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('본문 인덱스가 도착하기 전 다른 선택 항목으로 옮긴 포커스는 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const fallback = posts.map((post, index) => ({ ...post, content: index >= 10 ? 'needle 요약' : '일반 요약' }));
  let resolveFetch;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, fallback, () => new Promise(resolve => { resolveFetch = resolve; }));
    mounted.rootElement.querySelector('.post-preview h2 a').focus();
    const category = mounted.rootElement.querySelector('#react-posts-category-select');
    category.focus();
    await act(async () => {
      resolveFetch({ ok: true, json: async () => indexedRows });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(browser.document.activeElement, category);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('본문 인덱스 갱신 후에도 같은 글이 보이면 그 글에 포커스를 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let resolveFetch;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, () => new Promise(resolve => { resolveFetch = resolve; }));
    const previousLink = mounted.rootElement.querySelector('.post-preview h2 a');
    previousLink.focus();
    await act(async () => {
      resolveFetch({ ok: true, json: async () => indexedRows });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const currentLink = mounted.rootElement.querySelector('.post-preview h2 a');
    assert.equal(currentLink.getAttribute('href'), previousLink.getAttribute('href'));
    assert.equal(browser.document.activeElement, currentLink);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('다시 시도 중 포커스한 대체 결과가 사라지면 보이는 결과로 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const fallback = posts.map((post, index) => ({ ...post, content: index >= 10 ? 'needle 요약' : '일반 요약' }));
  let resolveFetch;
  let attempt = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, fallback, () => {
      attempt += 1;
      return attempt === 1 ? Promise.resolve({ ok: false }) : new Promise(resolve => { resolveFetch = resolve; });
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    await act(async () => mounted.rootElement.querySelector('#react-posts-retry-search-index').click());
    const previousLink = mounted.rootElement.querySelector('.post-preview h2 a');
    previousLink.focus();
    await act(async () => {
      resolveFetch({ ok: true, json: async () => indexedRows });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(previousLink.isConnected, false);
    assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('.post-preview h2 a'));
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('검색 재시도 중 빈 공간을 선택하면 성공 후 포커스를 빼앗지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let resolveFetch;
  let attempt = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, () => {
      attempt += 1;
      return attempt === 1 ? Promise.resolve({ ok: false }) : new Promise(resolve => { resolveFetch = resolve; });
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    retry.focus();
    await act(async () => retry.click());
    browser.document.body.dispatchEvent(new browser.Event('pointerdown', { bubbles: true }));
    browser.document.body.tabIndex = -1;
    browser.document.body.focus();
    assert.equal(browser.document.activeElement, browser.document.body);
    await act(async () => {
      resolveFetch({ ok: true, json: async () => indexedRows });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(browser.document.activeElement, browser.document.body);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('Unicode matching preserves original title and excerpt while highlighting case-composed text', async () => {
  const cleanup = installBrowser(`https://blog.test/posts/?q=${encodeURIComponent('ẖ')}`);
  const { window: browser } = globalThis;
  const title = 'H\u0331 기록';
  const content = `${'İ'.repeat(80)} H\u0331 ${'x'.repeat(180)}`;
  const entry = { ...posts[0], title, description: '', content };
  let mounted;
  try {
    mounted = await mountPostsApp(browser, [entry], async () => ({ ok: true, json: async () => [
      { ...indexedRows[0], title, description: '', content },
    ] }));
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    const link = mounted.rootElement.querySelector('.post-preview h2 a');
    assert.ok(link, 'case-composed query must find the result');
    assert.equal(link.textContent, title, 'title must retain its original Unicode spelling');
    assert.equal(link.querySelector('mark')?.textContent, 'H\u0331');
    const excerpt = mounted.rootElement.querySelector('.post-excerpt');
    assert.equal(excerpt.querySelector('mark')?.textContent, 'H\u0331');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

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

test('인덱스에서 안내 페이지가 통째로 누락되면 재시도로 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=계산기');
  const { window: browser } = globalThis;
  let mounted;
  let requestCount = 0;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), async () => {
      requestCount += 1;
      return { ok: true, json: async () => [indexedRows[0], ...(requestCount > 1
        ? [indexedPage({ url: '/tools/unit-converter/', title: '단위 계산기' })] : [])] };
    }, undefined, ['/tools/unit-converter/']);
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    assert.match(mounted.rootElement.textContent, /1개.*안내 페이지.*누락/);
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    assert.ok(retry);
    await act(async () => { retry.click(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(requestCount, 2);
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /단위 계산기/);
    assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('설명 필드가 누락되면 제한 검색을 안내하고 재시도 후 설명으로 검색한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=파운드');
  const { window: browser } = globalThis;
  let mounted;
  let requestCount = 0;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), async () => {
      requestCount += 1;
      const page = indexedPage({ url: '/tools/unit-converter/', title: '단위 변환기', description: '파운드 변환' });
      if (requestCount === 1) delete page.description;
      return { ok: true, json: async () => [indexedRows[0], page] };
    }, undefined, ['/tools/unit-converter/']);
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    assert.match(mounted.rootElement.textContent, /검색 인덱스 일부.*누락/);
    assert.doesNotMatch(mounted.rootElement.querySelector('#react-posts-list').textContent, /단위 변환기/);
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    assert.ok(retry);
    await act(async () => { retry.click(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(requestCount, 2);
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /단위 변환기/);
    assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('중복된 색인으로 누락된 본문 검색은 재시도 후 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const { window: browser } = globalThis;
  let mounted;
  let requestCount = 0;
  try {
    mounted = await mountPostsApp(browser, [posts[0]], async () => {
      requestCount += 1;
      return { ok: true, json: async () => requestCount === 1
        ? [{ ...indexedRows[0], content: '잘린 본문' }, indexedRows[0]]
        : [indexedRows[0]] };
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    assert.match(mounted.rootElement.textContent, /검색 인덱스 일부.*누락/);
    assert.doesNotMatch(mounted.rootElement.querySelector('#react-posts-list').textContent, /needle 전체 본문/);
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    assert.ok(retry);
    await act(async () => { retry.click(); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(requestCount, 2);
    assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /needle 전체 본문/);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('미리보기 검색 결과는 안전한 인코딩 경로와 현재 호스트를 유지한다', async () => {
  const cleanup = installBrowser('http://localhost:4173/posts/?q=계산기');
  const { window: browser } = globalThis;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), async () => ({
      ok: true,
      json: async () => [
        indexedRows[0],
        indexedPage({ url: 'https://blog.test/tools/%3Ffilter/', title: '단위 계산기' }),
        { type: 'post', url: 'https://evil.test/posts/fake/', title: '가짜 계산기' },
      ],
    }), undefined, ['/tools/%3Ffilter/']);
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    const links = Array.from(mounted.rootElement.querySelectorAll('#react-posts-list h2 a'));
    assert.equal(links.length, 1);
    assert.equal(links[0].getAttribute('href'), '/tools/%3Ffilter/');
    assert.equal(links[0].href, 'http://localhost:4173/tools/%3Ffilter/');
    assert.match(mounted.rootElement.textContent, /검색 인덱스 일부.*누락/);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('페이지 인덱스가 손상돼도 정상 글과 페이지는 유지하고 재시도로 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=계산기');
  const { window: browser } = globalThis;
  let mounted;
  let requestCount = 0;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), async () => {
      requestCount += 1;
      const page = requestCount === 1
        ? indexedPage({ url: '/tools/unit-converter/', title: null })
        : indexedPage({ url: '/tools/unit-converter/', title: '단위 계산기' });
      return { ok: true, json: async () => [indexedRows[0], page, indexedPage({ url: '/tools/acceleration/', title: '가속도 계산기' })] };
    }, undefined, ['/tools/unit-converter/', '/tools/acceleration/']);
    await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
    assert.match(mounted.rootElement.textContent, /검색 인덱스 일부.*누락/);
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /가속도 계산기/);
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    assert.ok(retry);
    await act(async () => {
      retry.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    assert.equal(requestCount, 2);
    assert.match(mounted.rootElement.querySelector('#react-posts-list').textContent, /단위 계산기/);
    assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
    assert.doesNotMatch(mounted.rootElement.textContent, /검색 인덱스 일부.*누락/);
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

test('a stalled index times out, can be retried, and cannot overwrite the recovered index', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const { window: browser } = globalThis;
  const originalSetTimeout = browser.setTimeout.bind(browser);
  browser.setTimeout = (callback, delay, ...args) => originalSetTimeout(callback, delay === 12000 ? 10 : delay, ...args);
  let resolveFirst;
  let firstSignal;
  let requestCount = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), (_url, options) => {
      requestCount++;
      if (requestCount === 1) {
        firstSignal = options.signal;
        return new Promise(resolve => { resolveFirst = resolve; });
      }
      return Promise.resolve({ ok: true, json: async () => [{ ...indexedRows[0], content: 'needle recovered' }] });
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 25)));
    assert.equal(firstSignal.aborted, true);
    assert.match(mounted.rootElement.textContent, /본문 인덱스를 불러오지 못했습니다/);
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    assert.ok(retry);
    await act(async () => retry.click());
    assert.equal(requestCount, 2);
    assert.match(mounted.rootElement.querySelector('.post-excerpt').textContent, /recovered/);
    await act(async () => {
      resolveFirst({ ok: true, json: async () => [{ ...indexedRows[0], content: 'needle stale' }] });
      await Promise.resolve();
    });
    assert.match(mounted.rootElement.querySelector('.post-excerpt').textContent, /recovered/);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('unmount cancels an outstanding index request', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const { window: browser } = globalThis;
  let signal;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    });
    assert.equal(signal.aborted, false);
    await act(async () => mounted.root.unmount());
    mounted = null;
    assert.equal(signal.aborted, true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('첫 색인 요청 중에는 재시도 버튼이 나타나지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let resolveFirst;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), () => new Promise(resolve => { resolveFirst = resolve; }));
    assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
    await act(async () => { resolveFirst({ ok: false, status: 503 }); await Promise.resolve(); });
    assert.ok(mounted.rootElement.querySelector('#react-posts-retry-search-index'));
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('색인 재시도 중 포커스를 유지하고 실패·불완전 응답 뒤 다시 시도할 수 있다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let resolveRetry;
  let count = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), () => {
      count += 1;
      if (count === 1) return Promise.resolve({ ok: false, status: 503 });
      return new Promise(resolve => { resolveRetry = resolve; });
    });
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    retry.focus();
    await act(async () => { retry.click(); retry.click(); });
    assert.equal(count, 2, '한 렌더 주기에서 반복 실행해도 중복 요청을 보내지 않는다');
    assert.equal(retry.disabled, false, '진행 중에도 키보드 포커스를 유지한다');
    assert.equal(retry.getAttribute('aria-disabled'), 'true');
    assert.equal(browser.document.activeElement, retry);
    await act(async () => retry.click());
    assert.equal(count, 2, '로딩 상태를 표시한 후에도 중복 요청을 보내지 않는다');
    await act(async () => { resolveRetry({ ok: false, status: 503 }); await Promise.resolve(); });
    assert.equal(retry.getAttribute('aria-disabled'), null);
    assert.equal(browser.document.activeElement, retry, '실패 후 다시 시도할 수 있다');
    await act(async () => retry.click());
    assert.equal(count, 3);
    await act(async () => { resolveRetry({ ok: true, json: async () => [] }); await Promise.resolve(); });
    assert.equal(retry.getAttribute('aria-disabled'), null);
    assert.equal(browser.document.activeElement, retry, '불완전한 응답에도 재시도 위치를 유지한다');
    await act(async () => retry.click());
    assert.equal(count, 4);
    await act(async () => { resolveRetry({ ok: true, json: async () => [indexedRows[0]] }); await Promise.resolve(); });
    assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
    assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('#react-posts-search-input'));
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('재시도 시간 초과 뒤에도 버튼 포커스와 재시도 가능 상태를 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const originalSetTimeout = browser.setTimeout.bind(browser);
  browser.setTimeout = (callback, delay, ...args) => originalSetTimeout(callback, delay === 12000 ? 10 : delay, ...args);
  let count = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), () => {
      count += 1;
      return count === 1 ? Promise.resolve({ ok: false, status: 503 }) : new Promise(() => {});
    });
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    retry.focus();
    await act(async () => retry.click());
    assert.equal(browser.document.activeElement, retry);
    await act(async () => new Promise(resolve => setTimeout(resolve, 25)));
    assert.equal(retry.getAttribute('aria-disabled'), null);
    assert.equal(browser.document.activeElement, retry);
    assert.equal(count, 2);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

for (const eventType of ['keydown', 'pointerdown']) {
  test(`색인 재시도 중 같은 버튼을 다시 ${eventType}한 뒤 성공해도 포커스를 복구한다`, async () => {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle');
    const browser = globalThis.window;
    let resolveRetry;
    let count = 0;
    let mounted;
    try {
      mounted = await mountPostsApp(browser, posts.slice(0, 1), () => {
        count += 1;
        return count === 1 ? Promise.resolve({ ok: false, status: 503 }) : new Promise(resolve => { resolveRetry = resolve; });
      });
      const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
      retry.focus();
      await act(async () => retry.click());
      await act(async () => {
        const event = eventType === 'keydown'
          ? new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
          : new browser.Event('pointerdown', { bubbles: true });
        retry.dispatchEvent(event);
        retry.click();
      });
      assert.equal(count, 2, '재조작해도 요청은 하나만 진행된다');
      assert.equal(browser.document.activeElement, retry);
      await act(async () => { resolveRetry({ ok: true, json: async () => [indexedRows[0]] }); await Promise.resolve(); });
      assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
      assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('#react-posts-search-input'));
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  });
}

test('재시도 중 이력 복원으로 버튼이 사라져도 포커스를 보존한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let resolveRetry;
  let count = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), () => {
      count += 1;
      return count === 1 ? Promise.resolve({ ok: false, status: 503 }) : new Promise(resolve => { resolveRetry = resolve; });
    });
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    retry.focus();
    await act(async () => retry.click());
    await act(async () => {
      browser.history.pushState({}, '', '/posts/');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    const search = mounted.rootElement.querySelector('#react-posts-search-input');
    assert.equal(browser.document.activeElement, search);
    assert.equal(mounted.rootElement.querySelector('#react-posts-retry-search-index'), null);
    await act(async () => { resolveRetry({ ok: false, status: 503 }); await Promise.resolve(); });
    assert.equal(browser.document.activeElement, search);
    assert.equal(count, 2);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('successful retry does not steal focus after the user moves elsewhere', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const { window: browser } = globalThis;
  let resolveRetry;
  let requestCount = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts.slice(0, 1), () => {
      requestCount++;
      if (requestCount === 1) return Promise.resolve({ ok: false, status: 503 });
      return new Promise(resolve => { resolveRetry = resolve; });
    });
    const retry = mounted.rootElement.querySelector('#react-posts-retry-search-index');
    retry.focus();
    await act(async () => retry.click());
    const category = mounted.rootElement.querySelector('#react-posts-category-select');
    category.focus();
    await act(async () => {
      resolveRetry({ ok: true, json: async () => [indexedRows[0]] });
      await Promise.resolve();
    });
    assert.equal(browser.document.activeElement, category);
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

test('pagination applies a pending search before navigating its result pages', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const { window: browser } = globalThis;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'needle');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'needle' }));
    });
    await act(async () => mounted.rootElement.querySelector('#react-posts-next-page').click());
    assert.equal(input.value, 'needle');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'needle');
    assert.equal(new URL(browser.location.href).searchParams.has('page'), false);
    assert.match(mounted.rootElement.querySelector('#react-posts-count').textContent, /검색 결과 12개/);
    assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('#react-posts-list .post-preview h2 a'));

    await act(async () => mounted.rootElement.querySelector('#react-posts-next-page').click());
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 2);

    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, '기록 1');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: '기록 1' }));
    });
    await act(async () => mounted.rootElement.querySelector('a[aria-label="1페이지"]').dispatchEvent(
      new browser.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    ));
    assert.equal(input.value, '기록 1');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '기록 1');
    assert.equal(new URL(browser.location.href).searchParams.has('page'), false);
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(input.value, '기록 1', 'the cancelled debounce must not restore older state');

    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    assert.equal(input.value, 'needle', 'back must restore the previous query');
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
    assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 2);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('현재 페이지를 다시 선택한 뒤 검색해도 입력란에 포커스를 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const { window: browser } = globalThis;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const currentPage = mounted.rootElement.querySelector('a[aria-label="1페이지"]');
    currentPage.focus();
    await act(async () => currentPage.click());
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    input.focus();
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'needle');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'needle' }));
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'needle');
    assert.equal(browser.document.activeElement, input);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('검색어 적용을 기다리는 중 현재 페이지를 선택하면 새 검색을 적용한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const { window: browser } = globalThis;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'needle');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'needle' }));
    });
    const currentPage = mounted.rootElement.querySelector('a[aria-label="1페이지"]');
    currentPage.focus();
    await act(async () => currentPage.click());
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'needle');
    assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('#react-posts-list .post-preview h2 a'));
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'needle');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('pagination does not interrupt an active IME composition', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const { window: browser } = globalThis;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    await act(async () => {
      input.dispatchEvent(new browser.CompositionEvent('compositionstart', { bubbles: true }));
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'needle');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, isComposing: true }));
      mounted.rootElement.querySelector('#react-posts-next-page').click();
    });
    assert.equal(input.value, 'needle');
    assert.equal(new URL(browser.location.href).searchParams.has('page'), false);
    assert.equal(new URL(browser.location.href).searchParams.has('q'), false);
    await act(async () => input.dispatchEvent(new browser.CompositionEvent('compositionend', { bubbles: true, data: 'needle' })));
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'needle');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('pagination focuses the recovery action when a pending search has no results', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const { window: browser } = globalThis;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'no-match-zzz');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'no-match-zzz' }));
    });
    const next = mounted.rootElement.querySelector('#react-posts-next-page');
    next.focus();
    await act(async () => next.click());
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'no-match-zzz');
    assert.ok(mounted.rootElement.querySelector('#react-posts-empty-state'));
    assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('#react-posts-clear-filters'));
    await act(async () => browser.document.activeElement.click());
    assert.equal(input.value, '');
    assert.equal(browser.document.activeElement, input);
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
