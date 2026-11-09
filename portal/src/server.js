'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const db = require('./db');
const auth = require('./auth');
const plans = require('./plans');

const state = { ready: false, dbError: null, attempts: 0 };
const problemText = () => (config.problems.length ? 'Not configured: ' + config.problems.join(', ') + '.' : state.dbError ? 'Cannot reach the database: ' + state.dbError : 'Starting up.');

/** Holds the request open until the database is connected (Cloud Run throttles CPU between requests, so a connection started in the background can stall). */
async function waitReady(ms) {
  if (config.problems.length) return false;
  const end = Date.now() + ms;
  while (!state.ready && Date.now() < end) await new Promise((r) => setTimeout(r, 100));
  return state.ready;
}

function createApp() {
  const app = express();
  app.set('trust proxy', 1);                          // Cloud Run puts one proxy in front: real client IP for rate limits
  app.disable('x-powered-by');

  const razor = config.paymentMode === 'razorpay';
  const siteHelmet = helmet({
    hsts: config.production ? undefined : false,
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'", ...(razor ? ['https://checkout.razorpay.com'] : [])], styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'], fontSrc: ["'self'"], connectSrc: ["'self'", ...(razor ? ['https://api.razorpay.com', 'https://lumberjack.razorpay.com'] : [])],
      frameSrc: razor ? ['https://api.razorpay.com', 'https://checkout.razorpay.com'] : ["'none'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"] } },
  });
  // the lessons are single-file simulations with inline scripts and styles, so they need a looser (but still same-origin only) policy
  const lessonHelmet = helmet({
    hsts: config.production ? undefined : false,
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'blob:'], fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"], mediaSrc: ["'self'", 'data:', 'blob:'], objectSrc: ["'none'"], frameAncestors: ["'self'"], baseUri: ["'self'"], formAction: ["'none'"] } },
  });
  app.use((req, res, next) => (req.path.startsWith('/learn') ? lessonHelmet : siteHelmet)(req, res, next));

  app.get('/status', async (req, res) => {
    if (!(await waitReady(Math.min(8000, config.readyWaitMs)))) return res.status(503).json({ ok: false, problem: problemText() });
    try { await db.ping(); res.json({ ok: true, payments: config.paymentMode }); } catch (e) { res.status(503).json({ ok: false, problem: 'Cannot reach the database.' }); }
  });
  app.get('/healthz', (req, res) => res.redirect('/status'));

  const needDb = async (req, res, next) => ((await waitReady(config.readyWaitMs)) ? next() : res.set('Retry-After', '5').status(503).json({ error: 'The site is starting up. ' + problemText() }));

  // payments webhook first: it needs the raw body for its signature
  app.use('/api', needDb, require('./routes/billing').webhook);
  app.use('/api', express.json({ limit: '100kb' }), (err, req, res, next) => {
    if (err) return res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'That request is too large.' : 'The request is not valid.' });
    next();
  });
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, auth.sameOriginPost);
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/billing', require('./routes/billing').router);
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api', require('./routes/public'));
  app.use('/api', require('./routes/me'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  app.use('/learn', needDb, require('./routes/learn'));

  const pub = path.join(__dirname, '..', 'public');
  app.get('/app', (req, res) => res.sendFile(path.join(pub, 'app.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(pub, 'admin.html')));
  app.use(express.static(pub, { maxAge: config.production ? '10m' : 0, index: 'index.html', extensions: ['html'] }));
  app.use((req, res) => res.status(404).sendFile(path.join(pub, '404.html')));
  return app;
}

async function connectLoop() {
  if (config.problems.length) { console.error('NOT CONNECTING TO THE DATABASE. ' + problemText()); return; }
  for (;;) {
    state.attempts++;
    try {
      await db.connect(config.mongoUri, config.dbName);
      await plans.seed();
      await auth.bootstrapAdmin();
      state.ready = true; state.dbError = null;
      console.log(`Database connected. Payments: ${config.paymentMode}.`);
      if (config.paymentMode === 'demo') console.warn('PAYMENT_MODE=demo: purchases are FAKE. Never use this for real students.');
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
  const server = await new Promise((resolve) => { const s = app.listen(config.port, () => { console.log(`Botclub Labs portal listening on :${config.port}`); resolve(s); }); });
  server.ready = new Promise((resolve) => { const t = setInterval(() => { if (state.ready) { clearInterval(t); resolve(); } }, 50); });
  connectLoop();
  const stop = async () => { server.close(); await db.close(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  return server;
}

if (require.main === module) start().catch((e) => { console.error('Could not start:', e.message); process.exit(1); });
module.exports = { createApp, start, state };
