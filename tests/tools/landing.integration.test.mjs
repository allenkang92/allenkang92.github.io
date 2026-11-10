import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { Window } from 'happy-dom';

const siteRoot = process.env.SITE_ROOT || resolve('_site');

test('published tool guides open the calculator and formula they describe', async () => {
  const workspace = await readFile(resolve(siteRoot, 'tools/index.html'), 'utf8');
  const script = await readFile(resolve(siteRoot, 'assets/js/tools.js'), 'utf8');
  for (const [slug, tab, formula] of [
    ['unit-converter', 'unit', null],
    ['acceleration-calculator', 'physics', 'acceleration'],
    ['kinetic-energy-calculator', 'physics', 'kinetic'],
  ]) {
    const guide = new Window({ url: `https://blog.test/tools/${slug}/` });
    guide.document.body.innerHTML = await readFile(resolve(siteRoot, `tools/${slug}/index.html`), 'utf8');
    const href = guide.document.querySelector('.tool-landing__cta')?.href;
    assert.ok(href, `${slug}: calculator link is required`);
    const calculator = new Window({ url: href });
    try {
      calculator.document.body.innerHTML = workspace;
      calculator.eval(script);
      calculator.document.dispatchEvent(new calculator.Event('DOMContentLoaded'));
      assert.equal(calculator.document.querySelector(`[data-tab="${tab}"]`).getAttribute('aria-selected'), 'true', `${slug}: selected tab`);
      assert.equal(calculator.document.querySelector(`#${tab}-calculator`).hidden, false, `${slug}: panel visibility`);
      if (formula) assert.equal(calculator.document.querySelector('#physics-formula').value, formula, `${slug}: selected formula`);
    } finally {
      await guide.happyDOM.abort();
      await calculator.happyDOM.abort();
    }
  }
});
