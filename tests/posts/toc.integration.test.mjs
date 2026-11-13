import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const siteRoot = process.env.SITE_ROOT ? resolve(process.env.SITE_ROOT) : resolve('_site');
const script = await readFile(new URL('../../assets/js/post-toc.js', import.meta.url), 'utf8');

function createDocument(html) {
  const browser = new Window({
    url: 'https://blog.test/posts/example/',
    settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true },
  });
  browser.document.write(html);
  browser.eval(script);
  return browser;
}

// HTML의 fragment 대상 선택은 원문 ID/name을 먼저 찾고, 없으면 퍼센트
// 디코딩한 UTF-8 문자열로 다시 찾는다. 디코딩만 하면 유효한 ID를 놓친다.
function fragmentTarget(document, link) {
  // happy-dom의 anchor.hash는 비ASCII를 인코딩하지 않으므로 표준 URL로 직렬화한다.
  const address = new URL(link.getAttribute('href'), document.baseURI);
  const current = new URL(document.URL);
  if (address.origin !== current.origin || address.pathname !== current.pathname || address.search !== current.search) return null;
  const fragment = address.hash.slice(1);
  if (!fragment) return null;
  const findTarget = value => document.getElementById(value)
    || [...document.querySelectorAll('a[name]')].find(anchor => anchor.getAttribute('name') === value)
    || null;
  const direct = findTarget(fragment);
  if (direct) return direct;

  const bytes = new TextEncoder().encode(fragment);
  const decodedBytes = [];
  const hexValue = byte => {
    if (byte >= 0x30 && byte <= 0x39) return byte - 0x30;
    if (byte >= 0x41 && byte <= 0x46) return byte - 0x41 + 10;
    if (byte >= 0x61 && byte <= 0x66) return byte - 0x61 + 10;
    return -1;
  };
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0x25 && index + 2 < bytes.length) {
      const high = hexValue(bytes[index + 1]);
      const low = hexValue(bytes[index + 2]);
      if (high !== -1 && low !== -1) {
        decodedBytes.push(high * 16 + low);
        index += 2;
        continue;
      }
    }
    decodedBytes.push(bytes[index]);
  }
  return findTarget(new TextDecoder('utf-8', { ignoreBOM: true }).decode(Uint8Array.from(decodedBytes)));
}

test('생성된 모든 글의 목차가 제목과 고유한 이동 대상을 가리킨다', async () => {
  const postsDir = resolve(siteRoot, 'posts');
  const directories = (await readdir(postsDir, { withFileTypes: true }))
    .filter(entry => entry.isDirectory());
  const base = process.env.SITE_BASEURL || '';
  const index = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const expected = index.filter(entry => entry.type === 'post').map(entry => {
    const pathname = decodeURIComponent(new URL(entry.url).pathname);
    assert.ok(pathname.startsWith(`${base}/posts/`), `${pathname}: 글의 경로 확인`);
    return pathname.slice(`${base}/posts/`.length).replace(/\/$/, '');
  });
  assert.ok(expected.length > 0, '검색 색인에 글이 있어야 합니다');
  assert.deepEqual(directories.map(entry => entry.name).sort(), expected.sort(), '검색 색인과 생성 글 경로가 양방향으로 일치해야 합니다');

  let checkedHeadings = 0;
  for (const directory of directories) {
    const slug = directory.name;
    const html = await readFile(resolve(postsDir, slug, 'index.html'), 'utf8');
    const browser = createDocument(html);
    try {
      const document = browser.document;
      const article = document.querySelector('article.post');
      assert.ok(article, `${slug}: 글 본문이 있어야 합니다`);
      const content = article.querySelector('.post-content');
      const toc = article.querySelector('.table-of-contents');
      assert.ok(content && toc, `${slug}: 본문과 목차가 있어야 합니다`);

      const headings = [...content.querySelectorAll('h2, h3')]
        .filter(heading => heading.textContent.trim());
      const links = [...toc.querySelectorAll('.toc-list a')];
      assert.equal(toc.hidden, headings.length === 0, `${slug}: 제목이 있을 때만 목차가 보여야 합니다`);
      assert.equal(links.length, headings.length, `${slug}: 목차 항목과 빈 제목을 제외한 본문 제목 수가 같아야 합니다`);

      const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
      headings.forEach((heading, index) => {
        const id = heading.id;
        const link = links[index];
        assert.ok(id, `${slug}: 제목에 이동 대상이 있어야 합니다`);
        assert.equal(ids.filter(value => value === id).length, 1, `${slug}: ${id} 식별자는 문서에서 유일해야 합니다`);
        assert.ok(fragmentTarget(document, link) === heading, `${slug}: 목차 링크가 해당 제목으로 이동해야 합니다`);
        assert.equal(document.getElementById(id), heading, `${slug}: 목차 대상이 해당 제목이어야 합니다`);
        assert.equal(link.textContent, heading.textContent.trim(), `${slug}: 목차에 올바른 제목이 표시되어야 합니다`);
      });
      checkedHeadings += headings.length;
    } finally {
      await browser.happyDOM.abort();
    }
  }
  assert.ok(checkedHeadings > 0, '실제 제목을 적어도 하나 이상 검사해야 합니다');
});

test('빈 제목을 제외하고 식별자 충돌을 피하며 빈 목차는 숨긴다', async () => {
  const browser = createDocument(`<!doctype html><html lang="ko"><body>
    <div id="same"></div>
    <details class="table-of-contents" hidden><summary>목차</summary><ul class="toc-list"></ul></details>
    <div class="post-content"><h2> </h2><h2 id="same">제목</h2><h3 id="same">소제목</h3><h2 id="same-2">다른 제목</h2></div>
  </body></html>`);
  try {
    const { document } = browser;
    const headings = [...document.querySelectorAll('.post-content h2, .post-content h3')];
    const links = [...document.querySelectorAll('.toc-list a')];
    assert.equal(links.length, 3, '빈 제목은 목차에 포함되지 않아야 합니다');
    assert.equal(document.querySelector('.table-of-contents').hidden, false);
    assert.equal(headings[3].id, 'same-2', '기존에 예약된 제목 식별자는 유지해야 합니다');
    for (const [index, heading] of headings.slice(1).entries()) {
      assert.ok(fragmentTarget(document, links[index]) === heading);
      assert.equal([...document.querySelectorAll('[id]')].filter(element => element.id === heading.id).length, 1);
    }
  } finally {
    await browser.happyDOM.abort();
  }

  const empty = createDocument(`<!doctype html><html lang="ko"><body>
    <details class="table-of-contents" hidden><summary>목차</summary><ul class="toc-list"></ul></details>
    <div class="post-content"><h2> </h2></div>
  </body></html>`);
  try {
    assert.equal(empty.document.querySelector('.toc-list').children.length, 0);
    assert.equal(empty.document.querySelector('.table-of-contents').hidden, true);
  } finally {
    await empty.happyDOM.abort();
  }
});

test('빈 제목의 기존 식별자도 충돌 검사에 반영하고 목차는 표시된 제목을 가리킨다', async () => {
  const browser = createDocument(`<!doctype html><html lang="ko"><body>
    <details class="table-of-contents" hidden><summary>목차</summary><ul class="toc-list"></ul></details>
    <div class="post-content">
      <h2 id="same"> </h2><h2 id="same">앞의 빈 제목과 충돌</h2><h3 id="same-2">기존 제목</h3>
      <h2 id="later">앞의 제목 유지</h2><h2 id="later"> </h2>
      <h2 id="outside">제목 외 요소와 충돌</h2><div id="outside"></div>
      <h2> </h2>
    </div>
  </body></html>`);
  try {
    const { document } = browser;
    const headings = [...document.querySelectorAll('.post-content h2, .post-content h3')];
    const links = [...document.querySelectorAll('.toc-list a')];
    assert.deepEqual(headings.map(heading => heading.id), [
      'same', 'same-3', 'same-2', 'later', 'later-2', 'outside-2', '',
    ]);
    assert.equal(document.getElementById('same'), headings[0], '앞의 빈 제목을 가리키던 기존 링크는 유지한다');
    assert.equal(document.getElementById('later'), headings[3], '앞의 제목을 가리키던 기존 링크는 유지한다');
    assert.equal(document.getElementById('outside').tagName, 'DIV', '제목 외 요소의 기존 식별자를 유지한다');
    assert.equal(links.length, 4, '빈 제목은 목차에 나타나지 않아야 한다');
    const visibleHeadings = headings.filter(heading => heading.textContent.trim());
    for (const [index, heading] of visibleHeadings.entries()) {
      assert.ok(fragmentTarget(document, links[index]) === heading);
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('새로 생성하는 제목 ID는 기존 레거시 앵커 이름을 가로채지 않는다', async () => {
  const browser = createDocument(`<!doctype html><html lang="ko"><body>
    <a name="hello">기존 위치</a><a name="hello-2">기존 두 번째 위치</a>
    <a name="shared">명시적 ID와 같은 이름</a><a name="dup-2">기존 중복 제목 위치</a>
    <details class="table-of-contents" hidden><summary>목차</summary><ul class="toc-list"></ul></details>
    <div class="post-content">
      <h2>Hello</h2><h2 id="shared">명시적 제목</h2>
      <h2 id="dup">첫 제목</h2><h3 id="dup">중복 제목</h3><h2> </h2><h2>Unique</h2>
    </div>
  </body></html>`);
  try {
    const { document } = browser;
    const headings = [...document.querySelectorAll('.post-content h2, .post-content h3')];
    const links = [...document.querySelectorAll('.toc-list a')];
    assert.deepEqual(headings.map(heading => heading.id), ['hello-3', 'shared', 'dup', 'dup-3', '', 'unique']);
    assert.equal(links.length, 5, '빈 제목은 목차에 포함하지 않는다');
    for (const [index, heading] of headings.filter(item => item.textContent.trim()).entries()) {
      assert.ok(fragmentTarget(document, links[index]) === heading, '목차 링크는 해당 제목을 가리킨다');
    }
    for (const name of ['hello', 'hello-2', 'dup-2']) {
      const link = document.createElement('a');
      link.href = `#${name}`;
      assert.ok(fragmentTarget(document, link) === document.querySelector(`a[name="${name}"]`), `${name}: 기존 앵커 링크 유지`);
    }
    const explicit = document.createElement('a');
    explicit.href = '#shared';
    assert.ok(fragmentTarget(document, explicit) === headings[1], '기존 명시적 ID의 우선순위는 유지한다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('원문 퍼센트 ID를 디코딩보다 먼저 찾고 인코딩 별칭 충돌을 감지한다', async () => {
  const browser = createDocument(`<!doctype html><html lang="ko"><body>
    <details class="table-of-contents" hidden><summary>목차</summary><ul class="toc-list"></ul></details>
    <div class="post-content">
      <h2 id="rate%20limit">원문 퍼센트</h2><h2 id="rate%2520limit">이중 퍼센트</h2>
      <h2 id="공백 값">공백 제목</h2><h2 id="가">한글 제목</h2>
      <h2 id="%EA%B0%80">인코딩 형태 제목</h2><h2 id="hash#value">해시 제목</h2>
    </div>
  </body></html>`);
  try {
    const { document } = browser;
    const headings = [...document.querySelectorAll('.post-content h2')];
    const links = [...document.querySelectorAll('.toc-list a')];
    assert.deepEqual(headings.map(heading => heading.id), [
      'rate%20limit', 'rate%2520limit', '공백 값', '가', '%EA%B0%80', 'hash#value',
    ], '작성한 ID는 변경하지 않는다');
    assert.ok(fragmentTarget(document, links[0]) === headings[0], '원문 퍼센트 ID가 우선이다');
    assert.ok(fragmentTarget(document, links[1]) === headings[1], '이중 퍼센트도 원문 ID를 우선한다');
    assert.ok(fragmentTarget(document, links[2]) === headings[2], '공백 ID를 디코딩해 찾는다');
    assert.ok(fragmentTarget(document, links[3]) === headings[4], '한글의 인코딩 형태인 다른 ID를 먼저 찾아 충돌을 감지한다');
    assert.ok(fragmentTarget(document, links[4]) === headings[4]);
    assert.ok(fragmentTarget(document, links[5]) === headings[5], 'ID 안의 해시를 보존한다');
    const encoded = document.createElement('a');
    encoded.href = `#${encodeURIComponent(headings[0].id)}`;
    assert.ok(fragmentTarget(document, encoded) === headings[1], '무조건 재인코딩하면 다른 ID에 도달할 수 있다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('원문 name이 디코딩된 ID보다 우선하고 비정상 퍼센트도 URL 규칙대로 해석한다', async () => {
  const browser = createDocument(`<!doctype html><html lang="ko"><body>
    <a name="%ED%95%9C">기존 이름</a><div id="한">한글 ID</div><div id="bad%2Z">리터럴</div><div id="bad�">잘못된 UTF-8</div>
  </body></html>`);
  try {
    const { document } = browser;
    const link = document.createElement('a');
    link.href = '#%ED%95%9C';
    assert.ok(fragmentTarget(document, link) === document.querySelector('a[name]'));
    link.href = '#bad%2Z';
    assert.ok(fragmentTarget(document, link) === document.getElementById('bad%2Z'));
    link.href = '#bad%FF';
    assert.ok(fragmentTarget(document, link) === document.getElementById('bad�'));
  } finally {
    await browser.happyDOM.abort();
  }
});
