import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { Window } from 'happy-dom';
import { applyFixtureDate } from './fixture-frontmatter.mjs';

const root = process.env.SITE_ROOT || resolve('_site');
const sourceRoot = process.env.SEO_SOURCE_ROOT || resolve('.');
const base = process.env.SITE_BASEURL || '';
const origin = 'https://allenkang92.github.io';
const slugs = ['publications', 'leadership', 'education', 'certificates', 'awards'];

test('격리 수정일 자료는 기존 수정일의 유무와 관계없이 적용된다', () => {
  const value = 'last_modified_at: 2026-01-15 12:34:56 +0900';
  const without = '---\ntitle: 예시\ndate: 2020-01-01\n---\n본문\n';
  const withDate = '---\ntitle: 예시\nlast_modified_at: 2024-08-05\ndate: 2020-01-01\n---\n본문\n';
  for (const original of [without, withDate]) {
    const fixture = applyFixtureDate(original, value);
    assert.equal((fixture.match(/^last_modified_at:/gm) || []).length, 1);
    assert.ok(fixture.includes(value));
    assert.ok(fixture.includes('date: 2020-01-01'));
    assert.ok(fixture.endsWith('본문\n'));
  }
});

function explicitModificationDates() {
  // 표시는 정렬용 date가 아닌 명시적 수정일만 따른다.
  const ruby = `require 'yaml'; require 'date'; require 'time'; require 'json'
    root = ARGV.fetch(0)
    config = YAML.safe_load(File.read(File.join(root, '_config.yml')), permitted_classes: [Date, Time], aliases: true)
    ENV['TZ'] = config.fetch('timezone', 'UTC')
    result = {}
    Dir.glob(File.join(root, '_achievements', '*.md')).sort.each do |path|
      match = File.read(path).match(/\\A---\\s*\\n(.*?)\\n---\\s*\\n/m)
      raise "front matter 누락: #{path}" unless match
      data = YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true) || {}
      value = data['last_modified_at']
      parsed = value.nil? || value == false ? nil : (value.respond_to?(:to_time) ? value.to_time : Time.parse(value.to_s)).getlocal.xmlschema
      result[File.basename(path, '.md')] = { 'modified' => parsed, 'canonical' => data['canonical_url'], 'title' => data['title'], 'description' => data['description'], 'author' => data['author'], 'locale' => data['locale'], 'lang' => data['lang'] }
    end
    puts JSON.generate(result)`;
  return JSON.parse(execFileSync('ruby', ['-e', ruby, sourceRoot], { encoding: 'utf8' }));
}

function sourceSiteMetadata() {
  const ruby = `require 'yaml'; require 'date'; require 'json'
    config = YAML.safe_load(File.read(File.join(ARGV.fetch(0), '_config.yml')), permitted_classes: [Date, Time], aliases: true)
    puts JSON.generate(config.slice('title', 'description', 'author', 'logo', 'markdown', 'locale', 'lang'))`;
  return JSON.parse(execFileSync('ruby', ['-e', ruby, sourceRoot], { encoding: 'utf8' }));
}

// Markdown 변환 결과의 HTML 참조만 한 번 해독한다. 브라우저가 이미
// 해석한 메타데이터와 JSON 문자열은 다시 해독하지 않는다.
function comparableText(value, document) {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = String(value ?? '');
  return decoder.value;
}

function renderedMarkdownTexts(values) {
  // 생성된 HTML을 정답으로 쓰지 않는다. 빌드와 같은 Markdown 설정을
  // 격리 소스에서 읽고, 원본에 변환기를 별도로 적용한다.
  const ruby = `require 'jekyll'; require 'github-pages'; require 'json'
    root = ARGV.fetch(0)
    config = Jekyll.configuration('source' => root, 'config' => File.join(root, '_config.yml'), 'quiet' => true)
    pages = GitHubPages::Configuration.effective_config(config)
    unless [config['markdown'], pages['markdown']].all? { |value| value.to_s.downcase == 'kramdown' }
      raise 'Kramdown 이외의 Markdown 설정은 생성기별 기대값 재검토가 필요합니다'
    end
    filter = Object.new.extend(Liquid::StandardFilters)
    values = JSON.parse(STDIN.read)
    render = ->(settings) { converter = Jekyll::Converters::Markdown.new(settings); values.map { |value| filter.strip_html(converter.convert(value.to_s)).gsub(/\\s+/, ' ').strip } }
    puts JSON.generate('jekyll' => render.call(config), 'pages' => render.call(pages))`;
  const bundle = process.env.BUNDLE_BIN || 'bundle';
  const result = spawnSync(bundle, ['exec', 'ruby', '-e', ruby, sourceRoot], {
    input: JSON.stringify(values), encoding: 'utf8',
  });
  if (!result.error && result.status === 0) {
    const rendered = JSON.parse(result.stdout);
    assert.deepEqual(rendered.jekyll, rendered.pages,
      'Jekyll과 GitHub Pages의 Markdown 출력이 달라 빌드 환경별 기대값 검토가 필요합니다');
    return rendered.jekyll;
  }

  // 이미 생성된 사이트를 시스템 Ruby만으로 검사하는 기존 사용법은
  // 보수적으로 판별한 단순 평문에 한해 유지한다. Markdown이 의심되면
  // 파서를 추측하지 않고 필요한 Bundler 환경을 명시한다.
  // 따옴표는 Kramdown 스마트 인용 부호로 변환될 수 있어 폴백에서 제외한다.
  const plain = value => /^[\p{L}\p{M}\p{N} ,.]*$/u.test(value)
    && !/\.\.\.|^\s*\d+\.\s/.test(value);
  const configured = process.env.BUNDLE_BIN || process.env.BUNDLE_GEMFILE;
  const unavailable = !configured && (result.error?.code === 'ENOENT'
    || (result.status === 1 && /Bundler::GemNotFound/.test(result.stderr || '')));
  if (unavailable && values.every(plain)) {
    console.warn('Bundler/Jekyll을 사용할 수 없어 단순 평문 메타데이터만 검사합니다.');
    return values.map(value => value.replace(/ +/g, ' ').replace(/^ | $/g, ''));
  }
  throw new Error(`Markdown 메타데이터 검증에는 이 사이트의 Bundler/Jekyll 환경이 필요합니다: ${result.stderr || result.error?.message || `종료 코드 ${result.status}`}`);
}

function sourcePagePermalinks() {
  // 검색 색인과 별도로 YAML 원본의 명시적인 HTML permalink를 살핀다.
  // 제목이 없는 페이지도 검사하며 sitemap: false와 비 HTML 출력은 제외한다.
  const ruby = `require 'yaml'; require 'date'; require 'json'
    root = ARGV.fetch(0)
    paths = Dir.glob(['_pages/**/*.{md,markdown,html,htm}', 'tools/**/*.{md,markdown,html,htm}', '*.{md,markdown,html,htm}'], base: root)
    urls = []
    paths.sort.each do |name|
      text = File.read(File.join(root, name))
      match = text.match(/\\A---\\s*\\n(.*?)\\n---\\s*\\n/m)
      next unless match
      data = YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true) || {}
      next if data['sitemap'] == false || data['published'] == false
      url = data['permalink']
      next unless url.is_a?(String) && (url.end_with?('/') || url.match?(/\\.(?:html?|xhtml)\\z/))
      next if url == '/404.html'
      raise "동적 permalink는 별도 검토가 필요합니다: #{name}" if url.match?(%r{(?:\\A|/):[a-z_]+(?=[./]|\\z)}i)
      urls << url
    end
    puts JSON.generate(urls)`;
  return JSON.parse(execFileSync('ruby', ['-e', ruby, sourceRoot], { encoding: 'utf8' }));
}

function feedPostsLimit() {
  const ruby = `require 'yaml'; require 'date'; require 'json'
    config = YAML.safe_load(File.read(File.join(ARGV.fetch(0), '_config.yml')), permitted_classes: [Date, Time], aliases: true)
    limit = (config['feed'] || {})['posts_limit'] || 10
    puts JSON.generate(Integer(limit))`;
  return JSON.parse(execFileSync('ruby', ['-e', ruby, sourceRoot], { encoding: 'utf8' }));
}

async function openHtml(rootPath, path) {
  const browser = new Window({ url: `${origin}${base}/`, settings: {
    disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true,
  } });
  browser.document.write(await readFile(resolve(rootPath, path, 'index.html'), 'utf8'));
  return browser;
}

function nonDateMeta(document) {
  return [...document.head.querySelectorAll('title, meta[name], meta[property], link[rel="canonical"]')]
    .filter(el => !['article:published_time', 'article:modified_time', 'og:type', 'og:image'].includes(el.getAttribute('property')))
    .map(el => [el.tagName, el.getAttribute('name'), el.getAttribute('property'), el.getAttribute('content'), el.getAttribute('href'), el.textContent]);
}

function structured(document) {
  const scripts = [...document.head.querySelectorAll('script[type="application/ld+json"]')];
  assert.equal(scripts.length, 1);
  return JSON.parse(scripts[0].textContent);
}

async function sitemap(rootPath) {
  const browser = new Window();
  try {
    const xml = new browser.DOMParser().parseFromString(await readFile(resolve(rootPath, 'sitemap.xml'), 'utf8'), 'text/xml');
    assert.equal(xml.querySelector('parsererror'), null, '사이트맵 XML이 유효해야 한다');
    const rows = [...xml.querySelectorAll('url')].map(url => [url.querySelector('loc')?.textContent, url.querySelector('lastmod')?.textContent || null]);
    assert.equal(new Set(rows.map(row => row[0])).size, rows.length, '사이트맵 URL은 중복되지 않아야 한다');
    return new Map(rows);
  } finally { await browser.happyDOM.abort(); }
}

test('성과 검색·공유 메타데이터는 사실 미확인 날짜 없이 각 페이지 주소를 보존한다', async () => {
  const metadata = explicitModificationDates();
  const site = sourceSiteMetadata();
  assert.equal(String(site.markdown || 'kramdown').toLowerCase(), 'kramdown',
    'Kramdown 이외의 Markdown 설정은 생성기별 기대값 재검토가 필요합니다');
  const markdownValues = [site.title, site.description, ...slugs.flatMap(slug => [metadata[slug].title, metadata[slug].description || site.description])].map(value => String(value ?? ''));
  const rendered = renderedMarkdownTexts(markdownValues);
  const renderedBySource = new Map(markdownValues.map((value, index) => [value, rendered[index]]));
  const renderedText = value => renderedBySource.get(String(value ?? ''));
  for (const slug of slugs) {
    const browser = await openHtml(root, `achievements/${slug}`);
    try {
      const doc = browser.document;
      const title = comparableText(renderedText(metadata[slug].title), doc);
      const siteTitle = comparableText(renderedText(site.title), doc);
      const description = comparableText(renderedText(metadata[slug].description || site.description), doc);
      const author = comparableText(metadata[slug].author || site.author, doc);
      const compare = value => value;
      const logo = site.logo
        ? (/^https?:\/\//i.test(site.logo) ? site.logo : new URL(`${base}/${site.logo.replace(/^\/+/, '')}`, origin).href)
        : null;
      const canonical = metadata[slug].canonical || `${origin}${base}/achievements/${slug}/`;
      assert.equal(compare(doc.title), `${title} | ${siteTitle}`);
      assert.equal(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), canonical);
      assert.equal(doc.querySelector('meta[property="og:url"]')?.getAttribute('content'), canonical);
      assert.equal(compare(doc.querySelector('meta[property="og:title"]')?.getAttribute('content')), title);
      assert.equal(compare(doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content')), title);
      assert.equal(compare(doc.querySelector('meta[name="author"]')?.getAttribute('content')), author);
      assert.equal(compare(doc.querySelector('meta[name="description"]')?.getAttribute('content')), description);
      assert.equal(compare(doc.querySelector('meta[property="og:description"]')?.getAttribute('content')), description);
      assert.equal(compare(doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content')), description);
      const locale = metadata[slug].locale || site.locale || metadata[slug].lang || site.lang || 'en_US';
      assert.equal(doc.querySelector('meta[property="og:locale"]')?.getAttribute('content'), String(locale).replace(/-/g, '_'));
      assert.equal(compare(doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')), siteTitle);
      assert.equal(doc.querySelector('meta[property="og:type"]')?.getAttribute('content'), 'website');
      assert.equal(doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || null, logo);
      assert.equal(doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content'), 'summary');
      assert.equal(doc.querySelector('meta[property="article:published_time"]'), null);
      assert.equal(doc.querySelector('meta[property="article:modified_time"]'), null);
      const ld = structured(doc);
      assert.equal(ld['@type'], 'WebPage');
      assert.equal(compare(ld.headline), title);
      assert.equal(ld.url, canonical);
      assert.equal(ld['@id'], canonical);
      assert.equal(Object.hasOwn(ld, 'mainEntityOfPage'), false);
      assert.equal(Object.hasOwn(ld, 'datePublished'), false);
      if (metadata[slug].modified) assert.equal(ld.dateModified, metadata[slug].modified);
      else assert.equal(Object.hasOwn(ld, 'dateModified'), false);
      assert.equal(compare(ld.author.name), author);
      assert.equal(compare(ld.description), description);
      if (logo) {
        assert.equal(compare(ld.publisher.name), author);
        assert.equal(ld.publisher.logo.url, logo);
      } else {
        assert.equal(Object.hasOwn(ld, 'publisher'), false);
      }
      if (process.env.BASELINE_SITE_ROOT) {
        const original = await openHtml(process.env.BASELINE_SITE_ROOT, `achievements/${slug}`);
        try {
          const expected = structured(original.document);
          delete expected.dateModified;
          delete expected.datePublished;
          expected['@type'] = 'WebPage';
          delete expected.mainEntityOfPage;
          expected['@id'] = canonical;
          const actualWithoutModified = { ...ld };
          delete actualWithoutModified.dateModified;
          assert.deepEqual(actualWithoutModified, expected, `${slug}: 날짜 외 구조화 데이터 유지`);
          assert.deepEqual(nonDateMeta(doc), nonDateMeta(original.document), `${slug}: 날짜 외 메타데이터 유지`);
        } finally { await original.happyDOM.abort(); }
      }
    } finally { await browser.happyDOM.abort(); }
  }
});

for (const [field, property, label] of [
  ['headline', 'og:title', '제목'],
  ['description', 'og:description', '설명'],
]) {
  test(`성과 JSON-LD ${label}은 브라우저에서 읽는 OG ${label}과 정확히 일치한다`, async () => {
    for (const slug of slugs) {
      const browser = await openHtml(root, `achievements/${slug}`);
      try {
        const doc = browser.document;
        assert.equal(structured(doc)[field], doc.querySelector(`meta[property="${property}"]`)?.getAttribute('content'),
          `${slug}: JSON-LD ${label}과 OG ${label} 불일치`);
      } finally { await browser.happyDOM.abort(); }
    }
  });
}

for (const [field, label] of [['author', '저자'], ['publisher', '게시자']]) {
  test(`성과 JSON-LD ${label} 이름은 브라우저에서 읽는 저자 메타데이터와 정확히 일치한다`, async () => {
    for (const slug of slugs) {
      const browser = await openHtml(root, `achievements/${slug}`);
      try {
        const doc = browser.document;
        const ld = structured(doc);
        if (field === 'publisher' && !ld.publisher) continue;
        const author = doc.querySelector('meta[name="author"]')?.getAttribute('content') ?? null;
        assert.equal(ld[field]?.name ?? null, author, `${slug}: JSON-LD ${label} 이름과 HTML 저자 이름 불일치`);
      } finally { await browser.happyDOM.abort(); }
    }
  });
}

test('성과 SEO가 지원하지 않는 새로운 설정은 검토 없이 무시되지 않는다', () => {
  // 성과 전용 마크업은 표준 SEO 플러그인의 모든 옵션을 구현하지 않는다.
  // 사용 중인 설정 범위를 넓히기 전에 템플릿과 비교 테스트를 함께 갱신한다.
  const ruby = `require 'yaml'; require 'date'; require 'json'
    root = ARGV.fetch(0)
    config = YAML.safe_load(File.read(File.join(root, '_config.yml')), permitted_classes: [Date, Time], aliases: true)
    fields = %w[image seo twitter title_category]
    errors = []
    %w[twitter facebook social webmaster_verifications seo].each { |key| errors << "site.#{key}" if config.key?(key) }
    errors << 'site.author 객체' unless config['author'].is_a?(String)
    (config['defaults'] || []).each do |entry|
      scope = entry['scope'] || {}
      next if scope['type'] && scope['type'] != 'achievements'
      values = entry['values'] || {}
      fields.each { |key| errors << "defaults.#{key}" if values.key?(key) }
      errors << 'defaults.author 객체' if values['author'] && !values['author'].is_a?(String)
    end
    Dir.glob('_achievements/*.md', base: root).sort.each do |path|
      text = File.read(File.join(root, path))
      match = text.match(/\\A---\\s*\\n(.*?)\\n---\\s*\\n/m)
      raise "front matter 누락: #{path}" unless match
      page = YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true) || {}
      fields.each { |key| errors << "#{path}: #{key}" if page.key?(key) }
      errors << "#{path}: author 객체" if page['author'] && !page['author'].is_a?(String)
    end
    puts JSON.generate(errors)`;
  const result = execFileSync('ruby', ['-e', ruby, sourceRoot], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(result), [], '새 SEO 설정을 지원하도록 성과 템플릿과 검증을 갱신해야 한다');
});

test('성과 목록 및 이전·다음 경로 순서를 유지한다', async () => {
  const list = await openHtml(root, 'achievements');
  try {
    assert.deepEqual([...list.document.querySelectorAll('.achievement-card h2 a')].map(a => a.getAttribute('href')),
      slugs.map(slug => `${base}/achievements/${slug}/`));
  } finally { await list.happyDOM.abort(); }
  for (const [i, slug] of slugs.entries()) {
    const browser = await openHtml(root, `achievements/${slug}`);
    try {
      const prev = browser.document.querySelector('.achievement-navigation .nav-previous')?.getAttribute('href') || null;
      const next = browser.document.querySelector('.achievement-navigation .nav-next')?.getAttribute('href') || null;
      assert.equal(prev, slugs[i + 1] ? `${base}/achievements/${slugs[i + 1]}/` : null);
      assert.equal(next, slugs[i - 1] ? `${base}/achievements/${slugs[i - 1]}/` : null);
    } finally { await browser.happyDOM.abort(); }
  }
});

// 각 경로 구간을 한 번만 디코딩한다. 구간 경계, 질의, 조각, 유니코드 표기는 유지한다.
function sitemapAddressKey(address) {
  const url = new URL(address);
  return JSON.stringify([url.origin, url.pathname.split('/').map(decodeURIComponent), url.search, url.hash]);
}

test('사이트맵 주소 비교는 동등한 인코딩만 허용한다', () => {
  const key = path => sitemapAddressKey(`${origin}${path}`);
  assert.equal(key('/a&b+1.pdf'), key('/a%26b%2B1.pdf'));
  assert.notEqual(key('/a%26b.pdf'), key('/a%2526b.pdf'));
  assert.notEqual(key('/a%2Fb'), key('/a/b'));
  assert.notEqual(key('/가'), key('/가'));
  assert.notEqual(key('/a%3Fb'), key('/a?b'));
  assert.notEqual(key('/a%23b'), key('/a#b'));
  assert.throws(() => key('/invalid%2'));
});

test('사이트맵은 성과 주소를 유지하고 확인되지 않은 수정일만 생략한다', async () => {
  const rawActual = await sitemap(root);
  const actual = new Map([...rawActual].map(([url, date]) => [sitemapAddressKey(url), date]));
  assert.equal(actual.size, rawActual.size, '동일한 경로의 사이트맵 주소가 중복되지 않아야 한다');
  const metadata = explicitModificationDates();
  // 기존 주소는 유지하되 새로운 글·페이지는 추가될 수 있다.
  // 수정일은 변경 가능한 데이터이므로 생성된 글의 독립적인 SEO 출력과 비교한다.
  const fixture = JSON.parse(await readFile(resolve('tests/seo/expected-sitemap.json'), 'utf8'));
  const fixtureUrls = fixture.map(row => `${origin}${base}${row.path}`);
  for (const url of fixtureUrls) assert.ok(actual.has(sitemapAddressKey(url)), `${url}: 기존 주소 유지`);
  for (const path of sourcePagePermalinks()) {
    const address = new URL(`${base}${path}`, origin).href;
    assert.ok(actual.has(sitemapAddressKey(address)), `${address}: 원본 페이지가 사이트맵에 있어야 한다`);
  }
  const searchEntries = JSON.parse(await readFile(resolve(root, 'search.json'), 'utf8'));
  for (const entry of searchEntries) {
    const address = new URL(entry.url);
    assert.ok(actual.has(sitemapAddressKey(address.href)), `${address.href}: 검색 색인의 글·페이지가 사이트맵에 있어야 한다`);
    if (entry.type !== 'post') continue;
    const localPath = decodeURIComponent(address.pathname.slice(base.length)).replace(/^\/+|\/+$/g, '');
    const page = await openHtml(root, localPath);
    try {
      const expectedDate = page.document.querySelector('meta[property="article:modified_time"]')?.getAttribute('content')
        || page.document.querySelector('meta[property="article:published_time"]')?.getAttribute('content') || null;
      assert.equal(actual.get(sitemapAddressKey(address.href)), expectedDate, `${address.href}: 글의 수정일 반영`);
    } finally { await page.happyDOM.abort(); }
  }
  for (const row of fixture) {
    const value = actual.get(sitemapAddressKey(`${origin}${base}${row.path}`));
    if (row.lastmod === 'FILE_MODTIME') {
      assert.ok(!Number.isNaN(Date.parse(value)), `${row.path}: 정적 파일의 유효한 수정일 유지`);
    } else if (slugs.some(slug => row.path === `/achievements/${slug}/`)) {
      const slug = slugs.find(item => row.path === `/achievements/${item}/`);
      assert.equal(value, metadata[slug].modified, `${row.path}: 명시된 수정일만 사용`);
    } else if (value !== null) {
      assert.ok(!Number.isNaN(Date.parse(value)), `${row.path}: 유효한 수정일 사용`);
    }
  }
  for (const slug of slugs) {
    const url = `${origin}${base}/achievements/${slug}/`;
    assert.ok(actual.has(sitemapAddressKey(url)));
    assert.equal(actual.get(sitemapAddressKey(url)), metadata[slug].modified);
  }
  assert.ok(actual.has(sitemapAddressKey(`${origin}${base}/achievements/`)));
  if (process.env.BASELINE_SITE_ROOT) {
    const expectedRaw = await sitemap(process.env.BASELINE_SITE_ROOT);
    const expected = new Map([...expectedRaw].map(([url, date]) => [sitemapAddressKey(url), date]));
    assert.equal(expected.size, expectedRaw.size, '기준 사이트맵 주소가 중복되지 않아야 한다');
    assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort(), '모든 사이트맵 URL 보존');
    for (const [url, date] of expected) {
      if (!slugs.some(slug => url === sitemapAddressKey(`${origin}${base}/achievements/${slug}/`))) {
        assert.equal(actual.get(url), date, `${url}: 비성과 수정일 보존`);
      }
    }
  }
});

test('일반 글의 발행일과 피드는 기존 날짜 메타데이터를 유지한다', async () => {
  const post = await openHtml(root, 'posts/기업재난관리사-합격후기');
  try {
    assert.equal(post.document.querySelector('meta[property="article:published_time"]')?.getAttribute('content'), '2021-01-28T04:09:00+09:00');
    const ld = structured(post.document);
    assert.equal(post.document.querySelector('meta[property="og:type"]')?.getAttribute('content'), 'article');
    assert.equal(ld['@type'], 'BlogPosting');
    assert.equal(ld.datePublished, '2021-01-28T04:09:00+09:00');
    assert.equal(ld.dateModified, post.document.querySelector('meta[property="article:modified_time"]')?.getAttribute('content'));
  } finally { await post.happyDOM.abort(); }
  const feed = await readFile(resolve(root, 'feed.xml'), 'utf8');
  const ruby = `require 'rexml/document'; require 'json'
    doc = REXML::Document.new(STDIN.read)
    entries = doc.root.elements.to_a('entry').map { |e| %w[id published updated].to_h { |key| [key, e.elements[key]&.text] } }
    puts JSON.generate(entries)`;
  const entries = JSON.parse(execFileSync('ruby', ['-e', ruby], { input: feed, encoding: 'utf8' }));
  assert.ok(entries.length > 0, '피드에 글이 있어야 합니다');
  const normalizeId = value => {
    const url = new URL(value);
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  };
  const ids = entries.map(entry => normalizeId(entry.id));
  assert.equal(new Set(ids).size, ids.length, '피드 글 주소가 중복되지 않아야 합니다');
  const searchEntries = JSON.parse(await readFile(resolve(root, 'search.json'), 'utf8'));
  const latest = searchEntries.filter(entry => entry.type === 'post').slice(0, feedPostsLimit());
  assert.deepEqual([...ids].sort(), latest.map(entry => normalizeId(entry.url)).sort(), '피드는 최신 글을 누락 없이 포함해야 합니다');
  for (const entry of entries) {
    const address = new URL(entry.id);
    const pathname = decodeURIComponent(address.pathname.slice(base.length)).replace(/^\/+|\/+$/g, '');
    const article = await openHtml(root, pathname);
    try {
      const published = article.document.querySelector('meta[property="article:published_time"]')?.getAttribute('content');
      const modified = article.document.querySelector('meta[property="article:modified_time"]')?.getAttribute('content');
      assert.ok(published && modified, `${pathname}: 글의 발행·수정일이 있어야 합니다`);
      assert.equal(entry.published, published, `${pathname}: 피드 발행일 일치`);
      assert.equal(entry.updated, modified, `${pathname}: 피드 수정일 일치`);
    } finally { await article.happyDOM.abort(); }
  }
  assert.doesNotMatch(feed, /<id>https:\/\/allenkang92\.github\.io(?:\/blog)?\/achievements\//);
});
