'use strict';
/**
 * SkolAR Labs Analytics - web dashboard (frontend).
 * A tiny static file server with no dependencies. It serves public/ and one generated file, /config.js, which tells the page
 * where the backend API lives (set with the API_URL environment variable when you deploy, so one image works everywhere).
 *
 *   API_URL=https://skolar-backend-xxxx-el.a.run.app  PORT=8080  node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC = path.join(__dirname, 'public');
const production = process.env.NODE_ENV === 'production';

let API_URL = String(process.env.API_URL || '').trim().replace(/\/+$/, '');
if (!API_URL) {
  if (production) { console.error('Missing required setting API_URL (the address of the backend).'); process.exit(1); }
  API_URL = 'http://localhost:8081';
}
let apiOrigin;
try { const u = new URL(API_URL); if (!/^https?:$/.test(u.protocol)) throw new Error('bad protocol'); apiOrigin = u.origin; }
catch (e) { console.error('API_URL is not a valid web address: ' + API_URL); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const COMPRESS = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);

const CONFIG_JS = `window.SKOLAR_CONFIG = ${JSON.stringify({ apiBase: API_URL })};\n`;

function securityHeaders(req) {
  const h = {
    // the page may only talk to itself and to the backend
    'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${apiOrigin}; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (req.headers['x-forwarded-proto'] === 'https') h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return h;
}

const gzCache = new Map();
function send(req, res, status, body, type, cache, ext) {
  const headers = { ...securityHeaders(req), 'Content-Type': type, 'Cache-Control': cache, Vary: 'Accept-Encoding' };
  if (req.method === 'HEAD') { res.writeHead(status, headers); return res.end(); }
  if (COMPRESS.has(ext) && body.length > 800 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(status, headers);
    return res.end(zlib.gzipSync(body));
  }
  res.writeHead(status, headers); res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { return send(req, res, 400, Buffer.from('Bad request'), MIME['.txt'], 'no-store', '.txt'); }

  if (pathname === '/healthz') return send(req, res, 200, Buffer.from('ok'), MIME['.txt'], 'no-store', '.txt');
  if (pathname === '/config.js') return send(req, res, 200, Buffer.from(CONFIG_JS), MIME['.js'], 'no-store', '.js');
  if (pathname === '/') pathname = '/index.html';

  const file = path.normalize(path.join(PUBLIC, pathname));
  if (!file.startsWith(PUBLIC + path.sep)) return send(req, res, 403, Buffer.from('Forbidden'), MIME['.txt'], 'no-store', '.txt');
  fs.readFile(file, (err, data) => {
    if (err) return send(req, res, 404, Buffer.from('Not found'), MIME['.txt'], 'no-store', '.txt');
    const ext = path.extname(file).toLowerCase();
    const cache = ext === '.woff2' || ext === '.png' ? 'public, max-age=86400' : 'no-cache';      // pages and scripts are re-checked on every visit
    send(req, res, 200, data, MIME[ext] || 'application/octet-stream', cache, ext);
  });
});

server.listen(PORT, () => console.log(`SkolAR Analytics dashboard on :${PORT}  (backend: ${API_URL})`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
