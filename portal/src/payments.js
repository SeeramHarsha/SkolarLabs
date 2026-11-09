'use strict';
/**
 * Payments.
 *   razorpay  real payments: the server creates the order (the amount comes from OUR plan price, never from the browser), the browser
 *             opens Razorpay Checkout, and the result is trusted only after the signature is verified here (and by the webhook).
 *   demo      a fake checkout for trying the whole flow without money. Never switched on by itself in production.
 */
const crypto = require('crypto');
const config = require('./config');

const API = 'https://api.razorpay.com/v1';
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

async function createOrder({ amountPaise, receipt, notes }) {
  if (config.paymentMode === 'demo') return { provider: 'demo', providerOrderId: 'demo_' + crypto.randomBytes(8).toString('hex') };
  if (config.paymentMode !== 'razorpay') { const e = new Error('Payments are not switched on.'); e.code = 'PAYMENTS_OFF'; throw e; }
  const r = await fetch(API + '/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64') },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: String(receipt).slice(0, 40), notes }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) { console.error('razorpay order failed', r.status, JSON.stringify(j).slice(0, 300)); const e = new Error('The payment provider did not accept the order.'); e.code = 'PROVIDER'; throw e; }
  return { provider: 'razorpay', providerOrderId: j.id };
}

/** Razorpay Checkout success: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret) */
function verifyPayment(providerOrderId, paymentId, signature) {
  if (!config.razorpayKeySecret || !paymentId || !signature) return false;
  return same(hmac(config.razorpayKeySecret, `${providerOrderId}|${paymentId}`), signature);
}

/** Razorpay webhook: signature = HMAC_SHA256(raw body, webhook secret) */
function verifyWebhook(rawBody, signature) {
  if (!config.razorpayWebhookSecret || !signature) return false;
  return same(hmac(config.razorpayWebhookSecret, rawBody), signature);
}

module.exports = { createOrder, verifyPayment, verifyWebhook, hmac };
