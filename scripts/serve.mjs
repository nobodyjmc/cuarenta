import { createServer as createHttpServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrivateRooms } from './private-rooms.mjs';

export const APP_ID = 'cuarenta-local';
export const APP_VERSION = '0.19.1';
export const DEFAULT_PORT = 4173;
const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function isInside(root, target) {
  const child = relative(root, target);
  return child !== '' && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function send(request, response, status, body, contentType = 'application/json; charset=utf-8', headers = {}) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(request.method === 'HEAD' ? undefined : data);
}

/** Creates an unbound server. Only the contents of staticRoot can be served. */
export function createServer({ staticRoot = DEFAULT_ROOT, privateTables = false } = {}) {
  const root = resolve(staticRoot);
  const privateRooms = privateTables ? createPrivateRooms() : null;
  return createHttpServer(async (request, response) => {
    // Inspect the original path before URL normalization can remove ../ segments.
    // Asset names are plain paths; encoded paths are deliberately unsupported.
    const requestPath = (request.url ?? '').split('?')[0];
    const segments = requestPath.split('/');
    if (!requestPath.startsWith('/') || requestPath.startsWith('//') ||
        /[%\\#\u0000-\u001f\u007f]/u.test(requestPath) ||
        segments.some((segment) => segment.startsWith('.'))) {
      send(request, response, 400, JSON.stringify({ error: 'Ruta no valida.' }));
      return;
    }

    if (privateRooms && requestPath.startsWith('/api/private/')) {
      try {
        if (await privateRooms(request, response, requestPath)) return;
      } catch {
        if (!response.headersSent) {
          send(request, response, 500, JSON.stringify({ error: 'No se pudo procesar la solicitud.', code: 'INTERNAL' }));
        } else response.destroy();
        return;
      }
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(request, response, 405, JSON.stringify({ error: 'Metodo no permitido.' }), undefined, { Allow: 'GET, HEAD' });
      return;
    }

    if (requestPath === '/__cuarenta_health') {
      send(request, response, 200, JSON.stringify({ app: APP_ID, version: APP_VERSION }));
      return;
    }

    const asset = requestPath === '/' ? 'index.html' : requestPath.slice(1);
    const target = resolve(root, asset);
    if (!isInside(root, target)) {
      send(request, response, 400, JSON.stringify({ error: 'Ruta no valida.' }));
      return;
    }

    try {
      // Check real paths as well, so a symlink inside dist cannot expose files outside it.
      const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(target)]);
      if (!isInside(realRoot, realTarget)) {
        send(request, response, 403, JSON.stringify({ error: 'Archivo no permitido.' }));
        return;
      }
      const info = await stat(realTarget);
      if (!info.isFile()) {
        send(request, response, 404, JSON.stringify({ error: 'Archivo no encontrado.' }));
        return;
      }
      const contents = await readFile(realTarget);
      const body = privateTables && asset === 'index.html'
        ? contents.toString('utf8').replace('<!-- cuarenta-private-capability -->', '<meta name="cuarenta-private" content="1">')
        : contents;
      send(request, response, 200, body, MIME_TYPES[extname(realTarget).toLowerCase()] ?? 'application/octet-stream');
    } catch (error) {
      const missing = ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code);
      send(request, response, missing ? 404 : 500, JSON.stringify({
        error: missing ? 'Archivo no encontrado.' : 'No se pudo leer el archivo.',
      }));
    }
  });
}

/** Binds to loopback unless LAN or hosting access was explicitly requested. */
export async function startServer({ port = DEFAULT_PORT, staticRoot = DEFAULT_ROOT, lan = false, privateTables = lan } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('El puerto debe ser un entero entre 0 y 65535.');
  const server = createServer({ staticRoot, privateTables });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
      server.off('error', reject);
      accept();
    });
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

export function parsePortArguments(args) {
  if (args.length === 0) return DEFAULT_PORT;
  let value;
  if (args.length === 2 && args[0] === '--port') value = args[1];
  else if (args.length === 1 && args[0].startsWith('--port=')) value = args[0].slice(7);
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Uso: node scripts/serve.mjs [--port 4173]');
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) throw new Error('El puerto debe estar entre 0 y 65535.');
  return port;
}

// Importing this module does not open a port or install process handlers.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = process.argv.slice(2);
    const lan = args.includes('--lan');
    const portArgs = args.filter(arg => arg !== '--lan');
    const port = parsePortArguments(lan && !portArgs.length && process.env.PORT
      ? ['--port', process.env.PORT] : portArgs);
    const { server, url } = await startServer({ port, lan });
    console.log(`Cuarenta Local: ${url}`);
    if (lan) {
      const addresses = Object.values(networkInterfaces()).flat()
        .filter(address => address.family === 'IPv4' && !address.internal);
      for (const address of addresses) console.log(`En la misma red: http://${address.address}:${server.address().port}/`);
    }
    console.log(lan ? 'Abre el mismo enlace de red en ambos equipos. Ctrl+C para cerrar.' : 'Disponible solo en este dispositivo. Ctrl+C para cerrar.');
    const stop = () => server.close(() => process.exit(0));
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    console.error(error.code === 'EADDRINUSE'
      ? 'El puerto ya esta ocupado. Cierra la otra instancia o utiliza --port con otro numero.'
      : `No se pudo iniciar Cuarenta: ${error.message}`);
    process.exitCode = 1;
  }
}
