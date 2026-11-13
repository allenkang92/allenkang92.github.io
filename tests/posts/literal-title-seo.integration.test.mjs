import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const siteRoot = process.env.SITE_ROOT || resolve('_site');
const sourceRoot = process.env.SEO_SOURCE_ROOT || resolve('.');
const sourcePost = '_posts/2021-01-28-기업재난관리사실무분야합격후기-정보글.md';
const generatedPost = 'posts/기업재난관리사-합격후기/index.html';

function postMetadata() {
  // 기대값은 생성 HTML이 아니라 원본 front matter에서 읽는다.
  const ruby = `require 'yaml'; require 'date'; require 'time'; require 'json'
    text = File.read(ARGV.fetch(0))
    match = text.match(/\\A---\\s*\\n(.*?)\\n---\\s*\\n/m)
    abort 'front matter 누락' unless match
    post = YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true)
    puts JSON.generate({ 'title' => post['title'], 'description' => post['description'],
      'published' => post['date'].xmlschema, 'modified' => post['last_modified_at'].xmlschema })`;
  return JSON.parse(execFileSync('ruby', ['-e', ruby, resolve(sourceRoot, sourcePost)], { encoding: 'utf8' }));
}

async function readPage() {
  const html = await readFile(resolve(siteRoot, generatedPost), 'utf8');
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  window.document.write(html);
  const scripts = [...window.document.querySelectorAll('script[type="application/ld+json"]')];
  assert.equal(scripts.length, 1, '구조화 데이터는 한 번만 출력된다');
  return { window, document: window.document, json: JSON.parse(scripts[0].textContent) };
}

test('게시 글의 꺾쇠와 앰퍼샌드가 화면 제목에 유지된다', async () => {
  const post = postMetadata();
  assert.match(post.title, /<자격증>/);
  assert.ok(post.title.includes('&'));
  const { window, document } = await readPage();
  try {
    assert.equal(document.querySelector('h1.post-title')?.textContent.trim(), post.title);
  } finally { window.happyDOM.abort(); }
});

for (const [label, selector, attribute] of [
  ['Open Graph', 'meta[property="og:title"]', 'content'],
  ['Twitter', 'meta[name="twitter:title"]', 'content'],
]) {
  test(`게시 글 ${label} 제목은 화면 제목의 원문을 유지한다`, async () => {
    const post = postMetadata();
    const { window, document } = await readPage();
    try {
      assert.equal(document.querySelectorAll(selector).length, 1, `${label} 제목 중복 없음`);
      assert.equal(document.querySelector(selector)?.getAttribute(attribute), post.title);
    } finally { window.happyDOM.abort(); }
  });
}

test('게시 글 브라우저 제목은 원문 제목과 사이트 이름을 포함한다', async () => {
  const post = postMetadata();
  const { window, document } = await readPage();
  try {
    assert.equal(document.querySelectorAll('head > title').length, 1);
    assert.ok(document.title.startsWith(`${post.title} | `));
    assert.ok(document.title.slice(post.title.length + 3).trim());
  } finally { window.happyDOM.abort(); }
});

test('구조화 데이터의 headline은 HTML 엔티티가 아닌 원문이다', async () => {
  const post = postMetadata();
  const { window, json } = await readPage();
  try {
    assert.equal(json.headline, post.title);
  } finally { window.happyDOM.abort(); }
});

test('제목 수정과 별개로 설명·주소·이미지·게시일과 수정일이 유지된다', async () => {
  const post = postMetadata();
  const { window, document, json } = await readPage();
  try {
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    const image = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    assert.equal(document.querySelector('meta[name="description"]')?.getAttribute('content'), post.description);
    assert.equal(document.querySelector('meta[property="og:description"]')?.getAttribute('content'), post.description);
    assert.equal(json.description, post.description);
    assert.ok(canonical?.startsWith('https://'));
    assert.equal(json.url, canonical);
    assert.equal(json.mainEntityOfPage?.['@id'], canonical);
    assert.ok(image?.startsWith('https://'));
    assert.equal(json.image, image);
    assert.equal(json.datePublished, post.published);
    assert.equal(json.dateModified, post.modified);
    assert.equal(json['@type'], 'BlogPosting');
  } finally { window.happyDOM.abort(); }
});
