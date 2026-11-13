import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';
import { act, createElement } from 'react';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

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

// 실행 진입점 자체를 변환해 실행하여 React 마운트 전 예외 경로를 확인한다.
test('부트스트랩 데이터 오류는 정적 목록과 복구 안내를 제공하고 기존 초점을 유지한다', async () => {
  const compiled = ts.transpileModule(await readFile(new URL('../../frontend/posts/main.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const attributes of ['', 'data-expected-search-pages="bad"', 'data-expected-search-pages="[]" data-expected-achievement-paths="bad"']) {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle');
    const browser = globalThis.window;
    try {
      browser.document.body.innerHTML = `<button id="outside">외부</button><div id="posts-react-root" ${attributes} hidden></div><section id="posts-static-fallback"><a href="/posts/a/">정적 글</a></section>`;
      const fallback = browser.document.getElementById('posts-static-fallback');
      fallback.querySelector('a').focus();
      const appModule = await import('../../build/tests/frontend/posts/PostsApp.js');
      let rootCalls = 0;
      runInNewContext(compiled, {
        exports: {}, document: browser.document, window: browser, HTMLElement: browser.HTMLElement,
        require(name) {
          if (name === './PostsApp') return appModule;
          if (name === 'react-dom/client') return { createRoot() { rootCalls += 1; throw new Error('데이터 검사 전 마운트 금지'); } };
          if (name === 'react/jsx-runtime') return {};
          throw new Error(`예상하지 못한 모듈: ${name}`);
        },
      });
      assert.equal(browser.document.getElementById('posts-react-root').hidden, true);
      assert.equal(fallback.hidden, false);
      assert.equal(rootCalls, 0, '유효하지 않은 데이터는 React 마운트 전에 거부한다');
      assert.equal(browser.document.activeElement, fallback.querySelector('a'));
      assert.match(fallback.querySelector('[role="alert"]')?.textContent || '', /검색 화면을 불러오지 못했습니다.*새로고침/);
    } finally {
      await cleanup();
    }
  }
});

test('부트스트랩 마운트 예외에서도 외부 포커스를 유지하며 정적 복구를 안내한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  try {
    browser.document.body.innerHTML = `<button id="outside">외부</button><div id="posts-react-root" data-expected-search-pages="[]" data-expected-achievement-paths="[]" hidden></div><section id="posts-static-fallback">정적 글</section>`;
    browser.document.getElementById('outside').focus();
    const compiled = ts.transpileModule(await readFile(new URL('../../frontend/posts/main.tsx', import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const appModule = await import('../../build/tests/frontend/posts/PostsApp.js');
    runInNewContext(compiled, {
      exports: {}, document: browser.document, window: browser, HTMLElement: browser.HTMLElement,
      require(name) {
        if (name === './PostsApp') return appModule;
        if (name === 'react-dom/client') return { createRoot() { throw new Error('마운트 실패'); } };
        if (name === 'react/jsx-runtime') return {};
        throw new Error(`예상하지 못한 모듈: ${name}`);
      },
    });
    const fallback = browser.document.getElementById('posts-static-fallback');
    assert.equal(browser.document.activeElement.id, 'outside');
    assert.equal(fallback.hidden, false);
    assert.match(fallback.querySelector('[role="alert"]')?.textContent || '', /검색 화면을 불러오지 못했습니다/);
  } finally {
    await cleanup();
  }
});

test('부트스트랩 데이터가 유효하면 오류 안내 없이 React 렌더를 시작한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  try {
    browser.document.body.innerHTML = '<div id="posts-react-root" data-expected-search-pages="[]" data-expected-achievement-paths="[]" hidden></div><section id="posts-static-fallback"><a href="/posts/a/">정적 글</a></section>';
    const compiled = ts.transpileModule(await readFile(new URL('../../frontend/posts/main.tsx', import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const appModule = await import('../../build/tests/frontend/posts/PostsApp.js');
    let renderCalls = 0;
    runInNewContext(compiled, {
      exports: {}, document: browser.document, window: browser, HTMLElement: browser.HTMLElement,
      require(name) {
        if (name === './PostsApp') return appModule;
        if (name === 'react-dom/client') return { createRoot() { return { render() { renderCalls += 1; } }; } };
        if (name === 'react/jsx-runtime') return { jsx(type, props) { return { type, props }; } };
        throw new Error(`예상하지 못한 모듈: ${name}`);
      },
    });
    assert.equal(renderCalls, 1);
    assert.equal(browser.document.querySelector('#posts-static-fallback [role="alert"]'), null);
  } finally {
    await cleanup();
  }
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
  writeStoredState(browser, { scrollY, query });
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
  browser.sessionStorage.setItem('postsListState', JSON.stringify({ version: 2, entries: [{
    entryKey: browser.navigation.currentEntry.key, entryId: browser.navigation.currentEntry.id,
    path: '/posts/', query: 'needle', category: 'all', sort: 'date', page: 1, scrollY: 600, ...overrides,
  }] }));
}

test('같은 URL의 다른 이력 항목은 각자의 저장 위치만 제공한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 1000);
  const nav = browser.navigation;
  const first = nav.currentEntry;
  const entries = [first];
  nav.entries = () => entries;
  const push = browser.history.pushState.bind(browser.history);
  browser.history.pushState = (...args) => {
    push(...args);
    nav.currentEntry = { key: `key-${entries.length}`, id: `id-${entries.length}` };
    entries.push(nav.currentEntry);
  };
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    browser.scrollY = 300;
    await act(async () => mounted.rootElement.querySelector('a[aria-label="2페이지"]').click());
    const second = nav.currentEntry;
    browser.scrollY = 450;
    await act(async () => mounted.rootElement.querySelector('a[aria-label="1페이지"]').click());
    const third = nav.currentEntry;
    assert.notEqual(first.key, third.key);
    browser.scrollY = 700;
    // 페이지를 떠나지 않고 곧장 뒤로 가더라도 마지막 스크롤을 C에 저장한다.
    browser.dispatchEvent(new browser.Event('scroll'));
    for (const entry of [second, first]) {
      nav.currentEntry = entry;
      await act(async () => {
        const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
        browser.history.back();
        await popped;
      });
    }
    assert.ok(restoreButton(mounted));
    await act(async () => restoreButton(mounted).click());
    assert.deepEqual(scroll.calls, [300]);
    for (const entry of [second, third]) {
      nav.currentEntry = entry;
      await act(async () => {
        const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
        browser.history.forward();
        await popped;
      });
    }
    await act(async () => restoreButton(mounted).click());
    assert.deepEqual(scroll.calls, [300, 700]);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('이력 식별이 불가능하거나 중복되면 저장 위치를 표시하지 않는다', async () => {
  for (const failure of ['unsupported', 'missing-id', 'duplicate-key', 'duplicate-id', 'legacy']) {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle');
    const browser = globalThis.window;
    let mounted;
    try {
      saveTestScroll(browser);
      if (failure === 'unsupported') Object.defineProperty(browser, 'navigation', { configurable: true, value: undefined });
      if (failure === 'missing-id') browser.navigation.currentEntry.id = '';
      if (failure === 'duplicate-key') browser.navigation.entries = () => [browser.navigation.currentEntry, { key: 'test-key', id: 'other' }];
      if (failure === 'duplicate-id') browser.navigation.entries = () => [browser.navigation.currentEntry, { key: 'other', id: 'test-id' }];
      if (failure === 'legacy') browser.sessionStorage.setItem('postsListState', JSON.stringify({ path: '/posts/', query: 'needle', category: 'all', sort: 'date', page: 1, scrollY: 600 }));
      mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
      assert.equal(restoreButton(mounted), null, failure);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  }
});

test('복원 버튼 표시 후 외부에서 같은 주소의 이력을 추가해도 다른 위치로 이동하지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const button = restoreButton(mounted);
    assert.ok(button);
    browser.history.pushState(['외부'], '', browser.location.href);
    browser.navigation.currentEntry = { key: 'other-key', id: 'other-id' };
    await act(async () => button.click());
    assert.deepEqual(scroll.calls, []);
    assert.equal(restoreButton(mounted), null);
    assert.deepEqual(browser.history.state, ['외부']);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('복귀 후 현재 스크롤은 기존 복원 목표를 선택 전까지 덮어쓰지 않는다', async () => {
  for (const position of [300, 0]) {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle');
    const browser = globalThis.window;
    const scroll = installScrollHarness(browser, 900);
    let mounted;
    try {
      saveTestScroll(browser, 600);
      mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
      browser.scrollY = position;
      browser.dispatchEvent(new browser.Event('scroll'));
      await act(async () => new Promise(resolve => setTimeout(resolve, 180)));
      await act(async () => restoreButton(mounted).click());
      assert.deepEqual(scroll.calls, [600], `${position}px에서 기존 복원 위치로 이동`);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  }
});

test('같은 검색어를 다시 제출해도 현재 이력의 복원 위치가 유지된다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser, 600);
    const replace = browser.history.replaceState.bind(browser.history);
    browser.history.replaceState = (...args) => {
      replace(...args);
      browser.navigation.currentEntry = { key: 'test-key', id: 'replacement-id' };
    };
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    browser.scrollY = 300;
    browser.dispatchEvent(new browser.Event('scroll'));
    await act(async () => mounted.rootElement.querySelector('#react-posts-search-form').dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(browser.navigation.currentEntry.id, 'test-id');
    assert.ok(restoreButton(mounted));
    await act(async () => restoreButton(mounted).click());
    assert.deepEqual(scroll.calls, [600]);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

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

test('빈 화면의 위치 표식은 화면 다음 조작 대상 앞에 놓이고 제목 이름을 바꾸지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const main = browser.document.createElement('main');
    mounted.rootElement.before(main);
    main.append(mounted.rootElement);
    const footer = browser.document.createElement('footer');
    footer.innerHTML = '<a href="/footer/">푸터 링크</a>';
    browser.document.body.append(footer);
    const links = mounted.rootElement.querySelectorAll('#react-posts-list .post-preview h2 a');
    assert.ok(links.length >= 2);
    const next = links[1];
    const heading = next.closest('h2');
    const title = heading.textContent;
    links[0].closest('.post-preview').hidden = true;
    links[0].getBoundingClientRect = () => ({ top: 650, bottom: 675, left: 10, right: 300, width: 290, height: 25 });
    next.getBoundingClientRect = () => ({ top: 700, bottom: 725, left: 10, right: 300, width: 290, height: 25 });
    footer.querySelector('a').getBoundingClientRect = () => ({ top: 900, bottom: 925, left: 10, right: 300, width: 290, height: 25 });
    main.getBoundingClientRect = () => ({ top: -100, bottom: 1000, left: 0, right: 500, width: 500, height: 1100 });
    browser.document.elementFromPoint = () => main;
    await act(async () => { restoreButton(mounted).click(); });
    await scroll.flush();
    const marker = browser.document.querySelector('.posts-scroll-location');
    assert.ok(marker && browser.document.activeElement === marker, '공통 본문 대신 표식에 포커스한다');
    assert.ok(marker.nextElementSibling === heading, '숨겨진 링크는 건너뛰고 화면 다음 제목 앞에 둔다');
    assert.equal(heading.textContent, title, '임시 표식이 제목 이름에 섞이지 않는다');
    assert.ok(marker.compareDocumentPosition(footer.querySelector('a')) & browser.Node.DOCUMENT_POSITION_FOLLOWING);
    await act(async () => mounted.root.unmount());
    mounted = null;
    assert.equal(marker.isConnected, false, 'React 결과를 제거해도 표식이 남지 않는다');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('다음 대상이 레이블 안에 있으면 위치 표식은 레이블 이름 밖에 둔다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const main = browser.document.createElement('main');
    mounted.rootElement.before(main);
    main.append(mounted.rootElement);
    const label = browser.document.createElement('label');
    label.innerHTML = '다음 입력 <input type="text">';
    main.append(label);
    const input = label.querySelector('input');
    input.getBoundingClientRect = () => ({ top: 700, bottom: 725, left: 10, right: 300, width: 290, height: 25 });
    await act(async () => { restoreButton(mounted).click(); });
    const marker = browser.document.querySelector('.posts-scroll-location');
    assert.ok(marker && browser.document.activeElement === marker);
    assert.ok(marker.nextElementSibling === label, '레이블 안에 임시 문구를 넣지 않는다');
    assert.equal(label.textContent, '다음 입력 ');
    input.focus();
    assert.equal(browser.document.querySelector('.posts-scroll-location'), null);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('표식에 포커스한 뒤 이력 이동으로 결과가 사라지면 검색 입력으로 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  installScrollHarness(browser, 900);
  let mounted;
  try {
    saveTestScroll(browser);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const main = browser.document.createElement('main');
    mounted.rootElement.before(main);
    main.append(mounted.rootElement);
    const next = mounted.rootElement.querySelector('#react-posts-list .post-preview h2 a');
    next.getBoundingClientRect = () => ({ top: 700, bottom: 725, left: 10, right: 300, width: 290, height: 25 });
    await act(async () => { restoreButton(mounted).click(); });
    const marker = browser.document.querySelector('.posts-scroll-location');
    assert.ok(marker && browser.document.activeElement === marker);
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=없는검색어');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    assert.equal(marker.isConnected, false, '사라진 결과의 표식을 제거한다');
    assert.ok(browser.document.activeElement === mounted.rootElement.querySelector('#react-posts-search-input'), '이력으로 결과가 사라지면 입력란에 포커스를 복구한다');
    assert.equal(mounted.fallbackElement.hidden, true, 'React 갱신 오류로 정적 폴백에 진입하지 않는다');
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
      browser.navigation.currentEntry = { key: 'other-key', id: 'other-id' };
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    assert.equal(Boolean(restoreButton(mounted)), false);
    await act(async () => {
      browser.navigation.currentEntry = { key: 'test-key', id: 'test-id' };
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
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
  // happy-dom에는 Navigation API가 없어 테스트에서 이력 식별값을 명시적으로 모의한다.
  const navigation = { currentEntry: { key: 'test-key', id: 'test-id' }, entries() { return [this.currentEntry]; } };
  Object.defineProperty(browser, 'navigation', { configurable: true, value: navigation });
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

async function mountPostsApp(browser, fallbackPosts, fetchImpl, categoryLabels = new Map([['mathematics_philosophy_history', '수학·철학사']]), expectedPagePaths = [], searchIndexUrl = '/search.json', expectedAchievementPaths = [], achievementsUrl = '/achievements/', beforeMount = () => {}) {
  browser.document.body.innerHTML = '<div id="mount" hidden></div><section id="fallback"><p>정적 글 목록</p></section>';
  browser.fetch = fetchImpl;
  const rootElement = browser.document.getElementById('mount');
  const fallbackElement = browser.document.getElementById('fallback');
  beforeMount({ browser, rootElement, fallbackElement });
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

test('동적 검색 화면의 렌더 오류는 정적 목록 안내와 포커스를 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let root;
  try {
    browser.document.body.innerHTML = '<div id="mount"></div><section id="fallback" hidden><a href="/posts/first/">첫 글</a></section><button id="outside">바깥</button>';
    const rootElement = browser.document.getElementById('mount');
    const fallbackElement = browser.document.getElementById('fallback');
    const [{ createRoot }, { PostsAppBoundary }] = await Promise.all([
      import('react-dom/client'), import('../../build/tests/frontend/posts/PostsApp.js'),
    ]);
    root = createRoot(rootElement, { onCaughtError() {} });
    function Explode() { throw new Error('렌더 실패'); }
    const draw = child => createElement(PostsAppBoundary, { rootElement, fallbackElement }, child);
    await act(async () => { root.render(draw(createElement('input', { 'aria-label': '검색' }))); });
    rootElement.querySelector('input').focus();
    await act(async () => { root.render(draw(createElement(Explode))); });
    assert.equal(fallbackElement.hidden, false);
    assert.equal(rootElement.hidden, true);
    assert.match(fallbackElement.textContent, /검색.*사용할 수 없|검색.*불러오지 못/);
    assert.ok(fallbackElement.contains(browser.document.activeElement), '검색 화면에서 이탈한 사용자가 정적 안내로 돌아간다');
    assert.match(fallbackElement.querySelector('[role="alert"]').textContent, /조건이 적용되지 않은/);
    await act(async () => root.unmount());
    root = null;
    assert.equal(fallbackElement.querySelector('[role="alert"]'), null, '앱 제거 시 오류 안내를 정리한다');
  } finally {
    if (root) await act(async () => root.unmount());
    await cleanup();
  }
});

test('동적 화면의 초기 렌더 실패는 바깥 포커스를 유지하고 재시도 안내를 표시한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let root;
  try {
    browser.document.body.innerHTML = '<div id="mount" hidden></div><section id="fallback"><a href="/posts/first/">첫 글</a></section><button id="outside">바깥</button>';
    const rootElement = browser.document.getElementById('mount');
    const fallbackElement = browser.document.getElementById('fallback');
    const [{ createRoot }, { PostsAppBoundary }] = await Promise.all([
      import('react-dom/client'), import('../../build/tests/frontend/posts/PostsApp.js'),
    ]);
    root = createRoot(rootElement, { onCaughtError() {} });
    browser.document.getElementById('outside').focus();
    function Explode() { throw new Error('초기 렌더 실패'); }
    await act(async () => { root.render(createElement(PostsAppBoundary, { rootElement, fallbackElement }, createElement(Explode))); });
    assert.equal(browser.document.activeElement.id, 'outside');
    assert.equal(rootElement.hidden, true);
    assert.equal(fallbackElement.hidden, false);
    assert.match(fallbackElement.querySelector('[role="alert"]').textContent, /새로고침/);
  } finally {
    if (root) await act(async () => root.unmount());
    await cleanup();
  }
});

test('렌더 오류 전 사용자가 목록 밖으로 옮긴 포커스는 빼앗지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let root;
  try {
    browser.document.body.innerHTML = '<div id="mount"></div><section id="fallback" hidden><a href="/posts/first/">첫 글</a></section><button id="outside">바깥</button>';
    const rootElement = browser.document.getElementById('mount');
    const fallbackElement = browser.document.getElementById('fallback');
    const [{ createRoot }, { PostsAppBoundary }] = await Promise.all([
      import('react-dom/client'), import('../../build/tests/frontend/posts/PostsApp.js'),
    ]);
    root = createRoot(rootElement, { onCaughtError() {} });
    function Explode() { throw new Error('렌더 실패'); }
    const draw = child => createElement(PostsAppBoundary, { rootElement, fallbackElement }, child);
    await act(async () => { root.render(draw(createElement('input', { 'aria-label': '검색' }))); });
    rootElement.querySelector('input').focus();
    browser.document.getElementById('outside').focus();
    await act(async () => { root.render(draw(createElement(Explode))); });
    assert.equal(browser.document.activeElement.id, 'outside');
    assert.equal(fallbackElement.hidden, false);
    assert.match(fallbackElement.textContent, /검색.*사용할 수 없|검색.*불러오지 못/);
  } finally {
    if (root) await act(async () => root.unmount());
    await cleanup();
  }
});

test('정적 목록을 키보드로 사용하는 동안 동적 전환을 기다리고 목록 밖의 포커스는 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=2');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }), undefined, [], undefined, [], undefined,
      ({ fallbackElement }) => {
        fallbackElement.innerHTML = '<a href="/posts/unmatched/">검색 조건과 무관한 글</a><a href="/achievements/">성과 목록</a>';
        browser.document.body.insertAdjacentHTML('beforeend', '<a id="outside" href="/feed.xml">피드</a>');
        fallbackElement.querySelector('a').focus();
      });
    const [first, second] = mounted.fallbackElement.querySelectorAll('a');
    assert.equal(browser.document.activeElement, first);
    assert.equal(mounted.fallbackElement.hidden, false, '사용 중인 정적 목록을 숨기지 않는다');
    assert.equal(mounted.rootElement.hidden, true, '중복된 목록을 동시에 노출하지 않는다');
    assert.notEqual(mounted.fallbackElement.getAttribute('aria-hidden'), 'true');
    assert.equal(mounted.fallbackElement.inert, false);
    assert.match(mounted.fallbackElement.querySelector('[role="status"]').textContent, /검색 화면이 준비.*목록을 계속 이용/);
    await act(async () => { second.focus(); await Promise.resolve(); });
    assert.equal(browser.document.activeElement, second);
    assert.equal(mounted.fallbackElement.hidden, false, '목록 내부의 다음 링크로 이동해도 유지한다');
    const click = new browser.MouseEvent('click', { bubbles: true, cancelable: true });
    assert.equal(second.dispatchEvent(click), true, '정적 링크의 기본 탐색을 가로채지 않는다');
    const outside = browser.document.getElementById('outside');
    await act(async () => { outside.focus(); await Promise.resolve(); });
    assert.equal(browser.document.activeElement, outside, '사용자가 옮긴 포커스를 빼앗지 않는다');
    assert.equal(mounted.fallbackElement.hidden, true);
    assert.equal(mounted.rootElement.hidden, false);
    assert.equal(mounted.fallbackElement.querySelector('[role="status"]'), null, '전환 안내를 정리한다');
    assert.equal(mounted.rootElement.querySelector('#react-posts-search-input').value, 'needle');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('정적 목록의 검색 화면 열기는 사용자가 선택했을 때만 검색 입력으로 이동한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }), undefined, [], undefined, [], undefined,
      ({ fallbackElement }) => {
        fallbackElement.innerHTML = '<a href="/posts/first/">글</a>';
        fallbackElement.querySelector('a').focus();
      });
    const button = [...mounted.fallbackElement.querySelectorAll('button')].find(item => item.textContent === '검색 화면 열기');
    assert.ok(button);
    await act(async () => { button.focus(); await Promise.resolve(); });
    assert.equal(browser.document.activeElement, button);
    assert.equal(mounted.fallbackElement.hidden, false, '버튼으로 이동만 한 상태에서는 목록을 숨기지 않는다');
    await act(async () => { button.click(); await Promise.resolve(); });
    assert.equal(mounted.rootElement.hidden, false);
    assert.equal(mounted.fallbackElement.hidden, true);
    assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('#react-posts-search-input'));
    assert.equal(browser.document.activeElement.value, 'needle');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('정적 본문을 마우스로 선택해 포커스가 body로 옮겨져도 읽는 목록을 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }), undefined, [], undefined, [], undefined,
      ({ fallbackElement }) => {
        fallbackElement.innerHTML = '<a href="/posts/first/">글</a><p>선택할 본문</p>';
        browser.document.body.insertAdjacentHTML('beforeend', '<button id="outside">다른 조작</button>');
        fallbackElement.querySelector('a').focus();
      });
    const link = mounted.fallbackElement.querySelector('a');
    await act(async () => { link.blur(); await Promise.resolve(); });
    assert.equal(browser.document.activeElement, browser.document.body);
    assert.equal(mounted.fallbackElement.hidden, false, '텍스트 선택이나 창 전환으로 목록을 없애지 않는다');
    assert.equal(mounted.rootElement.hidden, true);
    await act(async () => { browser.document.getElementById('outside').focus(); await Promise.resolve(); });
    assert.equal(mounted.fallbackElement.hidden, true, '이후 바깥 조작으로 이동하면 정상 전환한다');
    assert.equal(browser.document.activeElement.id, 'outside');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('초기 마운트 전 정적 본문 텍스트를 선택하면 목록과 선택 범위를 보존한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }), undefined, [], undefined, [], undefined,
      ({ fallbackElement }) => {
        fallbackElement.innerHTML = '<p>선택한 본문 내용</p>';
        const text = fallbackElement.querySelector('p').firstChild;
        const range = browser.document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 3);
        const selection = browser.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });
    assert.equal(browser.document.activeElement, browser.document.body);
    assert.equal(browser.getSelection().toString(), '선택한');
    assert.equal(mounted.fallbackElement.hidden, false);
    assert.equal(mounted.rootElement.hidden, true);
    const button = [...mounted.fallbackElement.querySelectorAll('button')].find(item => item.textContent === '검색 화면 열기');
    assert.ok(button);
    await act(async () => { button.click(); await Promise.resolve(); });
    assert.equal(mounted.fallbackElement.hidden, true);
    assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('#react-posts-search-input'));
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('정적 목록 밖 선택이나 빈 선택은 초기 동적 전환을 방해하지 않는다', async () => {
  for (const mode of ['outside', 'collapsed']) {
    const cleanup = installBrowser('https://blog.test/posts/');
    const browser = globalThis.window;
    let mounted;
    try {
      mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }), undefined, [], undefined, [], undefined,
        ({ fallbackElement }) => {
          fallbackElement.innerHTML = '<p>목록 본문</p>';
          browser.document.body.insertAdjacentHTML('beforeend', '<p id="outside">외부 본문</p>');
          const text = mode === 'outside' ? browser.document.getElementById('outside').firstChild : fallbackElement.querySelector('p').firstChild;
          const range = browser.document.createRange();
          range.setStart(text, 0);
          range.setEnd(text, mode === 'outside' ? 2 : 0);
          browser.getSelection().removeAllRanges();
          browser.getSelection().addRange(range);
        });
      assert.equal(mounted.fallbackElement.hidden, true, mode);
      assert.equal(mounted.rootElement.hidden, false, mode);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  }
});

test('선택이 사라져도 전환 버튼을 유지하며 목록 밖 클릭은 동적 화면을 표시한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }), undefined, [], undefined, [], undefined,
      ({ fallbackElement }) => {
        fallbackElement.innerHTML = '<p>선택할 본문</p>';
        browser.document.body.insertAdjacentHTML('beforeend', '<p id="outside">바깥 본문</p>');
        const range = browser.document.createRange();
        range.selectNodeContents(fallbackElement.querySelector('p'));
        browser.getSelection().removeAllRanges();
        browser.getSelection().addRange(range);
      });
    browser.getSelection().removeAllRanges();
    browser.document.dispatchEvent(new browser.Event('selectionchange'));
    assert.equal(mounted.fallbackElement.hidden, false);
    assert.ok([...mounted.fallbackElement.querySelectorAll('button')].some(button => button.textContent === '검색 화면 열기'));
    await act(async () => {
      browser.document.getElementById('outside').dispatchEvent(new browser.Event('pointerdown', { bubbles: true }));
      await Promise.resolve();
    });
    assert.equal(mounted.fallbackElement.hidden, true);
    assert.equal(mounted.rootElement.hidden, false);
    assert.equal(browser.document.activeElement, browser.document.body, '바깥 클릭에 새 포커스를 강제하지 않는다');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('정적 목록 밖으로 이동했다가 즉시 돌아오면 대기 상태를 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }), undefined, [], undefined, [], undefined,
      ({ fallbackElement }) => {
        fallbackElement.innerHTML = '<a href="/posts/first/">글</a>';
        browser.document.body.insertAdjacentHTML('beforeend', '<button id="outside">다른 조작</button>');
        fallbackElement.querySelector('a').focus();
      });
    const link = mounted.fallbackElement.querySelector('a');
    await act(async () => {
      browser.document.getElementById('outside').focus();
      link.focus();
      await Promise.resolve();
    });
    assert.equal(browser.document.activeElement, link);
    assert.equal(mounted.fallbackElement.hidden, false);
    assert.equal(mounted.rootElement.hidden, true);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('색인 오류가 나도 정적 목록의 포커스는 유지되고 벗어난 뒤 재시도할 수 있다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => { throw new Error('offline'); }, undefined, [], undefined, [], undefined,
      ({ fallbackElement }) => {
        fallbackElement.innerHTML = '<a href="/posts/first/">글</a>';
        browser.document.body.insertAdjacentHTML('beforeend', '<button id="outside">다른 조작</button>');
        fallbackElement.querySelector('a').focus();
      });
    assert.equal(mounted.fallbackElement.hidden, false);
    assert.equal(browser.document.activeElement, mounted.fallbackElement.querySelector('a'));
    await act(async () => { browser.document.getElementById('outside').focus(); await Promise.resolve(); });
    assert.equal(mounted.rootElement.hidden, false);
    assert.ok(mounted.rootElement.querySelector('#react-posts-retry-search-index'));
    assert.equal(browser.document.activeElement.id, 'outside');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('목록 전환 대기 중 앱이 제거되면 안내와 이벤트 처리를 정리한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }), undefined, [], undefined, [], undefined,
      ({ fallbackElement }) => {
        fallbackElement.innerHTML = '<a href="/posts/first/">글</a>';
        browser.document.body.insertAdjacentHTML('beforeend', '<button id="outside">다른 조작</button>');
        fallbackElement.querySelector('a').focus();
      });
    await act(async () => {
      // focusout 후 예약한 전환보다 제거가 먼저 일어나는 경계다.
      browser.document.getElementById('outside').focus();
      mounted.root.unmount();
      await Promise.resolve();
    });
    assert.equal(mounted.fallbackElement.querySelector('[role="status"]'), null);
    assert.equal(mounted.fallbackElement.hidden, false, '제거된 앱이 뒤늦게 폴백을 숨기지 않는다');
    assert.equal(mounted.rootElement.hidden, true);
    mounted = null;
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('초기 포커스가 정적 목록 밖이면 동적 목록을 즉시 표시하고 포커스를 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }), undefined, [], undefined, [], undefined,
      () => {
        browser.document.body.insertAdjacentHTML('beforeend', '<button id="outside">다른 조작</button>');
        browser.document.getElementById('outside').focus();
      });
    assert.equal(mounted.rootElement.hidden, false);
    assert.equal(mounted.fallbackElement.hidden, true);
    assert.equal(browser.document.activeElement.id, 'outside');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('검색어를 천천히 제출해도 뒤로·앞으로 이전 검색과 주소 상태를 복원한다', async () => {
  const cleanup = installBrowser('https://blog.test/');
  const browser = globalThis.window;
  let mounted;
  try {
    browser.history.pushState({ preserved: '외부 상태' }, '', '/posts/?source=home#results');
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    const form = mounted.rootElement.querySelector('#react-posts-search-form');
    const enter = async value => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: value }));
      });
      await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
      assert.equal(new URL(browser.location.href).searchParams.get('q'), value);
      await act(async () => form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })));
    };
    await enter('NIST');
    await enter('NASA');
    assert.equal(browser.history.state.preserved, '외부 상태');
    assert.equal(browser.location.hash, '#results');
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    assert.equal(input.value, 'NIST');
    assert.equal(new URL(browser.location.href).searchParams.get('source'), 'home');
    assert.equal(browser.location.hash, '#results');
    assert.equal(browser.history.state.preserved, '외부 상태');
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.forward();
      await popped;
    });
    assert.equal(input.value, 'NASA');
    assert.equal(browser.history.state.preserved, '외부 상태');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('제출하지 않은 검색도 뒤로·앞으로 복원하고 다른 이력 상태를 보존한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=NIST&source=home#results');
  const browser = globalThis.window;
  let mounted;
  try {
    browser.history.replaceState(['외부', 1], '', browser.location.href);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    const length = browser.history.length;
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'NASA');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'NASA' }));
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(browser.history.length, length + 1);
    assert.deepEqual(browser.history.state, ['외부', 1]);
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    assert.equal(input.value, 'NIST');
    assert.deepEqual(browser.history.state, ['외부', 1]);
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.forward();
      await popped;
    });
    assert.equal(input.value, 'NASA');
    assert.equal(new URL(browser.location.href).searchParams.get('source'), 'home');
    assert.equal(browser.location.hash, '#results');
    assert.deepEqual(browser.history.state, ['외부', 1]);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('실시간 검색 후 분류 변경은 검색 결과와 각각 별도 이력으로 남는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=NIST&source=home#results');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'NASA');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'NASA' }));
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    const category = mounted.rootElement.querySelector('#react-posts-category-select');
    await act(async () => {
      category.value = 'mathematics_philosophy_history';
      category.dispatchEvent(new browser.Event('change', { bubbles: true }));
    });
    for (const expected of ['NASA', 'NIST']) {
      await act(async () => {
        const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
        browser.history.back();
        await popped;
      });
      assert.equal(input.value, expected);
      assert.equal(category.value, 'all');
      assert.equal(new URL(browser.location.href).searchParams.get('source'), 'home');
      assert.equal(browser.location.hash, '#results');
    }
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('빠른 제출과 디바운스 전 입력 취소는 이력을 중복시키지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=NIST');
  const browser = globalThis.window;
  let mounted;
  try {
    browser.history.replaceState('외부 상태', '', browser.location.href);
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    const type = async value => act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: value }));
    });
    const length = browser.history.length;
    await type('NASA');
    await type('NIST');
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(browser.history.length, length);
    await type('NASA');
    await act(async () => mounted.rootElement.querySelector('#react-posts-search-form').dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })));
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(browser.history.length, length + 1);
    assert.equal(browser.history.state, '외부 상태');
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    assert.equal(input.value, 'NIST');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('뒤로 이동하면 예약된 검색을 취소하고 새 검색은 앞으로 가기 이력을 교체한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=NIST');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    const type = async value => act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: value }));
    });
    await type('NASA');
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    await type('취소할 검색');
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(input.value, 'NIST');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'NIST');
    await type('새 검색');
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.forward();
      await popped;
    });
    assert.equal(input.value, '새 검색');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('검색 초안 중 외부 주소 변경은 제출해도 보존된다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=NIST');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    await act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, 'NASA');
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: 'NASA' }));
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    browser.history.pushState({ external: 1 }, '', '/posts/?q=NASA&source=external#new');
    await act(async () => mounted.rootElement.querySelector('#react-posts-search-form').dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })));
    assert.equal(new URL(browser.location.href).searchParams.get('source'), 'external');
    assert.equal(browser.location.hash, '#new');
    assert.deepEqual(browser.history.state, { external: 1 });
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    assert.equal(input.value, 'NASA');
    assert.equal(browser.location.hash, '');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('검색 초안 중 외부에서 같은 주소를 추가해도 다음 검색은 별도 이력이다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=NIST');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    const type = async value => act(async () => {
      Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: value }));
    });
    await type('NASA');
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    browser.history.pushState({ external: true }, '', browser.location.href);
    browser.navigation.currentEntry = { key: 'external-key', id: 'external-id' };
    const length = browser.history.length;
    await type('ESA');
    await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    assert.equal(browser.history.length, length + 1);
    assert.equal(new URL(browser.location.href).searchParams.get('q'), 'ESA');
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    assert.equal(input.value, 'NASA');
    assert.deepEqual(browser.history.state, { external: true });
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('이미 기록된 검색 초안을 원래 검색어로 되돌리면 같은 이력 항목이 남는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=NIST');
  const browser = globalThis.window;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, async () => ({ ok: true, json: async () => indexedRows }));
    const input = mounted.rootElement.querySelector('#react-posts-search-input');
    const length = browser.history.length;
    for (const value of ['NASA', 'NIST']) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new browser.InputEvent('input', { bubbles: true, data: value }));
      });
      await act(async () => new Promise(resolve => setTimeout(resolve, 280)));
    }
    assert.equal(browser.history.length, length + 1);
    await act(async () => {
      const popped = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
      browser.history.back();
      await popped;
    });
    assert.equal(input.value, 'NIST');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

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

for (const firstResult of ['failed', 'incomplete']) {
  test(`검색 색인 ${firstResult}에서는 요청한 페이지를 보존하고 복구 시 해당 페이지를 표시한다`, async () => {
    const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=2');
    const browser = globalThis.window;
    let resolveRetry;
    let attempt = 0;
    let mounted;
    try {
      mounted = await mountPostsApp(browser, posts, () => {
        attempt += 1;
        if (attempt === 1) return Promise.resolve(firstResult === 'failed'
          ? { ok: false, status: 503 }
          : { ok: true, json: async () => indexedRows.slice(0, 2) });
        return new Promise(resolve => { resolveRetry = resolve; });
      });
      assert.equal(new URL(browser.location.href).searchParams.get('page'), '2', '부분 결과로 공유 주소를 덮어쓰지 않는다');
      assert.match(mounted.rootElement.querySelector('#react-posts-page-fallback-status')?.textContent || '', /2페이지.*1페이지/);
      assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 2);
      await act(async () => mounted.rootElement.querySelector('#react-posts-retry-search-index').click());
      assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
      await act(async () => { resolveRetry({ ok: true, json: async () => indexedRows }); await Promise.resolve(); });
      assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
      assert.equal(mounted.rootElement.querySelector('a[aria-current="page"]')?.getAttribute('aria-label'), '2페이지');
      assert.equal(mounted.rootElement.querySelectorAll('#react-posts-list .post-preview').length, 2);
      assert.equal(mounted.rootElement.querySelector('#react-posts-page-fallback-status'), null);
    } finally {
      if (mounted) await act(async () => mounted.root.unmount());
      await cleanup();
    }
  });
}

test('부분 검색에서 사용자가 표시된 페이지를 선택하면 재시도 후에도 선택을 유지한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=2');
  const browser = globalThis.window;
  let resolveRetry;
  let attempt = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, () => ++attempt === 1
      ? Promise.resolve({ ok: false, status: 503 })
      : new Promise(resolve => { resolveRetry = resolve; }));
    await act(async () => mounted.rootElement.querySelector('#react-posts-retry-search-index').click());
    await act(async () => mounted.rootElement.querySelector('#react-posts-use-partial-page').click());
    assert.equal(new URL(browser.location.href).searchParams.has('page'), false);
    await act(async () => { resolveRetry({ ok: true, json: async () => indexedRows }); await Promise.resolve(); });
    assert.equal(new URL(browser.location.href).searchParams.has('page'), false);
    assert.equal(mounted.rootElement.querySelector('a[aria-current="page"]')?.getAttribute('aria-label'), '1페이지');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('완전한 색인에 요청 페이지가 없으면 실제 마지막 페이지로 보정한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=99');
  const browser = globalThis.window;
  let resolveFetch;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, () => new Promise(resolve => { resolveFetch = resolve; }));
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '99');
    await act(async () => { resolveFetch({ ok: true, json: async () => indexedRows }); await Promise.resolve(); });
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
    assert.equal(mounted.rootElement.querySelector('a[aria-current="page"]')?.getAttribute('aria-label'), '2페이지');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('부분 검색이 다른 페이지를 표시하면 저장된 요청 페이지 위치로 이동하지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=2');
  const browser = globalThis.window;
  const scroll = installScrollHarness(browser, 900);
  let resolveRetry;
  let attempt = 0;
  let mounted;
  try {
    writeStoredState(browser, { page: 2 });
    mounted = await mountPostsApp(browser, posts, () => ++attempt === 1
      ? Promise.resolve({ ok: false, status: 503 })
      : new Promise(resolve => { resolveRetry = resolve; }));
    assert.equal(restoreButton(mounted)?.getAttribute('aria-disabled'), 'true');
    await act(async () => restoreButton(mounted).click());
    assert.deepEqual(scroll.calls, []);
    await act(async () => mounted.rootElement.querySelector('#react-posts-retry-search-index').click());
    await act(async () => { resolveRetry({ ok: true, json: async () => indexedRows }); await Promise.resolve(); });
    assert.equal(restoreButton(mounted)?.getAttribute('aria-disabled'), null);
    await act(async () => restoreButton(mounted).click());
    assert.deepEqual(scroll.calls, [600]);
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('재시도 중 사용자가 주제를 변경하면 원래 페이지가 되살아나지 않는다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=2');
  const browser = globalThis.window;
  let resolveRetry;
  let attempt = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, () => ++attempt === 1
      ? Promise.resolve({ ok: false, status: 503 })
      : new Promise(resolve => { resolveRetry = resolve; }));
    await act(async () => mounted.rootElement.querySelector('#react-posts-retry-search-index').click());
    const category = mounted.rootElement.querySelector('#react-posts-category-select');
    await act(async () => {
      category.value = 'mathematics_philosophy_history';
      category.dispatchEvent(new browser.Event('change', { bubbles: true }));
    });
    await act(async () => { resolveRetry({ ok: true, json: async () => indexedRows }); await Promise.resolve(); });
    const url = new URL(browser.location.href);
    assert.equal(url.searchParams.get('category'), 'mathematics_philosophy_history');
    assert.equal(url.searchParams.has('page'), false);
    assert.equal(mounted.rootElement.querySelector('a[aria-current="page"]')?.getAttribute('aria-label'), '1페이지');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('재시도 중 이력 이동한 경우 현재 이력의 페이지를 전체 색인으로 검증한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=2');
  const browser = globalThis.window;
  let resolveRetry;
  let attempt = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, () => ++attempt === 1
      ? Promise.resolve({ ok: false, status: 503 })
      : new Promise(resolve => { resolveRetry = resolve; }));
    await act(async () => mounted.rootElement.querySelector('#react-posts-retry-search-index').click());
    await act(async () => {
      browser.history.pushState({}, '', '/posts/?q=needle&page=99');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    });
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '99');
    await act(async () => { resolveRetry({ ok: true, json: async () => indexedRows }); await Promise.resolve(); });
    assert.equal(new URL(browser.location.href).searchParams.get('page'), '2');
    assert.equal(mounted.rootElement.querySelector('a[aria-current="page"]')?.getAttribute('aria-label'), '2페이지');
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

test('재시도 성공으로 임시 페이지 선택 버튼이 사라지면 포커스를 복구한다', async () => {
  const cleanup = installBrowser('https://blog.test/posts/?q=needle&page=2');
  const browser = globalThis.window;
  let resolveRetry;
  let attempt = 0;
  let mounted;
  try {
    mounted = await mountPostsApp(browser, posts, () => ++attempt === 1
      ? Promise.resolve({ ok: false, status: 503 })
      : new Promise(resolve => { resolveRetry = resolve; }));
    await act(async () => mounted.rootElement.querySelector('#react-posts-retry-search-index').click());
    const fallbackPage = mounted.rootElement.querySelector('#react-posts-use-partial-page');
    fallbackPage.focus();
    await act(async () => { resolveRetry({ ok: true, json: async () => indexedRows }); await Promise.resolve(); });
    assert.equal(fallbackPage.isConnected, false);
    assert.equal(browser.document.activeElement, mounted.rootElement.querySelector('#react-posts-search-input'));
  } finally {
    if (mounted) await act(async () => mounted.root.unmount());
    await cleanup();
  }
});

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
