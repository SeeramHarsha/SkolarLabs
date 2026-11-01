'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const cleanEmail = (e) => String(e || '').trim().toLowerCase();
const strongEnough = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 200;

// a real hash to compare against when the email is unknown, so a wrong email takes as long as a wrong password
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

async function createUser(email, password, role = 'viewer', schools = []) {
  email = cleanEmail(email);
  if (!EMAIL_RE.test(email)) throw new Error('That email address is not valid.');
  if (!strongEnough(password)) throw new Error('The password must be at least 10 characters.');
  if (!['admin', 'viewer'].includes(role)) throw new Error('Role must be admin or viewer.');
  const doc = { _id: email, passwordHash: await bcrypt.hash(password, 12), role, schools: [...new Set(schools.map(String))].filter(Boolean), createdAt: new Date() };
  await db.get().collection('users').insertOne(doc);
  return publicUser(doc);
}

const publicUser = (u) => ({ email: u._id, role: u.role, schools: u.schools || [], createdAt: u.createdAt });

/** First start: create the admin from ADMIN_EMAIL / ADMIN_PASSWORD when there are no users at all. */
async function bootstrapAdmin() {
  const users = db.get().collection('users');
  if (await users.estimatedDocumentCount() > 0) return false;
  if (!config.adminEmail || !config.adminPassword) { console.warn('No users yet. Set ADMIN_EMAIL and ADMIN_PASSWORD (or run: npm run make-user) to create the first admin.'); return false; }
  await createUser(config.adminEmail, config.adminPassword, 'admin');
  console.log('First admin created: ' + config.adminEmail);
  return true;
}

async function login(email, password) {
  const u = await db.get().collection('users').findOne({ _id: cleanEmail(email) });
  const ok = await bcrypt.compare(String(password || '').slice(0, 200), u ? u.passwordHash : DUMMY_HASH);
  return u && ok ? u : null;
}

const sign = (u) => jwt.sign({ sub: u._id, role: u.role }, config.jwtSecret, { expiresIn: config.jwtHours + 'h', algorithm: 'HS256' });

/** The dashboard sends the sign-in token in the Authorization header (it lives on a different web address than this API). */
function readToken(req) {
  const m = /^Bearer ([A-Za-z0-9._-]{20,2000})$/.exec(req.headers.authorization || "");
  return m ? m[1] : null;
}

/** Express middleware: needs a valid session; puts req.user = { email, role, schools }. */
async function requireUser(req, res, next) {
  try {
    const token = readToken(req); if (!token) return res.status(401).json({ error: 'Please sign in.' });
    const p = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const u = await db.get().collection('users').findOne({ _id: p.sub });
    if (!u) return res.status(401).json({ error: 'Please sign in.' });
    req.user = { email: u._id, role: u.role, schools: u.schools || [] };
    next();
  } catch (e) { res.status(401).json({ error: 'Please sign in.' }); }
}
const requireAdmin = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Only an admin can do this.' }));

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const safeEqual = (a, b) => { const x = Buffer.from(sha256(String(a))), y = Buffer.from(sha256(String(b))); return crypto.timingSafeEqual(x, y); };

module.exports = { createUser, bootstrapAdmin, login, sign, requireUser, requireAdmin, publicUser, sha256, safeEqual, EMAIL_RE, cleanEmail };
