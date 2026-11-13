// 확인된 성과 수정일을 격리 복제본에만 주입해 실제 Jekyll 출력과 검사 경로를 재현한다.
// 환경에 맞는 BUNDLE_GEMFILE과 선택적 BUNDLE_BIN을 설정한 뒤 실행한다.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { applyFixtureDate } from './fixture-frontmatter.mjs';
import { Window } from 'happy-dom';

const repository = resolve('.');
// macOS의 /var는 /private/var로 연결되어 Jekyll safe mode가 경로를 거부할 수 있다.
const temp = await realpath(await mkdtemp(join(tmpdir(), 'achievement-date-fixture-')));
const source = join(temp, 'source');
const output = join(temp, 'site');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });
const education = join(source, '_achievements/education.md');
const original = await readFile(education, 'utf8');
const override = (await readFile(join(repository, 'tests/seo/fixtures/explicit-modified.yml'), 'utf8')).trim();
await writeFile(education, applyFixtureDate(original, override));
const env = {
  ...process.env,
  BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'),
  JEKYLL_ENV: 'production',
  TZ: 'UTC',
};
const bundle = process.env.BUNDLE_BIN || 'bundle';
execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', output], { cwd: repository, env, stdio: 'inherit' });
const generated = await readFile(join(output, 'achievements/education/index.html'), 'utf8');
assert.match(generated, /"dateModified":"2026-01-15T12:34:56\+09:00"/);
assert.doesNotMatch(generated, /article:published_time|article:modified_time|"datePublished"/);
execFileSync(process.execPath, ['--test', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: output, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  stdio: 'inherit',
});
// 명시적으로 지정한 Bundler가 실패하면 평문이라도 예외를 감추지 않는다.
const failedBundle = spawnSync(process.execPath, ['--test', '--test-name-pattern=성과 검색·공유 메타데이터', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, BUNDLE_BIN: join(temp, 'no-such-bundle'), SITE_ROOT: output, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(failedBundle.error);
assert.equal(failedBundle.status, 1, '명시적인 Bundler 오류는 평문 폴백으로 숨기지 않는다');
assert.match(failedBundle.stdout, /Markdown 메타데이터 검증에는 이 사이트의 Bundler\/Jekyll 환경이 필요합니다/);

// 실제 저장소에는 없는 설정을 격리 사본에만 추가해 원본 경로를 검증한다.
const configPath = join(source, '_config.yml');
const isolatedConfig = await readFile(configPath, 'utf8');
const isolatedEducation = await readFile(education, 'utf8');
assert.doesNotMatch(isolatedConfig, /^seo:/m, '격리 시험 전 site.seo가 없어야 합니다');
assert.doesNotMatch(isolatedEducation, /^image:/m, '격리 시험 전 page.image가 없어야 합니다');
await writeFile(configPath, `${isolatedConfig}\nseo: {}\n`);
await writeFile(education, isolatedEducation.replace(/^---\r?\n/, match => `${match}image: /fixture.png\n`));
const unsupported = spawnSync(process.execPath, ['--test', '--test-name-pattern=성과 SEO가 지원하지 않는 새로운 설정', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: output, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(unsupported.error);
assert.equal(unsupported.status, 1, `격리 사본의 미지원 설정은 검사가 실패해야 합니다: ${unsupported.stderr}`);
assert.match(unsupported.stdout, /site\.seo/);
assert.match(unsupported.stdout, /_achievements\/education\.md: image/);
await writeFile(configPath, isolatedConfig);
await writeFile(education, isolatedEducation);

// 지원하지 않는 변환기 설정은 생성 방식에 따른 차이를 추측하지 않는다.
assert.match(isolatedConfig, /^markdown:\s*kramdown\s*$/m);
await writeFile(configPath, isolatedConfig.replace(/^markdown:\s*kramdown\s*$/m, 'markdown: gfm'));
const differentProcessor = spawnSync(process.execPath, ['--test', '--test-name-pattern=성과 검색·공유 메타데이터', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: output, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(differentProcessor.error);
assert.equal(differentProcessor.status, 1, '다른 Markdown 변환기는 재검토해야 한다');
assert.match(differentProcessor.stdout, /Kramdown 이외의 Markdown 설정은 생성기별 기대값 재검토가 필요합니다/);
await writeFile(configPath, isolatedConfig);

// SEO의 Markdown 변환을 별도의 고정 기대값으로 확인한다.
const markdownTitle = '**Re\u0301search** and [Practice](https://example.org)';
const markdownDescription = 'Notes\u00a0on **research**';
let markdownEducation = isolatedEducation.replace(/^title:.*$/m, () => `title: ${JSON.stringify(markdownTitle)}`);
const markdownDescriptionLine = `description: ${JSON.stringify(markdownDescription)}`;
markdownEducation = /^description:.*$/m.test(markdownEducation)
  ? markdownEducation.replace(/^description:.*$/m, () => markdownDescriptionLine)
  : markdownEducation.replace(/^---\r?\n/, match => `${match}${markdownDescriptionLine}\n`);
assert.notEqual(markdownEducation, isolatedEducation, 'Markdown 시험 자료가 적용되어야 한다');
await writeFile(education, markdownEducation);
const markdownOutput = join(temp, 'markdown-content');
execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', markdownOutput], { cwd: repository, env, stdio: 'inherit' });
const markdownBrowser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
try {
  markdownBrowser.document.write(await readFile(join(markdownOutput, 'achievements/education/index.html'), 'utf8'));
  const doc = markdownBrowser.document;
  const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent);
  assert.equal(doc.querySelector('meta[property="og:title"]')?.getAttribute('content'), 'Re\u0301search and Practice');
  assert.equal(ld.headline, 'Re\u0301search and Practice');
  assert.equal(doc.querySelector('meta[property="og:description"]')?.getAttribute('content'), 'Notes\u00a0on research');
  assert.equal(ld.description, 'Notes\u00a0on research');
} finally { await markdownBrowser.happyDOM.abort(); }
// 생성물을 수정하지 않은 채 실제 통합 검사를 실행해 Markdown 원문을
// 렌더된 평문과 직접 비교하던 오탐을 회귀 방지한다.
execFileSync(process.execPath, ['--test', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: markdownOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  stdio: 'inherit',
});
// 서로 같은 NFC 문자로 바뀌더라도 NFD 원본과의 차이를 놓치지 않는다.
const markdownFile = join(markdownOutput, 'achievements/education/index.html');
const markdownHtml = await readFile(markdownFile, 'utf8');
const wrongNormalization = markdownHtml
  .replace('property="og:title" content="Re\u0301search and Practice"', 'property="og:title" content="Résearch and Practice"')
  .replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_, open, text, close) => {
    const data = JSON.parse(text);
    data.headline = 'Résearch and Practice';
    return `${open}${JSON.stringify(data)}${close}`;
  });
assert.notEqual(wrongNormalization, markdownHtml, 'NFC 변조를 주입해야 한다');
await writeFile(markdownFile, wrongNormalization);
const wrongNormalizationResult = spawnSync(process.execPath, ['--test', '--test-name-pattern=성과 검색·공유 메타데이터|성과 JSON-LD 제목', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: markdownOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(wrongNormalizationResult.error);
assert.equal(wrongNormalizationResult.status, 1, 'NFD와 NFC가 달라지면 원본 비교가 실패해야 한다');
assert.match(wrongNormalizationResult.stdout, /# fail 1\b/);
assert.match(wrongNormalizationResult.stdout, /# pass 1\b/);
await writeFile(markdownFile, markdownHtml);
// 변환기를 사용할 수 없을 때 Markdown을 평문이라고 추측하지 않는다.
const missingMarkdown = spawnSync(process.execPath, ['--test', '--test-name-pattern=성과 검색·공유 메타데이터', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, BUNDLE_BIN: join(temp, 'no-such-bundle'), SITE_ROOT: markdownOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(missingMarkdown.error);
assert.equal(missingMarkdown.status, 1, 'Markdown 변환기가 없으면 검사를 건너뛰거나 통과시키지 않는다');
assert.match(missingMarkdown.stdout, /Markdown 메타데이터 검증에는 이 사이트의 Bundler\/Jekyll 환경이 필요합니다/);
await writeFile(education, isolatedEducation);

// 페이지 locale, 사이트 locale, 페이지 lang, 사이트 lang 순서를 실제 빌드로 확인한다.
const localeLeadership = join(source, '_achievements/leadership.md');
const localeLeadershipOriginal = await readFile(localeLeadership, 'utf8');
await writeFile(education, isolatedEducation.replace(/^---\r?\n/, match => `${match}lang: ja-JP\n`));
await writeFile(localeLeadership, localeLeadershipOriginal.replace(/^---\r?\n/, match => `${match}locale: en-GB\nlang: fr-FR\n`));
assert.doesNotMatch(isolatedConfig, /^locale:/m, '사이트 locale 시험을 위한 격리 설정이 필요하다');
for (const [suffix, siteLocale, expectedEducation] of [['page-lang', '', 'ja_JP'], ['site-locale', '\nlocale: de-DE\n', 'de_DE']]) {
  await writeFile(configPath, `${isolatedConfig}${siteLocale}`);
  const localeOutput = join(temp, `locale-${suffix}`);
  execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', localeOutput], { cwd: repository, env, stdio: 'inherit' });
  const localeBrowser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    localeBrowser.document.write(await readFile(join(localeOutput, 'achievements/education/index.html'), 'utf8'));
    assert.equal(localeBrowser.document.querySelector('meta[property="og:locale"]')?.getAttribute('content'), expectedEducation);
    localeBrowser.document.open();
    localeBrowser.document.write(await readFile(join(localeOutput, 'achievements/leadership/index.html'), 'utf8'));
    assert.equal(localeBrowser.document.querySelector('meta[property="og:locale"]')?.getAttribute('content'), 'en_GB');
  } finally { await localeBrowser.happyDOM.abort(); }
  execFileSync(process.execPath, ['--test', '--test-name-pattern=성과 검색·공유 메타데이터', 'tests/seo/achievements.integration.test.mjs'], {
    cwd: repository,
    env: { ...env, SITE_ROOT: localeOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
    stdio: 'inherit',
  });
}
await writeFile(configPath, isolatedConfig);
await writeFile(education, isolatedEducation);
await writeFile(localeLeadership, localeLeadershipOriginal);

// 격리된 빌드에서 문자 참조를 포함한 JSON-LD가 검출되는지 확인한다.
// 실제 저장소 자료는 변경하지 않는다.
let config = await readFile(configPath, 'utf8');
for (const [key, value] of [['title', 'New Research'], ['description', 'Research and useful tools'], ['author', 'Research Author']]) {
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  assert.match(config, pattern, `${key}: 격리 설정 위치 필요`);
  config = config.replace(pattern, () => `${key}: ${JSON.stringify(value)}`);
}
await writeFile(configPath, config);
let educationText = await readFile(education, 'utf8');
assert.match(educationText, /^title:.*$/m);
educationText = educationText.replace(/^title:.*$/m, () => `title: ${JSON.stringify('Education & Work')}`);
const educationDescription = `description: ${JSON.stringify('Education & hands-on notes')}`;
educationText = /^description:.*$/m.test(educationText)
  ? educationText.replace(/^description:.*$/m, () => educationDescription)
  : educationText.replace(/^---\r?\n/, match => `${match}${educationDescription}\n`);
await writeFile(education, educationText);
const noPlainTitle = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', join(temp, 'missing-plain-title')], { cwd: repository, env, encoding: 'utf8' });
assert.notEqual(noPlainTitle.status, 0, '문자 참조가 있는 제목에 평문이 없으면 빌드를 중단해야 한다');
assert.match(`${noPlainTitle.stdout}\n${noPlainTitle.stderr}`, /ERROR_achievement_seo_plain_title_required/);
educationText = educationText.replace(/^---\r?\n/, match => `${match}seo_plain_title: ${JSON.stringify('Education & Work')}\n`);
await writeFile(education, educationText);
const noPlainDescription = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', join(temp, 'missing-plain-description')], { cwd: repository, env, encoding: 'utf8' });
assert.notEqual(noPlainDescription.status, 0, '문자 참조가 있는 설명에 평문이 없으면 빌드를 중단해야 한다');
assert.match(`${noPlainDescription.stdout}\n${noPlainDescription.stderr}`, /ERROR_achievement_seo_plain_description_required/);
for (const [name, value] of [['empty', '"  "'], ['nonbreaking', '"\\u00a0"'], ['ideographic', '"\\u3000"'], ['number', '42'], ['boolean', 'false']]) {
  await writeFile(education, educationText.replace(/^seo_plain_title:.*$/m, () => `seo_plain_title: ${value}`));
  const invalid = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', join(temp, `invalid-plain-title-${name}`)], { cwd: repository, env, encoding: 'utf8' });
  assert.notEqual(invalid.status, 0, `${name}: 평문 제목은 비어 있지 않은 문자열이어야 한다`);
  assert.match(`${invalid.stdout}\n${invalid.stderr}`, /ERROR_achievement_seo_plain_title_must_be_nonempty_string/);
}
educationText = educationText.replace(/^---\r?\n/, match => `${match}seo_plain_description: ${JSON.stringify('Education & hands-on notes')}\n`);
await writeFile(education, educationText);
for (const [name, value] of [['empty', '"  "'], ['nonbreaking', '"\\u00a0"'], ['number', '42']]) {
  await writeFile(education, educationText.replace(/^seo_plain_description:.*$/m, () => `seo_plain_description: ${value}`));
  const invalid = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', join(temp, `invalid-plain-description-${name}`)], { cwd: repository, env, encoding: 'utf8' });
  assert.notEqual(invalid.status, 0, `${name}: 평문 설명은 비어 있지 않은 문자열이어야 한다`);
  assert.match(`${invalid.stdout}\n${invalid.stderr}`, /ERROR_achievement_seo_plain_description_must_be_nonempty_string/);
}
await writeFile(education, educationText);
const contentOutput = join(temp, 'content-changed');
execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', contentOutput], { cwd: repository, env, stdio: 'inherit' });
const changed = await readFile(join(contentOutput, 'achievements/education/index.html'), 'utf8');
assert.match(changed, /property="og:title" content="Education &amp; Work"/);
assert.match(changed, /name="description" content="Education &amp; hands-on notes"/);
const contentFile = join(contentOutput, 'achievements/education/index.html');
const structuredPattern = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
assert.match(changed, structuredPattern, '성과 JSON-LD가 필요합니다');
const actualStructured = JSON.parse(changed.match(structuredPattern)[2]);
assert.equal(actualStructured.headline, 'Education & Work', '실제 생성된 구조화 제목이 평문이어야 한다');
assert.equal(actualStructured.description, 'Education & hands-on notes', '실제 생성된 구조화 설명이 평문이어야 한다');
execFileSync(process.execPath, ['--test', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: contentOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  stdio: 'inherit',
});
// 작성자가 평문을 잘못 입력한 경우 실제 Markdown 원본과의 독립 대조가 잡는다.
await writeFile(education, educationText.replace(/^seo_plain_title:.*$/m, 'seo_plain_title: "잘못된 평문"'));
const incorrectPlainOutput = join(temp, 'incorrect-plain-title');
execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', incorrectPlainOutput], { cwd: repository, env, stdio: 'inherit' });
const incorrectPlain = spawnSync(process.execPath, ['--test', '--test-name-pattern=성과 검색·공유 메타데이터', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: incorrectPlainOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(incorrectPlain.error);
assert.equal(incorrectPlain.status, 1, '원본과 다른 평문은 생성물 검사가 실패해야 한다');
assert.match(incorrectPlain.stdout, /# fail 1\b/);
// 숫자·이름·중첩 문자 참조는 HTML에서 한 번 해석한 평문을 별도로 제공한다.
const complexTitle = 'Research &#38; &copy; &amp;amp; &lt;/script&gt; &#x2028;&#x2029;';
const complexPlainTitle = 'Research & © &amp; </script> \u2028\u2029';
const complexDescription = 'Notes **bold** &amp;amp; &#x26; &lt;/script&gt;';
const complexPlainDescription = 'Notes bold &amp; & </script>';
const yamlString = value => JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const complexEducation = educationText
  .replace(/^title:.*$/m, () => `title: ${JSON.stringify(complexTitle)}`)
  .replace(/^description:.*$/m, () => `description: ${JSON.stringify(complexDescription)}`)
  .replace(/^seo_plain_title:.*$/m, () => `seo_plain_title: ${yamlString(complexPlainTitle)}`)
  .replace(/^seo_plain_description:.*$/m, () => `seo_plain_description: ${JSON.stringify(complexPlainDescription)}`);
await writeFile(education, complexEducation);
const complexOutput = join(temp, 'complex-plain-content');
execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', complexOutput], { cwd: repository, env, stdio: 'inherit' });
const complexBrowser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
try {
  complexBrowser.document.write(await readFile(join(complexOutput, 'achievements/education/index.html'), 'utf8'));
  const doc = complexBrowser.document;
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  assert.equal(scripts.length, 1);
  assert.doesNotMatch(scripts[0].textContent, /<\s*\/\s*script/i, '평문에 포함된 종료 문자열로 스크립트가 끝나면 안 된다');
  assert.doesNotMatch(scripts[0].textContent, /[\u2028\u2029]/, 'JSON 스크립트의 특수 줄 구분자는 이스케이프해야 한다');
  const ld = JSON.parse(scripts[0].textContent);
  assert.equal(doc.querySelector('meta[property="og:title"]')?.getAttribute('content'), complexPlainTitle);
  assert.equal(doc.querySelector('meta[property="og:description"]')?.getAttribute('content'), complexPlainDescription);
  assert.equal(ld.headline, complexPlainTitle);
  assert.equal(ld.description, complexPlainDescription);
} finally { await complexBrowser.happyDOM.abort(); }
execFileSync(process.execPath, ['--test', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: complexOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  stdio: 'inherit',
});
await writeFile(education, educationText);
// 페이지 설명이 없을 때는 사이트 기본 설명의 평문을 공통으로 사용한다.
const inheritedConfig = config.replace(/^description:.*$/m, () => `description: ${JSON.stringify('Research & **Practice**')}`);
const inheritedEducation = educationText.replace(/^description:.*\n/m, '').replace(/^seo_plain_description:.*\n/m, '');
await writeFile(configPath, inheritedConfig);
await writeFile(education, inheritedEducation);
const missingSitePlain = spawnSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', join(temp, 'missing-site-plain')], { cwd: repository, env, encoding: 'utf8' });
assert.notEqual(missingSitePlain.status, 0, '상속된 사이트 설명에도 평문이 필요하다');
assert.match(`${missingSitePlain.stdout}\n${missingSitePlain.stderr}`, /ERROR_achievement_seo_plain_description_required/);
await writeFile(configPath, `${inheritedConfig}\nseo_plain_description: ${JSON.stringify('Research & Practice')}\n`);
const inheritedOutput = join(temp, 'inherited-plain-description');
execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', inheritedOutput], { cwd: repository, env, stdio: 'inherit' });
execFileSync(process.execPath, ['--test', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: inheritedOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  stdio: 'inherit',
});
await writeFile(configPath, config);
await writeFile(education, educationText);
const rewriteStructured = (html, headline, description) => html.replace(structuredPattern, (_, open, text, close) => {
  const data = JSON.parse(text);
  data.headline = headline;
  data.description = description;
  return `${open}${JSON.stringify(data)}${close}`;
});
// 잘못된 출력을 고정 주입해 향후 실제 구현이 수정돼도 부정 검증을 유지한다.
await writeFile(contentFile, rewriteStructured(changed, 'Education &amp; Work', 'Education &amp; hands-on notes'));
const negative = spawnSync(process.execPath, ['--test', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: contentOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(negative.error);
assert.equal(negative.status, 1, `잘못된 JSON-LD는 테스트가 실패해야 합니다: ${negative.stderr}`);
assert.match(negative.stdout, /education: JSON-LD 제목과 OG 제목 불일치/);
assert.match(negative.stdout, /education: JSON-LD 설명과 OG 설명 불일치/);
assert.match(negative.stdout, /# fail 3\b/, '원본 비교와 지정한 두 일치 검증이 실패해야 합니다');
// 같은 생성물에서 값만 바로잡았을 때 전체 검증이 통과해야 한다.
await writeFile(contentFile, rewriteStructured(changed, 'Education & Work', 'Education & hands-on notes'));
execFileSync(process.execPath, ['--test', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: contentOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  stdio: 'inherit',
});

// OG와 JSON-LD가 같은 문자 참조를 잘못 내더라도 원본 비교가 검출해야 한다.
const wrongTitle = 'Education &amp; Work';
const bothWrong = rewriteStructured(changed, wrongTitle, 'Education & hands-on notes')
  .replace('property="og:title" content="Education &amp; Work"', 'property="og:title" content="Education &amp;amp; Work"');
assert.notEqual(bothWrong, changed, '서로 같은 잘못된 제목을 주입해야 한다');
await writeFile(contentFile, bothWrong);
const bothWrongResult = spawnSync(process.execPath, ['--test', '--test-name-pattern=성과 검색·공유 메타데이터|성과 JSON-LD 제목', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: contentOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(bothWrongResult.error);
assert.equal(bothWrongResult.status, 1, '같은 잘못된 제목도 원본 비교가 실패해야 한다');
assert.match(bothWrongResult.stdout, /# fail 1\b/);
assert.match(bothWrongResult.stdout, /# pass 1\b/);

// 표시·구조화 설명이 모두 일반 공백 대신 NBSP를 내더라도 원본과 비교해 잡는다.
const wrongSpace = 'Education &\u00a0hands-on notes';
const bothWrongSpace = rewriteStructured(changed, 'Education & Work', wrongSpace)
  .replace('property="og:description" content="Education &amp; hands-on notes"',
    'property="og:description" content="Education &amp;\u00a0hands-on notes"');
assert.notEqual(bothWrongSpace, changed, '설명에 잘못된 NBSP를 주입해야 한다');
await writeFile(contentFile, bothWrongSpace);
const wrongSpaceResult = spawnSync(process.execPath, ['--test', '--test-name-pattern=성과 검색·공유 메타데이터|성과 JSON-LD 설명', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: contentOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(wrongSpaceResult.error);
assert.equal(wrongSpaceResult.status, 1, '서로 같은 잘못된 NBSP도 원본 비교가 실패해야 한다');
assert.match(wrongSpaceResult.stdout, /# fail 1\b/);
assert.match(wrongSpaceResult.stdout, /# pass 1\b/);

// 스마트 따옴표가 ASCII 따옴표로 바뀌면 제목과 사이트 이름이 함께 변해도 잡는다.
const smartQuoteWrong = generated
  .replace('<title>Education | Allen’s Blog</title>', "<title>Education | Allen's Blog</title>")
  .replace('property="og:site_name" content="Allen’s Blog"', 'property="og:site_name" content="Allen\'s Blog"');
assert.notEqual(smartQuoteWrong, generated, '스마트 따옴표 변조를 주입해야 한다');
const generatedFile = join(output, 'achievements/education/index.html');
await writeFile(configPath, isolatedConfig);
await writeFile(education, isolatedEducation);
await writeFile(generatedFile, smartQuoteWrong);
const wrongQuoteResult = spawnSync(process.execPath, ['--test', '--test-name-pattern=성과 검색·공유 메타데이터', 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: output, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(wrongQuoteResult.error);
assert.equal(wrongQuoteResult.status, 1, '스마트 따옴표가 달라지면 검사가 실패해야 한다');
assert.match(wrongQuoteResult.stdout, /# fail 1\b/);
assert.match(wrongQuoteResult.stdout, /Allen.s Blog/);
await writeFile(generatedFile, generated);
await writeFile(configPath, config);
await writeFile(education, educationText);

// 저자·게시자의 문자 참조 차이도 재해독하지 않고 잡아야 한다.
const authorMeta = 'name="author" content="Research Author"';
assert.ok(changed.includes(authorMeta), '격리 저자 메타데이터 필요');
const withSpecialAuthor = changed.replace(authorMeta, 'name="author" content="Research &amp; Author"');
const rewriteAuthors = (html, value) => html.replace(structuredPattern, (_, open, text, close) => {
  const data = JSON.parse(text);
  assert.ok(data.author && data.publisher, '격리 저자와 게시자 구조화 데이터 필요');
  data.author.name = value;
  data.publisher.name = value;
  return `${open}${JSON.stringify(data)}${close}`;
});
await writeFile(contentFile, rewriteAuthors(withSpecialAuthor, 'Research &amp; Author'));
const authorPattern = '--test-name-pattern=성과 JSON-LD (저자|게시자) 이름';
const badAuthors = spawnSync(process.execPath, ['--test', authorPattern, 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: contentOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  encoding: 'utf8',
});
assert.ifError(badAuthors.error);
assert.equal(badAuthors.status, 1, '잘못된 저자·게시자 이름은 검사가 실패해야 한다');
assert.match(badAuthors.stdout, /education: JSON-LD 저자 이름과 HTML 저자 이름 불일치/);
assert.match(badAuthors.stdout, /education: JSON-LD 게시자 이름과 HTML 저자 이름 불일치/);
assert.match(badAuthors.stdout, /# fail 2\b/);
await writeFile(contentFile, rewriteAuthors(withSpecialAuthor, 'Research & Author'));
execFileSync(process.execPath, ['--test', authorPattern, 'tests/seo/achievements.integration.test.mjs'], {
  cwd: repository,
  env: { ...env, SITE_ROOT: contentOutput, SITE_BASEURL: '', SEO_SOURCE_ROOT: source, BASELINE_SITE_ROOT: '' },
  stdio: 'inherit',
});

// 명시 canonical은 경로·쿼리를 포함해 SEO 플러그인의 출력을 그대로 따라야 한다.
// 각 항목은 실제 자료가 아니라 임시 복제본에만 적용한다.
const cases = [
  ['education', 'https://example.org/index.html?topic=physics&from=blog'],
  ['leadership', '/canonical/index.html?section=alpha'],
];
for (const [slug, canonical] of cases) {
  const path = join(source, `_achievements/${slug}.md`);
  const text = await readFile(path, 'utf8');
  const quoted = `canonical_url: ${JSON.stringify(canonical)}`;
  const updated = /^canonical_url:.*$/m.test(text)
    ? text.replace(/^canonical_url:.*$/m, () => quoted)
    : text.replace(/^---\r?\n/, match => `${match}${quoted}\n`);
  assert.notEqual(updated, text, `${slug}: 격리 canonical 설정 필요`);
  await writeFile(path, updated);
}
// 자동 생성 URL은 맨 끝 index.html만 정규화하고 중간 경로는 보존한다.
const automaticPath = join(source, '_achievements/awards.md');
const automaticOriginal = await readFile(automaticPath, 'utf8');
const automaticPermalink = 'permalink: /sample/index.html/deep/index.html';
const automaticFixture = /^permalink:.*$/m.test(automaticOriginal)
  ? automaticOriginal.replace(/^permalink:.*$/m, () => automaticPermalink)
  : automaticOriginal.replace(/^---\r?\n/, match => `${match}${automaticPermalink}\n`);
assert.notEqual(automaticFixture, automaticOriginal, '자동 URL 시험 경로 설정 필요');
await writeFile(automaticPath, automaticFixture);
const customOutput = join(temp, 'canonical-custom');
const defaultOutput = join(temp, 'canonical-plugin');
const build = destination => execFileSync(bundle, ['exec', 'github-pages', 'build', '--source', source, '--destination', destination], { cwd: repository, env, stdio: 'inherit' });
build(customOutput);
const headPath = join(source, '_includes/head.html');
const head = await readFile(headPath, 'utf8');
// 내부에 중첩된 Liquid 조건이 있어 첫 endif를 블록의 끝으로 해석하면 안 된다.
// feed_meta 직전까지를 교체해 표준 플러그인의 전체 출력과 비교한다.
const seoStartMarker = "{% if page.collection == 'achievements' %}";
const feedMarker = '{% feed_meta %}';
const seoStart = head.indexOf(seoStartMarker);
const feedStart = head.indexOf(feedMarker);
assert.ok(seoStart >= 0 && feedStart > seoStart, '표준 플러그인과 비교할 SEO 구간과 feed_meta가 필요합니다');
assert.equal(head.indexOf(seoStartMarker, seoStart + seoStartMarker.length), -1, 'SEO 시작 표식은 하나여야 합니다');
assert.equal(head.indexOf(feedMarker, feedStart + feedMarker.length), -1, 'feed_meta 표식은 하나여야 합니다');
const seoBlock = head.slice(seoStart, feedStart);
assert.match(seoBlock, /{%\s*include achievement-seo\.html\s*%}/, '성과 SEO 출력 경로가 필요합니다');
assert.match(seoBlock, /{%\s*seo\s*%}/, '표준 SEO 출력 경로가 필요합니다');
await writeFile(headPath, `${head.slice(0, seoStart)}{% seo %}\n    ${head.slice(feedStart)}`);
build(defaultOutput);
const readMetadata = async (path, outputFile) => {
  const browser = new Window();
  try {
    browser.document.write(await readFile(join(path, outputFile), 'utf8'));
    const document = browser.document;
    const json = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
    return [document.querySelector('link[rel="canonical"]').getAttribute('href'), document.querySelector('meta[property="og:url"]').getAttribute('content'), json.url, json['@id'] || json.mainEntityOfPage?.['@id']];
  } finally { await browser.happyDOM.abort(); }
};
for (const [slug, expected] of cases) {
  const outputFile = `achievements/${slug}/index.html`;
  const plugin = await readMetadata(defaultOutput, outputFile);
  assert.deepEqual(plugin, Array(4).fill(expected), `${slug}: 표준 SEO 출력 확인`);
  assert.deepEqual(await readMetadata(customOutput, outputFile), plugin, `${slug}: 명시 canonical 보존`);
}
const automaticFile = 'sample/index.html/deep/index.html';
const automaticExpected = 'https://allenkang92.github.io/sample/index.html/deep/';
const automaticPlugin = await readMetadata(defaultOutput, automaticFile);
assert.deepEqual(automaticPlugin, Array(4).fill(automaticExpected), '표준 SEO의 자동 URL 정규화 확인');
assert.deepEqual(await readMetadata(customOutput, automaticFile), automaticPlugin, '자동 URL의 마지막 부분만 정규화');
console.log(`성과 SEO 격리 검증 통과: ${temp}`);
