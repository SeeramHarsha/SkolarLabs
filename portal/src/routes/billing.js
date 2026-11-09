'use strict';
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../auth');
const db = require('../db');
const config = require('../config');
const plans = require('../plans');
const pay = require('../payments');
const ent = require('../entitlements');
const { cls, wrap, CLASSES } = require('../lib');

const orders = () => db.get().collection('orders');

/** A payment is confirmed exactly once: the order flips to "paid" atomically, and only the call that flips it grants access. */
async function markPaid(orderId, paymentId) {
  const o = await orders().findOneAndUpdate({ _id: orderId, status: { $ne: 'paid' } }, { $set: { status: 'paid', paymentId: String(paymentId || ''), paidAt: new Date() } }, { returnDocument: 'after' });
  if (!o) return { already: true };
  await ent.grant({ userId: o.userId, source: 'purchase', planId: o.planId, orderId: o._id, classes: o.grant.classes, days: o.grant.days });
  return { granted: true, order: o };
}

const publicOrder = (o) => ({ id: o._id, planName: o.planName, cls: o.cls || null, amountInr: o.amountPaise / 100, status: o.status, createdAt: o.createdAt, paidAt: o.paidAt || null, paymentId: o.paymentId || '' });

// ---------------------------------------------------------------- Razorpay webhook (a backup way for "paid" to reach us if the browser closes early)
const webhook = express.Router();
webhook.post('/billing/webhook', express.raw({ type: '*/*', limit: '200kb' }), wrap(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  if (!pay.verifyWebhook(raw, req.get('x-razorpay-signature'))) return res.status(400).json({ error: 'bad signature' });
  let ev; try { ev = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'bad body' }); }
  const p = ev && ev.payload && ev.payload.payment && ev.payload.payment.entity;
  if ((ev.event === 'payment.captured' || ev.event === 'order.paid') && p && p.order_id) {
    const o = await orders().findOne({ providerOrderId: p.order_id });
    if (o && p.amount === o.amountPaise && p.currency === o.currency) await markPaid(o._id, p.id);
  }
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- the student's side
const router = express.Router();
router.use(auth.loadUser, auth.requireUser);
const checkoutLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => String(req.user._id), message: { error: 'Too many checkout attempts. Please try again later.' } });

router.post('/checkout', checkoutLimit, wrap(async (req, res) => {
  if (config.paymentMode === 'off') return res.status(503).json({ error: 'Online payments are not switched on yet. Please contact support.' });
  const plan = await plans.get(req.body && req.body.planId);
  if (!plan || !plan.active || !(plan.priceInr > 0)) return res.status(400).json({ error: 'That plan is not available.' });
  let classes, c = null;
  if (plan.scope === 'one-class') { c = cls(req.body.cls); if (!c) return res.status(400).json({ error: 'Please choose which class this plan is for.' }); classes = [c]; }
  else classes = [...CLASSES];
  const amountPaise = Math.round(plan.priceInr * 100);
  const id = crypto.randomUUID();
  let o;
  try { o = await pay.createOrder({ amountPaise, receipt: id, notes: { user: String(req.user._id), plan: plan._id } }); }
  catch (e) { return res.status(502).json({ error: e.code === 'PAYMENTS_OFF' ? 'Online payments are not switched on yet.' : 'We could not start the payment. Please try again.' }); }
  await orders().insertOne({ _id: id, userId: String(req.user._id), planId: plan._id, planName: plan.name, cls: c, amountPaise, currency: 'INR', status: 'created', provider: o.provider, providerOrderId: o.providerOrderId,
    grant: { classes, days: plan.durationDays }, createdAt: new Date() });
  res.status(201).json({ orderId: id, provider: o.provider, providerOrderId: o.providerOrderId, amountPaise, currency: 'INR', keyId: o.provider === 'razorpay' ? config.razorpayKeyId : undefined,
    description: `${plan.name}${c ? ' - Class ' + c : ''}`, prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone || undefined } });
}));

/** Razorpay Checkout finished in the browser: trust it only after checking the signature */
router.post('/verify', wrap(async (req, res) => {
  const b = req.body || {};
  const o = await orders().findOne({ _id: String(b.orderId || ''), userId: String(req.user._id) });
  if (!o || o.provider !== 'razorpay') return res.status(404).json({ error: 'Order not found.' });
  if (b.razorpay_order_id !== o.providerOrderId || !pay.verifyPayment(o.providerOrderId, b.razorpay_payment_id, b.razorpay_signature)) {
    await orders().updateOne({ _id: o._id, status: 'created' }, { $set: { status: 'failed' } });
    return res.status(400).json({ error: 'The payment could not be confirmed. If money was taken, it will be matched automatically or refunded; please contact support.' });
  }
  await markPaid(o._id, b.razorpay_payment_id);
  res.json({ ok: true });
}));

/** the fake checkout (demo mode only) */
router.post('/demo-pay', wrap(async (req, res) => {
  if (config.paymentMode !== 'demo') return res.status(404).json({ error: 'Not found.' });
  const o = await orders().findOne({ _id: String((req.body && req.body.orderId) || ''), userId: String(req.user._id), provider: 'demo' });
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  await markPaid(o._id, 'demo_' + crypto.randomBytes(6).toString('hex'));
  res.json({ ok: true });
}));

router.get('/orders', wrap(async (req, res) => {
  const list = await orders().find({ userId: String(req.user._id), status: { $in: ['paid', 'failed', 'created'] } }).sort({ createdAt: -1 }).limit(50).toArray();
  res.json({ orders: list.map(publicOrder) });
}));

module.exports = { router, webhook, markPaid, publicOrder };
