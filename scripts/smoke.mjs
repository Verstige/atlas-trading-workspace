/* Fast smoke suite: catches broken builds, missing DOM hooks and syntax errors.
   Run with: npm run smoke */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('docs/index.html');
const css = read('docs/' + html.match(/assets\/([\w-]+\.css)/)[0]);
assert.ok(css.includes('.sheet-backdrop[hidden]{display:none!important}'), 'Backdrop hidden-state guard missing');
assert.ok(css.includes('.drawing-editor[hidden]{display:none!important}'), 'Editor hidden-state guard missing');

for (const hook of [
  'id="chart"', 'id="watchlist"', 'id="positions"', 'id="order-dialog"',
  'id="alert-dialog"', 'id="layout"', 'id="swatches"', 'id="manage-dialog"',
  'id="tour-dialog"', 'id="csv"', 'rel="manifest"',
]) {
  assert.ok(html.includes(hook), `Missing DOM hook: ${hook}`);
}

for (const file of ['docs/manifest.webmanifest', 'docs/sw.js', 'docs/assets/icon.svg']) {
  assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `Missing PWA asset: ${file}`);
}

const manifest = JSON.parse(read('docs/manifest.webmanifest'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.icons.length, 1);

for (const source of ['app.js', 'enhance.js', 'public/sw.js']) {
  execFileSync(process.execPath, ['--check', new URL(`../${source}`, import.meta.url).pathname], { stdio: 'pipe' });
}

execFileSync(process.execPath, [new URL('./check.mjs', import.meta.url).pathname], { stdio: 'inherit' });

console.log('Smoke passed: DOM hooks, PWA assets, syntax and functional checks.');
