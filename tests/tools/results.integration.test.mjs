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
