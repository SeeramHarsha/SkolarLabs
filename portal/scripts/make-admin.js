'use strict';
/**
 * Create an admin login from a terminal (or reset one):
 *   MONGODB_URI="mongodb+srv://..." node scripts/make-admin.js you@botclublabs.com "a long password"
 */
const config = require('../src/config');
const db = require('../src/db');
const auth = require('../src/auth');
const { cleanEmail, isEmail } = require('../src/lib');

(async () => {
  const email = cleanEmail(process.argv[2]), password = process.argv[3];
  if (!isEmail(email) || !auth.strongEnough(password)) { console.error('Usage: node scripts/make-admin.js <email> "<password, 8+ characters>"'); process.exit(1); }
  await db.connect(config.mongoUri, config.dbName);
  const passwordHash = await auth.hash(password);
  const r = await auth.users().updateOne({ email }, { $set: { role: 'admin', passwordHash, disabled: false }, $setOnInsert: { name: 'Admin', cls: null, school: '', phone: '', consentAt: null, createdAt: new Date(), failedLogins: 0, lockUntil: null } }, { upsert: true, collation: { locale: 'en', strength: 2 } });
  console.log(r.upsertedCount ? 'Admin created: ' + email : 'Existing account is now an admin with the new password: ' + email);
  await db.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
