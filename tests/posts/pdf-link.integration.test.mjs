import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const siteRoot = process.env.SITE_ROOT || resolve('_site');
const baseurl = process.env.SITE_BASEURL || '';

test('PDF remains directly accessible outside the preview iframe', async () => {
  const browser = new Window({ url: 'https://blog.test/' });
  try {
    browser.document.body.innerHTML = await readFile(resolve(siteRoot, 'posts/기업재난관리사-합격후기/index.html'), 'utf8');
    const iframe = browser.document.querySelector('iframe[title="기업재난관리사 실무분야 합격 후기 PDF 미리보기"]');
    assert.ok(iframe);
    const link = [...browser.document.querySelectorAll('a[href]')].find(element =>
      element.textContent.includes('합격 후기 PDF 직접 열기') && !element.closest('iframe')
    );
    assert.ok(link, 'an independently available PDF link should exist outside the iframe');
    assert.equal(link.getAttribute('href'), iframe.getAttribute('src'));
    assert.ok(link.getAttribute('href').startsWith(`${baseurl}/assets/images/`));
  } finally {
    await browser.happyDOM.abort();
  }
});
