import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const script = await readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8');

function setup(storage, mobile = true, url = 'https://blog.test/about/') {
  const browser = new Window({ url });
  browser.document.body.innerHTML = `
    <button class="sidebar-toggle" type="button">메뉴</button>
    <aside class="sidebar-right" tabindex="-1">
      <a id="link" href="/posts/">글</a>
    </aside>
    <main class="content-wrapper"></main>`;
  Object.defineProperty(browser, 'localStorage', { configurable: true, get: () => storage });
  browser.matchMedia = () => ({ matches: mobile, addEventListener() {} });
  browser.eval(script);
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

function click(browser, link, options = {}) {
  const event = new browser.MouseEvent('click', { bubbles: true, cancelable: true, ...options });
  link.dispatchEvent(event);
  return event;
}

test('현재 탭 이동 시에만 메뉴를 닫고 돌아올 때 접힌 상태를 유지한다', async () => {
  const storage = createStorage();
  const browser = setup(storage);
  try {
    const doc = browser.document;
    const toggle = doc.querySelector('.sidebar-toggle');
    toggle.click();
    const event = click(browser, doc.querySelector('#link'));
    assert.equal(event.defaultPrevented, false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(storage.getItem('sidebarCollapsed'), 'false');
    browser.dispatchEvent(new browser.Event('pagehide'));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(storage.getItem('sidebarCollapsed'), 'true');
    assert.equal(doc.querySelector('.content-wrapper').inert, false);
    assert.equal(doc.activeElement, toggle);
    browser.dispatchEvent(new browser.Event('pageshow'));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');

    const nextPage = setup(storage);
    try {
      assert.equal(nextPage.document.querySelector('.sidebar-toggle').getAttribute('aria-expanded'), 'false');
    } finally {
      await nextPage.happyDOM.abort();
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('새 탭과 보조 클릭, 다운로드, 같은 문서 내 이동은 메뉴를 유지한다', async () => {
  for (const scenario of [
    { target: '_blank' }, { target: 'other-frame' },
    { options: { ctrlKey: true } }, { options: { metaKey: true } },
    { options: { shiftKey: true } }, { options: { altKey: true } },
    { options: { button: 1 } }, { download: true },
    { href: '#section' }, { href: 'https://blog.test/about/#section' },
    { href: 'https://blog.test/about/#' },
  ]) {
    const storage = createStorage();
    const browser = setup(storage);
    try {
      const doc = browser.document;
      const toggle = doc.querySelector('.sidebar-toggle');
      const link = doc.querySelector('#link');
      if (scenario.target) link.target = scenario.target;
      if (scenario.href) link.href = scenario.href;
      if (scenario.download) link.setAttribute('download', '');
      toggle.click();
      link.focus();
      click(browser, link, scenario.options);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true', JSON.stringify(scenario));
      assert.equal(doc.activeElement, link, JSON.stringify(scenario));
      browser.dispatchEvent(new browser.Event('pagehide'));
      assert.equal(toggle.getAttribute('aria-expanded'), 'true', JSON.stringify(scenario));
      assert.equal(storage.getItem('sidebarCollapsed'), 'false', JSON.stringify(scenario));
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('같은 문서의 절대 주소에서 빈 조각도 이동 대기로 남기지 않는다', async () => {
  for (const current of ['https://blog.test/about/', 'https://blog.test/about/#section']) {
    const storage = createStorage();
    const browser = setup(storage, true, current);
    try {
      const doc = browser.document;
      const toggle = doc.querySelector('.sidebar-toggle');
      toggle.click();
      const link = doc.querySelector('#link');
      link.href = 'https://blog.test/about/#';
      click(browser, link);
      browser.dispatchEvent(new browser.Event('pagehide'));
      assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(storage.getItem('sidebarCollapsed'), 'false');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('조각 없는 동일 주소 재방문과 조각 제거는 페이지 이탈을 기다린다', async () => {
  for (const current of ['https://blog.test/about/', 'https://blog.test/about/#section']) {
    const storage = createStorage();
    const browser = setup(storage, true, current);
    try {
      const doc = browser.document;
      const toggle = doc.querySelector('.sidebar-toggle');
      toggle.click();
      const link = doc.querySelector('#link');
      link.href = 'https://blog.test/about/';
      click(browser, link);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      browser.dispatchEvent(new browser.Event('pagehide'));
      assert.equal(toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(storage.getItem('sidebarCollapsed'), 'true');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('뒤에 등록된 핸들러가 클릭을 취소하면 페이지가 숨겨져도 메뉴를 유지한다', async () => {
  const storage = createStorage();
  const browser = setup(storage);
  try {
    const doc = browser.document;
    const toggle = doc.querySelector('.sidebar-toggle');
    toggle.click();
    browser.addEventListener('click', event => event.preventDefault());
    const event = click(browser, doc.querySelector('#link'));
    assert.equal(event.defaultPrevented, true);
    browser.dispatchEvent(new browser.Event('pagehide'));
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(storage.getItem('sidebarCollapsed'), 'false');
  } finally {
    await browser.happyDOM.abort();
  }
});
