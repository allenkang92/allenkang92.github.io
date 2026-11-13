import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const searchScript = await readFile(new URL('../../assets/js/simple-search.js', import.meta.url), 'utf8');
const sidebarScript = await readFile(new URL('../../assets/js/main.js', import.meta.url), 'utf8');

function searchRow(row) {
  return { category: '', type: 'post', tags: [], description: '', content: '예시 본문', date: '', ...row };
}

function setup(fetchImpl, url = 'https://blog.test/about/', configure = () => {}) {
  const browser = new Window({ url });
  browser.document.body.innerHTML = `
    <button class="sidebar-toggle" type="button"></button>
    <aside class="sidebar-right"><div id="search-container">
      <form class="search-form" action="/posts/" method="get" data-search-url="/search.json" data-expected-post-paths="__test_auto__" data-expected-page-paths="__test_auto__">
        <input id="search-input" name="q"><button class="search-button" type="submit">검색</button><div class="search-spinner"></div>
      </form>
      <div id="search-status"></div><div id="search-results"></div>
    </div></aside><main class="content-wrapper"></main>`;
  browser.document.querySelector('.search-form').dataset.categoryLabels = JSON.stringify({
    mathematics_philosophy_history: '수학철학·수학사',
    science_philosophy_history: '과학철학·현대물리학',
    web_technologies: '웹 기술',
    daily_life: '일상',
  });
  browser.matchMedia = () => ({ matches: true, addEventListener() {} });
  browser.fetch = async (...args) => {
    const response = await fetchImpl(...args);
    if (!response?.ok || typeof response.json !== 'function') return response;
    return { ...response, json: async () => {
      const data = await response.json();
      const form = browser.document.querySelector('.search-form');
      // 다른 검색 동작을 다루는 기존 시험은 픽스처 글의 경로를 기대값으로 사용한다.
      // 색인 완전성 시험은 configure에서 독립적인 기대값을 직접 지정한다.
      const base = new URL(form.dataset.siteBaseUrl || browser.location.origin);
      const directory = new URL(`${base.pathname.replace(/\/+$/, '')}/`, base.origin);
      for (const [type, key] of [['post', 'expectedPostPaths'], ['page', 'expectedPagePaths']]) {
        if (form.dataset[key] !== '__test_auto__') continue;
        const paths = Array.isArray(data) ? data.filter(row => row?.type === type && typeof row.url === 'string')
          .map(row => { try { return new URL(row.url, directory).pathname; } catch { return ''; } }) : [];
        form.dataset[key] = JSON.stringify(paths);
      }
      return data;
    } };
  };
  browser.console.error = () => {};
  configure(browser);
  browser.eval(searchScript);
  browser.eval(sidebarScript);
  if (browser.document.readyState === 'loading') {
    browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
  }
  return browser;
}

test('주소가 posts로 끝나는 오류 페이지에서도 사이드바 입력 검색이 작동한다', async () => {
  for (const [url, basePath] of [
    ['https://blog.test/not-found/posts', ''],
    ['https://blog.test/not-found/posts/', ''],
    ['https://blog.test/blog/not-found/posts', '/blog'],
    ['https://blog.test/posts', ''],
  ]) {
    let requests = 0;
    const browser = setup(async () => {
      requests += 1;
      return { ok: true, json: async () => [searchRow({ title: '수학 글', url: `${basePath}/posts/math/` })] };
    }, url, window => {
      window.document.querySelector('.search-form').dataset.siteBaseUrl = `https://blog.test${basePath}`;
      window.requestAnimationFrame = callback => { callback(); return 1; };
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(requests, 1, `${url}: 검색 색인을 불러와야 합니다`);
      const input = browser.document.querySelector('#search-input');
      input.value = '수학';
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 350));
      const results = browser.document.querySelector('#search-results');
      assert.match(results.textContent, /수학 글/, `${url}: 입력한 검색어의 결과가 보여야 합니다`);
      assert.equal(results.querySelector('a')?.getAttribute('href'), `${basePath}/posts/math/`);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('사이드바 분류 검색은 페이지에서 전달한 원문을 사용하고 안전하게 표시한다', async () => {
  const label = '<웹> & 기술 "예제" </script> &amp;';
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '분류 검색 글', category: 'web_technologies', url: '/blog/web/' }),
    searchRow({ title: '미등록 분류 글', category: 'unknown_topic', url: '/blog/unknown/' }),
  ] }), 'https://blog.test/blog/about/', window => {
    const form = window.document.querySelector('.search-form');
    form.dataset.categoryLabels = JSON.stringify({ web_technologies: label });
    form.dataset.siteBaseUrl = 'https://blog.test/blog';
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    browser.searchFunctions.performSearch('<웹>');
    frames.shift()();
    const result = browser.document.querySelector('#search-results');
    assert.equal(result.querySelector('.category-chip')?.textContent, label);
    assert.equal(result.querySelector('.search-result-title a')?.getAttribute('href'), '/blog/web/');
    assert.equal(result.querySelector('script, img, 웹'), null);
    browser.searchFunctions.performSearch('unknown_topic');
    frames.shift()();
    assert.equal(result.querySelector('.category-chip')?.textContent, 'Unknown topic');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('손상되거나 누락된 항목은 오래된 라벨이 아닌 분류 키로 검색한다', async () => {
  for (const json of ['', '{broken', '[]', 'null', '{}', '{"web_technologies": "  "}', '{"web_technologies": {}}']) {
    const browser = setup(async () => ({ ok: true, json: async () => [
      searchRow({ title: '웹 글', category: 'web_technologies', url: '/web/' }),
    ] }), 'https://blog.test/', window => {
      const form = window.document.querySelector('.search-form');
      form.dataset.categoryLabels = json;
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const frames = [];
      browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
      browser.searchFunctions.performSearch('web_technologies');
      frames.shift()();
      assert.equal(browser.document.querySelector('.category-chip')?.textContent, 'Web technologies', String(json));
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('이전 HTML에 분류 데이터 속성이 없는 경우 기존 한글 검색을 유지한다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '웹 글', category: 'web_technologies', url: '/web/' }),
  ] }), 'https://blog.test/', window => {
    delete window.document.querySelector('.search-form').dataset.categoryLabels;
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    browser.searchFunctions.performSearch('웹 기술');
    frames.shift()();
    assert.equal(browser.document.querySelector('.category-chip')?.textContent, '웹 기술');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('배포된 이전 폼의 메타데이터가 모두 없으면 검색을 제공하되 완전성 미확인을 알린다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '기존 웹 글', category: 'web_technologies', url: '/web/' }),
    searchRow({ title: '웹 도구', type: 'page', url: '/tool/' }),
  ] }), 'https://blog.test/about/', window => {
    const form = window.document.querySelector('.search-form');
    // 마지막으로 배포된 폼에는 아래 세 속성이 모두 없다.
    delete form.dataset.categoryLabels;
    delete form.dataset.expectedPostPaths;
    delete form.dataset.expectedPagePaths;
    window.requestAnimationFrame = callback => { callback(); return 1; };
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    input.value = '웹';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.match(results.textContent, /기존 웹 글/);
    assert.match(results.textContent, /웹 도구/);
    assert.match(results.textContent, /완전성을 확인할 수 없습니다/);
    assert.equal(results.querySelector('.search-results-header a')?.getAttribute('href'), 'https://blog.test/posts/?q=%EC%9B%B9');
    assert.match(results.textContent, /글 목록에서 확인/);
    assert.match(browser.document.querySelector('#search-status').textContent, /완전성을 확인할 수 없습니다/);
    assert.equal(results.querySelector('.category-chip')?.textContent, '웹 기술');

    input.value = '존재하지않음';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.match(results.textContent, /검색 결과가 없습니다/);
    assert.match(results.textContent, /완전성을 확인할 수 없습니다/);
    assert.equal(results.querySelector('.no-results a')?.getAttribute('href'), 'https://blog.test/posts/?q=%EC%A1%B4%EC%9E%AC%ED%95%98%EC%A7%80%EC%95%8A%EC%9D%8C');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('예상 경로의 일부만 없거나 새 폼의 경로가 전부 없으면 오류 폴백을 유지한다', async () => {
  for (const missing of ['post', 'page', 'both']) {
    const browser = setup(async () => ({ ok: true, json: async () => [
      searchRow({ title: '웹 글', url: '/web/' }),
    ] }), 'https://blog.test/about/?q=웹', window => {
      const form = window.document.querySelector('.search-form');
      if (missing !== 'page') delete form.dataset.expectedPostPaths;
      if (missing !== 'post') delete form.dataset.expectedPagePaths;
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/, missing);
      assert.equal(browser.document.querySelector('.search-result-item'), null, missing);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('이전 폼에서도 손상되거나 중복된 경로의 검색 색인은 거부한다', async () => {
  for (const rows of [
    [searchRow({ title: '하나', url: '/same/' }), searchRow({ title: '둘', url: '/same/' })],
    [searchRow({ title: '잘못된 주소', url: '/bad%zz/' })],
    [searchRow({ title: '외부 주소', url: 'https://evil.test/web/' })],
  ]) {
    const browser = setup(async () => ({ ok: true, json: async () => rows }), 'https://blog.test/about/?q=하나', window => {
      const form = window.document.querySelector('.search-form');
      delete form.dataset.categoryLabels;
      delete form.dataset.expectedPostPaths;
      delete form.dataset.expectedPagePaths;
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
      assert.equal(browser.document.querySelector('.search-result-item'), null);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('이전 폼은 정식 출처의 절대 주소를 허용하되 출처가 다른 미리보기에서는 거부한다', async () => {
  for (const [url, expectedResult] of [
    ['https://allenkang92.github.io/about/?q=물리', true],
    ['http://localhost:4000/about/?q=물리', false],
  ]) {
    const browser = setup(async () => ({ ok: true, json: async () => [
      searchRow({ title: '물리 글', url: 'https://allenkang92.github.io/posts/physics/' }),
    ] }), url, window => {
      const form = window.document.querySelector('.search-form');
      delete form.dataset.categoryLabels;
      delete form.dataset.expectedPostPaths;
      delete form.dataset.expectedPagePaths;
      window.requestAnimationFrame = callback => { callback(); return 1; };
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const results = browser.document.querySelector('#search-results');
      if (expectedResult) {
        assert.match(results.textContent, /물리 글/);
        assert.match(results.textContent, /완전성을 확인할 수 없습니다/);
      } else {
        assert.match(results.textContent, /글 목록에서 검색/);
        assert.equal(browser.document.querySelector('.search-result-item'), null);
      }
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('이전 폼의 글 목록 링크는 하위 경로와 검색어를 보존하고 외부 주소는 노출하지 않는다', async () => {
  for (const [action, indexUrl, expected, externalBase] of [
    ['/blog/posts/?source=help#guide', '/blog/search.json', 'https://blog.test/blog/posts/?source=help&q=%26%3C#guide', false],
    ['/blog/posts/', '/blog/search.json', 'https://blog.test/blog/posts/?q=%26%3C', true],
    ['/blog/%2F%2Fevil.test/posts', '/blog/search.json', 'https://blog.test/blog/%2F%2Fevil.test/posts?q=%26%3C', false],
    ['https://evil.test/posts/', '/blog/search.json', null, false],
    ['//evil.test/posts', '/blog/search.json', null, false],
    ['https://blog.test//evil.test/posts', '/blog/search.json', null, false],
    [String.raw`https://blog.test/\evil.test/posts`, '/blog/search.json', null, false],
    ['/blog/../outside/', '/blog/search.json', null, false],
    ['/blogger/posts/', '/blog/search.json', null, false],
    ['/blog%2Fposts/', '/blog/search.json', null, false],
    ['/blog/posts/', 'https://evil.test/search.json', null, false],
    ['/blog/posts/', '/blog/other.json', null, false],
  ]) {
    const browser = setup(async () => ({ ok: true, json: async () => [
      searchRow({ title: '&< 테스트', url: '/blog/test/' }),
    ] }), 'https://blog.test/blog/about/', window => {
      const form = window.document.querySelector('.search-form');
      delete form.dataset.categoryLabels;
      delete form.dataset.expectedPostPaths;
      delete form.dataset.expectedPagePaths;
      form.setAttribute('action', action);
      form.dataset.searchUrl = indexUrl;
      if (externalBase) {
        const base = window.document.createElement('base');
        base.href = 'https://evil.test/';
        window.document.head.appendChild(base);
      }
      window.requestAnimationFrame = callback => { callback(); return 1; };
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      browser.searchFunctions.performSearch('&<');
      assert.equal(browser.document.querySelector('.search-results-header a')?.getAttribute('href') || null, expected);
      if (expected) assert.equal(browser.document.querySelector('.search-results-header a').origin, 'https://blog.test');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('이전 폼에서도 색인 응답 시간 초과 시 검색 제출은 글 목록으로 폴백한다', async () => {
  let timeout;
  const browser = setup(() => new Promise(() => {}), 'https://blog.test/about/?q=물리', window => {
    const form = window.document.querySelector('.search-form');
    delete form.dataset.categoryLabels;
    delete form.dataset.expectedPostPaths;
    delete form.dataset.expectedPagePaths;
    const actualTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      if (delay === 10000) { timeout = callback; return 0; }
      return actualTimeout(callback, delay, ...args);
    };
  });
  try {
    timeout();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
    const submit = new browser.Event('submit', { bubbles: true, cancelable: true });
    browser.document.querySelector('.search-form').dispatchEvent(submit);
    assert.equal(submit.defaultPrevented, false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('현재 분류명이 변경되면 이전 하드코딩 라벨로 검색되지 않는다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '프런트엔드 글', category: 'web_technologies', url: '/web/' }),
  ] }), 'https://blog.test/', window => {
    window.document.querySelector('.search-form').dataset.categoryLabels = JSON.stringify({ web_technologies: '새로운 분야' });
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    browser.searchFunctions.performSearch('새로운 분야');
    frames.shift()();
    assert.equal(browser.document.querySelector('.category-chip')?.textContent, '새로운 분야');
    browser.searchFunctions.performSearch('웹 기술');
    frames.shift()();
    assert.equal(browser.document.querySelector('.category-chip'), null);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('사이드바 검색 폼이 없는 글 목록은 색인을 요청하거나 오류를 출력하지 않는다', async () => {
  for (const path of ['/posts/', '/blog/posts/']) {
    const browser = new Window({ url: `https://blog.test${path}` });
    try {
      browser.document.body.innerHTML = '<main id="posts-react-root"></main>';
      let requests = 0;
      const errors = [];
      browser.fetch = async () => { requests += 1; throw new Error('unexpected request'); };
      browser.console.error = (...args) => errors.push(args);
      browser.eval(searchScript);
      if (browser.document.readyState === 'loading') browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(requests, 0, `${path}: 사이드바 검색을 초기화하지 않아야 합니다`);
      assert.deepEqual(errors, [], `${path}: 없는 검색 폼을 오류로 표시하지 않아야 합니다`);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('색인의 HTML 문자 참조는 한 번 해독해 검색하고 마크업으로 실행하지 않는다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [searchRow({
    title: 'HTML 예제', url: '/html/',
    description: '&lt;h1&gt; 제목 &amp;lt;fieldset&amp;gt; &copy; &#x1f600; </textarea><img src=x onerror=alert(1)>',
    content: '&lt;fieldset&gt; 및 &lt;script&gt; 코드',
  })] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    input.value = '<h1>';
    browser.searchFunctions.performSearch(input.value);
    frames.shift()();
    assert.ok(results.querySelector('a'));
    assert.match(results.textContent, /<h1>/);
    assert.match(results.textContent, /&lt;fieldset&gt;/);
    assert.match(results.textContent, /©/);
    assert.equal(results.querySelector('img, script'), null);
    input.value = '<fieldset>';
    browser.searchFunctions.performSearch(input.value);
    frames.shift()();
    assert.ok(results.querySelector('a'), '본문의 원래 태그를 검색한다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('성과는 임의 내부 퍼머링크와 언어를 유지하고 상세 검색어를 발췌에 표시한다', async () => {
  for (const [language, expected] of [['en-US', 'en-US'], ['en" onmouseover="alert(1)', null]]) {
    const browser = setup(async () => ({ ok: true, json: async () => [searchRow({
      type: 'page', page_kind: 'achievement', language,
      title: 'Career', url: '/research/custom/', description: 'Professional background',
      content: 'Department. Information Processing Engineer and research.', date: '',
    })] }));
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      browser.requestAnimationFrame = callback => { callback(); return 1; };
      browser.searchFunctions.performSearch('Information Processing Engineer');
      const results = browser.document.querySelector('#search-results');
      const link = results.querySelector('a[href="/research/custom/"]');
      assert.ok(link, '성과 경로의 모양과 무관하게 결과를 연다');
      const item = link.closest('li');
      assert.match(item.textContent, /성과/);
      assert.match(item.querySelector('.search-result-content').textContent, /Information Processing Engineer/);
      assert.equal(link.closest('h3').getAttribute('lang'), expected);
      assert.equal(item.querySelector('.search-result-content').getAttribute('lang'), expected);
      assert.equal(results.querySelector('[onmouseover]'), null);
      assert.equal(item.querySelector('.search-result-date'), null);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('검색어가 본문에만 있으면 일반 글과 성과의 해당 구절을 안전하게 보여준다', async () => {
  const nfd = '가속도'.normalize('NFD');
  const cases = [
    { type: 'post', query: 'falsifiability', content: `앞부분 ${'설명 '.repeat(90)}검증의 핵심은 falsifiability 입니다.`, expected: 'falsifiability' },
    { type: 'post', query: '가속도', content: `${'가'.normalize('NFD').repeat(6000)}${nfd} 결과`, expected: nfd },
    { type: 'post', query: 'needle', content: `${'İ'.repeat(500)}needle`, expected: 'needle' },
    { type: 'post', query: 'needle', content: `${'😀'.repeat(500)}needle`, expected: 'needle' },
    { type: 'post', query: 'ος', content: `${'가'.repeat(500)}ΟΣ`, expected: 'ΟΣ' },
    { type: 'page', page_kind: 'achievement', query: 'engineer', content: `${'x'.repeat(600)}Engineer qualification`, expected: 'Engineer' },
    { type: 'post', query: '가속도 C++', content: `도입부 ${'중간 '.repeat(90)}${nfd}와 C++ <img src=x>`, expected: nfd },
  ];
  for (const item of cases) {
    const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ ...item, title: '일반 제목', description: '일반 소개', url: '/excerpt/' })] }));
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      browser.requestAnimationFrame = callback => { callback(); return 1; };
      browser.searchFunctions.performSearch(item.query);
      const result = browser.document.querySelector('.search-result-content');
      assert.ok(result, `${item.query}: 검색 결과가 있어야 합니다`);
      assert.ok(result.textContent.includes(item.expected), `${item.query}: 일치 구절이 발췌에 있어야 합니다`);
      assert.ok([...result.querySelectorAll('mark')].some(mark => mark.textContent.includes(item.expected)), `${item.query}: 일치 부분을 강조해야 합니다`);
      assert.equal(result.querySelector('img, script'), null);
      assert.ok(result.textContent.length < 180, '본문 길이와 무관하게 간결한 발췌를 표시합니다');
      assert.doesNotMatch(result.textContent, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/, '발췌 경계가 서로게이트 쌍을 나누지 않아야 합니다');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('설명에 일치한 긴 검색어 문맥을 표시하고 본문이 아닌 일치는 설명을 유지한다', async () => {
  const rows = [
    searchRow({ title: '설명 일치', url: '/description/', description: `${'앞부분 '.repeat(40)}양자역학 설명`, content: '다른 본문' }),
    searchRow({ title: '제목 양자역학', url: '/title/', description: '읽기 쉬운 원래 설명', content: '다른 본문' }),
    searchRow({ title: '태그 일치', url: '/tag/', tags: ['양자역학'], description: '태그 항목 설명', content: '다른 본문' }),
  ];
  const browser = setup(async () => ({ ok: true, json: async () => rows }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    browser.requestAnimationFrame = callback => { callback(); return 1; };
    browser.searchFunctions.performSearch('양자역학');
    const item = href => browser.document.querySelector(`.search-result-title a[href="${href}"]`).closest('li').querySelector('.search-result-content');
    assert.match(item('/description/').textContent, /양자역학/);
    assert.equal(item('/description/').querySelector('mark')?.textContent, '양자역학');
    assert.equal(item('/title/').textContent.trim(), '읽기 쉬운 원래 설명');
    assert.equal(item('/tag/').textContent.trim(), '태그 항목 설명');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('긴 검색어는 가능한 한 전체를 보여주고 더 길면 일부 표시를 알린다', async () => {
  for (const length of [116, 150, 151, 500]) {
    const query = 'x'.repeat(length);
    const browser = setup(async () => ({ ok: true, json: async () => [searchRow({
      title: '긴 본문', url: '/long/', description: '요약', content: `${'머리말 '.repeat(40)}${query} 끝`,
    })] }));
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      browser.requestAnimationFrame = callback => { callback(); return 1; };
      browser.searchFunctions.performSearch(query);
      const result = browser.document.querySelector('.search-result-content');
      assert.ok(result, `${length}: 결과가 있어야 합니다`);
      const marked = [...result.querySelectorAll('mark')].map(mark => mark.textContent).join('');
      if (length <= 150) {
        assert.equal(marked, query, `${length}: 검색어 전체를 강조해야 합니다`);
        assert.doesNotMatch(result.textContent, /긴 검색어의 일부/);
      } else {
        assert.ok(marked.length > 0 && query.startsWith(marked), `${length}: 보이는 일치 부분을 강조해야 합니다`);
        assert.match(result.textContent, /긴 검색어의 일부/);
      }
    } finally { await browser.happyDOM.abort(); }
  }
});

test('긴 결합 문자 재정렬에서 일치 문자의 원문 위치를 찾는다', async () => {
  const query = '\u0316';
  const browser = setup(async () => ({ ok: true, json: async () => [searchRow({
    title: '결합 문자', url: '/combining/', description: '요약', content: `q${'\u0315'.repeat(300)}${query}b`,
  })] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    browser.requestAnimationFrame = callback => { callback(); return 1; };
    browser.searchFunctions.performSearch(query);
    const result = browser.document.querySelector('.search-result-content');
    assert.ok(result?.textContent.includes(query), '발췌에 실제 일치 문자가 있어야 합니다');
    assert.ok([...result.querySelectorAll('mark')].some(mark => mark.textContent.includes(query)), '일치 문자를 강조해야 합니다');
  } finally { await browser.happyDOM.abort(); }
});

test('정규화된 검색어가 150자 이내여도 분해된 원문을 온전히 강조한다', async () => {
  const query = '가'.repeat(140);
  const original = query.normalize('NFD');
  const browser = setup(async () => ({ ok: true, json: async () => [searchRow({
    title: '분해형 본문', url: '/nfd/', description: '요약', content: `앞부분 ${original} 끝`,
  })] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    browser.requestAnimationFrame = callback => { callback(); return 1; };
    browser.searchFunctions.performSearch(query);
    const result = browser.document.querySelector('.search-result-content');
    assert.equal(result?.querySelector('mark')?.textContent, original);
    assert.doesNotMatch(result.textContent, /일치 위치를 표시하지 못했습니다/);
  } finally { await browser.happyDOM.abort(); }
});

test('페이지의 내부 분류값은 검색하지 않지만 실제 글의 분류와 페이지 내용은 검색한다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '분류된 글', url: '/post/', category: 'Uncategorized' }),
    searchRow({ title: '일반 안내', url: '/page/', type: 'page', category: 'Uncategorized' }),
    searchRow({ title: '학력', url: '/achievement/', type: 'page', page_kind: 'achievement', category: 'Uncategorized' }),
    searchRow({ title: '실제 단어', url: '/content/', type: 'page', category: 'Uncategorized', content: 'Uncategorized라는 단어가 본문에 있습니다.' }),
    searchRow({ title: 'Uncategorized 안내', url: '/title/', type: 'page', category: 'Uncategorized' }),
    searchRow({ title: '분류 검색 글', url: '/math/', category: 'mathematics_philosophy_history' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    browser.requestAnimationFrame = callback => { callback(); return 1; };
    const results = browser.document.querySelector('#search-results');
    browser.searchFunctions.performSearch('uncategorized');
    const hrefs = [...results.querySelectorAll('.search-result-item a')].map(link => link.getAttribute('href'));
    assert.deepEqual(new Set(hrefs), new Set(['/post/', '/content/', '/title/']));

    for (const query of ['mathematics_philosophy_history', '수학철학·수학사']) {
      browser.searchFunctions.performSearch(query);
      assert.equal(results.querySelector('.search-result-item a')?.getAttribute('href'), '/math/', query);
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('검색 결과 방향키는 수정 키와 다른 컨트롤의 기본 동작을 가로채지 않는다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '수학 첫 번째', url: '/math-one/' }),
    searchRow({ title: '수학 두 번째', url: '/math-two/' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const submit = browser.document.querySelector('.search-button');
    const results = browser.document.querySelector('#search-results');
    browser.document.querySelector('.sidebar-toggle').click();
    input.focus();
    input.value = '수학';
    browser.searchFunctions.performSearch(input.value);
    frames.shift()();
    const links = [...results.querySelectorAll('.search-result-item a')];
    assert.equal(links.length, 2);

    for (const target of [input, links[0]]) {
      for (const key of ['ArrowDown', 'ArrowUp']) {
        for (const modifier of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey']) {
          target.focus();
          const event = new browser.KeyboardEvent('keydown', {
            key, [modifier]: true, bubbles: true, cancelable: true,
          });
          target.dispatchEvent(event);
          assert.equal(event.defaultPrevented, false, `${modifier}+${key}의 기본 동작을 보존한다`);
          assert.ok(browser.document.activeElement === target, `${modifier}+${key}는 포커스를 이동하지 않는다`);
        }
      }
    }

    submit.focus();
    const buttonArrow = new browser.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    submit.dispatchEvent(buttonArrow);
    assert.equal(buttonArrow.defaultPrevented, false, '검색 버튼의 방향키를 가로채지 않는다');
    assert.ok(browser.document.activeElement === submit);

    input.focus();
    const alreadyHandled = new browser.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    alreadyHandled.preventDefault();
    input.dispatchEvent(alreadyHandled);
    assert.ok(browser.document.activeElement === input, '이미 처리된 이벤트는 다시 처리하지 않는다');

    const down = new browser.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    input.dispatchEvent(down);
    assert.equal(down.defaultPrevented, true);
    assert.ok(browser.document.activeElement === links[0], '일반 아래 방향키는 첫 결과로 이동한다');
    const up = new browser.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    input.focus();
    input.dispatchEvent(up);
    assert.equal(up.defaultPrevented, true);
    assert.ok(browser.document.activeElement === links[1], '일반 위 방향키는 마지막 결과로 이동한다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('changing the query immediately removes stale links before keyboard or pointer selection', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '물리', url: '/physics/' }),
    searchRow({ title: '수학', url: '/math/' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    browser.document.querySelector('.sidebar-toggle').click();
    input.focus();
    input.value = '물리';
    browser.searchFunctions.performSearch(input.value);
    frames.shift()();
    assert.equal(results.querySelector('a').getAttribute('href'), '/physics/');

    input.value = '수학';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    assert.equal(results.classList.contains('active'), false);
    assert.equal(results.querySelector('a'), null, 'stale result cannot be clicked or tabbed to');
    assert.equal(browser.document.querySelector('#search-status').textContent, '');
    input.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert.ok(browser.document.activeElement === input, 'arrow key cannot focus a stale result');

    await new Promise(resolve => setTimeout(resolve, 350));
    frames.shift()();
    assert.equal(results.querySelector('a').getAttribute('href'), '/math/');
    input.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert.ok(browser.document.activeElement === results.querySelector('a'), 'new result remains keyboard accessible');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('whitespace-only edits do not replace a focused result', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '물리', url: '/physics/' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    browser.document.querySelector('.sidebar-toggle').click();
    input.focus();
    input.value = '물리';
    browser.searchFunctions.performSearch(input.value);
    frames.shift()();
    const link = results.querySelector('a');

    input.value = '물리 ';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    input.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert.ok(browser.document.activeElement === link, 'unchanged result can be focused');
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(frames.length, 0, 'same effective query does not queue a render');
    assert.ok(browser.document.activeElement === link, 'focus remains on the original result');
    assert.ok(results.contains(link), 'focused link remains in the document');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('이미 표시된 검색어를 제출해도 결과 포커스와 제출 기록이 유지된다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '물리', url: '/physics/' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    const form = browser.document.querySelector('.search-form');
    browser.document.querySelector('.sidebar-toggle').click();
    input.focus();
    input.value = '물리';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
    frames.shift()();
    const link = results.querySelector('a');
    const historyLength = browser.history.length;

    const submission = new browser.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submission);
    input.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    assert.ok(submission.defaultPrevented, '인덱스가 있으면 검색 제출을 처리한다');
    assert.ok(browser.document.activeElement === link, '기존 검색 결과에 포커스가 이동한다');
    assert.equal(frames.length, 0, '바뀌지 않은 결과를 다시 생성하지 않는다');
    assert.equal(browser.history.length, historyLength + 1, '명시적인 제출을 방문 기록에 남긴다');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '물리');
    assert.ok(results.contains(link), '포커스된 링크가 문서에 남는다');
    form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(browser.history.length, historyLength + 1, '같은 검색어를 다시 제출해도 중복 기록은 만들지 않는다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('실시간 검색 후 제출하면 이전 주소로 한 번에 돌아가고 앞뒤 이동이 복원된다', { timeout: 3000 }, async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '물리', url: '/physics/' }),
  ] }), 'https://blog.test/about/?source=guide#start');
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    browser.history.replaceState({ marker: '유지' }, '', browser.location.href);
    const input = browser.document.querySelector('#search-input');
    const form = browser.document.querySelector('.search-form');
    const results = browser.document.querySelector('#search-results');
    input.value = '물리';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
    frames.shift()();
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '물리');
    const beforeLength = browser.history.length;
    form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(browser.history.length, beforeLength + 1);
    assert.equal(browser.history.state.marker, '유지');
    form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(browser.history.length, beforeLength + 1);

    const navigate = method => new Promise(resolve => {
      browser.addEventListener('popstate', resolve, { once: true });
      browser.history[method]();
    });
    await navigate('back');
    assert.equal(browser.location.href, 'https://blog.test/about/?source=guide#start');
    assert.equal(input.value, '');
    assert.equal(results.classList.contains('active'), false);
    assert.equal(browser.history.state.marker, '유지');
    await navigate('forward');
    assert.equal(input.value, '물리');
    assert.equal(new URL(browser.location.href).searchParams.get('source'), 'guide');
    assert.equal(new URL(browser.location.href).hash, '#start');
    frames.shift()();
    assert.match(results.textContent, /물리/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('인덱스 지연 중 수정한 검색어를 제출해도 이전 검색어로 돌아갈 수 있다', { timeout: 3000 }, async () => {
  let resolveFetch;
  const browser = setup(() => new Promise(resolve => { resolveFetch = resolve; }), 'https://blog.test/about/?q=이전');
  try {
    const input = browser.document.querySelector('#search-input');
    const form = browser.document.querySelector('.search-form');
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    input.value = '물리';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    resolveFetch({ ok: true, json: async () => [searchRow({ title: '물리', url: '/physics/' })] });
    await new Promise(resolve => setTimeout(resolve, 0));
    frames.shift()();
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '물리');
    form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    const restored = new Promise(resolve => browser.addEventListener('popstate', resolve, { once: true }));
    browser.history.back();
    await restored;
    assert.equal(input.value, '이전');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '이전');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('검색을 다시 수정해 제출하면 이전 검색어와 최신 검색어 사이를 이동한다', { timeout: 3000 }, async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '물리 수학', url: '/post/' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const form = browser.document.querySelector('.search-form');
    const search = async query => {
      input.value = query;
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 350));
      frames.shift()();
      form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    };
    const navigate = method => new Promise(resolve => {
      browser.addEventListener('popstate', resolve, { once: true });
      browser.history[method]();
    });
    await search('물리');
    await search('수학');
    await navigate('back');
    assert.equal(input.value, '물리');
    frames.shift()();
    await navigate('forward');
    assert.equal(input.value, '수학');
    frames.shift()();
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '수학');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('검색어를 지우거나 원래 검색어로 되돌리면 제출 기록을 중복 생성하지 않는다', { timeout: 3000 }, async () => {
  for (const initialQuery of ['', '수학']) {
    const url = new URL('https://blog.test/about/?source=guide');
    if (initialQuery) url.searchParams.set('q', initialQuery);
    const browser = setup(async () => ({ ok: true, json: async () => [
      searchRow({ title: '물리 수학', url: '/post/' }),
    ] }), url.href);
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const frames = [];
      browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
      const input = browser.document.querySelector('#search-input');
      const form = browser.document.querySelector('.search-form');
      const length = browser.history.length;
      input.value = '물리';
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 350));
      frames.shift()();
      input.value = initialQuery;
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      if (initialQuery) {
        await new Promise(resolve => setTimeout(resolve, 350));
        frames.shift()();
        form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
      } else {
        form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
      }
      assert.equal(browser.history.length, length);
      assert.equal(new URL(browser.location.href).searchParams.get('q') || '', initialQuery);
      assert.equal(new URL(browser.location.href).searchParams.get('source'), 'guide');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('기존 검색어를 지우고 제출하면 뒤로 가기로 이전 검색을 복원한다', { timeout: 3000 }, async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '수학', url: '/math/' }),
  ] }), 'https://blog.test/about/?source=guide&q=수학#start');
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const form = browser.document.querySelector('.search-form');
    assert.equal(input.value, '수학');
    const beforeLength = browser.history.length;
    input.value = '';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    assert.equal(new URL(browser.location.href).searchParams.has('q'), false);
    form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(browser.history.length, beforeLength + 1);
    form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(browser.history.length, beforeLength + 1, '빈 검색을 재제출해도 중복하지 않는다');
    const navigate = method => new Promise(resolve => {
      browser.addEventListener('popstate', resolve, { once: true });
      browser.history[method]();
    });
    await navigate('back');
    assert.equal(input.value, '수학');
    assert.equal(new URL(browser.location.href).searchParams.get('source'), 'guide');
    assert.equal(new URL(browser.location.href).hash, '#start');
    frames.shift()();
    assert.match(browser.document.querySelector('#search-results').textContent, /수학/);
    await navigate('forward');
    assert.equal(input.value, '');
    assert.equal(new URL(browser.location.href).searchParams.has('q'), false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('초기 검색어가 비어 있으면 빈 제출과 입력 후 지우기는 이력을 추가하지 않는다', { timeout: 3000 }, async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '수학', url: '/math/' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const form = browser.document.querySelector('.search-form');
    const length = browser.history.length;
    form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(browser.history.length, length);
    input.value = '수학';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
    frames.shift()();
    input.value = '';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(browser.history.length, length);
    assert.equal(new URL(browser.location.href).searchParams.has('q'), false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('index failure leaves the search form available for native posts-page submission', async () => {
  const browser = setup(async () => { throw new Error('offline'); });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const document = browser.document;
    const results = document.querySelector('#search-results');
    const input = document.querySelector('#search-input');
    assert.equal(results.classList.contains('active'), false);
    input.focus();
    assert.equal(results.classList.contains('active'), false, 'focus without a query does not open an error');
    input.value = '물리';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    assert.match(results.textContent, /글 목록에서 검색/);
    const form = document.querySelector('.search-form');
    const submit = new browser.Event('submit', { bubbles: true, cancelable: true });
    assert.equal(form.dispatchEvent(submit), true);
    assert.equal(form.action, 'https://blog.test/posts/');
    assert.equal(new browser.FormData(form).get('q'), '물리');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('a stalled search index times out, aborts, and preserves the native form fallback', async () => {
  let timeout;
  let requestSignal;
  let resolveFetch;
  const browser = setup((url, options) => {
    requestSignal = options.signal;
    return new Promise(resolve => { resolveFetch = resolve; });
  }, undefined, window => {
    const actualTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      if (delay === 10000) { timeout = callback; return 0; }
      return actualTimeout(callback, delay, ...args);
    };
  });
  try {
    const document = browser.document;
    const input = document.querySelector('#search-input');
    const results = document.querySelector('#search-results');
    input.value = '물리';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    browser.searchFunctions.performSearch('물리');
    assert.equal(document.querySelector('.search-spinner').style.display, 'flex');
    timeout();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(requestSignal.aborted, true);
    assert.equal(document.querySelector('.search-spinner').style.display, 'none');
    assert.match(results.textContent, /글 목록에서 검색/);
    const form = document.querySelector('.search-form');
    assert.equal(form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })), true);
    assert.equal(form.action, 'https://blog.test/posts/');
    assert.equal(new browser.FormData(form).get('q'), '물리');

    // A fetch implementation that ignores abort must not overwrite timeout state.
    resolveFetch({ ok: true, json: async () => [searchRow({ title: '물리', url: '/physics/' })] });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(results.textContent, /글 목록에서 검색/);
    assert.equal(form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })), true);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('a timeout after dismissal stays closed; refocusing offers the fallback despite a late failure', async () => {
  let timeout;
  let rejectFetch;
  const browser = setup(() => new Promise((_, reject) => { rejectFetch = reject; }), undefined, window => {
    const actualTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      if (delay === 10000) { timeout = callback; return 0; }
      return actualTimeout(callback, delay, ...args);
    };
  });
  try {
    browser.document.querySelector('.sidebar-toggle').click();
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    input.focus();
    input.value = '물리';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    browser.document.querySelector('main').click();
    input.blur();
    timeout();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(results.classList.contains('active'), false);
    rejectFetch(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(results.classList.contains('active'), false);
    input.focus();
    assert.equal(results.classList.contains('active'), true);
    assert.match(results.textContent, /글 목록에서 검색/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('the search deadline includes response body parsing', async () => {
  let timeout;
  const browser = setup(async () => ({ ok: true, json: () => new Promise(() => {}) }), 'https://blog.test/about/?q=물리', window => {
    const actualTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      if (delay === 10000) { timeout = callback; return 0; }
      return actualTimeout(callback, delay, ...args);
    };
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    timeout();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('a background timeout leaves an untouched empty search closed until a query is entered', async () => {
  let timeout;
  const browser = setup(() => new Promise(() => {}), undefined, window => {
    const actualTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      if (delay === 10000) { timeout = callback; return 0; }
      return actualTimeout(callback, delay, ...args);
    };
  });
  try {
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    timeout();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(results.classList.contains('active'), false);
    input.focus();
    assert.equal(results.classList.contains('active'), false);
    input.value = '물리';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    assert.equal(results.classList.contains('active'), true);
    assert.match(results.textContent, /글 목록에서 검색/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('multi-term highlighting preserves original text and never interprets it as HTML', async () => {
  const cases = [
    { title: 'foo mark', description: 'foo mark', query: 'foo mark', marks: ['foo', 'mark'] },
    { title: 'foobar', description: 'foobar', query: 'foo foobar foo', marks: ['foobar'] },
    { title: 'aaa', description: 'aaa', query: 'aa', marks: ['aaa'] },
    { title: '한국어 C++ & <img src=x>', description: '한국어 C++ & 안전', query: '한국어 C++ &', marks: ['한국어', 'C++', '&'] },
  ];
  for (const item of cases) {
    const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ ...item, url: '/post/' })] }));
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const frames = [];
      browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
      browser.document.querySelector('#search-input').value = item.query;
      browser.searchFunctions.performSearch(item.query);
      frames.shift()();
      const link = browser.document.querySelector('.search-result-title a');
      assert.ok(link, `${item.query}: matching result`);
      assert.equal(link.textContent, item.title);
      assert.equal(link.children.length, 1, '강조 구간을 단일 제목 텍스트 요소로 묶는다');
      assert.ok(link.firstElementChild.matches('.search-result-title-text'));
      assert.equal(link.getAttribute('aria-label'), null, '화면의 강조와 언어 정보를 별도 이름으로 덮지 않는다');
      assert.deepEqual(Array.from(link.querySelectorAll('mark'), mark => mark.textContent), item.marks);
      assert.equal(link.querySelector('img'), null);
      assert.equal(browser.document.querySelector('.search-result-content').textContent.trim(), item.description);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('sidebar search matches canonically equivalent Korean text and preserves original highlights', async () => {
  const originalNfd = '가속도'.normalize('NFD');
  const cases = [
    { title: '가속도 계산기', query: originalNfd, marks: ['가속도'] },
    { title: `${originalNfd} 계산기`, query: '가속도', marks: [originalNfd] },
    { title: 'İstanbul 가속도', query: `i ${originalNfd}`, marks: ['İ', '가속도'] },
    { title: 'ΟΣ 가속도', query: 'ος', marks: ['ΟΣ'] },
    { title: 'H\u0331 물리', query: 'ẖ', marks: ['H\u0331'] },
  ];
  for (const item of cases) {
    const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: item.title, content: '예시 본문', url: '/post/' })] }));
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const frames = [];
      browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
      browser.document.querySelector('#search-input').value = item.query;
      browser.searchFunctions.performSearch(item.query);
      frames.shift()();
      const link = browser.document.querySelector('.search-result-title a');
      assert.ok(link, `${item.query}: matching result`);
      assert.equal(link.textContent, item.title);
      assert.deepEqual(Array.from(link.querySelectorAll('mark'), mark => mark.textContent), item.marks);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('sidebar search matches the visible Korean category label as well as its key', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '논리', category: 'mathematics_philosophy_history', content: '예시 본문', url: '/math/' }),
    searchRow({ title: '입자', category: 'science_philosophy_history', content: '예시 본문', url: '/science/' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    for (const query of ['수학철학', '수학철학'.normalize('NFD'), 'mathematics']) {
      browser.document.querySelector('#search-input').value = query;
      browser.searchFunctions.performSearch(query);
      frames.shift()();
      const links = Array.from(browser.document.querySelectorAll('.search-result-title a'), link => link.textContent);
      assert.deepEqual(links, ['논리']);
    }
    browser.searchFunctions.performSearch('수학철학 입자');
    frames.shift()();
    assert.equal(browser.document.querySelectorAll('.search-result-title a').length, 0, 'all search terms must match the same entry');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('a delayed index does not overwrite edits or a cleared URL query', async () => {
  for (const currentQuery of ['새 검색어', '']) {
    let resolveFetch;
    const browser = setup(() => new Promise(resolve => { resolveFetch = resolve; }), 'https://blog.test/about/?q=이전');
    try {
      const input = browser.document.querySelector('#search-input');
      assert.equal(input.value, '이전');
      input.value = currentQuery;
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      resolveFetch({ ok: true, json: async () => [searchRow({ title: '새 검색어', content: '예시 본문', url: '/post/' })] });
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(input.value, currentQuery);
      if (!currentQuery) assert.equal(browser.document.querySelector('#search-results').classList.contains('active'), false);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('a dismissed search stays closed when the delayed index arrives, and can reopen on focus', async () => {
  let resolveFetch;
  const browser = setup(() => new Promise(resolve => { resolveFetch = resolve; }));
  try {
    browser.document.querySelector('.sidebar-toggle').click();
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    input.focus();
    input.value = '물리';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    browser.document.querySelector('main').click();
    input.blur();
    resolveFetch({ ok: true, json: async () => [searchRow({ title: '물리', content: '예시 본문', url: '/physics/' })] });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(frames.length, 0);
    assert.equal(results.classList.contains('active'), false);

    input.focus();
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.equal(results.classList.contains('active'), true);
    assert.match(results.textContent, /물리/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('an empty or malformed index shows an actionable error and preserves native search fallback', async () => {
  const validRow = searchRow({ title: '물리', url: '/physics/' });
  const missingSearchFields = ['category', 'type', 'tags', 'description', 'content', 'date'].map(key => {
    const row = { ...validRow };
    delete row[key];
    return [row];
  });
  for (const payload of [
    [], { error: 'bad index' }, [null], [validRow, null],
    [{ ...validRow, category: {} }], [{ ...validRow, date: 123 }],
    [{ ...validRow, description: [] }], [{ ...validRow, tags: [null] }],
    [{ ...validRow, url: 'javascript:alert(1)' }],
    ...missingSearchFields,
  ]) {
    const browser = setup(async () => ({ ok: true, json: async () => payload }));
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const document = browser.document;
      const input = document.querySelector('#search-input');
      const results = document.querySelector('#search-results');
      assert.equal(results.classList.contains('active'), false);
      document.querySelector('main').click();
      assert.equal(results.classList.contains('active'), false);
      input.value = '물리';
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      assert.equal(results.classList.contains('active'), true);
      assert.match(results.textContent, /글 목록에서 검색/);
      const form = document.querySelector('.search-form');
      assert.equal(form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })), true);
      assert.equal(new browser.FormData(form).get('q'), '물리');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('글 본문이 비어 있으면 정상 검색 결과 대신 글 목록의 제한 검색을 안내한다', async () => {
  for (const content of ['', ' \n\t']) {
    const rows = [
      searchRow({ title: '정상 글', url: '/good/' }),
      searchRow({ title: '본문이 누락된 글', url: '/missing/', content }),
    ];
    const browser = setup(async () => ({ ok: true, json: async () => rows }));
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const input = browser.document.querySelector('#search-input');
      const results = browser.document.querySelector('#search-results');
      input.value = '본문전용단어';
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      assert.match(results.textContent, /글 목록에서 검색/);
      assert.doesNotMatch(results.textContent, /검색 결과가 없습니다/);
      const form = browser.document.querySelector('.search-form');
      assert.equal(form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })), true);
      assert.equal(new browser.FormData(form).get('q'), '본문전용단어');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('기대한 글의 누락, 중복, 예상하지 못한 글이 있으면 제한 검색을 안내한다', async () => {
  const a = searchRow({ title: '첫 글', url: 'https://canonical.test/blog/posts/%ED%95%9C%EA%B8%80/' });
  const b = searchRow({ title: '둘째 글', url: 'https://canonical.test/blog/posts/second/' });
  const extra = searchRow({ title: '다른 글', url: 'https://canonical.test/blog/posts/other/' });
  for (const rows of [[a], [a, a], [a, extra], [a, b, b]]) {
    const browser = setup(async () => ({ ok: true, json: async () => rows }),
      'https://preview.test/blog/about/', window => {
        const form = window.document.querySelector('.search-form');
        form.dataset.siteBaseUrl = 'https://canonical.test/blog';
        form.dataset.expectedPostPaths = JSON.stringify(['/blog/posts/한글/', '/blog/posts/second/']);
      });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const input = browser.document.querySelector('#search-input');
      input.value = '둘째';
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      const results = browser.document.querySelector('#search-results');
      assert.match(results.textContent, /글 목록에서 검색/);
      assert.doesNotMatch(results.textContent, /검색 결과가 없습니다/);
      const form = browser.document.querySelector('.search-form');
      assert.equal(form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })), true);
      assert.equal(new browser.FormData(form).get('q'), '둘째');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('기대 글 목록이 없거나 손상되면 검색 완전성을 단정하지 않는다', async () => {
  for (const expected of [undefined, '잘못된 JSON', '{}', '[null]', '["/same/","/same/"]']) {
    const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: '물리', url: '/physics/' })] }),
      undefined, window => {
        const form = window.document.querySelector('.search-form');
        if (expected === undefined) delete form.dataset.expectedPostPaths;
        else form.dataset.expectedPostPaths = expected;
      });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const input = browser.document.querySelector('#search-input');
      input.value = '물리';
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('기대한 페이지가 누락·중복되거나 예상하지 못한 페이지가 있으면 제한 검색을 안내한다', async () => {
  const page = path => searchRow({ title: '도구', type: 'page', url: path, content: '' });
  const a = page('https://canonical.test/blog/tools/');
  const b = page('https://canonical.test/blog/series/');
  const extra = page('https://canonical.test/blog/other/');
  for (const rows of [[a], [a, a], [a, extra], [a, b, b]]) {
    const browser = setup(async () => ({ ok: true, json: async () => rows }),
      'https://preview.test/blog/about/', window => {
        const form = window.document.querySelector('.search-form');
        form.dataset.siteBaseUrl = 'https://canonical.test/blog';
        form.dataset.expectedPostPaths = '[]';
        form.dataset.expectedPagePaths = JSON.stringify(['/blog/tools/', '/blog/series/']);
      });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const input = browser.document.querySelector('#search-input');
      input.value = '시리즈';
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
      const form = browser.document.querySelector('.search-form');
      assert.equal(form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })), true);
      assert.equal(new browser.FormData(form).get('q'), '시리즈');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('기대 페이지 목록이 없거나 잘못되면 검색 완전성을 단정하지 않는다', async () => {
  for (const expected of [undefined, '잘못된 JSON', '{}', '[null]', '["/same/","/same/"]']) {
    const browser = setup(async () => ({ ok: true, json: async () => [
      searchRow({ title: '도구', type: 'page', url: '/tools/', content: '' }),
    ] }), undefined, window => {
      const form = window.document.querySelector('.search-form');
      form.dataset.expectedPostPaths = '[]';
      if (expected === undefined) delete form.dataset.expectedPagePaths;
      else form.dataset.expectedPagePaths = expected;
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const input = browser.document.querySelector('#search-input');
      input.value = '도구';
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('한글 경로와 인코딩된 경로가 일치하면 미리보기에서도 정상 검색한다', async () => {
  const rows = [
    searchRow({ title: '한글', url: 'https://canonical.test/blog/posts/%ED%95%9C%EA%B8%80/' }),
    searchRow({ title: '둘째', url: 'https://canonical.test/blog/posts/second/' }),
    searchRow({ title: '도구', type: 'page', url: 'https://canonical.test/blog/tools/', content: '' }),
  ];
  const browser = setup(async () => ({ ok: true, json: async () => rows }),
    'https://preview.test/blog/about/', window => {
      const form = window.document.querySelector('.search-form');
      form.dataset.siteBaseUrl = 'https://canonical.test/blog';
      form.dataset.expectedPostPaths = JSON.stringify(['/blog/posts/한글/', '/blog/posts/second/']);
    });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    browser.searchFunctions.performSearch('한글');
    frames.shift()();
    const link = browser.document.querySelector('#search-results a');
    assert.equal(link.getAttribute('href'), '/blog/posts/%ED%95%9C%EA%B8%80/');
    assert.equal(new URL(link.href).origin, 'https://preview.test');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('인코딩된 경로 구분자는 실제 경로 구분자와 다르게 취급한다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '다른 경로', url: '/posts/a%2Fb/' }),
  ] }), undefined, window => {
    window.document.querySelector('.search-form').dataset.expectedPostPaths = JSON.stringify(['/posts/a/b/']);
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const input = browser.document.querySelector('#search-input');
    input.value = '다른 경로';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('이중 인코딩된 구분자는 한 번 인코딩된 구분자와 다른 경로다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '다른 경로', url: '/posts/a%2Fb/' }),
  ] }), undefined, window => {
    window.document.querySelector('.search-form').dataset.expectedPostPaths = JSON.stringify(['/posts/a%252Fb/']);
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const input = browser.document.querySelector('#search-input');
    input.value = '다른 경로';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('한글의 각각의 유니코드 형태와 퍼센트 인코딩 대소문자는 같은 경로로 비교한다', async () => {
  for (const path of ['/posts/한글/', `/posts/${'한글'.normalize('NFD')}/`, '/posts/a%2fb/']) {
    const encoded = new URL(path, 'https://blog.test').pathname;
    const browser = setup(async () => ({ ok: true, json: async () => [
      searchRow({ title: '검색할 글', url: path }),
    ] }), undefined, window => {
      const differentCase = encoded.replace(/%[0-9a-f]{2}/gi, value => value === value.toUpperCase() ? value.toLowerCase() : value.toUpperCase());
      window.document.querySelector('.search-form').dataset.expectedPostPaths = JSON.stringify([differentCase]);
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const frames = [];
      browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
      browser.searchFunctions.performSearch('검색할 글');
      frames.shift()();
      assert.ok(browser.document.querySelector('#search-results a'), `${path}: 검색 결과가 표시되어야 합니다`);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('서로 다른 한글 정규화 형태는 별개의 경로로 취급한다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '한글', url: `/posts/${'한글'.normalize('NFD')}/` }),
  ] }), undefined, window => {
    window.document.querySelector('.search-form').dataset.expectedPostPaths = JSON.stringify(['/posts/한글/']);
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const input = browser.document.querySelector('#search-input');
    input.value = '한글';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('빈 본문을 허용하는 페이지 검색 항목은 사용 가능하다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '도구 안내', type: 'page', url: '/tools/', content: '' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    browser.searchFunctions.performSearch('도구 안내');
    frames.shift()();
    assert.equal(browser.document.querySelector('#search-results a').getAttribute('href'), '/tools/');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('사이드바 검색은 정식 사이트의 인코딩된 주소를 미리보기 호스트에서 연다', async () => {
  const cases = [
    { base: 'https://canonical.test', url: 'https://canonical.test/%2Fevil.com?q=%3F#문단', expected: '/%2Fevil.com?q=%3F#%EB%AC%B8%EB%8B%A8' },
    { base: 'https://canonical.test/blog', url: 'https://canonical.test/blog/%3F%ED%95%9C%EA%B8%80', expected: '/blog/%3F%ED%95%9C%EA%B8%80' },
    { base: 'https://canonical.test:8443/blog', url: 'https://canonical.test:8443/blog/tools/a?x=1#part', expected: '/blog/tools/a?x=1#part' },
    { base: 'https://canonical.test/blog', url: 'tools/guide/', expected: '/blog/tools/guide/' },
  ];
  for (const { base, url, expected } of cases) {
    const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: '물리', url })] }),
      'https://preview.test/blog/about/', b => { b.document.querySelector('.search-form').dataset.siteBaseUrl = base; });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const frames = [];
      browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
      browser.searchFunctions.performSearch('물리');
      frames.shift()();
      const link = browser.document.querySelector('#search-results a');
      assert.equal(link.getAttribute('href'), expected);
      assert.equal(new URL(link.href).origin, 'https://preview.test');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('사이드바 검색은 다른 출처나 사이트 경로 밖의 주소가 섞이면 기본 검색으로 복구한다', async () => {
  const invalidUrls = [
    'https://attacker.test/blog/a', 'https://canonical.test:8443/blog/a',
    'http://canonical.test/blog/a', 'https://user@canonical.test/blog/a',
    'javascript:alert(1)', '//attacker.test/blog/a', 'https://canonical.test//attacker.test/a',
    '/outside/a', '/blog-other/a', '../outside/a',
  ];
  for (const url of invalidUrls) {
    const rows = [searchRow({ title: '정상', url: '/blog/good/' }), searchRow({ title: '물리', url })];
    const browser = setup(async () => ({ ok: true, json: async () => rows }),
      'https://preview.test/blog/about/', b => { b.document.querySelector('.search-form').dataset.siteBaseUrl = 'https://canonical.test/blog'; });
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const input = browser.document.querySelector('#search-input');
      input.value = '물리';
      input.dispatchEvent(new browser.Event('input', { bubbles: true }));
      assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
      assert.equal(browser.document.querySelector('#search-results a'), null);
      const form = browser.document.querySelector('.search-form');
      assert.equal(form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })), true);
      assert.equal(new browser.FormData(form).get('q'), '물리');
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('검색 처리 중 예외가 발생해도 글 목록으로 검색을 계속할 수 있다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: '물리', url: '/physics/' })] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    browser.history.replaceState = () => { throw new Error('기록 저장 실패'); };
    const input = browser.document.querySelector('#search-input');
    input.value = '물리';
    browser.searchFunctions.performSearch(input.value);
    frames.shift()();
    assert.match(browser.document.querySelector('#search-results').textContent, /글 목록에서 검색/);
    const form = browser.document.querySelector('.search-form');
    assert.equal(form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })), true);
    assert.equal(new browser.FormData(form).get('q'), '물리');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('a dismissed search stays closed when the delayed index request fails', async () => {
  let rejectFetch;
  const browser = setup(() => new Promise((resolve, reject) => { rejectFetch = reject; }));
  try {
    browser.document.querySelector('.sidebar-toggle').click();
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    input.value = '물리';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    browser.document.querySelector('main').click();
    rejectFetch(new Error('offline'));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(results.classList.contains('active'), false);
    input.focus();
    assert.equal(results.classList.contains('active'), true);
    assert.match(results.textContent, /글 목록에서 검색/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('이력 복원으로 검색 결과가 교체될 때 포커스를 입력란에 복구한다', { timeout: 3000 }, async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '물리', url: '/physics/' }),
    searchRow({ title: '수학', url: '/math/' }),
  ] }), 'https://blog.test/about/?q=수학');
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const doc = browser.document;
    const input = doc.querySelector('#search-input');
    const results = doc.querySelector('#search-results');
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    doc.querySelector('.sidebar-toggle').click();
    browser.searchFunctions.performSearch('수학', { historyMode: 'none' });
    frames.shift()();
    input.value = '물리';
    doc.querySelector('.search-form').dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    frames.shift()();
    const link = results.querySelector('a');
    link.focus();
    assert.ok(doc.activeElement === link);

    const navigate = method => new Promise(resolve => {
      browser.addEventListener('popstate', resolve, { once: true });
      browser.history[method]();
    });
    await navigate('back');
    assert.equal(input.value, '수학');
    assert.ok(doc.activeElement === input, '숨겨질 결과의 포커스를 입력란으로 옮긴다');
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.ok(doc.activeElement === input, '결과가 교체된 뒤에도 입력란 포커스를 유지한다');
    assert.match(results.textContent, /수학/);

    results.querySelector('a').focus();
    await navigate('forward');
    assert.ok(doc.activeElement === input, '앞으로 가기에도 같은 복구가 적용된다');
    frames.shift()();
    assert.match(results.textContent, /물리/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('이력 복원 뒤 사용자가 옮긴 포커스를 늦은 결과 갱신이 빼앗지 않는다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '물리', url: '/physics/' }),
    searchRow({ title: '수학', url: '/math/' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const doc = browser.document;
    const input = doc.querySelector('#search-input');
    const results = doc.querySelector('#search-results');
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    doc.querySelector('.sidebar-toggle').click();
    input.value = '물리';
    browser.searchFunctions.performSearch('물리', { historyMode: 'none' });
    frames.shift()();
    results.querySelector('a').focus();
    browser.history.replaceState({}, '', '?q=수학');
    browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    assert.ok(doc.activeElement === input);
    const outside = doc.createElement('button');
    doc.querySelector('.sidebar-right').appendChild(outside);
    outside.focus();
    assert.ok(doc.activeElement === outside, '열린 메뉴에서 다른 버튼을 선택할 수 있다');
    frames.shift()();
    assert.ok(doc.activeElement === outside, '이후 사용자가 선택한 포커스를 유지한다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('닫혔거나 숨겨진 메뉴와 IME 조합 중에는 검색 입력으로 포커스를 강제하지 않는다', async () => {
  for (const condition of ['닫힌 메뉴', '숨겨진 입력', 'IME']) {
    const browser = setup(async () => ({ ok: true, json: async () => [
      searchRow({ title: '물리', url: '/physics/' }),
      searchRow({ title: '수학', url: '/math/' }),
    ] }));
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const doc = browser.document;
      const input = doc.querySelector('#search-input');
      const results = doc.querySelector('#search-results');
      const frames = [];
      browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
      doc.querySelector('.sidebar-toggle').click();
      input.value = '물리';
      browser.searchFunctions.performSearch('물리', { historyMode: 'none' });
      frames.shift()();
      if (condition === 'IME') input.dispatchEvent(new browser.CompositionEvent('compositionstart', { bubbles: true }));
      const link = results.querySelector('a');
      link.focus();
      assert.ok(doc.activeElement === link);
      if (condition === '닫힌 메뉴') doc.querySelector('.sidebar-right').setAttribute('aria-hidden', 'true');
      if (condition === '숨겨진 입력') input.style.display = 'none';
      browser.history.replaceState({}, '', '?q=수학');
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
      assert.ok(doc.activeElement !== input, `${condition}: 보이지 않는 입력이나 조합 중인 입력으로 이동하지 않는다`);
      if (frames.length) frames.shift()();
      assert.ok(doc.activeElement !== input, `${condition}: 결과 갱신 후에도 입력으로 이동하지 않는다`);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('back and forward restore sidebar query and results without rewriting history or moving focus', { timeout: 2000 }, async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '물리', content: '예시 본문', url: '/physics/' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const doc = browser.document;
    const input = doc.querySelector('#search-input');
    const results = doc.querySelector('#search-results');
    const focusTarget = doc.querySelector('.sidebar-toggle');
    focusTarget.focus();
    input.value = '물리';
    doc.querySelector('.search-form').dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    frames.shift()();
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '물리');
    const length = browser.history.length;
    const navigate = method => new Promise(resolve => {
      browser.addEventListener('popstate', resolve, { once: true });
      browser.history[method]();
    });
    await navigate('back');
    assert.equal(input.value, '');
    assert.equal(results.classList.contains('active'), false);
    assert.equal(browser.history.length, length);
    assert.ok(doc.activeElement === focusTarget);
    await navigate('forward');
    assert.equal(input.value, '물리');
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.match(results.textContent, /물리/);
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '물리');
    assert.equal(browser.history.length, length);
    assert.ok(doc.activeElement === focusTarget);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('history restoration invalidates queued searches and survives a delayed index response', async () => {
  let resolveFetch;
  const browser = setup(() => new Promise(resolve => { resolveFetch = resolve; }), 'https://blog.test/about/?q=물리');
  try {
    const input = browser.document.querySelector('#search-input');
    browser.history.pushState({}, '', '?q=수학');
    browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    assert.equal(input.value, '수학');
    const before = browser.location.href;
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    resolveFetch({ ok: true, json: async () => [searchRow({ title: '수학', content: '예시 본문', url: '/math/' })] });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.equal(browser.location.href, before);
    assert.match(browser.document.querySelector('#search-results').textContent, /수학/);
    input.value = '새 입력';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    browser.history.replaceState({}, '', '/about/');
    browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    assert.equal(input.value, '');
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(frames.length, 0);
    assert.equal(browser.document.querySelector('#search-results').classList.contains('active'), false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('an older animation frame cannot overwrite the restored search or URL', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [
    searchRow({ title: '물리', content: '예시 본문', url: '/physics/' }),
    searchRow({ title: '수학', content: '예시 본문', url: '/math/' }),
  ] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    input.value = '물리';
    browser.searchFunctions.performSearch('물리', { historyMode: 'push' });
    browser.history.replaceState({ preserved: true }, '', '/about/?q=수학');
    browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    assert.equal(frames.length, 2);
    frames[0]();
    frames[1]();
    assert.equal(input.value, '수학');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '수학');
    assert.equal(browser.history.state.preserved, true);
    const results = browser.document.querySelector('#search-results').textContent;
    assert.match(results, /수학/);
    assert.doesNotMatch(results, /물리/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('typing after history restoration wins while the search index is loading', async () => {
  let resolveFetch;
  const browser = setup(() => new Promise(resolve => { resolveFetch = resolve; }));
  try {
    browser.history.pushState({}, '', '?q=이전');
    browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    const input = browser.document.querySelector('#search-input');
    input.value = '새 검색';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    resolveFetch({ ok: true, json: async () => [searchRow({ title: '새 검색', content: '예시 본문', url: '/new/' })] });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.equal(input.value, '새 검색');
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '새 검색');
    assert.match(browser.document.querySelector('#search-results').textContent, /새 검색/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('Korean IME composition defers search and submission until composition ends', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: '물리', content: '예시 본문', url: '/physics/' })] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const form = browser.document.querySelector('.search-form');
    input.dispatchEvent(new browser.CompositionEvent('compositionstart', { bubbles: true }));
    input.value = '물';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(frames.length, 0);
    assert.equal(new URL(browser.location.href).searchParams.has('q'), false);
    assert.equal(form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true })), false);
    assert.equal(frames.length, 0);
    input.value = '물리';
    input.dispatchEvent(new browser.CompositionEvent('compositionend', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.match(browser.document.querySelector('#search-results').textContent, /물리/);
    assert.equal(new URL(browser.location.href).searchParams.get('q'), '물리');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('a late composition end cannot replace a query restored by history', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: '물리', content: '예시 본문', url: '/physics/' })] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    input.dispatchEvent(new browser.CompositionEvent('compositionstart', { bubbles: true }));
    input.value = '오래된 입력';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    browser.history.pushState({ marker: true }, '', '?q=물리');
    const before = browser.location.href;
    browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    input.value = '오래된 입력'; // A late IME update from the pre-navigation composition.
    input.dispatchEvent(new browser.CompositionEvent('compositionend', { bubbles: true }));
    assert.equal(input.value, '물리');
    assert.equal(browser.location.href, before);
    assert.equal(browser.history.state.marker, true);
    for (const frame of frames) frame();
    assert.match(browser.document.querySelector('#search-results').textContent, /물리/);
    assert.equal(browser.location.href, before);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('native submission remains available while the index is loading, then search takes over', async () => {
  let resolveFetch;
  const browser = setup(() => new Promise(resolve => { resolveFetch = resolve; }));
  try {
    const form = browser.document.querySelector('.search-form');
    browser.document.querySelector('#search-input').value = '물리';
    const submit = () => form.dispatchEvent(new browser.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(submit(), true);
    resolveFetch({ ok: true, json: async () => [searchRow({ title: '물리', content: '예시 본문', url: '/posts/physics/' })] });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(submit(), false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('clearing the input prevents an already scheduled search from restoring results and query', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: '물리', content: '예시 본문', url: '/posts/physics/' })] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    input.value = '물리';
    browser.searchFunctions.performSearch('물리');
    assert.equal(frames.length, 1);
    input.value = '';
    input.dispatchEvent(new browser.Event('input', { bubbles: true }));
    frames[0]();
    assert.equal(browser.document.querySelector('#search-results').classList.contains('active'), false);
    assert.equal(new URL(browser.location.href).searchParams.has('q'), false);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('수정 키가 포함되거나 이미 처리된 Escape는 검색과 모바일 메뉴 상태를 유지한다', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: '물리', url: '/physics/' })] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const doc = browser.document;
    const toggle = doc.querySelector('.sidebar-toggle');
    const input = doc.querySelector('#search-input');
    const results = doc.querySelector('#search-results');
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    toggle.click();
    input.focus();
    input.value = '물리';
    browser.searchFunctions.performSearch('물리');
    frames.shift()();
    const link = results.querySelector('.search-result-item a');
    assert.ok(link);

    for (const target of [input, link]) {
      for (const modifier of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'handled']) {
        target.focus();
        let reachedDocument = false;
        const onDocument = () => { reachedDocument = true; };
        doc.addEventListener('keydown', onDocument, { once: true });
        const options = { key: 'Escape', bubbles: true, cancelable: true };
        if (modifier !== 'handled') options[modifier] = true;
        const event = new browser.KeyboardEvent('keydown', options);
        if (modifier === 'handled') event.preventDefault();
        target.dispatchEvent(event);
        doc.removeEventListener('keydown', onDocument);
        assert.equal(event.defaultPrevented, modifier === 'handled', `${modifier}: 기본 동작 처리 상태 유지`);
        assert.equal(reachedDocument, true, `${modifier}: 이벤트 전파 유지`);
        assert.equal(results.classList.contains('active'), true, `${modifier}: 검색 결과 유지`);
        assert.equal(toggle.getAttribute('aria-expanded'), 'true', `${modifier}: 메뉴 열림 유지`);
        assert.ok(doc.activeElement === target, `${modifier}: 포커스 유지`);
      }
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('Escape closes search results first and closes the mobile sidebar on the next press', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: '물리', content: '예시 본문', url: '/posts/physics/' })] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const document = browser.document;
    const sidebar = document.querySelector('.sidebar-right');
    const toggle = document.querySelector('.sidebar-toggle');
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    const input = document.querySelector('#search-input');
    const results = document.querySelector('#search-results');
    input.focus();
    results.classList.add('active');
    input.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(results.classList.contains('active'), false);
    assert.equal(sidebar.classList.contains('sidebar-collapsed'), false);
    assert.equal(document.activeElement, input);
    input.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(sidebar.classList.contains('sidebar-collapsed'), true);
    assert.equal(document.activeElement, toggle);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('Escape from a result link returns focus without reopening the results', async () => {
  const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: '물리', content: '예시 본문', url: '/posts/physics/' })] }));
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    const frames = [];
    browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    const input = browser.document.querySelector('#search-input');
    const results = browser.document.querySelector('#search-results');
    browser.document.querySelector('.sidebar-toggle').click();
    input.value = '물리';
    browser.searchFunctions.performSearch('물리');
    frames[0]();
    const link = results.querySelector('a');
    assert.ok(link);
    link.focus();
    link.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.ok(browser.document.activeElement === input, 'Escape should return focus to the search input');
    assert.equal(results.classList.contains('active'), false);
    assert.equal(frames.length, 1);
    input.blur();
    input.focus();
    assert.equal(results.classList.contains('active'), true);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('IME composition reserves Escape and arrow keys for the input method', async () => {
  for (const compositionMode of ['compositionstart', 'isComposing', 'keyCode']) {
    const browser = setup(async () => ({ ok: true, json: async () => [searchRow({ title: '물리', content: '예시 본문', url: '/physics/' })] }));
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      browser.document.querySelector('.sidebar-toggle').click();
      const frames = [];
      browser.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
      const input = browser.document.querySelector('#search-input');
      const results = browser.document.querySelector('#search-results');
      input.focus();
      input.value = '물리';
      browser.searchFunctions.performSearch('물리');
      frames.shift()();
      if (compositionMode === 'compositionstart') input.dispatchEvent(new browser.CompositionEvent('compositionstart', { bubbles: true }));
      for (const key of ['ArrowDown', 'ArrowUp', 'Escape']) {
        const event = new browser.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, isComposing: compositionMode === 'isComposing' });
        if (compositionMode === 'keyCode') Object.defineProperty(event, 'keyCode', { value: 229 });
        input.dispatchEvent(event);
        assert.equal(event.defaultPrevented, false, `${key} must remain available to the IME`);
        assert.equal(browser.document.activeElement, input, `${key} must not move focus`);
        assert.equal(results.classList.contains('active'), true, `${key} must not close search results`);
      }
    } finally {
      await browser.happyDOM.abort();
    }
  }
});
