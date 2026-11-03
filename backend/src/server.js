'use strict';
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const db = require('./db');
const auth = require('./auth');

/** What the server can say about itself without a password: used by /healthz and by the 503 answers. */
const state = { ready: false, dbError: null, attempts: 0 };

/**
 * Waits (holding the request open) until the database is connected, up to `ms`. On Cloud Run the CPU is throttled between requests,
 * so a connection started in the background can stall; keeping the first request open after a cold start gives it the CPU it needs.
 * With a setting missing there is nothing to wait for.
 */
async function waitReady(ms) {
  if (config.problems.length) return false;
  const end = Date.now() + ms;
  while (!state.ready && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
  return state.ready;
}

const problemText = () => (config.problems.length ? 'Not configured: ' + config.problems.join(', ') + '.' : state.dbError ? 'Cannot reach the database: ' + state.dbError : 'Starting up.');

/**
 * CORS.
 *  - /api/v1  (the apps: Windows, Linux, Android): any origin may call it. It never uses cookies, only the device's own token,
 *    and an Android WebView calls it from https://localhost, so it has to be open.
 *  - the rest of /api (the dashboard): only the web addresses listed in FRONTEND_ORIGINS.
 */
function cors(req, res, next) {
  const origin = req.headers.origin;
  const isDevice = req.path.startsWith('/v1/');
  if (isDevice) {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-enroll-key', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400' });
  } else if (origin && config.frontendOrigins.includes(origin)) {
    res.set({ 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Max-Age': '600' });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

function createApp() {
  const app = express();
  app.set('trust proxy', 1);                     // Cloud Run puts one proxy in front: real client IP for rate limits
  app.disable('x-powered-by');
  app.use(helmet({ hsts: config.production ? undefined : false }));

  app.get('/', (req, res) => res.json({ service: 'skolar-analytics-backend', ready: state.ready }));
  app.get(['/status', '/healthz'], async (req, res) => {
    if (!(await waitReady(Math.min(8000, config.readyWaitMs)))) return res.status(503).json({ ok: false, problem: problemText() });
    try { await db.ping(); res.json({ ok: true }); } catch (e) { res.status(503).json({ ok: false, problem: 'Cannot reach the database.' }); }
  });

  app.use('/api', cors, async (req, res, next) => ((await waitReady(config.readyWaitMs)) ? next() : res.set('Retry-After', '5').status(503).json({ error: 'The server is not ready. ' + problemText() })),
    express.json({ limit: '1mb' }), (err, req, res, next) => {
      if (err) return res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'That request is too large.' : 'The request is not valid JSON.' });
      next();
    });

  app.use('/api/v1', require('./routes/devices'));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, require('./routes/admin'));
  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  return app;
}

/** Connects to MongoDB in the background, retrying, so the web server is already listening (Cloud Run needs that). */
async function connectLoop() {
  if (config.problems.length) { console.error('NOT CONNECTING TO THE DATABASE. ' + problemText()); return; }
  for (;;) {
    state.attempts++;
    try {
      await db.connect(config.mongoUri, config.dbName);
      await auth.bootstrapAdmin();
      state.ready = true; state.dbError = null;
      console.log('Database connected.');
      if (config.production && !config.frontendOrigins.length) console.warn('FRONTEND_ORIGINS is not set: browsers will not be able to use the dashboard API.');
      return;
    } catch (e) {
      state.dbError = String(e.message || e).replace(/mongodb(\+srv)?:\/\/\S+/gi, '<link hidden>').slice(0, 200);
      console.error(`Database connection failed (try ${state.attempts}): ${state.dbError}`);
      try { await db.close(); } catch (x) { /* nothing to close */ }
      await new Promise((r) => setTimeout(r, Math.min(30000, 2000 * state.attempts)));
    }
  }
}

async function start() {
  const app = createApp();
  const server = await new Promise((resolve) => { const s = app.listen(config.port, () => { console.log(`Botclub Labs Analytics API listening on :${config.port}`); resolve(s); }); });
  server.ready = new Promise((resolve) => { const t = setInterval(() => { if (state.ready) { clearInterval(t); resolve(); } }, 50); });
  connectLoop();
  const stop = async () => { server.close(); await db.close(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  return server;
}

if (require.main === module) start().catch((e) => { console.error('Could not start:', e.message); process.exit(1); });
module.exports = { createApp, start, state };
