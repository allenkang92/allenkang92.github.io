import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const source = await readFile(new URL('../../_posts/2024-09-09-html정리.md', import.meta.url), 'utf8');
const match = source.match(/^### 예시 코드\s+[\s\S]*?^```html\r?\n([\s\S]*?)^```/m);
assert.ok(match, '글의 폼 예제 코드 블록이 있어야 합니다');
const example = match[1].trim();
const site = process.env.SITE_ROOT || resolve('_site');

test('폼 예제는 입력을 이름과 선택값으로 구분해 제출 데이터에 담는다', async () => {
  const browser = new Window();
  try {
    browser.document.body.innerHTML = example;
    const form = browser.document.querySelector('form');
    assert.ok(form);
    assert.equal(form.getAttribute('action'), 'https://example.invalid/submit');
    assert.equal(form.method.toLowerCase(), 'post');
    assert.equal(form.enctype, 'multipart/form-data');

    const controls = [...form.querySelectorAll('input, select, textarea')];
    for (const control of controls) {
      assert.ok(control.name, `${control.id || control.outerHTML}: 제출 이름`);
      const label = form.querySelector(`label[for="${control.id}"]`);
      assert.ok(label && label.textContent.trim(), `${control.name}: 명시적 라벨`);
      assert.equal(label.control, control, `${control.name}: 라벨 연결`);
    }
    for (const group of ['gender', 'hobby']) {
      const members = [...form.querySelectorAll(`input[name="${group}"]`)];
      assert.ok(members.length > 1, `${group}: 선택지`);
      assert.ok(members.every(input => input.hasAttribute('value') && input.value !== 'on'));
      assert.equal(new Set(members.map(input => input.value)).size, members.length);
      const fieldset = members[0].closest('fieldset');
      assert.ok(fieldset?.querySelector(':scope > legend')?.textContent.trim());
      assert.ok(members.every(input => input.closest('fieldset') === fieldset));
    }

    form.querySelector('#userid').value = 'sample-user';
    form.querySelector('#userpw').value = 'example-password';
    form.querySelector('#female').checked = true;
    form.querySelector('#hobby-music').checked = true;
    form.querySelector('#region').value = 'gangwon';
    form.querySelector('#bio').value = '안녕하세요';
    const transfer = new browser.DataTransfer();
    transfer.items.add(new browser.File(['sample'], 'sample.png', { type: 'image/png' }));
    form.querySelector('#profile').files = transfer.files;
    const data = new browser.FormData(form);
    assert.equal(data.get('username'), 'sample-user');
    assert.equal(data.get('password'), 'example-password');
    assert.equal(data.get('gender'), 'female');
    assert.deepEqual(data.getAll('hobby'), ['movies', 'music']);
    assert.equal(data.get('region'), 'gangwon');
    assert.equal(data.get('bio'), '안녕하세요');
    assert.ok(data.get('profile') instanceof browser.File);
    assert.equal(data.get('profile').name, 'sample.png');

    const reset = form.querySelector('button[type="reset"]');
    assert.equal(reset.textContent.trim(), '초기화', '초기화 동작을 명확히 표시');
    form.querySelector('#hobby-movies').checked = false;
    reset.click();
    assert.equal(form.querySelector('#userid').value, '');
    assert.equal(form.querySelector('#userpw').value, '');
    assert.equal(form.querySelector('#bio').value, '');
    assert.equal(form.querySelector('#male').checked, true);
    assert.equal(form.querySelector('#female').checked, false);
    assert.equal(form.querySelector('#hobby-movies').checked, true);
    assert.equal(form.querySelector('#hobby-music').checked, false);
    assert.equal(form.querySelector('#region').value, 'jeju');
  } finally { await browser.happyDOM.abort(); }
});

test('Jekyll은 폼을 실제 전송 양식이 아닌 복사 가능한 원문 코드로 표시한다', async () => {
  const html = await readFile(resolve(site, 'posts/html정리/index.html'), 'utf8');
  const browser = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    browser.document.write(html);
    const content = browser.document.querySelector('#post-content');
    assert.ok(content, '글 본문');
    const code = [...content.querySelectorAll('pre code')].find(element => element.textContent.includes('https://example.invalid/submit'));
    assert.ok(code, '폼 예제 코드');
    assert.equal(code.textContent.trim(), example, '생성된 코드가 원문과 일치해야 한다');
    assert.equal(content.querySelector('form[action="https://example.invalid/submit"]'), null, '예제가 실제 폼으로 실행되지 않아야 한다');
  } finally { await browser.happyDOM.abort(); }
});
