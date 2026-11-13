import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const toolsPage = await readFile(new URL('../../_pages/tools.md', import.meta.url), 'utf8');
const toolsScript = await readFile(new URL('../../assets/js/tools.js', import.meta.url), 'utf8');

function setup() {
  const window = new Window({ url: 'https://blog.test/tools/' });
  const workspace = toolsPage.match(/<section class="tools-container"[\s\S]*?<\/section>/)?.[0];
  assert.ok(workspace, '실제 도구 페이지에서 계산기 영역을 찾을 수 있어야 한다');
  window.document.body.innerHTML = workspace;
  window.eval(toolsScript);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return window;
}

function calculate(document, input) {
  document.querySelector('[data-action="clear"]').click();
  for (const key of input) {
    const selector = key === '=' ? '[data-equals]' :
      ['+', '-', '×', '÷'].includes(key) ? `[data-operation="${key}"]` : `[data-number="${key}"]`;
    const button = document.querySelector(selector);
    assert.ok(button, `${key} 버튼이 있어야 한다`);
    button.click();
  }
  return document.querySelector('.current-operand').textContent;
}

// 기대값은 도구 구현과 별개로 정수와 고정 소수점 스케일을 이용해 만든다.
function formatScaledInteger(value, scale) {
  const sign = value < 0n ? '-' : '';
  let digits = (value < 0n ? -value : value).toString().padStart(scale + 1, '0');
  if (scale) digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return sign + digits.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

test('0~30 정수 사칙연산과 나누어떨어지는 나눗셈 표본을 계산한다', async () => {
  const window = setup();
  let cases = 0;
  try {
    for (let left = 0; left <= 30; left++) {
      for (let right = 0; right <= 30; right++) {
        for (const operator of ['+', '-', '×', '÷']) {
          if (operator === '÷' && (right === 0 || left % right !== 0)) continue;
          const expression = `${left}${operator}${right}=`;
          const expected = operator === '+' ? left + right : operator === '-' ? left - right :
            operator === '×' ? left * right : left / right;
          assert.equal(calculate(window.document, expression), String(expected), expression);
          cases++;
        }
      }
    }
    assert.equal(cases, 3024);
  } finally {
    await window.happyDOM.abort();
  }
});

test('고정 시드 소수 500쌍을 독립 정수 산술과 대조한다', async () => {
  const window = setup();
  let seed = 1234567;
  let cases = 0;
  const next = () => {
    seed = (seed * 48271) % 2147483647;
    return seed % 1000000;
  };
  try {
    for (let index = 0; index < 500; index++) {
      const left = next();
      const right = next();
      for (const operator of ['+', '-', '×']) {
        const expression = `${formatScaledInteger(BigInt(left), 3)}${operator}${formatScaledInteger(BigInt(right), 3)}=`;
        const exact = operator === '+' ? BigInt(left) + BigInt(right) :
          operator === '-' ? BigInt(left) - BigInt(right) : BigInt(left) * BigInt(right);
        const expected = formatScaledInteger(exact, operator === '×' ? 6 : 3);
        assert.equal(calculate(window.document, expression), expected, expression);
        cases++;
      }
    }
    assert.equal(cases, 1500);
  } finally {
    await window.happyDOM.abort();
  }
});
