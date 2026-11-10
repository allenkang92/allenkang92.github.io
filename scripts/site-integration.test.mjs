import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const siteRoot = process.env.SITE_ROOT ? resolve(process.env.SITE_ROOT) : resolve(projectRoot, '_site');

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

test('series hubs render their facts as HTML and use one-based reading positions', async () => {
  for (const [slug, count] of [['mathematics-philosophy-history', 10], ['science-philosophy-history', 5]]) {
    const page = await readFile(resolve(siteRoot, 'series', slug, 'index.html'), 'utf8');
    const facts = /<dl class="series-hub-facts">([\s\S]*?)<\/dl>/.exec(page)?.[1];
    assert.ok(facts, `${slug}: facts must render`);
    assert.match(facts, /<dt>글 수<\/dt>\s*<dd>\s*\d+편\s*<\/dd>/);
    assert.match(facts, /<dt>읽는 순서<\/dt>\s*<dd>[^<]+<\/dd>/);
    assert.doesNotMatch(facts, /<pre\b|&lt;(?:div|dt|dd)\b/);

    const positions = Array.from(page.matchAll(/<p class="series-path-order">(\d+)번째 글<\/p>/g), match => Number(match[1]));
    assert.deepEqual(positions, Array.from({ length: count }, (_, index) => index + 1), `${slug}: positions must match displayed order`);
  }
});

test('post series navigation follows the indexed reading order', async () => {
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.series) continue;
    assert.ok(Number.isInteger(entry.series_index), `${entry.title}: series position must be indexed`);
    if (!groups.has(entry.series)) groups.set(entry.series, []);
    groups.get(entry.series).push(entry);
  }

  for (const [series, entriesInSeries] of groups) {
    entriesInSeries.sort((a, b) => a.series_index - b.series_index);
    for (const [index, entry] of entriesInSeries.entries()) {
      const path = decodeURIComponent(new URL(entry.url).pathname).replace(/^\/+/, '');
      const page = await readFile(resolve(siteRoot, path, 'index.html'), 'utf8');
      const next = /<a class="series-next-link" href="([^"]+)">\s*<span class="series-kicker">([^<]+)<\/span>/.exec(page);
      if (index < entriesInSeries.length - 1) {
        assert.ok(next, `${entry.title}: next post is missing`);
        assert.equal(decodeURIComponent(new URL(next[1], entry.url).pathname), decodeURIComponent(new URL(entriesInSeries[index + 1].url).pathname), `${entry.title}: next link`);
        assert.match(next[2], new RegExp(`${index + 2}번째 글$`), `${entry.title}: next position in ${series}`);
      } else {
        assert.equal(next, null, `${entry.title}: final post must not have a next link`);
        assert.match(page, /이 시리즈의 마지막 글입니다\./);
      }

      const previous = /<a href="([^"]+)">이전 글:/.exec(page);
      if (index > 0) {
        assert.ok(previous, `${entry.title}: previous post is missing`);
        assert.equal(decodeURIComponent(new URL(previous[1], entry.url).pathname), decodeURIComponent(new URL(entriesInSeries[index - 1].url).pathname), `${entry.title}: previous link`);
      } else {
        assert.equal(previous, null, `${entry.title}: first post must not have a previous link`);
      }
    }
  }
});

test('math posts load configured inline rendering while other posts do not', async () => {
  const mathPage = await readFile(resolve(siteRoot, 'posts', '1장-시대와지역에따른수학발전', 'index.html'), 'utf8');
  const setPage = await readFile(resolve(siteRoot, 'posts', '2장-수학과무한', 'index.html'), 'utf8');
  const probabilityPage = await readFile(resolve(siteRoot, 'posts', '5장-확률과통계의철학적의미', 'index.html'), 'utf8');
  const plainPage = await readFile(resolve(siteRoot, 'posts', '9장-수학철학과수학사의종합적고찰', 'index.html'), 'utf8');

  assert.match(mathPage, /id="post-content"/);
  assert.match(mathPage, /startup:\s*\{\s*elements:\s*\['#post-content'\]/);
  assert.match(mathPage, /inlineMath:\s*\{\s*'\[\+\]':\s*\[\['\$',\s*'\$'\]\]/);
  assert.match(mathPage, /<script defer\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax@4\.1\.3\/tex-chtml\.js"/);
  assert.ok(setPage.includes('\\mathbb{N} = \\{1, 2, 3, \\dots\\}'), 'literal set braces must survive Markdown');
  assert.ok(probabilityPage.includes('<p>$P(A\\mid B) = \\frac{P(B\\mid A) \\cdot P(A)}{P(B)}$</p>'), 'Bayes formula must remain a single math expression');
  assert.match(probabilityPage, /<li>새로운 정보[\s\S]*?P\(A\\mid B\)\$을 형성<\/li>/, 'conditional probability in a list must remain within its list item');
  assert.doesNotMatch(plainPage, /cdn\.jsdelivr\.net\/npm\/mathjax@4\.1\.3\/tex-chtml\.js/);
});
