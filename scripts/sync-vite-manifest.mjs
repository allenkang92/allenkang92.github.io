import { access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(projectRoot, 'assets/js/dist/manifest.json');
const dataPath = resolve(projectRoot, '_data/vite_manifest.json');
const entryKey = 'frontend/posts/main.tsx';

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entry = manifest[entryKey];
if (!entry?.isEntry || typeof entry.file !== 'string') {
  throw new Error(`Vite manifest is missing the React entry: ${entryKey}`);
}

for (const outputFile of [entry.file, ...(entry.css || [])]) {
  await access(resolve(projectRoot, 'assets/js/dist', outputFile), constants.R_OK);
}

await writeFile(dataPath, `${JSON.stringify({ [entryKey]: entry }, null, 2)}\n`, 'utf8');
