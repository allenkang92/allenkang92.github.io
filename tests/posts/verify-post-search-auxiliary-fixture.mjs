// 글에 표시된 참고자료와 학습 목표가 검색 색인과 제한된 폴백에 들어가는지 확인한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { withTemporaryDirectory } from '../helpers/temporary-directory.mjs';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
await withTemporaryDirectory('post-search-auxiliary-', async (temp) => {
const source = join(temp, 'source');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });

const publicTitle = '참고자료 <원문> &amp; 탐색 <img src=x onerror=alert(1)>';
const publicNote = '자료 <em>설명검색어</em> &amp; 해석';
const secretUrl = 'https://example.test/not-indexed-reference-only';
const content = '본문'.repeat(1500);
const fixture = `---
layout: post
title: 참고자료 검색 시험
description: 참고자료 검색을 검증하는 글입니다.
date: 2024-01-01 00:00:00 +0900
permalink: /posts/reference-search-fixture/
series: Science_Philosophy_History
series_order: 999
learning_outcomes:
  - "첫번째 목표"
  - "<em>두번째</em> 목표"
  - "세번째 목표"
  - "숨겨진네번째목표"
references:
  - title: ${JSON.stringify(publicTitle)}
    url: ${JSON.stringify(secretUrl)}
    note: ${JSON.stringify(publicNote)}
  - title: "중복참고자료"
  - title: "중복참고자료"
  - title: 317251
  - title: false
  - note: "제목없는 노트"
---

${content}
`;
const hidden = `---
layout: post
title: 시리즈 없는 참고자료 시험
description: 표시되지 않는 참고자료를 검증하는 글입니다.
date: 2024-01-02 00:00:00 +0900
permalink: /posts/no-reference-fixture/
references:
  - title: "시리즈없음미표시참고자료"
    note: "시리즈없음미표시설명"
---

기본 본문입니다.
`;
await writeFile(join(source, '_posts/2024-01-01-reference-search-fixture.md'), fixture);
await writeFile(join(source, '_posts/2024-01-02-no-reference-fixture.md'), hidden);
const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'production', TZ: 'UTC' };
const bundle = process.env.BUNDLE_BIN || 'bundle';
const configPath = join(source, '_config.yml');
const originalConfig = await readFile(configPath, 'utf8');
assert.match(originalConfig, /^baseurl:.*$/m, '기저 경로 설정이 있어야 합니다');

for (const [name, base] of [['root', ''], ['nested', '/blog']]) {
  const output = join(temp, name);
  await writeFile(configPath, originalConfig.replace(/^baseurl:.*$/m, `baseurl: ${JSON.stringify(base)}`));
  execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', output], { cwd: repository, env, stdio: 'inherit' });
  const rows = JSON.parse(await readFile(join(output, 'search.json'), 'utf8'));
  const row = rows.find(item => item.type === 'post' && new URL(item.url).pathname === `${base}/posts/reference-search-fixture/`);
  const hiddenRow = rows.find(item => item.type === 'post' && new URL(item.url).pathname === `${base}/posts/no-reference-fixture/`);
  assert.ok(row && hiddenRow, `${name}: 시험 글 색인이 필요합니다`);
  const browser = new Window({ url: `https://preview.test${base}/posts/` });
  try {
    browser.document.write(await readFile(join(output, 'posts/index.html'), 'utf8'));
    const cards = [...browser.document.querySelectorAll('#posts-static-fallback .post-preview')];
    const card = cards.find(item => item.dataset.title === '참고자료 검색 시험');
    const hiddenCard = cards.find(item => item.dataset.title === '시리즈 없는 참고자료 시험');
    assert.ok(card && hiddenCard, `${name}: 폴백 글 목록이 필요합니다`);
    const decoder = browser.document.createElement('textarea');
    const decode = value => { decoder.innerHTML = value.replace(/</g, '&lt;'); return decoder.value; };
    const searchContent = decode(row.content);
    const fallbackContent = decode(card.dataset.content);
    for (const value of [searchContent, fallbackContent]) {
      for (const text of [publicTitle, '설명검색어 & 해석', '첫번째 목표', '두번째 목표', '세번째 목표', '317251', '제목없는 노트']) {
        assert.ok(value.includes(text), `${name}: 표시 문구가 검색에서 누락됐습니다: ${text}`);
      }
      assert.doesNotMatch(value, /숨겨진네번째목표|not-indexed-reference-only/, `${name}: 표시하지 않는 목표와 주소는 검색하지 않습니다`);
      assert.equal(value.split('중복참고자료').length - 1, 2, `${name}: 화면에 중복 표시한 제목을 보존합니다`);
      assert.match(value, /첫번째 목표 두번째 목표 세번째 목표/, `${name}: 학습 목표 사이의 공백을 보존합니다`);
      assert.match(value, /세번째 목표 참고자료 <원문>/, `${name}: 학습 목표와 참고자료 사이의 공백을 보존합니다`);
      assert.match(value, /중복참고자료 중복참고자료/, `${name}: 참고자료 사이의 공백을 보존합니다`);
      assert.match(value, /중복참고자료 중복참고자료 317251 false 제목없는 노트/, `${name}: 숫자·불리언 제목과 제목 없는 설명을 실제 표시와 같이 다룹니다`);
    }
    assert.match(searchContent, /본문 첫번째 목표/, `${name}: 전체 본문과 학습 목표 사이 공백을 보존합니다`);
    assert.match(fallbackContent, /\.\.\. 첫번째 목표/, `${name}: 잘린 본문과 학습 목표 사이 공백을 보존합니다`);
    for (const value of [decode(hiddenRow.content), decode(hiddenCard.dataset.content)]) {
      assert.doesNotMatch(value, /시리즈없음미표시참고자료|시리즈없음미표시설명/, `${name}: 시리즈가 없으면 참고자료를 표시하거나 색인하지 않습니다`);
    }
    assert.ok(fallbackContent.indexOf(publicTitle) > 2400, `${name}: 긴 본문을 잘라도 참고자료는 남아야 합니다`);
    const postBrowser = new Window();
    try {
      postBrowser.document.write(await readFile(join(output, 'posts/reference-search-fixture/index.html'), 'utf8'));
      assert.equal(postBrowser.document.querySelector('[aria-labelledby="post-references-heading"] a')?.textContent, publicTitle);
      assert.equal(postBrowser.document.querySelector('[aria-labelledby="post-references-heading"] img'), null, '리터럴 제목을 이미지 태그로 해석하지 않습니다');
      assert.equal(postBrowser.document.querySelectorAll('.post-learning-outcomes li').length, 3);
    } finally { await postBrowser.happyDOM.abort(); }
  } finally { await browser.happyDOM.abort(); }
}
});
console.log(`글 참고자료·학습 목표 검색 격리 빌드 검증 통과`);
