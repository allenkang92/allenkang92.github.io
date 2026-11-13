import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const article = await readFile(new URL('../../_posts/2024-09-09-css정리.md', import.meta.url), 'utf8');
const section = article.split('## 1. 디스플레이 크기에 따른 배경색 변경')[1]?.split('## 2. 인쇄 시 스타일 적용')[0];
assert.ok(section, '미디어 쿼리 예제 구간이 있어야 합니다');
const examples = [...section.matchAll(/```css\r?\n([\s\S]*?)```/g)].map(match => match[1]);
assert.equal(examples.length, 3, '기본·모바일 우선·데스크톱 우선 예제가 있어야 합니다');

// 각 코드 블록을 CSSOM과 별도의 matchMedia 판정으로 적용한다.
// 세 예제는 모두 body 선택자의 같은 속성만 바꾸므로 선언 순서가 우선이다.
test('세 미디어 쿼리 예제가 소수 뷰포트 경계에서도 같은 배경색을 지정한다', async () => {
  for (const [width, expected] of [
    [1, 'gold'],
    [767.5, 'gold'],
    [767.999, 'gold'],
    [768, 'lightblue'],
    [768.001, 'lightblue'],
    [1024.5, 'lightblue'],
    [1024.999, 'lightblue'],
    [1025, 'lightpink'],
    [1400, 'lightpink'],
  ]) {
    const browser = new Window({ width, height: 600 });
    try {
      for (const [index, css] of examples.entries()) {
        const sheet = new browser.CSSStyleSheet();
        sheet.replaceSync(css);
        let color = '';
        const apply = rules => {
          for (const rule of rules) {
            if (rule.conditionText !== undefined) {
              if (browser.matchMedia(rule.conditionText).matches) apply(rule.cssRules);
            } else if (rule.selectorText === 'body') {
              color = rule.style.getPropertyValue('background-color') || color;
            }
          }
        };
        apply(sheet.cssRules);
        assert.equal(color, expected, `예제 ${index + 1}, 너비 ${width}px`);
      }
    } finally {
      await browser.happyDOM.abort();
    }
  }
});
