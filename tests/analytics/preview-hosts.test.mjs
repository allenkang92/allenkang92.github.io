import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { Window } from 'happy-dom';

const template = await readFile(new URL('../../_includes/head.html', import.meta.url), 'utf8');
const tagScript = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('googletagmanager.com/gtag/js'));
const eventsScript = await readFile(new URL('../../assets/js/analytics-events.js', import.meta.url), 'utf8');
const localUrls = [
  'http://localhost/', 'http://BLOG.LOCALHOST./', 'http://a.b.localhost/',
  'http://127.0.0.1/', 'http://127.0.0.2/', 'http://127.255.255.255/',
  'http://127.1/', 'http://127.000.000.002/', 'http://0.0.0.0/', 'http://[::1]/',
];
const publicUrls = [
  'https://allenkang92.github.io/', 'https://localhost.example/',
  'https://app.localhost.example/', 'https://notlocalhost/',
  'https://127.0.0.2.example/', 'http://128.0.0.1/',
];

function initializeTag(hostname) {
  assert.ok(tagScript, '분석 태그 초기화 스크립트가 있어야 합니다');
  const attached = [];
  const window = { location: { hostname } };
  const document = { createElement: () => ({}), head: { appendChild: node => attached.push(node) } };
  runInNewContext(tagScript, { window, document, Date });
  return { attached, window };
}

test('운영 빌드의 로컬 미리보기에서는 분석 태그를 불러오지 않는다', () => {
  for (const hostname of [...localUrls.map(url => new URL(url).hostname), '::1', '']) {
    const { attached, window } = initializeTag(hostname);
    assert.equal(attached.length, 0, `${hostname}에서 분석 태그를 불러오면 안 됩니다`);
    assert.equal(window.gtag, undefined);
  }
});

test('공개 호스트에서는 기존 분석 태그와 설정 호출을 유지한다', () => {
  for (const url of publicUrls) {
    const { attached, window } = initializeTag(new URL(url).hostname);
    assert.equal(attached.length, 1, url);
    assert.match(attached[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=/);
    assert.deepEqual(Array.from(window.dataLayer, item => item[0]), ['js', 'config']);
  }
});

test('이벤트 가드는 태그 가드와 같은 실제 URL 호스트를 분류한다', async () => {
  for (const [urls, expectedEvents] of [[localUrls, 0], [publicUrls, 1]]) {
    for (const url of urls) {
      const browser = new Window({ url });
      const events = [];
      try {
        browser.gtag = (...args) => events.push(args);
        browser.document.body.innerHTML = '<button data-equals>계산</button>';
        browser.eval(eventsScript);
        browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
        browser.document.querySelector('[data-equals]').click();
        assert.equal(events.length, expectedEvents, url);
      } finally {
        await browser.happyDOM.abort();
      }
    }
  }
});
