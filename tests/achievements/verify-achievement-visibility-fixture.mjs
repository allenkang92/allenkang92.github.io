// 실제 Jekyll 출력 대상과 성과 목록·상세 탐색을 격리 자료로 대조한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { withTemporaryDirectory } from '../helpers/temporary-directory.mjs';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
await withTemporaryDirectory('achievement-visibility-fixture-', async (temp) => {
const source = join(temp, 'source');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });

const documents = {
  awards: { date: '2020-01-01', title: 'Academic Awards' },
  certificates: { date: '2021-01-01', title: 'Professional Certifications', permalink: '/portfolio/certification' },
  education: { date: '2022-01-01', title: 'Education', permalink: '/portfolio/education/' },
  publications: { date: '2023-01-01', title: 'Research Publications', published: false },
  leadership: { date: '2099-01-01', title: 'Leadership' },
};
for (const [slug, data] of Object.entries(documents)) {
  const path = join(source, '_achievements', `${slug}.md`);
  let text = await readFile(path, 'utf8');
  assert.match(text, /^date:.*$/m);
  text = text.replace(/^date:.*$/m, `date: ${data.date}`);
  const related = slug === 'awards' ? 'related_achievements: [Leadership, Research Publications, Education]'
    : slug === 'certificates' ? 'related_achievements: [Leadership, Research Publications]' : '';
  const extras = [data.published === false ? 'published: false' : '', data.permalink ? `permalink: ${data.permalink}` : '', related].filter(Boolean);
  text = text.replace(/^---\r?\n/, match => `${match}${extras.join('\n')}\n`);
  await writeFile(path, text);
}
// 실제 HTML 링크로 노출할 수 없는 문서와 읽을 제목이 없는 문서도 목록에서 제외한다.
await writeFile(join(source, '_achievements', 'json-fixture.md'), '---\nlayout: achievement\ntitle: Machine Data\ndate: 2023-06-01\npermalink: /portfolio/data.json\n---\nFixture\n');
await writeFile(join(source, '_achievements', 'empty-fixture.md'), '---\nlayout: achievement\ntitle: ""\ndate: 2023-06-02\npermalink: /portfolio/empty/\n---\nFixture\n');
await writeFile(join(source, '_achievements', 'space-fixture.md'), '---\nlayout: achievement\ntitle: "\u00a0"\ndate: 2023-06-03\npermalink: /portfolio/space/\n---\nFixture\n');
await writeFile(join(source, '_achievements', 'false-fixture.md'), '---\nlayout: achievement\ntitle: false\ndate: 2023-06-04\npermalink: /portfolio/false/\n---\nFixture\n');
await writeFile(join(source, '_achievements', 'number-fixture.md'), '---\nlayout: achievement\ntitle: 123\ndate: 2023-06-05\npermalink: /portfolio/number/\n---\nFixture\n');
// 현재 Jekyll 설정은 false 제목에 파일명 기반 문자열 제목을 보충한다.
documents['false-fixture'] = { date: '2023-06-04', title: 'False Fixture', permalink: '/portfolio/false/' };

const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'production', TZ: 'UTC' };
const bundle = process.env.BUNDLE_BIN || 'bundle';
const outputPath = (slug, base) => `${base}${documents[slug].permalink || `/achievements/${slug}/`}`;
const pathOf = slug => {
  const path = (documents[slug].permalink || `/achievements/${slug}/`).replace(/^\//, '');
  return path.endsWith('/') ? `${path}index.html` : /\.html?$/i.test(path) ? path : `${path}.html`;
};
const open = async path => {
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  window.document.write(await readFile(path, 'utf8'));
  return window;
};
const extraPaths = ['/portfolio/data.json', '/portfolio/empty/', '/portfolio/space/', '/portfolio/number/'];
const checkSearchScopes = async (output, base, visible, label) => {
  const expected = visible.map(slug => outputPath(slug, base));
  const candidates = new Set([...Object.keys(documents).map(slug => outputPath(slug, base)), ...extraPaths.map(path => `${base}${path}`)]);
  const rows = JSON.parse(await readFile(join(output, 'search.json'), 'utf8'));
  const indexed = rows.filter(row => row.page_kind === 'achievement').map(row => new URL(row.url).pathname);
  assert.equal(indexed.length, new Set(indexed).size, `${label}: 성과 색인의 중복 경로가 없어야 합니다`);
  assert.deepEqual(new Set(indexed), new Set(expected), `${label}: 성과 색인이 실제 공개 성과와 일치해야 합니다`);
  if (visible.includes('false-fixture')) {
    const fallback = rows.find(row => row.page_kind === 'achievement' && new URL(row.url).pathname === outputPath('false-fixture', base));
    assert.equal(fallback?.title, 'False Fixture', `${label}: Jekyll이 보충한 유효 제목을 색인합니다`);
  }

  const posts = await open(join(output, 'posts/index.html'));
  const sidebar = await open(join(output, 'achievements/index.html'));
  try {
    const reactRoot = posts.document.querySelector('#posts-react-root');
    // 글 목록 페이지는 사이드바 검색 폼을 출력하지 않는다.
    const searchForm = sidebar.document.querySelector('#search-container .search-form');
    assert.ok(reactRoot && searchForm, `${label}: 두 검색 화면의 설정이 필요합니다`);
    const achievementPaths = JSON.parse(reactRoot.getAttribute('data-expected-achievement-paths'));
    const reactPages = JSON.parse(reactRoot.getAttribute('data-expected-search-pages'));
    const sidebarPages = JSON.parse(searchForm.getAttribute('data-expected-page-paths'));
    assert.equal(achievementPaths.length, new Set(achievementPaths).size, `${label}: 예상 성과 경로는 중복될 수 없습니다`);
    assert.deepEqual(new Set(achievementPaths), new Set(indexed), `${label}: React 성과 예상 경로와 색인이 일치해야 합니다`);
    for (const [screen, pages] of [['React', reactPages], ['사이드바', sidebarPages]]) {
      assert.equal(pages.length, new Set(pages).size, `${label}: ${screen} 예상 페이지 경로는 중복될 수 없습니다`);
      assert.deepEqual(new Set(pages.filter(path => candidates.has(path))), new Set(indexed),
        `${label}: ${screen} 예상 페이지에 공개 성과만 포함되어야 합니다`);
    }
  } finally { await posts.happyDOM.abort(); await sidebar.happyDOM.abort(); }
};
const cases = [
  ['normal', '', [], ['false-fixture', 'education', 'certificates', 'awards']],
  ['base', '/blog', [], ['false-fixture', 'education', 'certificates', 'awards']],
  ['future', '', ['--future'], ['leadership', 'false-fixture', 'education', 'certificates', 'awards']],
  ['unpublished', '', ['--unpublished'], ['false-fixture', 'publications', 'education', 'certificates', 'awards']],
  ['all', '/blog', ['--future', '--unpublished'], ['leadership', 'false-fixture', 'publications', 'education', 'certificates', 'awards']],
];
for (const [name, base, flags, visible] of cases) {
  const output = join(temp, name);
  execFileSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', output, '--baseurl', base, ...flags], { cwd: repository, env, stdio: 'inherit' });
  await checkSearchScopes(output, base, visible, name);
  const list = await open(join(output, 'achievements/index.html'));
  try {
    const actual = [...list.document.querySelectorAll('.achievement-card h2 a')].map(link => link.getAttribute('href'));
    assert.deepEqual(actual, visible.map(slug => outputPath(slug, base)), `${name}: 목록은 실제 출력된 성과만 기존 정렬대로 표시해야 합니다`);
  } finally { await list.happyDOM.abort(); }
  for (const [index, slug] of visible.entries()) {
    const detail = await open(join(output, pathOf(slug)));
    try {
      const doc = detail.document;
      if (slug === 'false-fixture') assert.equal(doc.querySelector('#achievement-title')?.textContent, 'False Fixture');
      assert.equal(doc.querySelector('.nav-previous')?.getAttribute('href') || null,
        visible[index + 1] ? outputPath(visible[index + 1], base) : null, `${name}: ${slug} 이전 성과`);
      assert.equal(doc.querySelector('.nav-next')?.getAttribute('href') || null,
        visible[index - 1] ? outputPath(visible[index - 1], base) : null, `${name}: ${slug} 다음 성과`);
      if (slug === 'awards') {
        const expected = visible.filter(item => ['leadership', 'publications', 'education'].includes(item));
        const actual = [...doc.querySelectorAll('.related-achievements a')].map(link => link.getAttribute('href'));
        assert.deepEqual(new Set(actual), new Set(expected.map(item => outputPath(item, base))), `${name}: 실제 출력된 관련 성과만 링크합니다`);
      }
      if (slug === 'certificates') {
        const expected = visible.filter(item => ['leadership', 'publications'].includes(item));
        const section = doc.querySelector('.related-achievements');
        if (expected.length === 0) assert.equal(section, null, `${name}: 표시할 관련 성과가 없으면 빈 영역도 숨깁니다`);
        else {
          assert.ok(section, `${name}: 관련 성과가 있으면 제목과 링크를 표시합니다`);
          const actual = [...section.querySelectorAll('a')].map(link => link.getAttribute('href'));
          assert.deepEqual(new Set(actual), new Set(expected.map(item => outputPath(item, base))));
        }
      }
    } finally { await detail.happyDOM.abort(); }
  }
}

const config = join(source, '_config.yml');
const originalConfig = await readFile(config, 'utf8');
assert.match(originalConfig, /(^\s*achievements:\s*\n\s*output:)\s*true/m);
await writeFile(config, originalConfig.replace(/(^\s*achievements:\s*\n\s*output:)\s*true/m, '$1 false'));
const noOutput = join(temp, 'no-output');
execFileSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', noOutput], { cwd: repository, env, stdio: 'inherit' });
await checkSearchScopes(noOutput, '', [], 'no-output');
const empty = await open(join(noOutput, 'achievements/index.html'));
try {
  assert.equal(empty.document.querySelectorAll('.achievement-card').length, 0, '출력하지 않는 컬렉션은 상세 링크를 표시하지 않습니다');
  assert.match(empty.document.querySelector('.achievements-timeline')?.textContent || '', /표시할 성과가 없습니다/, '빈 목록은 상태를 안내합니다');
} finally { await empty.happyDOM.abort(); }
});
console.log(`성과 노출·탐색 격리 검증 통과`);
