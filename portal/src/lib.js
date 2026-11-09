'use strict';
const crypto = require('crypto');

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const CLASSES = [6, 7, 8, 9, 10];

/** one line of text, no control characters, trimmed and cut */
const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanEmail = (v) => String(v || '').trim().toLowerCase().slice(0, 254);
const isEmail = (v) => EMAIL_RE.test(String(v || ''));
const cls = (v) => { const n = Number(v); return CLASSES.includes(n) ? n : null; };
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const safeEqual = (a, b) => { const x = Buffer.from(sha256(a)), y = Buffer.from(sha256(b)); return crypto.timingSafeEqual(x, y); };
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const today = () => new Date().toISOString().slice(0, 10);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => { console.error(req.method, req.originalUrl.split('?')[0], e); res.status(500).json({ error: 'Something went wrong on our side. Please try again.' }); });

module.exports = { EMAIL_RE, CLASSES, text, cleanEmail, isEmail, cls, sha256, safeEqual, randomToken, today, wrap };
