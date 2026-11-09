'use strict';
const crypto = require('crypto');
const express = require('express');
const { ObjectId } = require('mongodb');
const auth = require('../auth');
const db = require('../db');
const ent = require('../entitlements');
const plans = require('../plans');
const { publicOrder } = require('./billing');
const { text, wrap, CLASSES } = require('../lib');

const router = express.Router();
router.use(auth.loadUser, auth.requireUser, auth.requireAdmin);

const oid = (s) => { try { return new ObjectId(String(s)); } catch (e) { return null; } };
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dayKey = (d) => d.toISOString().slice(0, 10);

router.get('/summary', wrap(async (req, res) => {
  const d = db.get(), since = new Date(Date.now() - 29 * 864e5); since.setUTCHours(0, 0, 0, 0);
  const [students, paid, revenue, signups, sales, activeBuyers] = await Promise.all([
    d.collection('users').countDocuments({ role: 'student' }),
    d.collection('orders').countDocuments({ status: 'paid' }),
    d.collection('orders').aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, paise: { $sum: '$amountPaise' } } }]).toArray(),
    d.collection('users').aggregate([{ $match: { role: 'student', createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }]).toArray(),
    d.collection('orders').aggregate([{ $match: { status: 'paid', paidAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } }, paise: { $sum: '$amountPaise' }, n: { $sum: 1 } } }]).toArray(),
    d.collection('entitlements').distinct('userId', { source: { $in: ['purchase', 'admin'] }, startsAt: { $lte: new Date() }, $or: [{ endsAt: null }, { endsAt: { $gt: new Date() } }] }),
  ]);
  const sm = new Map(signups.map((x) => [x._id, x.n])), rm = new Map(sales.map((x) => [x._id, x]));
  const series = []; for (let i = 29; i >= 0; i--) { const k = dayKey(new Date(Date.now() - i * 864e5)); series.push({ date: k, signups: sm.get(k) || 0, revenueInr: rm.has(k) ? rm.get(k).paise / 100 : 0, orders: rm.has(k) ? rm.get(k).n : 0 }); }
  res.json({ students, paidOrders: paid, revenueInr: (revenue[0] ? revenue[0].paise : 0) / 100, payingStudents: activeBuyers.length, series });
}));

router.get('/students', wrap(async (req, res) => {
  const q = text(req.query.q, 60), page = Math.max(0, parseInt(req.query.page, 10) || 0), size = 25;
  const filter = { role: 'student', ...(q ? { $or: [{ email: { $regex: esc(q), $options: 'i' } }, { name: { $regex: esc(q), $options: 'i' } }, { school: { $regex: esc(q), $options: 'i' } }] } : {}) };
  const [rows, total] = await Promise.all([db.get().collection('users').find(filter).sort({ createdAt: -1 }).skip(page * size).limit(size).toArray(), db.get().collection('users').countDocuments(filter)]);
  const ids = rows.map((u) => String(u._id)), now = new Date();
  const ents = await db.get().collection('entitlements').find({ userId: { $in: ids }, source: { $ne: 'trial' }, startsAt: { $lte: now }, $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }).toArray();
  const by = new Map(); for (const e of ents) { (by.get(e.userId) || by.set(e.userId, []).get(e.userId)).push(e); }
  res.json({ total, page, size, students: rows.map((u) => ({ ...auth.publicUser(u), lastLoginAt: u.lastLoginAt, disabled: !!u.disabled,
    plans: (by.get(String(u._id)) || []).map((e) => ({ id: e._id, classes: e.classes, endsAt: e.endsAt, source: e.source })) })) });
}));

router.get('/students/:id', wrap(async (req, res) => {
  const _id = oid(req.params.id), u = _id && await auth.users().findOne({ _id });
  if (!u) return res.status(404).json({ error: 'Student not found.' });
  const uid = String(u._id), d = db.get();
  const [orders, ents, prog] = await Promise.all([d.collection('orders').find({ userId: uid }).sort({ createdAt: -1 }).limit(50).toArray(), d.collection('entitlements').find({ userId: uid }).sort({ startsAt: -1 }).toArray(),
    d.collection('progress').aggregate([{ $match: { userId: uid } }, { $group: { _id: null, sec: { $sum: '$sec' }, chapters: { $sum: 1 } } }]).toArray()]);
  res.json({ student: { ...auth.publicUser(u), lastLoginAt: u.lastLoginAt, disabled: !!u.disabled, consentAt: u.consentAt }, orders: orders.map(publicOrder),
    access: ents.map((e) => ({ id: e._id, source: e.source, planId: e.planId, classes: e.classes, chapters: e.chapters === 'all' ? 'all' : e.chapters.length + ' free chapters', startsAt: e.startsAt, endsAt: e.endsAt })),
    learning: { hours: prog[0] ? Math.round(prog[0].sec / 36) / 100 : 0, chapters: prog[0] ? prog[0].chapters : 0 } });
}));

router.post('/students/:id/grant', wrap(async (req, res) => {
  const _id = oid(req.params.id), u = _id && await auth.users().findOne({ _id });
  if (!u) return res.status(404).json({ error: 'Student not found.' });
  const b = req.body || {};
  const classes = b.classes === 'all' ? [...CLASSES] : [...new Set((Array.isArray(b.classes) ? b.classes : []).map(Number).filter((c) => CLASSES.includes(c)))];
  const days = Math.round(Number(b.days));
  if (!classes.length) return res.status(400).json({ error: 'Choose at least one class.' });
  if (!(days >= 1 && days <= 1095)) return res.status(400).json({ error: 'Days must be between 1 and 1095.' });
  const e = await ent.grant({ userId: u._id, source: 'admin', planId: 'admin-grant', classes, days });
  res.status(201).json({ ok: true, endsAt: e.endsAt });
}));

router.post('/students/:id/disable', wrap(async (req, res) => {
  const _id = oid(req.params.id), r = _id && await auth.users().updateOne({ _id, role: 'student' }, { $set: { disabled: !!(req.body && req.body.disabled) } });
  r && r.matchedCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Student not found.' });
}));

router.delete('/entitlements/:id', wrap(async (req, res) => {
  const r = await db.get().collection('entitlements').deleteOne({ _id: String(req.params.id), source: { $ne: 'trial' } });
  r.deletedCount ? res.json({ ok: true }) : res.status(404).json({ error: 'Access not found.' });
}));

router.get('/orders', wrap(async (req, res) => {
  const status = ['paid', 'created', 'failed'].includes(req.query.status) ? { status: req.query.status } : {};
  const list = await db.get().collection('orders').find(status).sort({ createdAt: -1 }).limit(200).toArray();
  const users = new Map((await auth.users().find({ _id: { $in: list.map((o) => oid(o.userId)).filter(Boolean) } }).toArray()).map((u) => [String(u._id), u]));
  res.json({ orders: list.map((o) => ({ ...publicOrder(o), student: users.get(o.userId) ? users.get(o.userId).email : '', studentName: users.get(o.userId) ? users.get(o.userId).name : '' })) });
}));

// ---------------------------------------------------------------- plans
function cleanPlan(b, existing) {
  const name = text(b.name !== undefined ? b.name : existing && existing.name, 40);
  const price = Math.round(Number(b.priceInr !== undefined ? b.priceInr : existing && existing.priceInr));
  const days = Math.round(Number(b.durationDays !== undefined ? b.durationDays : existing && existing.durationDays));
  const scope = b.scope !== undefined ? b.scope : existing && existing.scope;
  if (name.length < 2) return { error: 'Please give the plan a name.' };
  if (!(price >= 1 && price <= 200000)) return { error: 'Price must be between 1 and 200000 rupees.' };
  if (!(days >= 1 && days <= 1095)) return { error: 'Length must be between 1 and 1095 days.' };
  if (!['one-class', 'all-classes'].includes(scope)) return { error: 'Scope must be one-class or all-classes.' };
  const features = (Array.isArray(b.features) ? b.features : (existing && existing.features) || []).map((f) => text(f, 90)).filter(Boolean).slice(0, 8);
  return { value: { name, tagline: text(b.tagline !== undefined ? b.tagline : existing && existing.tagline, 100), priceInr: price, durationDays: days, scope, badge: text(b.badge !== undefined ? b.badge : existing && existing.badge, 20), features,
    active: b.active !== undefined ? !!b.active : existing ? !!existing.active : true, sort: Math.round(Number(b.sort !== undefined ? b.sort : existing ? existing.sort : 50)) || 50 } };
}
router.get('/plans', wrap(async (req, res) => res.json({ plans: await plans.list({ onlyActive: false }) })));
router.post('/plans', wrap(async (req, res) => {
  const r = cleanPlan(req.body || {}); if (r.error) return res.status(400).json({ error: r.error });
  const id = (r.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan') + '-' + crypto.randomBytes(2).toString('hex');
  await db.get().collection('plans').insertOne({ _id: id, ...r.value });
  res.status(201).json({ ok: true, id });
}));
router.patch('/plans/:id', wrap(async (req, res) => {
  const ex = await plans.get(req.params.id); if (!ex) return res.status(404).json({ error: 'Plan not found.' });
  const r = cleanPlan(req.body || {}, ex); if (r.error) return res.status(400).json({ error: r.error });
  await db.get().collection('plans').updateOne({ _id: ex._id }, { $set: r.value });
  res.json({ ok: true });
}));

module.exports = router;
