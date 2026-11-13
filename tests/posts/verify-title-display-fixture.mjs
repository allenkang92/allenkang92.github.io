// 홈과 시리즈 탐색에서 제목 원문 및 링크가 보존되는지 실제 빌드로 확인한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
const temp = await realpath(await mkdtemp(join(tmpdir(), 'post-title-display-fixture-')));
const source = join(temp, 'source');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });

const specialTitle = '<자격증> 기업재난관리사 실무분야 합격 후기 & 정보글';
const recentTitle = '<최근> 둘러보기 & 기록';
const relatedTitle = '<관련> & 자료';
const referenceTitle = '<참고> & 출처';
const seriesTitle = '<시리즈> & 탐색';
const seriesPageTitle = '<목록> & 시리즈';
const mathHubTitle = '<수학> & 허브';
const scienceHubTitle = '<과학> & 허브';
const target = '/posts/title-fixture-special/';
const firstTarget = '/posts/title-fixture-first/';
const recentTarget = '/posts/title-fixture-recent/';
const mathTarget = '/posts/title-fixture-math/';
const scienceTarget = '/posts/title-fixture-science/';
const queryTarget = `${target}?first=1&second=2`;
const frontmatter = (title, order, permalink, date) => `---\nlayout: post\ntitle: ${JSON.stringify(title)}\ndate: ${date} 00:00:00 +0900\npermalink: ${permalink}\nseries: QA-Title-Display\nseries_order: ${order}\nrelated_items:\n  - title: ${JSON.stringify(relatedTitle)}\n    url: ${JSON.stringify(queryTarget)}\nreferences:\n  - title: ${JSON.stringify(referenceTitle)}\n    url: ${JSON.stringify('https://example.com/?first=1&second=2')}\n  - title: ${JSON.stringify('English <title> & link')}\n    url: https://example.com/english\n    lang: en\n    note: 한국어 설명\n  - title: ${JSON.stringify('English <book> & text')}\n    lang: en\n    note: 한국어 설명\n  - title: 한국어 참고자료\n  - title: 언어 속성 이스케이프\n    lang: ${JSON.stringify('en" data-injected="yes')}\n---\n시험 본문\n`;
await writeFile(join(source, '_posts/2025-01-01-title-fixture-first.md'), frontmatter('일반 제목', 1, firstTarget, '2025-01-01'));
await writeFile(join(source, '_posts/2025-02-01-title-fixture-special.md'), frontmatter(specialTitle, 2, target, '2025-02-01'));
await writeFile(join(source, '_posts/2025-01-15-title-fixture-recent.md'), frontmatter(recentTitle, 3, recentTarget, '2025-01-15'));
const hubPost = (series, permalink) => `---\nlayout: post\ntitle: ${JSON.stringify(specialTitle)}\ndate: 2024-01-01 00:00:00 +0900\npermalink: ${permalink}\nseries: ${series}\nseries_order: 30\n---\n시험 본문\n`;
await writeFile(join(source, '_posts/2024-01-01-title-fixture-math.md'), hubPost('Mathematics-Philosophy-History', mathTarget));
await writeFile(join(source, '_posts/2024-01-01-title-fixture-science.md'), hubPost('Science_Philosophy_History', scienceTarget));
await writeFile(join(source, '_posts/2024-01-02-title-fixture-unregistered.md'), hubPost('Unregistered_Fixture_Group', '/posts/title-fixture-unregistered/').replace(specialTitle, '미등록 공개 경로 <공개> & 단서'));
await writeFile(join(source, '_posts/2024-01-02-title-fixture-nonfeatured.md'), hubPost('QA-NotFeatured', '/posts/title-fixture-nonfeatured/').replace(specialTitle, '비추천공개글표식'));
await writeFile(join(source, '_posts/2024-01-03-title-fixture-hidden.md'), hubPost('QA-Title-Display', '/posts/title-fixture-hidden/').replace('layout: post', 'layout: post\npublished: false').replace(specialTitle, '숨긴글검색표식'));
await writeFile(join(source, '_posts/2099-01-03-title-fixture-future.md'), hubPost('QA-Title-Display', '/posts/title-fixture-future/').replace('date: 2024-01-01', 'date: 2099-01-03').replace(specialTitle, '미래글검색표식'));
const dataPath = join(source, '_data/series.yml');
const seriesData = await readFile(dataPath, 'utf8');
const updatedData = seriesData.replace('title: "수학철학·수학사"', `title: ${JSON.stringify(mathHubTitle)}`)
  .replace('title: "과학철학·현대물리학"', `title: ${JSON.stringify(scienceHubTitle)}`);
assert.ok(updatedData.includes(mathHubTitle) && updatedData.includes(scienceHubTitle), '기존 시리즈의 제목 시험 자료가 적용돼야 합니다');
const mixedData = updatedData.replace('    references:\n      - title: "Morris Kline, Mathematical Thought from Ancient to Modern Times"', `    references:\n      - title: ${JSON.stringify('한국어 <자료> & 설명')}\n        lang: ko\n      - title: ${JSON.stringify('제목 언어 미지정')}\n      - ${JSON.stringify('기존 <em>문자열</em>')}\n      - title: "Morris Kline, Mathematical Thought from Ancient to Modern Times"`);
assert.notEqual(mixedData, updatedData, '한글·언어 미지정·기존 문자열 참고자료가 적용돼야 합니다');
await writeFile(dataPath, `${mixedData}\n  - key: QA-Title-Display\n    title: ${JSON.stringify(seriesTitle)}\n    hub_url: ${JSON.stringify('/series/title-fixture/?first=1&second=2')}\n    kicker: ${JSON.stringify('<분류> & 태그')}\n    summary: 시험 시리즈\n    featured: true\n  - key: QA-English-Kicker\n    title: 영어 분류 시험\n    hub_url: /series/english-fixture/\n    kicker: ${JSON.stringify('Research & Practice')}\n    kicker_lang: en\n    summary: 시험 시리즈\n    featured: true\n  - key: QA-NotFeatured\n    title: 비추천비표시제목\n    kicker: 비추천비표시분류\n    summary: 비추천비표시설명\n    featured: false\n`);
const pagePath = join(source, '_pages/series.html');
const page = await readFile(pagePath, 'utf8');
const updatedPage = page.replace(/^title: 시리즈$/m, `title: ${JSON.stringify(seriesPageTitle)}`);
assert.notEqual(updatedPage, page, '시리즈 화면 제목 시험 자료가 적용돼야 합니다');
await writeFile(pagePath, updatedPage);

const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'production', TZ: 'UTC' };
const bundle = process.env.BUNDLE_BIN || 'bundle';
for (const [name, base] of [['root', ''], ['nested', '/blog']]) {
  const output = join(temp, name);
  execFileSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', output, '--baseurl', base], { cwd: repository, env, stdio: 'inherit' });
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const readDocument = async path => {
    const html = await readFile(join(output, path), 'utf8');
    return new browser.DOMParser().parseFromString(html, 'text/html');
  };
  const assertLink = (link, label, href) => {
    assert.ok(link, `${name}: ${label} 링크가 있어야 합니다`);
    assert.equal(link.textContent.trim(), label, `${name}: 표시 제목 원문`);
    assert.equal(link.getAttribute('href'), href, `${name}: 경로와 쿼리 보존`);
    assert.equal(link.children.length, 0, `${name}: 제목이 HTML 요소로 해석되지 않아야 합니다`);
  };
  try {
    const home = await readDocument('index.html');
    assertLink(home.querySelector('#featured-title a'), specialTitle, `${base}${target}`);
    const recent = [...home.querySelectorAll('.post-title a')].find(link => link.getAttribute('href') === `${base}${recentTarget}`);
    assertLink(recent, recentTitle, `${base}${recentTarget}`);
    const normal = [...home.querySelectorAll('.post-title a')].find(link => link.getAttribute('href') === `${base}${firstTarget}`);
    assertLink(normal, '일반 제목', `${base}${firstTarget}`);

    const series = await readDocument('series/index.html');
    assert.equal(series.querySelector('#series-index-title')?.textContent, seriesPageTitle);
    const card = [...series.querySelectorAll('.series-hub-card')].find(link => link.textContent.includes(seriesTitle));
    assert.ok(card, `${name}: 추천 시리즈 제목 원문`);
    assert.equal(card.getAttribute('href'), `${base}/series/title-fixture/?first=1&second=2`);
    assert.equal(card.querySelector('strong')?.textContent, seriesTitle);
    assert.equal(card.querySelector('.series-hub-kicker')?.textContent.trim(), '<분류> & 태그');
    assert.equal(card.querySelector('.series-hub-kicker')?.getAttribute('lang'), null, `${name}: 언어 미지정 분류는 상속합니다`);
    const englishCard = [...series.querySelectorAll('.series-hub-card')].find(link => link.querySelector('strong')?.textContent === '영어 분류 시험');
    assert.equal(englishCard?.querySelector('.series-hub-kicker')?.textContent.trim(), 'Research & Practice');
    assert.equal(englishCard?.querySelector('.series-hub-kicker')?.getAttribute('lang'), 'en');
    for (const label of ['수학', '과학']) {
      const koreanKicker = [...series.querySelectorAll('.series-hub-kicker')].find(element => element.textContent.trim() === label);
      assert.ok(koreanKicker, `${name}: ${label} 분류가 있어야 합니다`);
      assert.equal(koreanKicker.getAttribute('lang'), null, `${name}: 한글 분류에 영어 언어를 지정하지 않습니다`);
    }
    const group = [...series.querySelectorAll('.series-catalog-group')].find(element => element.querySelector('h3')?.textContent === seriesTitle);
    assert.ok(group, `${name}: 시리즈 목록 제목 원문`);
    assert.equal(group.querySelector('.series-catalog-meta a')?.getAttribute('aria-label'), `${seriesTitle} 허브 보기`);
    assertLink([...group.querySelectorAll('ol a')].find(link => link.getAttribute('href') === `${base}${target}`), specialTitle, `${base}${target}`);

    for (const [path, hubTitle, postTarget, englishReferences] of [
      ['series/mathematics-philosophy-history/index.html', mathHubTitle, mathTarget, [
        'Morris Kline, Mathematical Thought from Ancient to Modern Times',
        'Stewart Shapiro, Thinking about Mathematics',
        'Imre Lakatos, Proofs and Refutations',
        'Eugene Wigner, The Unreasonable Effectiveness of Mathematics in the Natural Sciences',
      ]],
      ['series/science-philosophy-history/index.html', scienceHubTitle, scienceTarget, [
        'Alan Chalmers, What Is This Thing Called Science?',
        'Peter Godfrey-Smith, Theory and Reality',
        'David J. Griffiths, Introduction to Elementary Particles',
        'CERN, The Standard Model',
      ]],
    ]) {
      const hub = await readDocument(path);
      assert.equal(hub.querySelector('#series-hub-title')?.textContent, hubTitle, `${name}: 허브 제목 원문`);
      assert.equal(hub.documentElement.getAttribute('lang'), 'ko', `${name}: 기본 문서 언어`);
      assert.equal(hub.querySelector('.series-hub-eyebrow')?.getAttribute('lang'), 'en', `${name}: 영어 허브 표제 언어`);
      const references = [...hub.querySelectorAll('.series-reference-note li')];
      for (const title of englishReferences) {
        const reference = references.find(item => item.textContent === title);
        assert.ok(reference, `${name}: 참고자료 원문 유지: ${title}`);
        assert.equal(reference.getAttribute('lang'), 'en', `${name}: 영어 참고자료 언어: ${title}`);
      }
      if (path.includes('mathematics')) {
        const korean = references.find(item => item.textContent === '한국어 <자료> & 설명');
        assert.equal(korean?.getAttribute('lang'), 'ko', `${name}: 한국어 참고자료`);
        assert.equal(korean?.children.length, 0, `${name}: 새 데이터의 참고자료 제목은 텍스트로 표시`);
        const unspecified = references.find(item => item.textContent === '제목 언어 미지정');
        assert.equal(unspecified?.getAttribute('lang'), null, `${name}: 미지정 언어는 상속`);
        const legacy = references.find(item => item.textContent === '기존 문자열');
        assert.equal(legacy?.getAttribute('lang'), null, `${name}: 기존 문자열 언어는 상속`);
        assert.equal(legacy?.querySelector('em')?.textContent, '문자열', `${name}: 기존 문자열의 표시 계약 보존`);
      }
      assertLink([...hub.querySelectorAll('.series-path-item h3 a')].find(link => link.getAttribute('href') === `${base}${postTarget}`), specialTitle, `${base}${postTarget}`);
    }

    const first = await readDocument('posts/title-fixture-first/index.html');
    assert.equal(first.querySelector('.series-next-link .series-kicker')?.textContent.trim(), `${seriesTitle} 2번째 글`);
    assert.equal(first.querySelector('.series-next-link span:last-child')?.textContent, specialTitle);
    assert.equal(first.querySelector('.series-next-link')?.getAttribute('href'), `${base}${target}`);
    assertLink([...first.querySelectorAll('.post-series-panel a')].find(link => link.getAttribute('href') === `${base}/series/title-fixture/?first=1&second=2`), `${seriesTitle} 허브`, `${base}/series/title-fixture/?first=1&second=2`);
    assertLink([...first.querySelectorAll('.post-series-panel a')].find(link => link.getAttribute('href') === `${base}${queryTarget}`), relatedTitle, `${base}${queryTarget}`);
    assertLink([...first.querySelectorAll('.post-series-panel a')].find(link => link.getAttribute('href') === 'https://example.com/?first=1&second=2'), referenceTitle, 'https://example.com/?first=1&second=2');
    const referenceSection = first.querySelector('#post-references-heading')?.parentElement;
    const references = [...referenceSection.querySelectorAll('li')];
    const englishLink = references.find(item => item.textContent.includes('English <title> & link'));
    assertLink(englishLink?.querySelector('a'), 'English <title> & link', 'https://example.com/english');
    assert.equal(englishLink?.querySelector('a')?.getAttribute('lang'), 'en', `${name}: 영어 링크 제목에만 언어 적용`);
    assert.equal(englishLink?.querySelector('.reference-note')?.getAttribute('lang'), null, `${name}: 한국어 설명은 문서 언어 상속`);
    assert.equal(englishLink?.querySelector('.reference-note')?.textContent.trim(), '한국어 설명');
    const englishText = references.find(item => item.textContent.includes('English <book> & text'));
    assert.equal(englishText?.querySelector('[lang="en"]')?.textContent, 'English <book> & text', `${name}: 링크 없는 제목에 언어 적용 및 원문 보존`);
    assert.equal(englishText?.querySelector('.reference-note')?.getAttribute('lang'), null, `${name}: 링크 없는 제목의 한국어 설명은 상속`);
    const korean = references.find(item => item.textContent.includes('한국어 참고자료'));
    assert.equal(korean?.querySelector('[lang]'), null, `${name}: 언어 미지정 제목은 상속`);
    const escaped = references.find(item => item.textContent.includes('언어 속성 이스케이프'));
    assert.equal(escaped?.querySelector('[lang]')?.getAttribute('lang'), 'en" data-injected="yes', `${name}: 언어 속성 값 이스케이프`);
    assert.equal(escaped?.querySelector('[data-injected]'), null, `${name}: 언어 값으로 속성이 추가되지 않음`);
    assertLink([...first.querySelectorAll('.series-navigation a')].find(link => link.getAttribute('href') === `${base}${target}`), specialTitle, `${base}${target}`);

    const special = await readDocument('posts/title-fixture-special/index.html');
    assert.equal(special.querySelector('h1.post-title')?.textContent, specialTitle);
    assert.equal(special.querySelector('.series-navigation li.current')?.textContent.trim(), specialTitle);
    assertLink([...special.querySelectorAll('.post-series-panel a')].find(link => link.getAttribute('href') === `${base}${firstTarget}`), '이전 글: 일반 제목', `${base}${firstTarget}`);
    const last = await readDocument('posts/title-fixture-recent/index.html');
    assertLink([...last.querySelectorAll('.post-series-panel a')].find(link => link.getAttribute('href') === `${base}${target}`), `이전 글: ${specialTitle}`, `${base}${target}`);

    for (const [postPath, title, linked] of [
      ['posts/3장-수학에서의논리체계/index.html', 'Elliott Mendelson, Introduction to Mathematical Logic', false],
      ['posts/3장-수학에서의논리체계/index.html', 'Stanford Encyclopedia of Philosophy, Classical Logic', true],
      ['posts/css정리/index.html', 'MDN Web Docs, CSS: Cascading Style Sheets', true],
      ['posts/1장-표준-모형-현대물리학의종합/index.html', 'Particle Data Group, Review of Particle Physics', false],
    ]) {
      const actual = await readDocument(postPath);
      const section = actual.querySelector('#post-references-heading')?.parentElement;
      const reference = [...section.querySelectorAll('li')].find(item => item.textContent.trim() === title);
      const element = reference?.querySelector(linked ? 'a' : 'span');
      assert.equal(element?.textContent, title, `${name}: 실제 게시글 참고자료 원문 보존`);
      assert.equal(element?.getAttribute('lang'), 'en', `${name}: 실제 게시글 영어 제목 언어`);
    }

    const index = JSON.parse(await readFile(join(output, 'search.json'), 'utf8'));
    const seriesRow = index.find(entry => new URL(entry.url, 'https://example.com').pathname === `${base}/series/`);
    assert.ok(seriesRow, `${name}: 시리즈 목록 색인`);
    const seriesDecoder = browser.document.createElement('textarea');
    seriesDecoder.innerHTML = seriesRow.content.replace(/</g, '&lt;');
    const normalize = value => value.replace(/\s+/g, ' ').trim();
    const seriesVisible = [];
    for (const card of series.querySelectorAll('.series-hub-card')) {
      for (const selector of ['.series-hub-kicker', 'strong', '.series-hub-count', '.series-hub-summary']) {
        seriesVisible.push(card.querySelector(selector)?.textContent || '');
      }
    }
    for (const item of series.querySelectorAll('.series-catalog-group')) {
      seriesVisible.push(item.querySelector('h3')?.textContent || '', item.querySelector('.series-catalog-count')?.textContent || '');
      for (const post of item.querySelectorAll('.series-catalog-item-copy')) seriesVisible.push(post.querySelector('a')?.textContent || '', post.querySelector('span')?.textContent || '');
    }
    assert.equal(normalize(seriesDecoder.value), normalize(seriesVisible.join(' ')), `${name}: 목록 표시와 검색 색인이 같은 내용·순서여야 합니다`);
    assert.ok(seriesDecoder.value.includes('Unregistered Fixture Group') && seriesDecoder.value.includes('미등록 공개 경로 <공개> & 단서'), `${name}: 미등록 공개 시리즈는 화면대로 포함합니다`);
    assert.ok(seriesDecoder.value.includes('비추천비표시제목') && seriesDecoder.value.includes('비추천공개글표식'), `${name}: 추천하지 않아도 공개 글이 있는 그룹은 목록대로 포함합니다`);
    for (const hidden of ['숨긴글검색표식', '미래글검색표식', '비추천비표시분류', '비추천비표시설명']) {
      assert.ok(!seriesDecoder.value.includes(hidden), `${name}: 표시되지 않는 ${hidden}은 색인하지 않습니다`);
    }
    assert.ok(index.some(entry => entry.type === 'post' && entry.title === specialTitle && new URL(entry.url, 'https://example.com').pathname === `${base}${target}`), `${name}: 검색 색인의 제목 원문`);
    const hubIndex = index.find(entry => new URL(entry.url, 'https://example.com').pathname === `${base}/series/mathematics-philosophy-history/`);
    assert.ok(hubIndex, `${name}: 수학 허브 색인`);
    const decoder = browser.document.createElement('textarea');
    decoder.innerHTML = hubIndex.content.replace(/</g, '&lt;');
    for (const value of [mathHubTitle, '한국어 <자료> & 설명', '제목 언어 미지정', '기존 문자열']) {
      assert.ok(decoder.value.includes(value), `${name}: 허브 색인의 표시 문구 ${value}`);
    }
    assert.doesNotMatch(decoder.value, /<em>|\{[{%]/, `${name}: 허브 원시 마크업·템플릿 제외`);
    const posts = await readDocument('posts/index.html');
    assertLink([...posts.querySelectorAll('.post-preview h2 a')].find(link => link.getAttribute('href') === `${base}${target}`), specialTitle, `${base}${target}`);
  } finally {
    await browser.happyDOM.abort();
  }
}
console.log(`제목 표시 격리 빌드 검증 통과: ${temp}`);
