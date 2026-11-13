import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const root = process.env.SEO_NAME_FIXTURE_ROOT;
assert.ok(root, 'SEO_NAME_FIXTURE_ROOT가 필요합니다');
const source = resolve(root, 'source');
const site = resolve(process.env.SITE_ROOT || join(root, 'root'));
const baselineRoot = process.env.SEO_NAME_BASELINE_ROOT;
const cases = JSON.parse(await readFile(join(root, 'cases.json'), 'utf8'));
const bundle = process.env.BUNDLE_BIN || 'bundle';

// 원본 Markdown을 독립적으로 변환하고 HTML 파서로 문자 참조를 한 번 해독한다.
const ruby = `require 'jekyll'; require 'json'
  config = Jekyll.configuration('source' => ARGV.fetch(0), 'quiet' => true)
  converter = Jekyll::Converters::Markdown.new(config)
  filter = Object.new.extend(Liquid::StandardFilters)
  values = JSON.parse(File.read(ARGV.fetch(1)))
  puts JSON.generate(values.to_h { |entry| [entry.fetch('id'), filter.strip_html(converter.convert(entry.fetch('source_name'))).gsub(/\\s+/, ' ').strip] })`;
const expectedRendered = JSON.parse(execFileSync(bundle, ['exec', 'ruby', '-e', ruby, source, join(root, 'cases.json')], { encoding: 'utf8' }));

for (const entry of cases) {
  test(`${entry.id}: JSON-LD 이름이 선택된 원본의 평문과 일치한다`, async () => {
    const html = await readFile(join(site, entry.file), 'utf8');
    const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
    try {
      const document = new browser.DOMParser().parseFromString(html, 'text/html');
      const scripts = document.head.querySelectorAll('script[type="application/ld+json" i]');
      assert.equal(scripts.length, 1, 'JSON-LD는 하나여야 합니다');
      const json = JSON.parse(scripts[0].textContent);
      const decoder = document.createElement('textarea');
      decoder.innerHTML = expectedRendered[entry.id];
      const expected = decoder.value;
      if (!entry.absent) assert.equal(expected, entry.expected, '기대값은 원본 Markdown 의미와 일치해야 합니다');
      assert.equal(json.author?.name, entry.author || '작성자 &amp; 팀', '저자 이름은 변경되면 안 됩니다');
      assert.equal(json.publisher?.name, entry.author || '작성자 &amp; 팀', '발행자 이름은 변경되면 안 됩니다');
      if (entry.id === '저자·이미지와 같은 직렬화 이름') assert.equal(json.image?.name, '작성자 &amp; 팀', '중첩 이미지 이름도 보존돼야 합니다');
      if (entry.absent) assert.equal(Object.hasOwn(json, 'name'), false, '빈 소셜 이름을 사이트 제목으로 자동 대체하지 않아야 합니다');
      else assert.equal(json.name, expected, 'JSON-LD 이름이 HTML 문자 참조를 포함하지 않아야 합니다');
      if (entry.literal_title) {
        assert.ok(document.title.startsWith(`${entry.literal_title} | `), '브라우저 제목의 역슬래시가 보존돼야 합니다');
        assert.equal(document.querySelector('meta[property="og:title"]')?.getAttribute('content'), entry.literal_title);
        assert.equal(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'), entry.literal_title);
        assert.equal(json.headline, entry.literal_title, 'JSON 제목의 역슬래시가 보존돼야 합니다');
        assert.equal(document.querySelector('meta[name="description"]')?.getAttribute('content'), entry.description);
        assert.equal(document.querySelector('meta[property="og:description"]')?.getAttribute('content'), entry.description);
        assert.equal(json.description, entry.description, 'JSON 설명의 역슬래시가 보존돼야 합니다');
      }
      assert.doesNotMatch(scripts[0].textContent, /<\s*\/\s*script/i, '이름이 JSON 스크립트를 종료하면 안 됩니다');
      assert.ok(![...document.head.querySelectorAll('script:not([type="application/ld+json"])')].some(script => script.textContent.includes('실행금지')), '이름이 스크립트를 만들면 안 됩니다');
      if (baselineRoot) {
        const before = new browser.DOMParser().parseFromString(await readFile(join(baselineRoot, entry.file), 'utf8'), 'text/html');
        for (const selector of ['title', 'meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:url"]', 'meta[property="og:image"]', 'meta[name="author"]', 'link[rel="canonical"]']) {
          if (entry.literal_title && ['title', 'meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]'].includes(selector)) continue;
          const value = node => selector === 'meta[property="og:description"]' ? node.getAttribute('content') : node.outerHTML;
          assert.deepEqual([...document.head.querySelectorAll(selector)].map(value), [...before.head.querySelectorAll(selector)].map(value), `${selector}: 이름 이외의 메타데이터가 달라졌습니다`);
        }
        const oldJson = JSON.parse(before.head.querySelector('script[type="application/ld+json"]').textContent);
        delete oldJson.name; delete json.name;
        if (entry.literal_title) { delete oldJson.headline; delete json.headline; delete oldJson.description; delete json.description; }
        assert.deepEqual(json, oldJson, '이름 이외의 JSON-LD가 달라졌습니다');
      }
    } finally { await browser.happyDOM.abort(); }
  });
}

test('일반 페이지는 명시적 이름이 없으면 JSON-LD name이 없다', async () => {
  const html = await readFile(join(site, 'plain/index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    const document = new browser.DOMParser().parseFromString(html, 'text/html');
    const json = JSON.parse(document.head.querySelector('script[type="application/ld+json"]').textContent);
    assert.equal(Object.hasOwn(json, 'name'), false);
    assert.equal(json.author?.name, '작성자 &amp; 팀');
  } finally { await browser.happyDOM.abort(); }
});
