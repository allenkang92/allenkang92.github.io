// 일반 페이지와 중첩 레이아웃의 수식 안내 위치를 격리 Jekyll 빌드로 확인한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
const temp = await realpath(await mkdtemp(join(tmpdir(), 'math-page-fixture-')));
const source = join(temp, 'source');
const output = join(temp, 'site');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });

await writeFile(join(source, '_layouts/qa-math-nested.html'), '---\nlayout: default\n---\n{{ content }}\n');
await writeFile(join(source, '_layouts/qa-math-post-nested.html'), '---\nlayout: post\n---\n{{ content }}\n');
const pages = [
  ['qa-math-page', 'default', 'math: true', true],
  ['qa-math-nested', 'qa-math-nested', 'math: true', true],
  ['qa-math-post-nested', 'qa-math-post-nested', 'math: true', true],
  ['qa-math-post-nested-auto', 'qa-math-post-nested', '', true],
  ['qa-math-post-nested-false', 'qa-math-post-nested', 'math: false', false],
  ['qa-math-false', 'default', 'math: false', false],
  ['qa-math-post-false', 'post', 'math: false', false],
  ['qa-math-plain', 'default', '', false],
];
for (const [slug, layout, flag] of pages) {
  const data = `---\nlayout: ${layout}\ntitle: 수식 시험\npermalink: /${slug}/\n${flag}\n---\n<p id="qa-math-marker">본문 $x$</p>\n`;
  await writeFile(join(source, '_pages', `${slug}.html`), data);
}

const env = {
  ...process.env,
  BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'),
  JEKYLL_ENV: 'production',
  TZ: 'UTC',
};
const bundle = process.env.BUNDLE_BIN || 'bundle';
execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', output], { cwd: repository, env, stdio: 'inherit' });

for (const [slug, , , expected] of pages) {
  const html = await readFile(join(output, slug, 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    browser.document.write(html);
    const main = browser.document.querySelector('main#main-content');
    const marker = browser.document.querySelector('#qa-math-marker');
    assert.ok(main && marker, `${slug}: 본문이 있어야 합니다`);
    for (const id of ['math-load-delay', 'math-load-error']) {
      const notices = browser.document.querySelectorAll(`#${id}`);
      assert.equal(notices.length, expected ? 1 : 0, `${slug}: ${id} 중복 또는 누락`);
      if (expected) {
        assert.ok(main.contains(notices[0]), `${slug}: ${id}는 main 안에 있어야 합니다`);
        assert.ok(notices[0].compareDocumentPosition(marker) & browser.Node.DOCUMENT_POSITION_FOLLOWING,
          `${slug}: ${id}는 본문보다 먼저 나와야 합니다`);
      }
    }
    assert.equal(browser.document.querySelectorAll('#mathjax-loader').length, expected ? 1 : 0, `${slug}: 수식 스크립트`);
    if (slug === 'qa-math-post-nested' || slug === 'qa-math-post-nested-auto') {
      const config = [...browser.document.querySelectorAll('script:not([src])')]
        .find(script => script.textContent.includes('window.MathJax ='))?.textContent || '';
      assert.match(config, /elements:\s*\['#post-content'\]/, '중첩 post는 본문만 수식으로 조판해야 합니다');
    }
  } finally {
    await browser.happyDOM.abort();
  }
}
console.log(`일반·중첩 수식 페이지 격리 검증 통과: ${temp}`);
