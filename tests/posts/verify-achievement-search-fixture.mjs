// 실제 Jekyll 생성물로 성과 검색의 게시 조건과 사용자 지정 경로를 확인한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, cp, readFile, writeFile } from 'node:fs/promises';
import { withTemporaryDirectory } from '../helpers/temporary-directory.mjs';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
await withTemporaryDirectory('achievement-search-fixture-', async (temp) => {
const source = join(temp, 'source');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });

async function amend(slug, lines, removeDate = false) {
  const path = join(source, `_achievements/${slug}.md`);
  let text = await readFile(path, 'utf8');
  assert.match(text, /^---\r?\n/);
  if (removeDate) text = text.replace(/^date:.*\r?\n/m, '');
  await writeFile(path, text.replace(/^---\r?\n/, match => `${match}${lines}\n`));
}
await amend('education', 'permalink: /portfolio/education/');
await amend('leadership', 'permalink: /portfolio/leadership');
await amend('awards', 'published: false');
await amend('certificates', 'published: null');
await amend('publications', 'date: 2099-01-01 00:00:00 +0900', true);
for (const [name, title, permalink] of [
  ['nonhtml', 'Non HTML', '/portfolio/raw.json'],
  ['empty', '', '/portfolio/empty/'],
  ['nbsp', '\u00a0', '/portfolio/nbsp/'],
  ['numeric', 123, '/portfolio/numeric/'],
  ['false', false, '/portfolio/false/'],
]) {
  await writeFile(join(source, `_achievements/${name}.md`),
    `---\ntitle: ${JSON.stringify(title)}\npermalink: ${permalink}\nlayout: achievement\ndate: 2024-01-01\noverview: Fixture Only ${name}\n---\n`);
}
for (const [name, timestamp] of [['equal', '2026-11-13 00:00:00 +0000'], ['after', '2026-11-13 00:00:01 +0000']]) {
  await writeFile(join(source, `_achievements/boundary-${name}.md`),
    `---\ntitle: Boundary ${name}\npermalink: /portfolio/boundary-${name}/\nlayout: achievement\ndate: ${timestamp}\n---\n`);
}
const override = join(temp, 'no-achievement-output.yml');
await writeFile(override, 'collections:\n  achievements:\n    output: false\n');
const clock = join(temp, 'fixed-time.yml');
await writeFile(clock, 'time: 2026-11-13 00:00:00 +0000\n');
const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'production', TZ: 'UTC' };
const bundle = process.env.BUNDLE_BIN || 'bundle';

for (const [name, extra, expectedTitles] of [
  // Jekyll은 title:false를 파일명에서 유추한 문자열 "False"로 대체한다.
  ['default', [], ['Education', 'Leadership', 'False', 'Boundary equal']],
  ['future-unpublished', ['--future', '--unpublished'], ['Education', 'Leadership', 'False', 'Boundary equal', 'Boundary after', 'Academic Awards', 'Professional Certifications', 'Research Publications']],
  ['disabled', [], []],
]) {
  const output = join(temp, name);
  const configs = [join(source, '_config.yml'), clock, ...(name === 'disabled' ? [override] : [])];
  execFileSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', output, '--baseurl', '/blog', '--config', configs.join(','), ...extra], { cwd: repository, env, stdio: 'inherit' });
  const rows = JSON.parse(await readFile(join(output, 'search.json'), 'utf8'));
  const achievements = rows.filter(row => row.page_kind === 'achievement');
  assert.deepEqual(achievements.map(row => row.title).sort(), expectedTitles.sort(), `${name}: 게시 가능한 성과만 색인에 있어야 합니다`);
  const browser = new Window({ url: 'https://preview.test/blog/about/' });
  try {
    browser.document.write(await readFile(join(output, 'about/index.html'), 'utf8'));
    const form = browser.document.querySelector('.search-form');
    const paths = JSON.parse(form.dataset.expectedPagePaths);
    const actual = rows.filter(row => row.type === 'page').map(row => new URL(row.url).pathname);
    assert.deepEqual([...paths].sort(), actual.sort(), `${name}: 폼의 기대 페이지와 색인이 일치해야 합니다`);
    if (name !== 'disabled') {
      const education = achievements.find(row => row.title === 'Education');
      assert.equal(new URL(education.url).pathname, '/blog/portfolio/education/');
      assert.match(education.content, /Sogang/);
      assert.equal(education.language, 'en');
      assert.equal(education.date, '');
      assert.ok(paths.includes('/blog/portfolio/education/'));
      await access(join(output, 'portfolio/education/index.html'));
      await access(join(output, 'portfolio/leadership.html'));
      await access(join(output, 'portfolio/raw.json'));
      assert.ok(!achievements.some(row => row.title === 'Non HTML'), '비HTML 출력은 페이지 검색에서 제외한다');
      assert.ok(paths.includes('/blog/portfolio/leadership'), '확장자 없는 Jekyll 퍼머링크는 원문을 유지한다');
      await access(join(output, 'portfolio/boundary-equal/index.html'));
      if (name === 'default') {
        await assert.rejects(access(join(output, 'portfolio/boundary-after/index.html')), { code: 'ENOENT' });
      } else {
        await access(join(output, 'portfolio/boundary-after/index.html'));
      }
    } else {
      await assert.rejects(access(join(output, 'portfolio/education/index.html')), { code: 'ENOENT' });
    }
  } finally {
    await browser.happyDOM.abort();
  }
}
});
console.log(`성과 검색 격리 검증 통과`);
