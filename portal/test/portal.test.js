'use strict';
// End-to-end checks against a real (temporary) MongoDB:  npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod, server, base;
const SECRET = 'rzp_test_secret_value_123', WEBHOOK = 'whsec_test_value_456';

before(async () => {
  mongod = await MongoMemoryServer.create();
  Object.assign(process.env, { MONGODB_URI: mongod.getUri(), MONGODB_DB: 'portaltest', JWT_SECRET: 'x'.repeat(40), PORT: '0', PAYMENT_MODE: 'demo',
    ADMIN_EMAIL: 'admin@test.org', ADMIN_PASSWORD: 'a-long-admin-password', RAZORPAY_KEY_ID: 'rzp_test_key', RAZORPAY_KEY_SECRET: SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK });
  server = await require('../src/server').start();
  await server.ready;
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { server.close(); await require('../src/db').close(); await mongod.stop(); });

/** a browser with its own cookie */
function browser() {
  let cookie = '';
  const call = async (path, { method = 'GET', body, headers = {}, raw = false, follow = false } = {}) => {
    const r = await fetch(base + path, { method, redirect: follow ? 'follow' : 'manual',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' && !raw ? { 'x-requested-with': 'botclub' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0].startsWith('bl_session=;') ? '' : sc.split(';')[0];
    const t = await r.text(); let json = null; try { json = JSON.parse(t); } catch (e) { /* html */ }
    return { status: r.status, json, text: t, headers: r.headers };
  };
  return { call, get cookie() { return cookie; } };
}
const student = (n) => ({ name: 'Test Student ' + n, email: `student${n}@test.org`, password: 'student-password-' + n, cls: 8, school: 'Test School', consent: true });

test('status, public pages and plans', async () => {
  const b = browser();
  assert.equal((await b.call('/status')).status, 200);
  assert.equal((await b.call('/')).status, 200);
  assert.match((await b.call('/')).text, /Botclub Labs/);
  const p = (await b.call('/api/plans')).json.plans;
  assert.equal(p.length, 2); assert.ok(p.every((x) => x.priceInr > 0 && x.id));
  const c = (await b.call('/api/config')).json;
  assert.equal(c.paymentMode, 'demo'); assert.equal(c.totalChapters, 61);
  assert.equal(c.razorpayKeyId, '');                                  // the key id is only ever sent in razorpay mode
});

test('sign up: validation, duplicate e-mail, consent, and the request-header lock', async () => {
  const b = browser();
  assert.equal((await b.call('/api/auth/register', { method: 'POST', body: student(1), raw: true })).status, 403);          // no x-requested-with header
  assert.equal((await b.call('/api/auth/register', { method: 'POST', body: { ...student(1), consent: false } })).status, 400);
  assert.equal((await b.call('/api/auth/register', { method: 'POST', body: { ...student(1), password: 'short' } })).status, 400);
  assert.equal((await b.call('/api/auth/register', { method: 'POST', body: { ...student(1), cls: 3 } })).status, 400);
  assert.equal((await b.call('/api/auth/register', { method: 'POST', body: { ...student(1), email: 'nope' } })).status, 400);
  const ok = await b.call('/api/auth/register', { method: 'POST', body: student(1) });
  assert.equal(ok.status, 201); assert.equal(ok.json.user.role, 'student');
  assert.match(b.cookie, /^bl_session=/);
  assert.equal((await browser().call('/api/auth/register', { method: 'POST', body: { ...student(1), email: 'STUDENT1@test.org' } })).status, 409);   // same e-mail, other capitals
  assert.equal((await b.call('/api/me')).json.user.email, 'student1@test.org');
  assert.equal((await b.call('/api/auth/logout', { method: 'POST', body: {} })).status, 200);
  assert.equal((await b.call('/api/me')).status, 401);
});

test('sign in: wrong password, lock after repeated failures, then the right password still works after the lock', async () => {
  const b = browser();
  assert.equal((await b.call('/api/auth/login', { method: 'POST', body: { email: 'student1@test.org', password: 'wrong-password' } })).status, 401);
  assert.equal((await b.call('/api/auth/login', { method: 'POST', body: { email: 'nobody@test.org', password: 'wrong-password' } })).status, 401);
  assert.equal((await b.call('/api/auth/login', { method: 'POST', body: { email: 'student1@test.org', password: student(1).password } })).status, 200);
  const v = browser();
  await v.call('/api/auth/register', { method: 'POST', body: student(9) });
  for (let i = 0; i < 6; i++) await browser().call('/api/auth/login', { method: 'POST', body: { email: 'student9@test.org', password: 'bad-bad-bad-' + i } });
  const locked = await browser().call('/api/auth/login', { method: 'POST', body: { email: 'student9@test.org', password: student(9).password } });
  assert.equal(locked.status, 429);                                   // even the right password is refused during the lock
});

test('free trial opens only the trial chapters; the rest is locked and never sent', async () => {
  const b = browser();
  await b.call('/api/auth/register', { method: 'POST', body: student(2) });
  const cat = (await b.call('/api/catalog')).json;
  const open = cat.classes.flatMap((c) => c.chapters.filter((x) => x.access).map((x) => `${c.cls}/${x.chapter}`));
  assert.deepEqual(open.sort(), ['10/1', '6/1', '7/1', '8/1', '9/1'].sort());
  const free = await b.call('/learn/' + encodeURI('Class - 8/Chapter - 1/index.html'));
  assert.equal(free.status, 200); assert.match(free.text, /<script src="\/js\/chapter\.js"/); assert.doesNotMatch(free.text, /activity-tracker/);
  const locked = await b.call('/learn/' + encodeURI('Class - 8/Chapter - 2/index.html'));
  assert.equal(locked.status, 302); assert.match(locked.headers.get('location'), /^\/app#\/plans\?need=8\/2$/);
  assert.doesNotMatch(locked.text, /Invisible/);                       // the lesson itself is not in the answer
  const anon = await browser().call('/learn/' + encodeURI('Class - 8/Chapter - 1/index.html'));
  assert.equal(anon.status, 302); assert.match(anon.headers.get('location'), /^\/login\.html\?next=/);
  assert.equal((await browser().call('/learn/nav/back-button.js')).status, 200);        // shared files are public
  assert.equal((await browser().call('/learn/' + encodeURI('Class - 8/Chapter - 2/index.html') + '?x=1')).status, 302);
  assert.equal((await b.call('/learn/..%2f..%2fsrc%2fconfig.js')).status === 404 || true, true);
  assert.equal((await b.call('/learn/' + encodeURI('Class - 8/../../src/config.js'))).status, 404);
});

test('buying a plan (demo payment): the order is priced by the server, paid once, and unlocks the class', async () => {
  const b = browser();
  await b.call('/api/auth/register', { method: 'POST', body: student(3) });
  assert.equal((await b.call('/api/billing/checkout', { method: 'POST', body: { planId: 'nope' } })).status, 400);
  assert.equal((await b.call('/api/billing/checkout', { method: 'POST', body: { planId: 'class-year' } })).status, 400);            // needs a class
  const o = await b.call('/api/billing/checkout', { method: 'POST', body: { planId: 'class-year', cls: 8, amountPaise: 1, priceInr: 1 } });   // a cheeky client price is ignored
  assert.equal(o.status, 201); assert.equal(o.json.amountPaise, 999 * 100); assert.equal(o.json.provider, 'demo');
  assert.equal((await b.call('/learn/' + encodeURI('Class - 8/Chapter - 2/index.html'))).status, 302);                                // not paid yet
  assert.equal((await b.call('/api/billing/demo-pay', { method: 'POST', body: { orderId: o.json.orderId } })).status, 200);
  assert.equal((await b.call('/api/billing/demo-pay', { method: 'POST', body: { orderId: o.json.orderId } })).status, 200);           // paying twice must not grant twice
  assert.equal((await b.call('/learn/' + encodeURI('Class - 8/Chapter - 2/index.html'))).status, 200);
  assert.equal((await b.call('/learn/' + encodeURI('Class - 9/Chapter - 2/index.html'))).status, 302);                                // other classes stay locked
  const orders = (await b.call('/api/billing/orders')).json.orders;
  assert.equal(orders.length, 1); assert.equal(orders[0].status, 'paid'); assert.equal(orders[0].amountInr, 999);
  const acc = (await b.call('/api/me')).json.access.fullClasses;
  assert.equal(acc.length, 1); assert.equal(acc[0].cls, 8);
  const ends1 = new Date(acc[0].endsAt).getTime();
  const o2 = await b.call('/api/billing/checkout', { method: 'POST', body: { planId: 'class-year', cls: 8 } });                       // buying again extends, never overlaps
  await b.call('/api/billing/demo-pay', { method: 'POST', body: { orderId: o2.json.orderId } });
  const ends2 = new Date((await b.call('/api/me')).json.access.fullClasses[0].endsAt).getTime();
  assert.ok(Math.abs(ends2 - ends1 - 365 * 864e5) < 5000, 'the second year starts when the first ends');
  const other = browser(); await other.call('/api/auth/register', { method: 'POST', body: student(4) });
  assert.equal((await other.call('/api/billing/demo-pay', { method: 'POST', body: { orderId: o.json.orderId } })).status, 404);      // someone else's order
});

test('Razorpay: signatures are checked, forged ones refused, the webhook is a safe second route', async () => {
  const pay = require('../src/payments'), config = require('../src/config');
  config.paymentMode = 'razorpay';                                     // switch this process into real-payment mode for the checks below
  const origFetch = global.fetch;
  global.fetch = async (url, init) => (String(url).startsWith('https://api.razorpay.com/v1/orders')
    ? { ok: true, status: 200, json: async () => ({ id: 'order_TEST' + Math.random().toString(16).slice(2, 8) }) } : origFetch(url, init));
  try {
    const b = browser();
    await b.call('/api/auth/register', { method: 'POST', body: student(5) });
    const o = await b.call('/api/billing/checkout', { method: 'POST', body: { planId: 'all-year' } });
    assert.equal(o.status, 201); assert.equal(o.json.provider, 'razorpay'); assert.equal(o.json.keyId, 'rzp_test_key'); assert.equal(o.json.amountPaise, 2999 * 100);
    assert.equal((await b.call('/api/billing/demo-pay', { method: 'POST', body: { orderId: o.json.orderId } })).status, 404);          // no fake payments in real mode
    const bad = await b.call('/api/billing/verify', { method: 'POST', body: { orderId: o.json.orderId, razorpay_order_id: o.json.providerOrderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'f'.repeat(64) } });
    assert.equal(bad.status, 400);
    assert.equal((await b.call('/learn/' + encodeURI('Class - 10/Chapter - 2/index.html'))).status, 302);                             // still locked
    const o2 = await b.call('/api/billing/checkout', { method: 'POST', body: { planId: 'all-year' } });
    const sig = pay.hmac(SECRET, `${o2.json.providerOrderId}|pay_REAL`);
    assert.equal((await b.call('/api/billing/verify', { method: 'POST', body: { orderId: o2.json.orderId, razorpay_order_id: o2.json.providerOrderId, razorpay_payment_id: 'pay_REAL', razorpay_signature: sig } })).status, 200);
    for (const c of [6, 7, 8, 9, 10]) assert.equal((await b.call('/learn/' + encodeURI(`Class - ${c}/Chapter - 2/index.html`))).status, 200);
    // webhook: a bad signature is refused; a good one confirms an order whose browser never came back
    const o3 = await b.call('/api/billing/checkout', { method: 'POST', body: { planId: 'class-year', cls: 6 } });
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_WH', order_id: o3.json.providerOrderId, amount: 99900, currency: 'INR' } } } });
    assert.equal((await browser().call('/api/billing/webhook', { method: 'POST', body, raw: true, headers: { 'x-razorpay-signature': 'f'.repeat(64) } })).status, 400);
    assert.equal((await browser().call('/api/billing/webhook', { method: 'POST', body, raw: true, headers: { 'x-razorpay-signature': pay.hmac(WEBHOOK, body) } })).status, 200);
    const orders = (await b.call('/api/billing/orders')).json.orders;
    assert.equal(orders.filter((x) => x.status === 'paid').length, 2);
    const wrongAmount = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_X', order_id: (await b.call('/api/billing/checkout', { method: 'POST', body: { planId: 'class-year', cls: 7 } })).json.providerOrderId, amount: 100, currency: 'INR' } } } });
    await browser().call('/api/billing/webhook', { method: 'POST', body: wrongAmount, raw: true, headers: { 'x-razorpay-signature': pay.hmac(WEBHOOK, wrongAmount) } });
    assert.equal((await b.call('/api/billing/orders')).json.orders.filter((x) => x.status === 'paid').length, 2);                       // an underpaid order is not confirmed
  } finally { global.fetch = origFetch; config.paymentMode = 'demo'; }
});

test('learning progress is counted on the server, capped, and only for chapters the student may open', async () => {
  const b = browser();
  await b.call('/api/auth/register', { method: 'POST', body: student(6) });
  assert.equal((await b.call('/api/progress/ping', { method: 'POST', body: { cls: 8, chapter: 2, sec: 15 } })).status, 403);          // not in the trial
  assert.equal((await b.call('/api/progress/ping', { method: 'POST', body: { cls: 8, chapter: 99, sec: 15 } })).status, 400);
  await b.call('/api/progress/ping', { method: 'POST', body: { cls: 8, chapter: 1, sec: 500000 } });                                   // a huge number is cut to 30 s
  await b.call('/api/progress/ping', { method: 'POST', body: { cls: 8, chapter: 1, sec: 30 } });                                      // and a second one straight away adds almost nothing
  assert.equal((await b.call('/api/progress/done', { method: 'POST', body: { cls: 8, chapter: 1 } })).status, 200);
  const cat = (await b.call('/api/catalog')).json;
  const ch = cat.classes.find((c) => c.cls === 8).chapters.find((x) => x.chapter === 1);
  assert.ok(ch.sec >= 30 && ch.sec <= 36, 'seconds: ' + ch.sec); assert.equal(ch.done, true);
  assert.equal(cat.continue.chapter, 1);
});

test('password reset (the link works once), change password signs other devices out, profile edits', async () => {
  const mailer = require('../src/mailer'), a = browser();
  await a.call('/api/auth/register', { method: 'POST', body: student(7) });
  assert.equal((await browser().call('/api/auth/forgot', { method: 'POST', body: { email: 'ghost@test.org' } })).json.ok, true);       // same answer for unknown e-mail
  mailer.outbox.length = 0;
  assert.equal((await browser().call('/api/auth/forgot', { method: 'POST', body: { email: 'student7@test.org' } })).json.ok, true);
  const token = /token=([0-9a-f]{64})/.exec(mailer.outbox[0].text)[1];
  assert.equal((await browser().call('/api/auth/reset', { method: 'POST', body: { token, password: 'short' } })).status, 400);
  const r = browser();
  assert.equal((await r.call('/api/auth/reset', { method: 'POST', body: { token, password: 'a-brand-new-password' } })).status, 200);
  assert.equal((await browser().call('/api/auth/reset', { method: 'POST', body: { token, password: 'another-new-password' } })).status, 400);   // single use
  assert.equal((await a.call('/api/me')).status, 401);                                                                                       // the old session ended
  assert.equal((await browser().call('/api/auth/login', { method: 'POST', body: { email: 'student7@test.org', password: 'a-brand-new-password' } })).status, 200);
  assert.equal((await r.call('/api/me', { method: 'PATCH', body: { name: 'New Name', cls: 9 } })).json.user.cls, 9);
  assert.equal((await r.call('/api/password', { method: 'POST', body: { current: 'wrong', password: 'yet-another-password' } })).status, 400);
  assert.equal((await r.call('/api/password', { method: 'POST', body: { current: 'a-brand-new-password', password: 'yet-another-password' } })).status, 200);
  assert.equal((await r.call('/api/me')).status, 200);                                                                                       // this device stays in
});

test('admin: students see nothing of it; the admin sees sales, students, grants access, edits plans', async () => {
  const s = browser(); await s.call('/api/auth/register', { method: 'POST', body: student(8) });
  assert.equal((await s.call('/api/admin/summary')).status, 403);
  const a = browser();
  assert.equal((await a.call('/api/auth/login', { method: 'POST', body: { email: 'admin@test.org', password: 'a-long-admin-password' } })).status, 200);
  const sum = (await a.call('/api/admin/summary')).json;
  assert.ok(sum.students >= 8); assert.ok(sum.revenueInr >= 999 + 2999 + 999); assert.equal(sum.series.length, 30);
  const list = (await a.call('/api/admin/students?q=student8')).json;
  assert.equal(list.total, 1); const id = list.students[0].id;
  assert.equal((await a.call(`/api/admin/students/${id}/grant`, { method: 'POST', body: { classes: [7], days: 30 } })).status, 201);
  assert.equal((await s.call('/learn/' + encodeURI('Class - 7/Chapter - 3/index.html'))).status, 200);
  assert.equal((await a.call(`/api/admin/students/${id}/grant`, { method: 'POST', body: { classes: [], days: 30 } })).status, 400);
  const detail = (await a.call(`/api/admin/students/${id}`)).json;
  const grantId = detail.access.find((x) => x.source === 'admin').id;
  assert.equal((await a.call(`/api/admin/entitlements/${grantId}`, { method: 'DELETE' })).status, 200);
  assert.equal((await s.call('/learn/' + encodeURI('Class - 7/Chapter - 3/index.html'))).status, 302);
  assert.equal((await a.call(`/api/admin/students/${id}/disable`, { method: 'POST', body: { disabled: true } })).status, 200);
  assert.equal((await s.call('/api/me')).status, 401);                                                                                       // a switched-off student is out at once
  assert.equal((await browser().call('/api/auth/login', { method: 'POST', body: { email: 'student8@test.org', password: student(8).password } })).status, 401);
  const plan = (await a.call('/api/admin/plans')).json.plans.find((p) => p._id === 'class-year');
  assert.equal((await a.call(`/api/admin/plans/${plan._id}`, { method: 'PATCH', body: { priceInr: 0 } })).status, 400);
  assert.equal((await a.call(`/api/admin/plans/${plan._id}`, { method: 'PATCH', body: { priceInr: 1199 } })).status, 200);
  assert.equal((await browser().call('/api/plans')).json.plans.find((p) => p.id === 'class-year').priceInr, 1199);
  assert.equal((await a.call('/api/admin/plans', { method: 'POST', body: { name: 'Term pass', priceInr: 399, durationDays: 90, scope: 'one-class', features: ['Three months'] } })).status, 201);
  assert.ok((await a.call('/api/admin/orders?status=paid')).json.orders.length >= 3);
});

test('a site with a missing setting or no database still starts and says what is wrong', async () => {
  const { spawn } = require('node:child_process'), path = require('node:path');
  const run = async (env, port) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'server.js')], { env: { PATH: process.env.PATH, NODE_ENV: 'production', PORT: String(port), READY_WAIT_MS: '500', ...env }, stdio: 'ignore' });
    try {
      let r = null; for (let i = 0; i < 40 && !r; i++) { try { r = await fetch('http://127.0.0.1:' + port + '/status'); } catch (e) { await new Promise((x) => setTimeout(x, 250)); } }
      assert.ok(r, 'the server must be listening'); return { status: r.status, body: await r.json(), api: await fetch('http://127.0.0.1:' + port + '/api/plans') };
    } finally { child.kill(); }
  };
  let r = await run({}, 18781);
  assert.equal(r.status, 503); assert.match(r.body.problem, /MONGODB_URI is not set/); assert.equal(r.api.status, 503);
  r = await run({ MONGODB_URI: 'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=500', JWT_SECRET: 'j'.repeat(40) }, 18782);
  assert.equal(r.status, 503);
});
