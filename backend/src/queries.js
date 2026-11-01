'use strict';
const db = require('./db');
const config = require('./config');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');
const dayStr = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return dayStr(d); };
const today = () => dayStr(new Date());

/** from / to / school / cls / platform from the query string, cleaned. A viewer's school list always applies. */
function filters(user, q) {
  let to = DATE_RE.test(q.to) ? q.to : today();
  let from = DATE_RE.test(q.from) ? q.from : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  if (addDays(from, 400) < to) from = addDays(to, -400);
  const cls = [6, 7, 8, 9, 10].includes(Number(q.cls)) ? Number(q.cls) : null;
  const platform = ['windows', 'linux', 'android', 'other'].includes(q.platform) ? q.platform : null;
  let school = typeof q.school === 'string' && q.school ? q.school.slice(0, 80) : null;
  const scope = user && user.role !== 'admin' && user.schools && user.schools.length ? user.schools : null;
  let impossible = false;
  if (scope) { if (school && !scope.includes(school)) impossible = true; }
  return { from, to, cls, platform, school, scope, impossible };
}

function schoolMatch(f) {
  if (f.school) return { school: f.school };
  if (f.scope) return { school: { $in: f.scope } };
  return {};
}
function dailyMatch(f) {
  return { date: { $gte: f.from, $lte: f.to }, ...schoolMatch(f), ...(f.cls ? { cls: f.cls } : {}), ...(f.platform ? { platform: f.platform } : {}) };
}
function deviceMatch(f) { return { ...schoolMatch(f), ...(f.platform ? { platform: f.platform } : {}) }; }

function series(from, to, rows, pick) {
  const by = new Map(rows.map((r) => [r._id, r]));
  const out = [];
  for (let d = from, n = 0; d <= to && n < 420; d = addDays(d, 1), n++) out.push({ date: d, ...pick(by.get(d)) });
  return out;
}
const hours = (sec) => Math.round((sec / 3600) * 100) / 100;

const EMPTY = { totals: { totalSec: 0, lessonSec: 0, activeDevices: 0, activeSchools: 0 } };

async function overview(user, q) {
  const f = filters(user, q), d = db.get();
  const online = new Date(Date.now() - config.onlineMinutes * 60e3);
  const soon = addDays(today(), 30);
  if (f.impossible) return { range: { from: f.from, to: f.to }, kpis: {}, daily: [], byClass: [], byPlatform: [], topChapters: [], bySchool: [] };

  const m = dailyMatch(f);
  const [agg] = await d.collection('usage_daily').aggregate([{ $match: m }, { $facet: {
    totals: [{ $group: { _id: null, sec: { $sum: '$sec' }, lesson: { $sum: { $cond: [{ $eq: ['$page', 'dash'] }, 0, '$sec'] } }, devices: { $addToSet: '$deviceId' }, schools: { $addToSet: '$school' } } }],
    perDay: [{ $group: { _id: '$date', sec: { $sum: '$sec' }, lesson: { $sum: { $cond: [{ $eq: ['$page', 'dash'] }, 0, '$sec'] } }, devices: { $addToSet: '$deviceId' } } }],
    byClass: [{ $match: { page: { $ne: 'dash' } } }, { $group: { _id: '$cls', sec: { $sum: '$sec' }, devices: { $addToSet: '$deviceId' } } }, { $sort: { _id: 1 } }],
    byPlatform: [{ $group: { _id: '$platform', sec: { $sum: '$sec' }, devices: { $addToSet: '$deviceId' } } }, { $sort: { sec: -1 } }],
    topChapters: [{ $match: { page: { $ne: 'dash' } } }, { $group: { _id: '$page', sec: { $sum: '$sec' }, devices: { $addToSet: '$deviceId' }, cls: { $first: '$cls' }, chapter: { $first: '$chapter' } } }, { $sort: { sec: -1 } }, { $limit: 10 }],
    bySchool: [{ $group: { _id: '$school', sec: { $sum: '$sec' }, devices: { $addToSet: '$deviceId' } } }, { $sort: { sec: -1 } }, { $limit: 10 }],
    weekday: [{ $group: { _id: '$date', sec: { $sum: '$sec' } } }],
  } }]).toArray();

  const t = (agg.totals[0]) || { sec: 0, lesson: 0, devices: [], schools: [] };
  const sMatch = { start: { $gte: f.from + 'T00:00:00', $lte: f.to + 'T23:59:59.999Z' }, ...schoolMatch(f), ...(f.cls ? { cls: f.cls } : {}) };
  const dm = deviceMatch(f);
  const [sessions, registered, onlineNow, expiring, revoked] = await Promise.all([
    d.collection('sessions').countDocuments(sMatch),
    d.collection('devices').countDocuments({ ...dm, revoked: { $ne: true } }),
    d.collection('devices').countDocuments({ ...dm, revoked: { $ne: true }, lastSeen: { $gte: online } }),
    d.collection('devices').countDocuments({ ...dm, revoked: { $ne: true }, expiry: { $ne: null, $lte: soon, $gte: today() } }),
    d.collection('devices').countDocuments({ ...dm, revoked: true }),
  ]);
  const days = Math.max(1, agg.perDay.filter((r) => r.sec > 0).length);

  return {
    range: { from: f.from, to: f.to },
    kpis: {
      totalHours: hours(t.sec), lessonHours: hours(t.lesson), activeDevices: t.devices.length, activeSchools: t.schools.length,
      sessions, registeredDevices: registered, onlineNow, expiringSoon: expiring, revokedDevices: revoked,
      avgMinutesPerActiveDevicePerDay: t.devices.length ? Math.round((t.sec / 60) / (t.devices.length * days) * 10) / 10 : 0,
    },
    daily: series(f.from, f.to, agg.perDay, (r) => ({ hours: r ? hours(r.sec) : 0, lessonHours: r ? hours(r.lesson) : 0, devices: r ? r.devices.length : 0 })),
    byClass: [6, 7, 8, 9, 10].map((c) => { const r = agg.byClass.find((x) => x._id === c); return { cls: c, hours: r ? hours(r.sec) : 0, devices: r ? r.devices.length : 0 }; }),
    byPlatform: agg.byPlatform.map((r) => ({ platform: r._id, hours: hours(r.sec), devices: r.devices.length })),
    topChapters: agg.topChapters.map((r) => ({ page: r._id, cls: r.cls, chapter: r.chapter, hours: hours(r.sec), devices: r.devices.length })),
    bySchool: agg.bySchool.map((r) => ({ school: r._id, hours: hours(r.sec), devices: r.devices.length })),
  };
}

function statusOf(dev, now = Date.now()) {
  if (dev.revoked) return 'revoked';
  if (dev.expiry && dev.expiry < today()) return 'expired';
  if (dev.lastSeen && now - new Date(dev.lastSeen).getTime() <= config.onlineMinutes * 60e3) return 'online';
  return 'offline';
}

async function schools(user, q) {
  const f = filters(user, q), d = db.get();
  if (f.impossible) return { range: { from: f.from, to: f.to }, schools: [] };
  const usage = await d.collection('usage_daily').aggregate([{ $match: dailyMatch(f) },
    { $group: { _id: '$school', sec: { $sum: '$sec' }, lesson: { $sum: { $cond: [{ $eq: ['$page', 'dash'] }, 0, '$sec'] } }, active: { $addToSet: '$deviceId' } } }]).toArray();
  const devs = await d.collection('devices').aggregate([{ $match: { ...deviceMatch(f) } },
    { $group: { _id: '$school', devices: { $sum: 1 }, lastSeen: { $max: '$lastSeen' }, platforms: { $addToSet: '$platform' }, expiry: { $max: '$expiry' },
      revoked: { $sum: { $cond: ['$revoked', 1, 0] } }, online: { $sum: { $cond: [{ $gte: ['$lastSeen', new Date(Date.now() - config.onlineMinutes * 60e3)] }, 1, 0] } } } }]).toArray();
  const u = new Map(usage.map((x) => [x._id, x]));
  const rows = devs.map((x) => { const s = u.get(x._id); return {
    school: x._id, devices: x.devices, online: x.online, revoked: x.revoked, platforms: x.platforms.sort(), lastSeen: x.lastSeen, expiry: x.expiry,
    hours: s ? hours(s.sec) : 0, lessonHours: s ? hours(s.lesson) : 0, activeDevices: s ? s.active.length : 0 }; });
  rows.sort((a, b) => b.hours - a.hours || a.school.localeCompare(b.school));
  return { range: { from: f.from, to: f.to }, schools: rows };
}

async function devices(user, q) {
  const f = filters(user, q), d = db.get();
  if (f.impossible) return { range: { from: f.from, to: f.to }, devices: [] };
  const list = await d.collection('devices').find(deviceMatch(f), { projection: { tokenHash: 0 } }).sort({ lastSeen: -1 }).limit(2000).toArray();
  const usage = await d.collection('usage_daily').aggregate([{ $match: { ...dailyMatch(f), deviceId: { $in: list.map((x) => x._id) } } },
    { $group: { _id: '$deviceId', sec: { $sum: '$sec' }, lesson: { $sum: { $cond: [{ $eq: ['$page', 'dash'] }, 0, '$sec'] } }, days: { $addToSet: '$date' } } }]).toArray();
  const u = new Map(usage.map((x) => [x._id, x]));
  return { range: { from: f.from, to: f.to }, devices: list.map((x) => { const s = u.get(x._id); return {
    id: x._id, school: x.school, label: x.label, platform: x.platform, appVersion: x.appVersion, kind: x.kind, section: x.section, classes: x.classes,
    expiry: x.expiry, lastSeen: x.lastSeen, registeredAt: x.registeredAt, status: statusOf(x), hours: s ? hours(s.sec) : 0, lessonHours: s ? hours(s.lesson) : 0, activeDays: s ? s.days.length : 0 }; }) };
}

async function deviceDetail(user, id, q) {
  const d = db.get();
  const dev = await d.collection('devices').findOne({ _id: String(id) }, { projection: { tokenHash: 0 } });
  if (!dev) return null;
  const f = filters(user, q);
  if (f.scope && !f.scope.includes(dev.school)) return null;
  const m = { deviceId: dev._id, date: { $gte: f.from, $lte: f.to } };
  const [daily, pages, sessions, allTime] = await Promise.all([
    d.collection('usage_daily').aggregate([{ $match: m }, { $group: { _id: '$date', sec: { $sum: '$sec' }, lesson: { $sum: { $cond: [{ $eq: ['$page', 'dash'] }, 0, '$sec'] } } } }]).toArray(),
    d.collection('usage_daily').aggregate([{ $match: { ...m, page: { $ne: 'dash' } } }, { $group: { _id: '$page', sec: { $sum: '$sec' }, cls: { $first: '$cls' }, chapter: { $first: '$chapter' } } }, { $sort: { sec: -1 } }, { $limit: 15 }]).toArray(),
    d.collection('sessions').find({ deviceId: dev._id }).sort({ start: -1 }).limit(30).toArray(),
    d.collection('chapters').aggregate([{ $match: { deviceId: dev._id } }, { $group: { _id: null, sec: { $sum: '$sec' }, opens: { $sum: '$opens' }, chapters: { $sum: 1 } } }]).toArray(),
  ]);
  const opens = new Map((await d.collection('chapters').find({ deviceId: dev._id }).toArray()).map((c) => [c.page, c.opens]));
  return {
    device: { id: dev._id, school: dev.school, label: dev.label, platform: dev.platform, appVersion: dev.appVersion, kind: dev.kind, section: dev.section, classes: dev.classes,
      expiry: dev.expiry, lastSeen: dev.lastSeen, registeredAt: dev.registeredAt, status: statusOf(dev) },
    range: { from: f.from, to: f.to },
    daily: series(f.from, f.to, daily, (r) => ({ hours: r ? hours(r.sec) : 0, lessonHours: r ? hours(r.lesson) : 0 })),
    topChapters: pages.map((r) => ({ page: r._id, cls: r.cls, chapter: r.chapter, hours: hours(r.sec), opens: opens.get(r._id) || 0 })),
    sessions: sessions.map((s) => ({ start: s.start, end: s.end, cls: s.cls, section: s.section, minutes: Math.round((s.sec || 0) / 6) / 10 })),
    allTime: allTime[0] ? { hours: hours(allTime[0].sec), opens: allTime[0].opens, chapters: allTime[0].chapters } : { hours: 0, opens: 0, chapters: 0 },
  };
}

async function chapters(user, q) {
  const f = filters(user, q), d = db.get();
  if (f.impossible) return { range: { from: f.from, to: f.to }, chapters: [] };
  const rows = await d.collection('usage_daily').aggregate([{ $match: { ...dailyMatch(f), page: { $ne: 'dash' } } },
    { $group: { _id: '$page', sec: { $sum: '$sec' }, devices: { $addToSet: '$deviceId' }, schools: { $addToSet: '$school' }, cls: { $first: '$cls' }, chapter: { $first: '$chapter' } } }, { $sort: { sec: -1 } }]).toArray();
  const opens = await d.collection('chapters').aggregate([{ $match: schoolMatch(f) }, { $group: { _id: '$page', opens: { $sum: '$opens' } } }]).toArray();
  const o = new Map(opens.map((x) => [x._id, x.opens]));
  return { range: { from: f.from, to: f.to }, chapters: rows.map((r) => ({ page: r._id, cls: r.cls, chapter: r.chapter, hours: hours(r.sec),
    avgMinutesPerDevice: r.devices.length ? Math.round(r.sec / 60 / r.devices.length * 10) / 10 : 0, devices: r.devices.length, schools: r.schools.length, opensAllTime: o.get(r._id) || 0 })) };
}

/** Rows for the CSV download (spreadsheet-safe: cells that start with = + - @ are neutralised). */
async function exportRows(user, q) {
  const f = filters(user, q), d = db.get();
  if (f.impossible) return [];
  const rows = await d.collection('usage_daily').find(dailyMatch(f)).sort({ date: 1, school: 1 }).limit(100000).toArray();
  const names = new Map((await d.collection('devices').find({ _id: { $in: [...new Set(rows.map((r) => r.deviceId))] } }, { projection: { label: 1 } }).toArray()).map((x) => [x._id, x.label]));
  return rows.map((r) => [r.date, r.school, names.get(r.deviceId) || '', r.deviceId, r.platform, r.page === 'dash' ? 'dashboard' : 'lesson', r.cls == null ? '' : r.cls, r.chapter == null ? '' : r.chapter, Math.round(r.sec / 6) / 10]);
}

/** Chapters per class in the learning site (used for "curriculum progress"). */
const CHAPTER_COUNTS = { 6: 12, 7: 12, 8: 13, 9: 11, 10: 13 };

/**
 * ONE school = ONE progress. Adds up every screen of the school: time, sessions, classes, chapters, and how much of the
 * curriculum the school has covered. Also lists the screens that make it up.
 */
async function schoolDetail(user, name, q) {
  const f = filters(user, { ...q, school: name }), d = db.get();
  if (f.impossible) return null;
  const caseless = { collation: { locale: 'en', strength: 2 } };
  const devs = await d.collection('devices').find({ school: String(name).slice(0, 80) }, { projection: { tokenHash: 0 }, ...caseless }).toArray();
  if (!devs.length) return null;
  const school = devs[0].school;                       // the stored spelling
  const m = { school, date: { $gte: f.from, $lte: f.to }, ...(f.cls ? { cls: f.cls } : {}), ...(f.platform ? { platform: f.platform } : {}) };
  const lessonOnly = { $cond: [{ $eq: ['$page', 'dash'] }, 0, '$sec'] };
  const online = new Date(Date.now() - config.onlineMinutes * 60e3);

  const [agg] = await d.collection('usage_daily').aggregate([{ $match: m }, { $facet: {
    totals: [{ $group: { _id: null, sec: { $sum: '$sec' }, lesson: { $sum: lessonOnly }, devices: { $addToSet: '$deviceId' }, days: { $addToSet: '$date' }, first: { $min: '$date' }, last: { $max: '$date' } } }],
    perDay: [{ $group: { _id: '$date', sec: { $sum: '$sec' }, lesson: { $sum: lessonOnly }, devices: { $addToSet: '$deviceId' } } }],
    byClass: [{ $match: { page: { $ne: 'dash' } } }, { $group: { _id: '$cls', sec: { $sum: '$sec' }, devices: { $addToSet: '$deviceId' }, pages: { $addToSet: '$page' } } }],
    byChapter: [{ $match: { page: { $ne: 'dash' } } }, { $group: { _id: '$page', sec: { $sum: '$sec' }, devices: { $addToSet: '$deviceId' }, cls: { $first: '$cls' }, chapter: { $first: '$chapter' } } }, { $sort: { sec: -1 } }],
    perDevice: [{ $group: { _id: '$deviceId', sec: { $sum: '$sec' }, lesson: { $sum: lessonOnly }, days: { $addToSet: '$date' } } }],
    byPlatform: [{ $group: { _id: '$platform', sec: { $sum: '$sec' } } }, { $sort: { sec: -1 } }],
  } }]).toArray();

  const [sessions, covered, opens] = await Promise.all([
    d.collection('sessions').aggregate([{ $match: { school, start: { $gte: f.from + 'T00:00:00', $lte: f.to + 'T23:59:59.999Z' }, ...(f.cls ? { cls: f.cls } : {}) } },
      { $group: { _id: '$cls', n: { $sum: 1 } } }]).toArray(),
    d.collection('chapters').aggregate([{ $match: { school, sec: { $gt: 0 } } }, { $group: { _id: '$cls', pages: { $addToSet: '$page' }, sec: { $sum: '$sec' } } }]).toArray(),
    d.collection('chapters').aggregate([{ $match: { school } }, { $group: { _id: '$page', opens: { $sum: '$opens' } } }]).toArray(),
  ]);

  const t = agg.totals[0] || { sec: 0, lesson: 0, devices: [], days: [] };
  const perDev = new Map(agg.perDevice.map((x) => [x._id, x]));
  const opensBy = new Map(opens.map((x) => [x._id, x.opens]));
  const sessBy = new Map(sessions.map((x) => [x._id, x.n]));
  const covBy = new Map(covered.map((x) => [x._id, x]));
  const nDays = Math.max(1, t.days.length);

  return {
    school, range: { from: f.from, to: f.to },
    kpis: {
      totalHours: hours(t.sec), lessonHours: hours(t.lesson), screens: devs.filter((x) => !x.revoked).length, activeScreens: t.devices.length,
      onlineNow: devs.filter((x) => !x.revoked && x.lastSeen && x.lastSeen >= online).length, activeDays: t.days.length,
      sessions: sessions.reduce((a, x) => a + x.n, 0),
      avgMinutesPerScreenPerDay: t.devices.length ? Math.round((t.sec / 60) / (t.devices.length * nDays) * 10) / 10 : 0,
      firstActive: t.first || null, lastActive: t.last || null,
      accessEnds: devs.map((x) => x.expiry).filter(Boolean).sort().slice(-1)[0] || null,
    },
    daily: series(f.from, f.to, agg.perDay, (r) => ({ hours: r ? hours(r.sec) : 0, lessonHours: r ? hours(r.lesson) : 0, screens: r ? r.devices.length : 0 })),
    // curriculum progress: how many of the class's chapters the school has opened at least once (all time), plus this period's time
    byClass: [6, 7, 8, 9, 10].map((c) => { const r = agg.byClass.find((x) => x._id === c), cv = covBy.get(c); return {
      cls: c, hours: r ? hours(r.sec) : 0, screens: r ? r.devices.length : 0, sessions: sessBy.get(c) || 0,
      chaptersUsed: cv ? cv.pages.length : 0, chaptersTotal: CHAPTER_COUNTS[c], allTimeHours: cv ? hours(cv.sec) : 0 }; }),
    byPlatform: agg.byPlatform.map((x) => ({ platform: x._id, hours: hours(x.sec) })),
    chapters: agg.byChapter.slice(0, 40).map((r) => ({ page: r._id, cls: r.cls, chapter: r.chapter, hours: hours(r.sec), screens: r.devices.length, opens: opensBy.get(r._id) || 0 })),
    screens: devs.map((x) => { const u = perDev.get(x._id); return { id: x._id, label: x.label, platform: x.platform, kind: x.kind, section: x.section, classes: x.classes,
      status: statusOf(x), lastSeen: x.lastSeen, expiry: x.expiry, hours: u ? hours(u.sec) : 0, lessonHours: u ? hours(u.lesson) : 0, activeDays: u ? u.days.length : 0 }; })
      .sort((a, b) => b.hours - a.hours),
  };
}

module.exports = { overview, schools, schoolDetail, devices, deviceDetail, chapters, exportRows, filters, today, addDays, CHAPTER_COUNTS };
