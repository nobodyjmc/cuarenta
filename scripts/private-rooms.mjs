import { randomBytes, timingSafeEqual } from 'node:crypto';
import { advanceRound, applyMove, createGame, publicView } from '../dist/js/engine.js';

const API = '/api/private/';
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_PATH = /^\/api\/private\/rooms\/([2-9A-HJ-NP-Z]{10})(?:\/(join|play|next-round|rematch))?$/i;
const TOKEN = /^Bearer ([\w-]{43})$/i;
const CARD_ID = /^(?:hearts|diamonds|clubs|spades)-(?:[A2-7JQK])$/;
const MAX_BODY = 1024;
const MINUTE = 60_000;
const PUBLIC_ORIGIN = 'https://nobodyjmc.github.io';
const PUBLIC_REQUEST_HEADERS = new Set(['authorization', 'content-type']);

class RoomError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function send(response, status, payload, headers = {}) {
  if (response.destroyed) return;
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(body);
}

function allowsPublicHeaders(request) {
  const requested = request.headers['access-control-request-headers'];
  return !requested || requested.split(',').every((header) => PUBLIC_REQUEST_HEADERS.has(header.trim().toLowerCase()));
}

function rejectBody(request, error) {
  request.resume();
  throw error;
}

async function readJson(request) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    rejectBody(request, new RoomError(415, 'JSON_REQUIRED', 'Envía los datos de la mesa como JSON.'));
  }
  const tooLarge = new RoomError(413, 'BODY_TOO_LARGE', 'Los datos de la mesa superan el tamaño permitido.');
  if (Number(request.headers['content-length']) > MAX_BODY) rejectBody(request, tooLarge);

  // Drain excess bytes without collecting them or destroying the socket before the 413.
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) rejectBody(request, tooLarge);
    chunks.push(chunk);
  }

  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RoomError(400, 'INVALID_JSON', 'No se pudieron leer los datos de la mesa.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RoomError(400, 'INVALID_JSON', 'Los datos de la mesa deben ser un objeto JSON.');
  }
  return body;
}

function playerName(value, seat) {
  if (value === undefined) return 'Jugador ' + (seat + 1);
  if (typeof value !== 'string' || value.length > 20 || /[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(value)) {
    throw new RoomError(400, 'INVALID_NAME', 'Usa un nombre de hasta 20 caracteres.');
  }
  return value.trim() || 'Jugador ' + (seat + 1);
}

function actorSeat(request, room) {
  const token = TOKEN.exec(request.headers.authorization ?? '')?.[1];
  if (token) {
    const bytes = Buffer.from(token);
    const seat = room.tokens.findIndex((saved) => saved && timingSafeEqual(saved, bytes));
    if (seat !== -1) return seat;
  }
  throw new RoomError(401, 'UNAUTHORIZED', 'Este navegador no tiene un asiento en la mesa.');
}

function snapshot(room, seat) {
  return {
    code: room.code,
    seat,
    players: room.players,
    view: room.game ? publicView(room.game, seat) : null,
    rematch: room.rematch,
    version: room.version,
  };
}

function verifyGame(room, body, checkRevision = true) {
  if (!room.game) throw new RoomError(409, 'WRONG_PHASE', 'Espera a que llegue el otro jugador.');
  if (body.gameId !== room.game.id || (checkRevision && body.expectedRevision !== room.game.revision)) {
    throw new RoomError(409, 'STALE_STATE', 'La mesa cambió. Revisa el turno y vuelve a intentar.');
  }
  return room.game;
}

function play(room, seat, body) {
  const game = verifyGame(room, body);
  if (game.status !== 'playing') {
    throw new RoomError(409, 'WRONG_PHASE', 'La partida no admite jugadas en este momento.');
  }
  if (game.turn !== seat) throw new RoomError(409, 'NOT_YOUR_TURN', 'Todavía no es tu turno.');
  const { cardId, captureIds } = body;
  const isCardId = (id) => typeof id === 'string' && CARD_ID.test(id);
  if (!isCardId(cardId) || !Array.isArray(captureIds) || captureIds.length > 10 || !captureIds.every(isCardId)) {
    throw new RoomError(400, 'INVALID_MOVE', 'Comprueba la carta y la captura seleccionadas.');
  }
  try {
    room.game = applyMove(game, { playerId: seat, cardId, captureIds, expectedRevision: body.expectedRevision });
  } catch (error) {
    throw new RoomError(400, 'INVALID_MOVE', error.message);
  }
}

/** Stores private games for one server process. Waiting rooms expire after 30 minutes;
 * active games expire after two hours without a successful write, or at 12 hours total. */
export function createPrivateRooms({
  now = Date.now,
  random,
  maxRooms = 128,
  waitMs = 30 * MINUTE,
  idleMs = 120 * MINUTE,
  maxAgeMs = 720 * MINUTE,
  publicBeta = false,
} = {}) {
  const rooms = new Map();

  const expired = (room, time) => time >= room.createdAt + maxAgeMs ||
    time >= room.lastWrite + (room.game ? idleMs : waitMs);

  function roomByCode(code) {
    const room = rooms.get(code);
    if (room && !expired(room, now())) return room;
    rooms.delete(code);
    throw new RoomError(404, 'ROOM_NOT_FOUND', 'La mesa no existe o ya cerró. Pide una nueva invitación.');
  }

  function createRoom(body) {
    const time = now();
    for (const [code, room] of rooms) if (expired(room, time)) rooms.delete(code);
    if (rooms.size >= maxRooms) {
      throw new RoomError(503, 'ROOM_LIMIT', 'Todas las mesas están ocupadas. Intenta de nuevo en unos minutos.');
    }
    const name = playerName(body.name, 0);
    const { comboPoints = 2 } = body;
    if (comboPoints !== 2 && comboPoints !== 4) {
      throw new RoomError(400, 'INVALID_RULES', 'Caída y limpia deben valer 2 o 4 puntos.');
    }
    let code;
    do {
      code = Array.from(randomBytes(10), (byte) => CODE_ALPHABET[byte & 31]).join('');
    } while (rooms.has(code));
    const token = randomBytes(32).toString('base64url');
    const room = {
      code, comboPoints, createdAt: time, lastWrite: time, version: 1,
      players: [name, null], tokens: [Buffer.from(token), null], game: null, rematch: [false, false],
    };
    rooms.set(code, room);
    return { room: snapshot(room, 0), token };
  }

  function joinRoom(room, body) {
    if (room.game) throw new RoomError(409, 'ROOM_FULL', 'La mesa ya tiene dos jugadores.');
    let name = playerName(body.name, 1);
    if (name === room.players[0]) name = name.slice(0, 18) + ' 2';
    const names = [room.players[0], name];
    const game = createGame({ mode: 'pass', names, comboPoints: room.comboPoints, random });
    const token = randomBytes(32).toString('base64url');
    room.players = names;
    room.tokens[1] = Buffer.from(token);
    room.game = game;
    room.version += 1;
    room.lastWrite = now();
    return { room: snapshot(room, 1), token };
  }

  function resumePlay(room, seat, action, body) {
    if (action === 'play') play(room, seat, body);
    else if (action === 'next-round') {
      const game = verifyGame(room, body);
      if (game.status !== 'round-end') {
        throw new RoomError(409, 'WRONG_PHASE', 'El ciclo todavía no ha terminado.');
      }
      room.game = advanceRound(game, { random });
    } else {
      const game = verifyGame(room, body, false);
      if (game.status !== 'finished') {
        throw new RoomError(409, 'WRONG_PHASE', 'La revancha empieza después de terminar la partida.');
      }
      if (room.rematch[seat]) return;
      if (room.rematch[1 - seat]) {
        room.game = createGame({
          mode: 'pass', names: room.players, comboPoints: room.comboPoints,
          dealer: 1 - game.dealer, random,
        });
        room.rematch = [false, false];
      } else room.rematch[seat] = true;
    }
    room.version += 1;
    room.lastWrite = now();
  }

  return async function handlePrivate(request, response, requestPath = request.url?.split('?')[0] ?? '') {
    if (!requestPath.startsWith(API)) return false;
    const isStatus = requestPath === API + 'status';
    const isCreate = requestPath === API + 'rooms';
    const route = ROOM_PATH.exec(requestPath);
    const action = route?.[2]?.toLowerCase();
    const allowedOrigin = publicBeta && request.headers.origin === PUBLIC_ORIGIN;
    const cors = publicBeta ? {
      Vary: 'Origin',
      ...(allowedOrigin && { 'Access-Control-Allow-Origin': PUBLIC_ORIGIN }),
    } : {};
    const reply = (status, payload, headers) => send(response, status, payload, { ...cors, ...headers });
    try {
      if (!isStatus && !isCreate && !route) {
        throw new RoomError(404, 'ROUTE_NOT_FOUND', 'Acción de mesa desconocida.');
      }
      const expectedMethod = isCreate || action ? 'POST' : 'GET';
      if (publicBeta && !allowedOrigin && !(isStatus && request.method === 'GET' && !request.headers.origin)) {
        throw new RoomError(403, 'CROSS_SITE', 'Abre el juego desde la página oficial de Cuarenta.');
      }
      if (allowedOrigin && request.method === 'OPTIONS') {
        if (request.headers['access-control-request-method'] !== expectedMethod || !allowsPublicHeaders(request)) {
          throw new RoomError(400, 'INVALID_PREFLIGHT', 'Método o encabezados de solicitud no permitidos.');
        }
        response.writeHead(204, {
          ...cors,
          Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
          'Access-Control-Allow-Methods': expectedMethod,
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '300',
          'Cache-Control': 'no-store',
        });
        response.end();
        return true;
      }
      if (request.method !== expectedMethod) {
        reply(405, { code: 'METHOD_NOT_ALLOWED', error: 'Método no permitido.' }, { Allow: expectedMethod });
      } else if (!allowedOrigin && request.headers['sec-fetch-site'] === 'cross-site') {
        throw new RoomError(403, 'CROSS_SITE', 'Abre el juego en la misma dirección que la mesa.');
      } else if (isStatus) reply(200, { available: true });
      else if (isCreate) reply(201, createRoom(await readJson(request)));
      else if (action === 'join') {
        const body = await readJson(request);
        reply(201, joinRoom(roomByCode(route[1].toUpperCase()), body));
      } else {
        const room = roomByCode(route[1].toUpperCase());
        const seat = actorSeat(request, room);
        if (action) {
          const body = await readJson(request);
          if (expired(room, now()) || rooms.get(room.code) !== room) {
            throw new RoomError(404, 'ROOM_NOT_FOUND', 'La mesa ya cerró. Pide una nueva invitación.');
          }
          resumePlay(room, seat, action, body);
        }
        reply(200, { room: snapshot(room, seat) });
      }
    } catch (error) {
      if (!(error instanceof RoomError)) {
        reply(500, { code: 'ROOM_ERROR', error: 'No se pudo actualizar la mesa. Vuelve a intentar.' });
      } else reply(error.status, { code: error.code, error: error.message });
    }
    return true;
  };
}
