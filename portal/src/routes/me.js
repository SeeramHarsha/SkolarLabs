'use strict';
const express = require('express');
const auth = require('../auth');
const db = require('../db');
const ent = require('../entitlements');
const catalog = require('../catalog');
const { text, cls, today, wrap } = require('../lib');

const router = express.Router();
router.use(auth.loadUser, auth.requireUser);

const dayKey = (d) => d.toISOString().slice(0, 10);

router.get('/me', wrap(async (req, res) => {
  res.json({ user: auth.publicUser(req.user), access: ent.summarize(await ent.current(req.user._id)) });
}));

router.patch('/me', wrap(async (req, res) => {
  const b = req.body || {}, set = {};
  if (b.name !== undefined) { const n = text(b.name, 80); if (n.length < 2) return res.status(400).json({ error: 'Please enter a name.' }); set.name = n; }
  if (b.cls !== undefined) { const c = cls(b.cls); if (!c) return res.status(400).json({ error: 'Please choose a class from 6 to 10.' }); set.cls = c; }
  if (b.school !== undefined) set.school = text(b.school, 100);
  if (b.phone !== undefined) set.phone = text(b.phone, 20).replace(/[^\d+ ()-]/g, '');
  if (Object.keys(set).length) await auth.users().updateOne({ _id: req.user._id }, { $set: set });
  res.json({ user: auth.publicUser({ ...req.user, ...set }) });
}));

router.post('/password', wrap(async (req, res) => {
  const b = req.body || {};
  const ok = await require('bcryptjs').compare(String(b.current || '').slice(0, 100), req.user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Your current password is not right.' });
  if (!auth.strongEnough(b.password)) return res.status(400).json({ error: 'The new password must be at least 8 characters.' });
  const passwordHash = await auth.hash(b.password);
  await auth.users().updateOne({ _id: req.user._id }, { $set: { passwordHash } });
  auth.setSession(res, { ...req.user, passwordHash });                    // this device stays signed in, all others are signed out
  res.json({ ok: true });
}));

/** everything the learning home needs: classes, chapters, what is open, time spent, streak */
router.get('/catalog', wrap(async (req, res) => {
  const uid = String(req.user._id), cat = catalog.load();
  const ents = await ent.active(uid);
  const prog = new Map((await db.get().collection('progress').find({ userId: uid }).toArray()).map((p) => [`${p.cls}/${p.chapter}`, p]));
  const classes = Object.entries(cat.classes).map(([c, chs]) => ({
    cls: Number(c),
    chapters: chs.map((x) => {
      const p = prog.get(`${c}/${x.chapter}`);
      return { chapter: x.chapter, title: x.title, access: ent.allows(ents, Number(c), x.chapter), sec: p ? Math.round(p.sec) : 0, opens: p ? p.opens || 0 : 0, done: !!(p && p.done), lastAt: p ? p.lastAt : null };
    }),
  }));
  const days = await db.get().collection('daily_usage').find({ userId: uid }).sort({ date: -1 }).limit(120).toArray();
  const by = new Map(days.map((d) => [d.date, d.sec]));
  let streak = 0; const t = new Date();
  if ((by.get(dayKey(t)) || 0) < 60) t.setUTCDate(t.getUTCDate() - 1);
  while ((by.get(dayKey(t)) || 0) >= 60) { streak++; t.setUTCDate(t.getUTCDate() - 1); }
  const week = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setUTCDate(d.getUTCDate() - i); week.push({ date: dayKey(d), sec: Math.round(by.get(dayKey(d)) || 0) }); }
  const total = [...prog.values()].reduce((a, p) => a + (p.sec || 0), 0);
  const last = [...prog.values()].sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))[0];
  res.json({
    classes, access: ent.summarize(await ent.current(uid)),
    stats: { totalSec: Math.round(total), todaySec: Math.round(by.get(today()) || 0), streak, week, chaptersStarted: [...prog.values()].filter((p) => p.sec > 0).length, chaptersDone: [...prog.values()].filter((p) => p.done).length },
    continue: last ? { cls: last.cls, chapter: last.chapter } : null,
  });
}));

/** the lesson page reports active time every ~15 s; the server limits what it accepts per ping */
router.post('/progress/ping', wrap(async (req, res) => {
  const c = cls(req.body && req.body.cls), n = Number(req.body && req.body.chapter);
  if (!c || !catalog.has(c, n)) return res.status(400).json({ error: 'Unknown chapter.' });
  if (!ent.allows(await ent.active(req.user._id), c, n)) return res.status(403).json({ error: 'This chapter is not part of your plan.' });
  const uid = String(req.user._id), id = `${uid}|${c}/${n}`, now = new Date();
  const coll = db.get().collection('progress');
  const cur = await coll.findOne({ _id: id }, { projection: { lastPing: 1 } });
  const gap = cur && cur.lastPing ? (now - cur.lastPing) / 1000 : 30;
  const sec = Math.max(0, Math.min(Number(req.body.sec) || 0, 30, gap + 2));
  await coll.updateOne({ _id: id }, { $inc: { sec, opens: req.body.open ? 1 : 0 }, $set: { lastAt: now, lastPing: now }, $setOnInsert: { userId: uid, cls: c, chapter: n, firstAt: now, done: false } }, { upsert: true });
  if (sec > 0) await db.get().collection('daily_usage').updateOne({ _id: `${uid}|${today()}` }, { $inc: { sec }, $setOnInsert: { userId: uid, date: today() } }, { upsert: true });
  res.json({ ok: true });
}));

router.post('/progress/done', wrap(async (req, res) => {
  const c = cls(req.body && req.body.cls), n = Number(req.body && req.body.chapter);
  if (!c || !catalog.has(c, n)) return res.status(400).json({ error: 'Unknown chapter.' });
  if (!ent.allows(await ent.active(req.user._id), c, n)) return res.status(403).json({ error: 'This chapter is not part of your plan.' });
  const uid = String(req.user._id), now = new Date();
  await db.get().collection('progress').updateOne({ _id: `${uid}|${c}/${n}` }, { $set: { done: req.body.done !== false, lastAt: now }, $setOnInsert: { userId: uid, cls: c, chapter: n, sec: 0, opens: 0, firstAt: now } }, { upsert: true });
  res.json({ ok: true });
}));

module.exports = router;
