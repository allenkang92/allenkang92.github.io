import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const searchScript = await readFile(new URL('../../assets/js/simple-search.js', import.meta.url), 'utf8');
const sidebarScript = await readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8');

function setup(fetchImpl, url = 'https://blog.test/about/') {
  const browser = new Window({ url });
  browser.document.body.innerHTML = `
    <button class="sidebar-toggle" type="button"></button>
    <aside class="sidebar-right"><div id="search-container">
      <form class="search-form" action="/posts/" method="get" data-search-url="/search.json">
        <input id="search-input" name="q"><button class="search-button" type="submit">검색</button>
      </form>
      <div id="search-status"></div><div id="search-results"></div>
    </div></aside><main class="content-wrapper"></main>`;
  browser.matchMedia = () => ({ matches: true, addEventListener() {} });
  browser.fetch = fetchImpl;
  browser.console.error = () => {};
  browser.eval(searchScript);
  browser.eval(sidebarScript);
  if (browser.document.readyState === 'loading') {
    browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
  }
  return browser;
}

test('index failure leaves the search form available for native posts-page submission', async () => {
  const browser = setup(async () => { throw new Error('offline'); });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const document = browser.document;
    assert.match(document.querySelector('#search-results').textContent, /글 목록에서 검색/);
    document.querySelector('#search-input').value = '물리';
    const form = document.querySelector('.search-form');
    const submit = new browser.Event('submit', { bubbles: true, cancelable: true });
    assert.equal(form.dispatchEvent(submit), true);
    assert.equal(form.action, 'https://blog.test/posts/');
    assert.equal(new browser.FormData(form).get('q'), '물리');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('a delayed index does not overwrite edits or a cleared URL query', async () => {
  for (const currentQuery of ['새 검색어', '']) {
    let resolveFetch;
    const browser = setup(() => new Promise(resolve => { resolveFetch = resolve; }), 'https://blog.test/about/?q=이전');
    try {
      const input = browser.document.querySelector('#search-input');
      assert.equal(input.value, '이전');
      input.value = currentQuery;
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      resolveFetch({ ok: true, json: async () => [{ title: '새 검색어', content: '', url: '/post/' }] });
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(input.value, currentQuery);
      if (!currentQuery) assert.equal(browser.document.querySelector('#search-results').classList.contains('active'), false);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('native submission remains available while the index is loading, then search takes over', async () => {
  let resolveFetch;
  const browser = setup(() => new Promise(resolve => { resolveFetch = resolve; }));
  try {
    const form = browser.document.querySelector('.search-form');
    browser.document.querySelector('#search-input').value = '물리';
    const submit = () => form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(submit(), true);
    resolveFetch({ ok: true, json: async () => [{ title: '물리', content: '', url: '/posts/physics/' }] });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(submit(), false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('clearing the input prevents an already scheduled search from restoring results and query', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [{ title: '물리', content: '', url: '/posts/physics/' }] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    input.value = '물리';
    browser.searchFunctions.performSearch('물리');
    assert.equal(frames.length, 1);
    input.value = '';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    frames[0]();
    assert.equal(browser.document.querySelector('#search-results').classList.contains('active'), false);
    assert.equal(new URL(browser.location.href).searchParams.has('q'), false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('Escape closes search results first and closes the mobile sidebar on the next press', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [{ title: '물리', content: '', url: '/posts/physics/' }] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const document = browser.document;
    const sidebar = document.querySelector('.sidebar-right');
    const toggle = document.querySelector('.sidebar-toggle');
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    const input = document.querySelector('#search-input');
    const results = document.querySelector('#search-results');
    input.focus();
    results.classList.add('active');
    input.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(results.classList.contains('active'), false);
    assert.equal(sidebar.classList.contains('sidebar-collapsed'), false);
    assert.equal(document.activeElement, input);
    input.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(sidebar.classList.contains('sidebar-collapsed'), true);
    assert.equal(document.activeElement, toggle);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('Escape from a result link returns focus without reopening the results', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [{ title: '물리', content: '', url: '/posts/physics/' }] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    browser.document.querySelector('.sidebar-toggle').click();
    input.value = '물리';
    browser.searchFunctions.performSearch('물리');
    frames[0]();
    const link = results.querySelector('a');
    assert.ok(link);
    link.focus();
    link.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.ok(browser.document.activeElement === input, 'Escape should return focus to the search input');
    assert.equal(results.classList.contains('active'), false);
    assert.equal(frames.length, 1);
    input.blur();
    input.focus();
    assert.equal(results.classList.contains('active'), true);
  } finally {
    await browser.happyDOM.abort();
  }
});
