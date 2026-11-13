import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import test from 'node:test';

const projectRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const viteCli = join(projectRoot, 'node_modules/vite/bin/vite.js');

test('과거 배포 페이지가 참조하는 번들의 원본을 보존한다', () => {
  // 2026-11-10에 배포된 두 manifest의 파일을 예전 HTML 캐시에서 요청할 수 있다.
  for (const [name, expected] of [
    ['main-BTyvt83f.js', 'f07657be913719259ce35db5a26201fc8bc7a4f1'],
    ['main-BPoTMtH0.js', 'db7126ece0cf6f6b3ac9bc6105a394ea52397d71'],
  ]) {
    const bytes = readFileSync(join(projectRoot, 'assets/js/dist/assets', name));
    const header = Buffer.from(`blob ${bytes.length}\0`);
    assert.equal(createHash('sha1').update(header).update(bytes).digest('hex'), expected, `${name}: 기존 배포의 원본과 일치해야 한다`);
  }
});

test('프런트엔드 빌드는 기존 번들을 보존하고 최신 진입점을 기록한다', () => {
  const output = mkdtempSync(join(tmpdir(), 'blog-vite-output-'));
  const assets = join(output, 'assets');
  const previousBundle = join(assets, 'main-old-cache.js');
  const manifest = join(output, 'manifest.json');
  mkdirSync(assets);
  writeFileSync(previousBundle, '이전 페이지에서 참조하는 번들');

  try {
    const build = () => execFileSync(process.execPath, [viteCli, 'build', '--outDir', output], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    build();
    assert.equal(readFileSync(previousBundle, 'utf8'), '이전 페이지에서 참조하는 번들');
    const firstManifest = JSON.parse(readFileSync(manifest, 'utf8'));
    const generated = firstManifest['frontend/posts/main.tsx']?.file;
    assert.match(generated, /^assets\/main-[A-Za-z0-9_-]+\.js$/);
    const firstBundle = readFileSync(join(output, generated), 'utf8');
    assert.ok(firstBundle.length > 0);

    build();
    assert.equal(readFileSync(previousBundle, 'utf8'), '이전 페이지에서 참조하는 번들');
    assert.equal(readFileSync(join(output, generated), 'utf8'), firstBundle);
    const secondManifest = JSON.parse(readFileSync(manifest, 'utf8'));
    const current = secondManifest['frontend/posts/main.tsx']?.file;
    assert.match(current, /^assets\/main-[A-Za-z0-9_-]+\.js$/);
    assert.ok(readFileSync(join(output, current), 'utf8').length > 0);
  } finally {
    // 이 테스트가 방금 만든 디렉터리의 일반 파일만 정리한다.
    try {
      for (const entry of readdirSync(assets, { withFileTypes: true })) {
        if (entry.isFile()) unlinkSync(join(assets, entry.name));
      }
      rmdirSync(assets);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try { unlinkSync(manifest); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    rmdirSync(output);
  }
});
