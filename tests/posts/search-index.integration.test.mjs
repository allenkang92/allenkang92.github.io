import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

test('the generated search index includes the tool landing pages with readable descriptions', async () => {
  const siteRoot = process.env.SITE_ROOT || new URL('../../_site/', import.meta.url).pathname;
  const entries = JSON.parse(await readFile(resolve(siteRoot, 'search.json'), 'utf8'));
  const expected = [
    ['/tools/unit-converter/', '단위 변환기'],
    ['/tools/kinetic-energy-calculator/', '운동 에너지'],
    ['/tools/acceleration-calculator/', '가속도'],
    ['/tools/dsr-calculator/', '준비 중'],
  ];
  for (const [path, title] of expected) {
    const rows = entries.filter(entry => entry.type === 'page' && new URL(entry.url).pathname === path);
    assert.equal(rows.length, 1, `${path} must be indexed exactly once`);
    assert.ok(rows[0].title.includes(title), `${path} must retain its title and availability`);
    assert.ok(rows[0].description.trim(), `${path} must have a searchable description`);
    assert.equal(rows[0].date, '', `${path} must not pretend the build date is its publication date`);
    assert.doesNotMatch(`${rows[0].title} ${rows[0].description}`, /\{%|%\}|\{\{/);
  }
  const series = entries.find(entry => entry.type === 'page' && new URL(entry.url).pathname === '/series/');
  assert.equal(series?.date, '', 'undated series pages must not receive a build date');
});
