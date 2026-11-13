import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { withTemporaryDirectory } from './temporary-directory.mjs';

test('정상 종료 후 방금 생성한 폴더만 정리하고 결과를 반환한다', async () => {
  await withTemporaryDirectory('lifecycle-parent-', async parent => {
    const sentinel = join(parent, 'sentinel');
    await fs.writeFile(sentinel, '기존 파일');
    const created = await withTemporaryDirectory('lifecycle-child-', async directory => {
      await fs.writeFile(join(directory, 'fixture'), '임시 자료');
      return directory;
    });
    await assert.rejects(fs.access(created), { code: 'ENOENT' });
    assert.equal(await fs.readFile(sentinel, 'utf8'), '기존 파일');
  });
});

test('검증 예외가 발생해도 만든 폴더를 정리하고 원래 예외를 전달한다', async () => {
  let created;
  const original = new Error('검증 실패');
  await assert.rejects(withTemporaryDirectory('lifecycle-error-', async directory => {
    created = directory;
    await fs.writeFile(join(directory, 'fixture'), '임시 자료');
    throw original;
  }), error => error === original);
  await assert.rejects(fs.access(created), { code: 'ENOENT' });
});

test('검증과 정리 오류를 모두 보존한다', async t => {
  const original = new Error('검증 실패');
  const cleanup = new Error('정리 실패');
  const realRm = fs.rm;
  t.mock.method(fs, 'rm', async (...args) => {
    await realRm(...args);
    throw cleanup;
  });
  await assert.rejects(withTemporaryDirectory('lifecycle-both-', async () => {
    throw original;
  }), error => error instanceof AggregateError && error.errors[0] === original && error.errors[1] === cleanup);
});

test('검증이 성공해도 정리 오류를 알린다', async t => {
  const cleanup = new Error('정리 실패');
  const realRm = fs.rm;
  t.mock.method(fs, 'rm', async (...args) => {
    await realRm(...args);
    throw cleanup;
  });
  await assert.rejects(withTemporaryDirectory('lifecycle-cleanup-', async () => '성공'), error => error === cleanup);
});

test('콜백이 기다리는 자식 프로세스가 종료된 후 정리한다', async () => {
  let created;
  await withTemporaryDirectory('lifecycle-process-', async directory => {
    created = directory;
    const result = join(directory, 'child-result');
    const child = spawn(process.execPath, ['-e', "require('fs').writeFileSync(process.argv[1], '완료')", result]);
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    assert.equal(code, 0);
    assert.equal(await fs.readFile(result, 'utf8'), '완료');
  });
  await assert.rejects(fs.access(created), { code: 'ENOENT' });
});

test('병렬 실행은 서로 다른 폴더를 사용하고 상대 실행을 정리하지 않는다', async () => {
  const seen = [];
  let release;
  const bothReady = new Promise(resolve => { release = resolve; });
  const run = () => withTemporaryDirectory('lifecycle-parallel-', async directory => {
    seen.push(directory);
    await fs.writeFile(join(directory, 'fixture'), directory);
    if (seen.length === 2) release();
    await bothReady;
    assert.notEqual(seen[0], seen[1]);
    assert.equal(await fs.readFile(join(directory, 'fixture'), 'utf8'), directory);
    return directory;
  });
  const paths = await Promise.all([run(), run()]);
  for (const path of paths) await assert.rejects(fs.access(path), { code: 'ENOENT' });
});

test('임의 경로를 접두사로 전달할 수 없다', async () => {
  await assert.rejects(withTemporaryDirectory('../unsafe-', async () => {}), TypeError);
});
