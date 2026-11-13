import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { Window } from 'happy-dom';

const siteRoot = process.env.SITE_ROOT || resolve('_site');
const siteBaseUrl = (process.env.SITE_BASEURL || '').replace(/\/$/, '');

test('historic post URLs redirect to the correct posts', async () => {
  const cases = [
    ['science_philosophy_and_history_category/2024/09/09/서론-과학철학-및-과학사-둘러보기.html', '서론-과학철학및과학사둘러보기'],
    ['mathematics_philosophy_history/2024/09/11/서론-수학철학-및-수학사-둘러보기.html', '서론-수학철학및수학사둘러보기'],
    ["daily_life/2021/01/27/기업재난관리사실무분야합격후기&정보글/index.html", "기업재난관리사-합격후기"],
    ["science_philosophy_history/2024/09/09/1장-입자의세계/index.html", "1장-입자의세계"],
    ["science_philosophy_history/2024/09/09/1장-자연계의4대힘/index.html", "1장-자연계의4대힘"],
    ["science_philosophy_history/2024/09/09/1장-표준-모형-현대물리학의종합/index.html", "1장-표준-모형-현대물리학의종합"],
    ["science_philosophy_history/2024/09/09/1장-현대-물리학의-도전과-미래/index.html", "1장-현대-물리학의-도전과-미래"],
    ["web_technologies/2024/09/09/css정리/index.html", "css정리"],
    ["web_technologies/2024/09/09/html정리/index.html", "html정리"],
    ["web_technologies/2024/09/19/웹접근성/index.html", "웹접근성"],
    ["mathematics_philosophy_history/2024/09/11/서론-수학철학및수학사둘러보기/index.html", "서론-수학철학및수학사둘러보기"],
    ["mathematics_philosophy_history/2024/09/18/1장-시대와지역에따른수학발전/index.html", "1장-시대와지역에따른수학발전"],
    ["mathematics_philosophy_history/2024/09/19/2장-수학과무한/index.html", "2장-수학과무한"],
    ["mathematics_philosophy_history/2024/09/19/3장-수학에서의논리체계/index.html", "3장-수학에서의논리체계"],
    ["mathematics_philosophy_history/2024/09/19/4장-수학적증명과오류의논리/index.html", "4장-수학적증명과오류의논리"],
    ["mathematics_philosophy_history/2024/09/19/5장-확률과통계의철학적의미/index.html", "5장-확률과통계의철학적의미"],
    ["mathematics_philosophy_history/2024/09/19/6장-수학적존재론/index.html", "6장-수학적존재론"],
    ["mathematics_philosophy_history/2024/09/19/7장-수학과현실의관계/index.html", "7장-수학과현실의관계"],
    ["mathematics_philosophy_history/2024/09/19/8장-수학의현대적수용/index.html", "8장-수학의현대적수용"],
    ["mathematics_philosophy_history/2024/09/19/9장-수학철학과수학사의종합적고찰/index.html", "9장-수학철학과수학사의종합적고찰"],
  ];

  for (const [historicPath, slug] of cases) {
    const html = await readFile(resolve(siteRoot, historicPath), 'utf8');
    const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
    try {
      window.document.write(html);
      const canonical = window.document.querySelector('link[rel="canonical"]');
      const refresh = window.document.querySelector('meta[http-equiv="refresh"]');
      const fallback = window.document.querySelector('a[href]');
      assert.ok(canonical && refresh && fallback, `${historicPath}: redirect and fallback must exist`);
      assert.equal(window.document.documentElement.lang, 'ko');
      assert.match(window.document.title, /페이지를 이동/);
      assert.match(fallback.textContent, /이 글로 이동하기/);
      assert.equal(window.document.querySelector('meta[name="robots"]').getAttribute('content'), 'noindex');
      const target = canonical.getAttribute('href');
      assert.equal(decodeURIComponent(new URL(target).pathname), `${siteBaseUrl}/posts/${slug}/`);
      assert.equal(fallback.getAttribute('href'), target, `${historicPath}: fallback must match`);
      assert.equal(refresh.getAttribute('content'), `0; url=${target}`, `${historicPath}: refresh must match`);
      const script = window.document.querySelector('script').textContent;
      for (const hash of ['', '#%ED%95%9C%EA%B8%80', '#introduction']) {
        for (const origin of ['https://allenkang92.github.io', 'http://127.0.0.1:18766']) {
          const location = { hash, href: `${origin}${siteBaseUrl}/old/${hash}` };
          runInNewContext(script, { window: { location }, URL });
          const expected = new URL(`${target}${hash}`);
          if (origin !== 'https://allenkang92.github.io') {
            expected.protocol = 'http:';
            expected.host = '127.0.0.1:18766';
          }
          assert.equal(location.href, expected.href, `${historicPath}: fragment and current origin must be retained`);
        }
      }
      assert.match(await readFile(resolve(siteRoot, 'posts', slug, 'index.html'), 'utf8'), /<article class="post">/);
    } finally {
      await window.happyDOM.abort();
    }
  }
});

test('redirects preserve encoded target URLs and do not rewrite external origins', async () => {
  const html = await readFile(resolve(siteRoot, 'web_technologies/2024/09/09/css정리/index.html'), 'utf8');
  const doc = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  try {
    doc.document.write(html);
    const target = doc.document.querySelector('link[rel="canonical"]').getAttribute('href');
    const templateScript = doc.document.querySelector('script').textContent;
    const cases = [
      [`https://allenkang92.github.io${siteBaseUrl}/posts/%ED%95%9C%EA%B8%80%3F%2F/?ref=one%2Ftwo`, '#old',
        `http://127.0.0.1:18766${siteBaseUrl}/posts/%ED%95%9C%EA%B8%80%3F%2F/?ref=one%2Ftwo#old`],
      [`https://allenkang92.github.io${siteBaseUrl}/posts/example/?ref=one#new`, '#old',
        `http://127.0.0.1:18766${siteBaseUrl}/posts/example/?ref=one#new`],
      ['https://external.example/path?x=1', '#old', 'https://external.example/path?x=1#old'],
      ['https://allenkang92.github.io.evil.example/path', '#old', 'https://allenkang92.github.io.evil.example/path#old'],
      ['https://allenkang92.github.io:444/path', '#old', 'https://allenkang92.github.io:444/path#old'],
      ['https://allenkang92.github.io//outside.example/path', '#old', 'https://allenkang92.github.io//outside.example/path#old'],
    ];
    if (siteBaseUrl) cases.push([
      `https://allenkang92.github.io${siteBaseUrl}-other/path`, '#old',
      `https://allenkang92.github.io${siteBaseUrl}-other/path#old`,
    ]);
    for (const [destination, hash, expected] of cases) {
      const script = templateScript.replace(JSON.stringify(target), JSON.stringify(destination));
      assert.notEqual(script, templateScript, '테스트용 이동 주소를 교체해야 한다');
      const location = { href: `http://127.0.0.1:18766${siteBaseUrl}/old/${hash}`, hash };
      runInNewContext(script, { window: { location }, URL });
      assert.equal(location.href, expected, `${destination}: 잘못된 대상이나 조각`);
    }
  } finally {
    await doc.happyDOM.abort();
  }
});
