import { createSignalingApplication } from './functions/signaling-core.mjs';
import { createDenoKvStore } from './functions/deno-kv-store.mjs';

class DenoBackendError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = 'DenoBackendError';
    this.code = code;
    this.status = status;
  }
}

const MIME_TYPES: Record<string, string> = {
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

const PATH_SEPARATOR = Deno.build.os === 'windows' ? '\\' : '/';
const DIST_ROOT = await Deno.realPath(new URL('./dist/', import.meta.url));
const kv = await Deno.openKv();
const store = createDenoKvStore({ kv, BackendError: DenoBackendError });
const handleSignaling = createSignalingApplication({
  store,
  BackendError: DenoBackendError,
});

function apiPath(pathname: string): boolean {
  return pathname === '/functions'
    || pathname.startsWith('/functions/')
    || /^\/(?:app|app-d[0-9a-f]{32})(?:\/|$)/.test(pathname);
}

function errorJson(error: unknown): Response {
  const known = error instanceof DenoBackendError;
  return Response.json(
    { error: known ? error.code : 'internal_error' },
    {
      status: known ? error.status : 500,
      headers: { 'cache-control': 'no-store' },
    },
  );
}

function staticText(status: number, message: string, method: string, allow = false): Response {
  const body = `${message}\n`;
  const headers = new Headers({
    'content-type': 'text/plain; charset=utf-8',
    'content-length': String(new TextEncoder().encode(body).byteLength),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  if (allow) headers.set('allow', 'GET, HEAD');
  return new Response(method === 'HEAD' ? null : body, { status, headers });
}

function inside(root: string, candidate: string): boolean {
  const base = root.endsWith(PATH_SEPARATOR) ? root.slice(0, -1) : root;
  const left = Deno.build.os === 'windows' ? base.toLowerCase() : base;
  const right = Deno.build.os === 'windows' ? candidate.toLowerCase() : candidate;
  return right === left || right.startsWith(`${left}${PATH_SEPARATOR}`);
}

function mimeType(filename: string): string {
  const slash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
  const dot = filename.lastIndexOf('.');
  const extension = dot > slash ? filename.slice(dot).toLowerCase() : '';
  return MIME_TYPES[extension] ?? 'application/octet-stream';
}

async function serveStatic(request: Request, pathname: string): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return staticText(405, 'Method Not Allowed', request.method, true);
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return staticText(400, 'Bad Request', request.method);
  }
  if (decoded.includes('\0') || decoded.includes('\\')
    || decoded.split('/').includes('..')) {
    return staticText(403, 'Forbidden', request.method);
  }

  try {
    let relative = decoded.replace(/^\/+/, '');
    if (decoded.endsWith('/')) relative += 'index.html';
    let filename = `${DIST_ROOT}${DIST_ROOT.endsWith(PATH_SEPARATOR) ? '' : PATH_SEPARATOR}${relative.split('/').join(PATH_SEPARATOR)}`;
    if (!inside(DIST_ROOT, filename)) {
      return staticText(403, 'Forbidden', request.method);
    }

    // Resolve the final path too, so a symlink inside dist cannot expose a
    // file outside the static root. Query parameters never enter this path.
    filename = await Deno.realPath(filename);
    if (!inside(DIST_ROOT, filename)) {
      return staticText(403, 'Forbidden', request.method);
    }
    const metadata = await Deno.stat(filename);
    if (!metadata.isFile) return staticText(404, 'Not Found', request.method);

    const headers = new Headers({
      'content-type': mimeType(filename),
      'content-length': String(metadata.size),
      // Asset names are not content-hashed, so every response must revalidate.
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }
    const file = await Deno.open(filename, { read: true });
    return new Response(file.readable, { status: 200, headers });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound
      || (error instanceof Error && error.name === 'NotADirectory')) {
      return staticText(404, 'Not Found', request.method);
    }
    return staticText(500, 'Internal Server Error', request.method);
  }
}

Deno.serve(async request => {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return staticText(400, 'Bad Request', request.method);
  }

  if (apiPath(pathname)) {
    try {
      return await handleSignaling({ request });
    } catch (error) {
      // Never log request URLs: signal polling URLs contain capability tokens.
      return errorJson(error);
    }
  }
  return serveStatic(request, pathname);
});
