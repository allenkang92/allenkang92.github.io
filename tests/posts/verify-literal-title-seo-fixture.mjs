// 리터럴 제목 보정의 범위와 JSON 스크립트 안전성을 실제 Jekyll 빌드로 검증한다.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
const temp = await realpath(await mkdtemp(join(tmpdir(), 'literal-title-seo-fixture-')));
const source = join(temp, 'source');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });

const postPath = join(source, '_posts/2025-01-01-literal-seo-fixture.md');
const title = '<자격증> & "인용" 😀 &amp; **원문** \u2028 \u2029 </script><script>문자열</script>' + String.raw` \& \1 \\ 경로`;
const normalTitle = '**굵은** 제목';
// YAML의 실제 줄 구분자로 해석돼 양옆 공백이 접히지 않도록 이스케이프한다.
const yamlTitle = JSON.stringify(title).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const frontMatter = (special = '') => `---\nlayout: post\ntitle: ${yamlTitle}\ndate: 2025-01-01 00:00:00 +0900\nlast_modified_at: 2025-01-02 00:00:00 +0900\ndescription: SEO fixture description\npermalink: /posts/literal-seo-fixture/\n${special}---\n본문\n`;
await writeFile(postPath, frontMatter());
await writeFile(join(source, '_posts/2025-01-02-markdown-seo-fixture.md'), `---\nlayout: post\ntitle: ${JSON.stringify(normalTitle)}\ndate: 2025-01-02 00:00:00 +0900\npermalink: /posts/markdown-seo-fixture/\n---\n본문\n`);

const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'production', TZ: 'UTC' };
const bundle = process.env.BUNDLE_BIN || 'bundle';
const build = (name, base = '') => {
  const output = join(temp, name);
  execFileSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', output, '--baseurl', base], { cwd: repository, env, stdio: 'inherit' });
  return output;
};
const open = async (output, path) => {
  const html = await readFile(join(output, path), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const document = new browser.DOMParser().parseFromString(html, 'text/html');
  const nodes = [...document.querySelectorAll('script[type="application/ld+json"]')];
  assert.equal(nodes.length, 1, `${path}: JSON-LD는 하나여야 합니다`);
  const jsonText = nodes[0].textContent;
  return { browser, document, jsonText, json: JSON.parse(jsonText) };
};
const preservedMetadata = document => [...document.querySelectorAll('head meta, head link[rel="canonical"]')]
  .filter(node => !['og:title', 'twitter:title'].includes(node.getAttribute('property') || node.getAttribute('name')))
  .map(node => node.outerHTML);
const preservedJson = json => {
  const copy = structuredClone(json);
  delete copy.headline;
  return copy;
};

// 동일한 글을 보정 전후로 빌드해 제목 외 메타데이터를 비교한다.
const baselineOutput = build('baseline');
const baseline = await open(baselineOutput, 'posts/literal-seo-fixture/index.html');
const markdownBaseline = await open(baselineOutput, 'posts/markdown-seo-fixture/index.html');
const baselineMeta = preservedMetadata(baseline.document);
const baselineJson = preservedJson(baseline.json);
const markdownTitle = markdownBaseline.document.title;
const markdownMeta = preservedMetadata(markdownBaseline.document);
const markdownJson = markdownBaseline.json;
assert.equal(markdownBaseline.document.querySelector('meta[property="og:title"]')?.getAttribute('content'), '굵은 제목');
assert.equal(markdownBaseline.document.querySelector('h1.post-title')?.textContent, normalTitle);
await baseline.browser.happyDOM.abort();
await markdownBaseline.browser.happyDOM.abort();

await writeFile(postPath, frontMatter('seo_title_literal: true\n'));
for (const [name, base] of [['root', ''], ['nested', '/blog']]) {
  const output = build(name, base);
  const fixed = await open(output, 'posts/literal-seo-fixture/index.html');
  try {
    const { document, json, jsonText } = fixed;
    assert.equal(document.querySelector('h1.post-title')?.textContent, title, `${name}: 화면 제목 원문`);
    assert.ok(document.title.startsWith(`${title} | `), `${name}: 브라우저 제목 원문`);
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      assert.equal(document.querySelectorAll(selector).length, 1, `${name}: 제목 메타 중복 없음`);
      assert.equal(document.querySelector(selector)?.getAttribute('content'), title, `${name}: 공유 제목 원문`);
    }
    assert.equal(json.headline, title, `${name}: JSON-LD 제목 원문`);
    assert.doesNotMatch(jsonText, /<\s*\/\s*script/i, `${name}: 제목이 JSON 스크립트를 종료하지 않아야 합니다`);
    assert.ok(![...document.querySelectorAll('head script:not([type="application/ld+json"])')]
      .some(script => script.textContent.includes('문자열')), `${name}: 제목에서 스크립트가 새로 만들어지지 않아야 합니다`);
    if (!base) {
      assert.deepEqual(preservedMetadata(document), baselineMeta, '제목 이외의 기존 SEO 메타데이터 보존');
      assert.deepEqual(preservedJson(json), baselineJson, '제목 이외의 기존 JSON-LD 보존');
      const markdownFixed = await open(output, 'posts/markdown-seo-fixture/index.html');
      assert.equal(markdownFixed.document.title, markdownTitle, '옵트인하지 않은 Markdown 브라우저 제목 보존');
      assert.equal(markdownFixed.document.querySelector('meta[property="og:title"]')?.getAttribute('content'), '굵은 제목', '옵트인하지 않은 공유 제목 보존');
      assert.equal(markdownFixed.document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'), '굵은 제목', '옵트인하지 않은 Twitter 제목 보존');
      assert.deepEqual(preservedMetadata(markdownFixed.document), markdownMeta, '옵트인하지 않은 Markdown 메타데이터 보존');
      assert.deepEqual(markdownFixed.json, markdownJson, '옵트인하지 않은 Markdown JSON-LD 보존');
      await markdownFixed.browser.happyDOM.abort();
    }
  } finally { await fixed.browser.happyDOM.abort(); }
}

// 복합 제목 계약은 지원 전까지 조용히 잘못 출력하지 않고 빌드를 중단한다.
await writeFile(postPath, frontMatter('seo_title_literal: true\ntitle_category: 분류\n'));
const unsupported = spawnSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', join(temp, 'unsupported')], { cwd: repository, env, encoding: 'utf8' });
assert.notEqual(unsupported.status, 0, '리터럴 제목과 title_category 조합은 명시적인 검증 전 빌드에 실패해야 합니다');
assert.match(`${unsupported.stdout}\n${unsupported.stderr}`, /literal|Liquid|include/i, '실패 원인을 빌드 출력에서 확인할 수 있어야 합니다');

// 플러그인의 출력이 누락되거나 중복돼도 보정하지 않고 빌드를 중단해야 한다.
// 특히 끝에 중복 토큰이 붙은 경우 split이 마지막 빈 문자열을 버릴 수 있다.
await writeFile(postPath, frontMatter('seo_title_literal: true\n'));
const includePath = join(source, '_includes/post-literal-seo.html');
const originalInclude = await readFile(includePath, 'utf8');
const point = "{%- assign seo_for_count = original_seo | append: 'x' -%}";
assert.ok(originalInclude.includes(point), '플러그인 출력 변조 시험 위치가 필요합니다');
for (const [name, operation] of [
  ['missing-og', 'remove: plugin_og'],
  ['duplicate-og-at-end', 'append: plugin_og'],
  ['different-og-at-end', `append: '<meta property="og:title" content="다른 제목" />'`],
  ['different-headline-at-end', `append: '"headline":"다른 제목"'`],
  ['duplicate-json-at-end', `append: '<script type="application/ld+json">{}</script>'`],
]) {
  await writeFile(includePath, originalInclude.replace(point, `{%- assign original_seo = original_seo | ${operation} -%}\n${point}`));
  const result = spawnSync(bundle, ['exec', 'jekyll', 'build', '--source', source, '--destination', join(temp, name)], { cwd: repository, env, encoding: 'utf8' });
  assert.notEqual(result.status, 0, `${name}: 플러그인 출력 불일치 시 빌드에 실패해야 합니다`);
  assert.match(`${result.stdout}\n${result.stderr}`, /ERROR_literal_seo_plugin_output_mismatch/, `${name}: 실패 이유가 드러나야 합니다`);
}
await writeFile(includePath, originalInclude);
console.log(`리터럴 제목 SEO 격리 빌드 검증 통과: ${temp}`);
