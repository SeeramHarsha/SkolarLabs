'use strict';
/** Everything the web dashboard calls. All of it needs a signed-in user except /auth/login. */
const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../auth');
const db = require('../db');
const Q = require('../queries');

const router = express.Router();

const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please wait 15 minutes.' } });
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(req.method, req.path, e); res.status(500).json({ error: 'Something went wrong on the server.' }); });

// ---------------------------------------------------------------- sign in / out
router.post('/auth/login', loginLimit, wrap(async (req, res) => {
  const u = await auth.login(req.body && req.body.email, req.body && req.body.password);
  if (!u) return res.status(401).json({ error: 'Wrong email or password.' });
  res.json({ token: auth.sign(u), user: auth.publicUser(u) });
}));
router.get('/auth/me', auth.requireUser, (req, res) => res.json({ user: req.user }));

router.use(auth.requireUser);

// ---------------------------------------------------------------- numbers
router.get('/overview', wrap(async (req, res) => res.json(await Q.overview(req.user, req.query))));
router.get('/schools', wrap(async (req, res) => res.json(await Q.schools(req.user, req.query))));
router.get('/schools/:name', wrap(async (req, res) => {
  const r = await Q.schoolDetail(req.user, req.params.name, req.query);
  if (!r) return res.status(404).json({ error: 'School not found.' });
  res.json(r);
}));
router.get('/devices', wrap(async (req, res) => res.json(await Q.devices(req.user, req.query))));
router.get('/devices/:id', wrap(async (req, res) => {
  const r = await Q.deviceDetail(req.user, req.params.id, req.query);
  if (!r) return res.status(404).json({ error: 'Device not found.' });
  res.json(r);
}));
router.get('/chapters', wrap(async (req, res) => res.json(await Q.chapters(req.user, req.query))));

const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
router.get('/export.csv', wrap(async (req, res) => {
  const rows = await Q.exportRows(req.user, req.query);
  const head = ['date', 'school', 'screen', 'device_id', 'platform', 'type', 'class', 'chapter', 'active_minutes'];
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="botclub-usage.csv"', 'Cache-Control': 'no-store' });
  res.send('﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
}));

// ---------------------------------------------------------------- admin only: devices
router.post('/devices/:id/revoke', auth.requireAdmin, wrap(async (req, res) => {
  const r = await db.get().collection('devices').updateOne({ _id: String(req.params.id) }, { $set: { revoked: req.body && req.body.revoked === false ? false : true } });
  r.matchedCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Device not found.' });
}));
router.delete('/devices/:id', auth.requireAdmin, wrap(async (req, res) => {
  const id = String(req.params.id), d = db.get();
  const r = await d.collection('devices').deleteOne({ _id: id });
  if (!r.deletedCount) return res.status(404).json({ error: 'Device not found.' });
  await Promise.all([d.collection('usage_daily').deleteMany({ deviceId: id }), d.collection('chapters').deleteMany({ deviceId: id }), d.collection('sessions').deleteMany({ deviceId: id })]);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- admin only: dashboard users
router.get('/users', auth.requireAdmin, wrap(async (req, res) => {
  res.json({ users: (await db.get().collection('users').find().sort({ createdAt: 1 }).toArray()).map(auth.publicUser) });
}));
router.post('/users', auth.requireAdmin, wrap(async (req, res) => {
  try {
    const b = req.body || {};
    const schools = Array.isArray(b.schools) ? b.schools.map((s) => String(s).slice(0, 80)).slice(0, 50) : [];
    res.status(201).json({ user: await auth.createUser(b.email, b.password, b.role === 'admin' ? 'admin' : 'viewer', schools) });
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ error: 'That email already has a login.' });
    res.status(400).json({ error: e.message || 'Could not create the user.' });
  }
}));
router.delete('/users/:email', auth.requireAdmin, wrap(async (req, res) => {
  const email = auth.cleanEmail(req.params.email), users = db.get().collection('users');
  if (email === req.user.email) return res.status(400).json({ error: 'You cannot delete your own login.' });
  const target = await users.findOne({ _id: email });
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.role === 'admin' && await users.countDocuments({ role: 'admin' }) <= 1) return res.status(400).json({ error: 'There must be at least one admin.' });
  await users.deleteOne({ _id: email });
  res.json({ ok: true });
}));

module.exports = router;
