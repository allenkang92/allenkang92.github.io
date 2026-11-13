import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const sourceRoot = resolve(process.env.SEO_SOURCE_ROOT || '.');
const siteRoot = resolve(process.env.SITE_ROOT || '_site');
const bundle = process.env.BUNDLE_BIN || 'bundle';

// 기본 설정에서 선택한 출력 대상만 추적한다. 별도 --future 또는 --config는 범위 밖이다.
function selectedDocuments(source, destination) {
  const ruby = `require 'jekyll'; require 'jekyll-seo-tag'; require 'json'
    c = Jekyll.configuration('source' => ARGV.fetch(0), 'destination' => ARGV.fetch(1), 'quiet' => true)
    raise 'Markdown 변환기 검토 필요' unless c['markdown'].to_s.downcase == 'kramdown'
    s = Jekyll::Site.new(c); s.reset; s.read; s.generate
    ctx = Liquid::Context.new({}, {}, { :site => s })
    f = Jekyll::SeoTag::Filters.new(ctx)
    converted = ->(value) { f.normalize_whitespace(f.strip_html(f.markdownify(value))) }
    expected = ->(doc) {
      page = doc.to_liquid
      raw = converted.call(page['description'] || page['excerpt'])
      raw = converted.call(s.config['description']) if raw.empty?
      next nil if raw.empty?
      words = page['seo_description_max_words'] || 100
      raise 'seo_description_max_words 검토 필요' unless words.is_a?(Integer) && words >= 0
      escaped = f.escape_once(raw)
      rendered = raw.split(/\\s+/, words + 1)[0...words].join(' ')
      cut = escaped.split(/\\s+/, words + 1)[0...words].join(' ')
      rendered += '…' if cut.length < escaped.length
      rendered
    }
    achievements = s.collections['achievements']&.docs || []
    excluded = achievements.select(&:write?).map { |doc| doc.destination(s.dest) }
    docs = s.pages + s.collections.reject { |name, _| name == 'achievements' }.values.flat_map(&:docs)
    plain = docs.select { |doc| doc.respond_to?(:write?) && doc.write? && doc.data['seo_plain_description'] != nil && doc.output_ext.to_s.downcase == '.html' }.map { |doc|
      { 'source' => doc.respond_to?(:relative_path) ? doc.relative_path : doc.path,
        'destination' => doc.destination(s.dest), 'rendered' => expected.call(doc) }
    }
    puts JSON.generate({ 'excluded' => excluded, 'plain' => plain })`;
  return JSON.parse(execFileSync(bundle, ['exec', 'ruby', '-e', ruby, source, destination], { encoding: 'utf8' }));
}

async function htmlPaths(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await htmlPaths(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) paths.push(path);
  }
  return paths;
}

async function inspectHtml(path, expectedRendered) {
  const html = await readFile(path, 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    const document = new browser.DOMParser().parseFromString(html, 'text/html');
    const scripts = [...document.head.querySelectorAll('script[type="application/ld+json" i]')];
    if (!scripts.length) {
      assert.equal(expectedRendered, undefined, `${path}: 평문 설정 페이지에 JSON-LD가 없습니다`);
      return null;
    }
    assert.equal(scripts.length, 1, `${path}: JSON-LD는 한 개여야 합니다`);
    const raw = scripts[0].textContent;
    const json = JSON.parse(raw);
    const selectors = ['meta[name="description" i]', 'meta[property="og:description" i]', 'meta[name="twitter:description" i]'];
    const fields = selectors.map(selector => [...document.head.querySelectorAll(selector)]);
    const hasDescription = Object.hasOwn(json, 'description');
    if (hasDescription) {
      assert.equal(typeof json.description, 'string', `${path}: JSON-LD 설명은 문자열이어야 합니다`);
      fields.forEach((elements, index) => {
        assert.equal(elements.length, 1, `${path}: ${selectors[index]} 요소는 하나여야 합니다`);
        assert.equal(elements[0].getAttribute('content'), json.description, `${path}: HTML과 JSON-LD 설명이 다릅니다`);
      });
    } else {
      fields.forEach((elements, index) => assert.equal(elements.length, 0, `${path}: JSON-LD 설명 없이 ${selectors[index]}가 있습니다`));
    }
    if (expectedRendered !== undefined) {
      assert.notEqual(expectedRendered, null, `${path}: 설명 원본이 없습니다`);
      const decoder = document.createElement('textarea');
      decoder.innerHTML = expectedRendered;
      assert.equal(json.description, decoder.value, `${path}: 평문 설명이 원본 Markdown과 다릅니다`);
    }
    return { path, raw };
  } finally { await browser.happyDOM.abort(); }
}

function checkDuplicateDescriptions(scripts) {
  // JSON.parse는 이스케이프한 동일 키를 덮어쓰므로 원래 키 쌍을 따로 확인한다.
  const python = `import json, sys
def check(pairs):
    if sum(key == 'description' for key, _ in pairs) > 1:
        raise ValueError('중복 description')
    return dict(pairs)
for item in json.load(sys.stdin):
    try:
        json.loads(item['raw'], object_pairs_hook=check)
    except (ValueError, json.JSONDecodeError) as exc:
        print(item['path'] + ': ' + str(exc), file=sys.stderr)
        sys.exit(1)`;
  const result = spawnSync('python3', ['-c', python], { input: JSON.stringify(scripts), encoding: 'utf8' });
  assert.equal(result.status, 0, `JSON-LD 중복 또는 파서 오류: ${result.stderr || result.error || ''}`);
}

async function inspectSite(directory, excluded = [], expectedPages = []) {
  const exclusions = new Set(excluded.map(path => resolve(path)));
  const expected = new Map(expectedPages.map(page => [resolve(page.destination), page]));
  const scripts = [];
  const seen = new Set();
  for (const path of await htmlPaths(directory)) {
    const absolute = resolve(path);
    if (exclusions.has(absolute)) continue;
    const page = expected.get(absolute);
    const script = await inspectHtml(path, page ? page.rendered : undefined);
    if (script) scripts.push(script);
    seen.add(absolute);
  }
  for (const [path, page] of expected) assert.ok(seen.has(path), `${page.source}: 생성 파일이 없습니다 (${relative(directory, path)})`);
  checkDuplicateDescriptions(scripts);
}

test('기본 빌드의 비성과 페이지 설명과 JSON-LD를 모두 대조한다', async () => {
  const selected = selectedDocuments(sourceRoot, siteRoot);
  await inspectSite(siteRoot, selected.excluded, selected.plain);
});

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function fixtureHtml(description) {
  if (description === null) return '<!doctype html><html><head><script type="application/ld+json">{}</script></head></html>';
  const escaped = escapeHtml(description);
  const json = JSON.stringify({ description }).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  return `<!doctype html><html><head><meta name="description" content="${escaped}"><meta property="og:description" name="twitter:description" content="${escaped}"><script type="application/ld+json">${json}</script></head></html>`;
}

test('설명 불일치, 메타·JSON 중복 및 누락을 독립 파서로 검출한다', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'generic-description-check-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'index.html');
  const value = '연구 &amp; 결과';
  const valid = fixtureHtml(value);
  await writeFile(file, valid);
  await inspectSite(directory, [], [{ source: '시험', destination: file, rendered: '연구 &amp;amp; 결과' }]);
  await writeFile(file, valid.replace('</head>', '<meta content="다름" name="description"></head>'));
  await assert.rejects(inspectSite(directory), /하나여야/, '속성 순서가 다른 중복을 검출해야 합니다');
  await writeFile(file, valid.replace('property="og:description"', 'property="og:other"'));
  await assert.rejects(inspectSite(directory), /하나여야/, '누락된 OG 설명을 검출해야 합니다');
  await writeFile(file, valid.replace('연구 &amp;amp; 결과', '다른 설명'));
  await assert.rejects(inspectSite(directory), /다릅니다/, 'HTML 설명 차이를 검출해야 합니다');
  await writeFile(file, valid.replace('"description":', '"descript\\u0069on":"다름", "description":'));
  await assert.rejects(inspectSite(directory), /중복 description/, '이스케이프된 중복 JSON 키를 검출해야 합니다');
  await writeFile(file, valid);
  await assert.rejects(inspectSite(directory, [], [{ source: '시험', destination: file, rendered: '다른 원문' }]), /원본 Markdown과 다릅니다/);
  await assert.rejects(inspectSite(directory, [], [{ source: '누락', destination: join(directory, 'missing.html'), rendered: value }]), /생성 파일이 없습니다/);
  await writeFile(file, fixtureHtml(null));
  await inspectSite(directory);
});

test('설명 원본의 우선순위, 단어 제한과 선택 대상 글·페이지를 확인한다', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'generic-description-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const output = join(root, 'site');
  await mkdir(join(source, '_posts'), { recursive: true });
  await mkdir(output, { recursive: true });
  await writeFile(join(source, '_config.yml'), `title: 사이트\nrepository: example/example\nbaseurl: ''\nmarkdown: kramdown\ndescription: ${JSON.stringify('기본 &amp;amp; 설명')}\n`);
  await writeFile(join(source, 'first.md'), `---\nseo_plain_description: ${JSON.stringify('A & B &amp; ©')}\ndescription: ${JSON.stringify('A &#38; **B** &amp;amp; &copy;')}\npermalink: /first/\n---\n본문\n`);
  await writeFile(join(source, 'second.md'), `---\nseo_plain_description: ${JSON.stringify('기본 &amp; 설명')}\ndescription: ''\nexcerpt: 제외될 값\npermalink: /second/\n---\n본문\n`);
  await writeFile(join(source, 'fourth.md'), `---\nseo_plain_description: '& 넷…'\ndescription: '&#x26; **넷** 다섯'\nseo_description_max_words: 2\npermalink: /fourth/\n---\n본문\n`);
  await writeFile(join(source, 'fifth.md'), `---\nseo_plain_description: '…'\ndescription: '하나 둘'\nseo_description_max_words: 0\npermalink: /fifth/\n---\n본문\n`);
  await writeFile(join(source, '_posts/2020-01-01-sample.md'), `---\ntitle: 예시\nseo_plain_description: '하나 둘…'\nexcerpt: '하나 둘 셋'\nseo_description_max_words: 2\npermalink: /third/\n---\n본문\n`);
  const selected = selectedDocuments(source, output);
  assert.equal(selected.plain.length, 5, '페이지 네 개와 게시 글 하나를 선택해야 합니다');
  const expected = new Map([['first/index.html', 'A & B &amp; ©'], ['second/index.html', '기본 &amp; 설명'], ['third/index.html', '하나 둘…'], ['fourth/index.html', '& 넷…'], ['fifth/index.html', '…']]);
  for (const page of selected.plain) {
    const wanted = expected.get(relative(output, page.destination));
    assert.ok(wanted, `${page.source}: 예상한 출력 경로가 필요합니다`);
    await mkdir(dirname(page.destination), { recursive: true });
    await writeFile(page.destination, fixtureHtml(wanted));
  }
  await inspectSite(output, selected.excluded, selected.plain);
});
