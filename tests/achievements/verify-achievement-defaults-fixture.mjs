// 실제 Jekyll Document의 defaults 범위·우선순위와 URL 검사를 함께 확인한다.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { withTemporaryDirectory } from '../helpers/temporary-directory.mjs';
import { join, resolve } from 'node:path';

const repository = resolve('.');
await withTemporaryDirectory('achievement-defaults-fixture-', async (source) => {
await mkdir(join(source, '_achievements'));
await mkdir(join(source, '_pages'));
const first = join(source, '_achievements/one.md');
const second = join(source, '_achievements/two.html');
const configPath = join(source, '_config.yml');
const env = { ...process.env, BUNDLE_GEMFILE: process.env.BUNDLE_GEMFILE || join(repository, 'Gemfile'), TZ: 'UTC', JEKYLL_ENV: 'production' };
const bundle = process.env.BUNDLE_BIN || 'bundle';
const writeConfig = defaults => writeFile(configPath, JSON.stringify({ collections: { achievements: { output: true } }, defaults }));
const writeFirst = value => writeFile(first, `---\ntitle: One\n${value}---\n내용\n`);
const writeSecond = value => writeFile(second, `---\ntitle: Two\n${value}---\n내용\n`);
const run = (target = source) => spawnSync(bundle, ['exec', 'ruby', 'scripts/verify_achievement_defaults.rb', target], { cwd: repository, env, encoding: 'utf8' });
const expectPass = label => {
  const result = run();
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  assert.match(result.stdout, /PASS:/);
  assert.match(result.stdout, /성과 문서 2개/, `${label}: 검사 문서 수를 알려야 합니다`);
};
const expectFailure = (label, expectedPath, expectedField) => {
  const result = run();
  assert.ifError(result.error);
  assert.equal(result.status, 1, `${label}: ${result.stdout}\n${result.stderr}`);
  assert.ok(result.stderr.includes(expectedPath), `${label}: 대상 파일을 알려야 합니다`);
  assert.ok(result.stderr.includes(expectedField), `${label}: 대상 필드를 알려야 합니다`);
};

// 검사할 수 있는 문서가 없다면 성공을 보고하지 않는다.
const noCollection = join(source, 'no-collection');
await mkdir(noCollection);
await writeFile(join(noCollection, '_config.yml'), '{}\n');
const missing = run(noCollection);
assert.ifError(missing.error);
assert.equal(missing.status, 1, `성과 컬렉션 부재는 실패해야 합니다: ${missing.stdout}\n${missing.stderr}`);
assert.match(missing.stderr, /성과 컬렉션.*없/);
assert.doesNotMatch(missing.stdout, /PASS:/);

const noDocuments = join(source, 'no-documents');
await mkdir(join(noDocuments, '_achievements'), { recursive: true });
await writeFile(join(noDocuments, '_config.yml'), JSON.stringify({ collections: { achievements: { output: true } } }));
await writeFile(join(noDocuments, '_achievements/static.md'), 'front matter가 없는 정적 파일\n');
const empty = run(noDocuments);
assert.ifError(empty.error);
assert.equal(empty.status, 1, `성과 문서가 없으면 실패해야 합니다: ${empty.stdout}\n${empty.stderr}`);
assert.match(empty.stderr, /검사할 성과 문서.*없/);
assert.doesNotMatch(empty.stdout, /PASS:/);

await writeFirst('');
await writeSecond('');
await writeFile(join(source, '_achievements/static.md'), 'front matter가 없는 정적 파일\n');
await writeConfig([
  { scope: { path: '_pages' }, values: { project_detail: 'javascript:alert(1)' } },
  { scope: { path: '', type: null }, values: { project_detail: 'javascript:alert(1)' } },
  { scope: { path: '', type: false }, values: { project_detail: 'javascript:alert(1)' } },
]);
expectPass('다른 경로와 null/false 타입 기본값은 성과에 적용되지 않는다');

await writeConfig([{ scope: { path: '_achievements/one.md', type: 'achievements' }, values: { project_detail: 'javascript:alert(1)' } }]);
await writeFirst('project_detail: false\n');
expectPass('명시적 false는 해당 기본값을 비활성화한다');
await writeFirst('project_detail: null\n');
expectFailure('null은 실제로 적용되는 기본값을 검사한다', '_achievements/one.md', 'project_detail');

await writeFirst('');
await writeConfig([
  { scope: { path: '', type: 'achievements' }, values: { project_detail: 'javascript:alert(1)' } },
  { scope: { path: '_achievements', type: 'achievements' }, values: { project_detail: '/safe/project' } },
]);
expectPass('우선순위가 높은 안전한 기본값이 실제로 적용된다');

await writeConfig([{ scope: { path: '_achievements/*', type: 'achievements' }, values: { certificate_image: 'data:image/png;base64,AAAA' } }]);
await writeFirst('certificate_image: false\n');
await writeSecond('certificate_image: /safe/image.png\n');
expectPass('glob 기본값은 개별 문서에서 비활성화하거나 덮어쓸 수 있다');
await writeSecond('');
expectFailure('glob 기본값이 적용된 HTML 문서를 검사한다', '_achievements/two.html', 'certificate_image');

});
console.log(`성과 기본값 격리 검증 통과`);
