'use strict';
/**
 * The lessons. A chapter page is only sent to a signed-in student whose plan includes that chapter; everything else under /learn/
 * (shared scripts, fonts, icons) is ordinary public files. Chapter pages are lightly changed on the way out: the old tracking script
 * is removed and our own small one (/js/chapter.js, progress + "mark as done") is added.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const auth = require('../auth');
const db = require('../db');
const ent = require('../entitlements');
const catalog = require('../catalog');

const router = express.Router();
router.use(auth.loadUser);

const CH_RE = /^\/Class - (6|7|8|9|10)\/Chapter - (\d{1,2})\/index\.html$/;
const pages = new Map();                                    // prepared chapter pages (a few MB at most)

function prepare(file, c, n) {
  const key = file;
  if (pages.has(key)) return pages.get(key);
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<script[^>]*activity-tracker[^>]*>\s*<\/script>/gi, '');
  const add = `<script>window.__BL=${JSON.stringify({ cls: c, chapter: n })};</script><script src="/js/chapter.js" defer></script>`;
  html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, () => add + '</body>') : html + add;
  html = html.replace(/<head[^>]*>/i, (h) => h + '<meta name="robots" content="noindex,nofollow">');
  pages.set(key, html);
  return html;
}

router.get('*', async (req, res, next) => {
  let p;
  try { p = decodeURIComponent(req.path); } catch (e) { return res.status(400).end(); }

  if (p === '/' || p === '/index.html') {                   // the lesson pages' "back" button points here
    const c = Number(req.query.openClass);
    return res.redirect('/app' + ([6, 7, 8, 9, 10].includes(c) ? `#/class/${c}` : ''));
  }
  const m = CH_RE.exec(p);
  if (!m) return next();

  const c = Number(m[1]), n = Number(m[2]);
  if (!catalog.has(c, n)) return res.status(404).send('Chapter not found.');
  if (!req.user) return res.redirect('/login.html?next=' + encodeURIComponent(req.originalUrl));
  if (!ent.allows(await ent.active(req.user._id), c, n)) return res.redirect(`/app#/plans?need=${c}/${n}`);

  db.get().collection('progress').updateOne({ _id: `${req.user._id}|${c}/${n}` },
    { $inc: { opens: 1 }, $set: { lastAt: new Date() }, $setOnInsert: { userId: String(req.user._id), cls: c, chapter: n, sec: 0, firstAt: new Date(), done: false } }, { upsert: true }).catch(() => {});
  const file = path.join(catalog.CONTENT, `Class - ${c}`, `Chapter - ${n}`, 'index.html');
  res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }).type('html').send(prepare(file, c, n));
});

// shared files used by every lesson
router.use('/nav', express.static(path.join(catalog.CONTENT, 'nav'), { maxAge: '1h', index: false, dotfiles: 'deny' }));
router.use('/vendor', express.static(path.join(catalog.CONTENT, 'vendor'), { maxAge: '7d', index: false, dotfiles: 'deny' }));
router.use((req, res) => res.status(404).send('Not found.'));

module.exports = router;
