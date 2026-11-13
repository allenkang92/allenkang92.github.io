import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const siteRoot = process.env.SITE_ROOT || resolve('_site');
const baseurl = process.env.SITE_BASEURL || '';

test('pages expose the generated Atom feed for readers and feed discovery', async () => {
  const page = await readFile(resolve(siteRoot, 'index.html'), 'utf8');
  const feed = await readFile(resolve(siteRoot, 'feed.xml'), 'utf8');
  const meta = page.match(/<link\b[^>]*type="application\/atom\+xml"[^>]*>/g) || [];
  assert.equal(meta.length, 1, 'exactly one Atom discovery link must be present');
  assert.match(meta[0], /rel="alternate"/);
  assert.ok(meta[0].includes(`href="https://allenkang92.github.io${baseurl}/feed.xml"`));
  assert.ok(page.includes(`href="${baseurl}/feed.xml" type="application/atom+xml">글 구독 (Atom 피드)</a>`));
  assert.match(feed, /<feed\b[^>]*xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/);
  assert.match(feed, /<feed\b[^>]*xml:lang="ko-KR"/);
  assert.match(feed, /<link\b[^>]*hreflang="ko-KR"/);
  assert.match(page, /<meta\s+property="og:locale"\s+content="ko_KR"/);
  assert.match(feed, /<entry\b/);
});
