import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { startDevServer } from '../dev/server.mjs';

const API = '/functions/v1/app/api';

async function setup(t, options = {}) {
  const running = await startDevServer({ port: 0, ...options });
  t.after(() => running.close());
  return running;
}

async function request(origin, path, {
  method = 'GET',
  json,
  raw,
  headers = {},
} = {}) {
  const init = { method, headers: { ...headers } };
  if (json !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(json);
  } else if (raw !== undefined) {
    init.body = raw;
  }
  const response = await fetch(`${origin}${path}`, init);
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { status: response.status, body, headers: response.headers };
}

async function createRoom(origin) {
  const response = await request(origin, `${API}/rooms`, { method: 'POST', json: {} });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  return response.body;
}

async function joinRoom(origin, code) {
  return request(origin, `${API}/rooms/${code}/join`, { method: 'POST', json: {} });
}

async function send(origin, room, kind, payload) {
  return request(origin, `${API}/rooms/${room.code}/signals`, {
    method: 'POST',
    json: { token: room.token, kind, payload },
  });
}

async function poll(origin, room, after = 0) {
  return request(origin, `${API}/rooms/${room.code}/signals?token=${room.token}&after=${after}`);
}

test('host/guest signaling flow, peer filtering, bye and close', async t => {
  const { origin } = await setup(t);
  const host = await createRoom(origin);
  assert.match(host.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.match(host.token, /^[0-9a-f-]{36}$/);
  assert.equal(host.role, 'host');

  let response = await poll(origin, host);
  assert.deepEqual(response.body, {
    ok: true,
    role: 'host',
    status: 'waiting',
    guestJoined: false,
    signals: [],
  });

  const guestResponse = await joinRoom(origin, host.code);
  assert.equal(guestResponse.status, 200);
  const guest = guestResponse.body;
  assert.equal(guest.role, 'guest');
  assert.equal(guest.code, host.code);
  assert.notEqual(guest.token, host.token);

  response = await joinRoom(origin, host.code);
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'room_full');
  response = await joinRoom(origin, 'AAAAAA');
  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'room_not_found');

  assert.equal((await send(origin, host, 'offer', { type: 'offer', sdp: 'local-sdp' })).body.id, 1);
  assert.equal((await send(origin, host, 'ice', { candidate: 'candidate-1' })).body.id, 2);
  assert.equal((await send(origin, guest, 'answer', { type: 'answer', sdp: 'remote-sdp' })).body.id, 3);
  assert.equal((await send(origin, guest, 'ice', null)).body.id, 4);

  response = await poll(origin, guest, 1);
  assert.equal(response.status, 200);
  assert.equal(response.body.role, 'guest');
  assert.equal(response.body.status, 'joined');
  assert.equal(response.body.guestJoined, true);
  assert.deepEqual(response.body.signals, [
    { id: 2, kind: 'ice', payload: { candidate: 'candidate-1' } },
  ]);

  response = await poll(origin, host, 0);
  assert.deepEqual(response.body.signals, [
    { id: 3, kind: 'answer', payload: { type: 'answer', sdp: 'remote-sdp' } },
    { id: 4, kind: 'ice', payload: null },
  ]);

  assert.equal((await send(origin, guest, 'bye', null)).body.id, 5);
  response = await poll(origin, host, 4);
  assert.equal(response.body.status, 'closed');
  assert.deepEqual(response.body.signals, [{ id: 5, kind: 'bye', payload: null }]);

  response = await send(origin, host, 'ice', null);
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'room_closed');
  response = await joinRoom(origin, host.code);
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'room_closed');

  response = await request(origin, `${API}/rooms/${host.code}/close`, {
    method: 'POST', json: { token: host.token },
  });
  assert.deepEqual(response.body, { ok: true });
});

test('role/kind rules and capability token authorization', async t => {
  const { origin } = await setup(t);
  const host = await createRoom(origin);
  const guest = (await joinRoom(origin, host.code)).body;

  let response = await send(origin, guest, 'offer', {});
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'kind_not_allowed');
  response = await send(origin, host, 'answer', {});
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'kind_not_allowed');
  response = await send(origin, host, 'ping', {});
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'invalid_kind');
  response = await send(origin, host, 'ice', null);
  assert.equal(response.status, 200);

  response = await request(origin, `${API}/rooms/${host.code}/signals?token=bad&after=0`);
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'invalid_token');
  response = await request(origin, `${API}/rooms/${host.code}/signals?token=${randomUUID()}&after=0`);
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'invalid_token');

  response = await request(origin, `${API}/rooms/${host.code}/close`, {
    method: 'POST', json: { token: guest.token },
  });
  assert.deepEqual(response.body, { ok: true });
});

test('health endpoint identifies a signaling deployment', async t => {
  const { origin } = await setup(t);
  const response = await request(origin, `${API}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
});

test('unknown routes, methods, JSON, sizes, codes and cursors fail explicitly', async t => {
  const { origin } = await setup(t);
  let response = await request(origin, '/functions/v1/app/not-a-route');
  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'not_found');
  response = await request(origin, `${API}/rooms`);
  assert.equal(response.status, 405);
  assert.equal(response.body.error, 'method_not_allowed');

  response = await request(origin, `${API}/rooms`, {
    method: 'POST', raw: '{', headers: { 'content-type': 'application/json' },
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'invalid_json');
  response = await request(origin, `${API}/rooms`, { method: 'POST', raw: '{}' });
  assert.equal(response.status, 415);
  assert.equal(response.body.error, 'unsupported_media_type');
  response = await request(origin, `${API}/rooms`, { method: 'POST', json: [] });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'invalid_input');
  response = await request(origin, `${API}/rooms`, { method: 'POST', json: { extra: true } });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'invalid_input');
  response = await request(origin, `${API}/rooms`, {
    method: 'POST',
    raw: JSON.stringify({ value: 'x'.repeat(33_000) }),
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(response.status, 413);
  assert.equal(response.body.error, 'payload_too_large');

  response = await joinRoom(origin, 'IIIIII');
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'invalid_code');

  const host = await createRoom(origin);
  for (const after of ['-1', '1.5', '01', 'not-a-number']) {
    response = await request(origin, `${API}/rooms/${host.code}/signals?token=${host.token}&after=${after}`);
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'invalid_after');
  }
  response = await request(origin, `${API}/rooms/${host.code}/signals`, {
    method: 'POST', json: { token: host.token, kind: 'offer' },
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'invalid_input');
  response = await request(origin, `${API}/rooms/${host.code}/signals`, {
    method: 'PUT', json: {},
  });
  assert.equal(response.status, 405);
  assert.equal(response.body.error, 'method_not_allowed');
});

test('physical and Provider-stripped Function prefixes reach the same routes', async t => {
  const { origin } = await setup(t);
  const physical = `/app-d${'a'.repeat(32)}/api/rooms`;
  let response = await request(origin, physical, { method: 'POST', json: {} });
  assert.equal(response.status, 200);
  assert.equal(response.body.role, 'host');
  response = await request(origin, '/app/api/rooms', { method: 'POST', json: {} });
  assert.equal(response.status, 200);
  assert.equal(response.body.role, 'host');
});

test('100-message pages and the 200-signal room budget', async t => {
  const { origin } = await setup(t);
  const host = await createRoom(origin);
  const guest = (await joinRoom(origin, host.code)).body;

  for (let id = 1; id <= 200; id += 1) {
    const response = await send(origin, host, 'offer', { sequence: id });
    assert.equal(response.status, 200);
    assert.equal(response.body.id, id);
  }
  let response = await send(origin, host, 'offer', {});
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'signal_limit_reached');
  response = await send(origin, guest, 'answer', {});
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'signal_limit_reached');

  response = await poll(origin, guest, 0);
  assert.equal(response.body.signals.length, 100);
  assert.equal(response.body.signals[0].id, 1);
  assert.equal(response.body.signals.at(-1).id, 100);
  response = await poll(origin, guest, 100);
  assert.equal(response.body.signals.length, 100);
  assert.equal(response.body.signals[0].id, 101);
  assert.equal(response.body.signals.at(-1).id, 200);
  response = await poll(origin, guest, 200);
  assert.deepEqual(response.body.signals, []);
});

test('polling refreshes presence and rooms expire after 60 minutes', async t => {
  let time = Date.parse('2026-01-01T00:00:00.000Z');
  const { origin, store } = await setup(t, { clock: () => time });
  const host = await createRoom(origin);
  const before = (await store.getRoom(host.code)).host_presence;

  time += 5_000;
  const response = await poll(origin, host);
  assert.equal(response.status, 200);
  const after = (await store.getRoom(host.code)).host_presence;
  assert.notEqual(after, before);
  assert.equal(Date.parse(after) - Date.parse(before), 5_000);

  time += 61 * 60 * 1000;
  for (const attempt of [
    () => poll(origin, host),
    () => joinRoom(origin, host.code),
    () => request(origin, `${API}/rooms/${host.code}/close`, {
      method: 'POST', json: { token: host.token },
    }),
  ]) {
    const expired = await attempt();
    assert.equal(expired.status, 410);
    assert.equal(expired.body.error, 'room_expired');
  }
});

test('static files support GET/HEAD, MIME types and traversal rejection', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'signaling-static-'));
  const dist = join(parent, 'dist');
  await mkdir(dist);
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>Game</title>');
  await writeFile(join(dist, 'app.js'), 'console.log("game");\n');
  await writeFile(join(parent, 'secret.txt'), 'must-not-be-served');
  const { origin } = await setup(t, { distRoot: dist });

  let response = await fetch(`${origin}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  assert.match(await response.text(), /<title>Game<\/title>/);

  response = await fetch(`${origin}/app.js`, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/javascript/);
  assert.equal(Number(response.headers.get('content-length')), 21);
  assert.equal(await response.text(), '');

  response = await fetch(`${origin}/missing.png`);
  assert.equal(response.status, 404);
  response = await fetch(`${origin}/`, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
  response = await fetch(`${origin}/..%2fsecret.txt`);
  assert.equal(response.status, 403);
  assert.doesNotMatch(await response.text(), /must-not-be-served/);
});

test('an occupied port reports a clear error without stopping a process', async t => {
  const first = await setup(t);
  const port = Number(new URL(first.origin).port);
  await assert.rejects(
    startDevServer({ port }),
    error => error.code === 'EADDRINUSE' && /No process was stopped/.test(error.message),
  );
});
