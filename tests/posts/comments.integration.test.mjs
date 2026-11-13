import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const siteRoot = process.env.SITE_ROOT || resolve('_site');

test('existing comment threads remain attached after post permalink changes', async () => {
  for (const [slug, issue] of [
    ['서론-과학철학및과학사둘러보기', '1'],
    ['서론-수학철학및수학사둘러보기', '3'],
  ]) {
    const html = await readFile(resolve(siteRoot, 'posts', slug, 'index.html'), 'utf8');
    const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
    window.document.write(html);
    const script = window.document.querySelector('script[src="https://utteranc.es/client.js"]');
    assert.ok(script, `${slug}: comments widget exists`);
    assert.equal(script.getAttribute('issue-number'), issue, `${slug}: original issue`);
    assert.equal(script.hasAttribute('issue-term'), false, `${slug}: issue-term would override issue-number`);
    const fallback = window.document.querySelector('.comments-note a');
    assert.equal(fallback?.href, `https://github.com/allenkang92/allenkang92.github.io/issues/${issue}`, `${slug}: existing discussion is directly accessible`);
    assert.match(fallback?.textContent || '', /새 탭/, `${slug}: 새 탭 안내`);
    assert.equal(fallback?.target, '_blank');
    assert.ok(fallback?.relList.contains('noopener'));
    assert.ok(fallback?.relList.contains('noreferrer'));
    window.happyDOM.abort();
  }
});

test('posts without a historic thread continue using pathname matching', async () => {
  const html = await readFile(resolve(siteRoot, 'posts', '웹접근성', 'index.html'), 'utf8');
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  window.document.write(html);
  const script = window.document.querySelector('script[src="https://utteranc.es/client.js"]');
  assert.ok(script);
  assert.equal(script.getAttribute('issue-term'), 'pathname');
  assert.equal(script.hasAttribute('issue-number'), false);
  assert.equal(window.document.querySelector('.comments-note a')?.href, 'https://github.com/allenkang92/allenkang92.github.io/issues');
  window.happyDOM.abort();
});
