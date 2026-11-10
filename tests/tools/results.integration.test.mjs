import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';

const toolsPage = await readFile(new URL('../../_pages/tools.md', import.meta.url), 'utf8');
const toolsScript = await readFile(new URL('../../assets/js/tools.js', import.meta.url), 'utf8');

function setup() {
  const browser = new Window({ url: 'https://blog.test/tools/' });
  const workspace = toolsPage.match(/<section class="tools-container"[\s\S]*?<\/section>/)?.[0];
  assert.ok(workspace, 'tools page must contain the calculator workspace');
  browser.document.body.innerHTML = workspace;
  browser.eval(toolsScript);
  browser.document.dispatchEvent(new browser.Event('DOMContentLoaded'));
  return browser;
}

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
