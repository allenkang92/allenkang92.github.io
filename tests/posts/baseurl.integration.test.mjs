import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const siteRoot = process.env.SITE_ROOT || resolve('_site');
const baseurl = process.env.SITE_BASEURL || '';

test('the DSR link and PDF preview respect the configured base URL', async () => {
  const browser = new Window({ url: 'https://blog.test/' });
  try {
    browser.document.body.innerHTML = await readFile(resolve(siteRoot, 'tools/dsr-calculator/index.html'), 'utf8');
    assert.equal(browser.document.querySelector('.tool-landing__cta').getAttribute('href'), `${baseurl}/tools/`);
    browser.document.body.innerHTML = await readFile(resolve(siteRoot, 'posts/기업재난관리사-합격후기/index.html'), 'utf8');
    const iframe = browser.document.querySelector('iframe[title="기업재난관리사 실무분야 합격 후기 PDF 미리보기"]');
    const source = iframe.getAttribute('src');
    assert.ok(source.startsWith(`${baseurl}/assets/images/`));
    assert.equal(iframe.querySelector('a').getAttribute('href'), source);
    assert.match(decodeURIComponent(source), /기업재난관리사실무분야합격후기&정보글\.pdf$/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('정적 글 목록은 특수문자가 포함된 실제 제목을 원문 텍스트로 표시한다', async () => {
  const browser = new Window({ url: `https://blog.test${baseurl}/` });
  try {
    browser.document.body.innerHTML = await readFile(resolve(siteRoot, 'posts/index.html'), 'utf8');
    const card = [...browser.document.querySelectorAll('#posts-static-fallback .post-preview')]
      .find(element => element.dataset.title?.includes('기업재난관리사'));
    assert.ok(card);
    assert.equal(card.querySelector('h2 a')?.textContent, card.dataset.title);
    assert.match(card.querySelector('h2 a')?.textContent || '', /^<자격증>.* & 정보글$/);
    assert.equal(card.querySelector('h2 자격증'), null);
    const fallbackNote = browser.document.querySelector('#posts-static-fallback .posts-fallback-note');
    assert.match(fallbackNote?.textContent || '', /검색어와 주제·정렬·페이지 조건이 적용되지 않으며 성과·시리즈·도구/);
    assert.equal(fallbackNote?.querySelector('a')?.getAttribute('href'), `${baseurl}/achievements/`);
  } finally { await browser.happyDOM.abort(); }
});

test('정적 글 목록은 소개 페이지의 주제 링크로 열어도 조건 미적용을 안내한다', async () => {
  const browser = new Window({
    url: `https://blog.test${baseurl}/posts/?category=web_technologies&sort=relevance&page=2`,
    settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true },
  });
  try {
    const about = new browser.DOMParser().parseFromString(await readFile(resolve(siteRoot, 'about/index.html'), 'utf8'), 'text/html');
    const link = [...about.querySelectorAll('a[href]')].find(anchor => anchor.textContent.includes('웹 접근성'));
    assert.equal(link?.getAttribute('href'), `${baseurl}/posts/?category=web_technologies`);
    browser.document.write(await readFile(resolve(siteRoot, 'posts/index.html'), 'utf8'));
    const fallback = browser.document.querySelector('#posts-static-fallback');
    assert.ok(fallback && !fallback.hidden, '스크립트 없이 전체 글 목록을 표시한다');
    assert.ok(browser.document.querySelector('#posts-react-root')?.hidden);
    assert.match(fallback.querySelector('.posts-fallback-note')?.textContent || '', /검색어와 주제·정렬·페이지 조건이 적용되지 않으며/);
    const categories = new Set([...fallback.querySelectorAll('.post-preview')]
      .flatMap(card => (card.dataset.categories || '').split(/\s+/).filter(Boolean)));
    assert.ok(categories.has('web_technologies'));
    assert.ok([...categories].some(category => category !== 'web_technologies'), '폴백은 필터된 결과가 아닌 전체 글이다');
  } finally { await browser.happyDOM.abort(); }
});

test('web manifest and robots URLs honor the site base path', async () => {
  const manifest = JSON.parse(await readFile(resolve(siteRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.start_url, `${baseurl}/`);
  assert.ok(manifest.icons.length > 0);
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith(`${baseurl}/assets/`), `icon is not under base path: ${icon.src}`);
    await access(resolve(siteRoot, icon.src.slice(baseurl.length + 1)));
  }

  const robots = await readFile(resolve(siteRoot, 'robots.txt'), 'utf8');
  const robotLines = robots.split(/\r?\n/);
  assert.ok(robotLines.includes(`Sitemap: https://allenkang92.github.io${baseurl}/sitemap.xml`));
  assert.ok(robotLines.includes(`Disallow: ${baseurl}/404.html`));
  await access(resolve(siteRoot, 'sitemap.xml'));
});

test('Jekyll does not publish TypeScript test compilation output', async () => {
  await assert.rejects(access(resolve(siteRoot, 'build')));
});

test('성과 화면은 영어 원문과 한국어 안내의 언어를 구분한다', async () => {
  const browser = new Window({ url: `https://blog.test${baseurl}/` });
  try {
    const doc = browser.document;
    doc.write(await readFile(resolve(siteRoot, 'achievements/index.html'), 'utf8'));
    assert.equal(doc.querySelector('.achievements-header h1')?.textContent.trim(), '성과');
    assert.equal(doc.querySelector('.achievements-header h1')?.closest('[lang]')?.getAttribute('lang'), 'ko', '한국어 제목은 기본 언어를 유지한다');
    const cards = [...doc.querySelectorAll('.achievements-timeline .achievement-card')];
    assert.equal(cards.length, 5);
    for (const card of cards) {
      assert.equal(card.querySelector('.achievement-date'), null, '검증되지 않은 날짜를 성과 발생일로 표시하지 않는다');
      for (const element of card.querySelectorAll('h2 a, .achievement-overview, .achievement-highlights li, .tech-stack li')) {
        assert.equal(element.getAttribute('lang'), 'en', `${element.textContent}: 영어 원문 언어 표시`);
      }
      assert.equal(card.querySelector('.achievement-tech h3')?.closest('[lang]')?.getAttribute('lang'), 'ko', '한국어 안내는 기본 언어를 유지한다');
    }

    for (const slug of ['awards', 'certificates', 'education', 'leadership', 'publications']) {
      doc.open();
      doc.write(await readFile(resolve(siteRoot, 'achievements', slug, 'index.html'), 'utf8'));
      doc.close();
      const title = doc.querySelector('.achievement-header h1');
      assert.equal(title?.getAttribute('lang'), 'en', `${slug}: 제목 언어`);
      assert.equal(doc.querySelector('.achievement-header time'), null, `${slug}: 검증되지 않은 날짜를 표시하지 않는다`);
      for (const element of doc.querySelectorAll('.achievement-overview, .achievement-highlights li, .tech-stack li, .achievement-navigation .nav-title')) {
        assert.equal(element.getAttribute('lang'), 'en', `${slug}: ${element.textContent}`);
      }
      for (const heading of doc.querySelectorAll('#achievement-highlights-heading, #achievement-tech-heading')) {
        assert.equal(heading.closest('[lang]')?.getAttribute('lang'), 'ko', `${slug}: 한국어 제목은 기본 언어를 유지한다`);
      }
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('성과 목록과 상세 탐색 링크가 현재 사이트 경로의 실제 상세 페이지로 연결된다', async () => {
  const browser = new Window({ url: `https://blog.test${baseurl}/` });
  try {
    const slugs = ['awards', 'certificates', 'education', 'leadership', 'publications'];
    const doc = browser.document;
    doc.body.innerHTML = await readFile(resolve(siteRoot, 'achievements/index.html'), 'utf8');
    const listLinks = Array.from(doc.querySelectorAll('.achievements-timeline .achievement-card h2 a'));
    assert.equal(listLinks.length, slugs.length, '성과 목록의 모든 제목은 상세 페이지 링크여야 한다');
    assert.deepEqual(new Set(listLinks.map(link => link.getAttribute('href'))),
      new Set(slugs.map(slug => `${baseurl}/achievements/${slug}/`)));

    let navigationCount = 0;
    let relatedCount = 0;
    for (const slug of slugs) {
      doc.body.innerHTML = await readFile(resolve(siteRoot, 'achievements', slug, 'index.html'), 'utf8');
      const navLinks = Array.from(doc.querySelectorAll('.achievement-navigation .nav-previous, .achievement-navigation .nav-next'));
      const relatedLinks = Array.from(doc.querySelectorAll('.related-achievements a.achievement-link'));
      for (const link of relatedLinks) {
        assert.equal(link.querySelector('.achievement-date'), null, `${slug}: 관련 성과에 검증되지 않은 날짜를 표시하지 않는다`);
      }
      navigationCount += navLinks.length;
      relatedCount += relatedLinks.length;
      for (const link of [...navLinks, ...relatedLinks]) {
        const href = link.getAttribute('href');
        assert.ok(href.startsWith(`${baseurl}/achievements/`), `${slug}: ${href}`);
        const path = decodeURIComponent(new URL(href, 'https://blog.test/').pathname).slice(baseurl.length + 1);
        await access(resolve(siteRoot, path, 'index.html'));
      }
    }
    assert.equal(navigationCount, 2 * (slugs.length - 1));
    if (process.env.SITE_EXPECT_RELATED === '1') {
      assert.ok(relatedCount > 0, '시험용 관련 성과 링크가 생성되어야 한다');
    }
  } finally {
    await browser.happyDOM.abort();
  }
});
