// Production server for the web service. `react-router-serve` only serves
// build output, but the browser client (app/lib/browser-api.ts) calls /api
// same-origin so the Better Auth session cookie rides along — in dev the
// Vite dev proxy does that, in production this server does (the spec's
// "Caddy in production" layer, folded in here so Render needs one service).

import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createRequestListener } from '@react-router/node';

const PORT = Number(process.env.PORT ?? 3000);
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(HERE, 'build', 'client');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const router = createRequestListener({
  build: await import('./build/server/index.js'),
});

createServer((req, res) => {
  const url = new URL(
    req.url ?? '/',
    `http://${req.headers.host ?? 'localhost'}`,
  );
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    proxyApi(req, res, url).catch((error) => {
      console.error('api proxy request failed', String(error));
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
      }
      res.end('{"error":"api proxy request failed"}');
    });
    return;
  }
  if (serveStatic(req, res, url.pathname)) {
    return;
  }
  router(req, res);
}).listen(PORT, () => {
  console.info('web server listening', { port: PORT, apiUrl: API_URL });
});

// Forwards one browser request to the Hono API verbatim (method, headers,
// body) so Set-Cookie from /api/auth/* lands on the web origin untouched.
async function proxyApi(req, res, url) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];

  const init = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await readBody(req);
  }

  const response = await fetch(`${API_URL}${url.pathname}${url.search}`, init);
  const outHeaders = {};
  response.headers.forEach((value, key) => {
    if (key !== 'content-encoding' && key !== 'transfer-encoding') {
      outHeaders[key] = value;
    }
  });
  res.writeHead(response.status, outHeaders);
  if (response.body === null) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body).pipe(res);
}

function readBody(req) {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  return new Promise((resolve, reject) => {
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Serves exact matches from build/client, returning true when it answered.
// Everything else falls through to the router. Hashed /assets/* files are
// immutable, the rest revalidates. Sync on purpose: the caller must know
// synchronously whether it may hand the request to the router.
function serveStatic(req, res, pathname) {
  const relative = path.normalize(pathname).replace(/^([/\\])+/, '');
  const filePath = path.join(CLIENT_DIR, relative);
  if (!filePath.startsWith(CLIENT_DIR)) {
    return false; // path traversal attempt — let the router answer it
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  const type = MIME_TYPES[path.extname(filePath).toLowerCase()];
  if (type === undefined) {
    return false; // unknown extension — never guess a content type
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': relative.startsWith('assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  fs.createReadStream(filePath).pipe(res);
  return true;
}
