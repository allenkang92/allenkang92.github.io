import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 각 실행이 직접 생성한 고유 폴더만 콜백 종료 후 정리한다.
export async function withTemporaryDirectory(prefix, run) {
  if (!/^[a-z0-9-]+-$/.test(prefix)) throw new TypeError('임시 폴더 접두사가 올바르지 않습니다');
  const root = await fs.realpath(tmpdir());
  const directory = await fs.mkdtemp(join(root, prefix));
  let value;
  let failed = false;
  let originalError;
  try {
    value = await run(directory);
  } catch (error) {
    failed = true;
    originalError = error;
  }
  try {
    await fs.rm(directory, { recursive: true });
  } catch (cleanupError) {
    if (failed) {
      throw new AggregateError([originalError, cleanupError], '검증과 임시 폴더 정리에 모두 실패했습니다');
    }
    throw cleanupError;
  }
  if (failed) throw originalError;
  return value;
}
