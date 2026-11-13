import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const siteRoot = process.env.SITE_ROOT ? resolve(process.env.SITE_ROOT) : resolve(projectRoot, '_site');

test('수학 글의 서로 다른 예시와 기호 설명은 구분된 항목으로 표시된다', async () => {
  const cases = [
    ['1장-시대와지역에따른수학발전', [
      ['현대 표기에서는', '\\dfrac{3}{4}'],
      ['삼각형의 면적:', '원주율의 근사값:'],
      ['양수는 빨간색 막대', '방정식 풀이에서 음수를 활용'],
      ['0을 뜻하는 산스크리트어 낱말:', '1부터 9까지의 숫자'],
    ]],
    ['2장-수학과무한', [
      ['자연수 집합', '정수 집합', '유리수 집합'],
      ['실수 집합', '실수 구간'],
    ]],
    ['5장-확률과통계의철학적의미', [
      ['사건 $B$가 주어졌을 때 사건 $A$의 조건부 확률', '사건 $A$가 주어졌을 때 사건 $B$의 조건부 확률', '사건 $A$의 사전 확률', '증거 $B$가 관찰될 전체 확률'],
    ]],
  ];

  for (const [slug, groups] of cases) {
    const html = await readFile(resolve(siteRoot, 'posts', slug, 'index.html'), 'utf8');
    const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
    try {
      browser.document.write(html);
      const lists = [...browser.document.querySelectorAll('.post-content ul')];
      for (const terms of groups) {
        const list = lists.find(candidate => terms.every(term => candidate.textContent.includes(term)));
        assert.ok(list, `${slug}: 서로 다른 예시가 하나의 목록으로 표시되어야 합니다: ${terms.join(', ')}`);
        const items = [...list.children].filter(element => element.tagName === 'LI');
        for (const term of terms) {
          assert.equal(items.filter(item => item.textContent.includes(term)).length, 1, `${slug}: ${term}`);
        }
        assert.equal(new Set(terms.map(term => items.find(item => item.textContent.includes(term)))).size, terms.length,
          `${slug}: 각 설명은 별도의 항목이어야 합니다`);
      }
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('오일러 항등식의 잘못된 해석과 그에 대한 설명은 구분된 문단으로 표시된다', async () => {
  const html = await readFile(resolve(siteRoot, 'posts', '4장-수학적증명과오류의논리', 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  try {
    browser.document.write(html);
    const paragraphs = [...browser.document.querySelectorAll('.post-content p')];
    const incorrect = paragraphs.find(p => p.textContent.includes('로그를 취해') && p.textContent.includes('단정'));
    assert.ok(incorrect);
    assert.doesNotMatch(incorrect.textContent, /그러나 실수 범위/);
    assert.match(incorrect.nextElementSibling?.textContent || '', /^그러나 실수 범위/);
    assert.equal(incorrect.nextElementSibling?.tagName, 'P');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('CSS 정리 글의 코드 예제는 실제 요소가 아닌 코드 블록으로 표시된다', async () => {
  const html = await readFile(resolve(siteRoot, 'posts', 'css정리', 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  try {
    browser.document.write(html);
    const content = browser.document.querySelector('.post-content');
    assert.ok(content, '글 본문이 있어야 합니다');
    const snippets = [...content.querySelectorAll('pre code')].map(code => code.textContent.trim());
    for (const example of [
      '<p style="color: blue;">This is a blue text.</p>',
      '<head>\n  <style>\n    p { color: blue; }\n  </style>\n</head>',
      '<head>\n <link rel = "stylesheet" href = "./styles.css">\n</head>',
      '@import url("another-stylesheet.css");',
      'p { color: blue; }',
      '.highlight { background-color: yellow; }',
      '#header { font-size: 24px; }',
      '* { margin: 0; padding: 0; }',
      'div p { font-style: italic; }',
      'ul > li { list-style-type: square; }',
      'h1 + p { font-weight: bold; }',
      'p { color: red !important; }',
      '#header .nav { color: blue; }  /* 더 구체적이므로 우선 적용 */\nnav { color: green; }',
    ]) {
      assert.ok(snippets.includes(example), `예제가 코드 블록에서 원문대로 표시되어야 합니다: ${example}`);
    }
    assert.doesNotMatch(content.textContent, /```(?:html|css)?/, '코드 펜스가 본문에 노출되면 안 됩니다');
    assert.equal(content.querySelector('p[style="color: blue;"]'), null, '예제가 실제 HTML 요소로 실행되면 안 됩니다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('Jekyll output serves the Vite entry and preserves the full static posts fallback', async () => {
  const pagePath = resolve(siteRoot, 'posts/index.html');
  const page = await readFile(pagePath, 'utf8');
  const fallback = /<section\b[^>]*id="posts-static-fallback"[\s\S]*?<\/section>/.exec(page)?.[0];
  assert.ok(fallback, 'posts page must contain a static fallback region');
  assert.match(page, /id="posts-react-root"[^>]*hidden/);

  const cards = Array.from(fallback.matchAll(/<article\b[^>]*class="post-preview(?:\s[^\"]*)?"[^>]*>/g));
  const searchEntries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const posts = searchEntries.filter(entry => entry.type === 'post');
  assert.ok(posts.length > 0, '검색 색인에 글이 있어야 합니다');
  assert.equal(cards.length, posts.length, '모든 글을 자바스크립트 없이 볼 수 있어야 합니다');
  assert.equal(cards.some(([card]) => /class="[^"]*\bhidden\b/.test(card)), false);
  assert.equal((fallback.match(/<h2><a\b/g) || []).length, posts.length, 'every fallback item must retain its article link');
  const proofCard = cards.find(([card]) => card.includes('data-title="4장: 수학적 증명과 오류의 논리"'))?.[0];
  assert.ok(proofCard?.includes('짝수의 합은 짝수이다. 증명:'), 'fallback search data must preserve a space between source paragraphs');

  assert.equal(searchEntries.filter(entry => entry.type === 'post').length, cards.length);
  const proofPost = searchEntries.find(entry => entry.title === '4장: 수학적 증명과 오류의 논리');
  assert.ok(proofPost?.content.includes('짝수의 합은 짝수이다. 증명:'), 'search content must preserve a space between source paragraphs');
  const searchablePages = searchEntries.filter(entry => entry.type === 'page');
  assert.equal(searchablePages.some(entry => /\{%|%\}|\{\{/.test(`${entry.description || ''} ${entry.content || ''}`)), false,
    'page search data must not expose unrendered Liquid template syntax');

  const scriptSrc = /<script\s+type="module"\s+src="([^"]+)"\s*>/.exec(page)?.[1];
  assert.ok(scriptSrc, 'Jekyll must include the Vite React entry module');
  const scriptPath = resolve(siteRoot, decodeURIComponent(new URL(scriptSrc, 'https://blog.test/').pathname).slice(1));
  await access(scriptPath);
  await assert.rejects(access(resolve(siteRoot, 'assets/js/dist/manifest.json')));
  await assert.rejects(access(resolve(siteRoot, 'frontend')));
  await assert.rejects(access(resolve(siteRoot, 'scripts')));
});

test('achievement detail pages render overview, highlights, and related fields', async () => {
  const cases = [
    ['awards', 'Academic and professional recognition', 'Physics Department Academic Award', 'Quantum Computing'],
    ['certificates', 'Professional certifications and qualifications', 'Information Processing Engineer', 'Software Development'],
    ['education', 'Academic achievements and educational background', 'Yonsei University Cognitive Science Master', 'Research Methods'],
    ['leadership', 'Leadership roles and experiences', 'Samsung Electronics Wireless Business Division', 'Android Framework'],
    ['publications', 'Academic research and publications', 'Research in Artificial Intelligence and Neuroscience', 'Scientific Writing'],
  ];

  for (const [slug, overview, highlight, tech] of cases) {
    const page = await readFile(resolve(siteRoot, 'achievements', slug, 'index.html'), 'utf8');
    assert.ok(page.includes(overview), `${slug} must show its overview`);
    assert.ok(page.includes(highlight), `${slug} must show its highlights`);
    assert.ok(page.includes(tech), `${slug} must show its related fields`);
  }
});

test('전체 시리즈의 허브 링크는 각 시리즈 이름으로 목적지를 구분한다', async () => {
  const html = await readFile(resolve(siteRoot, 'series', 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  try {
    browser.document.write(html);
    const links = [...browser.document.querySelectorAll('.series-catalog-group')]
      .map(group => ({
        title: group.querySelector('h3')?.textContent.trim(),
        link: group.querySelector('.series-catalog-meta a'),
      }))
      .filter(({ link }) => link);
    assert.ok(links.length >= 2, '서로 다른 시리즈 허브가 둘 이상이어야 합니다');
    const names = links.map(({ title, link }) => {
      const visibleName = link.textContent.trim();
      const accessibleName = link.getAttribute('aria-label') || visibleName;
      assert.ok(accessibleName.includes(title), `${title}: 링크 이름에 목적지가 있어야 합니다`);
      assert.ok(accessibleName.includes(visibleName), `${title}: 링크 이름에 화면의 문구가 있어야 합니다`);
      return accessibleName;
    });
    assert.equal(new Set(names).size, names.length, '서로 다른 허브 링크를 이름으로 구분해야 합니다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('series hubs render their facts as HTML and use one-based reading positions', async () => {
  for (const [slug, count] of [['mathematics-philosophy-history', 10], ['science-philosophy-history', 5]]) {
    const page = await readFile(resolve(siteRoot, 'series', slug, 'index.html'), 'utf8');
    const facts = /<dl class="series-hub-facts">([\s\S]*?)<\/dl>/.exec(page)?.[1];
    assert.ok(facts, `${slug}: facts must render`);
    assert.match(facts, /<dt>글 수<\/dt>\s*<dd>\s*\d+편\s*<\/dd>/);
    assert.match(facts, /<dt>읽는 순서<\/dt>\s*<dd>[^<]+<\/dd>/);
    assert.doesNotMatch(facts, /<pre\b|&lt;(?:div|dt|dd)\b/);

    const positions = Array.from(page.matchAll(/<p class="series-path-order">(\d+)번째 글<\/p>/g), match => Number(match[1]));
    assert.deepEqual(positions, Array.from({ length: count }, (_, index) => index + 1), `${slug}: positions must match displayed order`);
  }
});

test('post series navigation follows the indexed reading order', async () => {
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const groups = new Map();
  for (const entry of entries) {
    if (!entry.series) continue;
    assert.ok(Number.isInteger(entry.series_index), `${entry.title}: series position must be indexed`);
    if (!groups.has(entry.series)) groups.set(entry.series, []);
    groups.get(entry.series).push(entry);
  }

  for (const [series, entriesInSeries] of groups) {
    entriesInSeries.sort((a, b) => a.series_index - b.series_index);
    for (const [index, entry] of entriesInSeries.entries()) {
      const path = decodeURIComponent(new URL(entry.url).pathname).replace(/^\/+/, '');
      const page = await readFile(resolve(siteRoot, path, 'index.html'), 'utf8');
      const next = /<a class="series-next-link" href="([^"]+)">\s*<span class="series-kicker">([^<]+)<\/span>/.exec(page);
      if (index < entriesInSeries.length - 1) {
        assert.ok(next, `${entry.title}: next post is missing`);
        assert.equal(decodeURIComponent(new URL(next[1], entry.url).pathname), decodeURIComponent(new URL(entriesInSeries[index + 1].url).pathname), `${entry.title}: next link`);
        assert.match(next[2], new RegExp(`${index + 2}번째 글$`), `${entry.title}: next position in ${series}`);
      } else {
        assert.equal(next, null, `${entry.title}: final post must not have a next link`);
        assert.match(page, /이 시리즈의 마지막 글입니다\./);
      }

      const previous = /<a href="([^"]+)">이전 글:/.exec(page);
      if (index > 0) {
        assert.ok(previous, `${entry.title}: previous post is missing`);
        assert.equal(decodeURIComponent(new URL(previous[1], entry.url).pathname), decodeURIComponent(new URL(entriesInSeries[index - 1].url).pathname), `${entry.title}: previous link`);
      } else {
        assert.equal(previous, null, `${entry.title}: first post must not have a previous link`);
      }
    }
  }
});

test('math posts load configured inline rendering while other posts do not', async () => {
  const mathPage = await readFile(resolve(siteRoot, 'posts', '1장-시대와지역에따른수학발전', 'index.html'), 'utf8');
  const setPage = await readFile(resolve(siteRoot, 'posts', '2장-수학과무한', 'index.html'), 'utf8');
  const probabilityPage = await readFile(resolve(siteRoot, 'posts', '5장-확률과통계의철학적의미', 'index.html'), 'utf8');
  const plainPage = await readFile(resolve(siteRoot, 'posts', '9장-수학철학과수학사의종합적고찰', 'index.html'), 'utf8');

  assert.match(mathPage, /id="post-content"/);
  assert.match(mathPage, /startup:\s*\{\s*elements:\s*\['#post-content'\]/);
  assert.match(mathPage, /inlineMath:\s*\{\s*'\[\+\]':\s*\[\['\$',\s*'\$'\]\]/);
  assert.match(mathPage, /<script defer\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax@4\.1\.3\/tex-chtml\.js"/);
  assert.ok(setPage.includes('\\mathbb{N} = \\{1, 2, 3, \\dots\\}'), 'literal set braces must survive Markdown');
  assert.ok(probabilityPage.includes('<p>$P(A\\mid B) = \\frac{P(B\\mid A) \\cdot P(A)}{P(B)}$</p>'), 'Bayes formula must remain a single math expression');
  assert.match(probabilityPage, /<li>새로운 정보[\s\S]*?P\(A\\mid B\)\$을 형성<\/li>/, 'conditional probability in a list must remain within its list item');
  assert.doesNotMatch(plainPage, /cdn\.jsdelivr\.net\/npm\/mathjax@4\.1\.3\/tex-chtml\.js/);
});

test('수식 스크립트 실패와 자바스크립트 비활성 상태에서 복구 방법을 안내한다', async () => {
  const mathPage = await readFile(resolve(siteRoot, 'posts', '4장-수학적증명과오류의논리', 'index.html'), 'utf8');
  const plainPage = await readFile(resolve(siteRoot, 'posts', '9장-수학철학과수학사의종합적고찰', 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptFileLoading: true } });
  try {
    browser.document.write(mathPage);
    const notice = browser.document.getElementById('math-load-error');
    const content = browser.document.getElementById('post-content');
    const loader = browser.document.querySelector('script[src*="mathjax@4.1.3/tex-chtml.js"]');
    assert.ok(notice && content && loader, '수식 글에 안내와 로더가 있어야 합니다');
    assert.equal(notice.hidden, true, '정상 로딩 전 오류 안내는 숨겨야 합니다');
    assert.equal(notice.getAttribute('role'), 'status');
    assert.match(notice.textContent, /새로고침/);
    assert.ok(notice.compareDocumentPosition(content) & browser.Node.DOCUMENT_POSITION_FOLLOWING,
      '실패 안내는 수식 본문보다 먼저 있어야 합니다');
    assert.match(mathPage, /<noscript><p>[^<]*자바스크립트를 켜고[^<]*<\/p><\/noscript>/);

    // happy-dom은 인라인 이벤트 속성을 자동 실행하지 않으므로, 생성된
    // 핸들러를 오류 이벤트에 연결해 실패 시 사용자가 보는 상태를 확인한다.
    const handler = loader.getAttribute('onerror');
    assert.ok(handler, '외부 스크립트 로딩 오류를 처리해야 합니다');
    loader.addEventListener('error', () => browser.eval(handler));
    loader.dispatchEvent(new browser.Event('error'));
    assert.equal(notice.hidden, false, '스크립트 로딩 실패 후 안내가 보여야 합니다');
    assert.doesNotMatch(plainPage, /id="math-load-error"|자바스크립트를 켜고 페이지를 다시 열어/,
      '수식이 없는 글에는 안내를 추가하지 않습니다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('post dates preserve their Korean calendar date in rendered metadata and feed', async () => {
  const archive = await readFile(resolve(siteRoot, 'posts', '기업재난관리사-합격후기', 'index.html'), 'utf8');
  assert.match(archive, /<time datetime="2021-01-28T04:09:00\+09:00">\s*2021년 01월 28일\s*<\/time>/);
  const archiveTimes = [...archive.matchAll(/<time datetime="(\d{4})-(\d{2})-(\d{2})T[^\"]+">\s*(\d{4})년 (\d{2})월 (\d{2})일\s*<\/time>/g)];
  assert.ok(archiveTimes.length >= 1, '글의 날짜 표시가 있어야 합니다');
  for (const time of archiveTimes) assert.deepEqual(time.slice(1, 4), time.slice(4, 7), '표시일은 datetime의 한국 날짜와 같아야 합니다');
  assert.match(archive, /property="article:published_time" content="2021-01-28T04:09:00\+09:00"/);
  const jsonLd = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(archive);
  assert.ok(jsonLd, 'post must expose BlogPosting metadata');
  const metadata = JSON.parse(jsonLd[1]);
  assert.equal(metadata.datePublished, '2021-01-28T04:09:00+09:00');
  assert.ok(!Number.isNaN(Date.parse(metadata.dateModified)), '갱신일이 유효해야 합니다');

  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const archiveEntry = entries.find(entry => decodeURIComponent(new URL(entry.url).pathname) === '/posts/기업재난관리사-합격후기/');
  const seriesEntry = entries.find(entry => entry.title === '1장: 시대와 지역에 따른 수학 발전');
  assert.equal(archiveEntry?.date, '2021-01-28');
  assert.equal(seriesEntry?.date, '2024-09-19');

  const feed = await readFile(resolve(siteRoot, 'feed.xml'), 'utf8');
  const feedEntry = feed.split('<entry>').find(entry => entry.includes('1장: 시대와 지역에 따른 수학 발전'));
  // 피드의 글 수에 따라 이 글이 범위 밖이 될 수 있으므로 현재 검색 색인의 순서와 비교한다.
  // 전체 피드 누락과 설정된 개수는 SEO 통합 검사에서 별도로 검증한다.
  const feedCount = (feed.match(/<entry>/g) || []).length;
  const latest = entries.filter(entry => entry.type === 'post').slice(0, feedCount);
  const included = latest.some(entry => entry.title === '1장: 시대와 지역에 따른 수학 발전');
  assert.equal(Boolean(feedEntry), included, '피드에 최신 글만 포함해야 합니다');
  if (feedEntry) {
    const localPath = decodeURIComponent(new URL(seriesEntry.url).pathname).replace(/^\/+/, '');
    const article = await readFile(resolve(siteRoot, localPath, 'index.html'), 'utf8');
    const published = article.match(/property="article:published_time" content="([^"]+)"/)?.[1];
    const modified = article.match(/property="article:modified_time" content="([^"]+)"/)?.[1];
    assert.ok(published && modified, '피드 글의 발행일과 수정일이 있어야 합니다');
    assert.ok(feedEntry.includes(`<published>${published}</published>`));
    assert.ok(feedEntry.includes(`<updated>${modified}</updated>`));
  }

  const cssPost = await readFile(resolve(siteRoot, 'posts', 'css정리', 'index.html'), 'utf8');
  const cssTimes = [...cssPost.matchAll(/<time datetime="(\d{4})-(\d{2})-(\d{2})T[^\"]+">\s*(\d{4})년 (\d{2})월 (\d{2})일\s*<\/time>/g)];
  assert.ok(cssTimes.length >= 1, 'CSS 글의 날짜 표시가 있어야 합니다');
  for (const time of cssTimes) assert.deepEqual(time.slice(1, 4), time.slice(4, 7), '표시일은 datetime의 한국 날짜와 같아야 합니다');
  const cssJsonLd = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(cssPost);
  assert.ok(cssJsonLd, 'CSS 글에 구조화된 데이터가 있어야 합니다');
  assert.ok(!Number.isNaN(Date.parse(JSON.parse(cssJsonLd[1]).dateModified)), 'CSS 글의 갱신일이 유효해야 합니다');
});
