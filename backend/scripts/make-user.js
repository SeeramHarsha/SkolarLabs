'use strict';
/**
 * Create a dashboard login from the command line (also the way to get the first admin when you don't use ADMIN_EMAIL):
 *   MONGODB_URI="mongodb+srv://..." node scripts/make-user.js admin@school.org "a long password" admin
 *   node scripts/make-user.js teacher@school.org "a long password" viewer "Sunrise Public School" "Green Valley School"
 * Viewers only see the schools listed after the role.
 */
const config = require('../src/config');
const db = require('../src/db');
const auth = require('../src/auth');

(async () => {
  const [email, password, role = 'viewer', ...schools] = process.argv.slice(2);
  if (!email || !password) { console.error('Usage: node scripts/make-user.js <email> <password> [admin|viewer] [school ...]'); process.exit(1); }
  await db.connect(config.mongoUri, config.dbName);
  try { console.log('Created:', JSON.stringify(await auth.createUser(email, password, role, schools))); }
  catch (e) { console.error(e.code === 11000 ? 'That email already has a login.' : e.message); process.exitCode = 1; }
  await db.close();
})();
