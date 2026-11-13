// 기본 Pages 플러그인의 이름 원천과 특수문자 직렬화를 격리 실빌드로 확인한다.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repository = resolve('.');
const fixture = await realpath(await mkdtemp(join(tmpdir(), 'seo-name-serialization-')));
const source = join(fixture, 'source');
await mkdir(join(source, '_layouts'), { recursive: true });
await mkdir(join(source, '_posts'), { recursive: true });
await cp(join(repository, '_includes'), join(source, '_includes'), { recursive: true });
const yaml = value => JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const htmlName = '입력 &#38; &#x26; &copy; &amp;amp; &lt;/script&gt;&lt;script&gt;실행금지&lt;/script&gt; "인용" 😀';
const siteName = '사이트 & 회사';
const socialName = '소셜 & **연구**';
const cases = [
  { id: '홈에서 소셜 이름 우선', file: 'index.html', source_name: socialName, expected: '소셜 & 연구' },
  { id: '소개 페이지에서 소셜 이름 우선', file: 'about/index.html', source_name: socialName, expected: '소셜 & 연구' },
  { id: '일반 페이지의 명시 이름 우선', file: 'custom/index.html', source_name: htmlName, expected: '입력 & & © &amp; </script><script>실행금지</script> “인용” 😀' },
  { id: '명시 이름이 소셜 이름보다 우선', file: 'explicit/index.html', source_name: '선택 & 이름', expected: '선택 & 이름' },
  { id: '저자·이미지와 같은 직렬화 이름', file: 'same-name/index.html', source_name: '작성자 & 팀', expected: '작성자 & 팀' },
  { id: '중첩 메타의 역슬래시 보존', file: 'backslash/index.html', source_name: '선택 & 이름', expected: '선택 & 이름', author: '작성자 C:\\data\\1\\n\\&' },
  { id: '제목·설명·이름 동시 보정의 역슬래시 보존', file: 'combined/index.html', source_name: '이름 & C:\\name\\1\\&', expected: '이름 & C:\\name\\1\\&', author: '작성자 C:\\data\\1\\n\\&', literal_title: '<제목> C:\\title\\1\\&', description: '설명 & C:\\desc\\1\\n\\&' },
];
const config = `title: ${yaml(siteName)}\nurl: https://example.org\nbaseurl: ""\nrepository: example/name-fixture\nmarkdown: kramdown\nauthor: ${yaml('작성자 &amp; 팀')}\nlogo: /logo.png\ndescription: 안전한 설명\nsocial:\n  name: ${yaml(socialName)}\nplugins:\n  - jekyll-feed\n  - jekyll-seo-tag\n`;
await writeFile(join(source, '_config.yml'), config);
await writeFile(join(source, '_layouts/default.html'), '<!doctype html><html lang="ko">{% include head.html %}<body><main>{{ content }}</main></body></html>');
const page = (extra = '') => `---\nlayout: default\ntitle: 테스트\n${extra}---\n\n본문\n`;
await writeFile(join(source, 'index.html'), page());
await writeFile(join(source, 'about.md'), page('permalink: /about/\n'));
await writeFile(join(source, 'plain.md'), page('permalink: /plain/\nseo:\n  name: false\n'));
await writeFile(join(source, 'custom.md'), page(`permalink: /custom/\nseo_plain_name: ${yaml('입력 & & © &amp; </script><script>실행금지</script> “인용” 😀')}\nseo:\n  name: ${yaml(htmlName)}\n`));
await writeFile(join(source, 'explicit.md'), page(`permalink: /explicit/\nseo_plain_name: ${yaml('선택 & 이름')}\nseo:\n  name: ${yaml('선택 & 이름')}\n`));
await writeFile(join(source, 'same-name.md'), page(`permalink: /same-name/\nseo_plain_name: ${yaml('작성자 & 팀')}\nseo:\n  name: ${yaml('작성자 & 팀')}\nimage:\n  path: /image.png\n  name: ${yaml('작성자 &amp; 팀')}\n`));
await writeFile(join(source, 'backslash.md'), page(`permalink: /backslash/\nauthor: ${yaml('작성자 C:\\data\\1\\n\\&')}\nseo_plain_name: ${yaml('선택 & 이름')}\nseo:\n  name: ${yaml('선택 & 이름')}\nimage:\n  path: /image.png\n  description: ${yaml('경로 C:\\data\\1\\n\\& 끝')}\n`));
await writeFile(join(source, '_posts/2020-01-01-combined.md'), `---\nlayout: default\ndate: 2020-01-01 00:00:00 +0900\npermalink: /combined/\ntitle: ${yaml('<제목> C:\\title\\1\\&')}\nseo_title_literal: true\ndescription: ${yaml('설명 & C:\\desc\\1\\n\\&')}\nseo_plain_description: ${yaml('설명 & C:\\desc\\1\\n\\&')}\nauthor: ${yaml('작성자 C:\\data\\1\\n\\&')}\nseo_plain_name: ${yaml('이름 & C:\\name\\1\\&')}\nseo:\n  name: ${yaml('이름 & C:\\name\\1\\&')}\nimage:\n  path: /image.png\n  description: ${yaml('경로 C:\\data\\1\\n\\& 끝')}\n---\n\n본문\n`);
const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'development', TZ: 'UTC' };
const bundle = process.env.BUNDLE_BIN || 'bundle';
const testFile = join(repository, 'tests/seo/name-serialization.integration.test.mjs');
const headPath = join(source, '_includes/head.html');
const originalHead = await readFile(headPath, 'utf8');
assert.ok(originalHead.includes('seo-name.html'), '실제 head에 이름 보정이 연결되어야 합니다');
const fixtureHead = originalHead;
for (const [name, base, mode] of [['root', '', 'social'], ['nested', '/blog', 'social'], ['site-title-fallback', '', 'title'], ['empty-social', '', 'empty'], ['false-page-name', '', 'false']]) {
  const output = join(fixture, name);
  const baseline = join(fixture, `${name}-baseline`);
  const selectedCases = mode === 'social' || mode === 'false' ? cases : cases.map(entry => entry.file === 'index.html' || entry.file === 'about/index.html'
    ? mode === 'title' ? { ...entry, id: `${entry.id}: 사이트 제목 대체`, source_name: siteName, expected: '사이트 & 회사' }
      : { ...entry, id: `${entry.id}: 빈 소셜 이름`, source_name: '', absent: true } : entry);
  await writeFile(join(fixture, 'cases.json'), JSON.stringify(selectedCases));
  const configured = mode === 'social' || mode === 'false' ? config : config.replace(`social:\n  name: ${yaml(socialName)}\n`, mode === 'title' ? '' : 'social:\n  name: ""\n');
  const sitePlain = mode === 'empty' ? '' : `seo_plain_name: ${yaml(mode === 'social' || mode === 'false' ? '소셜 & 연구' : '사이트 & 회사')}\n`;
  await writeFile(join(source, 'index.html'), page(mode === 'false' ? 'seo:\n  name: false\n' : ''));
  await writeFile(join(source, '_config.yml'), configured.replace('baseurl: ""', `baseurl: ${yaml(base)}`) + sitePlain);
  await writeFile(headPath, '<head><meta charset="utf-8">{% seo %}</head>');
  const before = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', baseline], { cwd: repository, env, encoding: 'utf8' });
  assert.ifError(before.error);
  assert.equal(before.status, 0, `${name}: 원본 플러그인 빌드 실패\n${before.stderr}`);
  await writeFile(headPath, fixtureHead);
  const built = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', output], { cwd: repository, env, encoding: 'utf8' });
  assert.ifError(built.error);
  assert.equal(built.status, 0, `${name}: 격리 Pages 빌드 실패\n${built.stderr}`);
  const result = spawnSync(process.execPath, ['--test', testFile], { cwd: repository, env: { ...env, SEO_NAME_FIXTURE_ROOT: fixture, SEO_NAME_BASELINE_ROOT: baseline, SITE_ROOT: output }, encoding: 'utf8' });
  assert.ifError(result.error);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) process.exitCode = 1;
}

// 필요한 평문이 누락되거나 이름이 없는 페이지에서 임의로 지정되면 빌드를 중단한다.
await writeFile(join(source, '_config.yml'), config + `seo_plain_name: ${yaml('소셜 & 연구')}\n`);
const customPath = join(source, 'custom.md');
const custom = await readFile(customPath, 'utf8');
const customPlain = `seo_plain_name: ${yaml('입력 & & © &amp; </script><script>실행금지</script> “인용” 😀')}`;
assert.ok(custom.includes(customPlain), '명시적 평문 시험 위치가 필요합니다');
for (const [name, replacement, error] of [
  ['missing-page', '', /ERROR_seo_plain_name_required/],
  ['null-page', 'seo_plain_name: null', /ERROR_seo_plain_name_required/],
  ['number-page', 'seo_plain_name: 17', /ERROR_seo_plain_name_must_be_nonempty_string/],
  ['empty-page', 'seo_plain_name: ""', /ERROR_seo_plain_name_must_be_nonempty_string/],
  ['unicode-space', `seo_plain_name: ${yaml('\u00a0\u3000')}`, /ERROR_seo_plain_name_must_be_nonempty_string/],
]) {
  await writeFile(customPath, custom.replace(customPlain, replacement));
  const built = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', join(fixture, `bad-${name}`)], { cwd: repository, env, encoding: 'utf8' });
  assert.ifError(built.error);
  assert.notEqual(built.status, 0, `${name}: 유효하지 않은 평문은 빌드 실패가 필요합니다`);
  assert.match(`${built.stdout}\n${built.stderr}`, error, `${name}: 실패 이유가 명확해야 합니다`);
}
await writeFile(customPath, custom);
const plainPath = join(source, 'plain.md');
const plain = await readFile(plainPath, 'utf8');
await writeFile(plainPath, plain.replace('permalink: /plain/\n', 'permalink: /plain/\nseo_plain_name: 임의 이름\n'));
const withoutSource = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', join(fixture, 'without-source')], { cwd: repository, env, encoding: 'utf8' });
assert.ifError(withoutSource.error);
assert.notEqual(withoutSource.status, 0, '이름 원천이 없는 페이지의 평문 설정은 실패해야 합니다');
assert.match(`${withoutSource.stdout}\n${withoutSource.stderr}`, /ERROR_seo_plain_name_without_source/);
await writeFile(plainPath, plain);
await writeFile(join(source, '_config.yml'), config);
const withoutSitePlain = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', join(fixture, 'without-site-plain')], { cwd: repository, env, encoding: 'utf8' });
assert.ifError(withoutSitePlain.error);
assert.notEqual(withoutSitePlain.status, 0, '사이트 이름의 평문이 누락되면 실패해야 합니다');
assert.match(`${withoutSitePlain.stdout}\n${withoutSitePlain.stderr}`, /ERROR_seo_plain_name_required/);

console.log(`이름 SEO 격리 결과: ${fixture}`);
