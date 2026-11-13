import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const sidebarScript = await readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8');
const searchScript = await readFile(new URL('../../assets/js/simple-search.js', import.meta.url), 'utf8');

function setup(fetchImpl, storage, mobile = true) {
  const browser = new Window({ url: 'https://blog.test/about/' });
  browser.document.body.innerHTML = `
    <button class="sidebar-toggle" type="button">menu</button>
    <aside class="sidebar-right" tabindex="-1"><div id="search-container">
      <form class="search-form" action="/posts/" method="get" data-search-url="/search.json" data-expected-post-paths='["/physics/"]' data-expected-page-paths='[]'>
        <input id="search-input" name="q"><button class="search-button" type="submit">검색</button>
        <div class="search-spinner"></div>
      </form>
      <div id="search-status"></div><div id="search-results"></div>
    </div></aside><main class="content-wrapper"></main>`;
  Object.defineProperty(browser, 'localStorage', { configurable: true, get: () => storage });
  browser.matchMedia = () => ({ matches: mobile, addEventListener() {} });
  browser.fetch = fetchImpl;
  browser.console.error = () => {};
  browser.eval(searchScript);
  browser.eval(sidebarScript);
  if (browser.document.readyState === 'loading') {
    browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
  }
  return browser;
}

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('unhandled search submission closes the mobile drawer for the next page without canceling the form', async () => {
  const storage = createStorage();
  const browser = setup(() => new Promise(() => {}), storage);
  try {
    const doc = browser.document;
    const toggle = doc.querySelector('.sidebar-toggle');
    const form = doc.querySelector('.search-form');
    toggle.click();
    doc.querySelector('#search-input').value = '물리';
    assert.equal(storage.getItem('sidebarCollapsed'), 'false');
    const event = new browser.Event('submit', { bubbles: true, cancelable: true });
    assert.equal(form.dispatchEvent(event), true);
    assert.equal(event.defaultPrevented, false);
    assert.equal(new browser.FormData(form).get('q'), '물리');
    assert.equal(storage.getItem('sidebarCollapsed'), 'false', 'the drawer stays open until navigation');
    browser.dispatchEvent(new browser.Event('pagehide'));
    assert.equal(storage.getItem('sidebarCollapsed'), 'true');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(doc.querySelector('.content-wrapper').inert, false);

    const nextPage = setup(() => new Promise(() => {}), storage);
    try {
      assert.equal(nextPage.document.querySelector('.sidebar-toggle').getAttribute('aria-expanded'), 'false');
      assert.equal(nextPage.document.querySelector('.content-wrapper').inert, false);
    } finally {
      await nextPage.happyDOM.abort();
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('intercepted search and composition submission keep the mobile drawer open', async () => {
  for (const composing of [false, true]) {
    const storage = createStorage();
    const browser = setup(async () => ({ ok: true, json: async () => [{
      title: '물리', url: '/physics/', type: 'post', category: 'science', tags: [],
      description: '', content: '물리 본문', date: '2024-09-09',
    }] }), storage);
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const doc = browser.document;
      const toggle = doc.querySelector('.sidebar-toggle');
      const input = doc.querySelector('#search-input');
      toggle.click();
      input.value = '물리';
      if (composing) input.dispatchEvent(new browser.CompositionEvent('compositionstart', { bubbles: true }));
      const event = new browser.Event('submit', { bubbles: true, cancelable: true });
      assert.equal(doc.querySelector('.search-form').dispatchEvent(event), false);
      browser.dispatchEvent(new browser.Event('pagehide'));
      assert.equal(event.defaultPrevented, true);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(storage.getItem('sidebarCollapsed'), 'false');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('a later submit cancellation and desktop submission do not change saved sidebar state', async () => {
  for (const mobile of [true, false]) {
    const storage = createStorage();
    const browser = setup(() => new Promise(() => {}), storage, mobile);
    try {
      const doc = browser.document;
      if (mobile) doc.querySelector('.sidebar-toggle').click();
      else storage.setItem('sidebarCollapsed', 'false');
      if (mobile) browser.addEventListener('submit', event => event.preventDefault());
      const event = new browser.Event('submit', { bubbles: true, cancelable: true });
      assert.equal(doc.querySelector('.search-form').dispatchEvent(event), !mobile);
      browser.dispatchEvent(new browser.Event('pagehide'));
      assert.equal(storage.getItem('sidebarCollapsed'), 'false');
      assert.equal(doc.querySelector('.sidebar-toggle').getAttribute('aria-expanded'), 'true');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});
