import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IDENTIFIER = '[A-Za-z_$][\\w$]*';
const NAME_PAIR = new RegExp(`^(${IDENTIFIER})(?:\\s+as\\s+(${IDENTIFIER}))?$`);
const MUSIC_FILES = ['nuestro-juramento.mp3', 'reminiscencias.mp3'];
const MUSIC_LITERAL = /(['"])(\.\/assets\/[a-z0-9-]+\.mp3)\1/g;

function assertInside(root, target, specifier) {
  const inside = relative(root, target);
  if (inside === '' || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    throw new Error(`El recurso sale de dist: ${specifier}`);
  }
}

function localPath(root, from, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    throw new Error(`Solo se admiten recursos relativos: ${specifier}`);
  }
  if (/[?#%\\]/u.test(specifier)) throw new Error(`Ruta de recurso no admitida: ${specifier}`);
  const target = resolve(dirname(from), specifier);
  assertInside(root, target, specifier);
  return target;
}

async function bundleMusic(source, root, entryHtml, audioMode) {
  const paths = new Set([...source.matchAll(MUSIC_LITERAL)].map((match) => match[2]));
  const references = MUSIC_FILES.map((file) => `./assets/${file}`);
  if (paths.size !== references.length || references.some((path) => !paths.has(path))) {
    throw new Error('El reproductor debe referenciar los dos MP3 incluidos.');
  }
  const realRoot = await realpath(root);
  const urls = new Map();
  for (const specifier of references) {
    const asset = await realpath(localPath(root, entryHtml, specifier));
    assertInside(realRoot, asset, specifier);
    if (!(await stat(asset)).isFile()) throw new Error(`Pista de musica invalida: ${specifier}`);
    let url = specifier;
    if (audioMode === 'inline') url = `data:audio/mpeg;base64,${(await readFile(asset)).toString('base64')}`;
    if (audioMode === 'dist') url = `./dist/${specifier.slice(2)}`;
    urls.set(specifier, url);
  }
  return source.replace(MUSIC_LITERAL, (_, _quote, specifier) => JSON.stringify(urls.get(specifier)));
}

function pairs(names) {
  return names.split(',').map((name) => name.trim()).filter(Boolean).map((name) => {
    const match = NAME_PAIR.exec(name);
    if (!match) throw new Error(`Importacion/exportacion no soportada: ${name}`);
    return { source: match[1], local: match[2] ?? match[1] };
  });
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs)) result[match[1].toLowerCase()] = match[3];
  return result;
}

/** Bundles this project's deliberately small static ESM subset without dependencies.
 * Supported: named/namespace imports, export function/class/const, named export lists.
 * Not supported: cycles, live mutable exports, dynamic imports, re-exports, packages.
 * Modules retain isolated lexical scopes; every named import must actually exist.
 */
export async function buildStandalone({ projectRoot = PROJECT_ROOT, outputFile, audioMode = 'inline' } = {}) {
  if (!['inline', 'adjacent', 'dist'].includes(audioMode)) throw new Error('Modo de audio no soportado.');
  const root = resolve(projectRoot, 'dist');
  const entryHtml = resolve(root, 'index.html');
  let html = await readFile(entryHtml, 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)];
  if (scripts.length !== 1) throw new Error('index.html debe contener exactamente un script de entrada.');
  const scriptAttributes = attributes(scripts[0][0]);
  if (scriptAttributes.type !== 'module' || !scriptAttributes.src) throw new Error('El script de entrada debe ser un modulo local.');
  const entryModule = localPath(root, entryHtml, scriptAttributes.src);
  const modules = new Map();
  const visiting = new Set();
  const ordered = [];
  const moduleId = (path) => relative(root, path).split(sep).join('/');

  async function visit(path) {
    if (visiting.has(path)) throw new Error(`Dependencia circular no soportada: ${moduleId(path)}`);
    if (modules.has(path)) return modules.get(path);
    visiting.add(path);
    let source = await readFile(path, 'utf8');
    if (moduleId(path) === 'js/music.js') source = await bundleMusic(source, root, entryHtml, audioMode);
    const exports = new Map();
    const imports = [];
    if (/\bimport\s*(?:\(|\.\s*meta\b)/u.test(source)) throw new Error(`Importacion dinamica o import.meta no soportado: ${moduleId(path)}`);
    if (/^\s*export\s+(?:let|var|default|\*)\b/mu.test(source)) throw new Error(`Exportacion no soportada: ${moduleId(path)}`);

    source = source.replace(/^\s*import\s+(\{[^}]*\}|\*\s+as\s+[\w$]+)\s+from\s*(['"])([^'"]+)\2\s*;?/gm, (_, clause, _quote, specifier) => {
      const dependency = localPath(root, path, specifier);
      const namespace = /^\*\s+as\s+([\w$]+)$/.exec(clause);
      imports.push({ dependency, namespace: namespace?.[1], names: namespace ? [] : pairs(clause.slice(1, -1)) });
      return '\n';
    });

    source = source.replace(/^\s*export\s*\{([^}]+)\}\s*;/gm, (_, names) => {
      for (const name of pairs(names)) exports.set(name.local, name.source);
      return '\n';
    });

    const declaration = new RegExp(`^([ \\t]*)export\\s+((?:async\\s+)?function\\s*\\*?\\s+|class\\s+|const\\s+)(${IDENTIFIER})`, 'gm');
    source = source.replace(declaration, (_, indentation, kind, name) => {
      exports.set(name, name);
      return `${indentation}${kind}${name}`;
    });
    if (/^\s*(?:import|export)\b/mu.test(source)) throw new Error(`Sintaxis de modulo no soportada: ${moduleId(path)}`);

    const prelude = [];
    for (const dependency of imports) {
      const imported = await visit(dependency.dependency);
      const namespace = `__cuarentaModules[${JSON.stringify(moduleId(dependency.dependency))}]`;
      if (dependency.namespace) {
        prelude.push(`const ${dependency.namespace} = ${namespace};`);
      } else {
        for (const name of dependency.names) {
          if (!imported.exports.has(name.source)) throw new Error(`${moduleId(path)} importa un nombre inexistente: ${name.source}`);
        }
        const names = dependency.names.map(({ source: from, local }) => `${from}: ${local}`).join(', ');
        prelude.push(`const { ${names} } = ${namespace};`);
      }
    }

    const exported = [...exports].map(([name, value]) => `${JSON.stringify(name)}: ${value}`).join(', ');
    const code = `__cuarentaModules[${JSON.stringify(moduleId(path))}] = (() => {\n${prelude.join('\n')}\n${source}\nreturn Object.freeze({ ${exported} });\n})();`;
    // Fail before publishing an artifact with unsupported or malformed syntax.
    new Script(`(() => { const __cuarentaModules = {}; ${code} })()`, { filename: moduleId(path) });
    const record = { exports, code };
    visiting.delete(path);
    modules.set(path, record);
    ordered.push(record);
    return record;
  }

  await visit(entryModule);
  const javascript = `(() => {\n'use strict';\nconst __cuarentaModules = Object.create(null);\n${ordered.map((module) => module.code).join('\n\n')}\n})();`;
  new Script(javascript, { filename: 'cuarenta-standalone.js' });
  html = html.replace(scripts[0][0], `<script>\n${javascript.replace(/<\/script/gi, '<\\/script')}\n</script>`);

  let stylesheets = 0;
  let icons = 0;
  for (const match of [...html.matchAll(/<link\b[^>]*>/gi)]) {
    const tag = match[0];
    const attr = attributes(tag);
    if (attr.rel === 'stylesheet') {
      const css = await readFile(localPath(root, entryHtml, attr.href), 'utf8');
      const cssUrls = [...css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)/gis)];
      if (/@import\b/iu.test(css) || cssUrls.some((url) => !(url[2] ?? url[3]).startsWith('data:'))) {
        throw new Error('El CSS debe ser autocontenido, sin @import ni URL externas.');
      }
      if (/<\/style/iu.test(css)) throw new Error('El CSS contiene un cierre de style no permitido.');
      html = html.replace(tag, `<style>\n${css}\n</style>`);
      stylesheets += 1;
    } else if (attr.rel === 'icon') {
      const svg = await readFile(localPath(root, entryHtml, attr.href), 'utf8');
      const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      html = html.replace(tag, tag.replace(/href\s*=\s*(['"])(.*?)\1/i, `href="${dataUri}"`));
      icons += 1;
    } else {
      throw new Error(`Enlace externo no soportado en HTML autocontenido: ${attr.rel ?? tag}`);
    }
  }
  if (stylesheets !== 1 || icons !== 1) throw new Error('Se esperaba una hoja de estilos y un icono SVG.');
  // Prevent accidental runtime asset requests in the portable file.
  if (/<(?:script|img|iframe|audio|video|source)\b[^>]*\bsrc\s*=\s*['"](?!data:)/iu.test(html)) {
    throw new Error('El documento todavia contiene recursos externos.');
  }
  const destination = outputFile ? resolve(outputFile) : resolve(projectRoot, 'Jugar_Cuarenta.html');
  await writeFile(destination, html, 'utf8');
  const audioAssets = modules.has(resolve(root, 'js', 'music.js')) ? [...MUSIC_FILES] : [];
  return { path: destination, bytes: Buffer.byteLength(html), modules: modules.size, audioAssets };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const result = await buildStandalone();
    console.log(`Cuarenta portable: ${result.path}`);
    console.log(`${result.modules} modulos, ${result.bytes} bytes. Abre el HTML con doble clic.`);
  } catch (error) {
    console.error(`No se pudo generar el juego portable: ${error.message}`);
    process.exitCode = 1;
  }
}
