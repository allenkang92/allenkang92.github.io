import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const site = process.env.SITE_ROOT || resolve('_site');
const base = process.env.SITE_BASEURL || '';
const source = await readFile(new URL('../../assets/js/code-copy.js', import.meta.url), 'utf8');

test('코드 복사는 글에서만 로드되고 자바스크립트 없이도 원문은 남는다', async () => {
  for (const [path, isPost, hasCode] of [
    ['posts/css정리/index.html', true, true],
    ['posts/4장-수학적증명과오류의논리/index.html', true, false],
    ['about/index.html', false, false],
  ]) {
    const html = await readFile(resolve(site, path), 'utf8');
    const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
    try {
      browser.document.write(html);
      const scripts = [...browser.document.querySelectorAll('script[src]')].filter(element => new URL(element.src, 'https://blog.test').pathname === `${base}/assets/js/code-copy.js`);
      const styles = [...browser.document.querySelectorAll('link[rel="stylesheet"]')].filter(element => new URL(element.href, 'https://blog.test').pathname === `${base}/assets/css/code-copy.css`);
      assert.equal(scripts.length, isPost ? 1 : 0, `${path}: 복사 스크립트`);
      assert.equal(styles.length, isPost ? 1 : 0, `${path}: 복사 스타일`);
      assert.equal(browser.document.querySelectorAll('.code-copy-button').length, 0, '자바스크립트 비활성 시 버튼을 만들지 않는다');
      if (hasCode) {
        const snippets = browser.document.querySelectorAll('#post-content .highlighter-rouge > .highlight > pre.highlight > code');
        assert.ok(snippets.length > 0, '원래 코드가 본문에 표시돼야 한다');
        assert.ok(snippets[0].textContent.trim(), '코드를 선택해 수동 복사할 수 있어야 한다');
      }
    } finally { await browser.happyDOM.abort(); }
  }
});

test('생성된 실제 Rouge 코드 예제에만 복사 버튼을 생성한다', async () => {
  const html = await readFile(resolve(site, 'posts/css정리/index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    browser.document.write(html);
    const snippets = [...browser.document.querySelectorAll('#post-content .highlighter-rouge > .highlight > pre.highlight > code')];
    const firstText = snippets[0]?.textContent;
    assert.ok(snippets.length > 0);
    let copied;
    Object.defineProperty(browser.navigator, 'clipboard', { configurable: true, value: { writeText: async value => { copied = value; } } });
    browser.eval(source);
    if (browser.document.readyState === 'loading') browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
    assert.equal(browser.document.querySelectorAll('#post-content .code-copy-button').length, snippets.length);
    assert.equal(snippets[0].textContent, firstText, '복사 버튼은 원래 코드 텍스트를 바꾸지 않는다');
    browser.document.querySelector('#post-content .code-copy-button').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(copied, firstText, '강조 구문 span을 제외하고 원본 문자열을 복사한다');
    assert.equal(browser.document.querySelectorAll('#post-content > .code-copy-button').length, 0);
  } finally { await browser.happyDOM.abort(); }
});
