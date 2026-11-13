import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const siteRoot = process.env.SITE_ROOT || resolve('_site');
const postPath = resolve(siteRoot, 'posts', '2장-수학과무한', 'index.html');

async function setupMath() {
  const html = await readFile(postPath, 'utf8');
  const parser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true } });
  const browser = new Window();
  try {
    parser.document.write(html);
    const config = [...parser.document.querySelectorAll('script:not([src])')]
      .map(script => script.textContent)
      .find(text => text.includes('window.MathJax ='));
    assert.ok(config, '수식 글에 MathJax 설정이 있어야 합니다');
    const loaderHandler = parser.document.getElementById('mathjax-loader')?.getAttribute('onerror');
    assert.ok(loaderHandler, '스크립트 자체 오류를 위한 대체 처리가 있어야 합니다');
    const notice = parser.document.getElementById('math-load-error');
    assert.ok(notice?.hidden, '초기 수식 오류 안내는 숨겨져 있어야 합니다');
    const delay = parser.document.getElementById('math-load-delay');
    assert.ok(delay?.hidden, '초기 지연 안내는 숨겨져 있어야 합니다');
    const speech = parser.document.getElementById('math-speech-error');
    assert.ok(speech?.hidden, '초기 음성·점자 오류 안내는 숨겨져 있어야 합니다');
    assert.equal(speech.getAttribute('aria-hidden'), 'true', '시각 안내는 라이브 영역과 중복해서 노출하지 않습니다');
    const status = parser.document.getElementById('math-load-status');
    assert.ok(status && !status.hidden && !status.closest('[hidden]'), '라이브 영역은 처음부터 노출돼야 합니다');
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-atomic'), 'true');
    assert.equal(status.textContent, '', '처음에는 상태 메시지가 없어야 합니다');
    assert.equal(delay.querySelectorAll('[role="status"]').length, 0, '시각 안내를 중복 알리지 않습니다');
    assert.equal(delay.querySelector('p').getAttribute('aria-hidden'), 'true', '시각 요약은 라이브 영역과 중복해서 노출하지 않습니다');
    assert.equal(delay.querySelectorAll('p')[1].getAttribute('aria-hidden'), null, '상세 복구 절차는 탐색할 수 있습니다');
    assert.equal(notice.getAttribute('aria-hidden'), 'true', '시각 오류 안내는 라이브 영역과 중복해서 노출하지 않습니다');
    browser.document.body.innerHTML = status.outerHTML + delay.outerHTML + notice.outerHTML + speech.outerHTML;
    const timers = new Map();
    let nextTimer = 0;
    browser.setTimeout = (callback, duration) => {
      assert.equal(duration, 12000);
      timers.set(++nextTimer, callback);
      return nextTimer;
    };
    browser.clearTimeout = id => timers.delete(id);
    browser.testMathTimers = timers;
    browser.testMathLoaderHandler = loaderHandler;
    browser.eval(config);
    return browser;
  } catch (error) {
    await browser.happyDOM.abort();
    throw error;
  } finally {
    await parser.happyDOM.abort();
  }
}

test('MathJax 정상 조판은 기본 결과를 유지하고 오류 안내를 표시하지 않는다', async () => {
  const browser = await setupMath();
  try {
    const config = browser.MathJax;
    assert.deepEqual(Array.from(config.startup.elements), ['#post-content']);
    let calls = 0;
    config.startup.defaultPageReady = () => { calls += 1; return Promise.resolve('완료'); };
    assert.equal(await config.startup.pageReady(), '완료');
    assert.equal(calls, 1);
    assert.equal(browser.document.getElementById('math-load-error').hidden, true);
    assert.equal(browser.document.getElementById('math-load-delay').hidden, true);
    assert.equal(browser.document.getElementById('math-load-status').textContent, '', '지연 없는 정상 완료는 알리지 않습니다');
    assert.equal(browser.testMathTimers.size, 0);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('MathJax 초기 조판 실패는 안내하면서 실패를 그대로 전파한다', async () => {
  const browser = await setupMath();
  try {
    const error = new Error('동적 폰트 로드 실패');
    browser.MathJax.startup.defaultPageReady = () => Promise.reject(error);
    await assert.rejects(browser.MathJax.startup.pageReady(), reason => reason === error);
    assert.equal(browser.document.getElementById('math-load-error').hidden, false);
    assert.equal(browser.document.getElementById('math-load-delay').hidden, true);
    assert.equal(browser.document.getElementById('math-load-status').textContent, browser.document.getElementById('math-load-error').textContent);
    assert.equal(browser.testMathTimers.size, 0);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('MathJax 초기 조판의 동기 예외도 그대로 전파하고 타이머를 정리한다', async () => {
  const browser = await setupMath();
  try {
    const error = new Error('동기 초기화 실패');
    browser.MathJax.startup.defaultPageReady = () => { throw error; };
    assert.throws(() => browser.MathJax.startup.pageReady(), reason => reason === error);
    assert.equal(browser.document.getElementById('math-load-error').hidden, false);
    assert.equal(browser.document.getElementById('math-load-delay').hidden, true);
    assert.equal(browser.document.getElementById('math-load-status').textContent, browser.document.getElementById('math-load-error').textContent);
    assert.equal(browser.testMathTimers.size, 0);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('MathJax 구성요소 로드 실패는 오류를 기록하고 안내한다', async () => {
  const browser = await setupMath();
  try {
    const error = new Error('구성요소 로드 실패');
    const reported = [];
    browser.console.error = (...args) => reported.push(args);
    browser.MathJax.loader.failed(error);
    assert.equal(browser.document.getElementById('math-load-error').hidden, false);
    assert.equal(browser.testMathTimers.size, 0);
    assert.ok(reported.some(args => args.includes(error)), '원래 오류를 확인할 수 있어야 합니다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('수식 로드가 지연되면 기다림을 안내하고 늦게 조판되면 안내를 숨긴다', async () => {
  const browser = await setupMath();
  try {
    const delay = browser.document.getElementById('math-load-delay');
    const failure = browser.document.getElementById('math-load-error');
    const timer = [...browser.testMathTimers.values()][0];
    assert.ok(timer, '지연 감지 타이머가 있어야 합니다');
    timer();
    assert.equal(delay.hidden, false);
    assert.match(delay.textContent, /지연/);
    assert.match(delay.textContent, /수식 음성이 나오지 않는다면/);
    const status = browser.document.getElementById('math-load-status');
    assert.equal(status.textContent, delay.querySelector('p').textContent, '지연 시 시각 요약과 같은 내용을 알립니다');
    assert.equal(status.querySelector('[lang="en"]').textContent, 'Speech → Language → English', '영어 메뉴의 언어 정보를 보존합니다');
    assert.match(status.textContent, /Speech → Language → English를 선택한 뒤 새로고침/);
    assert.match(delay.textContent, /오른쪽 방향키로 하위 메뉴/);
    assert.match(delay.textContent, /Speech → Language → English/);
    assert.match(delay.textContent, /영어 음성 설정은 이후에도 유지될 수 있습니다/);
    assert.deepEqual(Array.from(delay.querySelectorAll('[lang="en"]'), element => element.textContent), ['Speech → Language → English', 'Accessibility', 'Speech → Language → English']);
    assert.equal(delay.querySelectorAll('a, button, input, select, textarea, summary, [tabindex]').length, 0, '지연 안내가 사라질 때 포커스를 잃을 새 조작 요소는 없습니다');
    assert.equal(failure.hidden, true, '지연을 실패로 단정하지 않습니다');
    browser.MathJax.startup.defaultPageReady = () => Promise.resolve('늦은 완료');
    assert.equal(await browser.MathJax.startup.pageReady(), '늦은 완료');
    assert.equal(delay.hidden, true);
    assert.equal(failure.hidden, true);
    assert.equal(status.textContent, '수식 표시 준비가 완료되었습니다.', '지연이 끝나면 완료 상태를 알립니다');
    assert.equal(browser.testMathTimers.size, 0);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('지연 후 수식 로드 실패는 지연 안내 대신 오류 안내를 표시한다', async () => {
  const browser = await setupMath();
  try {
    [...browser.testMathTimers.values()][0]();
    const script = browser.document.createElement('script');
    script.id = 'mathjax-loader';
    browser.document.body.append(script);
    script.dispatchEvent(new browser.Event('error'));
    assert.equal(browser.document.getElementById('math-load-delay').hidden, true);
    assert.equal(browser.document.getElementById('math-load-error').hidden, false);
    assert.equal(browser.document.getElementById('math-load-status').textContent, browser.document.getElementById('math-load-error').textContent);
    assert.equal(browser.testMathTimers.size, 0);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('구성요소 오류 뒤 조판이 끝나도 기존 오류 안내를 숨기지 않는다', async () => {
  const browser = await setupMath();
  try {
    browser.console.error = () => {};
    [...browser.testMathTimers.values()][0]();
    browser.MathJax.loader.failed(new Error('폰트 오류'));
    browser.MathJax.startup.defaultPageReady = () => Promise.resolve('부분 완료');
    assert.equal(await browser.MathJax.startup.pageReady(), '부분 완료');
    assert.equal(browser.document.getElementById('math-load-delay').hidden, true);
    assert.equal(browser.document.getElementById('math-load-error').hidden, false);
    assert.equal(browser.document.getElementById('math-load-status').textContent, browser.document.getElementById('math-load-error').textContent, '부분 완료 후에도 실패 상태를 유지합니다');
    assert.equal(browser.testMathTimers.size, 0);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('중복 실패와 취소된 지연 콜백은 알림 상태를 다시 바꾸지 않는다', async () => {
  const browser = await setupMath();
  try {
    const status = browser.document.getElementById('math-load-status');
    const delay = browser.document.getElementById('math-load-delay');
    const failure = browser.document.getElementById('math-load-error');
    const timer = [...browser.testMathTimers.values()][0];
    const focus = browser.document.createElement('button');
    browser.document.body.append(focus);
    focus.focus();
    browser.console.error = () => {};
    browser.MathJax.loader.failed(new Error('첫 실패'));
    const firstChild = status.firstChild;
    browser.MathJax.loader.failed(new Error('두 번째 실패'));
    timer(); // 취소 이후 이미 대기열에 있던 콜백을 모의한다.
    assert.ok(status.firstChild === firstChild, '같은 실패를 반복 알리지 않습니다');
    assert.equal(status.textContent, failure.textContent);
    assert.equal(delay.hidden, true, '실패 뒤 늦은 타이머가 지연 안내를 다시 열지 않습니다');
    assert.ok(browser.document.activeElement === focus, '상태 알림은 포커스를 이동하지 않습니다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('정상 완료 뒤 취소된 지연 콜백은 지연 상태를 열지 않는다', async () => {
  const browser = await setupMath();
  try {
    const timer = [...browser.testMathTimers.values()][0];
    browser.MathJax.startup.defaultPageReady = () => Promise.resolve();
    await browser.MathJax.startup.pageReady();
    timer();
    assert.equal(browser.document.getElementById('math-load-delay').hidden, true);
    assert.equal(browser.document.getElementById('math-load-status').textContent, '');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('정상 완료 후 늦은 구성요소 오류는 실패를 알린다', async () => {
  const browser = await setupMath();
  try {
    browser.console.error = () => {};
    browser.MathJax.startup.defaultPageReady = () => Promise.resolve();
    await browser.MathJax.startup.pageReady();
    browser.MathJax.loader.failed(new Error('늦은 구성요소 오류'));
    const failure = browser.document.getElementById('math-load-error');
    assert.equal(failure.hidden, false);
    assert.equal(browser.document.getElementById('math-load-delay').hidden, true);
    assert.equal(browser.document.getElementById('math-load-status').textContent, failure.textContent);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('음성 생성 오류는 시각 안내와 라이브 상태를 표시하고 기본 오류 처리도 유지한다', async () => {
  const browser = await setupMath();
  try {
    const error = new Error('음성 생성 실패');
    const item = {};
    const calls = [];
    const doc = { speechError: (...args) => { calls.push(args); return '기본 결과'; } };
    const status = browser.document.getElementById('math-load-status');
    const speech = browser.document.getElementById('math-speech-error');
    assert.equal(browser.MathJax.options.speechError(doc, item, error), '기본 결과');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], [doc, item, error]);
    assert.equal(speech.hidden, false);
    assert.match(speech.textContent, /일부 수식의 음성 또는 점자 정보 생성 중 오류가 발생했습니다/);
    assert.equal(status.textContent, speech.textContent);
    assert.equal(browser.document.getElementById('math-load-error').hidden, true, '음성 실패를 수식 표시 실패로 단정하지 않습니다');
    const first = status.firstChild;
    browser.MathJax.options.speechError(doc, item, error);
    assert.equal(calls.length, 2, '반복 오류도 MathJax 기본 처리는 호출합니다');
    assert.equal(status.firstChild, first, '반복 오류는 상태를 다시 알리지 않습니다');
    browser.MathJax.startup.defaultPageReady = () => Promise.resolve();
    await browser.MathJax.startup.pageReady();
    assert.equal(status.textContent, speech.textContent, '조판 완료 뒤에도 음성 오류를 유지합니다');
  } finally {
    await browser.happyDOM.abort();
  }
});

test('스크립트 오류 캡처와 인라인 처리가 이어져도 음성 오류 안내를 보존한다', async () => {
  const browser = await setupMath();
  try {
    browser.MathJax.options.speechError({ speechError() {} }, {}, new Error('음성 오류'));
    const loader = browser.document.createElement('script');
    loader.id = 'mathjax-loader';
    browser.document.body.append(loader);
    loader.dispatchEvent(new browser.Event('error'));
    // happy-dom은 동적으로 설정한 onerror 속성을 실행하지 않아 브라우저의 실행 순서를 모의한다.
    browser.eval(browser.testMathLoaderHandler);
    const display = browser.document.getElementById('math-load-error');
    const speech = browser.document.getElementById('math-speech-error');
    assert.equal(display.hidden, false);
    assert.equal(speech.hidden, false);
    assert.equal(browser.document.getElementById('math-load-status').textContent, `${display.textContent} ${speech.textContent}`);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('설정 스크립트가 없어도 로더의 인라인 오류 처리가 실패를 알린다', async () => {
  const fixture = await setupMath();
  const browser = new Window();
  try {
    const status = fixture.document.getElementById('math-load-status');
    const failure = fixture.document.getElementById('math-load-error');
    browser.document.body.innerHTML = status.outerHTML + failure.outerHTML;
    const loader = browser.document.createElement('script');
    loader.id = 'mathjax-loader';
    browser.document.body.append(loader);
    loader.dispatchEvent(new browser.Event('error'));
    browser.eval(fixture.testMathLoaderHandler);
    const shown = browser.document.getElementById('math-load-error');
    assert.equal(shown.hidden, false);
    assert.equal(browser.document.getElementById('math-load-status').textContent, shown.textContent);
  } finally {
    await browser.happyDOM.abort();
    await fixture.happyDOM.abort();
  }
});

test('지연 중 음성 오류는 지연 안내와 함께 알리고 조판 완료 뒤에도 보존한다', async () => {
  const browser = await setupMath();
  try {
    const delay = browser.document.getElementById('math-load-delay');
    const speech = browser.document.getElementById('math-speech-error');
    const status = browser.document.getElementById('math-load-status');
    [...browser.testMathTimers.values()][0]();
    browser.MathJax.options.speechError({ speechError() {} }, {}, new Error('오류'));
    assert.equal(delay.hidden, false);
    assert.equal(status.textContent, `${delay.querySelector('p').textContent} ${speech.textContent}`);
    assert.ok(status.querySelector('[lang="en"]'), '기존 언어 속성을 보존합니다');
    browser.MathJax.startup.defaultPageReady = () => Promise.resolve();
    await browser.MathJax.startup.pageReady();
    assert.equal(delay.hidden, true);
    assert.equal(speech.hidden, false);
    assert.equal(status.textContent, speech.textContent);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('음성 오류 후 지연 타이머가 실행돼도 음성 오류를 덮지 않는다', async () => {
  const browser = await setupMath();
  try {
    browser.MathJax.options.speechError({ speechError() {} }, {}, new Error('음성 오류'));
    [...browser.testMathTimers.values()][0]();
    const delay = browser.document.getElementById('math-load-delay');
    const speech = browser.document.getElementById('math-speech-error');
    const status = browser.document.getElementById('math-load-status');
    assert.equal(delay.hidden, false);
    assert.equal(status.textContent, `${delay.querySelector('p').textContent} ${speech.textContent}`);
    browser.MathJax.startup.defaultPageReady = () => Promise.resolve();
    await browser.MathJax.startup.pageReady();
    assert.equal(status.textContent, speech.textContent);
  } finally {
    await browser.happyDOM.abort();
  }
});

test('음성 오류와 수식 표시 오류는 발생 순서와 관계없이 모두 알린다', async () => {
  for (const first of ['speech', 'display']) {
    const browser = await setupMath();
    try {
      browser.console.error = () => {};
      const speech = () => browser.MathJax.options.speechError({ speechError() {} }, {}, new Error('음성 오류'));
      const display = () => browser.MathJax.loader.failed(new Error('표시 오류'));
      if (first === 'speech') { speech(); display(); } else { display(); speech(); }
      const notice = browser.document.getElementById('math-load-error');
      const speechNotice = browser.document.getElementById('math-speech-error');
      const status = browser.document.getElementById('math-load-status');
      assert.equal(notice.hidden, false);
      assert.equal(speechNotice.hidden, false);
      assert.equal(status.textContent, `${notice.textContent} ${speechNotice.textContent}`);
      browser.MathJax.startup.defaultPageReady = () => Promise.resolve();
      await browser.MathJax.startup.pageReady();
      assert.equal(status.textContent, `${notice.textContent} ${speechNotice.textContent}`);
    } finally {
      await browser.happyDOM.abort();
    }
  }
});

test('조판 완료 후 음성 오류와 기본 오류 처리의 예외도 표시한다', async () => {
  const browser = await setupMath();
  try {
    browser.MathJax.startup.defaultPageReady = () => Promise.resolve();
    await browser.MathJax.startup.pageReady();
    const original = new Error('기본 처리 예외');
    assert.throws(() => browser.MathJax.options.speechError({ speechError() { throw original; } }, {}, new Error('음성 오류')), error => error === original);
    const speech = browser.document.getElementById('math-speech-error');
    assert.equal(speech.hidden, false);
    assert.equal(browser.document.getElementById('math-load-status').textContent, speech.textContent);
  } finally {
    await browser.happyDOM.abort();
  }
});
