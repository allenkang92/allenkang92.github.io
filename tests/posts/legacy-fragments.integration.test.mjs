import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const siteRoot = process.env.SITE_ROOT || resolve('_site');

test('이전 문단 주소가 같은 주제의 현재 제목을 가리킨다', async () => {
  const cases = [
    ['1장-시대와지역에따른수학발전', '1-0의-개념과-아라비아-숫자', '1-0의-개념과-힌두-아라비아-숫자', '0의 개념과 힌두-아라비아 숫자'],
    ['4장-수학적증명과오류의논리', '2-사영-기하학의-모순', '2-공리-체계-혼동-유클리드-기하학과-사영-기하학', '공리 체계 혼동: 유클리드 기하학과 사영 기하학'],
    ['7장-수학과현실의관계', '1-유효한-수학의-비합리성', '1-수학의-놀라운-유효성', '수학의 놀라운 유효성'],
  ];

  for (const [slug, oldId, currentId, title] of cases) {
    const html = await readFile(resolve(siteRoot, 'posts', slug, 'index.html'), 'utf8');
    const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
    try {
      browser.document.write(html);
      const matches = [...browser.document.querySelectorAll('[id]')].filter(element => element.id === oldId);
      assert.equal(matches.length, 1, `${slug}: 이전 식별자가 정확히 하나여야 합니다`);
      const alias = matches[0];
      const heading = alias.closest('h3');
      assert.ok(heading, `${slug}: 이전 식별자는 현재 제목에 있어야 합니다`);
      assert.equal(alias.getAttribute('aria-hidden'), 'true');
      assert.equal(heading.id, currentId);
      assert.ok(heading.textContent.includes(title));
    } finally {
      await browser.happyDOM.abort();
    }
  }
});
