import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const toolsPage = await readFile(new URL('../../_pages/tools.md', import.meta.url), 'utf8');
const toolsScript = await readFile(new URL('../../assets/js/tools.js', import.meta.url), 'utf8');

function setup(url = 'https://blog.test/tools/') {
  const browser = new Window({ url });
  const workspace = toolsPage.match(/<section class="tools-container"[\s\S]*?<\/section>/)?.[0];
  assert.ok(workspace, 'tools page must contain the calculator workspace');
  browser.document.body.innerHTML = workspace;
  browser.eval(toolsScript);
  browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
  return browser;
}

test('도구 탭은 수정 키 조합과 한글 조합 입력을 가로채지 않는다', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    const tab = doc.querySelector('#basic-tab');
    const originalUrl = browser.location.href;
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      for (const modifier of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'isComposing']) {
        tab.focus();
        const event = new browser.KeyboardEvent('keydown', {
          key, [modifier]: true, bubbles: true, cancelable: true,
        });
        tab.dispatchEvent(event);
        assert.equal(event.defaultPrevented, false, `${modifier}+${key} 기본 동작`);
        assert.equal(doc.activeElement.id, tab.id, `${modifier}+${key} 포커스`);
        assert.equal(tab.getAttribute('aria-selected'), 'true');
        assert.equal(browser.location.href, originalUrl);
      }
      for (const options of [{ keyCode: 229 }, { prevented: true }]) {
        tab.focus();
        const event = new browser.KeyboardEvent('keydown', {
          key, keyCode: options.keyCode, bubbles: true, cancelable: true,
        });
        if (options.prevented) event.preventDefault();
        tab.dispatchEvent(event);
        assert.equal(doc.activeElement.id, tab.id, `${key}: 이미 처리됐거나 조합 중인 이벤트의 포커스`);
        assert.equal(tab.getAttribute('aria-selected'), 'true');
        assert.equal(browser.location.href, originalUrl);
      }
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('도구 탭은 일반 방향키와 Home·End로 선택과 포커스를 함께 이동한다', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    let current = doc.querySelector('#basic-tab');
    current.focus();
    for (const [key, expected] of [['ArrowLeft', 'unit'], ['ArrowRight', 'basic'], ['End', 'unit'], ['Home', 'basic']]) {
      const event = new browser.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      current.dispatchEvent(event);
      current = doc.querySelector(`#${expected}-tab`);
      assert.equal(event.defaultPrevented, true, `${key} 기본 동작 취소`);
      assert.equal(doc.activeElement.id, current.id, `${key} 포커스`);
      assert.equal(current.getAttribute('aria-selected'), 'true');
      assert.equal(doc.querySelector(`#${expected}-calculator`).hidden, false);
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('다른 탭을 선택할 때 숨겨질 패널의 포커스만 선택한 탭으로 옮긴다', async () => {
  const browser = setup('https://blog.test/tools/?tab=unit&ref=guide#tool-workspace-title');
  try {
    const doc = browser.document;
    const unitPanel = doc.querySelector('#unit-calculator');
    const value = doc.querySelector('#unit-value');
    const physicsTab = doc.querySelector('#physics-tab');
    const unitTab = doc.querySelector('#unit-tab');
    value.focus();
    let oldPanelWasVisible = false;
    physicsTab.addEventListener('focus', () => { oldPanelWasVisible = !unitPanel.hidden; }, { once: true });
    physicsTab.click();
    assert.equal(doc.activeElement?.id, physicsTab.id, '탭 클릭이 포커스를 자동 이동하지 않아도 숨겨지는 입력에서 복구');
    assert.equal(oldPanelWasVisible, true, '기존 패널을 숨기기 전에 포커스를 이동');
    assert.equal(unitPanel.hidden, true);
    assert.equal(physicsTab.getAttribute('aria-selected'), 'true');
    assert.equal(new URL(browser.location.href).searchParams.get('tab'), 'physics');
    assert.equal(new URL(browser.location.href).searchParams.get('ref'), 'guide');

    unitTab.click();
    value.focus();
    unitTab.click();
    assert.equal(doc.activeElement?.id, value.id, '현재 패널을 다시 선택할 때 입력 포커스 유지');
    const outside = doc.createElement('button');
    doc.body.appendChild(outside);
    outside.focus();
    physicsTab.click();
    assert.ok(doc.activeElement === outside, '패널 밖에 있던 포커스를 빼앗지 않음');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('프로그램 탭 전환은 기존 패널의 오류 입력을 숨기기 전에 선택 탭으로 포커스를 옮긴다', async () => {
  const browser = setup('https://blog.test/tools/?tab=unit');
  try {
    const doc = browser.document;
    change(browser, doc.querySelector('#unit-category'), 'length');
    doc.querySelector('#unit-convert').click();
    const input = doc.querySelector('#unit-value');
    assert.equal(doc.activeElement?.id, input.id);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    const originalUrl = browser.location.href;
    browser.switchTab('basic');
    assert.equal(doc.activeElement?.id, 'basic-tab');
    assert.equal(doc.querySelector('#unit-calculator').hidden, true);
    assert.equal(input.getAttribute('aria-invalid'), 'true', '탭 이동만으로 기존 오류 상태를 지우지 않음');
    assert.equal(browser.location.href, originalUrl, '기존 프로그램 호출은 주소를 변경하지 않음');
    browser.switchTab('unit');
    assert.equal(doc.activeElement?.id, 'basic-tab', '패널 밖 포커스는 유지');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('단위 변환 숫자 입력에서 Enter로 검증하고 수정한 값을 변환한다', async () => {
  const browser = setup('https://blog.test/tools/?tab=unit');
  try {
    const doc = browser.document;
    change(browser, doc.querySelector('#unit-category'), 'length');
    change(browser, doc.querySelector('#from-unit'), 'm');
    change(browser, doc.querySelector('#to-unit'), 'cm');
    const value = doc.querySelector('#unit-value');
    value.focus();
    const enter = () => value.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    enter();
    assert.match(doc.querySelector('#unit-result').textContent, /값을.*입력/);
    change(browser, value, '2', 'input');
    enter();
    assert.equal(doc.querySelector('#unit-result').textContent, '200 cm');
    assert.equal(doc.activeElement, value);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('온도 변환 안내는 선택할 때만 값 입력 앞에 표시되고 오류 설명과 함께 유지된다', async () => {
  const browser = setup('https://blog.test/tools/?tab=unit');
  try {
    const doc = browser.document;
    const category = doc.querySelector('#unit-category');
    const value = doc.querySelector('#unit-value');
    const guidance = doc.querySelector('#unit-temperature-guidance');
    const from = doc.querySelector('#from-unit');
    const to = doc.querySelector('#to-unit');
    const result = doc.querySelector('#unit-result');
    const details = doc.querySelector('#unit-calculator details');
    assert.ok(guidance.hidden, '온도 선택 전에는 온도 제약을 숨긴다');
    assert.ok(guidance.compareDocumentPosition(value) & browser.Node.DOCUMENT_POSITION_FOLLOWING, '안내는 값 입력보다 먼저 나온다');
    assert.match(guidance.textContent, /온도 차이는 지원하지 않/);
    assert.match(guidance.textContent, /절대 영도 미만/);
    assert.match(doc.querySelector('#unit-calculator').textContent, /측정 오차는 반영되지 않습니다/);
    assert.match(details.querySelector('summary').textContent, /결과 표시 기준/);
    assert.match(details.textContent, /17자리/);
    assert.match(details.textContent, /같은 단위는 입력값을 그대로/);

    value.setAttribute('aria-describedby', '기존-도움말');
    change(browser, category, 'length');
    assert.equal(guidance.hidden, true);
    assert.equal(value.getAttribute('aria-describedby'), '기존-도움말');
    change(browser, category, 'temperature');
    assert.equal(guidance.hidden, false);
    assert.equal(value.getAttribute('aria-describedby'), '기존-도움말 unit-temperature-guidance');
    change(browser, from, 'c');
    change(browser, to, 'k');
    change(browser, value, '-274', 'input');
    doc.querySelector('#unit-convert').click();
    assert.match(result.textContent, /절대 영도/);
    assert.equal(value.getAttribute('aria-describedby'), '기존-도움말 unit-temperature-guidance unit-result');
    change(browser, value, '-273.15', 'input');
    assert.equal(value.getAttribute('aria-describedby'), '기존-도움말 unit-temperature-guidance');
    doc.querySelector('#unit-convert').click();
    assert.equal(result.textContent, '0 K');

    change(browser, value, '-274', 'input');
    doc.querySelector('#unit-convert').click();
    change(browser, category, 'length');
    assert.equal(guidance.hidden, true);
    assert.equal(value.getAttribute('aria-describedby'), '기존-도움말', '범주 변경 시 안내와 오류 연결만 제거한다');
    assert.equal(value.hasAttribute('aria-invalid'), false);
    assert.equal(result.textContent, '');
    change(browser, category, 'temperature');
    browser.updateUnitOptions();
    assert.equal(value.getAttribute('aria-describedby'), '기존-도움말 unit-temperature-guidance', '반복 초기화에도 안내가 중복되지 않는다');
  } finally { await browser.happyDOM.abort(); }
});

test('단위 변환은 첫 누락 항목의 오류를 연결하고 수정과 재제출 시 정리한다', async () => {
  const browser = setup('https://blog.test/tools/?tab=unit');
  try {
    const doc = browser.document;
    const category = doc.querySelector('#unit-category');
    const value = doc.querySelector('#unit-value');
    const from = doc.querySelector('#from-unit');
    const to = doc.querySelector('#to-unit');
    const result = doc.querySelector('#unit-result');
    const button = doc.querySelector('#unit-convert');
    const help = doc.createElement('span');
    help.id = 'existing-unit-help';
    doc.body.append(help);
    value.setAttribute('aria-describedby', help.id);
    value.setAttribute('aria-invalid', 'false');
    const submit = () => { button.focus(); button.click(); };
    const assertError = (field, text) => {
      assert.match(result.textContent, text);
      assert.equal(doc.activeElement, field);
      assert.equal(field.getAttribute('aria-invalid'), 'true');
      assert.ok(field.getAttribute('aria-describedby').split(/\s+/).includes('unit-result'));
    };

    submit();
    assertError(category, /변환 종류.*선택/);
    change(browser, value, '2', 'input');
    assert.equal(category.getAttribute('aria-invalid'), 'true', '다른 필드 변경은 현재 오류를 지우지 않는다');
    change(browser, category, 'length');
    assert.equal(category.hasAttribute('aria-invalid'), false);
    assert.equal(result.textContent, '');

    change(browser, value, '1e-400', 'input');
    submit();
    assertError(value, /입력값.*범위보다 작/);
    change(browser, value, '', 'input');
    submit();
    assertError(value, /변환할 값.*입력/);
    assert.match(value.getAttribute('aria-describedby'), /existing-unit-help/);
    change(browser, value, '2', 'input');
    assert.equal(value.getAttribute('aria-invalid'), 'false', '기존 속성을 복원한다');
    assert.equal(value.getAttribute('aria-describedby'), 'existing-unit-help');
    assert.equal(result.textContent, '');

    submit();
    assertError(from, /변환 전 단위.*선택/);
    change(browser, from, 'm');
    assert.equal(from.hasAttribute('aria-invalid'), false);
    submit();
    assertError(to, /변환 후 단위.*선택/);
    change(browser, to, 'cm');
    assert.equal(to.hasAttribute('aria-invalid'), false);
    submit();
    assert.equal(result.textContent, '200 cm');
    assert.equal(value.getAttribute('aria-invalid'), 'false');
    assert.equal(value.getAttribute('aria-describedby'), 'existing-unit-help');
  } finally { await browser.happyDOM.abort(); }
});

test('단위 변환 범위와 절대 영도 입력 오류는 값에 연결하고 수정 또는 종류 변경 시 정리한다', async () => {
  const browser = setup('https://blog.test/tools/?tab=unit');
  try {
    const doc = browser.document;
    const category = doc.querySelector('#unit-category');
    const value = doc.querySelector('#unit-value');
    const from = doc.querySelector('#from-unit');
    const to = doc.querySelector('#to-unit');
    const result = doc.querySelector('#unit-result');
    const submit = () => doc.querySelector('#unit-convert').click();
    change(browser, category, 'temperature');
    change(browser, from, 'c');
    change(browser, to, 'k');
    change(browser, value, '-274', 'input');
    submit();
    assert.match(result.textContent, /절대 영도/);
    assert.equal(doc.activeElement, value);
    assert.equal(value.getAttribute('aria-invalid'), 'true');
    assert.match(value.getAttribute('aria-describedby'), /unit-result/);
    change(browser, from, 'f');
    assert.equal(value.hasAttribute('aria-invalid'), false, '입력 온도의 단위를 변경하면 이전 오류를 지운다');
    assert.equal(result.textContent, '');
    submit();
    assert.equal(result.textContent, '103.15 K');
    change(browser, from, 'c');
    submit();
    assert.match(result.textContent, /절대 영도/);
    change(browser, value, '-273.15', 'input');
    assert.equal(value.hasAttribute('aria-invalid'), false);
    assert.equal(value.getAttribute('aria-describedby'), 'unit-temperature-guidance');
    submit();
    assert.equal(result.textContent, '0 K');

    change(browser, value, '1e-400', 'input');
    submit();
    assert.match(result.textContent, /입력값.*범위보다 작/);
    assert.equal(value.getAttribute('aria-invalid'), 'true');
    change(browser, category, 'length');
    assert.equal(value.hasAttribute('aria-invalid'), false);
    assert.equal(value.hasAttribute('aria-describedby'), false);
    assert.equal(result.textContent, '');
    assert.equal(from.value, '');
    assert.equal(to.value, '');
  } finally { await browser.happyDOM.abort(); }
});

test('물리 입력에서 Enter로 검증하고 조합 입력이나 수정 키는 계산하지 않는다', async () => {
  const browser = setup('https://blog.test/tools/?tab=physics&formula=velocity');
  try {
    const doc = browser.document;
    const distance = doc.querySelector('#physics-distance');
    const time = doc.querySelector('#physics-time');
    change(browser, distance, '10', 'input');
    change(browser, time, '0', 'input');
    time.focus();
    const keydown = options => time.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options }));
    keydown({ isComposing: true });
    keydown({ keyCode: 229 });
    keydown({ ctrlKey: true });
    assert.equal(doc.querySelector('#physics-result').textContent, '');
    keydown({});
    assert.match(doc.querySelector('#physics-result').textContent, /0보다 커야/);
    change(browser, time, '2', 'input');
    keydown({});
    assert.equal(doc.querySelector('#physics-result').textContent, '5 m/s');
    assert.equal(doc.activeElement, time);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('숫자 입력의 일반 Enter는 활성 계산 버튼을 한 번 클릭한다', async () => {
  for (const [query, inputSelector, buttonSelector] of [
    ['?tab=unit', '#unit-value', '#unit-convert'],
    ['?tab=physics&formula=velocity', '#physics-time', '#physics-calculate'],
  ]) {
    const browser = setup(`https://blog.test/tools/${query}`);
    try {
      const input = browser.document.querySelector(inputSelector);
      const button = browser.document.querySelector(buttonSelector);
      let clicks = 0;
      button.addEventListener('click', () => { clicks += 1; });
      const fire = options => {
        const event = new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options });
        if (options?.prevented) event.preventDefault();
        input.dispatchEvent(event);
        return event;
      };
      for (const option of [{ key: '1' }, { isComposing: true }, { keyCode: 229 },
        { ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }, { prevented: true }]) {
        fire(option);
      }
      assert.equal(clicks, 0, `${query}: 조합키와 일반 숫자는 클릭하지 않음`);
      assert.equal(fire({}).defaultPrevented, true);
      assert.equal(clicks, 1, `${query}: 일반 Enter는 버튼을 한 번 클릭`);
      button.disabled = true;
      fire({});
      assert.equal(clicks, 1, `${query}: 비활성 버튼은 클릭하지 않음`);
    } finally { await browser.happyDOM.abort(); }
  }
});

test('tool links select their tab and formula without moving focus', async () => {
  for (const [query, tab, formula, expectedInput] of [
    ['?tab=unit', 'unit', '', null],
    ['?tab=physics&formula=acceleration', 'physics', 'acceleration', '#physics-deltaVelocity'],
    ['?tab=physics&formula=kinetic', 'physics', 'kinetic', '#physics-mass'],
  ]) {
    const browser = setup(`https://blog.test/tools/${query}#tool-workspace-title`);
    try {
      const doc = browser.document;
      assert.equal(doc.querySelector(`[data-tab="${tab}"]`).getAttribute('aria-selected'), 'true');
      assert.equal(doc.querySelector(`#${tab}-calculator`).hidden, false);
      assert.equal(doc.querySelector('#basic-calculator').hidden, true);
      assert.equal(doc.querySelector('#physics-formula').value, formula);
      if (expectedInput) assert.ok(doc.querySelector(expectedInput));
      assert.equal(doc.activeElement, doc.body);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('invalid tool URL values leave a usable calculator and tabs', async () => {
  for (const query of ['?tab=__proto__&formula=acceleration', '?tab=physics&formula=__proto__']) {
    const browser = setup(`https://blog.test/tools/${query}`);
    try {
      const doc = browser.document;
      if (query.includes('tab=physics')) {
        assert.equal(doc.querySelector('#physics-formula').value, '');
        assert.equal(doc.querySelector('#physics-calculator').hidden, false);
      } else {
        assert.equal(doc.querySelector('#basic-calculator').hidden, false);
      }
      doc.querySelector('#unit-tab').click();
      assert.equal(doc.querySelector('#unit-tab').getAttribute('aria-selected'), 'true');
      assert.equal(doc.querySelector('#unit-calculator').hidden, false);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('changing a tab or formula keeps the shareable URL consistent', async () => {
  const browser = setup('https://blog.test/tools/?tab=physics&formula=acceleration&ref=guide#tool-workspace-title');
  try {
    const doc = browser.document;
    change(browser, doc.querySelector('#physics-formula'), 'kinetic');
    assert.equal(new URL(browser.location.href).searchParams.get('formula'), 'kinetic');
    doc.querySelector('#unit-tab').click();
    let url = new URL(browser.location.href);
    assert.equal(url.searchParams.get('tab'), 'unit');
    assert.equal(url.searchParams.has('formula'), false);
    assert.equal(url.searchParams.get('ref'), 'guide');
    assert.equal(url.hash, '#tool-workspace-title');
    doc.querySelector('#basic-tab').click();
    url = new URL(browser.location.href);
    assert.equal(url.searchParams.has('tab'), false);
    assert.equal(url.searchParams.get('ref'), 'guide');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('history navigation restores tab and formula without rewriting URL or history', async () => {
  const browser = setup('https://blog.test/tools/?tab=unit');
  try {
    const doc = browser.document;
    browser.history.pushState({ q: 'x' }, '', '?tab=unit&q=x');
    doc.querySelector('#physics-tab').click();
    change(browser, doc.querySelector('#physics-formula'), 'acceleration');
    assert.equal(new URL(browser.location.href).searchParams.get('tab'), 'physics');

    const restore = (path, expectedTab, expectedFormula) => {
      browser.history.replaceState({ marker: path }, '', path);
      const beforeUrl = browser.location.href;
      const beforeLength = browser.history.length;
      browser.dispatchEvent(new browser.PopStateEvent('popstate', { state: { marker: path } }));
      assert.equal(browser.location.href, beforeUrl);
      assert.equal(browser.history.length, beforeLength);
      assert.equal(browser.history.state.marker, path);
      assert.equal(doc.querySelector(`[data-tab="${expectedTab}"]`).getAttribute('aria-selected'), 'true');
      assert.equal(doc.querySelector(`#${expectedTab}-calculator`).hidden, false);
      if (expectedFormula !== undefined) assert.equal(doc.querySelector('#physics-formula').value, expectedFormula);
    };

    restore('?tab=unit', 'unit');
    restore('?tab=physics&formula=kinetic', 'physics', 'kinetic');
    assert.ok(doc.querySelector('#physics-mass'));
    restore('?tab=physics&formula=invalid', 'physics', '');
    assert.equal(doc.querySelector('#physics-mass'), null);
    restore('?tab=invalid', 'basic');
    restore('?q=x', 'basic');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('history restores focus only when the active panel or formula input is removed', async () => {
  const browser = setup('https://blog.test/tools/?tab=physics&formula=kinetic');
  try {
    const doc = browser.document;
    const restore = path => {
      browser.history.replaceState({}, '', path);
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    };

    doc.querySelector('#physics-mass').focus();
    restore('?tab=unit');
    assert.equal(doc.querySelector('#physics-calculator').hidden, true);
    assert.equal(doc.activeElement, doc.querySelector('#unit-tab'));

    restore('?tab=physics&formula=kinetic');
    doc.querySelector('#physics-mass').focus();
    restore('?tab=physics&formula=acceleration');
    assert.equal(doc.querySelector('#physics-mass'), null);
    assert.equal(doc.activeElement, doc.querySelector('#physics-formula'));

    const outside = doc.createElement('button');
    doc.body.appendChild(outside);
    outside.focus();
    restore('?tab=unit');
    assert.equal(doc.activeElement, outside);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('history restoration keeps the focused calculator tab aligned with selection', async () => {
  const browser = setup('https://blog.test/tools/?tab=unit');
  try {
    const doc = browser.document;
    const restore = path => {
      browser.history.replaceState({}, '', path);
      browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    };
    const unitTab = doc.querySelector('#unit-tab');
    const physicsTab = doc.querySelector('#physics-tab');
    physicsTab.click();
    physicsTab.focus();
    assert.equal(doc.activeElement, physicsTab);
    restore('?tab=unit');
    assert.equal(unitTab.getAttribute('aria-selected'), 'true');
    assert.equal(unitTab.tabIndex, 0);
    assert.equal(physicsTab.tabIndex, -1);
    assert.equal(doc.activeElement?.id, 'unit-tab');

    restore('?tab=unit');
    assert.equal(doc.activeElement, unitTab);

    unitTab.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    assert.equal(doc.activeElement, physicsTab);
    assert.equal(physicsTab.getAttribute('aria-selected'), 'true');

    const outside = doc.createElement('button');
    doc.body.appendChild(outside);
    outside.focus();
    restore('?tab=unit');
    assert.equal(unitTab.getAttribute('aria-selected'), 'true');
    assert.equal(doc.activeElement, outside);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('browser back and forward restore calculator after a search history entry', { timeout: 2000 }, async () => {
  const browser = setup('https://blog.test/tools/?tab=unit');
  try {
    const doc = browser.document;
    browser.history.pushState({}, '', '?tab=unit&q=x');
    doc.querySelector('#physics-tab').click();
    change(browser, doc.querySelector('#physics-formula'), 'acceleration');
    const historyLength = browser.history.length;

    const navigate = method => new Promise(resolve => {
      browser.addEventListener('popstate', resolve, { once: true });
      browser.history[method]();
    });
    await navigate('back');
    assert.equal(new URL(browser.location.href).searchParams.get('tab'), 'unit');
    assert.equal(doc.querySelector('#unit-tab').getAttribute('aria-selected'), 'true');
    assert.equal(doc.querySelector('#unit-calculator').hidden, false);
    assert.equal(browser.history.length, historyLength);

    await navigate('forward');
    assert.equal(doc.querySelector('#physics-tab').getAttribute('aria-selected'), 'true');
    assert.equal(doc.querySelector('#physics-formula').value, 'acceleration');
    assert.ok(doc.querySelector('#physics-deltaVelocity'));
    assert.equal(browser.history.length, historyLength);
  } finally {
    await browser.happyDOM.abort();
  }
});

function change(browser, element, value, type = 'change') {
  element.value = value;
  element.dispatchEvent(new browser.Event(type, { bubbles: true }));
}

test('물리 계산의 첫 오류를 입력과 연결하고 수정 후 계산을 복구한다', async () => {
  const browser = setup('https://blog.test/tools/?tab=physics');
  try {
    const doc = browser.document;
    const select = doc.querySelector('#physics-formula');
    const result = doc.querySelector('#physics-result');
    const calculate = doc.querySelector('#physics-calculate');
    select.setAttribute('aria-describedby', 'formula-help');
    select.setAttribute('aria-invalid', 'false');
    calculate.click();
    assert.match(result.textContent, /공식을 선택/);
    assert.equal(doc.activeElement, select);
    assert.equal(select.getAttribute('aria-invalid'), 'true');
    assert.equal(select.getAttribute('aria-describedby'), 'formula-help physics-result');

    change(browser, select, 'velocity');
    assert.equal(select.getAttribute('aria-invalid'), 'false');
    assert.equal(select.getAttribute('aria-describedby'), 'formula-help');
    assert.equal(result.textContent, '');
    const distance = doc.querySelector('#physics-distance');
    const time = doc.querySelector('#physics-time');
    distance.setAttribute('aria-describedby', 'distance-help');
    distance.setAttribute('aria-invalid', 'false');
    calculate.click();
    assert.match(result.textContent, /총 이동 거리.*입력/);
    assert.equal(doc.activeElement, distance);
    assert.equal(distance.getAttribute('aria-invalid'), 'true');
    assert.equal(distance.getAttribute('aria-describedby'), 'distance-help physics-result');
    change(browser, time, '2', 'input');
    assert.match(result.textContent, /총 이동 거리.*입력/, '다른 입력 수정은 현재 오류를 유지한다');
    change(browser, distance, '10', 'input');
    assert.equal(distance.getAttribute('aria-invalid'), 'false');
    assert.equal(distance.getAttribute('aria-describedby'), 'distance-help');
    assert.equal(result.textContent, '');
    time.focus();
    time.dispatchEvent(new browser.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assert.equal(result.textContent, '5 m/s');
    assert.equal(doc.activeElement, time);
  } finally { await browser.happyDOM.abort(); }
});

test('물리 계산의 입력별 범위 오류를 해당 필드에 연결하고 복구한다', async () => {
  const browser = setup('https://blog.test/tools/?tab=physics&formula=velocity');
  try {
    const doc = browser.document;
    const result = doc.querySelector('#physics-result');
    const calculate = doc.querySelector('#physics-calculate');
    const select = doc.querySelector('#physics-formula');
    const distance = doc.querySelector('#physics-distance');
    const time = doc.querySelector('#physics-time');
    const check = (field, message) => {
      calculate.click();
      assert.match(result.textContent, message);
      assert.equal(doc.activeElement, field);
      assert.equal(field.getAttribute('aria-invalid'), 'true');
      assert.ok(field.getAttribute('aria-describedby').split(/\s+/).includes('physics-result'));
    };
    change(browser, distance, '1e-400', 'input');
    check(distance, /범위보다 작/);
    change(browser, distance, '-1', 'input');
    check(distance, /0 이상/);
    change(browser, distance, `1.${'0'.repeat(1000)}`, 'input');
    check(distance, /너무 깁니다/);
    change(browser, distance, '10', 'input');
    change(browser, time, '0', 'input');
    check(time, /0보다 커야/);
    change(browser, time, '2', 'input');
    calculate.click();
    assert.equal(result.textContent, '5 m/s');
    assert.equal(time.hasAttribute('aria-invalid'), false);

    change(browser, select, 'force');
    const mass = doc.querySelector('#physics-mass');
    change(browser, mass, '-1', 'input');
    check(mass, /0 이상/);
    change(browser, mass, '2', 'input');
    change(browser, doc.querySelector('#physics-acceleration'), '3', 'input');
    calculate.click();
    assert.equal(result.textContent, '6 N');
  } finally { await browser.happyDOM.abort(); }
});

test('물리 계산 오류는 탭 전환에서 보존하고 이력의 공식 변경에서 정리한다', async () => {
  const browser = setup('https://blog.test/tools/?tab=physics&formula=velocity');
  try {
    const doc = browser.document;
    const distance = doc.querySelector('#physics-distance');
    const result = doc.querySelector('#physics-result');
    doc.querySelector('#physics-calculate').click();
    assert.equal(distance.getAttribute('aria-invalid'), 'true');
    doc.querySelector('#unit-tab').click();
    doc.querySelector('#physics-tab').click();
    assert.equal(distance.getAttribute('aria-invalid'), 'true');
    assert.match(result.textContent, /총 이동 거리.*입력/);
    distance.focus();
    browser.history.replaceState({}, '', '?tab=physics&formula=force');
    browser.dispatchEvent(new browser.PopStateEvent('popstate'));
    assert.equal(doc.activeElement, doc.querySelector('#physics-formula'));
    assert.equal(distance.hasAttribute('aria-invalid'), false, '제거되는 기존 필드의 오류 속성을 복원한다');
    assert.equal(distance.hasAttribute('aria-describedby'), false);
    assert.equal(result.textContent, '');
    assert.ok(doc.querySelector('#physics-mass'));
  } finally { await browser.happyDOM.abort(); }
});

function pressKeys(doc, keys) {
  for (const key of keys) {
    const selector = key === '=' ? '[data-equals]' : key === '±' ? '[data-action="sign"]' :
      ['+', '-', '×', '÷'].includes(key) ? `[data-operation="${key}"]` : `[data-number="${key}"]`;
    const button = doc.querySelector(selector);
    assert.ok(button, `calculator button ${key} exists`);
    button.click();
  }
}

test('sign button allows negative operands without changing the selected operator', async () => {
  for (const [keys, expected] of [
    [['2', '×', '±', '3', '='], '-6'],
    [['±', '3', '+', '5', '='], '2'],
    [['±', '.', '5', '×', '2', '='], '-1'],
    [['2', '×', '-', '±', '3', '='], '5'],
    [['1', '÷', '±', '2', '='], '-0.5'],
    [['±', '0', '+', '1', '='], '1'],
    [['±', '±', '3'], '3'],
    [['0', '0', '3'], '3'],
    [['2', '+', '3', '=', '×', '±', '3', '='], '-15'],
  ]) {
    const browser = setup();
    try {
      const doc = browser.document;
      pressKeys(doc, keys);
      assert.equal(doc.querySelector('.current-operand').textContent, expected, keys.join(''));
      assert.equal(doc.querySelector('#calculator-error').hidden, true, keys.join(''));
    } finally { await browser.happyDOM.abort(); }
  }
});

test('sign toggling preserves focus and supports deletion, results, exponents and error recovery', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    const sign = doc.querySelector('[data-action="sign"]');
    assert.equal(sign.getAttribute('aria-label'), '± 부호 바꾸기');
    assert.match(sign.textContent, /부호/);
    const display = doc.querySelector('.calculator-display');
    const previousLine = display.querySelector('.previous-operand-line');
    assert.equal(display.getAttribute('role'), 'status');
    assert.equal(display.getAttribute('aria-atomic'), 'true');
    assert.match(display.textContent, /현재 입력:/);
    assert.equal(previousLine.hidden, true);
    sign.focus();
    sign.click();
    assert.equal(doc.activeElement, sign);
    assert.equal(doc.querySelector('.current-operand').textContent, '-0');
    doc.querySelector('[data-action="delete"]').click();
    assert.equal(doc.querySelector('.current-operand').textContent, '0');
    pressKeys(doc, ['2', '×', '±', '3']);
    doc.querySelector('[data-action="delete"]').click();
    assert.equal(doc.querySelector('.current-operand').textContent, '-0');
    pressKeys(doc, ['4', '=']);
    assert.equal(doc.querySelector('.current-operand').textContent, '-8');
    doc.querySelector('[data-action="clear"]').click();
    pressKeys(doc, ['2', '×']);
    assert.equal(previousLine.hidden, false);
    assert.match(previousLine.textContent, /이전 계산:\s*2 ×/);
    doc.querySelector('[data-action="clear"]').click();
    assert.equal(previousLine.hidden, true);
    pressKeys(doc, [...'2+3=', '±', '×', '2', '=']);
    assert.equal(doc.querySelector('.current-operand').textContent, '-10');
    doc.querySelector('[data-action="clear"]').click();
    pressKeys(doc, [...'1000000000000000000000+1-1=', '±']);
    assert.equal(doc.querySelector('.current-operand').textContent, '-1e+21');
    pressKeys(doc, ['÷', '2', '=']);
    assert.equal(doc.querySelector('.current-operand').textContent, '-500000000000000000000');
    doc.querySelector('[data-action="clear"]').click();
    pressKeys(doc, [...'1÷0=', '±', '.', '5', '+', '1', '=']);
    assert.equal(doc.querySelector('.current-operand').textContent, '0.5');
    assert.equal(doc.querySelector('#calculator-error').hidden, true);
  } finally { await browser.happyDOM.abort(); }
});

test('decimal starts a new number after a fractional result', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    pressKeys(doc, ['1', '÷', '2', '=']);
    assert.equal(doc.querySelector('.current-operand').textContent, '0.5');
    pressKeys(doc, ['.', '7']);
    assert.equal(Number(doc.querySelector('.current-operand').textContent), 0.7);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('부호를 바꾼 결과에서 삭제하면 표시된 값을 편집한다', async () => {
  for (const prefix of [['5', '±'], ['2', '+', '3', '=', '±']]) {
    const browser = setup();
    try {
      const doc = browser.document;
      const current = doc.querySelector('.current-operand');
      pressKeys(doc, prefix);
      assert.equal(current.textContent, '-5');
      doc.querySelector('[data-action="delete"]').click();
      assert.equal(current.textContent, '-0', prefix.join(''));
      pressKeys(doc, ['4', '+', '1', '=']);
      assert.equal(current.textContent, '-3', prefix.join(''));
    } finally { await browser.happyDOM.abort(); }
  }
});

test('부호를 바꾼 결과에서 새 입력, 반복 부호 변경과 근삿값을 유지한다', async () => {
  for (const [keys, expected] of [
    [['2', '+', '3', '=', '±', '4'], '4'],
    [['2', '+', '3', '=', '±', '.', '4'], '0.4'],
    [['2', '+', '3', '=', '±', '×', '3', '='], '-15'],
  ]) {
    const browser = setup();
    try {
      pressKeys(browser.document, keys);
      assert.equal(browser.document.querySelector('.current-operand').textContent, expected, keys.join(''));
    } finally { await browser.happyDOM.abort(); }
  }

  const browser = setup();
  try {
    const doc = browser.document;
    const current = doc.querySelector('.current-operand');
    const del = doc.querySelector('[data-action="delete"]');
    pressKeys(doc, ['2', '+', '3', '=', '±', '±']);
    del.click();
    assert.equal(current.textContent, '0');
    pressKeys(doc, ['4']);
    assert.equal(current.textContent, '4');
    doc.querySelector('[data-action="clear"]').click();
    pressKeys(doc, ['1', '÷', '3', '=', '±']);
    del.click();
    assert.equal(current.textContent, '-0.3333333333333333');
    assert.equal(doc.querySelector('#calculator-precision-notice').hidden, false);
    pressKeys(doc, ['+', '1', '=']);
    assert.equal(doc.querySelector('#calculator-precision-notice').hidden, false);
    doc.querySelector('[data-action="clear"]').click();
    pressKeys(doc, ['1', '÷', '0', '=', '±', '3']);
    assert.equal(current.textContent, '-3');
    assert.equal(doc.querySelector('#calculator-error').hidden, true);
  } finally { await browser.happyDOM.abort(); }
});

test('지수 표기 결과를 삭제할 때 불완전한 지수 표기가 남지 않는다', async () => {
  for (const [keys, intermediate] of [
    [[...'1000000000000000000000+1-1=', '±'], '-1e+2'],
    [[...'1÷10000000=', '±'], null],
  ]) {
    const browser = setup();
    try {
      const doc = browser.document;
      const current = doc.querySelector('.current-operand');
      const del = doc.querySelector('[data-action="delete"]');
      pressKeys(doc, keys);
      if (intermediate) {
        del.click();
        assert.equal(current.textContent, intermediate);
      }
      del.click();
      assert.equal(current.textContent, '-1');
      pressKeys(doc, ['+', '2', '=']);
      assert.equal(current.textContent, '1');
    } finally { await browser.happyDOM.abort(); }
  }

  const browser = setup();
  try {
    const doc = browser.document;
    pressKeys(doc, [...'1÷10000000=', '±']);
    doc.querySelector('[data-action="delete"]').click();
    doc.querySelector('[data-action="delete"]').click();
    assert.equal(doc.querySelector('.current-operand').textContent, '-0');
    pressKeys(doc, ['4']);
    assert.equal(doc.querySelector('.current-operand').textContent, '-4');
  } finally { await browser.happyDOM.abort(); }
});

test('지수 표기를 편집할 때 소수점으로 잘못된 지수부를 만들지 않는다', async () => {
  for (const [input, partial, continued, expected] of [
    ['1000000000000000000000+1-1=', '-1e+2', '-1e+23', '-1e+23'],
    ['1÷10000000000=', '-1e-1', '-1e-13', '-1e-13'],
    ['1200000000000000000000+1-1=', '-1.2e+2', '-1.2e+23', '-1.2e+23'],
  ]) {
    const browser = setup();
    try {
      const doc = browser.document;
      const current = doc.querySelector('.current-operand');
      pressKeys(doc, [...input, '±']);
      doc.querySelector('[data-action="delete"]').click();
      assert.equal(current.textContent, partial);
      pressKeys(doc, ['.']);
      assert.equal(current.textContent, partial, '지수부에는 소수점을 추가하지 않는다');
      pressKeys(doc, ['3']);
      assert.equal(current.textContent, continued, '지수 숫자 편집은 유지한다');
      pressKeys(doc, ['÷', '1', '=']);
      assert.equal(current.textContent, expected, '편집한 값으로 계산할 수 있다');
      assert.equal(doc.querySelector('#calculator-error').hidden, true);
    } finally { await browser.happyDOM.abort(); }
  }

  const browser = setup();
  try {
    const doc = browser.document;
    const current = doc.querySelector('.current-operand');
    pressKeys(doc, [...'1÷10000000000=', '±']);
    const del = doc.querySelector('[data-action="delete"]');
    del.click();
    del.click();
    assert.equal(current.textContent, '-1');
    pressKeys(doc, ['.', '5', '+', '2', '=']);
    assert.equal(current.textContent, '0.5', '지수부가 없어지면 소수점 입력을 허용한다');
    pressKeys(doc, ['.', '4']);
    assert.equal(current.textContent, '0.4', '결과 직후 소수점은 새 입력을 시작한다');
  } finally { await browser.happyDOM.abort(); }
});

test('a result used as the first operand stays selected when deleting before the next input', async () => {
  for (const prefix of [['5', '×'], ['2', '+', '3', '=', '×']]) {
    const browser = setup();
    try {
      const doc = browser.document;
      pressKeys(doc, prefix);
      const previous = doc.querySelector('.previous-operand');
      const current = doc.querySelector('.current-operand');
      assert.equal(previous.textContent, '5 ×');
      assert.equal(current.textContent, '0');
      doc.querySelector('[data-action="delete"]').click();
      assert.equal(previous.textContent, '5 ×', `${prefix.join('')}: 이전 연산 유지`);
      assert.equal(current.textContent, '0');
      pressKeys(doc, ['±', '3', '=']);
      assert.equal(current.textContent, '-15');
    } finally { await browser.happyDOM.abort(); }
  }
});

test('deleting after selecting an operator preserves an approximate result and allows operator replacement', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    pressKeys(doc, ['1', '÷', '3', '=', '×']);
    const notice = doc.querySelector('#calculator-precision-notice');
    assert.equal(notice.hidden, false);
    doc.querySelector('[data-action="delete"]').click();
    assert.equal(doc.querySelector('.previous-operand').textContent, '0.33333333333333333 ×');
    assert.equal(notice.hidden, false);
    pressKeys(doc, ['+', '.', '5', '=']);
    assert.equal(doc.querySelector('.current-operand').textContent, '0.83333333333333333');
    assert.equal(notice.hidden, false);
  } finally { await browser.happyDOM.abort(); }
});

test('지운 근삿값을 새 숫자로 바꾸면 현재 피연산자의 근삿값 안내를 해제한다', async () => {
  for (const signs of [['±'], ['±', '±']]) {
    const browser = setup();
    try {
      const doc = browser.document;
      const current = doc.querySelector('.current-operand');
      const notice = doc.querySelector('#calculator-precision-notice');
      const remove = () => doc.querySelector('[data-action="delete"]').click();
      pressKeys(doc, ['1', '÷', '3', '=', ...signs]);
      remove();
      assert.equal(notice.hidden, false, '일부 자릿수만 지우면 근삿값 안내를 유지한다');
      for (let i = 0; i < 25 && !/^-?0(?:\.0*)?$/.test(current.textContent); i++) remove();
      assert.match(current.textContent, /^-?0(?:\.0*)?$/, '0 이외의 입력 자릿수가 모두 지워졌다');
      assert.equal(notice.hidden, true, '현재 피연산자가 모두 지워지면 안내를 해제한다');
      pressKeys(doc, ['1', '÷', '1', '=']);
      assert.equal(current.textContent, signs.length === 1 ? '-0.1' : '0.1');
      assert.equal(notice.hidden, true, '새 정확한 값으로 계산한 뒤에도 안내를 보이지 않는다');
    } finally { await browser.happyDOM.abort(); }
  }
});

test('현재 입력을 모두 지워도 대기 중인 이전 근삿값 안내는 유지한다', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    const notice = doc.querySelector('#calculator-precision-notice');
    pressKeys(doc, ['1', '÷', '3', '=', '×', '±', '1']);
    doc.querySelector('[data-action="delete"]').click();
    assert.equal(doc.querySelector('.current-operand').textContent, '-0');
    assert.equal(notice.hidden, false, '이전 피연산자가 근삿값이면 안내를 유지한다');
    pressKeys(doc, ['2', '=']);
    assert.equal(doc.querySelector('.current-operand').textContent, '-0.66666666666666666');
    assert.equal(notice.hidden, false);
  } finally { await browser.happyDOM.abort(); }
});

test('division by zero during chained operation preserves the error until recovery', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    pressKeys(doc, ['1', '÷', '0', '+']);
    assert.equal(doc.querySelector('.current-operand').textContent, '오류');
    assert.equal(doc.querySelector('.previous-operand').textContent, '');
    assert.match(doc.querySelector('#calculator-error').textContent, /숫자를 다시 입력/);
    pressKeys(doc, ['+', '2']);
    assert.equal(doc.querySelector('.current-operand').textContent, '2');
    assert.equal(doc.querySelector('.previous-operand').textContent, '');
    assert.equal(doc.querySelector('#calculator-error').hidden, true);
    pressKeys(doc, ['+', '3', '=']);
    assert.equal(doc.querySelector('.current-operand').textContent, '5');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('chained arithmetic retains successful intermediate results', async () => {
  const browser = setup();
  try {
    pressKeys(browser.document, ['1', '+', '2', '+', '3', '=']);
    assert.equal(browser.document.querySelector('.current-operand').textContent, '6');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('basic arithmetic preserves entered decimal digits and avoids binary rounding noise', async () => {
  const cases = [
    ['1234567890123+1=', '1234567890124'],
    ['1+0.000000000001=', '1.000000000001'],
    ['1+0.000000000000001=', '1.000000000000001'],
    ['0.1+0.2=', '0.3'],
    ['0.3-0.2=', '0.1'],
    ['0.3÷0.1=', '3'],
    ['9007199254740993+1=', '9007199254740994'],
    ['1234567890123+1+2=', '1234567890126'],
    ['1-2=', '-1'],
  ];
  for (const [keys, expected] of cases) {
    const browser = setup();
    try {
      pressKeys(browser.document, [...keys]);
      assert.equal(browser.document.querySelector('.current-operand').textContent, expected, keys);
      assert.equal(browser.document.querySelector('#calculator-error').hidden, true, keys);
      assert.equal(browser.document.querySelector('#calculator-precision-notice').hidden, true, keys);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('non-terminating division keeps its approximation notice through subsequent calculations', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    pressKeys(doc, [...'1÷3=']);
    assert.equal(doc.querySelector('.current-operand').textContent, '0.33333333333333333');
    const notice = doc.querySelector('#calculator-precision-notice');
    assert.equal(notice.hidden, false);
    assert.match(notice.textContent, /근삿값/);
    pressKeys(doc, [...'×3']);
    assert.equal(notice.hidden, false);
    pressKeys(doc, ['=']);
    assert.equal(doc.querySelector('.current-operand').textContent, '0.99999999999999999');
    assert.equal(notice.hidden, false);
    pressKeys(doc, ['7']);
    assert.equal(notice.hidden, true);
    assert.equal(doc.querySelector('.current-operand').textContent, '7');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('decimal division handles signed results, rounding and scientific-notation reuse', async () => {
  const cases = [
    ['2÷6=', '0.33333333333333333', true],
    ['1÷6=', '0.16666666666666667', true],
    ['0-1÷3=', '-0.33333333333333333', true],
    ['0÷7=', '0', false],
    ['1÷8=', '0.125', false],
    ['1000000000000000000000+1-1=', '1e+21', false],
    ['0.0000001÷2×2=', '1e-7', false],
  ];
  for (const [keys, expected, approximate] of cases) {
    const browser = setup();
    try {
      pressKeys(browser.document, [...keys]);
      assert.equal(browser.document.querySelector('.current-operand').textContent, expected, keys);
      assert.equal(browser.document.querySelector('#calculator-precision-notice').hidden, !approximate, keys);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('out-of-range calculator input and result show an error and allow recovery', async () => {
  const cases = [
    [...'9'.repeat(309), '+'],
    [...'1÷0.', ...'0'.repeat(323), '1', '='],
    [...'9'.repeat(308), '×', '9', '='],
    [...'1'.repeat(1001), '+'],
    ['0', '.', ...'0'.repeat(1000), '+'],
    [...`1.${'1'.repeat(500)}×1.${'1'.repeat(500)}=`],
  ];
  for (const keys of cases) {
    const browser = setup();
    try {
      const doc = browser.document;
      pressKeys(doc, keys);
      assert.equal(doc.querySelector('.current-operand').textContent, '오류');
      assert.match(doc.querySelector('#calculator-error').textContent, /범위/);
      assert.doesNotMatch(doc.querySelector('#calculator-error').textContent, /0으로 나눌/);
      pressKeys(doc, [...'2+3=']);
      assert.equal(doc.querySelector('.current-operand').textContent, '5');
      assert.equal(doc.querySelector('#calculator-error').hidden, true);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('physics result is invalidated when a dynamically created input changes', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    change(browser, doc.querySelector('#physics-formula'), 'velocity');
    change(browser, doc.querySelector('#physics-distance'), '100', 'input');
    change(browser, doc.querySelector('#physics-time'), '10', 'input');
    doc.querySelector('#physics-calculate').click();
    const result = doc.querySelector('#physics-result');
    assert.equal(result.textContent, '10 m/s');
    assert.equal(result.getAttribute('role'), 'status');

    change(browser, doc.querySelector('#physics-time'), '20', 'input');
    assert.equal(result.textContent, '입력이 변경되었습니다. 다시 계산해 주세요.');
    doc.querySelector('#physics-calculate').click();
    assert.equal(result.textContent, '5 m/s');

    change(browser, doc.querySelector('#physics-formula'), 'force');
    assert.equal(result.textContent, '');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('physics and conversions retain significant digits and identify rounded output', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    change(browser, doc.querySelector('#physics-formula'), 'force');
    const mass = doc.querySelector('#physics-mass');
    const acceleration = doc.querySelector('#physics-acceleration');
    const physicsResult = doc.querySelector('#physics-result');
    for (const [m, a, expected] of [
      ['1234567890123', '1', '1234567890123 N'],
      ['0.1', '0.2', '0.02 N'],
      ['12345678901234567', '1', '12345678901234567 N'],
      ['123456789012345678', '1', '123456789012345680 N (근삿값)'],
      [`1.${'1'.repeat(500)}`, `1.${'1'.repeat(500)}`, '1.2345679012345679 N (근삿값)'],
    ]) {
      change(browser, mass, m, 'input');
      change(browser, acceleration, a, 'input');
      doc.querySelector('#physics-calculate').click();
      assert.equal(physicsResult.textContent, expected);
    }
    change(browser, doc.querySelector('#physics-formula'), 'velocity');
    change(browser, doc.querySelector('#physics-distance'), '1', 'input');
    change(browser, doc.querySelector('#physics-time'), '3', 'input');
    doc.querySelector('#physics-calculate').click();
    assert.equal(physicsResult.textContent, '0.33333333333333333 m/s (근삿값)');

    change(browser, doc.querySelector('#unit-category'), 'length');
    change(browser, doc.querySelector('#from-unit'), 'm');
    change(browser, doc.querySelector('#to-unit'), 'mm');
    change(browser, doc.querySelector('#unit-value'), '1234567890123', 'input');
    doc.querySelector('#unit-convert').click();
    assert.equal(doc.querySelector('#unit-result').textContent, '1234567890123000 mm');
    change(browser, doc.querySelector('#from-unit'), 'mm');
    change(browser, doc.querySelector('#to-unit'), 'in');
    change(browser, doc.querySelector('#unit-value'), '1', 'input');
    doc.querySelector('#unit-convert').click();
    assert.equal(doc.querySelector('#unit-result').textContent, '0.03937007874015748 in (근삿값)');
    change(browser, doc.querySelector('#to-unit'), 'mm');
    change(browser, doc.querySelector('#unit-value'), '123456789012345678', 'input');
    doc.querySelector('#unit-convert').click();
    assert.equal(doc.querySelector('#unit-result').textContent, '123456789012345678 mm');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('all length, mass and time unit pairs match independent reference factors', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    const reference = {
      length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048 },
      mass: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, oz: 0.028349523125 },
      time: { s: 1, min: 60, h: 3600, day: 86400 },
    };
    for (const [category, factors] of Object.entries(reference)) {
      change(browser, doc.querySelector('#unit-category'), category);
      change(browser, doc.querySelector('#unit-value'), '17.25', 'input');
      for (const [from, fromFactor] of Object.entries(factors)) {
        for (const [to, toFactor] of Object.entries(factors)) {
          change(browser, doc.querySelector('#from-unit'), from);
          change(browser, doc.querySelector('#to-unit'), to);
          doc.querySelector('#unit-convert').click();
          const output = doc.querySelector('#unit-result').textContent;
          const actual = Number.parseFloat(output);
          const expected = 17.25 * fromFactor / toFactor;
          assert.ok(Math.abs(actual / expected - 1) < 1e-14, `${category}: ${from} to ${to}: ${output}`);
        }
      }
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('physical formulas reject negative mass while preserving zero mass and signed quantities', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    doc.querySelector('#physics-tab').click();
    const result = doc.querySelector('#physics-result');
    for (const [formula, values, expected] of [
      ['force', { acceleration: '-3' }, '0 N'],
      ['kinetic', { velocity: '-3' }, '0 J'],
      ['potential', { gravity: '9.8', height: '-2' }, '0 J'],
    ]) {
      change(browser, doc.querySelector('#physics-formula'), formula);
      for (const [field, value] of Object.entries(values)) change(browser, doc.querySelector(`#physics-${field}`), value, 'input');
      const mass = doc.querySelector('#physics-mass');
      change(browser, mass, '-2', 'input');
      doc.querySelector('#physics-calculate').click();
      assert.match(result.textContent, /질량.*0 이상/);
      assert.equal(doc.activeElement, mass);
      change(browser, mass, '0', 'input');
      doc.querySelector('#physics-calculate').click();
      assert.equal(result.textContent, expected);
    }
    change(browser, doc.querySelector('#physics-formula'), 'acceleration');
    change(browser, doc.querySelector('#physics-deltaVelocity'), '-20', 'input');
    change(browser, doc.querySelector('#physics-time'), '5', 'input');
    doc.querySelector('#physics-calculate').click();
    assert.equal(result.textContent, '-4 m/s²');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('elapsed time must be positive, and changing it allows recovery', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    doc.querySelector('#physics-tab').click();
    const result = doc.querySelector('#physics-result');
    for (const [formula, field] of [['velocity', 'distance'], ['acceleration', 'deltaVelocity']]) {
      change(browser, doc.querySelector('#physics-formula'), formula);
      change(browser, doc.querySelector(`#physics-${field}`), '10', 'input');
      const time = doc.querySelector('#physics-time');
      for (const invalid of ['0', '-2']) {
        change(browser, time, invalid, 'input');
        doc.querySelector('#physics-calculate').click();
        assert.match(result.textContent, /시간.*0보다 커야/);
        assert.equal(doc.activeElement, time);
      }
      change(browser, time, '2', 'input');
      doc.querySelector('#physics-calculate').click();
      assert.equal(result.textContent, formula === 'velocity' ? '5 m/s' : '5 m/s²');
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('distance is nonnegative in the distance over elapsed time calculation', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    doc.querySelector('#physics-tab').click();
    change(browser, doc.querySelector('#physics-formula'), 'velocity');
    assert.match(doc.querySelector('#physics-formula option[value="velocity"]').textContent, /평균 속력/);
    assert.match(doc.querySelector('#physics-formula-display').textContent, /평균 속력/);
    assert.match(doc.querySelector('label[for="physics-distance"]').textContent, /총 이동 거리/);
    assert.match(doc.querySelector('label[for="physics-time"]').textContent, /경과 시간/);
    const distance = doc.querySelector('#physics-distance');
    change(browser, distance, '-10', 'input');
    change(browser, doc.querySelector('#physics-time'), '2', 'input');
    doc.querySelector('#physics-calculate').click();
    assert.match(doc.querySelector('#physics-result').textContent, /거리.*0 이상/);
    assert.equal(doc.activeElement, distance);
    change(browser, distance, '0', 'input');
    doc.querySelector('#physics-calculate').click();
    assert.equal(doc.querySelector('#physics-result').textContent, '0 m/s');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('absolute temperature conversion accepts absolute zero and rejects values below it', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    doc.querySelector('#unit-tab').click();
    change(browser, doc.querySelector('#unit-category'), 'temperature');
    const input = doc.querySelector('#unit-value');
    const result = doc.querySelector('#unit-result');
    change(browser, doc.querySelector('#to-unit'), 'k');
    for (const [unit, boundary, invalid] of [
      ['k', '0', '-0.001'], ['c', '-273.15', '-273.151'], ['f', '-459.67', '-459.671'],
    ]) {
      change(browser, doc.querySelector('#from-unit'), unit);
      change(browser, input, invalid, 'input');
      doc.querySelector('#unit-convert').click();
      assert.match(result.textContent, /절대\s*영도/);
      assert.equal(doc.activeElement, input);
      change(browser, input, boundary, 'input');
      doc.querySelector('#unit-convert').click();
      assert.equal(result.textContent, '0 K');
    }
    change(browser, doc.querySelector('#from-unit'), 'c');
    change(browser, doc.querySelector('#to-unit'), 'f');
    change(browser, input, '-40', 'input');
    doc.querySelector('#unit-convert').click();
    assert.equal(result.textContent, '-40 °F');
    change(browser, doc.querySelector('#to-unit'), 'c');
    change(browser, input, '1e-15', 'input');
    doc.querySelector('#unit-convert').click();
    assert.equal(result.textContent, '1e-15 °C');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('all temperature pairs preserve the freezing-point reference and exact lower boundary', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    change(browser, doc.querySelector('#unit-category'), 'temperature');
    const values = { c: '0', f: '32', k: '273.15' };
    const labels = { c: '°C', f: '°F', k: 'K' };
    for (const [from, input] of Object.entries(values)) {
      for (const [to, expected] of Object.entries(values)) {
        change(browser, doc.querySelector('#from-unit'), from);
        change(browser, doc.querySelector('#to-unit'), to);
        change(browser, doc.querySelector('#unit-value'), input, 'input');
        doc.querySelector('#unit-convert').click();
        assert.equal(doc.querySelector('#unit-result').textContent, `${expected} ${labels[to]}`);
      }
    }
    change(browser, doc.querySelector('#from-unit'), 'f');
    change(browser, doc.querySelector('#to-unit'), 'k');
    change(browser, doc.querySelector('#unit-value'), '-459.6700000000000001', 'input');
    doc.querySelector('#unit-convert').click();
    assert.match(doc.querySelector('#unit-result').textContent, /절대 영도/);
    change(browser, doc.querySelector('#unit-value'), '-459.6699999999999999', 'input');
    doc.querySelector('#unit-convert').click();
    assert.equal(doc.querySelector('#unit-result').textContent, '5.5555555555555556e-17 K (근삿값)');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('같은 단위는 유효한 작은 입력을 보존하고 입력 검증은 유지한다', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    const value = doc.querySelector('#unit-value');
    const result = doc.querySelector('#unit-result');
    const calculate = () => doc.querySelector('#unit-convert').click();
    change(browser, doc.querySelector('#unit-category'), 'length');
    change(browser, doc.querySelector('#from-unit'), 'm');
    change(browser, doc.querySelector('#to-unit'), 'm');
    change(browser, value, '4e-324', 'input');
    calculate();
    assert.equal(result.textContent, '4e-324 m');

    change(browser, doc.querySelector('#to-unit'), 'mm');
    calculate();
    assert.equal(result.textContent, '4e-321 mm');
    change(browser, value, '1e-324', 'input');
    calculate();
    assert.match(result.textContent, /입력값.*범위보다 작/);

    change(browser, doc.querySelector('#unit-category'), 'temperature');
    change(browser, doc.querySelector('#from-unit'), 'k');
    change(browser, doc.querySelector('#to-unit'), 'k');
    change(browser, value, '4e-324', 'input');
    calculate();
    assert.equal(result.textContent, '4e-324 K');
    change(browser, value, '-1', 'input');
    calculate();
    assert.match(result.textContent, /절대\s*영도/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('unit conversion avoids intermediate overflow and reports real overflow or underflow', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    doc.querySelector('#unit-tab').click();
    const value = doc.querySelector('#unit-value');
    const result = doc.querySelector('#unit-result');
    const calculate = () => doc.querySelector('#unit-convert').click();

    change(browser, doc.querySelector('#unit-category'), 'time');
    change(browser, doc.querySelector('#from-unit'), 'day');
    change(browser, doc.querySelector('#to-unit'), 'h');
    change(browser, value, '1e306', 'input');
    calculate();
    assert.equal(result.textContent, '2.4e+307 h');

    change(browser, doc.querySelector('#unit-category'), 'temperature');
    change(browser, doc.querySelector('#from-unit'), 'f');
    change(browser, doc.querySelector('#to-unit'), 'k');
    change(browser, value, '1e308', 'input');
    calculate();
    assert.equal(result.textContent, '5.5555555555555556e+307 K (근삿값)');
    change(browser, doc.querySelector('#from-unit'), 'c');
    change(browser, doc.querySelector('#to-unit'), 'f');
    change(browser, value, '9e307', 'input');
    calculate();
    assert.equal(result.textContent, '1.62e+308 °F (근삿값)');

    change(browser, doc.querySelector('#unit-category'), 'time');
    change(browser, doc.querySelector('#from-unit'), 'day');
    change(browser, doc.querySelector('#to-unit'), 'h');
    change(browser, value, '1e308', 'input');
    calculate();
    assert.match(result.textContent, /표현.*범위/);
    change(browser, doc.querySelector('#from-unit'), 's');
    change(browser, doc.querySelector('#to-unit'), 'day');
    change(browser, value, '5e-324', 'input');
    calculate();
    assert.match(result.textContent, /표현.*범위/);
    change(browser, value, '8.64e-319', 'input');
    calculate();
    assert.equal(Number.parseFloat(result.textContent), 1e-323);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('temperature conversion keeps representable differences close to the freezing point', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    doc.querySelector('#unit-tab').click();
    change(browser, doc.querySelector('#unit-category'), 'temperature');
    change(browser, doc.querySelector('#from-unit'), 'f');
    change(browser, doc.querySelector('#to-unit'), 'c');
    change(browser, doc.querySelector('#unit-value'), '32.00000000000001', 'input');
    doc.querySelector('#unit-convert').click();
    assert.ok(Number.parseFloat(doc.querySelector('#unit-result').textContent) > 0);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('Fahrenheit to Kelvin retains a positive result just above absolute zero', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    doc.querySelector('#unit-tab').click();
    change(browser, doc.querySelector('#unit-category'), 'temperature');
    change(browser, doc.querySelector('#from-unit'), 'f');
    change(browser, doc.querySelector('#to-unit'), 'k');
    const input = doc.querySelector('#unit-value');
    const result = doc.querySelector('#unit-result');
    for (const [fahrenheit, expectedKelvin] of [
      ['-459.67', 0], ['32', 273.15], ['212', 373.15]
    ]) {
      change(browser, input, fahrenheit, 'input');
      doc.querySelector('#unit-convert').click();
      assert.equal(Number.parseFloat(result.textContent), expectedKelvin);
    }
    change(browser, input, '-459.66999999999996', 'input');
    doc.querySelector('#unit-convert').click();
    assert.ok(Number.parseFloat(result.textContent) > 0, result.textContent);
    assert.match(result.textContent, / K \(근삿값\)$/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('numeric inputs smaller than the number range report an error rather than becoming zero', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    doc.querySelector('#unit-tab').click();
    change(browser, doc.querySelector('#unit-category'), 'length');
    change(browser, doc.querySelector('#from-unit'), 'm');
    change(browser, doc.querySelector('#to-unit'), 'km');
    const unitInput = doc.querySelector('#unit-value');
    change(browser, unitInput, '1e-400', 'input');
    doc.querySelector('#unit-convert').click();
    assert.match(doc.querySelector('#unit-result').textContent, /입력값.*범위보다 작/);
    assert.equal(doc.activeElement, unitInput);
    change(browser, unitInput, '0e-400', 'input');
    doc.querySelector('#unit-convert').click();
    assert.equal(doc.querySelector('#unit-result').textContent, '0 km');

    doc.querySelector('#physics-tab').click();
    change(browser, doc.querySelector('#physics-formula'), 'force');
    const mass = doc.querySelector('#physics-mass');
    change(browser, mass, '1e-400', 'input');
    change(browser, doc.querySelector('#physics-acceleration'), '1', 'input');
    doc.querySelector('#physics-calculate').click();
    assert.match(doc.querySelector('#physics-result').textContent, /질량.*범위보다 작/);
    assert.equal(doc.activeElement, mass);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('physics calculation balances factors and reports results outside number range', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    doc.querySelector('#physics-tab').click();
    change(browser, doc.querySelector('#physics-formula'), 'kinetic');
    change(browser, doc.querySelector('#physics-mass'), '5e-324', 'input');
    change(browser, doc.querySelector('#physics-velocity'), '1e154', 'input');
    doc.querySelector('#physics-calculate').click();
    const result = doc.querySelector('#physics-result');
    assert.equal(result.textContent, '2.5e-16 J');
    assert.match(result.textContent, /J$/);

    change(browser, doc.querySelector('#physics-formula'), 'potential');
    change(browser, doc.querySelector('#physics-mass'), '5e-324', 'input');
    change(browser, doc.querySelector('#physics-gravity'), '0.5', 'input');
    change(browser, doc.querySelector('#physics-height'), '1e154', 'input');
    doc.querySelector('#physics-calculate').click();
    assert.equal(result.textContent, '2.5e-170 J');

    change(browser, doc.querySelector('#physics-formula'), 'kinetic');
    change(browser, doc.querySelector('#physics-mass'), '1e308', 'input');
    change(browser, doc.querySelector('#physics-velocity'), '1e308', 'input');
    doc.querySelector('#physics-calculate').click();
    assert.match(result.textContent, /결과.*범위/);

    change(browser, doc.querySelector('#physics-formula'), 'force');
    change(browser, doc.querySelector('#physics-mass'), '5e-324', 'input');
    change(browser, doc.querySelector('#physics-acceleration'), '0.5', 'input');
    doc.querySelector('#physics-calculate').click();
    assert.match(result.textContent, /결과.*범위보다 작/);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('each physics formula accepts its legitimate zero result', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    doc.querySelector('#physics-tab').click();
    for (const [formula, values, expected] of [
      ['velocity', { distance: '0', time: '5' }, '0 m/s'],
      ['acceleration', { deltaVelocity: '0', time: '5' }, '0 m/s²'],
      ['force', { mass: '4', acceleration: '0' }, '0 N'],
      ['kinetic', { mass: '4', velocity: '0' }, '0 J'],
      ['potential', { mass: '4', gravity: '9.8', height: '0' }, '0 J'],
    ]) {
      change(browser, doc.querySelector('#physics-formula'), formula);
      for (const [field, value] of Object.entries(values)) {
        change(browser, doc.querySelector(`#physics-${field}`), value, 'input');
      }
      doc.querySelector('#physics-calculate').click();
      assert.equal(doc.querySelector('#physics-result').textContent, expected, formula);
    }
  } finally {
    await browser.happyDOM.abort();
  }
});

test('unit result is invalidated when the value or either unit changes', async () => {
  const browser = setup();
  try {
    const doc = browser.document;
    change(browser, doc.querySelector('#unit-category'), 'temperature');
    change(browser, doc.querySelector('#unit-value'), '100', 'input');
    change(browser, doc.querySelector('#from-unit'), 'c');
    change(browser, doc.querySelector('#to-unit'), 'f');
    const convert = doc.querySelector('#unit-convert');
    const result = doc.querySelector('#unit-result');
    convert.click();
    assert.equal(result.textContent, '212 °F');
    assert.equal(result.getAttribute('role'), 'status');

    change(browser, doc.querySelector('#unit-value'), '0', 'input');
    assert.equal(result.textContent, '입력이 변경되었습니다. 다시 변환해 주세요.');
    convert.click();
    assert.equal(result.textContent, '32 °F');
    change(browser, doc.querySelector('#from-unit'), 'k');
    assert.equal(result.textContent, '입력이 변경되었습니다. 다시 변환해 주세요.');
    convert.click();
    change(browser, doc.querySelector('#to-unit'), 'c');
    assert.equal(result.textContent, '입력이 변경되었습니다. 다시 변환해 주세요.');
    change(browser, doc.querySelector('#unit-category'), 'length');
    assert.equal(result.textContent, '');
  } finally {
    await browser.happyDOM.abort();
  }
});
