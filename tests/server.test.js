import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { createServer as createHttpServer } from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { APP_ID, APP_VERSION, createServer, startServer, parsePortArguments } from '../scripts/serve.mjs';
const run = promisify(execFile);
const launcher = fileURLToPath(new URL('../Iniciar_Cuarenta.ps1', import.meta.url));

function request(url, path, method = 'GET') {
  return new Promise((accept, reject) => {
    const target = new URL(url);
    const req = httpRequest({ hostname: target.hostname, port: target.port, path, method }, (res) => {
      const chunks = [];
      res.on('data', (data) => chunks.push(data));
      res.on('end', () => accept({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'cuarenta server '));
  const staticRoot = join(directory, 'dist');
  await mkdir(join(staticRoot, 'assets'), { recursive: true });
  await writeFile(join(staticRoot, 'index.html'), '<h1>Cuarenta</h1>');
  await writeFile(join(staticRoot, 'assets', 'cards.svg'), '<svg/>');
  await writeFile(join(staticRoot, 'app.js'), 'export const ready = true;');
  await writeFile(join(staticRoot, 'app.css'), 'body { color: green; }');
  await writeFile(join(staticRoot, 'manifest.json'), '{"name":"Cuarenta"}');
  await writeFile(join(staticRoot, 'favicon.ico'), Buffer.from([0, 0, 1, 0]));
  await writeFile(join(staticRoot, '.secret'), 'private');
  await writeFile(join(directory, 'outside.txt'), 'outside');
  const { server, url } = await startServer({ staticRoot, port: 0 });
  t.after(async () => {
    await new Promise((accept, reject) => server.close((error) => error ? reject(error) : accept()));
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, staticRoot, server, url };
}

test('creating a server has no listening side effect', (t) => {
  const server = createServer();
  assert.equal(server.listening, false);
  assert.equal(server.address(), null);
  server.close();
});

test('server binds to loopback and provides exact app health', async (t) => {
  const { server, url } = await fixture(t);
  assert.equal(server.address().address, '127.0.0.1');
  const response = await request(url, '/__cuarenta_health?cache=1');
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { app: APP_ID, version: APP_VERSION });
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('serves root, query URLs and web asset MIME types', async (t) => {
  const { url } = await fixture(t);
  const cases = [
    ['/?theme=%23green', 'text/html'],
    ['/assets/cards.svg?v=1', 'image/svg+xml'],
    ['/app.js', 'text/javascript'],
    ['/app.css', 'text/css'],
    ['/manifest.json', 'application/json'],
    ['/favicon.ico', 'image/x-icon'],
  ];
  for (const [path, mime] of cases) {
    const response = await request(url, path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers['content-type'].startsWith(mime), path);
    assert.ok(Number(response.headers['content-length']) > 0, path);
  }
});

test('HEAD has GET headers without a response body', async (t) => {
  const { url } = await fixture(t);
  for (const path of ['/', '/__cuarenta_health', '/absent']) {
    const get = await request(url, path);
    const head = await request(url, path, 'HEAD');
    assert.equal(head.status, get.status);
    assert.equal(head.headers['content-length'], get.headers['content-length']);
    assert.equal(head.body, '');
  }
});

test('rejects traversal, encoded paths, dotfiles, backslashes and absolute-form targets', async (t) => {
  const { url } = await fixture(t);
  const paths = [
    '/../outside.txt', '/assets/../../outside.txt', '/./index.html',
    '/%2e%2e/outside.txt', '/%252e%252e/outside.txt', '/assets%2fcards.svg',
    '/assets/..%5coutside.txt', '/..\\outside.txt', '/.secret', '/.git/config',
    '//outside.txt', 'http://example.com/index.html',
  ];
  for (const path of paths) {
    const response = await request(url, path);
    assert.equal(response.status, 400, path);
    assert.ok(!response.body.includes('outside'), path);
  }
});

test('returns 404 for unknown files and directories, and 405 for writes', async (t) => {
  const { url } = await fixture(t);
  for (const path of ['/unknown', '/assets/', '/package.json', '/scripts/serve.mjs']) {
    assert.equal((await request(url, path)).status, 404, path);
  }
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const response = await request(url, '/__cuarenta_health', method);
    assert.equal(response.status, 405);
    assert.equal(response.headers.allow, 'GET, HEAD');
  }
});

test('does not expose files through directory links outside the static root', async (t) => {
  const { directory, staticRoot, url } = await fixture(t);
  const outside = join(directory, 'private');
  await mkdir(outside);
  await writeFile(join(outside, 'secret.txt'), 'private-data');
  // Junctions on Windows need no symlink privilege.
  await symlink(outside, join(staticRoot, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const response = await request(url, '/linked/secret.txt');
  assert.equal(response.status, 403);
  assert.ok(!response.body.includes('private-data'));
});

test('an occupied port fails without disturbing the existing server', async (t) => {
  const { staticRoot, server, url } = await fixture(t);
  await assert.rejects(startServer({ staticRoot, port: server.address().port }), { code: 'EADDRINUSE' });
  assert.equal((await request(url, '/')).status, 200);
});

test('port arguments are explicit and validated', async () => {
  assert.equal(parsePortArguments([]), 4173);
  assert.equal(parsePortArguments(['--port', '4174']), 4174);
  assert.equal(parsePortArguments(['--port=0']), 0);
  for (const args of [['--host', '0.0.0.0'], ['--port'], ['--port', '-1'], ['--port', '65536'], ['--port', '4.5'], ['--port='], ['--port', 'abc']]) {
    assert.throws(() => parsePortArguments(args));
  }
  await assert.rejects(startServer({ port: -1 }));
});

test('Windows launcher reuses this app without opening another server', { skip: process.platform !== 'win32' }, async (t) => {
  const { server, url } = await fixture(t);
  const result = await run('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher, '-Port', String(server.address().port), '-NoBrowser'], { timeout: 15000, windowsHide: true });
  assert.ok(result.stdout.includes('ya esta disponible'));
  assert.equal((await request(url, '/__cuarenta_health')).status, 200);
});

test('Windows launcher rejects an unrelated occupied port without closing it', { skip: process.platform !== 'win32' }, async (t) => {
  const foreign = createHttpServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ app: 'some-other-app' }));
  });
  await new Promise((accept) => foreign.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise((accept) => foreign.close(accept)));
  const port = foreign.address().port;
  await assert.rejects(run('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher, '-Port', String(port), '-NoBrowser'], { timeout: 15000, windowsHide: true }), (error) => {
    assert.equal(error.code, 1);
    assert.ok(error.stdout.includes('ocupado por otra aplicacion'));
    return true;
  });
  const response = await request(`http://127.0.0.1:${port}`, '/');
  assert.deepEqual(JSON.parse(response.body), { app: 'some-other-app' });
});
