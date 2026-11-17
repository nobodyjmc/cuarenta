import { createServer as createHttpServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrivateRooms } from './private-rooms.mjs';

const DEFAULT_PORT = 4177;

function sendError(response, status, code, error) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify({ code, error }));
}

/** This server only handles game API routes and never loads site assets. */
export function createPrivateApiServer() {
  const handlePrivate = createPrivateRooms({ publicBeta: true });
  return createHttpServer({ headersTimeout: 5000, requestTimeout: 10000, maxHeaderSize: 8192 }, async (request, response) => {
    try {
      if (!await handlePrivate(request, response)) {
        sendError(response, 404, 'ROUTE_NOT_FOUND', 'Ruta no encontrada.');
      }
    } catch {
      if (response.headersSent) response.destroy();
      else sendError(response, 500, 'ROOM_ERROR', 'No se pudo actualizar la mesa. Vuelve a intentar.');
    }
  });
}

export async function startPrivateApiServer({ port = DEFAULT_PORT, host = '127.0.0.1' } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT debe ser un entero entre 0 y 65535.');
  }
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) {
    throw new Error('HOST debe ser 127.0.0.1 o 0.0.0.0.');
  }
  const server = createPrivateApiServer();
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      accept();
    });
  });
  return server;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const port = process.env.PORT === undefined ? DEFAULT_PORT : Number(process.env.PORT);
    const server = await startPrivateApiServer({ port, host: process.env.HOST });
    const { address, port: boundPort } = server.address();
    console.log('API de Mesa privada de Cuarenta en http://' + address + ':' + boundPort);
    const stop = () => server.close();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    console.error('No se pudo iniciar la API de Mesa privada: ' + error.message);
    process.exitCode = 1;
  }
}
