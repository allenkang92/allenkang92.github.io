// 설정의 텍스트와 링크가 실제 페이지에서 원문 그대로 표시되는지 확인한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
const temp = await realpath(await mkdtemp(join(tmpdir(), 'sidebar-labels-fixture-')));
const source = join(temp, 'source');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });

const siteTitle = '<Garden> & Lab "Q" &amp;';
const homeTitle = '<Home> & About "Q" &amp;';
const queryTitle = '<링크> & 자료';
const configPath = join(source, '_config.yml');
const config = await readFile(configPath, 'utf8');
const modified = config.replace(/^title:.*$/m, `title: ${JSON.stringify(siteTitle)}\nseo_plain_name: ${JSON.stringify('& Lab "Q" &')}`);
assert.notEqual(modified, config);
await writeFile(configPath, `${modified}\nlinkedin_username: test-linkedin\ntwitter_username: test-twitter\n`);
await writeFile(join(source, '_data/navigation.yml'), `main:\n  - title: ${JSON.stringify(homeTitle)}\n    url: /\n  - title: 글\n    url: /posts/\n  - title: ${JSON.stringify(queryTitle)}\n    url: "/tools/?first=1&second=2"\n`);

const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'production', TZ: 'UTC' };
for (const [name, base] of [['root', ''], ['subpath', '/blog']]) {
  const output = join(temp, name);
  execFileSync(process.env.BUNDLE_BIN || 'bundle', ['exec', 'jekyll', 'build', '--source', source, '--destination', output, '--baseurl', base], { cwd: repository, env, stdio: 'inherit' });
  const browser = new Window({ url: `https://example.test${base}/` });
  try {
    browser.document.write(await readFile(join(output, 'index.html'), 'utf8'));
    const brand = browser.document.querySelector('.sidebar-brand .site-title');
    assert.equal(brand?.textContent, siteTitle, `${name}: 사이트 제목 원문`);
    assert.equal(brand?.getAttribute('href'), `${base}/`, `${name}: 사이트 첫 화면 링크`);
    const links = [...browser.document.querySelectorAll('.sidebar-right .nav-link')];
    assert.equal(links.length, 3);
    assert.equal(links[0].querySelector('span')?.textContent, homeTitle, `${name}: 제목 문자참조 원문`);
    assert.equal(links[0].getAttribute('aria-current'), 'page', `${name}: 현재 페이지 표시`);
    assert.equal(links[1].querySelector('span')?.textContent, '글', `${name}: 일반 제목`);
    assert.equal(links[1].getAttribute('href'), `${base}/posts/`);
    assert.equal(links[2].querySelector('span')?.textContent, queryTitle);
    assert.equal(links[2].getAttribute('href'), `${base}/tools/?first=1&second=2`, `${name}: 쿼리 링크`);
    assert.ok(browser.document.querySelector('.sidebar-right nav[aria-label="주요 메뉴"]'));
    assert.ok(browser.document.querySelector('.sidebar-brand p')?.textContent.includes('Striving for a better tomorrow'));
    const socialLinks = [...browser.document.querySelectorAll('.social-links .social-link')];
    assert.equal(socialLinks.length, 3, `${name}: 소셜 링크 세 개`);
    assert.match(browser.document.querySelector('.social-links small')?.textContent || '', /새 탭에서 열림/, `${name}: 표시되는 새 탭 안내`);
    for (const link of socialLinks) {
      assert.match(link.getAttribute('aria-label') || '', /새 탭에서 열림/, `${name}: 스크린리더 이름의 새 탭 안내`);
      assert.equal(link.target, '_blank');
      assert.ok(link.relList.contains('noopener'));
      assert.ok(link.relList.contains('noreferrer'));
    }
    assert.ok(browser.document.querySelector('#main-content'), `${name}: 본문 유지`);
    const postsPage = new browser.DOMParser().parseFromString(await readFile(join(output, 'posts/index.html'), 'utf8'), 'text/html');
    const postsLink = [...postsPage.querySelectorAll('.sidebar-right .nav-link')].find(link => link.getAttribute('href') === `${base}/posts/`);
    assert.equal(postsLink?.getAttribute('aria-current'), 'page', `${name}: 글 목록 현재 위치`);
    const toolsPage = new browser.DOMParser().parseFromString(await readFile(join(output, 'tools/index.html'), 'utf8'), 'text/html');
    assert.ok(toolsPage.querySelector('.sidebar-right form[role="search"]'), `${name}: 빠른 검색 유지`);
  } finally { await browser.happyDOM.abort(); }
}
console.log(`사이드바 제목 격리 빌드 검증 통과: ${temp}`);
