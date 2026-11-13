// 일반 페이지와 중첩 레이아웃의 수식 안내 위치를 격리 Jekyll 빌드로 확인한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { withTemporaryDirectory } from '../helpers/temporary-directory.mjs';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
await withTemporaryDirectory('math-page-fixture-', async (temp) => {
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

// Markdown 이스케이프를 거친 실제 수식 구분자가 조판 대상에 남는지와
// 자동 감지·명시적 비활성화의 계약을 함께 검사한다.
const delimiterPages = [
  ['qa-md-inline', 'post', '', String.raw`본문 \\(x+1\\)`, String.raw`\(x+1\)`, true],
  ['qa-md-display', 'post', '', String.raw`본문 \\[x+1\\]`, String.raw`\[x+1\]`, true],
  ['qa-md-environment', 'post', '', String.raw`본문 \begin{equation}x+1\end{equation}`, String.raw`\begin{equation}`, true],
  ['qa-md-post-nested', 'qa-math-post-nested', '', String.raw`본문 \\(x+1\\)`, String.raw`\(x+1\)`, true],
  ['qa-md-false', 'post', 'math: false', String.raw`본문 \\(x+1\\)`, String.raw`\(x+1\)`, false],
  ['qa-md-single-slashes', 'post', '', String.raw`본문 \(x+1\)`, '(x+1)', false],
  ['qa-md-ordinary-slashes', 'post', '', String.raw`경로 C:\\test\\note`, String.raw`C:\test\note`, false],
  ['qa-md-open-only', 'post', '', String.raw`여는 표기 \\(만 있습니다`, String.raw`\(`, false],
  ['qa-md-default', 'default', '', String.raw`본문 \\(x+1\\)`, String.raw`\(x+1\)`, false],
  ['qa-md-default-enabled', 'default', 'math: true', String.raw`본문 \\(x+1\\)`, String.raw`\(x+1\)`, true],
];
for (const [slug, layout, flag, content] of delimiterPages) {
  const data = `---\nlayout: ${layout}\ntitle: 구분자 시험\npermalink: /${slug}/\n${flag}\n---\n${content}\n`;
  await writeFile(join(source, '_pages', `${slug}.md`), data);
}

const htmlDelimiterPages = [
  ['qa-html-inline', 'post', '', String.raw`<p>본문 \(x+1\)</p>`, true],
  ['qa-html-false', 'post', 'math: false', String.raw`<p>본문 \(x+1\)</p>`, false],
  ['qa-html-entity', 'post', '', '<p>본문 &#92;(x+1&#92;)</p>', false],
  ['qa-html-entity-enabled', 'post', 'math: true', '<p>본문 &#92;(x+1&#92;)</p>', true],
];
for (const [slug, layout, flag, content] of htmlDelimiterPages) {
  const data = `---\nlayout: ${layout}\ntitle: HTML 구분자 시험\npermalink: /${slug}/\n${flag}\n---\n${content}\n`;
  await writeFile(join(source, '_pages', `${slug}.html`), data);
}

const postSlug = 'qa-real-post-delimiter';
await writeFile(join(source, '_posts', `2024-01-01-${postSlug}.md`), `---\nlayout: post\ntitle: 게시 글 구분자 시험\npermalink: /${postSlug}/\n---\n${String.raw`본문 \\(x+1\\)`}\n`);
const extraPosts = [
  ['qa-post-single', 'title: 단일 역슬래시', String.raw`본문 \(x+1\)`],
  ['qa-post-meta-title', String.raw`title: '제목 \(x\)'`, '일반 본문입니다.'],
  ['qa-post-meta-outcome', `title: 학습 목표\nlearning_outcomes:\n  - '${String.raw`목표 \(x\)`}'`, '일반 본문입니다.'],
  ['qa-post-meta-reference', `title: 참고 자료\nreferences:\n  - title: '${String.raw`자료 \(x\)`}'`, '일반 본문입니다.'],
];
for (const [slug, metadata, body] of extraPosts) {
  await writeFile(join(source, '_posts', `2024-01-01-${slug}.md`), `---\nlayout: post\n${metadata}\npermalink: /${slug}/\n---\n${body}\n`);
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

for (const [slug, , , , expectedText, expectedLoader] of delimiterPages) {
  const html = await readFile(join(output, slug, 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    browser.document.write(html);
    const main = browser.document.querySelector('main#main-content');
    assert.ok(main, `${slug}: 본문 영역이 있어야 합니다`);
    assert.ok(main.textContent.includes(expectedText), `${slug}: Markdown 변환 뒤 구분자 상태가 달라졌습니다`);
    assert.equal(browser.document.querySelectorAll('#mathjax-loader').length, expectedLoader ? 1 : 0, `${slug}: 수식 스크립트`);
    for (const id of ['math-load-delay', 'math-load-error']) {
      assert.equal(browser.document.querySelectorAll(`#${id}`).length, expectedLoader ? 1 : 0, `${slug}: 수식 안내 중복 또는 누락`);
    }
  } finally {
    await browser.happyDOM.abort();
  }
}
for (const [slug, , , , expectedLoader] of htmlDelimiterPages) {
  const html = await readFile(join(output, slug, 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    browser.document.write(html);
    assert.ok(browser.document.querySelector('main#main-content')?.textContent.includes(String.raw`\(x+1\)`), `${slug}: HTML 구분자가 유지되어야 합니다`);
    assert.equal(browser.document.querySelectorAll('#mathjax-loader').length, expectedLoader ? 1 : 0, `${slug}: 수식 스크립트`);
    for (const id of ['math-load-delay', 'math-load-error']) {
      assert.equal(browser.document.querySelectorAll(`#${id}`).length, expectedLoader ? 1 : 0, `${slug}: 수식 안내 중복 또는 누락`);
    }
  } finally {
    await browser.happyDOM.abort();
  }
}
{
  const html = await readFile(join(output, postSlug, 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    browser.document.write(html);
    assert.ok(browser.document.querySelector('#post-content')?.textContent.includes(String.raw`\(x+1\)`), '실제 게시 글에서 Markdown 수식이 유지되어야 합니다');
    assert.equal(browser.document.querySelectorAll('#mathjax-loader').length, 1, '실제 게시 글에서 수식 스크립트가 필요합니다');
    for (const id of ['math-load-delay', 'math-load-error']) {
      assert.equal(browser.document.querySelectorAll(`#${id}`).length, 1, '실제 게시 글에 수식 안내가 한 번 있어야 합니다');
    }
  } finally {
    await browser.happyDOM.abort();
  }
}
for (const [slug] of extraPosts) {
  const html = await readFile(join(output, slug, 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    browser.document.write(html);
    for (const id of ['mathjax-loader', 'math-load-delay', 'math-load-error']) {
      assert.equal(browser.document.querySelectorAll(`#${id}`).length, 0, `${slug}: 본문에 수식이 없으면 로더와 안내가 없어야 합니다`);
    }
    if (slug === 'qa-post-single') {
      assert.ok(browser.document.querySelector('#post-content')?.textContent.includes('(x+1)'), '단일 역슬래시는 Markdown 변환에서 제거됩니다');
    }
  } finally {
    await browser.happyDOM.abort();
  }
}

// 하위 경로에 게시하더라도 같은 본문·명시 설정에 대해 로더와 안내가 일치해야 한다.
const subpathOutput = join(temp, 'site-subpath');
const configPath = join(source, '_config.yml');
const rootConfig = await readFile(configPath, 'utf8');
assert.match(rootConfig, /^baseurl:.*$/m, '시험 설정에 baseurl이 필요합니다');
await writeFile(configPath, rootConfig.replace(/^baseurl:.*$/m, 'baseurl: "/blog"'));
execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', subpathOutput], { cwd: repository, env, stdio: 'inherit' });
const subpathCases = [
  ...pages.map(([slug, , , expected]) => [slug, expected]),
  ...delimiterPages.map(([slug, , , , , expected]) => [slug, expected]),
  ...htmlDelimiterPages.map(([slug, , , , expected]) => [slug, expected]),
  [postSlug, true],
  ...extraPosts.map(([slug]) => [slug, false]),
];
for (const [slug, expected] of subpathCases) {
  const html = await readFile(join(subpathOutput, slug, 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    browser.document.write(html);
    for (const id of ['mathjax-loader', 'math-load-delay', 'math-load-error']) {
      assert.equal(browser.document.querySelectorAll(`#${id}`).length, expected ? 1 : 0, `${slug}: /blog 배포의 ${id} 감지가 달라졌습니다`);
    }
  } finally {
    await browser.happyDOM.abort();
  }
}
});
console.log(`일반·중첩 수식 페이지 격리 검증 통과`);
