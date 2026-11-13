import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const sourceRoot = resolve(process.env.SEO_SOURCE_ROOT || '.');
const siteRoot = resolve(process.env.SITE_ROOT || '_site');
const bundle = process.env.BUNDLE_BIN || 'bundle';

// 기본 설정으로 선택된 페이지와 글을 대상으로 한다. 별도 --future/--config는 범위 밖이다.
function selectedDocuments(source, destination) {
  const ruby = `require 'jekyll'; require 'jekyll-seo-tag'; require 'json'
    c = Jekyll.configuration('source' => ARGV.fetch(0), 'destination' => ARGV.fetch(1), 'quiet' => true)
    raise 'Markdown 변환기 검토 필요' unless c['markdown'].to_s.downcase == 'kramdown'
    s = Jekyll::Site.new(c); s.reset; s.read; s.generate
    ctx = Liquid::Context.new({}, {}, { :site => s })
    f = Jekyll::SeoTag::Filters.new(ctx)
    convert = ->(value) { f.normalize_whitespace(f.strip_html(f.markdownify(value))) }
    render = ->(value) { output = convert.call(value); output.empty? ? nil : output }
    expected = ->(doc) {
      page = doc.to_liquid
      seo = page['seo'].is_a?(Hash) ? page['seo'] : {}
      explicit = seo['name'] ? render.call(seo['name']) : nil
      next [explicit, 'page'] if explicit
      next [nil, nil] unless page['url'].to_s.match?(%r!^/(about/)?(index.html?)?$!)
      social = s.config['social'].is_a?(Hash) ? s.config['social'] : {}
      value = if social['name']
                render.call(social['name'])
              else
                render.call(s.config['title'] || s.config['name'])
              end
      [value, value ? 'site' : nil]
    }
    docs = s.pages + s.collections.reject { |name, _| name == 'achievements' }.values.flat_map(&:docs)
    selected = docs.select { |doc| doc.respond_to?(:write?) && doc.write? && doc.output_ext.to_s.downcase == '.html' }
    puts JSON.generate(selected.map { |doc|
      value, origin = expected.call(doc)
      { 'source' => doc.respond_to?(:relative_path) ? doc.relative_path : doc.path,
        'destination' => doc.destination(s.dest), 'rendered' => value,
        'required' => !doc.data['seo_plain_name'].nil? || (origin == 'site' && !s.config['seo_plain_name'].nil?) }
    })`;
  return JSON.parse(execFileSync(bundle, ['exec', 'ruby', '-e', ruby, source, destination], { encoding: 'utf8' }));
}

async function inspectDocument({ source, destination, rendered, required }) {
  const html = await readFile(destination, 'utf8');
  const browser = new Window({ settings: {
    disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true,
  } });
  try {
    const document = new browser.DOMParser().parseFromString(html, 'text/html');
    const scripts = [...document.head.querySelectorAll('script[type="application/ld+json" i]')];
    if (!scripts.length) {
      assert.equal(required, false, `${source}: 명시된 이름에 JSON-LD가 없습니다`);
      return;
    }
    assert.equal(scripts.length, 1, `${source}: JSON-LD는 한 개여야 합니다`);
    const raw = scripts[0].textContent;
    const data = JSON.parse(raw);
    if (rendered === null) {
      assert.equal(Object.hasOwn(data, 'name'), false, `${source}: 예상하지 않은 루트 name`);
    } else {
      const decoder = document.createElement('textarea');
      decoder.innerHTML = rendered;
      assert.equal(data.name, decoder.value, `${source}: JSON-LD 이름이 원본 Markdown과 다릅니다`);
    }
    // JSON.parse는 같은 키를 덮으므로 각 객체의 중복 원본 키도 확인한다.
    const checker = `import json, sys
def check(pairs):
    if sum(key == 'name' for key, _ in pairs) > 1:
        raise ValueError('중복 name')
    return dict(pairs)
json.loads(sys.stdin.read(), object_pairs_hook=check)`;
    const result = spawnSync('python3', ['-c', checker], { input: raw, encoding: 'utf8' });
    assert.equal(result.status, 0, `${source}: JSON-LD name 중복 또는 파서 오류: ${result.stderr || result.error || ''}`);
  } finally { await browser.happyDOM.abort(); }
}

async function validateAll(documents) {
  for (const document of documents) await inspectDocument(document);
}

test('기본 빌드에서 선택된 일반 글과 페이지의 JSON-LD 이름이 원본과 일치한다', async () => {
  await validateAll(selectedDocuments(sourceRoot, siteRoot));
});

function fixtureHtml(name, extra = {}) {
  const data = { '@context': 'https://schema.org', ...extra };
  if (name !== null) data.name = name;
  const json = JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  return `<!doctype html><html><head><script type="application/ld+json">${json}</script></head></html>`;
}

test('이름 원천 우선순위와 누락·오기재·중복 JSON 키를 탐지한다', async () => {
  const root = await mkdtemp(join(tmpdir(), 'seo-name-all-'));
  const source = join(root, 'source');
  const output = join(root, 'site');
  await mkdir(join(source, '_posts'), { recursive: true });
  await mkdir(output, { recursive: true });
  const config = `title: ${JSON.stringify('제목 &amp;amp; 연구')}
repository: example/example
baseurl: ''
markdown: kramdown
seo_plain_name: ${JSON.stringify('소셜 & 연구')}
social:
  name: ${JSON.stringify('소셜 &#38; **연구**')}
`;
  await writeFile(join(source, '_config.yml'), config);
  for (const [file, front, body] of [
    ['index.html', 'permalink: /\n', '홈'],
    ['about.html', 'permalink: /about/\nseo:\n  name: false\n', '소개'],
    ['normal.html', 'permalink: /normal/\n', '일반'],
    ['explicit.html', `permalink: /explicit/\nseo:\n  name: ${JSON.stringify('명시 &#x26; &copy;')}\nseo_plain_name: ${JSON.stringify('명시 & ©')}\n`, '명시'],
    ['empty.html', 'permalink: /empty/\nseo:\n  name: ""\n', '빈 이름'],
    ['_posts/2020-01-01-example.md', `title: 글\npermalink: /post/\nseo:\n  name: ${JSON.stringify('글 &amp;amp; 이름')}\n`, '글'],
    ['_posts/2999-01-01-future.md', 'title: 미래\nseo:\n  name: 미래\n', '미래'],
    ['_posts/2020-01-02-hidden.md', 'title: 미발행\npublished: false\nseo:\n  name: 숨김\n', '숨김'],
  ]) {
    await writeFile(join(source, file), `---\n${front}---\n${body}\n`);
  }
  const documents = selectedDocuments(source, output);
  const paths = new Map(documents.map(item => [item.source, item]));
  assert.equal(documents.length, 6, '기본 빌드는 미래 글과 미발행 글을 제외해야 합니다');
  const expected = new Map([
    ['index.html', '소셜 & 연구'], ['about.html', '소셜 & 연구'], ['normal.html', null],
    ['explicit.html', '명시 & ©'], ['empty.html', null], ['_posts/2020-01-01-example.md', '글 &amp; 이름'],
  ]);
  for (const [path, value] of expected) {
    const record = paths.get(path);
    assert.ok(record, `${path}: 선택 대상이 필요합니다`);
    await mkdir(dirname(record.destination), { recursive: true });
    // 중첩 객체가 루트와 같은 이름을 가져도 서로 다른 JSON 키로 취급한다.
    const nestedName = value ?? '중첩 이름';
    const extra = { author: { name: nestedName }, image: { name: nestedName }, publisher: { name: nestedName } };
    await writeFile(record.destination, fixtureHtml(value, extra));
  }
  await validateAll(documents);
  const target = paths.get('explicit.html');
  const valid = await readFile(target.destination, 'utf8');
  const rootName = ',"name":"명시 \\u0026 ©"}';
  assert.ok(valid.includes(rootName), '중첩 이름과 구분된 루트 이름이 필요합니다');
  await writeFile(target.destination, valid.replace(rootName, ',"name":"잘못된 이름"}'));
  await assert.rejects(validateAll(documents), /원본 Markdown과 다릅니다/, '오기재된 평문 이름을 탐지해야 합니다');
  await writeFile(target.destination, valid.replace(rootName, ',"na\\u006de":"중복", "name":"명시 \\u0026 ©"}'));
  await assert.rejects(validateAll(documents), /JSON-LD name 중복/, '이스케이프된 중복 키를 탐지해야 합니다');
  await writeFile(target.destination, '<!doctype html><html><head></head></html>');
  await assert.rejects(validateAll(documents), /JSON-LD가 없습니다/, '명시된 이름의 JSON-LD 누락을 탐지해야 합니다');
  await writeFile(target.destination, valid);
  await assert.rejects(validateAll([...documents, { ...target, destination: join(output, '없는-페이지.html') }]), /ENOENT/, '선택된 페이지의 산출물 누락을 탐지해야 합니다');

  // 빈 문자열은 Ruby에서 참이므로 social.name을 선택한 뒤 사이트 제목으로 되돌아가지 않는다.
  await writeFile(join(source, '_config.yml'), config.replace(`  name: ${JSON.stringify('소셜 &#38; **연구**')}`, '  name: ""'));
  const emptySocial = selectedDocuments(source, output);
  for (const path of ['index.html', 'about.html']) {
    const record = emptySocial.find(item => item.source === path);
    assert.equal(record.rendered, null, `${path}: 빈 소셜 이름에는 사이트 제목을 대체하지 않아야 합니다`);
    assert.equal(record.required, false, `${path}: 원천이 없으면 사이트 평문을 적용하지 않아야 합니다`);
  }
  // false는 Ruby에서 거짓이므로 홈페이지·소개에 사이트 제목을 사용한다.
  await writeFile(join(source, '_config.yml'), config.replace(`  name: ${JSON.stringify('소셜 &#38; **연구**')}`, '  name: false'));
  const falseSocial = selectedDocuments(source, output);
  for (const path of ['index.html', 'about.html']) {
    const record = falseSocial.find(item => item.source === path);
    assert.ok(record.rendered.includes('&amp;amp;'), `${path}: 사이트 제목이 원천이어야 합니다`);
  }
});
