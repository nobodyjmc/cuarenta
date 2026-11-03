import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Script, createContext } from 'node:vm';
import { buildStandalone } from '../scripts/build-standalone.mjs';

async function fixture(t, modules = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cuarenta bundle '));
  const dist = join(root, 'dist');
  await mkdir(join(dist, 'js'), { recursive: true });
  await mkdir(join(dist, 'assets'));
  await writeFile(join(dist, 'index.html'), '<!doctype html><html><head><link rel="icon" href="./assets/icon.svg"><link rel="stylesheet" href="./styles.css"></head><body><main>Cuarenta</main><script type="module" src="./js/app.js"></script></body></html>');
  await writeFile(join(dist, 'styles.css'), 'body { background: #173b34; }');
  await writeFile(join(dist, 'assets', 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  for (const [name, source] of Object.entries(modules)) await writeFile(join(dist, 'js', name), source);
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('portable HTML inlines assets and isolates module scopes with aliases', async (t) => {
  const root = await fixture(t, {
    'engine.js': 'const privateName = 40;\nexport const score = privateName;\nexport function value() { return score; }',
    'cards.js': 'const privateName = 7;\nexport const ace = privateName;',
    'app.js': 'import { value as getValue } from "./engine.js";\nimport * as cards from "./cards.js";\nconst privateName = 2;\nglobalThis.result = getValue() + cards.ace + privateName;',
  });
  const result = await buildStandalone({ projectRoot: root });
  assert.equal(result.modules, 3);
  const html = await readFile(result.path, 'utf8');
  assert.ok(html.includes('<style>'));
  assert.ok(html.includes('data:image/svg+xml;base64,'));
  assert.ok(!html.includes('src="./'));
  assert.ok(!html.includes('href="./'));
  const code = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const context = createContext({});
  new Script(code).runInContext(context);
  assert.equal(context.result, 49);
  assert.equal(context.privateName, undefined);
});

test('named export lists retain explicit aliases', async (t) => {
  const root = await fixture(t, {
    'engine.js': 'const points = 40;\nexport { points as score };',
    'app.js': 'import { score } from "./engine.js";\nglobalThis.result = score;',
  });
  const result = await buildStandalone({ projectRoot: root });
  const html = await readFile(result.path, 'utf8');
  const context = createContext({});
  new Script(/<script>([\s\S]*?)<\/script>/.exec(html)[1]).runInContext(context);
  assert.equal(context.result, 40);
});

test('rejects unsupported modules, missing exports and malformed syntax', async (t) => {
  const root = await fixture(t, { 'engine.js': 'export const points = 40;' });
  for (const source of [
    'import("./engine.js");',
    'export let points = 40;',
    'export default 40;',
    'import { missing } from "./engine.js";',
    'import { anything } from "https://example.com/code.js";',
    'import { anything } from "../../../outside.js";',
    'const invalid = ;',
  ]) {
    await writeFile(join(root, 'dist', 'js', 'app.js'), source);
    await assert.rejects(buildStandalone({ projectRoot: root }));
  }
});

test('rejects circular module dependencies instead of changing their semantics', async (t) => {
  const root = await fixture(t, {
    'app.js': 'import { value } from "./engine.js";\nexport const rootValue = value;',
    'engine.js': 'import { rootValue } from "./app.js";\nexport const value = rootValue;',
  });
  await assert.rejects(buildStandalone({ projectRoot: root }), /circular/);
});

test('rejects external stylesheet assets in portable output', async (t) => {
  const root = await fixture(t, { 'app.js': 'globalThis.ready = true;' });
  await writeFile(join(root, 'dist', 'styles.css'), 'body { background: url("https://example.com/image.png"); }');
  await assert.rejects(buildStandalone({ projectRoot: root }), /CSS/);
});
