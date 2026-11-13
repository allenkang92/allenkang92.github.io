// 개별 글의 scripts·styles와 공통 복사 자산이 공존하는지 격리 빌드로 확인한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
const temp = await realpath(await mkdtemp(join(tmpdir(), 'code-copy-fixture-')));
const source = join(temp, 'source');
const output = join(temp, 'site');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });
const post = `---
layout: post
title: 코드 복사 검증
description: 코드 복사 자산을 검증하는 글입니다.
date: 2024-01-01 00:00:00 +0900
permalink: /posts/qa-code-copy/
scripts:
  - /assets/js/tools.js
  - /assets/js/code-copy.js
styles:
  - /assets/css/posts-refinement.css
  - /assets/css/code-copy.css
---

\`\`\`html
<p>한글 &amp; 코드</p>
\`\`\`
`;
await writeFile(join(source, '_posts/2024-01-01-qa-code-copy.md'), post);
const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'production', TZ: 'UTC' };
execFileSync(process.env.BUNDLE_BIN || 'bundle', ['exec', 'github-pages', 'build', '--source', source, '--destination', output], { cwd: repository, env, stdio: 'inherit' });
const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
try {
  browser.document.write(await readFile(join(output, 'posts/qa-code-copy/index.html'), 'utf8'));
  const pathsOf = (selector, attribute) => [...browser.document.querySelectorAll(selector)].map(element => new URL(element.getAttribute(attribute), 'https://blog.test/').pathname);
  const scripts = pathsOf('script[src]', 'src');
  const styles = pathsOf('link[rel="stylesheet"]', 'href');
  assert.equal(scripts.filter(path => path === '/assets/js/code-copy.js').length, 1, '명시된 공통 스크립트는 중복하지 않는다');
  assert.equal(scripts.filter(path => path === '/assets/js/tools.js').length, 1, '글에서 지정한 스크립트를 보존한다');
  assert.equal(styles.filter(path => path === '/assets/css/code-copy.css').length, 1);
  assert.equal(styles.filter(path => path === '/assets/css/posts-refinement.css').length, 1, '글에서 지정한 스타일을 보존한다');
  assert.equal(browser.document.querySelector('#post-content pre.highlight code')?.textContent, '<p>한글 &amp; 코드</p>\n');
} finally { await browser.happyDOM.abort(); }
console.log(`글별 자산과 코드 예제 격리 검증 통과: ${temp}`);
