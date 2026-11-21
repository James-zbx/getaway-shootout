export const BODY_LIMIT = 32 * 1024;
export const SIGNAL_LIMIT = 200;
export const SIGNAL_PAGE_LIMIT = 100;
export const ROOM_TTL_MS = 60 * 60 * 1000;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SIGNAL_KINDS = new Set(['offer', 'answer', 'ice', 'bye']);
const ROLE_KINDS = {
  host: new Set(['offer', 'ice', 'bye']),
  guest: new Set(['answer', 'ice', 'bye']),
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, keys, required = keys) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value);
  return actual.every(key => keys.includes(key))
    && required.every(key => Object.hasOwn(value, key));
}

function roomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  // The alphabet has 32 entries, so the low five bits are unbiased.
  return Array.from(bytes, byte => CODE_ALPHABET[byte & 31]).join('');
}

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

// Strip only the documented logical name or platform-generated physical name.
// The Provider may already have removed /functions/v1 before invocation.
function businessPath(pathname) {
  const match = pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/);
  return match ? (match[1] || '/') : null;
}

export function createSignalingApplication({
  store,
  BackendError,
  clock = Date.now,
  makeToken = () => crypto.randomUUID(),
}) {
  if (!store || !BackendError) throw new Error('Signaling dependencies are required.');

  const fail = (code, status) => {
    throw new BackendError(code, status);
  };
  const nowIso = () => new Date(clock()).toISOString();

  function validateCode(code) {
    if (!CODE_PATTERN.test(code)) fail('invalid_code', 400);
    return code;
  }

  function validateTokenShape(token) {
    if (typeof token !== 'string' || !UUID_PATTERN.test(token)) {
      fail('invalid_token', 400);
    }
    return token;
  }

  function assertNotExpired(room) {
    const expires = Date.parse(room.expires_at);
    if (!Number.isFinite(expires) || expires <= clock()) fail('room_expired', 410);
  }

  async function getRoom(code) {
    const room = await store.getRoom(code);
    if (!room) fail('room_not_found', 404);
    assertNotExpired(room);
    return room;
  }

  function roleFor(room, token) {
    if (room.host_token === token) return 'host';
    if (room.guest_token === token) return 'guest';
    fail('invalid_token', 403);
  }

  async function authorizedRoom(code, token) {
    validateTokenShape(token);
    const room = await getRoom(code);
    return { room, role: roleFor(room, token) };
  }

  async function readJson(request) {
    const contentType = request.headers.get('content-type')
      ?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') fail('unsupported_media_type', 415);

    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > BODY_LIMIT) {
      await request.body?.cancel().catch(() => {});
      fail('payload_too_large', 413);
    }
    if (!request.body) fail('invalid_json', 400);

    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > BODY_LIMIT) {
          await reader.cancel().catch(() => {});
          fail('payload_too_large', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    let body;
    try {
      body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      fail('invalid_json', 400);
    }
    if (!isObject(body)) fail('invalid_input', 400);
    return body;
  }

  function assertEmptyCommand(body) {
    if (!hasOnlyKeys(body, [], [])) fail('invalid_input', 400);
  }

  function assertJoinable(room) {
    if (room.status === 'closed') fail('room_closed', 409);
    if (room.status !== 'waiting' || room.guest_token) fail('room_full', 409);
  }

  async function closeAuthorized(room, role, token, closedAt) {
    if (room.status === 'closed') return;
    const closed = await store.closeRoom({
      code: room.code,
      role,
      token,
      closedAt,
    });
    if (!closed) fail('write_conflict', 409);
  }

  async function appendSignal(room, role, kind, payload) {
    if (room.signal_count >= SIGNAL_LIMIT) fail('signal_limit_reached', 409);
    const id = await store.allocateSignal({
      code: room.code,
      expectedNextSignalId: room.next_signal_id,
      expectedSignalCount: room.signal_count,
      expectedStatus: room.status,
    });
    if (id === null) fail('signal_conflict', 409);

    await store.insertSignal({
      code: room.code,
      id,
      sender: role,
      kind,
      payload,
      createdAt: nowIso(),
    });
    return id;
  }

  async function createRoom() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = roomCode();
      const token = makeToken();
      const createdAt = nowIso();
      const created = await store.createRoom({
        code,
        host_token: token,
        guest_token: null,
        status: 'waiting',
        created_at: createdAt,
        expires_at: new Date(clock() + ROOM_TTL_MS).toISOString(),
        closed_at: null,
        host_presence: createdAt,
        guest_presence: null,
        next_signal_id: 1,
        signal_count: 0,
      });
      if (created) return json({ ok: true, code, token, role: 'host' });
    }
    fail('room_code_unavailable', 503);
  }

  async function joinRoom(code) {
    let room = await getRoom(code);
    assertJoinable(room);
    const token = makeToken();
    const joined = await store.joinRoom({
      code,
      token,
      joinedAt: nowIso(),
    });
    if (!joined) {
      room = await getRoom(code);
      assertJoinable(room);
      fail('join_conflict', 409);
    }
    return json({ ok: true, code, token, role: 'guest' });
  }

  async function pollSignals(request, code) {
    const url = new URL(request.url);
    const token = validateTokenShape(url.searchParams.get('token'));
    const rawAfter = url.searchParams.get('after') ?? '0';
    if (!/^(0|[1-9][0-9]*)$/.test(rawAfter)) fail('invalid_after', 400);
    const after = Number(rawAfter);
    if (!Number.isSafeInteger(after)) fail('invalid_after', 400);

    const { room, role } = await authorizedRoom(code, token);
    const touched = await store.touchPresence({
      code,
      role,
      token,
      at: nowIso(),
    });
    if (!touched) fail('write_conflict', 409);

    const signals = await store.listSignals({
      code,
      recipient: role,
      after,
      limit: SIGNAL_PAGE_LIMIT,
    });
    return json({
      ok: true,
      role,
      status: room.status,
      guestJoined: Boolean(room.guest_token),
      signals,
    });
  }

  async function sendSignal(request, code) {
    const body = await readJson(request);
    if (!hasOnlyKeys(body, ['token', 'kind', 'payload'])) fail('invalid_input', 400);
    const token = validateTokenShape(body.token);
    if (typeof body.kind !== 'string' || !SIGNAL_KINDS.has(body.kind)) {
      fail('invalid_kind', 400);
    }
    const { room, role } = await authorizedRoom(code, token);
    if (room.status === 'closed') fail('room_closed', 409);
    if (!ROLE_KINDS[role].has(body.kind)) fail('kind_not_allowed', 403);

    const id = await appendSignal(room, role, body.kind, body.payload);
    if (body.kind === 'bye') {
      await closeAuthorized(room, role, token, nowIso());
    }
    return json({ ok: true, id });
  }

  async function closeRoom(request, code) {
    const body = await readJson(request);
    if (!hasOnlyKeys(body, ['token'])) fail('invalid_input', 400);
    const token = validateTokenShape(body.token);
    const { room, role } = await authorizedRoom(code, token);
    await closeAuthorized(room, role, token, nowIso());
    return json({ ok: true });
  }

  return async context => {
    const request = context.request ?? context;
    const path = businessPath(new URL(request.url).pathname);
    if (path === null) fail('not_found', 404);

    let match;
    if (path === '/api/health') {
      if (request.method !== 'GET') fail('method_not_allowed', 405);
      return json({ ok: true });
    }

    if (path === '/api/rooms') {
      if (request.method !== 'POST') fail('method_not_allowed', 405);
      assertEmptyCommand(await readJson(request));
      return createRoom();
    }

    match = path.match(/^\/api\/rooms\/([^/]+)\/join$/);
    if (match) {
      if (request.method !== 'POST') fail('method_not_allowed', 405);
      const code = validateCode(match[1]);
      assertEmptyCommand(await readJson(request));
      return joinRoom(code);
    }

    match = path.match(/^\/api\/rooms\/([^/]+)\/signals$/);
    if (match) {
      const code = validateCode(match[1]);
      if (request.method === 'GET') return pollSignals(request, code);
      if (request.method === 'POST') return sendSignal(request, code);
      fail('method_not_allowed', 405);
    }

    match = path.match(/^\/api\/rooms\/([^/]+)\/close$/);
    if (match) {
      if (request.method !== 'POST') fail('method_not_allowed', 405);
      const code = validateCode(match[1]);
      return closeRoom(request, code);
    }

    fail('not_found', 404);
  };
}
