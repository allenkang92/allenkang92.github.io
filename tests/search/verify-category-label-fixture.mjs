// 분류 표시명은 작성한 문자열 그대로 HTML과 검색 설정에 전달되어야 한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { withTemporaryDirectory } from '../helpers/temporary-directory.mjs';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
await withTemporaryDirectory('category-label-fixture-', async (temp) => {
const source = join(temp, 'source');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });

const webLabel = '<웹> & 기술';
const dailyLabel = '&amp; "인용" </script>';
const categoriesPath = join(source, '_data/categories.yml');
const categories = await readFile(categoriesPath, 'utf8');
const changed = categories.replace('title: "웹 기술"', `title: ${JSON.stringify(webLabel)}`)
  .replace('title: "일상"', `title: ${JSON.stringify(dailyLabel)}`)
  .replace('title: "과학철학·현대물리학"', 'title: ""');
assert.notEqual(changed, categories, '분류 시험 자료가 적용되어야 합니다');
assert.ok(changed.includes(webLabel) && changed.includes('</script>'));
await writeFile(categoriesPath, changed);

const fixtures = [
  ['web_technologies', '분류 원문 시험', '/posts/category-fixture-web/', webLabel],
  ['daily_life', '문자참조 시험', '/posts/category-fixture-entity/', dailyLabel],
  ['unregistered_topic', '미등록 분류 시험', '/posts/category-fixture-unknown/', 'Unregistered topic'],
  ['ß_topic', '유니코드 분류 시험', '/posts/category-fixture-unicode/', 'Ss topic'],
  ['science_philosophy_history', '빈 분류명 시험', '/posts/category-fixture-empty/', 'Science philosophy history'],
];
for (const [category, title, permalink] of fixtures) {
  await writeFile(join(source, `_posts/2025-01-01-category-fixture-${category}.md`), `---\nlayout: post\ntitle: ${JSON.stringify(title)}\ndate: 2025-01-01 00:00:00 +0900\npermalink: ${permalink}\ncategories: [${category}]\n---\n시험 본문\n`);
}

const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'production', TZ: 'UTC' };
const bundle = process.env.BUNDLE_BIN || 'bundle';
for (const [name, base] of [['root', ''], ['nested', '/blog']]) {
  const output = join(temp, name);
  execFileSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', output, '--baseurl', base], { cwd: repository, env, stdio: 'inherit' });
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const readDocument = async path => new browser.DOMParser().parseFromString(await readFile(join(output, path), 'utf8'), 'text/html');
  try {
    const posts = await readDocument('posts/index.html');
    const sidebarPage = await readDocument('posts/category-fixture-web/index.html');
    const form = sidebarPage.querySelector('.search-form');
    assert.ok(form, `${name}: 사이트 검색 폼`);
    const labels = JSON.parse(form.dataset.categoryLabels);
    assert.equal(labels.web_technologies, webLabel, `${name}: 사이드바 설정의 특수문자 보존`);
    assert.equal(labels.daily_life, dailyLabel, `${name}: 사이드바 설정의 문자참조·따옴표 보존`);
    assert.equal(labels['ß_topic'], 'Ss topic', `${name}: 미등록 유니코드 분류의 Liquid 표시명 보존`);
    assert.equal(labels.science_philosophy_history, 'Science philosophy history', `${name}: 빈 분류명은 분류 키로 대체`);
    const home = await readDocument('index.html');
    const featured = home.querySelector('#featured-title a')?.getAttribute('href');
    for (const [, title, permalink, label] of fixtures.filter(([, , permalink]) => `${base}${permalink}` !== featured)) {
      const card = [...home.querySelectorAll('.post-card')].find(element => element.querySelector('.post-title a')?.getAttribute('href') === `${base}${permalink}`);
      assert.ok(card, `${name}: ${title} 홈 최근 글`);
      assert.equal(card.querySelector('.category-badge')?.textContent.trim(), label, `${name}: 홈의 분류 원문`);
      assert.equal(card.querySelector('.category-badge')?.children.length, 0);
    }
    for (const [category, title, permalink, label] of fixtures) {
      const cards = [...posts.querySelectorAll('#posts-static-fallback .post-preview')];
      const card = cards.find(element => element.dataset.title === title);
      assert.ok(card, `${name}: ${title} 정적 글 목록`);
      const rendered = card.querySelector('.post-meta .category');
      assert.equal(rendered?.textContent.trim(), label, `${name}: 글 목록 분류 원문`);
      assert.equal(rendered?.children.length, 0, `${name}: 분류명이 요소로 해석되지 않아야 합니다`);
      assert.ok((card.dataset.categories || '').split(/\s+/).includes(category));
      assert.equal(card.querySelector('h2 a')?.getAttribute('href'), `${base}${permalink}`);
      const post = await readDocument(`${permalink.slice(1)}index.html`);
      const postLabel = post.querySelector('.post-meta .category');
      assert.equal(postLabel?.textContent.trim(), label, `${name}: 본문 분류 원문`);
      assert.equal(postLabel?.children.length, 0);
    }
    const search = JSON.parse(await readFile(join(output, 'search.json'), 'utf8'));
    for (const [category, title, permalink] of fixtures) {
      const entry = search.find(item => item.title === title);
      assert.equal(entry?.category, category, `${name}: 검색 색인은 분류 키를 유지해야 합니다`);
      assert.equal(new URL(entry.url, 'https://example.com').pathname, `${base}${permalink}`);
    }
  } finally { await browser.happyDOM.abort(); }
}
});
console.log(`분류 표시명 격리 빌드 검증 통과`);
