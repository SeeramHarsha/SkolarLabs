'use strict';
const config = require('./config');

let transport = null;
const outbox = [];                         // used by tests and by the local demo (mail is never sent there)

/** Sends an e-mail. With no SMTP_URL: in development the mail is only kept in memory / printed; in production it fails clearly. */
async function send({ to, subject, text }) {
  if (config.smtpUrl && config.mailFrom) {
    if (!transport) transport = require('nodemailer').createTransport(config.smtpUrl);
    await transport.sendMail({ from: config.mailFrom, to, subject, text });
    return { sent: true };
  }
  if (config.production) { const e = new Error('E-mail is not configured (SMTP_URL and MAIL_FROM).'); e.code = 'EMAIL_NOT_CONFIGURED'; throw e; }
  outbox.push({ to, subject, text, at: new Date() });
  console.log(`[mail not sent - development] to ${to}: ${subject}\n${text}`);
  return { sent: false };
}

module.exports = { send, outbox };
