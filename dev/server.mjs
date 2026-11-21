import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BODY_LIMIT, createSignalingApplication } from '../functions/signaling-core.mjs';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_DIST = resolve(PROJECT_ROOT, 'docs');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

export class LocalBackendError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function copyRoom(room) {
  return room ? { ...room } : null;
}

// Credential-free local adapter. Each method is synchronous before its promise
// resolves, giving the same single-row compare-and-set behavior as the DB store.
export function createMemoryStore() {
  const rooms = new Map();
  const signals = new Map();

  return {
    async createRoom(room) {
      if (rooms.has(room.code)) return false;
      rooms.set(room.code, { ...room });
      signals.set(room.code, []);
      return true;
    },

    async getRoom(code) {
      return copyRoom(rooms.get(code));
    },

    async joinRoom({ code, token, joinedAt }) {
      const room = rooms.get(code);
      if (!room || room.status !== 'waiting') return false;
      Object.assign(room, {
        guest_token: token,
        guest_presence: joinedAt,
        guest_joined_at: joinedAt,
        status: 'joined',
      });
      return true;
    },

    async touchPresence({ code, role, token, at }) {
      const room = rooms.get(code);
      if (!room || room[`${role}_token`] !== token) return false;
      room[`${role}_presence`] = at;
      return true;
    },

    async listSignals({ code, recipient, after, limit }) {
      return (signals.get(code) ?? [])
        .filter(signal => signal.sender !== recipient && signal.id > after)
        .sort((a, b) => a.id - b.id)
        .slice(0, limit)
        .map(({ id, kind, payload }) => ({ id, kind, payload }));
    },

    async allocateSignal({ code, expectedNextSignalId, expectedSignalCount, expectedStatus }) {
      const room = rooms.get(code);
      if (!room
        || room.next_signal_id !== expectedNextSignalId
        || room.signal_count !== expectedSignalCount
        || room.status !== expectedStatus) return null;
      const id = room.next_signal_id;
      room.next_signal_id += 1;
      room.signal_count += 1;
      return id;
    },

    async insertSignal({ code, id, sender, kind, payload, createdAt }) {
      const list = signals.get(code);
      if (!list || list.some(signal => signal.id === id)) {
        throw new LocalBackendError('database_unavailable', 503);
      }
      list.push({ id, sender, kind, payload, created_at: createdAt });
    },

    async closeRoom({ code, role, token, closedAt }) {
      const room = rooms.get(code);
      if (!room || room[`${role}_token`] !== token) return false;
      room.status = 'closed';
      room.closed_at = closedAt;
      return true;
    },
  };
}

function errorJson(error) {
  const known = error instanceof LocalBackendError;
  return Response.json(
    { error: known ? error.code : 'internal_error' },
    {
      status: known ? error.status : 500,
      headers: { 'cache-control': 'no-store' },
    },
  );
}

async function apiRequest(incoming, url) {
  const chunks = [];
  let size = 0;
  // Bound memory even for a missing or dishonest Content-Length. If the input
  // exceeds the limit, retain exactly limit + 1 bytes so the shared parser
  // returns the same payload_too_large response as production.
  for await (const chunk of incoming) {
    if (size <= BODY_LIMIT) {
      const remaining = BODY_LIMIT + 1 - size;
      chunks.push(chunk.subarray(0, remaining));
    }
    size += chunk.byteLength;
  }
  const init = {
    method: incoming.method,
    headers: incoming.headers,
  };
  if (!['GET', 'HEAD'].includes(incoming.method)) {
    init.body = Buffer.concat(chunks);
  }
  return new Request(url, init);
}

async function sendFetchResponse(outgoing, response) {
  const headers = Object.fromEntries(response.headers);
  if (!headers['cache-control']) headers['cache-control'] = 'no-store';
  outgoing.writeHead(response.status, headers);
  if (response.body) outgoing.end(Buffer.from(await response.arrayBuffer()));
  else outgoing.end();
}

function inside(root, candidate) {
  const path = relative(root, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function staticError(outgoing, status, message, method = 'GET') {
  const body = Buffer.from(`${message}\n`);
  outgoing.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': body.byteLength,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  outgoing.end(method === 'HEAD' ? undefined : body);
}

async function serveStatic(incoming, outgoing, url, distRoot) {
  if (!['GET', 'HEAD'].includes(incoming.method)) {
    outgoing.setHeader('allow', 'GET, HEAD');
    staticError(outgoing, 405, 'Method Not Allowed', incoming.method);
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    staticError(outgoing, 400, 'Bad Request', incoming.method);
    return;
  }
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').includes('..')) {
    staticError(outgoing, 403, 'Forbidden', incoming.method);
    return;
  }

  let root;
  let filename;
  try {
    root = await realpath(distRoot);
    if (pathname.endsWith('/')) pathname += 'index.html';
    filename = resolve(root, `.${pathname}`);
    if (!inside(root, filename)) {
      staticError(outgoing, 403, 'Forbidden', incoming.method);
      return;
    }
    // Resolve symlinks as well as lexical .. segments before serving a file.
    filename = await realpath(filename);
    if (!inside(root, filename)) {
      staticError(outgoing, 403, 'Forbidden', incoming.method);
      return;
    }
    const metadata = await stat(filename);
    if (!metadata.isFile()) {
      staticError(outgoing, 404, 'Not Found', incoming.method);
      return;
    }

    outgoing.writeHead(200, {
      'content-type': MIME_TYPES[extname(filename).toLowerCase()] ?? 'application/octet-stream',
      'content-length': metadata.size,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    if (incoming.method === 'HEAD') {
      outgoing.end();
      return;
    }
    const stream = createReadStream(filename);
    stream.on('error', () => outgoing.destroy());
    stream.pipe(outgoing);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      staticError(outgoing, 404, 'Not Found', incoming.method);
    } else {
      staticError(outgoing, 500, 'Internal Server Error', incoming.method);
    }
  }
}

export async function startDevServer({
  port = 4173,
  hostname = '127.0.0.1',
  distRoot = DEFAULT_DIST,
  clock = Date.now,
} = {}) {
  const store = createMemoryStore();
  const handle = createSignalingApplication({
    store,
    BackendError: LocalBackendError,
    clock,
  });

  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, 'http://127.0.0.1');
      const isFunctionPath = url.pathname === '/functions'
        || url.pathname.startsWith('/functions/')
        || /^\/(?:app|app-d[0-9a-f]{32})(?:\/|$)/.test(url.pathname);
      if (isFunctionPath) {
        const request = await apiRequest(incoming, url);
        const response = await handle({ request });
        await sendFetchResponse(outgoing, response);
      } else {
        await serveStatic(incoming, outgoing, url, distRoot);
      }
    } catch (error) {
      if (outgoing.headersSent) {
        outgoing.destroy();
        return;
      }
      await sendFetchResponse(outgoing, errorJson(error));
    }
  });

  server.on('clientError', (_error, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });

  try {
    await new Promise((resolveListen, rejectListen) => {
      const onError = error => rejectListen(error);
      server.once('error', onError);
      server.listen(port, hostname, () => {
        server.off('error', onError);
        resolveListen();
      });
    });
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      const wrapped = new Error(`Port ${port} is already in use on ${hostname}. No process was stopped; choose a free port or close the process that owns it.`);
      wrapped.code = 'EADDRINUSE';
      throw wrapped;
    }
    throw error;
  }

  const address = server.address();
  const origin = `http://${hostname === '0.0.0.0' ? '127.0.0.1' : hostname}:${address.port}`;
  return {
    server,
    store,
    origin,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close(error => error ? rejectClose(error) : resolveClose());
    }),
  };
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const running = await startDevServer();
    console.log(`WebRTC signaling dev server: ${running.origin}`);
    console.log(`Static directory: ${dirname(fileURLToPath(import.meta.url))}/../docs`);
    const stop = async () => {
      await running.close();
      process.exitCode = 0;
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
