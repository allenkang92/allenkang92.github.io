import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const sourceRoot = resolve(process.env.SEO_SOURCE_ROOT || '.');
const siteRoot = resolve(process.env.SITE_ROOT || '_site');
const bundle = process.env.BUNDLE_BIN || 'bundle';

function selectedAchievements(source, destination) {
  // 원본에 Jekyll의 변환기를 별도 적용한다. 생성된 메타데이터는 기대값이 아니다.
  // 기본 설정 기준으로 Jekyll이 실제 쓰는 컬렉션 문서와 목적지를 사용한다.
  const ruby = `require 'jekyll'; require 'github-pages'; require 'json'
    config = Jekyll.configuration('source' => ARGV.fetch(0), 'destination' => ARGV.fetch(1), 'quiet' => true)
    pages_config = GitHubPages::Configuration.effective_config(config)
    unless [config['markdown'], pages_config['markdown']].all? { |value| value.to_s.downcase == 'kramdown' }
      raise 'Kramdown 이외의 Markdown 설정은 기대값 재검토가 필요합니다'
    end
    site = Jekyll::Site.new(config)
    site.reset; site.read; site.generate
    filter = Object.new.extend(Liquid::StandardFilters)
    render = ->(value, settings) { filter.strip_html(Jekyll::Converters::Markdown.new(settings).convert(value.to_s)).gsub(/\\s+/, ' ').strip }
    values = ->(doc) {
      description = doc.data['description']
      description = site.config['description'] if description.nil? || description == false || (description.respond_to?(:empty?) && description.empty?)
      [doc.data['title'], description, site.config['title']]
    }
    docs = site.collections['achievements']&.docs || []
    puts JSON.generate(docs.select(&:write?).map { |doc|
      raw = values.call(doc)
      raise "제목은 문자열이어야 합니다: #{doc.relative_path}" unless raw[0].is_a?(String)
      normal = raw.map { |value| render.call(value, config) }
      pages = raw.map { |value| render.call(value, pages_config) }
      raise "Markdown 변환 결과가 빌드 환경에 따라 다릅니다: #{doc.relative_path}" unless normal == pages
      { 'source' => doc.relative_path, 'destination' => doc.destination(site.dest), 'rendered' => normal }
    })`;
  return JSON.parse(execFileSync(bundle, ['exec', 'ruby', '-e', ruby, source, destination], { encoding: 'utf8' }));
}

async function validateAchievement({ source, destination, rendered }) {
  const html = await readFile(destination, 'utf8');
  const window = new Window({ settings: {
    disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true,
  } });
  try {
    const document = new window.DOMParser().parseFromString(html, 'text/html');
    // Markdown 변환으로 생긴 HTML 문자 참조만 정확히 한 번 해독한다.
    const decoder = document.createElement('textarea');
    const decode = value => { decoder.innerHTML = value; return decoder.value; };
    const [title, description, siteTitle] = rendered.map(decode);
    const single = selector => {
      const elements = document.head.querySelectorAll(selector);
      assert.equal(elements.length, 1, `${source}: ${selector} 요소는 하나여야 합니다`);
      return elements[0];
    };
    assert.equal(single('title').textContent, `${title} | ${siteTitle}`, `${source}: 브라우저 제목`);
    for (const selector of ['meta[property="og:title" i]', 'meta[name="twitter:title" i]']) {
      assert.equal(single(selector).getAttribute('content'), title, `${source}: ${selector} 원본 제목`);
    }
    const descriptionSelectors = ['meta[name="description" i]', 'meta[property="og:description" i]', 'meta[name="twitter:description" i]'];
    const descriptionElements = descriptionSelectors.map(selector => document.head.querySelectorAll(selector));
    if (!description) {
      const counts = descriptionElements.map(elements => elements.length);
      assert.ok(counts.every(count => count === 0) || counts.every(count => count === 1), `${source}: 빈 설명은 모두 생략하거나 빈 값이어야 합니다`);
    }
    for (let index = 0; index < descriptionSelectors.length; index++) {
      const elements = descriptionElements[index];
      assert.ok(elements.length === 1 || (!description && elements.length === 0), `${source}: ${descriptionSelectors[index]} 요소 수`);
      if (elements.length) assert.equal(elements[0].getAttribute('content'), description, `${source}: ${descriptionSelectors[index]} 원본 설명`);
    }
    const script = single('script[type="application/ld+json" i]');
    const json = JSON.parse(script.textContent);
    assert.equal(json.headline, title, `${source}: JSON-LD 원본 제목`);
    if (description || Object.hasOwn(json, 'description')) assert.equal(json.description, description, `${source}: JSON-LD 원본 설명`);
    // JSON.parse는 중복 속성의 앞 값을 버리므로 원본 키 쌍도 점검한다.
    const checker = `import json, sys
def check(pairs):
    for key in ('headline', 'description'):
        if sum(name == key for name, _ in pairs) > 1:
            raise ValueError('중복 ' + key)
    return dict(pairs)
json.loads(sys.stdin.read(), object_pairs_hook=check)`;
    const checked = spawnSync('python3', ['-c', checker], { input: script.textContent, encoding: 'utf8' });
    assert.equal(checked.status, 0, `${source}: JSON-LD 중복 또는 파서 오류: ${checked.stderr || checked.error || ''}`);
  } finally {
    await window.happyDOM.abort();
  }
}

async function validateAll(achievements) {
  for (const achievement of achievements) await validateAchievement(achievement);
}

test('기본 빌드에서 선택된 모든 성과의 메타데이터가 원본 Markdown과 일치한다', async () => {
  await validateAll(selectedAchievements(sourceRoot, siteRoot));
});

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function fixtureHtml(title, description, siteTitle) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const st = escapeHtml(siteTitle);
  const json = JSON.stringify({ headline: title, description }).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  return `<!doctype html><html><head><title>${t} | ${st}</title><meta property="og:title" content="${t}"><meta name="twitter:title" content="${t}"><meta name="description" content="${d}"><meta property="og:description" name="twitter:description" content="${d}"><script type="application/ld+json">${json}</script></head><body></body></html>`;
}

test('새 성과와 기본 설명을 포함해 오기재된 평문·누락·중복을 탐지한다', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'achievement-plain-all-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const output = join(root, 'site');
  await mkdir(join(source, '_achievements'), { recursive: true });
  await mkdir(output, { recursive: true });
  await writeFile(join(source, '_config.yml'), `title: 사이트\nmarkdown: kramdown\ndescription: ${JSON.stringify('기본 &amp;amp; **문서** &copy;')}\ncollections:\n  achievements:\n    output: true\n    permalink: /achievements/:title/\n`);
  for (const [name, title, description, published] of [
    ['one', 'A &#38; **B** &amp;amp; &copy;', null, true],
    ['two', '둘째 "성과"', '숫자 &#x26; &amp; 문서', true],
    ['hidden', '비공개', null, false],
  ]) {
    const lines = [`title: ${JSON.stringify(title)}`, `published: ${published}`];
    if (description !== null) lines.push(`description: ${JSON.stringify(description)}`);
    if (name === 'two') lines.push('permalink: /research/custom-second/');
    await writeFile(join(source, '_achievements', `${name}.md`), `---\n${lines.join('\n')}\n---\n본문\n`);
  }
  const achievements = selectedAchievements(source, output);
  assert.equal(achievements.length, 2, '게시되는 두 성과만 검사해야 합니다');
  const names = new Map(achievements.map(item => [item.source, item]));
  const first = names.get('_achievements/one.md');
  const second = names.get('_achievements/two.md');
  assert.ok(first && second);
  assert.equal(second.destination, join(output, 'research/custom-second/index.html'), '사용자 지정 permalink를 따라야 합니다');
  // 기대값을 수동으로 정해 참조가 한 번만 해독되는지 독립적으로 확인한다.
  for (const [record, title, description] of [
    [first, 'A & B &amp; ©', '기본 &amp; 문서 ©'],
    [second, '둘째 “성과”', '숫자 & & 문서'],
  ]) {
    await mkdir(dirname(record.destination), { recursive: true });
    await writeFile(record.destination, fixtureHtml(title, description, '사이트'));
  }
  await validateAll(achievements);
  const valid = await readFile(first.destination, 'utf8');
  await writeFile(first.destination, valid.replace('A &amp; B &amp;amp; ©', '잘못된 제목'));
  await assert.rejects(validateAll(achievements), /브라우저 제목/, '오기재된 평문 제목을 탐지해야 합니다');
  await writeFile(first.destination, valid.replace('기본 &amp;amp; 문서 ©', '잘못된 설명'));
  await assert.rejects(validateAll(achievements), /원본 설명/, '오기재된 평문 설명을 탐지해야 합니다');
  await writeFile(first.destination, valid.replace('</head>', '<meta content="다른 제목" property="og:title"></head>'));
  await assert.rejects(validateAll(achievements), /요소는 하나여야 합니다/, '중복 제목 메타를 탐지해야 합니다');
  await writeFile(first.destination, valid.replace('"headline":', '"head\\u006cine":"잘못된 제목", "headline":'));
  await assert.rejects(validateAll(achievements), /JSON-LD 중복/, '이스케이프된 중복 JSON 키를 탐지해야 합니다');
  await writeFile(first.destination, valid);
  await assert.rejects(validateAll([...achievements, { ...first, destination: join(output, '없는-성과.html') }]), /ENOENT/, '출력 누락을 탐지해야 합니다');
  const emptyPath = join(output, 'empty.html');
  await writeFile(emptyPath, '<!doctype html><html><head><title>빈 설명 | 사이트</title><meta property="og:title" content="빈 설명"><meta name="twitter:title" content="빈 설명"><script type="application/ld+json">{"headline":"빈 설명"}</script></head></html>');
  await validateAchievement({ source: '빈 설명 예시', destination: emptyPath, rendered: ['빈 설명', '', '사이트'] });
});
