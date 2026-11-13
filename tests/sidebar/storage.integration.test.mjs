import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const script = await readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8');

function setup(storage) {
  const browser = new Window({ url: 'https://blog.test/' });
  browser.document.body.innerHTML = `
    <a class="skip-link" href="#main-content">skip</a>
    <button class="sidebar-toggle" aria-expanded="false" aria-controls="site-sidebar">menu</button>
    <aside id="site-sidebar" class="sidebar-right" tabindex="-1"><a href="/about/">about</a></aside>
    <main class="content-wrapper"><a href="/posts/">posts</a></main>`;
  Object.defineProperty(browser, 'localStorage', { configurable: true, get: storage });
  const media = { matches: true, addEventListener(_event, handler) { this.onChange = handler; } };
  browser.matchMedia = () => media;
  browser.eval(script);
  if (browser.document.readyState === 'loading') browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
  return { browser, media };
}

test('blocked storage read keeps the mobile drawer initialized and operable', async () => {
  const { browser, media } = setup(() => { throw new Error('SecurityError'); });
  try {
    const doc = browser.document;
    const sidebar = doc.querySelector('.sidebar-right');
    const toggle = doc.querySelector('.sidebar-toggle');
    const content = doc.querySelector('.content-wrapper');
    assert.equal(sidebar.classList.contains('sidebar-collapsed'), true);
    assert.equal(sidebar.getAttribute('aria-hidden'), 'true');
    assert.equal(sidebar.inert, true);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(sidebar.inert, false);
    assert.equal(content.inert, true);
    assert.equal(doc.body.classList.contains('sidebar-modal-open'), true);
    doc.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(sidebar.inert, true);
    assert.equal(content.inert, false);
    assert.ok(doc.activeElement === toggle);
    media.matches = false;
    media.onChange();
    assert.equal(sidebar.classList.contains('sidebar-collapsed'), false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(sidebar.inert, false);
    assert.equal(content.inert, false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('blocked storage writes do not interrupt opening, closing or focus restoration', async () => {
  const { browser } = setup(() => ({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } }));
  try {
    const doc = browser.document;
    const sidebar = doc.querySelector('.sidebar-right');
    const toggle = doc.querySelector('.sidebar-toggle');
    const content = doc.querySelector('.content-wrapper');
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(sidebar.inert, false);
    assert.equal(content.inert, true);
    doc.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(sidebar.inert, true);
    assert.equal(content.inert, false);
    assert.ok(doc.activeElement === toggle);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('mobile drawer keeps Tab and Shift+Tab inside its controls and restores focus on close', async () => {
  const { browser } = setup(() => ({ getItem: () => null, setItem() {} }));
  try {
    const doc = browser.document;
    const sidebar = doc.querySelector('.sidebar-right');
    const toggle = doc.querySelector('.sidebar-toggle');
    const first = sidebar.querySelector('a');
    const last = doc.createElement('a');
    last.href = '/tools/';
    last.textContent = 'tools';
    sidebar.append(last);
    // happy-dom has no layout; declare both links visible for this keyboard test.
    for (const link of [first, last]) {
      link.getBoundingClientRect = () => ({ width: 20, height: 20 });
    }
    const key = (shiftKey = false) => {
      const event = new browser.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      doc.activeElement.dispatchEvent(event);
      return event;
    };

    toggle.click();
    assert.equal(doc.activeElement, first);
    toggle.focus();
    assert.equal(key(true).defaultPrevented, true);
    assert.equal(doc.activeElement, last);
    assert.equal(key().defaultPrevented, true);
    assert.equal(doc.activeElement, toggle);
    first.focus();
    assert.equal(key().defaultPrevented, false); // native Tab handles the middle of the loop
    sidebar.focus();
    assert.equal(key().defaultPrevented, true);
    assert.equal(doc.activeElement, toggle);

    doc.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(doc.activeElement, toggle);
    assert.equal(doc.querySelector('.content-wrapper').inert, false);
    assert.equal(key(true).defaultPrevented, false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('이미 처리됐거나 한글 조합 중인 Tab은 메뉴 포커스 순환이 가로채지 않는다', async () => {
  const { browser } = setup(() => ({ getItem: () => null, setItem() {} }));
  try {
    const doc = browser.document;
    const toggle = doc.querySelector('.sidebar-toggle');
    const link = doc.querySelector('.sidebar-right a');
    link.getBoundingClientRect = () => ({ width: 20, height: 20 });
    toggle.click();
    for (const [target, shiftKey] of [[toggle, true], [link, false]]) {
      for (const mode of ['handled', 'isComposing', 'keyCode']) {
        target.focus();
        const event = new browser.KeyboardEvent('keydown', {
          key: 'Tab', shiftKey, bubbles: true, cancelable: true, isComposing: mode === 'isComposing',
        });
        if (mode === 'handled') event.preventDefault();
        if (mode === 'keyCode') Object.defineProperty(event, 'keyCode', { value: 229 });
        target.dispatchEvent(event);
        assert.equal(event.defaultPrevented, mode === 'handled', `${mode}: 기본 처리 상태 유지`);
        assert.ok(doc.activeElement === target, `${mode}: 포커스를 이동하지 않는다`);
      }
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('수정 키가 포함되거나 이미 처리된 Escape는 모바일 메뉴를 닫지 않는다', async () => {
  const { browser } = setup(() => ({ getItem: () => null, setItem() {} }));
  try {
    const doc = browser.document;
    const toggle = doc.querySelector('.sidebar-toggle');
    toggle.click();
    const focused = doc.activeElement;
    for (const modifier of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'handled']) {
      const options = { key: 'Escape', bubbles: true, cancelable: true };
      if (modifier !== 'handled') options[modifier] = true;
      const event = new browser.KeyboardEvent('keydown', options);
      if (modifier === 'handled') event.preventDefault();
      focused.dispatchEvent(event);
      assert.equal(event.defaultPrevented, modifier === 'handled', `${modifier}: 처리 상태 유지`);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true', `${modifier}: 메뉴 열림 유지`);
      assert.ok(doc.activeElement === focused, `${modifier}: 포커스 유지`);
    }
    focused.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.ok(doc.activeElement === toggle);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('Escape during IME composition leaves the mobile drawer open', async () => {
  const { browser } = setup(() => ({ getItem: () => null, setItem() {} }));
  try {
    const doc = browser.document;
    const toggle = doc.querySelector('.sidebar-toggle');
    toggle.click();
    doc.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }));
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    const legacyEvent = new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    Object.defineProperty(legacyEvent, 'keyCode', { value: 229 });
    doc.dispatchEvent(legacyEvent);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    doc.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('open drawer hides the skip link and restores its previous state on close or desktop transition', async () => {
  const { browser, media } = setup(() => ({ getItem: () => null, setItem() {} }));
  try {
    const doc = browser.document;
    const skip = doc.querySelector('.skip-link');
    const toggle = doc.querySelector('.sidebar-toggle');
    assert.equal(skip.inert, false);
    toggle.click();
    assert.equal(skip.inert, true);
    assert.equal(skip.getAttribute('aria-hidden'), 'true');
    toggle.click();
    assert.equal(skip.inert, false);
    assert.equal(skip.hasAttribute('aria-hidden'), false);

    skip.setAttribute('aria-hidden', 'false');
    toggle.click();
    media.matches = false;
    media.onChange();
    assert.equal(skip.inert, false);
    assert.equal(skip.getAttribute('aria-hidden'), 'false');
    assert.equal(doc.querySelector('.content-wrapper').inert, false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('restoring an open mobile drawer moves initial focus out of the inert background', async () => {
  const { browser, media } = setup(() => ({ getItem: () => 'false', setItem() {} }));
  try {
    const doc = browser.document;
    const sidebar = doc.querySelector('.sidebar-right');
    assert.equal(doc.querySelector('.content-wrapper').inert, true);
    assert.equal(doc.querySelector('.skip-link').inert, true);
    // happy-dom has no layout, so the focusable aside is the fallback.
    assert.equal(doc.activeElement, sidebar);
    media.matches = false;
    media.onChange();
    const contentLink = doc.querySelector('.content-wrapper a');
    contentLink.focus();
    media.matches = true;
    media.onChange();
    assert.equal(doc.activeElement, sidebar);
    assert.equal(doc.querySelector('.skip-link').inert, true);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('switching to desktop moves a focused mobile toggle to the visible sidebar without stealing other focus', async () => {
  const { browser, media } = setup(() => ({ getItem: () => null, setItem() {} }));
  try {
    const doc = browser.document;
    const toggle = doc.querySelector('.sidebar-toggle');
    const sidebar = doc.querySelector('.sidebar-right');
    const link = sidebar.querySelector('a');
    link.getBoundingClientRect = () => ({ width: 20, height: 20 });

    // A closed drawer and its focused toggle both change visibility at the breakpoint.
    toggle.focus();
    media.matches = false;
    media.onChange();
    assert.equal(sidebar.inert, false);
    assert.equal(doc.activeElement, link);

    // When another control has focus, switching sizes must not move it.
    const contentLink = doc.querySelector('.content-wrapper a');
    contentLink.focus();
    media.matches = true;
    media.onChange();
    media.matches = false;
    media.onChange();
    assert.equal(doc.activeElement, contentLink);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('switching to a collapsed mobile drawer moves sidebar focus to the toggle without stealing other focus', async () => {
  const { browser, media } = setup(() => ({ getItem: () => 'true', setItem() {} }));
  try {
    const doc = browser.document;
    const sidebar = doc.querySelector('.sidebar-right');
    const toggle = doc.querySelector('.sidebar-toggle');
    const sidebarLink = sidebar.querySelector('a');
    const contentLink = doc.querySelector('.content-wrapper a');

    media.matches = false;
    media.onChange();
    sidebarLink.focus();
    assert.equal(doc.activeElement, sidebarLink);
    media.matches = true;
    media.onChange();
    assert.equal(doc.activeElement, toggle);
    assert.equal(sidebar.inert, true);
    assert.equal(sidebar.getAttribute('aria-hidden'), 'true');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');

    media.matches = false;
    media.onChange();
    contentLink.focus();
    media.matches = true;
    media.onChange();
    assert.equal(doc.activeElement, contentLink);
    assert.equal(sidebar.inert, true);
  } finally {
    await browser.happyDOM.abort();
  }
});
