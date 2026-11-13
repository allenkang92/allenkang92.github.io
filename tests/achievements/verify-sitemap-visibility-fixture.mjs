// 실제 생성 여부와 사이트맵을 독립적으로 비교하는 격리 빌드다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { withTemporaryDirectory } from '../helpers/temporary-directory.mjs';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
await withTemporaryDirectory('sitemap-visibility-fixture-', async (temp) => {
const source = join(temp, 'source');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });

const change = async (path, transform) => {
  const original = await readFile(path, 'utf8');
  const updated = transform(original);
  assert.notEqual(updated, original, `${path}: 시험 자료가 적용되어야 합니다`);
  await writeFile(path, updated);
};
const achievement = slug => join(source, '_achievements', `${slug}.md`);
await change(achievement('leadership'), text => text.replace(/^date:.*$/m, 'date: 2099-01-01'));
await change(achievement('publications'), text => text.replace(/^---\r?\n/, '$&published: false\n'));
await change(achievement('education'), text => text.replace(/^---\r?\n/, '$&permalink: /sample/index.html/deep/index.html\nlast_modified_at: 2026-01-15 12:34:56 +0900\n'));
await change(achievement('awards'), text => text.replace(/^---\r?\n/, '$&sitemap: false\n'));
await writeFile(achievement('nullable-fixture'), '---\nlayout: achievement\ntitle: Nullable\npublished: null\ndate: 2020-01-01\n---\n본문\n');
await writeFile(achievement('untitled-fixture'), '---\nlayout: achievement\ntitle: ""\npermalink: /sample/titleless/\ndate: 2020-01-01\n---\n본문\n');
await writeFile(achievement('json-fixture'), '---\nlayout: null\ntitle: Machine Data\npermalink: /sample/data.json\ndate: 2020-01-01\n---\n{}\n');

const config = join(source, '_config.yml');
await change(config, text => text.replace(/^collections:\s*$/m, '$&\n  hidden_items: {}\n  public_items:\n    output: true'));
await mkdir(join(source, '_hidden_items'), { recursive: true });
await mkdir(join(source, '_public_items'), { recursive: true });
await writeFile(join(source, '_hidden_items/hidden.md'), '---\ntitle: Hidden\npermalink: /sample/hidden/\ndate: 2020-01-01\n---\n본문\n');
await writeFile(join(source, '_public_items/nested.md'), '---\ntitle: Public\npermalink: /other/index.html/deep/index.html\nlast_modified_at: 2025-01-01 00:00:00 +0900\ndate: 2020-01-01\n---\n본문\n');
await writeFile(join(source, '_pages/sitemap-nested.md'), '---\nlayout: null\ntitle: Page\npermalink: /page/index.html/deep/index.html\nlast_modified_at: 2025-02-01 00:00:00 +0900\n---\n본문\n');
await mkdir(join(source, 'assets/sitemap-probe/index.html/deep'), { recursive: true });
await writeFile(join(source, 'assets/sitemap-probe/index.html/deep/index.html'), '<!doctype html><title>fixture</title>');
// 정적 파일 경로는 이미 URL로 인코딩된 permalink가 아니라 리터럴 파일명이다.
const staticSegments = ['assets', 'sitemap 한글+%', '보고서 #질문?100%23 + &.pdf'];
await mkdir(join(source, ...staticSegments.slice(0, -1)), { recursive: true });
await writeFile(join(source, ...staticSegments), 'sitemap static fixture');
const expectedStaticPath = `/${staticSegments.join('/')}`;
// 서로 다른 접두사로 두 표기 파일을 만들고 실제 디렉터리 항목의 바이트를 사용한다.
const unicodeDirectory = join(source, 'assets/sitemap-unicode');
await mkdir(unicodeDirectory, { recursive: true });
await writeFile(join(unicodeDirectory, 'nfc-가.pdf'), 'nfc');
await writeFile(join(unicodeDirectory, 'nfd-가.pdf'.normalize('NFD')), 'nfd');
const pairNfc = 'pair-가.pdf';
const pairNfd = pairNfc.normalize('NFD');
await writeFile(join(unicodeDirectory, pairNfc), 'pair-nfc', { flag: 'wx' });
let distinctNormalizationNames = true;
try { await writeFile(join(unicodeDirectory, pairNfd), 'pair-nfd', { flag: 'wx' }); }
catch (error) {
  if (error.code !== 'EEXIST') throw error;
  distinctNormalizationNames = false;
}
const unicodeNames = await readdir(unicodeDirectory);
assert.ok(unicodeNames.some(name => name.startsWith('nfd-') && name !== name.normalize('NFC')), 'NFD 정적 파일 항목을 보존해야 합니다');
assert.equal(unicodeNames.filter(name => name.startsWith('pair-')).length, distinctNormalizationNames ? 2 : 1);
if (!distinctNormalizationNames) console.log('파일시스템이 같은 이름의 NFC/NFD 표기를 구분하지 않아 공존 사례는 검증할 수 없습니다.');

const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'production', TZ: 'UTC' };
const bundle = process.env.BUNDLE_BIN || 'bundle';
const origin = 'https://allenkang92.github.io';
const readSitemap = async output => {
  const browser = new Window();
  try {
    const xml = new browser.DOMParser().parseFromString(await readFile(join(output, 'sitemap.xml'), 'utf8'), 'text/xml');
    assert.equal(xml.querySelector('parsererror'), null, '사이트맵은 유효한 XML이어야 합니다');
    const rows = [...xml.querySelectorAll('url')].map(item => [item.querySelector('loc')?.textContent, item.querySelector('lastmod')?.textContent || null]);
    assert.equal(new Set(rows.map(([url]) => url)).size, rows.length, '사이트맵 URL은 중복되지 않아야 합니다');
    return new Map(rows);
  } finally { await browser.happyDOM.abort(); }
};
const cases = [
  ['normal', '', [], false, false],
  ['base', '/blog', [], false, false],
  ['future', '', ['--future'], true, false],
  ['unpublished', '', ['--unpublished'], false, true],
  ['all', '/blog', ['--future', '--unpublished'], true, true],
];
for (const [name, base, flags, future, unpublished] of cases) {
  const output = join(temp, name);
  execFileSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', output, '--baseurl', base, ...flags], { cwd: repository, env, stdio: 'inherit' });
  const rows = await readSitemap(output);
  const loc = path => `${origin}${base}${path}`;
  assert.equal(rows.has(loc('/achievements/leadership/')), future, `${name}: 미래 문서 게시 상태`);
  assert.equal(rows.has(loc('/achievements/publications/')), unpublished, `${name}: 미발행 문서 게시 상태`);
  assert.equal(rows.has(loc('/achievements/nullable-fixture/')), unpublished, `${name}: null published는 미발행과 같이 처리`);
  assert.equal(rows.has(loc('/achievements/awards/')), false, `${name}: sitemap:false 제외`);
  assert.equal(rows.has(loc('/sample/hidden/')), false, `${name}: output 미설정 컬렉션 제외`);
  assert.equal(rows.has(loc('/sample/titleless/')), true, `${name}: 실제 출력되는 무제목 성과 유지`);
  assert.equal(rows.has(loc('/sample/data.json')), true, `${name}: 실제 출력되는 비HTML 성과 유지`);
  assert.equal(rows.get(loc('/sample/index.html/deep/')), '2026-01-15T12:34:56+09:00', `${name}: 성과 경로 중간 index.html과 수정일 보존`);
  assert.equal(rows.get(loc('/other/index.html/deep/')), '2025-01-01T00:00:00+09:00', `${name}: 비성과 컬렉션 경로와 수정일 보존`);
  assert.equal(rows.get(loc('/page/index.html/deep/')), '2025-02-01T00:00:00+09:00', `${name}: 일반 페이지 경로와 수정일 보존`);
  assert.ok(rows.has(loc('/assets/sitemap-probe/index.html/deep/')), `${name}: 정적 파일의 중간 index.html 보존`);
  const staticUrls = [...rows.keys()].map(url => new URL(url)).filter(url => {
    try { return decodeURIComponent(url.pathname) === `${base}${expectedStaticPath}`; }
    catch { return false; }
  });
  assert.equal(staticUrls.length, 1, `${name}: 정적 파일명과 일치하는 사이트맵 URL은 하나여야 합니다`);
  assert.equal(staticUrls[0].search, '', `${name}: 파일명의 물음표는 쿼리로 해석되지 않아야 합니다`);
  assert.equal(staticUrls[0].hash, '', `${name}: 파일명의 #은 문단 식별자로 해석되지 않아야 합니다`);
  await access(join(output, ...staticSegments));
  for (const filename of unicodeNames) {
    const path = `/assets/sitemap-unicode/${encodeURIComponent(filename)}`;
    assert.ok(rows.has(loc(path)), `${name}: 실제 정적 파일의 유니코드 바이트를 보존해야 합니다: ${JSON.stringify(filename)}`);
    await access(join(output, 'assets/sitemap-unicode', filename));
  }
  assert.ok(rows.has(loc(encodeURI('/posts/기업재난관리사-합격후기/'))), `${name}: 기존 글 주소 유지`);
  await access(join(output, 'sample/index.html/deep/index.html'));
  await access(join(output, 'other/index.html/deep/index.html'));
  await access(join(output, 'page/index.html/deep/index.html'));
  await access(join(output, 'assets/sitemap-probe/index.html/deep/index.html'));
}

await change(config, text => text.replace(/(^\s*achievements:\s*\n\s*output:)\s*true/m, '$1 false'));
const noOutput = join(temp, 'no-output');
execFileSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', noOutput], { cwd: repository, env, stdio: 'inherit' });
const noOutputRows = await readSitemap(noOutput);
assert.equal(noOutputRows.has(`${origin}/sample/index.html/deep/`), false, 'output:false는 성과 상세를 제외합니다');
assert.equal(noOutputRows.has(`${origin}/sample/titleless/`), false, 'output:false는 제목 없는 성과도 제외합니다');
assert.ok(noOutputRows.has(`${origin}/other/index.html/deep/`), '다른 컬렉션은 유지합니다');
});
console.log(`사이트맵 노출 격리 검증 통과`);
