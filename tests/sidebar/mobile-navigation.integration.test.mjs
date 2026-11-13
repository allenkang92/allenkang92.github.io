import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const layout = await readFile(new URL('../../_layouts/default.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8');
const styles = await Promise.all(
  ['main', 'search', 'sidebar-toggle', 'theme-atlas', 'reading-refinement', 'nav-refinement']
    .map(name => readFile(new URL(`../../assets/css/${name}.css`, import.meta.url), 'utf8'))
);
const navigationMarkup = layout.match(/<div class="mobile-navigation"[^>]*>[\s\S]*?<\/div>/)?.[0];
assert.ok(navigationMarkup, '기본 레이아웃에 모바일 메뉴 영역이 있어야 합니다');

function createPage(width, height, enhanced = true) {
  const browser = new Window({ url: 'https://blog.test/' });
  browser.happyDOM.setWindowSize({ width, height });
  if (enhanced) browser.document.documentElement.classList.add('sidebar-enhanced');
  for (const style of styles) browser.document.head.insertAdjacentHTML('beforeend', `<style>${style}</style>`);
  browser.document.body.innerHTML = `
    <a href="#main-content" class="skip-link">본문으로</a>
    ${navigationMarkup}
    <div class="layout-container">
      <aside id="site-sidebar" class="sidebar-right"><a href="/posts/">글</a></aside>
      <main id="main-content" class="content-wrapper"><h1>제목</h1></main>
    </div>`;
  return browser;
}

test('모바일에서 메뉴는 별도의 불투명 고정 영역에 있고 이동 여백은 그 높이 이상이다', () => {
  for (const width of [320, 390]) {
    const browser = createPage(width, 568);
    const nav = browser.document.querySelector('.mobile-navigation');
    const toggle = browser.document.querySelector('.sidebar-toggle');
    const navStyle = browser.getComputedStyle(nav);
    assert.equal(navStyle.display, 'flex');
    assert.equal(navStyle.position, 'fixed');
    assert.ok(parseFloat(navStyle.height) >= 44);
    assert.equal(browser.getComputedStyle(toggle).width, '44px');
    assert.equal(browser.getComputedStyle(toggle).height, '44px');
    assert.equal(browser.getComputedStyle(browser.document.querySelector('.layout-container')).paddingTop, navStyle.height);
    assert.ok(parseFloat(browser.getComputedStyle(browser.document.documentElement).scrollPaddingTop) >= parseFloat(navStyle.height));
    assert.equal(browser.getComputedStyle(browser.document.querySelector('.sidebar-right')).scrollPaddingTop, `calc(${navStyle.height} + 6px)`);
    assert.equal(browser.getComputedStyle(browser.document.querySelector('.sidebar-right')).scrollPaddingBottom, '6px');
    const skip = browser.document.querySelector('.skip-link');
    skip.focus();
    assert.ok(Number(browser.getComputedStyle(skip).zIndex) > Number(navStyle.zIndex));
    browser.close();
  }
});

test('매우 낮은 창은 고정 영역을 해제하며 데스크톱과 비활성화 화면에는 메뉴 영역이 없다', () => {
  const short = createPage(320, 120);
  assert.equal(short.getComputedStyle(short.document.querySelector('.mobile-navigation')).position, 'static');
  assert.equal(short.getComputedStyle(short.document.documentElement).scrollPaddingTop, '0');
  assert.equal(short.getComputedStyle(short.document.querySelector('.sidebar-right')).scrollPaddingTop, 'calc(48px + 6px)');
  assert.equal(short.getComputedStyle(short.document.querySelector('.layout-container')).paddingTop, '0px');
  short.document.body.classList.add('sidebar-modal-open');
  assert.equal(short.getComputedStyle(short.document.querySelector('.mobile-navigation')).position, 'fixed');
  short.document.body.classList.remove('sidebar-modal-open');
  assert.equal(short.getComputedStyle(short.document.querySelector('.mobile-navigation')).position, 'static');
  short.close();
  for (const [width, enhanced] of [[1024, true], [390, false]]) {
    const browser = createPage(width, 844, enhanced);
    assert.equal(browser.getComputedStyle(browser.document.querySelector('.mobile-navigation')).display, 'none');
    browser.close();
  }
});

test('새 레이아웃은 이전 CSS에서 장식용 제목을 본문에 노출하지 않는다', () => {
  const browser = createPage(320, 568);
  const nav = browser.document.querySelector('.mobile-navigation');
  assert.equal(nav.textContent.trim(), '');
  assert.ok(nav.hasAttribute('data-site-title'));
  browser.close();
});

test('이전 HTML의 독립 메뉴 버튼은 새 스타일에서도 기존 고정 위치를 유지한다', () => {
  const browser = createPage(320, 568);
  const wrapper = browser.document.querySelector('.mobile-navigation');
  const toggle = wrapper.querySelector('.sidebar-toggle');
  wrapper.replaceWith(toggle);
  assert.equal(browser.getComputedStyle(toggle).position, 'fixed');
  assert.notEqual(browser.getComputedStyle(browser.document.querySelector('.layout-container')).paddingTop, '60px');
  browser.close();
});

test('새 영역 안의 메뉴 버튼도 사이드바를 열고 Escape로 닫으며 포커스를 되돌린다', async () => {
  const browser = createPage(390, 844, false);
  const media = { matches: true, addEventListener() {} };
  browser.matchMedia = () => media;
  const sidebar = browser.document.querySelector('.sidebar-right');
  const link = sidebar.querySelector('a');
  link.getBoundingClientRect = () => ({ width: 44, height: 44 });
  try {
    browser.eval(script);
    if (browser.document.readyState === 'loading') browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
    const toggle = browser.document.querySelector('.sidebar-toggle');
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(browser.document.querySelector('.content-wrapper').inert, true);
    browser.document.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(browser.document.querySelector('.content-wrapper').inert, false);
    assert.equal(browser.document.activeElement, toggle);
  } finally {
    await browser.happyDOM.abort();
  }
});
