'use strict';
const crypto = require('crypto');

const env = process.env;
const production = env.NODE_ENV === 'production';

function need(name) {
  if (env[name]) return env[name];
  if (production) { console.error(`Missing required setting ${name}.`); process.exit(1); }
  return null;
}

const list = (v) => String(v || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);

const config = {
  production,
  port: env.PORT !== undefined && env.PORT !== '' ? Number(env.PORT) : 8080,        // Cloud Run sets PORT
  mongoUri: need('MONGODB_URI') || 'mongodb://127.0.0.1:27017',
  dbName: env.MONGODB_DB || 'skolar',
  // signs the dashboard sign-in token; in production it must come from Secret Manager
  jwtSecret: need('JWT_SECRET') || crypto.randomBytes(32).toString('hex'),
  jwtHours: Number(env.JWT_HOURS) || 8,
  // web addresses allowed to call the dashboard API from a browser, e.g. https://skolar-frontend-xxxx.run.app (comma separated)
  frontendOrigins: list(env.FRONTEND_ORIGINS),
  // apps use this once to register a device; without it device registration is switched off
  enrollKey: env.ENROLL_KEY || null,
  // the first admin login, created only when there are no users yet
  adminEmail: (env.ADMIN_EMAIL || '').trim().toLowerCase() || null,
  adminPassword: env.ADMIN_PASSWORD || null,
  // 'online now' = synced within this many minutes
  onlineMinutes: Number(env.ONLINE_MINUTES) || 15,
};

module.exports = config;
