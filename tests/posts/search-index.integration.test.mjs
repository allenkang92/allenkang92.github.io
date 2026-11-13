import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Window } from 'happy-dom';

test('두 검색 화면은 배포 버전이 포함된 같은 색인 주소를 요청한다', async () => {
  const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('../../_site/', import.meta.url));
  const baseurl = process.env.SITE_BASEURL || '';
  const browser = new Window({ url: 'https://preview.test/' });
  try {
    browser.document.write(await readFile(resolve(siteRoot, 'about/index.html'), 'utf8'));
    const searchForm = browser.document.querySelector('.search-form');
    const sidebarUrl = new URL(searchForm.dataset.searchUrl, browser.location.href);
    const searchScript = browser.document.querySelector('script[src*="/assets/js/simple-search.js"]');
    assert.ok(searchScript, '사이드바 검색 스크립트가 있어야 합니다');
    const scriptVersion = new URL(searchScript.src).searchParams.get('v');
    assert.equal(sidebarUrl.pathname, `${baseurl}/search.json`);
    assert.ok(sidebarUrl.searchParams.get('v'), '색인 주소에 빌드 버전이 있어야 합니다');
    assert.equal(sidebarUrl.searchParams.get('v'), scriptVersion);
    if (process.env.SITE_EXPECTED_REVISION) {
      assert.equal(sidebarUrl.searchParams.get('v'), process.env.SITE_EXPECTED_REVISION);
    }
    browser.document.write(await readFile(resolve(siteRoot, 'posts/index.html'), 'utf8'));
    const archiveUrl = new URL(browser.document.getElementById('posts-react-root').dataset.searchIndexUrl, browser.location.href);
    assert.equal(archiveUrl.pathname, sidebarUrl.pathname);
    assert.equal(archiveUrl.search, sidebarUrl.search);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('생성된 사이드바의 기대 글·페이지 경로와 검색 색인이 중복 없이 일치한다', async () => {
  const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('../../_site/', import.meta.url));
  const html = await readFile(resolve(siteRoot, 'about/index.html'), 'utf8');
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const browser = new Window({ url: 'https://preview.test/' });
  try {
    browser.document.write(html);
    const form = browser.document.querySelector('.search-form');
    assert.ok(form, '사이드바 검색 폼이 있어야 합니다');
    const normalize = path => path.replace(/%[0-9a-f]{2}/gi, value => value.toUpperCase()).replace(/\/+$/, '') || '/';
    for (const [type, key] of [['post', 'expectedPostPaths'], ['page', 'expectedPagePaths']]) {
      const expected = JSON.parse(form.dataset[key]);
      assert.ok(expected.length > 0, `${type}: 기대 경로가 있어야 합니다`);
      const expectedPaths = expected.map(path => normalize(new URL(path, form.dataset.siteBaseUrl).pathname));
      const actualPaths = entries.filter(entry => entry.type === type).map(entry => normalize(new URL(entry.url).pathname));
      assert.equal(new Set(expectedPaths).size, expectedPaths.length, `${type}: 기대 경로 중복`);
      assert.equal(new Set(actualPaths).size, actualPaths.length, `${type}: 색인 경로 중복`);
      assert.deepEqual([...expectedPaths].sort(), [...actualPaths].sort(), `${type}: 색인과 기대 경로가 달라졌습니다`);
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('실제 생성 폼과 색인으로 정상 검색하고 글·페이지 누락은 제한 검색으로 안내한다', async () => {
  const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('../../_site/', import.meta.url));
  const baseurl = process.env.SITE_BASEURL || '';
  const html = await readFile(resolve(siteRoot, 'about/index.html'), 'utf8');
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const searchScript = await readFile(new URL('../../assets/js/simple-search.js', import.meta.url), 'utf8');
  const parser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  let formHtml;
  try {
    parser.document.write(html);
    formHtml = parser.document.querySelector('.search-form')?.outerHTML;
    assert.ok(formHtml, '생성된 검색 폼이 있어야 합니다');
  } finally {
    await parser.happyDOM.abort();
  }

  for (const removedType of [null, 'post', 'page', 'achievement']) {
    const browser = new Window({ url: `https://preview.test${baseurl}/about/` });
    try {
      browser.document.body.innerHTML = `<div id="search-container">${formHtml}<div id="search-status"></div><div id="search-results"></div></div>`;
      const rows = [...entries];
      if (removedType) rows.splice(rows.findIndex(entry => removedType === 'achievement'
        ? entry.page_kind === 'achievement' : entry.type === removedType), 1);
      const requestedUrls = [];
      browser.fetch = async url => {
        requestedUrls.push(url);
        return { ok: true, json: async () => rows };
      };
      browser.console.error = () => {};
      browser.requestAnimationFrame = callback => { callback(); return 1; };
      browser.eval(searchScript);
      if (browser.document.readyState === 'loading') browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.deepEqual(requestedUrls, [browser.document.querySelector('.search-form').dataset.searchUrl]);
      const input = browser.document.querySelector('#search-input');
      input.value = entries.find(entry => entry.type === 'post').title;
      if (removedType) input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      else browser.searchFunctions.performSearch(input.value);
      const results = browser.document.querySelector('#search-results');
      if (removedType) {
        assert.match(results.textContent, /글 목록에서 검색/, `${removedType} 누락 시 제한 검색을 안내해야 합니다`);
      } else {
        assert.ok(results.querySelector('a'), '실제 생성 색인으로 검색 결과가 나와야 합니다');
      }
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('실제 성과의 학교와 자격 상세를 사이드바에서 검색하고 성과·언어·날짜를 올바르게 표시한다', async () => {
  const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('../../_site/', import.meta.url));
  const baseurl = process.env.SITE_BASEURL || '';
  const html = await readFile(resolve(siteRoot, 'about/index.html'), 'utf8');
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const script = await readFile(new URL('../../assets/js/simple-search.js', import.meta.url), 'utf8');
  const browser = new Window({ url: `https://preview.test${baseurl}/about/` });
  try {
    browser.document.write(html);
    const expected = JSON.parse(browser.document.querySelector('.search-form').dataset.expectedPagePaths);
    const achievements = entries.filter(entry => entry.page_kind === 'achievement');
    assert.ok(achievements.length > 0);
    for (const entry of achievements) {
      assert.equal(entry.type, 'page');
      assert.equal(entry.date, '', '정렬용 성과 날짜는 검색 결과에 노출하지 않는다');
      assert.ok(expected.some(path => new URL(path, browser.location.href).pathname === new URL(entry.url).pathname));
    }
    browser.fetch = async () => ({ ok: true, json: async () => entries });
    browser.requestAnimationFrame = callback => { callback(); return 1; };
    browser.eval(script);
    if (browser.document.readyState === 'loading') browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 0));
    for (const [query, path] of [['Sogang', '/achievements/education/'], ['Information Processing Engineer', '/achievements/certificates/']]) {
      browser.searchFunctions.performSearch(query);
      const results = browser.document.querySelector('#search-results');
      const link = results.querySelector(`a[href="${baseurl}${path}"]`);
      assert.ok(link, `${query}: 성과 상세 결과가 있어야 한다`);
      const item = link.closest('li');
      assert.match(item.textContent, /성과/);
      assert.equal(link.closest('h3').getAttribute('lang'), 'en');
      assert.equal(item.querySelector('.search-result-content').getAttribute('lang'), 'en');
      assert.ok(item.querySelector('.search-result-content').textContent.includes(query), '검색된 상세 문구를 발췌에 표시한다');
      assert.equal(item.querySelector('.search-result-date'), null);
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('생성된 색인과 정적 폴백은 코드 태그를 검색할 수 있는 문자 참조로 보존한다', async () => {
  const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('../../_site/', import.meta.url));
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const browser = new Window({ url: 'https://blog.test/' });
  try {
    const row = entries.find(entry => entry.title.includes('시맨틱 마크업_01'));
    assert.ok(row?.content.includes('&lt;h1&gt;'));
    const decoder = browser.document.createElement('textarea');
    decoder.innerHTML = row.content.replace(/</g, '&lt;');
    assert.ok(decoder.value.includes('<h1>'));
    browser.document.body.innerHTML = await readFile(resolve(siteRoot, 'posts/index.html'), 'utf8');
    const cards = [...browser.document.querySelectorAll('.post-preview')];
    const fallback = cards.find(card => card.dataset.title?.includes('시맨틱 마크업_01'));
    assert.ok(fallback?.dataset.content.includes('&lt;h1&gt;'));
    decoder.innerHTML = fallback.dataset.content.replace(/</g, '&lt;');
    assert.ok(decoder.value.includes('<h1>'));
  } finally {
    await browser.happyDOM.abort();
  }
});

test('실제 글에 표시되는 학습 목표와 참고자료는 두 검색 데이터에 포함된다', async () => {
  const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('../../_site/', import.meta.url));
  const baseurl = process.env.SITE_BASEURL || '';
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const browser = new Window({ url: 'https://preview.test/' });
  try {
    browser.document.write(await readFile(resolve(siteRoot, 'posts/index.html'), 'utf8'));
    const cards = [...browser.document.querySelectorAll('#posts-static-fallback .post-preview')];
    const decoder = browser.document.createElement('textarea');
    const decode = value => {
      decoder.innerHTML = value.replace(/</g, '&lt;');
      return decoder.value.replace(/\s+/g, ' ').trim();
    };
    let checkedReferences = 0;
    let checkedOutcomes = 0;
    for (const row of entries.filter(entry => entry.type === 'post')) {
      const urlPath = new URL(row.url).pathname;
      const localPath = baseurl && urlPath.startsWith(`${baseurl}/`) ? urlPath.slice(baseurl.length) : urlPath;
      const card = cards.find(item => new URL(item.querySelector('h2 a').getAttribute('href'), browser.location.href).pathname === urlPath);
      assert.ok(card, `${row.title}: 정적 목록이 필요합니다`);
      const content = decode(row.content);
      const fallback = decode(card.dataset.content);
      const postBrowser = new Window();
      try {
        postBrowser.document.write(await readFile(resolve(siteRoot, `.${decodeURI(localPath)}index.html`), 'utf8'));
        const visible = [];
        for (const item of postBrowser.document.querySelectorAll('.post-learning-outcomes li')) {
          visible.push(item.textContent.replace(/\s+/g, ' ').trim());
          checkedOutcomes++;
        }
        for (const item of postBrowser.document.querySelectorAll('[aria-labelledby="post-references-heading"] li')) {
          const title = item.querySelector('a')?.textContent ?? [...item.childNodes]
            .filter(node => node.nodeType === 3).map(node => node.textContent).join('');
          visible.push(title.replace(/\s+/g, ' ').trim());
          const note = item.querySelector('.reference-note')?.textContent.replace(/\s+/g, ' ').trim();
          if (note) visible.push(note);
          checkedReferences++;
        }
        for (const text of visible.filter(Boolean)) {
          assert.ok(content.includes(text), `${row.title}: 검색 색인에 표시 문구 누락: ${text}`);
          assert.ok(fallback.includes(text), `${row.title}: 정적 폴백에 표시 문구 누락: ${text}`);
        }
      } finally { await postBrowser.happyDOM.abort(); }
    }
    assert.ok(checkedReferences > 0, '실제 표시된 참고자료가 있어야 합니다');
    assert.ok(checkedOutcomes > 0, '실제 표시된 학습 목표가 있어야 합니다');
  } finally { await browser.happyDOM.abort(); }
});

test('생성된 글 목록의 기대 페이지가 검색 인덱스의 도구·시리즈·성과 경로와 일치한다', async () => {
  const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('../../_site/', import.meta.url));
  const baseurl = process.env.SITE_BASEURL || '';
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const browser = new Window({ url: 'https://blog.test/' });
  try {
    browser.document.body.innerHTML = await readFile(resolve(siteRoot, 'posts/index.html'), 'utf8');
    const root = browser.document.getElementById('posts-react-root');
    const expected = JSON.parse(root.dataset.expectedSearchPages);
    const normalize = path => decodeURIComponent(path).replace(/\/+$/, '') || '/';
    const indexed = entries.filter(entry => {
      if (entry.type !== 'page') return false;
      const path = new URL(entry.url, browser.location.href).pathname;
      return entry.page_kind === 'achievement'
        || path === `${baseurl}/tools` || path.startsWith(`${baseurl}/tools/`)
        || path === `${baseurl}/series` || path.startsWith(`${baseurl}/series/`)
        || path.replace(/\/+$/, '') === `${baseurl}/achievements`;
    }).map(entry => new URL(entry.url, browser.location.href).pathname);
    assert.ok(expected.length > 0, '검색할 안내 페이지를 한 개 이상 렌더링한다');
    assert.deepEqual([...new Set(expected.map(normalize))].sort(), [...new Set(indexed.map(normalize))].sort());
  } finally {
    await browser.happyDOM.abort();
  }
});

test('the generated search index includes the tool landing pages with readable descriptions', async () => {
  const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('../../_site/', import.meta.url));
  const baseurl = process.env.SITE_BASEURL || '';
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const expected = [
    ['/tools/unit-converter/', '단위 변환기'],
    ['/tools/kinetic-energy-calculator/', '운동 에너지'],
    ['/tools/acceleration-calculator/', '가속도'],
    ['/tools/dsr-calculator/', '준비 중'],
  ];
  for (const [path, title] of expected) {
    const rows = entries.filter(entry => entry.type === 'page' && new URL(entry.url).pathname === `${baseurl}${path}`);
    assert.equal(rows.length, 1, `${path} must be indexed exactly once`);
    assert.ok(rows[0].title.includes(title), `${path} must retain its title and availability`);
    assert.ok(rows[0].description.trim(), `${path} must have a searchable description`);
    assert.equal(rows[0].date, '', `${path} must not pretend the build date is its publication date`);
    assert.doesNotMatch(`${rows[0].title} ${rows[0].description}`, /\{%|%\}|\{\{/);
  }
  const series = entries.find(entry => entry.type === 'page' && new URL(entry.url).pathname === `${baseurl}/series/`);
  assert.equal(series?.date, '', 'undated series pages must not receive a build date');
});

test('선택한 도구 안내의 색인 본문은 실제 표시 내용과 일치하고 템플릿 표현식을 포함하지 않는다', async () => {
  const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('../../_site/', import.meta.url));
  const names = ['acceleration-calculator', 'dsr-calculator', 'kinetic-energy-calculator', 'unit-converter'];
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const toolsDir = new URL('../../tools/', import.meta.url);
  const opted = [];
  for (const file of await readdir(toolsDir)) {
    if (!file.endsWith('.md')) continue;
    const text = await readFile(new URL(file, toolsDir), 'utf8');
    if (/^search_index_body:\s*true\s*$/m.test(text)) opted.push(file.slice(0, -3));
  }
  assert.deepEqual(opted.sort(), [...names].sort(), '본문 색인 대상을 늘리면 공개 본문 비교 검사에도 추가해야 합니다');
  for (const name of names) {
    const source = await readFile(new URL(`../../tools/${name}.md`, import.meta.url), 'utf8');
    assert.match(source, /^search_index_body:\s*true\s*$/m, `${name}: 본문 색인이 명시돼야 합니다`);
    const contentSource = source.replace(/^---[\s\S]*?---\s*/, '');
    assert.doesNotMatch(contentSource, /<(?:script|style|template|noscript)\b|\s(?:hidden|aria-hidden|style)\s*(?:=|>|\s)/i,
      `${name}: 숨긴 내용이나 실행 코드는 본문 색인에 포함할 수 없습니다`);
    assert.doesNotMatch(contentSource.replace(/<[^>]*>/g, ''), /\{[{%]/,
      `${name}: 표시 텍스트에 Liquid 표현식을 사용할 수 없습니다`);
    const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
    try {
      browser.document.write(await readFile(resolve(siteRoot, `tools/${name}/index.html`), 'utf8'));
      const landing = browser.document.querySelector('.tool-landing');
      assert.ok(landing, `${name}: 도구 안내 본문이 있어야 합니다`);
      assert.ok(!landing.querySelector('script,style,template,noscript,[hidden],[aria-hidden="true"]'),
        `${name}: 숨긴 내용이나 실행 코드는 본문 색인에 포함할 수 없습니다`);
      const rows = entries.filter(entry => new URL(entry.url).pathname.replace(/\/+$/, '').endsWith(`/tools/${name}`));
      assert.equal(rows.length, 1, `${name}: 색인 항목이 하나여야 합니다`);
      assert.doesNotMatch(rows[0].content, /\{[{%]|<[^>]*>/, `${name}: 원시 템플릿이나 HTML이 남으면 안 됩니다`);
      const decoder = browser.document.createElement('textarea');
      decoder.innerHTML = rows[0].content;
      const normalize = value => value.replace(/\s+/g, ' ').trim();
      assert.equal(normalize(decoder.value), normalize(landing.textContent), `${name}: 검색 본문과 표시 본문이 달라졌습니다`);
    } finally {
      await browser.happyDOM.abort();
    }
  }
  const dsr = entries.find(entry => new URL(entry.url).pathname.replace(/\/+$/, '').endsWith('/tools/dsr-calculator'));
  for (const term of ['스트레스 DSR', '중도상환수수료', '비상자금']) {
    assert.ok(dsr.content.includes(term), `${term}: DSR 안내 본문이 검색돼야 합니다`);
  }
});

test('생성된 도구 안내 본문을 사이드바와 글 목록 양쪽에서 검색한다', async () => {
  const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('../../_site/', import.meta.url));
  const baseurl = process.env.SITE_BASEURL || '';
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const about = await readFile(resolve(siteRoot, 'about/index.html'), 'utf8');
  const posts = await readFile(resolve(siteRoot, 'posts/index.html'), 'utf8');
  const sidebarScript = await readFile(new URL('../../assets/js/simple-search.js', import.meta.url), 'utf8');
  const url = `https://allenkang92.github.io${baseurl}`;
  const cases = [
    { query: '스트레스 DSR', target: 'dsr-calculator' },
    { query: '중도상환수수료', target: 'dsr-calculator' },
    { query: '비상자금', target: 'dsr-calculator' },
    { query: '3 km -> m', target: 'unit-converter' },
  ];
  const parser = new Window({ settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  let form;
  let archive;
  let bundlePath;
  try {
    parser.document.write(about);
    form = parser.document.querySelector('.search-form')?.outerHTML;
    parser.document.body.innerHTML = posts;
    archive = [parser.document.querySelector('#posts-react-root')?.outerHTML, parser.document.querySelector('#posts-static-fallback')?.outerHTML];
    const script = parser.document.querySelector('script[src*="/assets/js/dist/assets/main-"]');
    assert.ok(script, '실제 생성 글 목록에 번들이 있어야 합니다');
    const source = script.getAttribute('src').split('?')[0];
    assert.ok(source.startsWith(`${baseurl}/assets/js/dist/assets/main-`));
    bundlePath = source.slice(baseurl.length + 1);
    assert.ok(form && archive.every(Boolean), '실제 생성 폼과 글 목록이 있어야 합니다');
  } finally { await parser.happyDOM.abort(); }
  const bundle = await readFile(resolve(siteRoot, bundlePath), 'utf8');
  const sidebar = new Window({ url: `${url}/about/`, settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    sidebar.document.body.innerHTML = `<div id="search-container">${form}<div id="search-status"></div><div id="search-results"></div></div>`;
    sidebar.fetch = async () => ({ ok: true, json: async () => entries });
    sidebar.requestAnimationFrame = callback => { callback(); return 1; };
    sidebar.eval(sidebarScript);
    if (sidebar.document.readyState === 'loading') sidebar.document.dispatchEvent(new sidebar.Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 0));
    for (const { query, target } of cases) {
      sidebar.searchFunctions.performSearch(query);
      assert.ok(sidebar.document.querySelector(`#search-results a[href="${baseurl}/tools/${target}/"]`), `${query}: 사이드바 결과가 있어야 합니다`);
    }
  } finally { await sidebar.happyDOM.abort(); }
  for (const { query, target } of cases) {
    const browser = new Window({ url: `${url}/posts/?q=${encodeURIComponent(query)}`, settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
    try {
      browser.document.body.innerHTML = archive.join('');
      browser.fetch = async () => ({ ok: true, json: async () => entries });
      browser.eval(bundle);
      for (let attempt = 0; attempt < 30 && !browser.document.querySelector(`#posts-react-root a[href="${baseurl}/tools/${target}/"]`); attempt++) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ok(browser.document.querySelector(`#posts-react-root a[href="${baseurl}/tools/${target}/"]`), `${query}: 글 목록 결과가 있어야 합니다`);
    } finally { await browser.happyDOM.abort(); }
  }
});
