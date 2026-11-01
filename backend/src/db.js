'use strict';
const { MongoClient } = require('mongodb');

let client = null;
let db = null;

/**
 * Collections
 *   devices      one per installed screen/phone:  { _id: deviceId, school, label, platform, appVersion, kind, section, classes, expiry,
 *                                                   tokenHash, registeredAt, lastSeen, revoked }
 *   usage_daily  active seconds per device, day and page: { _id: "device|date|page", deviceId, school, platform, date, page, cls, chapter, sec }
 *                page is "8/2" (class 8, chapter 2) or "dash" (the dashboard / menus)
 *   chapters     all-time totals per device and chapter:  { _id: "device|page", deviceId, school, page, cls, chapter, sec, opens, first, last }
 *   sessions     one per "who is learning" choice:         { _id: "device|start", deviceId, school, start, end, cls, section, sec }
 *   users        dashboard logins:                         { _id: email, passwordHash, role: 'admin'|'viewer', schools: [], createdAt }
 */
async function connect(uri, dbName) {
  client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(dbName);
  await Promise.all([
    db.collection('devices').createIndexes([{ key: { school: 1 } }, { key: { lastSeen: -1 } }, { key: { platform: 1 } }]),
    db.collection('usage_daily').createIndexes([
      { key: { date: 1, school: 1 } }, { key: { deviceId: 1, date: 1 } }, { key: { date: 1, cls: 1 } }, { key: { page: 1, date: 1 } }]),
    db.collection('chapters').createIndexes([{ key: { deviceId: 1 } }, { key: { page: 1 } }]),
    db.collection('sessions').createIndexes([{ key: { deviceId: 1, start: -1 } }, { key: { start: -1 } }]),
  ]);
  return db;
}

const get = () => { if (!db) throw new Error('database not connected'); return db; };
const close = async () => { if (client) await client.close(); client = null; db = null; };
const ping = async () => { await get().command({ ping: 1 }); };

module.exports = { connect, get, close, ping };
