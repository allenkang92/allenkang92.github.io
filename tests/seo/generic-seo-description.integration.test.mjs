import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const fixtureRoot = process.env.SEO_DESCRIPTION_FIXTURE_ROOT;
assert.ok(fixtureRoot, 'SEO_DESCRIPTION_FIXTURE_ROOT가 필요합니다');
const sourceRoot = resolve(fixtureRoot, 'source');
const siteRoot = resolve(process.env.SITE_ROOT || join(fixtureRoot, 'root'));
const baselineRoot = process.env.SEO_DESCRIPTION_BASELINE_ROOT;
const cases = JSON.parse(await readFile(join(fixtureRoot, 'cases.json'), 'utf8'));

// 기대값을 생성된 메타데이터가 아닌 원본 Markdown에서 계산한다.
// Jekyll 변환 결과는 HTML 파서로 딱 한 번만 해독한다.
function renderedSource() {
  const ruby = `require 'jekyll'; require 'yaml'; require 'json'
    source = ARGV.fetch(0)
    cases = JSON.parse(File.read(ARGV.fetch(1)))
    config = Jekyll.configuration('source' => source, 'quiet' => true)
    converter = Jekyll::Converters::Markdown.new(config)
    filter = Object.new.extend(Liquid::StandardFilters)
    values = cases.map do |entry|
      path = File.join(source, entry.fetch('source'))
      body = File.read(path)
      match = body.match(/\\A---\\s*\\n(.*?)\\n---\\s*\\n/m)
      raise 'front matter 누락' unless match
      front = YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true)
      input = case entry.fetch('kind')
      when 'site' then config.fetch('description')
      when 'excerpt' then front.fetch('excerpt')
      else front.fetch('description')
      end
      words = front.fetch('seo_description_max_words', 100).to_i
      rendered = filter.strip_html(converter.convert(input)).gsub(/\\s+/, ' ').strip
      fragments = rendered.split(/\\s+/, words + 1)[0...words].join(' ')
      fragments += '…' if fragments.length < rendered.length
      [entry.fetch('name'), fragments]
    end
    puts JSON.generate(values.to_h)`;
  return JSON.parse(execFileSync(process.env.BUNDLE_BIN || 'bundle', [
    'exec', 'ruby', '-rdate', '-e', ruby, sourceRoot, join(fixtureRoot, 'cases.json'),
  ], { encoding: 'utf8' }));
}
const rendered = renderedSource();

for (const entry of cases) {
  test(`${entry.name}: HTML 메타와 JSON-LD 설명이 원본 Markdown의 평문과 일치한다`, async () => {
    const html = await readFile(join(siteRoot, entry.destination), 'utf8');
    const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
    try {
      const document = new browser.DOMParser().parseFromString(html, 'text/html');
      const decoder = document.createElement('textarea');
      decoder.innerHTML = rendered[entry.name];
      const expected = decoder.value;
      assert.equal(expected, entry.expected, '독립 계산 결과와 고정 기대값은 일치해야 합니다');
      for (const selector of ['meta[name="description" i]', 'meta[property="og:description" i]', 'meta[name="twitter:description" i]']) {
        const nodes = document.head.querySelectorAll(selector);
        assert.equal(nodes.length, 1, `${selector}: 메타데이터는 하나여야 합니다`);
        assert.equal(nodes[0].getAttribute('content'), expected, `${selector}: 설명이 원문과 다릅니다`);
      }
      const scripts = document.head.querySelectorAll('script[type="application/ld+json" i]');
      assert.equal(scripts.length, 1, 'JSON-LD는 하나여야 합니다');
      assert.equal(JSON.parse(scripts[0].textContent).description, expected, 'JSON-LD 설명이 HTML 문자 참조를 포함하지 않아야 합니다');
      assert.doesNotMatch(scripts[0].textContent, /<\s*\/\s*script/i, '설명은 JSON 스크립트를 닫으면 안 됩니다');
      assert.ok(![...document.head.querySelectorAll('script:not([type="application/ld+json"])')].some(script => script.textContent.includes('실행금지')), '설명에서 새 스크립트가 만들어지면 안 됩니다');
      assert.equal(document.querySelector('main')?.textContent.trim(), '본문은 유지됩니다.', '본문은 유지되어야 합니다');
      assert.ok(document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.includes(entry.canonical), '정규 주소가 유지되어야 합니다');
      assert.equal(document.querySelector('meta[property="og:type"]')?.getAttribute('content'), entry.type, '페이지 유형이 유지되어야 합니다');
      if (baselineRoot) {
        const baselineHtml = await readFile(join(baselineRoot, entry.destination), 'utf8');
        const baseline = new browser.DOMParser().parseFromString(baselineHtml, 'text/html');
        for (const selector of ['meta[name="generator"]', 'meta[name="author"]', 'meta[property="og:type"]', 'meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[property="og:url"]', 'meta[property="og:image"]', 'meta[property="article:published_time"]', 'link[rel="canonical"]']) {
          if (entry.literal && (selector.includes('og:title') || selector.includes('twitter:title'))) continue;
          const actual = [...document.head.querySelectorAll(selector)].map(node => node.outerHTML);
          const original = [...baseline.head.querySelectorAll(selector)].map(node => node.outerHTML);
          assert.deepEqual(actual, original, `${selector}: 설명 이외의 메타데이터가 달라졌습니다`);
        }
        const oldJson = JSON.parse(baseline.head.querySelector('script[type="application/ld+json"]').textContent);
        const newJson = JSON.parse(scripts[0].textContent);
        delete oldJson.description; delete newJson.description;
        if (entry.literal) { delete oldJson.headline; delete newJson.headline; }
        assert.deepEqual(newJson, oldJson, '설명 이외의 JSON-LD가 달라졌습니다');
      }
    } finally { await browser.happyDOM.abort(); }
  });
}
