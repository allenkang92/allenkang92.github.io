// 기본 Pages 안전 모드에서 일반 문서의 설명 직렬화를 확인한다.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { withTemporaryDirectory } from '../helpers/temporary-directory.mjs';
import { join, resolve } from 'node:path';

const repository = resolve('.');
await withTemporaryDirectory('generic-seo-description-', async (fixture) => {
const source = join(fixture, 'source');
await mkdir(join(source, '_layouts'), { recursive: true });
await mkdir(join(source, '_posts'), { recursive: true });
await cp(join(repository, '_includes'), join(source, '_includes'), { recursive: true });

const yaml = value => JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const siteDescription = '기본 & **기록**';
const config = `title: 고정 사이트\nurl: https://example.org\nbaseurl: ""\nrepository: example/seo-fixture\nmarkdown: kramdown\nauthor: 시험 작성자\nlogo: /logo.png\ndescription: ${yaml(siteDescription)}\nseo_plain_description: ${yaml('기본 & 기록')}\nplugins:\n  - jekyll-feed\n  - jekyll-seo-tag\n`;
await writeFile(join(source, '_config.yml'), config);
await writeFile(join(source, '_layouts/default.html'), '<!doctype html><html lang="ko">{% include head.html %}<body><main>{{ content }}</main></body></html>');

const entries = [
  { name: '일반 페이지', source: 'plain.md', destination: 'plain/index.html', kind: 'page', raw: 'Alpha & beta', expected: 'Alpha & beta', type: 'website', canonical: '/plain/' },
  { name: '평문을 별도 지정하지 않은 일반 설명', source: 'simple.md', destination: 'simple/index.html', kind: 'page', raw: '단순 설명', expected: '단순 설명', type: 'website', canonical: '/simple/', noPlain: true },
  { name: 'Markdown 설명', source: 'markdown.md', destination: 'markdown/index.html', kind: 'page', raw: '연구 & **정리**', expected: '연구 & 정리', type: 'website', canonical: '/markdown/' },
  { name: '숫자·명명·중첩 문자 참조', source: 'entities.md', destination: 'entities/index.html', kind: 'page', raw: '입력 &#38; &#x26; &copy; &amp;amp;', expected: '입력 & & © &amp;', type: 'website', canonical: '/entities/' },
  { name: '스크립트 종료 문자가 포함된 설명', source: 'special.md', destination: 'special/index.html', kind: 'page', raw: '안내 & &lt;/script&gt;&lt;script&gt;실행금지&lt;/script&gt; "인용" 😀', expected: '안내 & </script><script>실행금지</script> “인용” 😀', type: 'website', canonical: '/special/' },
  { name: '역슬래시가 포함된 설명', source: 'backslash.md', destination: 'backslash/index.html', kind: 'page', raw: '경로 & `C:\\자료\\1\\&`', expected: '경로 & C:\\자료\\1\\&', type: 'website', canonical: '/backslash/' },
  { name: '사이트 기본 설명', source: 'site.md', destination: 'site/index.html', kind: 'site', raw: null, expected: '기본 & 기록', type: 'website', canonical: '/site/' },
  { name: '게시 글 설명', source: '_posts/2020-01-01-post.md', destination: 'posts/description/index.html', kind: 'page', raw: '게시 & **검색**', expected: '게시 & 검색', type: 'article', canonical: '/posts/description/' },
  { name: '원문 제목 게시 글과 설명', source: '_posts/2020-01-02-literal.md', destination: 'posts/literal/index.html', kind: 'page', raw: '원문 & 설명', expected: '원문 & 설명', type: 'article', canonical: '/posts/literal/', literal: true },
  { name: '게시 글 발췌 설명', source: '_posts/2020-01-03-excerpt.md', destination: 'posts/excerpt/index.html', kind: 'excerpt', raw: '발췌 & **내용**', expected: '발췌 & 내용', type: 'article', canonical: '/posts/excerpt/' },
  { name: '단어 제한보다 하나 적은 설명', source: 'short.md', destination: 'short/index.html', kind: 'page', raw: 'Alpha &', expected: 'Alpha &', type: 'website', canonical: '/short/', words: 3 },
  { name: '단어 제한과 같은 설명', source: 'equal.md', destination: 'equal/index.html', kind: 'page', raw: 'Alpha & beta', expected: 'Alpha & beta', type: 'website', canonical: '/equal/', words: 3 },
  { name: '단어 제한보다 하나 많은 설명', source: 'long.md', destination: 'long/index.html', kind: 'page', raw: 'Alpha & beta gamma', expected: 'Alpha & beta…', type: 'website', canonical: '/long/', words: 3 },
  { name: '유니코드 줄 구분 문자가 포함된 설명', source: 'unicode.md', destination: 'unicode/index.html', kind: 'page', raw: '앞 & \u2028 \u2029 뒤', expected: '앞 & \u2028 \u2029 뒤', type: 'website', canonical: '/unicode/' },
  { name: '서로 다른 이미지 설명', source: 'image-other.md', destination: 'image-other/index.html', kind: 'page', raw: 'Alpha & beta', expected: 'Alpha & beta', type: 'website', canonical: '/image-other/', imageDescription: '이미지 설명' },
  { name: '같은 평문의 이미지 설명', source: 'image-same.md', destination: 'image-same/index.html', kind: 'page', raw: 'Alpha & beta', expected: 'Alpha & beta', type: 'website', canonical: '/image-same/', imageDescription: 'Alpha & beta' },
  { name: '문자 참조 원문과 같은 이미지 설명', source: 'image-entity.md', destination: 'image-entity/index.html', kind: 'page', raw: 'Alpha & beta', expected: 'Alpha & beta', type: 'website', canonical: '/image-entity/', imageDescription: 'Alpha &amp; beta' },
];
for (const entry of entries) {
  const front = ['layout: default', `title: ${yaml(entry.literal ? '<제목> & 원문' : entry.name)}`, `permalink: ${entry.canonical}`];
  if (entry.literal) front.push('seo_title_literal: true');
  if (entry.words) front.push(`seo_description_max_words: ${entry.words}`);
  if (entry.imageDescription) front.push('image:', '  path: /image.png', `  description: ${yaml(entry.imageDescription)}`);
  if (entry.kind === 'site') front.push(`seo_plain_description: ${yaml(entry.expected)}`);
  else if (entry.kind === 'excerpt') front.push(`excerpt: ${yaml(entry.raw)}`, `seo_plain_description: ${yaml(entry.expected)}`);
  else {
    front.push(`description: ${yaml(entry.raw)}`);
    if (!entry.noPlain) front.push(`seo_plain_description: ${yaml(entry.expected)}`);
  }
  await writeFile(join(source, entry.source), `---\n${front.join('\n')}\n---\n\n본문은 유지됩니다.\n`);
}
await writeFile(join(fixture, 'cases.json'), JSON.stringify(entries));

const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'development', TZ: 'UTC' };
const bundle = process.env.BUNDLE_BIN || 'bundle';
const integration = join(repository, 'tests/seo/generic-seo-description.integration.test.mjs');
const headPath = join(source, '_includes/head.html');
const originalHead = await readFile(headPath, 'utf8');
for (const [name, base] of [['root', ''], ['nested', '/blog']]) {
  const output = join(fixture, name);
  const baseline = join(fixture, `${name}-baseline`);
  await writeFile(join(source, '_config.yml'), config.replace('baseurl: ""', `baseurl: ${yaml(base)}`));
  // 동일한 입력을 원본 플러그인으로도 빌드해 나머지 메타데이터를 비교한다.
  await writeFile(headPath, '<head><meta charset="utf-8">{% seo %}</head>');
  const before = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', baseline], { cwd: repository, env, encoding: 'utf8' });
  assert.ifError(before.error);
  assert.equal(before.status, 0, `${name}: 원본 플러그인 빌드 실패\n${before.stderr}`);
  await writeFile(headPath, originalHead);
  const built = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', output], { cwd: repository, env, encoding: 'utf8' });
  assert.ifError(built.error);
  assert.equal(built.status, 0, `${name}: 정상 평문을 지정한 Pages 빌드 실패\n${built.stderr}`);
  execFileSync(process.execPath, ['--test', integration], { cwd: repository, env: { ...env, SEO_DESCRIPTION_FIXTURE_ROOT: fixture, SEO_DESCRIPTION_BASELINE_ROOT: baseline, SITE_ROOT: output }, stdio: 'inherit' });
}

// 평문이 없거나 유효하지 않으면 잘못된 JSON을 조용히 발행하지 않아야 한다.
const plainPath = join(source, 'plain.md');
const plain = await readFile(plainPath, 'utf8');
const plainLine = `seo_plain_description: ${yaml('Alpha & beta')}`;
assert.ok(plain.includes(plainLine), '평문 입력 변조 위치가 필요합니다');
for (const [name, replacement, expected] of [
  ['missing', '', /ERROR_seo_plain_description_required_for_page/],
  ['null', 'seo_plain_description: null', /ERROR_seo_plain_description_required_for_page/],
  ['number', 'seo_plain_description: 123', /ERROR_seo_plain_description_must_be_nonempty_string/],
  ['empty', 'seo_plain_description: ""', /ERROR_seo_plain_description_must_be_nonempty_string/],
  ['unicode-space', `seo_plain_description: ${yaml('\u00a0\u3000')}`, /ERROR_seo_plain_description_must_be_nonempty_string/],
]) {
  await writeFile(plainPath, plain.replace(plainLine, replacement));
  const bad = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', join(fixture, `bad-${name}`)], { cwd: repository, env, encoding: 'utf8' });
  assert.ifError(bad.error);
  assert.notEqual(bad.status, 0, `${name}: 유효하지 않은 평문은 빌드 실패가 필요합니다`);
  assert.match(`${bad.stdout}\n${bad.stderr}`, expected, `${name}: 정확한 실패 이유가 필요합니다`);
}
await writeFile(plainPath, plain);

// 작성자의 평문이 잘못됐을 때 Liquid만으로 의미를 알 수 없으므로 원본 대조가 검출해야 한다.
await writeFile(plainPath, plain.replace(plainLine, `seo_plain_description: ${yaml('잘못된 평문')}`));
const wrongOutput = join(fixture, 'wrong-plain');
const wrongBuild = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', wrongOutput], { cwd: repository, env, encoding: 'utf8' });
assert.ifError(wrongBuild.error);
assert.equal(wrongBuild.status, 0, `오기재 검증용 빌드 실패\n${wrongBuild.stderr}`);
const wrongCheck = spawnSync(process.execPath, ['--test', '--test-name-pattern=^일반 페이지:', integration], {
  cwd: repository, env: { ...env, SEO_DESCRIPTION_FIXTURE_ROOT: fixture, SITE_ROOT: wrongOutput }, encoding: 'utf8',
});
assert.ifError(wrongCheck.error);
assert.equal(wrongCheck.status, 1, '원본과 다른 평문은 생성물 검사에서 실패해야 합니다');
assert.match(wrongCheck.stdout, /설명이 원문과 다릅니다/, '평문 오기재를 정확히 검출해야 합니다');
await writeFile(plainPath, plain);

// 플러그인 출력 형식의 누락·중복은 해당 보정이 적용될 때 빌드가 중단돼야 한다.
const includePath = join(source, '_includes/seo-description.html');
const include = await readFile(includePath, 'utf8');
const injectionPoint = '{%- assign count_source = description_seo_source | prepend: \'x\' | append: \'x\' -%}';
assert.ok(include.includes(injectionPoint), '플러그인 출력 변조 위치가 필요합니다');
for (const [name, operation] of [
  ['missing-description', `replace: '<meta name="description" content="', '<meta name="other" content="'`],
  ['duplicate-description', `append: '<meta name="description" content="다름" />'`],
  ['duplicate-json', `append: '<script type="application/ld+json">{}</script>'`],
  ['preceding-json-description', `replace_first: '"@context":', '"description":"다름","@context":'`],
]) {
  await writeFile(includePath, include.replace(injectionPoint, `{%- assign description_seo_source = description_seo_source | ${operation} -%}\n${injectionPoint}`));
  const bad = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', join(fixture, `bad-${name}`)], { cwd: repository, env, encoding: 'utf8' });
  assert.ifError(bad.error);
  assert.notEqual(bad.status, 0, `${name}: 플러그인 출력이 다르면 빌드 실패가 필요합니다`);
  assert.match(`${bad.stdout}\n${bad.stderr}`, /ERROR_seo_description_plugin_output_mismatch/, `${name}: 정확한 실패 이유가 필요합니다`);
}
await writeFile(includePath, include);
});
console.log(`일반 문서 SEO 설명 격리 빌드 검증 통과`);
