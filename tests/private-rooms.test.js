import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { legalMoves } from '../dist/js/engine.js';
import { createPrivateRooms } from '../scripts/private-rooms.mjs';

const root = '/api/private';
const collection = root + '/rooms';
const roomPath = (code) => collection + '/' + code;

function fixture(options) {
  const handle = createPrivateRooms(options);
  return async (path, { method = 'GET', body, token, headers = {}, chunks } = {}) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const stream = Readable.from(chunks ?? (payload ? [Buffer.from(payload)] : []));
    stream.url = path;
    stream.method = method;
    stream.headers = {
      ...(payload && { 'content-type': 'application/json' }),
      ...(token && { authorization: 'Bearer ' + token }),
      ...headers,
    };
    const response = {
      writeHead(status, headers) { Object.assign(this, { status, headers }); },
      end(data) { this.body = JSON.parse(data); },
    };
    const handled = await handle(stream, response);
    return { handled, status: response.status, headers: response.headers, data: response.body };
  };
}

function post(api, url, body, token) {
  return api(url, { method: 'POST', body, token });
}

async function createAndJoin(api, options = {}) {
  const host = await post(api, collection, { name: 'Ana', ...options });
  assert.equal(host.status, 201);
  const path = roomPath(host.data.room.code);
  const guest = await post(api, path + '/join', { name: 'Luis' });
  assert.equal(guest.status, 201);
  return { host, guest, path };
}

function seeded(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

test('creating and joining a private table issues independent seats and projects only the authorized hand', async () => {
  const api = fixture();
  assert.equal((await api('/assets/icon.svg')).handled, false);
  assert.deepEqual((await api(root + '/status')).data, { available: true });
  const { host, guest, path } = await createAndJoin(api, { comboPoints: 4 });
  assert.match(host.data.room.code, /^[2-9A-HJ-NP-Z]{10}$/);
  assert.deepEqual(host.data.room, {
    code: host.data.room.code,
    seat: 0,
    players: ['Ana', null],
    view: null,
    rematch: [false, false],
    version: 1,
  });
  assert.equal(guest.data.room.version, 2);
  assert.deepEqual(guest.data.room.players, ['Ana', 'Luis']);
  assert.match(host.data.token, /^[\w-]{43}$/);
  assert.match(guest.data.token, /^[\w-]{43}$/);
  assert.notEqual(host.data.token, guest.data.token);

  const hostRead = await api(path.toLowerCase(), { token: host.data.token });
  assert.equal(hostRead.status, 200);
  assert.equal(hostRead.headers['Cache-Control'], 'no-store');
  assert.equal(hostRead.headers['Access-Control-Allow-Origin'], undefined);
  const hostView = hostRead.data.room.view;
  const guestView = guest.data.room.view;
  assert.equal(hostRead.data.token, undefined);
  assert.equal(hostView.id, guestView.id);
  assert.equal(hostView.rules.comboPoints, 4);
  assert.equal(hostView.players[0].hand.length, 5);
  assert.equal(hostView.players[1].hand, null);
  assert.equal(guestView.players[0].hand, null);
  assert.equal(guestView.players[1].hand.length, 5);
  assert.equal(hostView.rondas[1], null);
  assert.equal(guestView.rondas[0], null);
  assert.equal(Object.hasOwn(hostView, 'deck'), false);
  assert.equal(Object.hasOwn(guestView, 'deck'), false);
  assert.equal((await api(path)).data.code, 'UNAUTHORIZED');
  assert.equal((await api(path, { token: 'no' })).status, 401);
  assert.equal((await post(api, path + '/join', { name: 'Otro' })).data.code, 'ROOM_FULL');

  const other = await post(api, collection, { name: 'Sara' });
  assert.equal((await api(path, { token: other.data.token })).status, 401);
});

test('only the authorized turn can play and concurrent actions from the same revision are applied once', async () => {
  const api = fixture();
  const { host, guest, path } = await createAndJoin(api);
  const tokens = [host.data.token, guest.data.token];
  const turn = guest.data.room.view.turn;
  const read = await api(path, { token: tokens[turn] });
  const { version, view } = read.data.room;
  const [move] = legalMoves(view, turn);
  const command = { cardId: move.cardId, captureIds: move.captureIds, gameId: view.id, expectedRevision: view.revision };
  const rejected = await post(api, path + '/play', { ...command, playerId: turn }, tokens[1 - turn]);
  assert.equal(rejected.status, 409);
  assert.equal(rejected.data.code, 'NOT_YOUR_TURN');
  const nextRoundEarly = await post(api, path + '/next-round', command, tokens[turn]);
  assert.equal(nextRoundEarly.data.code, 'WRONG_PHASE');
  const wrongGame = await post(api, path + '/play', { ...command, gameId: 'old' }, tokens[turn]);
  assert.equal(wrongGame.data.code, 'STALE_STATE');
  const foreignCard = await api(path, { token: tokens[1 - turn] });
  const invalid = await post(api, path + '/play', {
    ...command, cardId: foreignCard.data.room.view.players[1 - turn].hand[0].id,
  }, tokens[turn]);
  assert.equal(invalid.data.code, 'INVALID_MOVE');

  const double = await Promise.all([
    post(api, path + '/play', command, tokens[turn]),
    post(api, path + '/play', command, tokens[turn]),
  ]);
  assert.deepEqual(double.map((response) => response.status).sort(), [200, 409]);
  assert.equal(double.find((response) => response.status === 409).data.code, 'STALE_STATE');
  const accepted = double.find((response) => response.status === 200);
  assert.equal(accepted.data.room.version, version + 1);
  assert.equal(accepted.data.room.view.revision, view.revision + 1);
  const other = await api(path, { token: tokens[1 - turn] });
  assert.equal(other.data.room.view.revision, view.revision + 1);
  assert.equal(other.data.room.view.table[0].id, move.cardId);
  assert.equal(other.data.room.view.players[turn].hand, null);
  assert.equal(Object.hasOwn(other.data.room.view.lastPlay, 'fromRonda'), false);
});

test('only one guest receives the remaining seat when two requests arrive together', async () => {
  const api = fixture();
  const host = await post(api, collection, { name: 'Ana' });
  const path = roomPath(host.data.room.code);
  const requests = await Promise.all([
    post(api, path + '/join', { name: 'Luis' }),
    post(api, path + '/join', { name: 'Sara' }),
  ]);
  assert.deepEqual(requests.map(({ status }) => status).sort(), [201, 409]);
  const accepted = requests.find(({ status }) => status === 201);
  const rejected = requests.find(({ status }) => status === 409);
  assert.equal(rejected.data.token, undefined);
  const waiting = await api(path, { token: host.data.token });
  assert.deepEqual(waiting.data.room.players, accepted.data.room.players);
});

test('completes a game, advances a cycle, and starts a fresh match only after both accept a rematch', async () => {
  const api = fixture({ random: seeded(2617) });
  const { host, guest, path } = await createAndJoin(api);
  const tokens = [host.data.token, guest.data.token];
  let room = guest.data.room;
  for (let actions = 0; actions < 240 && room.view.status !== 'finished'; actions += 1) {
    const { view } = room;
    const expected = { gameId: view.id, expectedRevision: view.revision };
    if (view.status === 'round-end') {
      const response = await post(api, path + '/next-round', expected, tokens[room.seat]);
      assert.equal(response.status, 200);
      assert.equal(response.data.room.view.round, view.round + 1);
      room = response.data.room;
    } else {
      const active = await api(path, { token: tokens[view.turn] });
      const [move] = legalMoves(active.data.room.view, view.turn).sort(
        (a, b) => Number(b.winsGame) - Number(a.winsGame) || b.points - a.points || b.captureIds.length - a.captureIds.length
      );
      const response = await post(api, path + '/play', {
        ...expected, cardId: move.cardId, captureIds: move.captureIds,
      }, tokens[view.turn]);
      assert.equal(response.status, 200);
      room = response.data.room;
    }
  }
  assert.equal(room.view.status, 'finished');
  assert(room.view.round > 1);

  const gameId = room.view.id;
  const first = await post(api, path + '/rematch', { gameId }, tokens[0]);
  assert.deepEqual(first.data.room.rematch, [true, false]);
  assert.equal(first.data.room.view.id, gameId);
  const retry = await post(api, path + '/rematch', { gameId }, tokens[0]);
  assert.equal(retry.data.room.version, first.data.room.version);
  const second = await post(api, path + '/rematch', { gameId }, tokens[1]);
  assert.equal(second.data.room.view.revision, 0);
  assert.notEqual(second.data.room.view.id, gameId);
  assert.equal(second.data.room.view.dealer, 1 - room.view.dealer);
  assert.deepEqual(second.data.room.rematch, [false, false]);
  assert.equal((await post(api, path + '/rematch', { gameId }, tokens[0])).data.code, 'STALE_STATE');
});

test('rejects non-JSON, oversized payloads, invalid names and rules, and cross-site requests', async () => {
  const api = fixture();
  assert.equal((await api(collection)).status, 405);
  assert.equal((await post(api, collection, { name: 'X'.repeat(21) })).data.code, 'INVALID_NAME');
  assert.equal((await post(api, collection, { name: 'Ana', comboPoints: 3 })).data.code, 'INVALID_RULES');
  assert.equal((await api(collection, { method: 'POST', body: {}, headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await api(collection, { method: 'POST', body: {}, headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await api(collection, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': '2048' },
  })).status, 413);
  assert.equal((await api(collection, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    chunks: [Buffer.alloc(600), Buffer.alloc(500)],
  })).status, 413);
  assert.equal((await post(api, collection, [])).data.code, 'INVALID_JSON');
  assert.equal((await api(roomPath('AA22BB33CC'), { token: 'Z'.repeat(43) })).data.code, 'ROOM_NOT_FOUND');
});

test('caps waiting rooms and polling does not prevent room expiry', async () => {
  let now = 0;
  const api = fixture({ now: () => now, waitMs: 10, idleMs: 20, maxAgeMs: 50, maxRooms: 1 });
  const host = await post(api, collection, {});
  assert.equal(host.status, 201);
  const path = roomPath(host.data.room.code);
  assert.equal((await post(api, collection, {})).status, 503);
  now = 9;
  assert.equal((await api(path, { token: host.data.token })).status, 200);
  now = 10;
  assert.equal((await api(path, { token: host.data.token })).status, 404);
  const second = await createAndJoin(api);
  now = 29;
  assert.equal((await api(second.path, { token: second.host.data.token })).status, 200);
  now = 30;
  assert.equal((await api(second.path, { token: second.guest.data.token })).status, 404);
});
