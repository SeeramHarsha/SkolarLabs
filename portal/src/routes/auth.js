'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../auth');
const db = require('../db');
const config = require('../config');
const mailer = require('../mailer');
const ent = require('../entitlements');
const { text, cleanEmail, isEmail, cls, sha256, randomToken, wrap } = require('../lib');

const router = express.Router();
const lim = (windowMs, limit, msg) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error: msg } });
const registerLimit = lim(60 * 60 * 1000, 15, 'Too many new accounts from this network. Please try again later.');
const loginLimit = lim(15 * 60 * 1000, 30, 'Too many sign-in attempts. Please wait 15 minutes.');
const forgotLimit = lim(60 * 60 * 1000, 8, 'Too many requests. Please try again later.');

router.post('/register', registerLimit, wrap(async (req, res) => {
  const b = req.body || {};
  const email = cleanEmail(b.email), name = text(b.name, 80), school = text(b.school, 100), phone = text(b.phone, 20).replace(/[^\d+ ()-]/g, '');
  const c = cls(b.cls);
  if (name.length < 2) return res.status(400).json({ error: 'Please enter the student\'s name.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!auth.strongEnough(b.password)) return res.status(400).json({ error: 'The password must be at least 8 characters.' });
  if (String(b.password).toLowerCase() === email) return res.status(400).json({ error: 'The password cannot be your email address.' });
  if (!c) return res.status(400).json({ error: 'Please choose the class (6 to 10).' });
  if (b.consent !== true) return res.status(400).json({ error: 'Please confirm that you are a parent/guardian, or have a parent/guardian\'s permission.' });
  let user;
  try { user = await auth.register({ email, name, password: b.password, cls: c, school, phone, consent: true }); }
  catch (e) { if (e && e.code === 11000) return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' }); throw e; }
  await ent.ensureTrial(user._id);
  auth.setSession(res, user);
  res.status(201).json({ user: auth.publicUser(user) });
}));

router.post('/login', loginLimit, wrap(async (req, res) => {
  const r = await auth.login(req.body && req.body.email, req.body && req.body.password);
  if (r.error) return res.status(r.locked ? 429 : 401).json({ error: r.error });
  auth.setSession(res, r.user);
  res.json({ user: auth.publicUser(r.user) });
}));

router.post('/logout', (req, res) => { auth.clearSession(res); res.json({ ok: true }); });

/** Always answers "ok", so nobody can use this form to find out who has an account. */
router.post('/forgot', forgotLimit, wrap(async (req, res) => {
  const email = cleanEmail(req.body && req.body.email);
  const u = isEmail(email) ? await auth.users().findOne({ email }) : null;
  if (u && !u.disabled) {
    const token = randomToken(32);
    await auth.users().updateOne({ _id: u._id }, { $set: { resetHash: sha256(token), resetExpires: new Date(Date.now() + 3600e3) } });
    const base = config.baseUrl || `${req.protocol}://${req.get('host')}`;
    try {
      await mailer.send({ to: u.email, subject: `Reset your ${config.brand} password`,
        text: `Hello ${u.name},\n\nSomeone asked to reset the password of this ${config.brand} account. Open this link within one hour to choose a new password:\n\n${base}/reset.html?token=${token}\n\nIf this was not you, ignore this email: your password stays as it is.\n` });
    } catch (e) { console.error('could not send the reset e-mail:', e.message); }
  }
  res.json({ ok: true });
}));

router.post('/reset', forgotLimit, wrap(async (req, res) => {
  const token = String((req.body && req.body.token) || ''), password = req.body && req.body.password;
  if (!/^[0-9a-f]{64}$/.test(token)) return res.status(400).json({ error: 'This reset link is not valid.' });
  if (!auth.strongEnough(password)) return res.status(400).json({ error: 'The password must be at least 8 characters.' });
  const u = await auth.users().findOne({ resetHash: sha256(token), resetExpires: { $gt: new Date() } });
  if (!u) return res.status(400).json({ error: 'This reset link has expired or was already used. Please ask for a new one.' });
  const passwordHash = await auth.hash(password);
  await auth.users().updateOne({ _id: u._id }, { $set: { passwordHash, failedLogins: 0, lockUntil: null }, $unset: { resetHash: '', resetExpires: '' } });
  const fresh = await auth.users().findOne({ _id: u._id });
  auth.setSession(res, fresh);
  res.json({ user: auth.publicUser(fresh) });
}));

module.exports = router;
