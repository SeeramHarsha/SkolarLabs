'use strict';
const crypto = require('crypto');

const env = process.env;
const production = env.NODE_ENV === 'production';

// A missing required setting must not stop the server from starting (Cloud Run would only say "failed to start and listen on PORT").
// The server starts, answers /status with the problem, and refuses API calls until it is fixed.
const problems = [];
function need(name) {
  if (env[name]) return env[name];
  if (production) problems.push(`${name} is not set`);
  return null;
}
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

// payments: 'razorpay' (real money), 'demo' (fake checkout for testing, never for production) or 'off'
let paymentMode = (env.PAYMENT_MODE || '').toLowerCase();
if (!paymentMode) paymentMode = env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET ? 'razorpay' : production ? 'off' : 'demo';
if (!['razorpay', 'demo', 'off'].includes(paymentMode)) paymentMode = 'off';
if (paymentMode === 'razorpay' && !(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET)) { problems.push('PAYMENT_MODE=razorpay needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET'); paymentMode = 'off'; }

const config = {
  production,
  problems,
  port: env.PORT !== undefined && env.PORT !== '' ? Number(env.PORT) : 8080,
  mongoUri: need('MONGODB_URI') || 'mongodb://127.0.0.1:27017',
  dbName: env.MONGODB_DB || 'botclub_portal',
  jwtSecret: need('JWT_SECRET') || crypto.randomBytes(32).toString('hex'),
  sessionDays: Number(env.SESSION_DAYS) || 14,
  // the public web address of the portal (used in e-mail links), e.g. https://learn.botclublabs.com
  baseUrl: String(env.BASE_URL || '').replace(/\/+$/, ''),
  brand: env.BRAND_NAME || 'Botclub Labs',
  supportEmail: env.SUPPORT_EMAIL || '',
  paymentMode,
  razorpayKeyId: env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',
  // e-mail (password reset, receipts). SMTP_URL like smtps://user:pass@smtp.example.com:465 ; without it, reset e-mails cannot be sent
  smtpUrl: env.SMTP_URL || '',
  mailFrom: env.MAIL_FROM || '',
  // the first admin (created only when there are no admins yet)
  adminEmail: (env.ADMIN_EMAIL || '').trim().toLowerCase() || null,
  adminPassword: env.ADMIN_PASSWORD || null,
  // chapters every registered student can open for free (class/chapter), the free trial
  trialChapters: list(env.TRIAL_CHAPTERS || '6/1,7/1,8/1,9/1,10/1'),
  readyWaitMs: env.READY_WAIT_MS !== undefined ? Number(env.READY_WAIT_MS) : 20000,
};

module.exports = config;
