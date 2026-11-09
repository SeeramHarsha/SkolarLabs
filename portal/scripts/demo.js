'use strict';
/**
 * Try the portal on your own computer, no MongoDB install needed:   npm run demo   then open http://localhost:8095
 * It starts a temporary MongoDB and FAKE payments (nobody is charged). Everything is thrown away when you stop it.
 * Admin login for the demo: admin@demo.local / demo-admin-password. DEMO ONLY: never use these settings on the internet.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  Object.assign(process.env, { MONGODB_URI: mongod.getUri(), MONGODB_DB: 'portal_demo', JWT_SECRET: 'demo-only-secret-demo-only-secret-123', PAYMENT_MODE: 'demo',
    ADMIN_EMAIL: 'admin@demo.local', ADMIN_PASSWORD: 'demo-admin-password', PORT: process.env.PORT || '8095' });
  const server = await require('../src/server').start();
  await server.ready;
  console.log(`\nDemo ready:  http://localhost:${process.env.PORT}   (admin: admin@demo.local / demo-admin-password, payments are FAKE)\nCtrl+C to stop`);
  const stop = async () => { await mongod.stop(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch((e) => { console.error(e); process.exit(1); });
