'use strict';
/** The lessons: which classes and chapters exist and what they are called. Built from content/ by scripts/build-content.js. */
const fs = require('fs');
const path = require('path');

const CONTENT = process.env.CONTENT_DIR ? path.resolve(process.env.CONTENT_DIR) : path.join(__dirname, '..', 'content');

let cache = null;
function load() {
  if (cache) return cache;
  let titles = {};
  try { titles = JSON.parse(fs.readFileSync(path.join(CONTENT, 'titles.json'), 'utf8')); } catch (e) { /* no content yet */ }
  const classes = {};
  for (const c of [6, 7, 8, 9, 10]) {
    const dir = path.join(CONTENT, `Class - ${c}`);
    let chapters = [];
    try { chapters = fs.readdirSync(dir).map((d) => /^Chapter - (\d+)$/.exec(d)).filter(Boolean).map((m) => Number(m[1])).filter((n) => fs.existsSync(path.join(dir, `Chapter - ${n}`, 'index.html'))).sort((a, b) => a - b); } catch (e) { /* none */ }
    classes[c] = chapters.map((n) => ({ chapter: n, title: (titles[c] && titles[c][n]) || `Chapter ${n}` }));
  }
  cache = { classes, dir: CONTENT };
  return cache;
}
const has = (c, n) => !!load().classes[c] && load().classes[c].some((x) => x.chapter === n);
const total = () => Object.values(load().classes).reduce((a, l) => a + l.length, 0);
const reset = () => { cache = null; };

module.exports = { load, has, total, reset, CONTENT };
