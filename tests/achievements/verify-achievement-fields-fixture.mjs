// 성과 데이터의 문자와 주소가 HTML 파싱 전후에 보존되는지 실제 격리 빌드로 확인한다.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Window } from 'happy-dom';

const repository = resolve('.');
const temp = await realpath(await mkdtemp(join(tmpdir(), 'achievement-fields-fixture-')));
const source = join(temp, 'source');
const paths = ['_config.yml', '_includes', '_layouts', '_achievements', '_pages', '_posts', '_data', 'assets', 'tools', 'sitemap.xml', 'robots.txt', 'index.html', '404.html', 'search.json', 'manifest.json', 'favicon.ico', 'apple-touch-icon.png'];
for (const path of paths) await cp(join(repository, path), join(source, path), { recursive: true });

const certificate = 'https://example.org/certificate?name="R&D"&show=<image>';
const credential = '자격 <em>42</em> & "원문"';
const project = '/project/?name="R&D"&view=<overview>';
const localCertificate = '/assets/images/certificate.png?first=1&second=2';
const externalProject = 'https://example.org/project?first=1&second=2';
const protocolRelative = '//example.org/project?first=1&second=2';
const relativeCertificate = '../assets/certificate.png';
const title = '성과 & <strong>전체</strong>';
const description = '설명 & <em>원문</em>';
const category = '분류 & <em>원문</em>';

const education = join(source, '_achievements/education.md');
let detailSource = await readFile(education, 'utf8');
assert.match(detailSource, /^---\r?\n/);
assert.match(detailSource, /^category:.*$/m);
detailSource = detailSource.replace(/^category:.*$/m, `category: ${JSON.stringify(category)}`);
detailSource = detailSource.replace(/^---\r?\n/, match => `${match}certificate_image: ${JSON.stringify(certificate)}\ncredential_id: ${JSON.stringify(credential)}\nproject_detail: ${JSON.stringify(project)}\n`);
await writeFile(education, detailSource);
const leadership = join(source, '_achievements/leadership.md');
const leadershipSource = await readFile(leadership, 'utf8');
assert.match(leadershipSource, /^---\r?\n/);
await writeFile(leadership, leadershipSource.replace(/^---\r?\n/, match => `${match}certificate_image: ${JSON.stringify(localCertificate)}\ncredential_id: "ID 1234"\nproject_detail: ${JSON.stringify(externalProject)}\n`));
const publications = join(source, '_achievements/publications.md');
const publicationsSource = await readFile(publications, 'utf8');
assert.match(publicationsSource, /^---\r?\n/);
await writeFile(publications, publicationsSource.replace(/^---\r?\n/, match => `${match}certificate_image: ${JSON.stringify(relativeCertificate)}\nproject_detail: ${JSON.stringify(protocolRelative)}\n`));
const awards = join(source, '_achievements/awards.md');
const awardsSource = await readFile(awards, 'utf8');
assert.match(awardsSource, /^---\r?\n/);
await writeFile(awards, awardsSource.replace(/^---\r?\n/, match => `${match}certificate_image: ${JSON.stringify('javascript:alert(1)')}\nproject_detail: ${JSON.stringify('java\tscript:alert(1)')}\n`));
const certificates = join(source, '_achievements/certificates.md');
const certificatesSource = await readFile(certificates, 'utf8');
assert.match(certificatesSource, /^---\r?\n/);
await writeFile(certificates, certificatesSource.replace(/^---\r?\n/, match => `${match}certificate_image: 2025-01-01\nproject_detail: false\n`));
const page = join(source, '_pages/achievements.md');
let pageSource = await readFile(page, 'utf8');
for (const [key, value] of [['title', title], ['description', description]]) {
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  assert.match(pageSource, pattern);
  pageSource = pageSource.replace(pattern, () => `${key}: ${JSON.stringify(value)}`);
}
assert.match(pageSource, /^---\r?\n/);
pageSource = pageSource.replace(/^---\r?\n/, match => `${match}seo_plain_description: ${JSON.stringify('설명 & 원문')}\n`);
await writeFile(page, pageSource);

// 사이트 루트와 이미 기저 경로가 붙은 주소의 경계를 별도로 검증한다.
const urlCases = [
  ['/blog', '/blog'],
  ['/blog/', '/blog/'],
  ['/blog?x=1&y=2', '/blog?x=1&y=2'],
  ['/blog#top', '/blog#top'],
  ['/blog/inside?x=1&y=2', '/blog/inside?x=1&y=2'],
  ['/blog/blog/inside', '/blog/blog/inside'],
  ['/blogger', '/blog/blogger'],
  ['/blogger/inside', '/blog/blogger/inside'],
  ['/Blog/inside', '/blog/Blog/inside'],
  ['/blog%2Finside', '/blog/blog%2Finside'],
  ['/\\example.org/path', null],
  ['/blog\\example.org/path', null],
  ['/?x=1&y=2', '/blog/?x=1&y=2'],
  ['//example.org/blog', '//example.org/blog'],
  ['https://example.org/blog', 'https://example.org/blog'],
  ['../blog', '../blog'],
  ['/a:b', '/blog/a:b'],
  ['?q=x:y', '?q=x:y'],
  ['#y:x', '#y:x'],
  ['HTTPS://example.org/path', 'HTTPS://example.org/path'],
  ['javascript:alert(1)', null],
  ['JaVaScRiPt:alert(1)', null],
  ['java\tscript:alert(1)', null],
  ['\u0000javascript:alert(1)', null],
  ['javascript:\nalert(1)', null],
  ['mailto:person@example.org', null],
  ['tel:+8210', null],
  ['data:image/png;base64,AAAA', null],
  ['http:example.org', null],
  ['https://', null],
  ['//', null],
  ['///example.org/path', null],
  ['//?x=1', null],
  [' https://example.org', null],
  ['https://example.org ', null],
  ['\u00a0https://example.org', null],
  ['https://example.org\u3000', null],
  ['', null],
  [false, null],
  [42, null],
  [['/a'], null],
  [{ href: '/a' }, null],
];
for (const code of [...Array(32).keys(), 127]) {
  urlCases.push([`java${String.fromCharCode(code)}script:alert(1)`, null]);
}
for (const space of ['\u0085', '\u00a0', '\u1680', ...Array.from({ length: 11 }, (_, index) => String.fromCharCode(0x2000 + index)), '\u2028', '\u2029', '\u202f', '\u205f', '\u3000']) {
  urlCases.push([`${space}/project`, null], [`/project${space}`, null]);
}
// YAML의 제어문자는 이스케이프 표기로 넣어 파서가 실제 문자열로 복원하게 한다.
const yamlValue = value => JSON.stringify(value).replace(/[\u007f-\u009f\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
const caseValues = urlCases.map(([value]) => `  - ${yamlValue(value)}`).join('\n');
await writeFile(join(source, 'achievement-url-fixture.html'), `---\nlayout: null\nurls:\n${caseValues}\n---\n{% for url in page.urls %}{% capture accepted %}{% include components/achievement-url.html url=url %}{% endcapture %}{% if accepted != '' %}<a data-case="{{ forloop.index0 }}" href="{{ accepted }}">주소</a>{% else %}<span data-case="{{ forloop.index0 }}"></span>{% endif %}{% endfor %}\n`);
// 작성자용 Ruby 검사와 실제 Liquid의 허용/거부 결과가 같아야 한다.
const ruby = `require 'json'; require './scripts/verify_frontmatter'; values = JSON.parse(STDIN.read); puts JSON.generate(values.map { |value| FrontmatterVerifier.achievement_url_error(value).nil? })`;
const rubyAccepted = JSON.parse(execFileSync('ruby', ['-e', ruby], { cwd: repository, input: JSON.stringify(urlCases.map(([value]) => value)), encoding: 'utf8' }));

const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), JEKYLL_ENV: 'production', TZ: 'UTC' };
for (const [name, configuredBase, base] of [['root', '', ''], ['base', '/blog', '/blog'], ['base-trailing', '/blog/', '/blog']]) {
  const output = join(temp, name);
  const builder = base ? ['jekyll', 'build', '--baseurl', configuredBase] : ['github-pages', 'build'];
  execFileSync(process.env.BUNDLE_BIN || 'bundle', ['exec', ...builder, '--source', source, '--destination', output], { cwd: repository, env, stdio: 'inherit' });
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    browser.document.write(await readFile(join(output, 'achievements/education/index.html'), 'utf8'));
    const document = browser.document;
    const image = document.querySelector('figure.certificate img');
    const link = document.querySelector('.project-detail-link a');
    assert.ok(image, '증명서 이미지가 출력되어야 합니다');
    assert.ok(link, '상세 프로젝트 링크가 출력되어야 합니다');
    assert.equal(image.getAttribute('src'), certificate, '이미지 주소는 문자 그대로 보존되어야 합니다');
    assert.equal(link.getAttribute('href'), `${base}${project}`, '내부 프로젝트 주소에는 기저 경로를 적용합니다');
    assert.equal(document.querySelector('.credential-id')?.textContent, credential, '자격 번호는 텍스트로 표시되어야 합니다');
    assert.equal(document.querySelector('.credential-id em'), null, '자격 번호의 태그 표기는 실제 요소가 아니어야 합니다');
    assert.deepEqual([...image.attributes].map(attribute => attribute.name).sort(), ['alt', 'loading', 'onerror', 'src'], '입력값이 새 속성으로 해석되지 않아야 합니다');
    assert.deepEqual([...link.attributes].map(attribute => attribute.name).sort(), ['aria-labelledby', 'class', 'href']);
    document.open();
    document.write(await readFile(join(output, 'achievements/index.html'), 'utf8'));
    const card = document.querySelector(`.achievement-card a[href="${base}/achievements/education/"]`)?.closest('.achievement-card');
    assert.ok(card, '성과 목록에서 시험 항목을 찾아야 합니다');
    assert.equal(document.querySelector('.achievements-header h1')?.textContent, title);
    assert.equal(document.querySelector('.achievements-description')?.textContent, description);
    assert.equal(card.querySelector('.achievement-category')?.textContent.trim(), category);
    assert.equal(card.querySelector('.project-detail-link')?.getAttribute('href'), `${base}${project}`);
    assert.equal(card.querySelector('.achievement-category em'), null);
    const externalCard = document.querySelector(`.achievement-card a[href="${base}/achievements/leadership/"]`)?.closest('.achievement-card');
    assert.equal(externalCard?.querySelector('.project-detail-link')?.getAttribute('href'), externalProject);
    const protocolCard = document.querySelector(`.achievement-card a[href="${base}/achievements/publications/"]`)?.closest('.achievement-card');
    assert.equal(protocolCard?.querySelector('.project-detail-link')?.getAttribute('href'), protocolRelative);
    const invalidCard = document.querySelector(`.achievement-card a[href="${base}/achievements/awards/"]`)?.closest('.achievement-card');
    assert.ok(invalidCard);
    assert.equal(invalidCard.querySelector('.project-detail-link'), null, '거부 주소는 목록에 빈 링크를 남기지 않는다');
    const nonStringCard = document.querySelector(`.achievement-card a[href="${base}/achievements/certificates/"]`)?.closest('.achievement-card');
    assert.ok(nonStringCard);
    assert.equal(nonStringCard.querySelector('.project-detail-link'), null, '문자열이 아닌 주소는 목록에서 생략한다');
    document.open();
    document.write(await readFile(join(output, 'achievements/leadership/index.html'), 'utf8'));
    assert.equal(document.querySelector('figure.certificate img')?.getAttribute('src'), `${base}${localCertificate}`);
    assert.equal(document.querySelector('.credential-id')?.textContent, 'ID 1234');
    assert.equal(document.querySelector('.project-detail-link a')?.getAttribute('href'), externalProject);
    document.open();
    document.write(await readFile(join(output, 'achievements/publications/index.html'), 'utf8'));
    assert.equal(document.querySelector('figure.certificate img')?.getAttribute('src'), relativeCertificate);
    assert.equal(document.querySelector('.project-detail-link a')?.getAttribute('href'), protocolRelative);
    document.open();
    document.write(await readFile(join(output, 'achievements/awards/index.html'), 'utf8'));
    assert.equal(document.querySelector('figure.certificate'), null, '거부 주소는 상세에 빈 이미지를 남기지 않는다');
    assert.equal(document.querySelector('.project-detail-link'), null, '거부 주소는 상세에 빈 링크를 남기지 않는다');
    document.open();
    document.write(await readFile(join(output, 'achievements/certificates/index.html'), 'utf8'));
    assert.equal(document.querySelector('figure.certificate'), null, 'YAML 날짜를 이미지 주소로 표시하지 않는다');
    assert.equal(document.querySelector('.project-detail-link'), null, 'false로 비활성화한 링크는 표시하지 않는다');
    document.open();
    document.write(await readFile(join(output, 'achievement-url-fixture.html'), 'utf8'));
    for (const [index, [value, expectedBase]] of urlCases.entries()) {
      const element = document.querySelector(`[data-case="${index}"]`);
      const expected = expectedBase === null ? null : base ? expectedBase : value;
      assert.equal(element?.getAttribute('href'), expected, `${configuredBase || '/'}: ${JSON.stringify(value)}`);
      assert.equal(element?.tagName === 'A', rubyAccepted[index], `Ruby/Liquid 정책 불일치: ${JSON.stringify(value)}`);
    }
  } finally { await browser.happyDOM.abort(); }
}
console.log(`성과 필드 격리 검증 통과: ${temp}`);
