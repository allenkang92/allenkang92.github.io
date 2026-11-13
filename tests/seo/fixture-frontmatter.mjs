import assert from 'node:assert/strict';

// 실제 파일이 아닌 격리 복제본에만 사용할 수정일 치환기다.
export function applyFixtureDate(original, override) {
  const match = original.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, '격리 자료에 front matter가 필요합니다');
  const frontmatter = match[1];
  const existing = [...frontmatter.matchAll(/^last_modified_at:/gm)];
  assert.ok(existing.length <= 1, '수정일이 중복 정의돼 있습니다');
  const fixtureFrontmatter = existing.length
    ? frontmatter.replace(/^last_modified_at:[^\r\n]*(?:\r?\n[ \t]+[^\r\n]*)*/m, () => override)
    : `${frontmatter}\n${override}`;
  return original.replace(match[0], () => `---\n${fixtureFrontmatter}\n---`);
}
