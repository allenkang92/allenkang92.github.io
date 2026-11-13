import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const sourceRoot = resolve(process.env.SEO_SOURCE_ROOT || '.');
const siteRoot = resolve(process.env.SITE_ROOT || '_site');
const bundle = process.env.BUNDLE_BIN || 'bundle';

function selectedPosts(source, destination) {
  // 기본 설정의 Jekyll 생성 단계 이후 선택 결과와 출력 경로를 따라간다.
  const ruby = `require 'jekyll'; require 'json'
    config = Jekyll.configuration('source' => ARGV.fetch(0), 'destination' => ARGV.fetch(1), 'quiet' => true)
    site = Jekyll::Site.new(config)
    site.reset
    site.read
    site.generate
    posts = site.posts.docs.select { |post| post.data['seo_title_literal'] == true }
    puts JSON.generate(posts.map { |post| { 'source' => post.relative_path, 'title' => post.data['title'], 'destination' => post.destination(site.dest) } })`;
  return JSON.parse(execFileSync(bundle, ['exec', 'ruby', '-e', ruby, source, destination], { encoding: 'utf8' }));
}

async function validatePost({ source, title, destination }) {
  assert.equal(typeof title, 'string', `${source}: 제목은 문자열이어야 합니다`);
  const html = await readFile(destination, 'utf8');
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    const document = new window.DOMParser().parseFromString(html, 'text/html');
    const single = selector => {
      const elements = document.querySelectorAll(selector);
      assert.equal(elements.length, 1, `${source}: ${selector} 요소는 하나여야 합니다`);
      return elements[0];
    };
    assert.equal(single('h1.post-title').textContent, title, `${source}: 본문 제목`);
    const documentTitle = single('head > title').textContent;
    assert.ok(documentTitle.startsWith(`${title} | `) && documentTitle.slice(title.length + 3).trim(), `${source}: 브라우저 제목`);
    for (const selector of ['meta[property="og:title" i]', 'meta[name="twitter:title" i]']) {
      assert.equal(single(selector).getAttribute('content'), title, `${source}: ${selector} 제목`);
    }
    const script = single('script[type="application/ld+json" i]');
    assert.equal(JSON.parse(script.textContent).headline, title, `${source}: JSON-LD 제목`);
    // JSON.parse는 중복 속성을 마지막 값으로 덮으므로 객체별 원본 키 쌍도 검사한다.
    const checker = `import json, sys
def check(pairs):
    if sum(key == 'headline' for key, _ in pairs) > 1:
        raise ValueError('중복 headline')
    return dict(pairs)
json.loads(sys.stdin.read(), object_pairs_hook=check)`;
    const result = spawnSync('python3', ['-c', checker], { input: script.textContent, encoding: 'utf8' });
    assert.equal(result.status, 0, `${source}: JSON-LD headline 중복 또는 파서 오류: ${result.stderr || result.error || ''}`);
  } finally {
    await window.happyDOM.abort();
  }
}

async function validateAll(posts) {
  for (const post of posts) await validatePost(post);
}

test('원문 제목을 선택한 모든 실제 게시 글은 생성물의 제목과 일치한다', async () => {
  const posts = selectedPosts(sourceRoot, siteRoot);
  await validateAll(posts);
});

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function exampleHtml(title) {
  const value = escapeHtml(title);
  const json = JSON.stringify({ headline: title }).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  return `<!doctype html><html><head><title>${value} | 사이트</title><meta property="og:title" content="${value}"><meta name="twitter:title" content="${value}"><script type="application/ld+json">${json}</script></head><body><h1 class="post-title">${value}</h1></body></html>`;
}

test('여러 원문 제목 글을 선택하고 변형된 중복 메타와 누락 산출물을 놓치지 않는다', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'literal-title-all-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const source = join(fixture, 'source');
  const output = join(fixture, 'site');
  await mkdir(join(source, '_posts'), { recursive: true });
  await mkdir(output, { recursive: true });
  await writeFile(join(source, '_config.yml'), 'title: 사이트\ndefaults:\n  - scope:\n      path: ""\n      type: posts\n    values:\n      seo_title_literal: true\n');
  for (const [file, title, permalink, option] of [
    ['2020-01-01-a.md', '<첫 글> & 안내', '/posts/a/', 'true'],
    ['2020-01-02-b.md', '둘째 "글"', '/posts/b/', null],
    ['2020-01-03-c.md', '선택하지 않은 글', '/posts/c/', 'false'],
  ]) {
    await writeFile(join(source, '_posts', file), `---\ntitle: ${JSON.stringify(title)}\npermalink: ${permalink}\n${option === null ? '' : `seo_title_literal: ${option}\n`}---\n본문\n`);
  }
  await writeFile(join(source, '_posts', '2999-01-01-future.md'), '---\ntitle: 미래 글\npermalink: /posts/future/\nseo_title_literal: true\n---\n본문\n');
  await writeFile(join(source, '_posts', '2020-01-04-unpublished.md'), '---\ntitle: 미발행 글\npermalink: /posts/unpublished/\nseo_title_literal: true\npublished: false\n---\n본문\n');
  const posts = selectedPosts(source, output);
  assert.equal(posts.length, 2, '기본 설정을 적용한 두 게시 글만 검사해야 합니다');
  for (const post of posts) {
    await mkdir(dirname(post.destination), { recursive: true });
    await writeFile(post.destination, exampleHtml(post.title));
  }
  await validateAll(posts);

  const target = posts[1];
  const valid = await readFile(target.destination, 'utf8');
  await writeFile(target.destination, valid.replace('</head>', '<meta content="다른 제목" property="og:title"></head>'));
  await assert.rejects(validateAll(posts), /요소는 하나여야 합니다/, '속성 순서가 다른 중복도 탐지해야 합니다');
  await writeFile(target.destination, valid.replace('<script type="application/ld+json">', '<script type="application/ld+json">{}</script><script type="application/ld+json">'));
  await assert.rejects(validateAll(posts), /요소는 하나여야 합니다/, '중복 JSON-LD도 탐지해야 합니다');
  await writeFile(target.destination, valid.replace('"headline":', '"headline":"다른 제목", "head\\u006cine":'));
  await assert.rejects(validateAll(posts), /headline 중복/, '공백과 이스케이프된 JSON 중복 키도 탐지해야 합니다');
  await writeFile(target.destination, valid.replace('property="og:title"', 'property="og:other"'));
  await assert.rejects(validateAll(posts), /요소는 하나여야 합니다/, '누락된 제목 메타도 탐지해야 합니다');
  await writeFile(target.destination, valid.replace('둘째 &quot;글&quot;', '다른 제목'));
  await assert.rejects(validateAll(posts), /브라우저 제목/, '원문과 다른 제목도 탐지해야 합니다');
  await writeFile(target.destination, valid);
  await assert.rejects(validateAll([...posts, { ...target, destination: join(output, '없는-글.html') }]), /ENOENT/, '선택된 글의 산출물이 없으면 실패해야 합니다');
});

test('일반 페이지는 게시 글 전용 원문 제목 설정을 사용할 수 없다', async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'literal-title-page-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const fixture = await realpath(temporary);
  const source = join(fixture, 'source');
  await mkdir(join(source, '_includes'), { recursive: true });
  await mkdir(join(source, '_layouts'), { recursive: true });
  await writeFile(join(source, '_config.yml'), 'title: 사이트\nauthor: 작성자\ndescription: 실험\nurl: https://example.org\nbaseurl: ""\nrepository: example/example.github.io\nplugins:\n  - jekyll-seo-tag\n');
  for (const name of ['post-literal-seo.html', 'seo-compat.html', 'seo-legacy-metadata-guard.html']) {
    await writeFile(join(source, '_includes', name), await readFile(join(sourceRoot, '_includes', name)));
  }
  await writeFile(join(source, '_layouts', 'default.html'), '<!doctype html><html><head>{% include post-literal-seo.html %}</head><body>{{ content }}</body></html>');
  await writeFile(join(source, 'index.md'), '---\nlayout: default\ntitle: 일반 페이지\nseo_title_literal: true\n---\n본문\n');
  const result = spawnSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', join(fixture, 'site')], { encoding: 'utf8', timeout: 15000 });
  assert.notEqual(result.status, 0, '일반 페이지의 원문 제목 설정은 빌드가 실패해야 합니다');
  assert.match(`${result.stdout}\n${result.stderr}`, /ERROR_literal_seo_unsupported_title_configuration/, '지원하지 않는 설정의 실패 이유를 확인할 수 있어야 합니다');
});
