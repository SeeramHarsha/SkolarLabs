'use strict';
/**
 * Copies the lessons into portal/content/ so they ship inside the container:
 *   node scripts/build-content.js [--from <folder with Class - 6 ... Class - 10, nav, vendor>] [--site <learning site's index.html>]
 * The default source is the offline copy of the learning site that the Botclub Labs apps are built from (activity-app/www,
 * made by `npm run build:www` in that project). Also writes content/titles.json (chapter names).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const FROM = path.resolve(arg('--from', 'C:/Users/seera/Downloads/activity/activity/activity-app/www'));
const SITE = path.resolve(arg('--site', path.join(FROM, '..', '..', 'index.html')));
const OUT = path.join(__dirname, '..', 'content');

if (!fs.existsSync(path.join(FROM, 'Class - 8'))) { console.error('Cannot find the lessons in ' + FROM + '. Pass --from <folder>.'); process.exit(1); }
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let files = 0, bytes = 0;
function copy(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); }
    else if (!/\.(map|md)$/i.test(e.name)) { fs.copyFileSync(s, d); files++; bytes += fs.statSync(s).size; }
  }
}
for (const c of [6, 7, 8, 9, 10]) { const s = path.join(FROM, `Class - ${c}`); if (fs.existsSync(s)) { fs.mkdirSync(path.join(OUT, `Class - ${c}`)); copy(s, path.join(OUT, `Class - ${c}`)); } }
for (const d of ['nav', 'vendor']) if (fs.existsSync(path.join(FROM, d))) { fs.mkdirSync(path.join(OUT, d)); copy(path.join(FROM, d), path.join(OUT, d)); }
// the apps' own lock/usage scripts are of no use on the web
for (const f of fs.readdirSync(path.join(OUT, 'nav'))) if (/^android-|^lock-aware|^usage-panel/.test(f)) fs.rmSync(path.join(OUT, 'nav', f));

// chapter names: the `const chapterTitles = { ... }` block of the learning site's index.html
let titles = {};
if (fs.existsSync(SITE)) {
  const html = fs.readFileSync(SITE, 'utf8'), i = html.indexOf('const chapterTitles'), start = html.indexOf('{', i);
  let depth = 0, end = start;
  for (let k = start; k < html.length; k++) { if (html[k] === '{') depth++; else if (html[k] === '}' && --depth === 0) { end = k; break; } }
  titles = vm.runInNewContext('(' + html.slice(start, end + 1) + ')', {}, { timeout: 1000 });
} else console.warn('learning site index.html not found: chapter names will show as numbers');
fs.writeFileSync(path.join(OUT, 'titles.json'), JSON.stringify(titles));
console.log(`content ready: ${files} files, ${(bytes / 1048576).toFixed(1)} MB, titles for classes ${Object.keys(titles).join(', ')}`);
