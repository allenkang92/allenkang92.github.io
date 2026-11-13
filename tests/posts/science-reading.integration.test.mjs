import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const siteRoot = process.env.SITE_ROOT ? resolve(process.env.SITE_ROOT) : resolve('_site');

async function readPost(slug) {
  const html = await readFile(resolve(siteRoot, 'posts', slug, 'index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  browser.document.write(html);
  return browser;
}

function expectList(document, prefixes) {
  const lists = [...document.querySelectorAll('.post-content ul')];
  const list = lists.find(element => {
    const items = [...element.children].filter(child => child.tagName === 'LI');
    return items.length === prefixes.length && prefixes.every((prefix, i) => items[i].textContent.trim().startsWith(prefix));
  });
  assert.ok(list, `독립 항목이 목록으로 구분되어야 합니다: ${prefixes.join(' / ')}`);
  return list;
}

test('표준 모형과 우주 진화의 독립 설명은 각각의 목록 항목으로 표시된다', async () => {
  const browser = await readPost('1장-표준-모형-현대물리학의종합');
  try {
    const { document } = browser;
    for (const prefixes of [
      ['쿼크 (6종)', '렙톤 (6종)'],
      ['광자(Photon)', '글루온(Gluon)', 'W⁺, W⁻, Z⁰ 보손'],
      ['힉스 메커니즘', '상호작용의 정도'],
      ['전자의 자기 모멘트', '입자의 발견', '입자 반응의 정확한 기술'],
      ['중력을 설명하지 못함', '암흑 물질과 암흑 에너지를 설명하지 못함', '물질-반물질 비대칭성', '중성미자 질량 문제', '입자 질량의 차이', '전기약 계층 문제', '강한 CP 문제'],
      ['대통일 이론(GUT)', '초대칭성(Supersymmetry)', '끈 이론(String Theory)', '루프 양자 중력(Loop Quantum Gravity)'],
      ['우주의 팽창', '우주 배경 복사', '가벼운 원소의 풍부도'],
      ['첫 별들의 탄생', '초기 은하의 형성과 성장', '은하단과 초은하단'],
      ['암흑 에너지', '우주의 에너지 구성'],
    ]) expectList(document, prefixes);
    const evidence = expectList(document, ['우주의 팽창', '우주 배경 복사', '가벼운 원소의 풍부도']);
    assert.match(evidence.nextElementSibling.textContent, /우주 진화의 주요 단계/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('현대 물리학의 이론별 특징과 한계는 설명 문단과 구분된다', async () => {
  const browser = await readPost('1장-현대-물리학의-도전과-미래');
  try {
    const { document } = browser;
    for (const prefixes of [
      ['모든 입자와 힘을 통합적으로', '추가적인 공간 차원', '중력을 자연스럽게 포함'],
      ['공간을', '면적과 부피 같은 기하량', '블랙홀 내부와 우주의 시작점'],
      ['힘의 통합', '계층 문제', '암흑 물질 후보'],
      ['추가 차원들이', '우리의 우주가'],
      ['장점:', '한계:'],
      ['목표:', '도전 과제:'],
    ]) expectList(document, prefixes);
    const stringTheory = expectList(document, ['모든 입자와 힘을 통합적으로', '추가적인 공간 차원', '중력을 자연스럽게 포함']);
    assert.match(stringTheory.nextElementSibling.textContent, /^그러나 끈 이론/);
  } finally {
    await browser.happyDOM.abort();
  }
});
