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
    const notice = parser.document.getElementById('math-load-error');
    assert.ok(notice?.hidden, '초기 수식 오류 안내는 숨겨져 있어야 합니다');
    const delay = parser.document.getElementById('math-load-delay');
    assert.ok(delay?.hidden, '초기 지연 안내는 숨겨져 있어야 합니다');
    assert.equal(delay.querySelectorAll('[role="status"]').length, 1, '지연 상태만 별도로 알립니다');
    browser.document.body.innerHTML = delay.outerHTML + notice.outerHTML;
    const timers = new Map();
    let nextTimer = 0;
    browser.setTimeout = (callback, duration) => {
      assert.equal(duration, 12000);
      timers.set(++nextTimer, callback);
      return nextTimer;
    };
    browser.clearTimeout = id => timers.delete(id);
    browser.testMathTimers = timers;
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
    assert.match(delay.querySelector('[role="status"]').textContent, /Speech → Language → English를 선택한 뒤 새로고침/);
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
    assert.equal(browser.testMathTimers.size, 0);
  } finally {
    await browser.happyDOM.abort();
  }
});
