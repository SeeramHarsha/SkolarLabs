'use strict';
// End-to-end check against a real (temporary) MongoDB:  npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod, server, base, cookie = '';

before(async () => {
  mongod = await MongoMemoryServer.create();
  Object.assign(process.env, { MONGODB_URI: mongod.getUri(), MONGODB_DB: 'test', JWT_SECRET: 'x'.repeat(40), ENROLL_KEY: 'enroll-secret', ADMIN_EMAIL: 'admin@test.org', ADMIN_PASSWORD: 'correct horse battery', PORT: '0', FRONTEND_ORIGINS: 'https://dash.example.org' });
  const { start } = require('../src/server');
  server = await start();
  await server.ready;
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { server.close(); await require('../src/db').close(); await mongod.stop(); });

const call = async (path, { method = 'GET', body, headers = {}, auth = true } = {}) => {
  const r = await fetch(base + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(auth && cookie ? { authorization: 'Bearer ' + cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) { /* csv */ }
  return { status: r.status, json, text, headers: r.headers };
};
const today = new Date().toISOString().slice(0, 10);
const payload = (sec) => ({ device: { school: 'Test School', label: 'Smart class 8B', platform: 'android', appVersion: '2.1.0', kind: 'classroom', section: 'B', classes: [8], expiry: '2099-01-01' },
  days: { [today]: { sec: sec + 30, pages: { '8/2': sec, dash: 30 } } }, chapters: { '8/2': { sec, opens: 2, first: new Date().toISOString(), last: new Date().toISOString() } },
  sessions: [{ start: '2026-10-13T08:00:00.000Z', end: '2026-10-13T08:20:00.000Z', cls: 8, section: 'B', sec }] });

let dev;
test('health and sign in', async () => {
  assert.equal((await call('/status')).status, 200);
  assert.equal((await call('/api/overview', { auth: false })).status, 401);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'admin@test.org', password: 'wrong password!!' } })).status, 401);
  const r = await call('/api/auth/login', { method: 'POST', body: { email: 'admin@test.org', password: 'correct horse battery' } });
  assert.equal(r.status, 200);
  cookie = r.json.token; assert.ok(r.json.token.split('.').length === 3);     // a signed token (named `cookie` below only to keep this file small)
  assert.equal((await call('/api/auth/me', { auth: false })).status, 401);
  assert.equal((await call('/api/auth/me', { headers: { authorization: 'Bearer not.a.token-at-all-xxxxxxxxxx' }, auth: false })).status, 401);
  assert.equal((await call('/api/auth/me')).json.user.role, 'admin');
});

test('device registration needs the enrollment key', async () => {
  assert.equal((await call('/api/v1/devices/register', { method: 'POST', body: payload(1).device, auth: false })).status, 401);
  assert.equal((await call('/api/v1/devices/register', { method: 'POST', body: payload(1).device, headers: { 'x-enroll-key': 'nope' }, auth: false })).status, 401);
  const r = await call('/api/v1/devices/register', { method: 'POST', body: payload(1).device, headers: { 'x-enroll-key': 'enroll-secret' }, auth: false });
  assert.equal(r.status, 201); dev = r.json;
  assert.match(dev.deviceId, /^[0-9a-f-]{36}$/); assert.match(dev.token, /^[0-9a-f]{64}$/);
});

test('ingest is protected, validated and never double counts', async () => {
  const bad = await call('/api/v1/ingest', { method: 'POST', body: payload(100), auth: false });
  assert.equal(bad.status, 401);
  assert.equal((await call('/api/v1/ingest', { method: 'POST', body: payload(100), headers: { authorization: `Bearer ${dev.deviceId}.${'0'.repeat(64)}` }, auth: false })).status, 401);
  const H = { authorization: `Bearer ${dev.deviceId}.${dev.token}` };
  assert.equal((await call('/api/v1/ingest', { method: 'POST', body: payload(600), headers: H, auth: false })).status, 200);
  assert.equal((await call('/api/v1/ingest', { method: 'POST', body: payload(600), headers: H, auth: false })).status, 200);   // same data again
  let o = (await call(`/api/overview?from=${today}&to=${today}`)).json;
  assert.equal(o.kpis.lessonHours, 0.17);                                                                                         // 600 s once, not twice
  assert.equal(o.kpis.activeDevices, 1);
  assert.equal((await call('/api/v1/ingest', { method: 'POST', body: payload(900), headers: H, auth: false })).status, 200);   // device grew to 900 s
  o = (await call(`/api/overview?from=${today}&to=${today}`)).json;
  assert.equal(o.kpis.lessonHours, 0.25);
  assert.equal(o.byClass.find((c) => c.cls === 8).hours, 0.25);
  // junk is ignored, not stored
  const junk = payload(60); junk.days['2026-13-45'] = { pages: { '8/2': 99999 } }; junk.days[today].pages['99/99'] = 5000; junk.days[today].pages['8/2'] = 7e9;
  assert.equal((await call('/api/v1/ingest', { method: 'POST', body: junk, headers: H, auth: false })).status, 200);
  o = (await call(`/api/overview?from=${today}&to=${today}`)).json;
  assert.ok(o.kpis.lessonHours <= 24.01);
});

test('numbers for schools, screens, chapters and CSV', async () => {
  assert.equal((await call('/api/schools')).json.schools[0].school, 'Test School');
  const d = (await call('/api/devices')).json.devices[0]; assert.equal(d.status, 'online'); assert.equal(d.label, 'Smart class 8B');
  const det = await call(`/api/devices/${d.id}`); assert.equal(det.status, 200); assert.equal(det.json.sessions.length, 1);
  assert.equal((await call('/api/devices/not-a-real-id')).status, 404);
  assert.equal((await call('/api/chapters')).json.chapters[0].page, '8/2');
  const csv = await call('/api/export.csv'); assert.equal(csv.status, 200); assert.match(csv.text, /date,school,screen/);
});

test('a viewer limited to other schools sees nothing; revoked screens are cut off; logins are safe', async () => {
  assert.equal((await call('/api/users', { method: 'POST', body: { email: 'v@test.org', password: 'short' } })).status, 400);
  assert.equal((await call('/api/users', { method: 'POST', body: { email: 'v@test.org', password: 'a long viewer password', role: 'viewer', schools: ['Other School'] } })).status, 201);
  const own = cookie;
  const r = await call('/api/auth/login', { method: 'POST', body: { email: 'v@test.org', password: 'a long viewer password' }, auth: false });
  cookie = r.json.token;
  assert.equal((await call('/api/schools')).json.schools.length, 0);
  assert.equal((await call(`/api/overview?school=Test%20School`)).json.kpis.activeDevices === undefined, true);
  assert.equal((await call('/api/users')).status, 403);
  assert.equal((await call(`/api/devices/${dev.deviceId}`)).status, 404);
  cookie = own;
  assert.equal((await call(`/api/devices/${dev.deviceId}/revoke`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await call('/api/v1/ingest', { method: 'POST', body: payload(5), headers: { authorization: `Bearer ${dev.deviceId}.${dev.token}` }, auth: false })).status, 401);
  assert.equal((await call('/api/users/admin@test.org', { method: 'DELETE' })).status, 400);            // can't delete yourself / the last admin
});

test('one school = one combined progress, however many screens it has', async () => {
  const reg = async (school, label) => (await call('/api/v1/devices/register', { method: 'POST', headers: { 'x-enroll-key': 'enroll-secret' }, auth: false,
    body: { school, label, platform: 'windows', kind: 'classroom', classes: [8], section: 'A', expiry: '2099-01-01' } })).json;
  const a = await reg('Combined School', 'Smart class 8A'), b = await reg('  combined   SCHOOL ', 'Smart class 6B');      // different spelling, same school
  const send = (dv, pages, chapters) => call('/api/v1/ingest', { method: 'POST', auth: false, headers: { authorization: `Bearer ${dv.deviceId}.${dv.token}` },
    body: { days: { [today]: { sec: Object.values(pages).reduce((x, y) => x + y, 0), pages } }, chapters, sessions: [] } });
  const ch = (sec) => ({ sec, opens: 1, first: new Date().toISOString(), last: new Date().toISOString() });
  assert.equal((await send(a, { '8/2': 1800, '8/3': 1800, dash: 600 }, { '8/2': ch(1800), '8/3': ch(1800) })).status, 200);
  assert.equal((await send(b, { '6/1': 3600, '8/2': 1800 }, { '6/1': ch(3600), '8/2': ch(1800) })).status, 200);

  const list = (await call(`/api/schools?from=${today}&to=${today}`)).json.schools.filter((s) => /combined/i.test(s.school));
  assert.equal(list.length, 1);                                    // ONE school, not two
  assert.equal(list[0].school, 'Combined School'); assert.equal(list[0].devices, 2);

  const r = await call(`/api/schools/${encodeURIComponent('combined school')}?from=${today}&to=${today}`);   // any capitalisation finds it
  assert.equal(r.status, 200);
  const d = r.json;
  assert.equal(d.school, 'Combined School');
  assert.equal(d.kpis.totalHours, 2.67); assert.equal(d.kpis.lessonHours, 2.5);                                // (4200 + 5400) s = 9600 s all pages; lessons only = 9000 s
  assert.equal(d.kpis.screens, 2); assert.equal(d.kpis.activeScreens, 2);
  assert.equal(d.screens.length, 2);
  const c8 = d.byClass.find((c) => c.cls === 8), c6 = d.byClass.find((c) => c.cls === 6);
  assert.equal(c8.hours, 1.5); assert.equal(c8.chaptersUsed, 2); assert.equal(c8.chaptersTotal, 13);          // chapters 8/2 and 8/3 counted once each
  assert.equal(c6.chaptersUsed, 1);
  const top = d.chapters.find((x) => x.page === '8/2'); assert.equal(top.screens, 2); assert.equal(top.hours, 1);   // both screens used 8/2: 1 h together
  assert.equal((await call('/api/schools/Nope%20School')).status, 404);
});

test('browsers: only the dashboard\x27s own address may call the dashboard API; apps may call the device API from anywhere', async () => {
  const pre = (path, origin) => fetch(base + path, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' } });
  let r = await pre('/api/overview', 'https://dash.example.org');
  assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), 'https://dash.example.org');
  r = await pre('/api/overview', 'https://evil.example.net');
  assert.equal(r.headers.get('access-control-allow-origin'), null);                                   // not allowed: the browser blocks it
  r = await pre('/api/v1/ingest', 'https://localhost');                                          // an Android app
  assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/does-not-exist')).status, 404);
});

test('a misconfigured or database-less server still starts and listens (Cloud Run needs that) and says what is wrong', async () => {
  const { spawn } = require('node:child_process'), path = require('node:path');
  const run = async (env, port) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], { env: { PATH: process.env.PATH, NODE_ENV: 'production', PORT: String(port), READY_WAIT_MS: '500', ...env }, stdio: 'ignore' });
    try {
      let r = null;
      for (let i = 0; i < 40 && !r; i++) { try { r = await fetch('http://127.0.0.1:' + port + '/status'); } catch (e) { await new Promise((x) => setTimeout(x, 250)); } }
      assert.ok(r, 'the server must be listening');
      return { status: r.status, body: await r.json(), api: await fetch('http://127.0.0.1:' + port + '/api/overview') };
    } finally { child.kill(); }
  };
  let r = await run({}, 18771);                                                       // nothing configured at all
  assert.equal(r.status, 503); assert.match(r.body.problem, /MONGODB_URI is not set/); assert.equal(r.api.status, 503);
  r = await run({ MONGODB_URI: 'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500', JWT_SECRET: 'j'.repeat(40) }, 18772);   // database unreachable
  assert.equal(r.status, 503); assert.match(r.body.problem, /Cannot reach the database|Starting up/);
});

test('the first request after a cold start waits for the database instead of failing', async () => {
  const { state } = require('../src/server');
  state.ready = false;                                                    // pretend the server has just woken up
  setTimeout(() => { state.ready = true; }, 700);                         // ...and the database connects a moment later
  const t0 = Date.now();
  const r = await fetch(base + '/api/auth/me');
  assert.equal(r.status, 401);                                            // it reached the real handler (not a 503 "not ready")
  assert.ok(Date.now() - t0 >= 500, 'the request was held until the database was ready');
  assert.equal(state.ready, true);
});
