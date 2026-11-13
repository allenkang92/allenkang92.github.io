import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const css = await readFile(new URL('../../assets/css/sidebar-toggle.css', import.meta.url), 'utf8');
const script = await readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8');
const siteStyles = await Promise.all(
  ['main', 'search', 'sidebar-toggle', 'theme-atlas', 'reading-refinement', 'nav-refinement']
    .map(name => readFile(new URL(`../../assets/css/${name}.css`, import.meta.url), 'utf8'))
);

function toggleDisplay(width, enhanced) {
  const browser = new Window();
  browser.happyDOM.setWindowSize({ width, height: 844 });
  if (enhanced) browser.document.documentElement.classList.add('sidebar-enhanced');
  browser.document.head.innerHTML = `<style>${css}</style>`;
  browser.document.body.innerHTML = '<button class="sidebar-toggle">메뉴 열기</button>';
  const display = browser.getComputedStyle(browser.document.querySelector('button')).display;
  browser.close();
  return display;
}

test('the mobile menu control is available only after JavaScript enhancement', () => {
  assert.equal(toggleDisplay(390, false), 'none');
  assert.equal(toggleDisplay(390, true), 'flex');
  assert.equal(toggleDisplay(1024, false), 'none');
  assert.equal(toggleDisplay(1024, true), 'none');
});

test('without JavaScript the mobile navigation remains in normal document flow', () => {
  const browser = new Window();
  browser.happyDOM.setWindowSize({ width: 390, height: 844 });
  for (const style of siteStyles) browser.document.head.insertAdjacentHTML('beforeend', `<style>${style}</style>`);
  browser.document.body.innerHTML = '<aside class="sidebar-right"><a href="/posts/">글</a></aside>';
  const sidebar = browser.document.querySelector('aside');
  assert.equal(browser.getComputedStyle(sidebar).position, 'static');
  assert.notEqual(browser.getComputedStyle(sidebar).display, 'none');
  assert.equal(sidebar.querySelector('a').getAttribute('href'), '/posts/');
  browser.close();
});

test('sidebar enhancement keeps static navigation when matchMedia is unavailable or fails', async () => {
  for (const matchMedia of [undefined, () => { throw new Error('matchMedia failed'); }, () => ({ matches: true })]) {
    const browser = new Window({ url: 'https://blog.test/' });
    browser.happyDOM.setWindowSize({ width: 390, height: 844 });
    for (const style of siteStyles) browser.document.head.insertAdjacentHTML('beforeend', `<style>${style}</style>`);
    browser.document.body.innerHTML = '<button class="sidebar-toggle">메뉴 열기</button><aside class="sidebar-right"><a href="/posts/">글</a></aside><main class="content-wrapper">본문</main>';
    browser.matchMedia = matchMedia;
    try {
      assert.doesNotThrow(() => {
        browser.eval(script);
        if (browser.document.readyState === 'loading') browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
      });
      const sidebar = browser.document.querySelector('aside');
      assert.equal(browser.document.documentElement.classList.contains('sidebar-enhanced'), false);
      assert.equal(browser.getComputedStyle(sidebar).position, 'static');
      assert.equal(browser.getComputedStyle(browser.document.querySelector('button')).display, 'none');
      assert.notEqual(sidebar.inert, true);
      assert.notEqual(sidebar.getAttribute('aria-hidden'), 'true');
    } finally { await browser.happyDOM.abort(); }
  }
});

test('sidebar enhancement is not enabled when a required control is missing', async () => {
  for (const markup of ['<aside class="sidebar-right"><a href="/posts/">글</a></aside>', '<button class="sidebar-toggle">메뉴 열기</button>']) {
    const browser = new Window({ url: 'https://blog.test/' });
    browser.document.body.innerHTML = `${markup}<main class="content-wrapper">본문</main>`;
    browser.matchMedia = () => ({ matches: true, addEventListener() {} });
    try {
      browser.eval(script);
      if (browser.document.readyState === 'loading') browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
      assert.equal(browser.document.documentElement.classList.contains('sidebar-enhanced'), false);
      assert.notEqual(browser.document.querySelector('.sidebar-right')?.inert, true);
    } finally { await browser.happyDOM.abort(); }
  }
});

test('failed media listener registration leaves keyboard navigation unchanged', async () => {
  const browser = new Window({ url: 'https://blog.test/' });
  browser.document.body.innerHTML = '<button class="sidebar-toggle">메뉴 열기</button><aside class="sidebar-right"><a href="/posts/">글</a></aside><main class="content-wrapper"><a href="/about/">본문 링크</a></main>';
  browser.matchMedia = () => ({ matches: true, addEventListener() { throw new Error('listener failed'); } });
  try {
    assert.doesNotThrow(() => {
      browser.eval(script);
      if (browser.document.readyState === 'loading') browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
    });
    const link = browser.document.querySelector('main a');
    link.focus();
    const event = new browser.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(browser.document.activeElement, link);
    assert.equal(browser.document.documentElement.classList.contains('sidebar-enhanced'), false);
  } finally { await browser.happyDOM.abort(); }
});
