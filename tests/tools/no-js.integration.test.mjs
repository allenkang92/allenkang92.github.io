import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

test('자바스크립트 미실행 또는 스크립트 차단 시 계산기는 숨기고 안내를 제공한다', async () => {
  const siteRoot = process.env.SITE_ROOT || resolve('_site');
  const html = await readFile(resolve(siteRoot, 'tools/index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  try {
    browser.document.write(html);
    const calculator = browser.document.querySelector('.calculator-container');
    const notice = browser.document.querySelector('#calculator-load-notice');
    const directory = browser.document.querySelector('.tool-directory');
    assert.ok(calculator && notice && directory);
    assert.equal(browser.getComputedStyle(calculator).display, 'none');
    assert.equal(calculator.hidden, true);
    assert.equal(notice.hidden, false);
    assert.match(notice.textContent, /자바스크립트 설정/);
    assert.notEqual(browser.getComputedStyle(directory).display, 'none');
    assert.ok(directory.querySelector('a[href]'));
  } finally {
    await browser.happyDOM.abort();
  }
});

test('도구 스크립트의 초기화가 끝나면 계산기를 표시하고 안내를 숨긴다', async () => {
  const siteRoot = process.env.SITE_ROOT || resolve('_site');
  const html = await readFile(resolve(siteRoot, 'tools/index.html'), 'utf8');
  const script = await readFile(new URL('../../assets/js/tools.js', import.meta.url), 'utf8');
  const browser = new Window({ url: 'https://blog.test/tools/', settings: { disableJavaScriptFileLoading: true } });
  try {
    browser.document.write(html);
    const calculator = browser.document.querySelector('.calculator-container');
    const notice = browser.document.querySelector('#calculator-load-notice');
    assert.equal(calculator.hidden, true);
    assert.equal(notice.hidden, false);
    browser.eval(script);
    browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
    assert.equal(calculator.hidden, false);
    assert.equal(notice.hidden, true);
    browser.document.querySelector('[data-number="7"]').click();
    assert.equal(browser.document.querySelector('.current-operand').textContent, '7');
  } finally {
    await browser.happyDOM.abort();
  }
});
