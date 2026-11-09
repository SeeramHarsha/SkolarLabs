'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const config = require('./config');
const db = require('./db');
const { cleanEmail, isEmail, sha256 } = require('./lib');

const COOKIE = 'bl_session';
const users = () => db.get().collection('users');
const DUMMY = bcrypt.hashSync('not-a-real-password', 12);          // a wrong e-mail takes as long as a wrong password
const MAX_FAILS = 6, LOCK_MIN = 15;

const strongEnough = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 100;
const hash = (p) => bcrypt.hash(p, 12);

const publicUser = (u) => ({ id: String(u._id), email: u.email, name: u.name, role: u.role, cls: u.cls || null, school: u.school || '', phone: u.phone || '', createdAt: u.createdAt });

function setSession(res, user) {
  // the token carries a fingerprint of the password hash: changing the password signs every other device out
  const token = jwt.sign({ sub: String(user._id), v: sha256(user.passwordHash).slice(0, 12) }, config.jwtSecret, { expiresIn: config.sessionDays + 'd', algorithm: 'HS256' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.production, maxAge: config.sessionDays * 864e5, path: '/' });
}
const clearSession = (res) => res.clearCookie(COOKIE, { path: '/', sameSite: 'lax', secure: config.production });

function readCookie(req) {
  const h = req.headers.cookie; if (!h) return null;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { return null; } }
  }
  return null;
}

/** loads req.user when there is a valid session (never rejects) */
async function loadUser(req, res, next) {
  try {
    const t = readCookie(req);
    if (t) {
      const p = jwt.verify(t, config.jwtSecret, { algorithms: ['HS256'] });
      const u = await users().findOne({ _id: new ObjectId(p.sub) });
      if (u && !u.disabled && p.v === sha256(u.passwordHash).slice(0, 12)) req.user = u;
    }
  } catch (e) { /* not signed in */ }
  next();
}
const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Please sign in.' }));
const requireAdmin = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only.' }));

/** state-changing requests must come from our own pages (a custom header: another website cannot add it without our permission) */
function sameOriginPost(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path === '/billing/webhook') return next();                  // called by Razorpay, protected by its signature
  if (req.get('x-requested-with') !== 'botclub') return res.status(403).json({ error: 'Request not allowed.' });
  const o = req.get('origin');
  if (o) { try { if (new URL(o).host !== req.get('host')) return res.status(403).json({ error: 'Request not allowed.' }); } catch (e) { return res.status(403).json({ error: 'Request not allowed.' }); } }
  next();
}

async function register({ email, name, password, cls, school, phone, consent }) {
  const doc = { email, name, passwordHash: await hash(password), role: 'student', cls, school, phone, consentAt: consent ? new Date() : null, createdAt: new Date(), lastLoginAt: null, disabled: false, failedLogins: 0, lockUntil: null };
  const r = await users().insertOne(doc);
  return { ...doc, _id: r.insertedId };
}

/** returns { user } or { error } - wrong tries are counted per account and lock it for a while */
async function login(emailRaw, password) {
  const email = cleanEmail(emailRaw);
  const u = isEmail(email) ? await users().findOne({ email }) : null;
  if (u && u.lockUntil && u.lockUntil > new Date()) { await bcrypt.compare('x', DUMMY); return { error: 'Too many wrong tries. Please wait a few minutes, or reset your password.', locked: true }; }
  const ok = await bcrypt.compare(String(password || '').slice(0, 100), u ? u.passwordHash : DUMMY);
  if (!u || !ok) {
    if (u) {
      const fails = (u.failedLogins || 0) + 1;
      await users().updateOne({ _id: u._id }, { $set: fails >= MAX_FAILS ? { failedLogins: 0, lockUntil: new Date(Date.now() + LOCK_MIN * 60e3) } : { failedLogins: fails } });
    }
    return { error: 'Wrong email or password.' };
  }
  if (u.disabled) return { error: 'This account is switched off. Please contact support.' };
  await users().updateOne({ _id: u._id }, { $set: { failedLogins: 0, lockUntil: null, lastLoginAt: new Date() } });
  return { user: u };
}

/** First start: create the admin from ADMIN_EMAIL / ADMIN_PASSWORD when there is no admin at all. */
async function bootstrapAdmin() {
  if (await users().countDocuments({ role: 'admin' }) > 0) return false;
  if (!config.adminEmail || !config.adminPassword) { console.warn('There is no admin yet. Set ADMIN_EMAIL and ADMIN_PASSWORD (or run: npm run make-admin).'); return false; }
  if (!isEmail(config.adminEmail) || !strongEnough(config.adminPassword)) { console.warn('ADMIN_EMAIL or ADMIN_PASSWORD is not valid (password: at least 8 characters).'); return false; }
  await users().insertOne({ email: config.adminEmail, name: 'Admin', passwordHash: await hash(config.adminPassword), role: 'admin', cls: null, school: '', phone: '', consentAt: null, createdAt: new Date(), lastLoginAt: null, disabled: false, failedLogins: 0, lockUntil: null });
  console.log('First admin created: ' + config.adminEmail);
  return true;
}

module.exports = { strongEnough, hash, publicUser, setSession, clearSession, loadUser, requireUser, requireAdmin, sameOriginPost, register, login, bootstrapAdmin, users };
