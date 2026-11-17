import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStandalone } from './build-standalone.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(projectRoot, 'site');
const outputFile = resolve(site, 'index.html');

await mkdir(resolve(site, 'assets'), { recursive: true });
const result = await buildStandalone({ projectRoot, outputFile, audioMode: 'adjacent' });
for (const filename of result.audioAssets) {
  await copyFile(resolve(projectRoot, 'dist', 'assets', filename), resolve(site, 'assets', filename));
}
const rootIndex = resolve(projectRoot, 'index.html');
await buildStandalone({ projectRoot, outputFile: rootIndex, audioMode: 'dist' });
const privateOrigin = process.env.CUARENTA_PRIVATE_ORIGIN;
if (privateOrigin) {
  const url = new URL(privateOrigin);
  if (url.protocol !== 'https:' || url.origin !== privateOrigin) {
    throw new Error('CUARENTA_PRIVATE_ORIGIN debe ser un origen HTTPS sin ruta.');
  }
  const marker = '<!-- cuarenta-private-capability -->';
  for (const output of [outputFile, rootIndex]) {
    const html = await readFile(output, 'utf8');
    if (!html.includes(marker)) throw new Error('Falta el marcador de mesas privadas.');
    await writeFile(output, html.replace(marker, marker + '\n  <meta name="cuarenta-private-api" content="' + privateOrigin + '">'));
  }
}
console.log(`GitHub Pages listo: ${result.path}`);
console.log(`Archivo principal alternativo: ${rootIndex}`);
console.log(`${result.modules} modulos, ${result.bytes} bytes y ${result.audioAssets.length} pistas locales.`);
