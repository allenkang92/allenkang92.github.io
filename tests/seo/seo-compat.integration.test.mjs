import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Window } from 'happy-dom';

const ruby = `require 'jekyll'; require 'json'
payload = JSON.parse(STDIN.read)
config = Jekyll.configuration('source' => Dir.pwd, 'destination' => '/tmp/seo-compat-test-unused', 'quiet' => true)
config.merge!(payload.fetch('site'))
site = Jekyll::Site.new(config)
context = Liquid::Context.new(site.site_payload, {}, { :site => site })
context['input'] = payload.fetch('source')
context['page'] = payload.fetch('page')
puts Liquid::Template.parse('{% include seo-compat.html source=input %}').render!(context)`;

function render(source, page = {}, site = {}) {
  const result = spawnSync(process.env.BUNDLE_BIN || 'bundle', ['exec', 'ruby', '-e', ruby], {
    input: JSON.stringify({ source, page, site }), encoding: 'utf8', cwd: process.cwd(),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}

test('SEO 2.8 JSON 전체를 스크립트 안전하게 변환하고 내용은 보존한다', async () => {
  const value = '</script><script>실행금지</script> & <가나다>\u2028\u2029';
  const data = { headline: '제목', author: { name: value }, image: { description: value } };
  const source = `<!-- Begin Jekyll SEO tag v2.8.0 -->\n<meta property="og:description" content="설명" />\n<meta property="twitter:title" content="제목" />\n<script type="application/ld+json">\n${JSON.stringify(data)}</script>\n<!-- End Jekyll SEO tag -->`;
  const html = render(source);
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  try {
    const document = new browser.DOMParser().parseFromString(`<html><head>${html}</head></html>`, 'text/html');
    const scripts = [...document.querySelectorAll('script')];
    assert.equal(scripts.length, 1, '입력 데이터가 추가 스크립트를 만들면 안 됩니다');
    assert.deepEqual(JSON.parse(scripts[0].textContent), data, 'HTML 문맥 보정 후 JSON 의미를 보존합니다');
    assert.equal(document.querySelector('meta[property="og:description"]')?.getAttribute('name'), 'twitter:description');
    assert.equal(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'), '제목');
    assert.doesNotMatch(scripts[0].textContent, /<\s*\/\s*script/i);
    assert.equal(render(html).trim(), html.trim(), '중복 적용해도 출력 의미가 바뀌지 않습니다');
  } finally { await browser.happyDOM.abort(); }
});

test('SEO 2.9 출력은 변경하지 않고, 모호한 2.8 출력은 중단한다', () => {
  const modern = '<!-- Begin Jekyll SEO tag v2.9.1 -->\n<script type="application/ld+json">{}</script>\n<!-- End Jekyll SEO tag -->';
  assert.equal(render(modern).trim(), modern);
  const ambiguous = '<!-- Begin Jekyll SEO tag v2.8.0 -->\n<script type="application/ld+json">{}<script type="application/ld+json">{}</script>\n<!-- End Jekyll SEO tag -->';
  assert.throws(() => render(ambiguous), /ERROR_seo_compat_plugin_output_mismatch/);
  const duplicateVersion = '<!-- Begin Jekyll SEO tag v2.8.0 -->\n<!-- Begin Jekyll SEO tag v2.8.0 -->\n<script type="application/ld+json">{}</script>\n<!-- End Jekyll SEO tag -->';
  assert.throws(() => render(duplicateVersion), /ERROR_seo_compat_plugin_output_mismatch/);
});

test('SEO 2.8의 인용부호·태그·추가 속성 주입을 차단한다', () => {
  const wrap = line => `<!-- Begin Jekyll SEO tag v2.8.0 -->\n${line}\n<script type="application/ld+json">{}</script>\n<!-- End Jekyll SEO tag -->`;
  const safe = [
    '<meta name="author" content="저자 &amp; 연구" />',
    '<meta property="og:image" content="https://example.org/a?x=1&amp;y=2" />',
    '<link rel="canonical" href="https://example.org/posts/" />',
    '<meta name="twitter:site" content="@user" />',
    '<meta property="fb:admins" content="123" />',
  ];
  assert.doesNotThrow(() => render(wrap(safe.join('\n'))));
  for (const malicious of [
    '<meta name="author" content="이름"><script>alert(1)</script><meta name="x" content="',
    '<meta property="og:image" content="x" onload="alert(1)" />',
    '<link rel="canonical" href="x" /><meta http-equiv="refresh" content="0;url=https://example.org" />',
    '<meta name="twitter:site" content="x" /><meta name="twitter:site" content="중복" />',
    '<meta property="fb:admins" content="x" />\n<meta http-equiv="refresh" content="0;url=https://example.org" />',
  ]) {
    assert.throws(() => render(wrap(malicious)), /ERROR_seo_compat_unsafe_html_metadata/);
  }
  const injectedAuthor = '정상" />\n<meta name="google-site-verification" content="공격자';
  const twoNormalLookingLines = '<meta name="author" content="정상" />\n<meta name="google-site-verification" content="공격자" />';
  assert.throws(() => render(wrap(twoNormalLookingLines), { author: injectedAuthor }), /ERROR_seo_compat_unsafe_html_metadata/);
  assert.throws(() => render(wrap(twoNormalLookingLines), { author: { name: injectedAuthor } }), /ERROR_seo_compat_unsafe_html_metadata/);
  const injectedBreak = '정상" /><br /><meta name="google-site-verification" content="공격자';
  const forgedLines = '<meta name="author" content="정상" /><br /><meta name="google-site-verification" content="공격자" />';
  assert.throws(() => render(wrap(forgedLines), { author: injectedBreak }), /ERROR_seo_compat_unsafe_html_metadata/, '리터럴 줄 분리 태그로 메타데이터를 끼워 넣지 못해야 합니다');
  assert.doesNotThrow(() => render(wrap('<meta name="author" content="표시 &lt;br /&gt; 이름" />'), { author: '표시 &lt;br /&gt; 이름' }), '이스케이프된 일반 텍스트는 허용해야 합니다');
  const injectedImage = `<meta property="og:image" content="https://example.org/image.png" />\n${twoNormalLookingLines}`;
  assert.throws(() => render(wrap(injectedImage), { image: { path: '/image.png', alt: injectedAuthor } }), /ERROR_seo_compat_unsafe_html_metadata/);
  const literalBackslash = String.raw`C:\next\n`;
  assert.doesNotThrow(() => render(wrap(`<meta name="author" content="${literalBackslash}" />`), { author: literalBackslash }));
  assert.doesNotThrow(() => render(wrap('<meta name="author" content="Alice" />'), {
    author: { name: 'Alice', bio: '사용하지 않는\n소개' },
    image: { path: '/image.png', description: 'JSON 전용\n설명' },
    twitter: { note: '사용하지 않는\n메모' },
  }, { author: { name: '선택되지 않은\n작성자' }, twitter: { username: 'user', bio: '사용하지 않는\n소개' } }));
  const imageOutput = wrap('<meta property="og:image" content="https://example.org/image.png" />\n<meta name="twitter:card" content="summary" />');
  assert.doesNotThrow(() => render(imageOutput, {
    twitter: { card: 'summary' }, image: { path: '/image.png', facebook: '선택되지 않은\n주소' },
    locale: 'ko-KR', lang: '선택되지 않은\n언어',
  }, { twitter: { card: '선택되지 않은\n카드' }, locale: '선택되지 않은\n지역' }));
  assert.throws(() => render(imageOutput, { twitter: { card: injectedAuthor }, image: { path: '/image.png' } }), /ERROR_seo_compat_unsafe_html_metadata/);
  assert.throws(() => render(imageOutput, { image: { facebook: injectedAuthor } }), /ERROR_seo_compat_unsafe_html_metadata/);
  assert.throws(() => render(imageOutput, { image: { path: '/image.png' }, locale: injectedAuthor }), /ERROR_seo_compat_unsafe_html_metadata/);
  assert.doesNotThrow(() => render(wrap('<meta name="twitter:card" content="summary" />'), {
    twitter: { card: '이미지가 없어서\n사용하지 않음' },
  }));
  const verificationOutput = wrap('<meta name="google-site-verification" content="안전" />');
  assert.doesNotThrow(() => render(verificationOutput, {}, {
    webmaster_verifications: { google: '안전' }, google_site_verification: '선택되지 않은\n기본값',
  }));
  assert.throws(() => render(verificationOutput, {}, {
    webmaster_verifications: { google: injectedAuthor }, google_site_verification: '안전',
  }), /ERROR_seo_compat_unsafe_html_metadata/);
});
