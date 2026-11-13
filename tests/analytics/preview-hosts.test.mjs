import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const template = await readFile(new URL('../../_includes/head.html', import.meta.url), 'utf8');
const tagScript = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes('googletagmanager.com/gtag/js'));

function initializeTag(hostname) {
  assert.ok(tagScript, '분석 태그 초기화 스크립트가 있어야 합니다');
  const attached = [];
  const window = { location: { hostname } };
  const document = { createElement: () => ({}), head: { appendChild: node => attached.push(node) } };
  runInNewContext(tagScript, { window, document, Date });
  return { attached, window };
}

test('운영 빌드의 로컬 미리보기에서는 분석 태그를 불러오지 않는다', () => {
  for (const hostname of ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]', '']) {
    const { attached, window } = initializeTag(hostname);
    assert.equal(attached.length, 0, `${hostname}에서 분석 태그를 불러오면 안 됩니다`);
    assert.equal(window.gtag, undefined);
  }
});

test('공개 호스트에서는 기존 분석 태그와 설정 호출을 유지한다', () => {
  const { attached, window } = initializeTag('allenkang92.github.io');
  assert.equal(attached.length, 1);
  assert.match(attached[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=/);
  assert.deepEqual(Array.from(window.dataLayer, item => item[0]), ['js', 'config']);
});
