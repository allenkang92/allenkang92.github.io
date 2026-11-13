import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const script = await readFile(new URL('../../assets/js/code-copy.js', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../../assets/css/code-copy.css', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup(clipboard, layout, configure) {
  const browser = new Window({ url: 'https://blog.test/posts/example/' });
  const frames = [];
  const resizeObservers = [];
  browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  browser.ResizeObserver = class {
    constructor(callback) { this.callback = callback; resizeObservers.push(this); }
    observe() {}
  };
  const fonts = new browser.EventTarget();
  fonts.ready = Promise.resolve(fonts);
  Object.defineProperty(browser.document, 'fonts', { configurable: true, value: fonts });
  browser.document.body.innerHTML = `<main id="post-content" class="post-content">
    <div class="language-html highlighter-rouge"><div class="highlight"><pre class="highlight"><code></code></pre></div></div>
    <div class="language-css highlighter-rouge"><div class="highlight"><pre class="highlight"><code></code></pre></div></div>
    <pre id="plain">일반 텍스트</pre>
    <div class="highlighter-rouge"><div class="highlight"><table><tr><td class="gutter"><pre>1</pre></td><td class="code"><pre><code>example</code></pre></td></tr></table></div></div>
    <code class="highlighter-rouge">인라인 코드</code>
  </main>`;
  const snippets = [...browser.document.querySelectorAll('pre.highlight > code')];
  snippets[0].textContent = '<p class="a">한글 & text</p>\n  들여쓰기\n';
  snippets[1].textContent = 'a { color: red; }\n';
  if (layout) {
    snippets.forEach((snippet, index) => {
      Object.defineProperty(snippet.parentElement, 'clientWidth', { configurable: true, get: () => layout[index].clientWidth });
      Object.defineProperty(snippet.parentElement, 'scrollWidth', { configurable: true, get: () => layout[index].scrollWidth });
    });
  }
  if (configure) configure(snippets);
  Object.defineProperty(browser.navigator, 'clipboard', { configurable: true, value: clipboard });
  browser.eval(script);
  if (browser.document.readyState === 'loading') browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
  return { browser, snippets, buttons: [...browser.document.querySelectorAll('.code-copy-button')], statuses: [...browser.document.querySelectorAll('.code-copy-status')], flushFrames: () => frames.splice(0).forEach(callback => callback()), notifyResizeObservers: () => resizeObservers.forEach(observer => observer.callback()) };
}

test('코드 블록만 구분 가능한 복사 버튼을 표시하며 원문과 포커스를 유지한다', async () => {
  const written = [];
  const { browser, snippets, buttons, statuses } = setup({ writeText: async value => written.push(value) });
  try {
    assert.equal(buttons.length, 2);
    assert.deepEqual(buttons.map(button => button.getAttribute('aria-label')), ['코드 복사, 1번째 예제', '코드 복사, 2번째 예제']);
    assert.equal(buttons[0].getAttribute('type'), 'button');
    assert.equal(buttons[0].getAttribute('aria-describedby'), statuses[0].id);
    assert.equal(statuses[0].getAttribute('role'), 'status');
    assert.equal(written.length, 0, '사용자 행동 전 클립보드에 쓰지 않는다');
    buttons[0].focus();
    buttons[0].click();
    await tick();
    assert.deepEqual(written, ['<p class="a">한글 & text</p>\n  들여쓰기\n']);
    assert.equal(snippets[0].textContent, written[0]);
    assert.equal(statuses[0].textContent, '코드를 복사했습니다.');
    assert.equal(statuses[1].textContent, '');
    assert.equal(browser.document.activeElement, buttons[0]);
    assert.equal(browser.document.querySelector('#plain').textContent, '일반 텍스트');
  } finally { await browser.happyDOM.abort(); }
});

test('작성자가 지정한 스크롤 영역 속성은 화면 크기가 바뀌어도 보존한다', async () => {
  const layout = [{ clientWidth: 300, scrollWidth: 600 }, { clientWidth: 300, scrollWidth: 200 }];
  const { browser, snippets, flushFrames } = setup({ writeText: async () => {} }, layout, codes => {
    codes[0].parentElement.setAttribute('tabindex', '0');
    codes[0].parentElement.setAttribute('role', 'article');
    codes[0].parentElement.setAttribute('aria-label', '사용자가 지정한 이름');
  });
  try {
    const pre = snippets[0].parentElement;
    assert.equal(pre.getAttribute('aria-label'), '사용자가 지정한 이름');
    layout[0].scrollWidth = 300;
    browser.dispatchEvent(new browser.Event('resize'));
    flushFrames();
    assert.equal(pre.getAttribute('tabindex'), '0');
    assert.equal(pre.getAttribute('role'), 'article');
    assert.equal(pre.getAttribute('aria-label'), '사용자가 지정한 이름');
  } finally { await browser.happyDOM.abort(); }
});

test('넘치는 코드만 이름 있는 키보드 스크롤 영역이 되고 화면 크기와 내용 변경을 반영한다', async () => {
  const layout = [{ clientWidth: 300, scrollWidth: 600 }, { clientWidth: 300, scrollWidth: 200 }];
  const { browser, snippets, buttons, flushFrames, notifyResizeObservers } = setup({ writeText: async () => {} }, layout);
  try {
    const [long, short] = snippets.map(snippet => snippet.parentElement);
    assert.equal(long.getAttribute('tabindex'), '0');
    assert.equal(long.getAttribute('role'), 'group');
    assert.equal(long.getAttribute('aria-label'), '1번째 코드 예제, 가로 스크롤 가능');
    assert.equal(short.hasAttribute('tabindex'), false);
    long.focus();
    assert.equal(browser.document.activeElement, long);
    buttons[0].focus();
    buttons[0].click();
    await tick();
    assert.equal(browser.document.activeElement, buttons[0]);

    layout[0].scrollWidth = 300;
    layout[1].scrollWidth = 450;
    browser.dispatchEvent(new browser.Event('resize'));
    flushFrames();
    assert.equal(long.hasAttribute('tabindex'), false);
    assert.equal(long.hasAttribute('role'), false);
    assert.equal(long.hasAttribute('aria-label'), false);
    assert.equal(short.getAttribute('tabindex'), '0');
    assert.equal(short.getAttribute('aria-label'), '2번째 코드 예제, 가로 스크롤 가능');
    assert.equal(short.getAttribute('role'), 'group');

    layout[1].scrollWidth = 250;
    snippets[1].textContent = '짧아진 코드';
    await tick();
    flushFrames();
    assert.equal(short.hasAttribute('tabindex'), false);
    assert.equal(short.hasAttribute('role'), false);
    assert.equal(short.hasAttribute('aria-label'), false);

    layout[0].scrollWidth = 350;
    notifyResizeObservers();
    flushFrames();
    assert.equal(long.getAttribute('role'), 'group');
    layout[0].scrollWidth = 300;
    browser.document.fonts.dispatchEvent(new browser.Event('loadingdone'));
    flushFrames();
    assert.equal(long.hasAttribute('role'), false);
    assert.match(stylesheet, /pre\.highlight:focus-visible/);
  } finally { await browser.happyDOM.abort(); }
});

test('긴 코드의 가로 스크롤은 코드 블록 안에 제한하고 복사 포커스를 유지한다', async () => {
  const { browser, snippets, buttons } = setup({ writeText: async () => {} });
  try {
    const style = browser.document.createElement('style');
    style.textContent = stylesheet;
    browser.document.head.append(style);
    const pre = snippets[0].parentElement;
    const before = snippets[0].textContent;
    const computed = browser.getComputedStyle(pre);
    assert.equal(computed.overflowX, 'auto');
    assert.equal(computed.maxWidth, '100%');
    assert.equal(computed.boxSizing, 'border-box');
    buttons[0].focus();
    buttons[0].click();
    await tick();
    assert.equal(browser.document.activeElement, buttons[0]);
    assert.equal(snippets[0].textContent, before);
  } finally { await browser.happyDOM.abort(); }
});

test('클립보드를 사용할 수 없거나 거부되면 직접 복사 방법을 안내한다', async () => {
  for (const clipboard of [undefined, { writeText: async () => { throw new Error('거부'); } }]) {
    const { browser, snippets, buttons, statuses } = setup(clipboard);
    try {
      buttons[0].focus();
      buttons[0].click();
      await tick();
      assert.match(statuses[0].textContent, /직접 선택해 복사/);
      assert.equal(browser.document.activeElement, buttons[0]);
      assert.equal(snippets[0].textContent, '<p class="a">한글 & text</p>\n  들여쓰기\n');
    } finally { await browser.happyDOM.abort(); }
  }
});

test('이전 복사가 끝나기 전 재시도와 다른 블록 복사는 중복 실행되지 않는다', async () => {
  let finish;
  const written = [];
  const { browser, buttons, statuses } = setup({ writeText: value => { written.push(value); return new Promise(resolve => { finish = resolve; }); } });
  try {
    buttons[0].click();
    buttons[0].click();
    buttons[1].click();
    assert.equal(written.length, 1);
    assert.match(statuses[0].textContent, /진행 중/);
    assert.match(statuses[1].textContent, /다른 코드 복사/);
    finish();
    await tick();
    assert.equal(statuses[0].textContent, '코드를 복사했습니다.');
    assert.equal(statuses[1].textContent, '');
    buttons[1].click();
    assert.equal(written.length, 2);
    assert.equal(written[1], 'a { color: red; }\n');
    finish();
    await tick();
    assert.equal(statuses[1].textContent, '코드를 복사했습니다.');
  } finally { await browser.happyDOM.abort(); }
});

test('복사가 지연되면 권한 확인을 안내하고 늦은 완료를 반영한다', async () => {
  let finish;
  const { browser, buttons, statuses } = setup({ writeText: () => new Promise(resolve => { finish = resolve; }) });
  try {
    let delay;
    let cleared = false;
    browser.setTimeout = (callback, milliseconds) => { assert.equal(milliseconds, 8000); delay = callback; return 123; };
    browser.clearTimeout = id => { assert.equal(id, 123); cleared = true; };
    buttons[0].click();
    assert.ok(delay);
    delay();
    assert.match(statuses[0].textContent, /지연.*권한 요청/);
    buttons[1].click();
    assert.match(statuses[1].textContent, /다른 코드 복사.*다시 시도/);
    finish();
    await tick();
    assert.equal(statuses[0].textContent, '코드를 복사했습니다.');
    assert.equal(statuses[1].textContent, '');
    assert.equal(cleared, true);
  } finally { await browser.happyDOM.abort(); }
});

test('지연된 복사를 다시 눌러도 지연 안내를 유지하고 실제 종료 후에만 다른 코드를 복사한다', async () => {
  for (const outcome of ['success', 'failure']) {
    let finish;
    let fail;
    const written = [];
    const { browser, snippets, buttons, statuses } = setup({
      writeText: value => {
        written.push(value);
        return written.length === 1
          ? new Promise((resolve, reject) => { finish = resolve; fail = reject; })
          : Promise.resolve();
      },
    });
    try {
      let delay;
      browser.setTimeout = (callback, milliseconds) => { assert.equal(milliseconds, 8000); delay = callback; return 123; };
      browser.clearTimeout = id => assert.equal(id, 123);
      buttons[0].click();
      buttons[1].click();
      assert.match(statuses[1].textContent, /다른 코드 복사.*진행 중/);
      delay();
      assert.match(statuses[0].textContent, /지연.*권한 요청/);
      buttons[0].click();
      assert.match(statuses[0].textContent, /지연.*권한 요청/);
      assert.match(statuses[1].textContent, /다른 코드 복사.*지연.*권한 요청/);
      buttons[1].click();
      assert.match(statuses[0].textContent, /지연.*권한 요청/);
      assert.match(statuses[1].textContent, /다른 코드 복사.*지연.*권한 요청/);
      assert.deepEqual(written, [snippets[0].textContent], '대기 중 중복 쓰기를 하지 않는다');

      if (outcome === 'success') finish();
      else fail(new Error('거부'));
      await tick();
      assert.equal(statuses[0].textContent, outcome === 'success'
        ? '코드를 복사했습니다.' : '복사하지 못했습니다. 코드를 직접 선택해 복사해 주세요.');
      assert.equal(statuses[1].textContent, '', '다른 버튼의 대기 안내는 요청 종료 후 지운다');
      buttons[1].click();
      await tick();
      assert.deepEqual(written, [snippets[0].textContent, snippets[1].textContent]);
      assert.equal(statuses[1].textContent, '코드를 복사했습니다.');
    } finally { await browser.happyDOM.abort(); }
  }
});
