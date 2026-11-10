'use strict';
/**
 * The two endpoints the apps call (Windows, Linux, Android):
 *   POST /api/v1/devices/register   header X-Enroll-Key   -> { deviceId, token }       (once per installed screen)
 *   POST /api/v1/ingest             Authorization: Bearer <deviceId>.<token>            (every few minutes)
 *
 * The ingest body carries the device's CUMULATIVE totals (what its local usage file holds), so sending the same data
 * twice, or after an offline week, can never double count: the server keeps the larger value ($max).
 */
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const db = require('../db');
const { sha256, safeEqual } = require('../auth');

const router = express.Router();

const PLATFORMS = ['windows', 'linux', 'android', 'other'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_RE = /^(dash|(6|7|8|9|10)\/([1-9]|1\d|2\d))$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n * 10) / 10, max) : null; };

function cleanMeta(m) {
  m = m || {};
  const classes = [...new Set((Array.isArray(m.classes) ? m.classes : []).map(Number).filter((c) => c >= 6 && c <= 10))].sort((a, b) => a - b);
  return {
    school: str(m.school, 80) || 'Unknown school',
    label: str(m.label, 40),
    platform: PLATFORMS.includes(m.platform) ? m.platform : 'other',
    appVersion: str(m.appVersion, 20),
    kind: m.kind === 'classroom' ? 'classroom' : 'student',
    section: str(m.section, 6),
    classes,
    expiry: DATE_RE.test(String(m.expiry || '')) ? m.expiry : null,
  };
}

const canonicalSchool = (name) => require('../schools').canonical(name);

const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many registrations. Try again later.' } });
const ingestLimit = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => (req.headers.authorization || req.ip).slice(0, 80), message: { error: 'Slow down.' } });

router.post('/devices/register', registerLimit, async (req, res) => {
  try {
    if (!config.enrollKey) return res.status(503).json({ error: 'Device registration is switched off on this server.' });
    if (!safeEqual(req.get('x-enroll-key') || '', config.enrollKey)) return res.status(401).json({ error: 'Wrong enrollment key.' });
    const meta = cleanMeta(req.body);
    meta.school = await canonicalSchool(meta.school);
    // The app may invent its own id + secret BEFORE registering. Then a repeated registration (a page left before the answer came
    // back, a retry after a dropped connection) returns the SAME screen instead of creating another one.
    const clientId = /^[0-9a-f-]{36}$/.test(String((req.body && req.body.clientId) || '')) ? req.body.clientId : null;
    const clientToken = /^[0-9a-f]{64}$/.test(String((req.body && req.body.token) || '')) ? req.body.token : null;
    const token = clientToken || crypto.randomBytes(32).toString('hex');
    const deviceId = crypto.randomUUID();
    const now = new Date();
    const devices = db.get().collection('devices');
    try {
      await devices.insertOne({ _id: deviceId, ...(clientId ? { clientId } : {}), ...meta, tokenHash: sha256(token), registeredAt: now, lastSeen: now, revoked: false });
      return res.status(201).json({ deviceId, token });
    } catch (e) {
      if (!(e && e.code === 11000 && clientId)) throw e;
      const ex = await devices.findOne({ clientId });
      if (ex && clientToken && !ex.revoked && safeEqual(sha256(clientToken), ex.tokenHash)) return res.status(200).json({ deviceId: ex._id, token });   // same screen again
      return res.status(409).json({ error: 'This screen is already registered.' });
    }
  } catch (e) { console.error('register', e); res.status(500).json({ error: 'Could not register the device.' }); }
});

async function deviceAuth(req, res, next) {
  try {
    const m = /^Bearer ([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(req.get('authorization') || '');
    if (!m) return res.status(401).json({ error: 'Missing device token.' });
    const d = await db.get().collection('devices').findOne({ _id: m[1] });
    if (!d || d.revoked || !safeEqual(sha256(m[2]), d.tokenHash)) return res.status(401).json({ error: 'This device is not allowed to send data.' });
    req.device = d; next();
  } catch (e) { res.status(500).json({ error: 'Server error.' }); }
}

router.post('/ingest', ingestLimit, deviceAuth, async (req, res) => {
  try {
    const d = req.device, b = req.body || {};
    const meta = cleanMeta({ ...d, ...(b.device || {}) });
    meta.school = await canonicalSchool(meta.school);
    const base = { deviceId: d._id, school: meta.school, platform: meta.platform };
    const now = new Date();
    const maxDay = new Date(now.getTime() + 36 * 3600e3).toISOString().slice(0, 10);
    const minDay = new Date(now.getTime() - 400 * 864e5).toISOString().slice(0, 10);

    const daily = [];
    for (const [date, v] of Object.entries(b.days && typeof b.days === 'object' ? b.days : {}).slice(0, 400)) {
      if (!DATE_RE.test(date) || date < minDay || date > maxDay || !v || typeof v.pages !== 'object') continue;
      for (const [page, sec] of Object.entries(v.pages).slice(0, 300)) {
        const s = num(sec, 86400); if (!PAGE_RE.test(page) || s === null || s === 0) continue;
        const [cls, chapter] = page === 'dash' ? [null, null] : page.split('/').map(Number);
        daily.push({ updateOne: { filter: { _id: `${d._id}|${date}|${page}` }, upsert: true,
          update: { $max: { sec: s }, $set: { school: base.school, platform: base.platform }, $setOnInsert: { deviceId: d._id, date, page, cls, chapter } } } });
      }
    }

    const chapters = [];
    for (const [page, v] of Object.entries(b.chapters && typeof b.chapters === 'object' ? b.chapters : {}).slice(0, 300)) {
      if (!PAGE_RE.test(page) || page === 'dash' || !v) continue;
      const [cls, chapter] = page.split('/').map(Number);
      chapters.push({ updateOne: { filter: { _id: `${d._id}|${page}` }, upsert: true, update: {
        $max: { sec: num(v.sec, 1e8) || 0, opens: Math.min(Math.max(parseInt(v.opens, 10) || 0, 0), 1e7), ...(ISO_RE.test(v.last) ? { last: v.last } : {}) },
        ...(ISO_RE.test(v.first) ? { $min: { first: v.first } } : {}),
        $set: { school: base.school },
        $setOnInsert: { deviceId: d._id, page, cls, chapter } } } });
    }

    const sessions = [];
    for (const s of (Array.isArray(b.sessions) ? b.sessions : []).slice(-500)) {
      if (!s || !ISO_RE.test(s.start) || !ISO_RE.test(s.end)) continue;
      const cls = Number(s.cls); if (!(cls >= 6 && cls <= 10)) continue;
      sessions.push({ updateOne: { filter: { _id: `${d._id}|${s.start}` }, upsert: true, update: {
        $max: { sec: num(s.sec, 86400) || 0, end: s.end }, $set: { school: base.school },
        $setOnInsert: { deviceId: d._id, start: s.start, cls, section: str(s.section, 6) } } } });
    }

    const jobs = [];
    if (daily.length) jobs.push(db.get().collection('usage_daily').bulkWrite(daily, { ordered: false }));
    if (chapters.length) jobs.push(db.get().collection('chapters').bulkWrite(chapters, { ordered: false }));
    if (sessions.length) jobs.push(db.get().collection('sessions').bulkWrite(sessions, { ordered: false }));
    jobs.push(db.get().collection('devices').updateOne({ _id: d._id }, { $set: { ...meta, lastSeen: now } }));
    await Promise.all(jobs);
    res.json({ ok: true, days: daily.length, chapters: chapters.length, sessions: sessions.length });
  } catch (e) { console.error('ingest', e); res.status(500).json({ error: 'Could not save the data.' }); }
});

module.exports = router;
