import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const page = await readFile(new URL('../../_pages/tools.md', import.meta.url), 'utf8');
const scripts = {
  tools: await readFile(new URL('../../assets/js/tools.js', import.meta.url), 'utf8'),
  analytics: await readFile(new URL('../../assets/js/analytics-events.js', import.meta.url), 'utf8'),
};
const workspace = page.match(/<section class="tools-container"[\s\S]*?<\/section>/)?.[0];
assert.ok(workspace, '계산 도구 영역이 있어야 합니다');

function setup({ order = ['tools', 'analytics'], url = 'https://blog.test/tools/?tab=physics&formula=velocity', gtag = true } = {}) {
  const browser = new Window({ url });
  const events = [];
  browser.document.body.innerHTML = workspace;
  if (gtag) browser.gtag = (...args) => events.push(args);
  for (const script of order) browser.eval(scripts[script]);
  browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
  return { browser, events };
}

function change(browser, selector, value, type = 'change') {
  const element = browser.document.querySelector(selector);
  assert.ok(element, `${selector} 입력이 있어야 합니다`);
  element.value = value;
  element.dispatchEvent(new browser.Event(type, { bubbles: true }));
  return element;
}

function keydown(browser, element, options = {}) {
  const event = new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options });
  if (options.prevented) event.preventDefault();
  element.dispatchEvent(event);
  return event;
}

function assertCalculation(events, toolName) {
  assert.equal(events.length, 1, '계산마다 분석 이벤트가 한 번 발생해야 합니다');
  const [kind, name, params] = events[0];
  assert.equal(kind, 'event');
  assert.equal(name, 'tool_calculate');
  assert.deepEqual({ ...params }, { tool_name: toolName }, '입력값이나 검색어 등 추가 정보가 전송되면 안 됩니다');
}

for (const order of [['tools', 'analytics'], ['analytics', 'tools']]) {
  test(`단위·물리 계산의 클릭과 Enter가 각각 한 번 기록된다 (${order.join(' → ')})`, async () => {
    const { browser, events } = setup({ order });
    try {
      const doc = browser.document;
      change(browser, '#unit-category', 'length');
      change(browser, '#from-unit', 'm');
      change(browser, '#to-unit', 'cm');
      const unitInput = change(browser, '#unit-value', '2', 'input');
      keydown(browser, unitInput);
      assert.equal(doc.querySelector('#unit-result').textContent, '200 cm');
      assertCalculation(events, 'unit_converter');
      events.length = 0;
      doc.querySelector('#unit-convert').click();
      assert.equal(doc.querySelector('#unit-result').textContent, '200 cm');
      assertCalculation(events, 'unit_converter');

      events.length = 0;
      change(browser, '#physics-distance', '10', 'input');
      const time = change(browser, '#physics-time', '2', 'input');
      keydown(browser, time);
      assert.equal(doc.querySelector('#physics-result').textContent, '5 m/s');
      assertCalculation(events, 'physics_calculator');
      events.length = 0;
      doc.querySelector('#physics-calculate').click();
      assert.equal(doc.querySelector('#physics-result').textContent, '5 m/s');
      assertCalculation(events, 'physics_calculator');
    } finally {
      await browser.happyDOM.abort();
    }
  });
}

test('수정 키, 한글 조합, 이미 처리된 Enter는 계산과 이벤트를 발생시키지 않는다', async () => {
  const { browser, events } = setup();
  try {
    change(browser, '#unit-category', 'length');
    change(browser, '#from-unit', 'm');
    change(browser, '#to-unit', 'cm');
    const unitInput = change(browser, '#unit-value', '2', 'input');
    change(browser, '#physics-distance', '10', 'input');
    const time = change(browser, '#physics-time', '2', 'input');
    for (const input of [unitInput, time]) {
      for (const options of [{ shiftKey: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { keyCode: 229 }, { prevented: true }]) {
        keydown(browser, input, options);
        assert.equal(events.length, 0, JSON.stringify(options));
        assert.equal(browser.document.querySelector('#unit-result').textContent, '');
        assert.equal(browser.document.querySelector('#physics-result').textContent, '');
      }
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('계산 버튼의 Enter와 프로그래밍 클릭은 중복 없이 기록된다', async () => {
  const { browser, events } = setup();
  try {
    const button = browser.document.querySelector('#unit-convert');
    keydown(browser, button);
    // happy-dom은 키보드의 기본 클릭을 합성하지 않으므로 브라우저 기본 클릭을 별도로 재현한다.
    button.click();
    assertCalculation(events, 'unit_converter');
    events.length = 0;
    button.click();
    assertCalculation(events, 'unit_converter');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('입력 오류도 기존 클릭과 동일하게 기록하고 직접 함수 호출은 기록하지 않는다', async () => {
  const { browser, events } = setup();
  try {
    change(browser, '#unit-category', 'length');
    change(browser, '#from-unit', 'm');
    change(browser, '#to-unit', 'cm');
    const input = browser.document.querySelector('#unit-value');
    keydown(browser, input);
    assert.match(browser.document.querySelector('#unit-result').textContent, /값을.*입력/);
    assertCalculation(events, 'unit_converter');
    events.length = 0;
    change(browser, '#unit-value', '2', 'input');
    browser.performConversion();
    assert.equal(browser.document.querySelector('#unit-result').textContent, '200 cm');
    assert.equal(events.length, 0, '직접 함수 호출은 기존처럼 클릭 이벤트가 아닙니다');
    browser.document.querySelector('[data-equals]').click();
    assertCalculation(events, 'basic_calculator');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('분석 함수가 없거나 실패해도 Enter 계산은 동작한다', async () => {
  for (const mode of ['absent', 'throws', 'disabled', 'localhost']) {
    const { browser, events } = setup({ gtag: mode !== 'absent', url: mode === 'localhost' ? 'http://localhost/tools/' : undefined });
    try {
      if (mode === 'throws') browser.gtag = () => { throw new Error('분석 실패'); };
      if (mode === 'disabled') browser['ga-disable-test'] = true;
      change(browser, '#unit-category', 'length');
      change(browser, '#from-unit', 'm');
      change(browser, '#to-unit', 'cm');
      const input = change(browser, '#unit-value', '2', 'input');
      assert.doesNotThrow(() => keydown(browser, input));
      assert.equal(browser.document.querySelector('#unit-result').textContent, '200 cm', mode);
      assert.equal(events.length, 0, mode);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});
