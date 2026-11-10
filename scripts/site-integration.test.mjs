import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const siteRoot = resolve(projectRoot, '_site');

test('Jekyll output serves the Vite entry and preserves the full static posts fallback', async () => {
  const pagePath = resolve(siteRoot, 'posts/index.html');
  const page = await readFile(pagePath, 'utf8');
  const fallback = /<section\b[^>]*id="posts-static-fallback"[\s\S]*?<\/section>/.exec(page)?.[0];
  assert.ok(fallback, 'posts page must contain a static fallback region');
  assert.match(page, /id="posts-react-root"[^>]*hidden/);

  const cards = Array.from(fallback.matchAll(/<article\b[^>]*class="post-preview(?:\s[^\"]*)?"[^>]*>/g));
  assert.equal(cards.length, 19, 'all 19 Jekyll posts must remain available without JavaScript');
  assert.equal(cards.some(([card]) => /class="[^"]*\bhidden\b/.test(card)), false);
  assert.equal((fallback.match(/<h2><a\b/g) || []).length, 19, 'every fallback item must retain its article link');
  const proofCard = cards.find(([card]) => card.includes('data-title="4장: 수학적 증명과 오류의 논리"'))?.[0];
  assert.ok(proofCard?.includes('발생합니다. 주장:'), 'fallback search data must preserve a space between source paragraphs');

  const searchEntries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  assert.equal(searchEntries.filter(entry => entry.type === 'post').length, cards.length);
  const proofPost = searchEntries.find(entry => entry.title === '4장: 수학적 증명과 오류의 논리');
  assert.ok(proofPost?.content.includes('발생합니다. 주장:'), 'search content must preserve a space between source paragraphs');
  const searchablePages = searchEntries.filter(entry => entry.type === 'page');
  assert.equal(searchablePages.some(entry => /\{%|%\}|\{\{/.test(`${entry.description || ''} ${entry.content || ''}`)), false,
    'page search data must not expose unrendered Liquid template syntax');

  const scriptSrc = /<script\s+type="module"\s+src="([^"]+)"\s*>/.exec(page)?.[1];
  assert.ok(scriptSrc, 'Jekyll must include the Vite React entry module');
  const scriptPath = resolve(siteRoot, decodeURIComponent(new URL(scriptSrc, 'https://blog.test/').pathname).slice(1));
  await access(scriptPath);
  await assert.rejects(access(resolve(siteRoot, 'assets/js/dist/manifest.json')));
  await assert.rejects(access(resolve(siteRoot, 'frontend')));
  await assert.rejects(access(resolve(siteRoot, 'scripts')));
});

test('achievement detail pages render overview, highlights, and related fields', async () => {
  const cases = [
    ['awards', 'Academic and professional recognition', 'Physics Department Academic Award', 'Quantum Computing'],
    ['certificates', 'Professional certifications and qualifications', 'Information Processing Engineer', 'Software Development'],
    ['education', 'Academic achievements and educational background', 'Yonsei University Cognitive Science Master', 'Research Methods'],
    ['leadership', 'Leadership roles and experiences', 'Samsung Electronics Wireless Business Division', 'Android Framework'],
    ['publications', 'Academic research and publications', 'Research in Artificial Intelligence and Neuroscience', 'Scientific Writing'],
  ];

  for (const [slug, overview, highlight, tech] of cases) {
    const page = await readFile(resolve(siteRoot, 'achievements', slug, 'index.html'), 'utf8');
    assert.ok(page.includes(overview), `${slug} must show its overview`);
    assert.ok(page.includes(highlight), `${slug} must show its highlights`);
    assert.ok(page.includes(tech), `${slug} must show its related fields`);
  }
});
