import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStandalone } from './build-standalone.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputFile = resolve(projectRoot, 'site', 'index.html');

await mkdir(dirname(outputFile), { recursive: true });
const result = await buildStandalone({ projectRoot, outputFile });
const rootIndex = resolve(projectRoot, 'index.html');
await copyFile(result.path, rootIndex);
console.log(`GitHub Pages listo: ${result.path}`);
console.log(`Archivo principal alternativo: ${rootIndex}`);
console.log(`${result.modules} modulos, ${result.bytes} bytes, sin recursos externos.`);
