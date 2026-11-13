import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../../..');
const bundlePath = process.env.SEO_LEGACY_BUNDLE_PATH;

if (!bundlePath || !isAbsolute(bundlePath)) {
  console.error('SEO 2.8 회귀 시험에는 설치된 별도 번들의 절대 경로를 SEO_LEGACY_BUNDLE_PATH에 지정해야 합니다.');
  console.error('설치 방법: tests/seo/legacy/README.md');
  process.exit(1);
}

// npm run verify의 부모 프로세스는 다른 Gemfile과 번들을 사용할 수 있다.
// 현재 번들의 잠금 파일과 별도 설치 경로만 사용해 두 버전을 섞지 않는다.
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (key.startsWith('BUNDLE_') || ['GEM_HOME', 'GEM_PATH', 'RUBYOPT', 'RUBYLIB'].includes(key)) delete env[key];
}
env.BUNDLE_GEMFILE = join(directory, 'Gemfile');
env.BUNDLE_PATH = bundlePath;
env.BUNDLE_APP_CONFIG = join(bundlePath, '.bundle-config');
env.BUNDLE_FROZEN = 'true';
env.BUNDLE_DISABLE_SHARED_GEMS = 'true';

const check = spawnSync('bundle', ['check'], { cwd: root, env, encoding: 'utf8' });
if (check.error || check.status !== 0) {
  console.error('SEO 2.8 회귀 시험용 번들을 사용할 수 없습니다. 설치 방법: tests/seo/legacy/README.md');
  if (check.error) console.error(check.error.message);
  process.exit(1);
}

const result = spawnSync('bundle', ['exec', 'ruby', join(directory, 'verify.rb')], {
  cwd: root,
  env,
  stdio: 'inherit',
});
if (result.error) {
  console.error(`SEO 2.8 회귀 시험을 실행할 수 없습니다: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error('SEO 2.8 회귀 시험이 실패했습니다. 번들 설치와 잠금 파일을 확인하세요: tests/seo/legacy/README.md');
}
process.exit(result.status ?? 1);
