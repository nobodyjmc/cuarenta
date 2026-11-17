import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { PrivateTableClient } from '../dist/js/private-client.js';

const code = '23456789AB';
const token = 'x'.repeat(43);
const path = '/api/private/rooms/' + code;
const joinOptions = { name: 'Ana' };
const move = { cardId: 'heart-4', captureIds: [], expectedRevision: 3, gameId: 'game' };

function makeRoom(version = 1) {
  return { code, seat: 1, players: ['Don Julio', 'Ana'], view: null, rematch: [false, false], version };
}

function reply(room, status = 200) {
  return Response.json({ room }, { status });
}

function errorReply(error, code, status) {
  return Response.json({ error, code }, { status });
}

function seatStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key),
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('a joined seat resumes after reload and expired credentials are erased', async (t) => {
  const storage = seatStorage();
  const fetcher = async (url, request) => {
    if (url === path + '/join') {
      assert.equal(request.method, 'POST');
      assert.equal(request.headers.Authorization, undefined);
      assert.deepEqual(JSON.parse(request.body), joinOptions);
      return Response.json({ room: makeRoom(), token }, { status: 201 });
    }
    assert.equal(url, path);
    assert.equal(request.method, 'GET');
    assert.equal(request.headers.Authorization, 'Bearer ' + token);
    assert.equal(request.credentials, 'omit');
    return expired ? errorReply('La mesa venció.', 'ROOM_NOT_FOUND', 404) : reply(makeRoom(2));
  };
  let expired = false;
  const joining = new PrivateTableClient({ fetcher, storage });
  t.after(() => joining.disconnect());
  await assert.rejects(joining.join('XXXX', joinOptions), { code: 'INVALID_CODE' });
  assert.equal((await joining.join('  ' + code.toLowerCase() + ' ', joinOptions)).seat, 1);
  joining.disconnect();
  const states = [];
  const views = [];
  const restored = new PrivateTableClient({
    fetcher, storage,
    onConnection: status => states.push(status),
    onRoom: room => views.push(room.version),
  });
  t.after(() => restored.disconnect());
  assert.equal((await restored.restore()).version, 2);
  restored.disconnect();
  assert.equal((await restored.restore()).version, 2);
  assert.deepEqual(views, [2, 2]);
  expired = true;
  await assert.rejects(restored.restore(), { code: 'ROOM_NOT_FOUND', status: 404 });
  assert.equal(restored.room, null);
  assert.equal(restored.credential, null);
  assert.equal(states.at(-1), 'expired');
  const afterExpiry = new PrivateTableClient({ fetcher, storage });
  assert.equal(await afterExpiry.restore(), null);
});

test('writes do not regress to an older poll and recover the server view after a revision conflict', async (t) => {
  let releasePoll;
  let startPoll;
  const pollStarted = new Promise(resolve => { startPoll = resolve; });
  const delayedPoll = new Promise(resolve => { releasePoll = resolve; });
  const versions = [];
  let pollRequests = 0;
  const fetcher = async (url, request) => {
    if (url === path + '/join') return Response.json({ room: makeRoom(), token }, { status: 201 });
    assert.equal(request.headers.Authorization, 'Bearer ' + token);
    if (url === path) {
      if (++pollRequests === 1) {
        startPoll();
        return delayedPoll;
      }
      return reply(makeRoom(4));
    }
    assert.equal(url, path + '/play');
    const body = JSON.parse(request.body);
    assert.deepEqual({ ...body, expectedRevision: 3 }, move);
    return body.expectedRevision === 3 ? reply(makeRoom(3)) : errorReply('La partida avanzó.', 'STALE_STATE', 409);
  };
  const client = new PrivateTableClient({ fetcher, onRoom: room => versions.push(room.version), pollInterval: 10 });
  t.after(() => client.disconnect());
  await client.join(code, joinOptions);
  await pollStarted;
  assert.equal((await client.play(move)).version, 3);
  releasePoll(reply(makeRoom(2)));
  await assert.rejects(client.play({ ...move, expectedRevision: 4 }), { code: 'STALE_STATE' });
  assert.deepEqual(versions, [1, 3, 4]);
  assert.equal(client.room.version, 4);
});

test('background reads resume after a temporary connection failure', async (t) => {
  const history = [];
  let connectionFailed;
  const failureSeen = new Promise(resolve => { connectionFailed = resolve; });
  let connectedAgain;
  const recovered = new Promise(resolve => { connectedAgain = resolve; });
  let reads = 0;
  const client = new PrivateTableClient({
    fetcher: async (url) => {
      if (url === path + '/join') return Response.json({ room: makeRoom(), token }, { status: 201 });
      if (++reads === 1) throw new TypeError('network offline');
      return reply(makeRoom(2));
    },
    pollInterval: 10,
    onConnection(status) {
      history.push(status);
      if (status === 'reconnecting') connectionFailed();
      if (status === 'connected' && history.includes('reconnecting')) connectedAgain();
    },
  });
  t.after(() => client.disconnect());
  await client.join(code, joinOptions);
  await failureSeen;
  assert.equal(client.connection, 'reconnecting');
  await recovered;
  assert.equal(client.room.version, 2);
  client.disconnect();
  const completed = reads;
  await wait(35);
  assert.equal(reads, completed);
  assert.deepEqual(history, ['connecting', 'connected', 'reconnecting', 'connected', 'disconnected']);
});

test('a remote HTTPS backend receives only its own credential on reads and writes', async (t) => {
  const apiOrigin = 'https://mesas.example.org';
  const storage = seatStorage();
  const fetcher = async (url, request) => {
    assert.equal(request.credentials, 'omit');
    assert.equal(request.redirect, 'error');
    if (url === path + '/join' || url === apiOrigin + path + '/join') {
      assert.equal(request.headers.Authorization, undefined);
      const seatToken = url.startsWith(apiOrigin) ? 'r'.repeat(43) : token;
      return Response.json({ room: makeRoom(), token: seatToken }, { status: 201 });
    }
    assert.ok([apiOrigin + path, apiOrigin + path + '/play'].includes(url));
    assert.equal(request.headers.Authorization, 'Bearer ' + 'r'.repeat(43));
    return reply(makeRoom(request.method === 'POST' ? 3 : 2));
  };

  const local = new PrivateTableClient({ fetcher, storage });
  t.after(() => local.disconnect());
  await local.join(code, joinOptions);
  local.disconnect();

  const remote = new PrivateTableClient({ apiOrigin, fetcher, storage });
  t.after(() => remote.disconnect());
  assert.equal(await remote.restore(), null);
  await remote.join(code, joinOptions);
  remote.disconnect();

  const reloaded = new PrivateTableClient({ apiOrigin, fetcher, storage });
  t.after(() => reloaded.disconnect());
  assert.equal((await reloaded.restore()).version, 2);
  assert.equal((await reloaded.play(move)).version, 3);
  reloaded.forget();
  assert.equal(new PrivateTableClient({ fetcher, storage }).credential.token, token);
  assert.equal(new PrivateTableClient({ apiOrigin: 'https://otras-mesas.example.org', fetcher, storage }).credential, null);
});

test('explicit API configuration accepts only a canonical HTTPS origin', () => {
  for (const apiOrigin of [
    '//mesas.example.org',
    'http://mesas.example.org',
    'https://usuario:clave@mesas.example.org',
    'https://mesas.example.org/',
    'https://mesas.example.org/api',
    'https://mesas.example.org?redirect=1',
    'https://mesas.example.org#redirect',
  ]) {
    assert.throws(() => new PrivateTableClient({ apiOrigin }), TypeError, apiOrigin);
  }
});
