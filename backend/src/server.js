'use strict';
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const db = require('./db');
const auth = require('./auth');

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

  app.get('/', (req, res) => res.json({ service: 'skolar-analytics-backend', ok: true }));
  app.get('/healthz', async (req, res) => { try { await db.ping(); res.json({ ok: true }); } catch (e) { res.status(503).json({ ok: false }); } });

  app.use('/api', cors, express.json({ limit: '1mb' }), (err, req, res, next) => {
    if (err) return res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'That request is too large.' : 'The request is not valid JSON.' });
    next();
  });

  app.use('/api/v1', require('./routes/devices'));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, require('./routes/admin'));
  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  return app;
}

async function start() {
  await db.connect(config.mongoUri, config.dbName);
  await auth.bootstrapAdmin();
  if (config.production && !config.frontendOrigins.length) console.warn('FRONTEND_ORIGINS is not set: browsers will not be able to use the dashboard API.');
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`SkolAR Analytics API listening on :${config.port}`));
  const stop = async () => { server.close(); await db.close(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  return server;
}

if (require.main === module) start().catch((e) => { console.error('Could not start:', e.message); process.exit(1); });
module.exports = { createApp, start };
