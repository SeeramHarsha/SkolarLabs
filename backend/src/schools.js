'use strict';
/**
 * One school = one name. People type the same school in different ways ("Sunrise  School", "sunrise school ", "SunriseSchool", "Sunrise-School"),
 * which used to show up as several schools. Two names are the same school when they match after dropping capitals, spaces and punctuation.
 */
const db = require('./db');

/** the comparison key: capitals, spaces and punctuation do not matter */
const key = (name) => String(name == null ? '' : name).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
/** the name as shown: no stray or double spaces */
const tidy = (name) => String(name == null ? '' : name).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();

/** every school name stored for the screens, with how many screens use each spelling */
async function spellings() {
  return db.get().collection('devices').aggregate([{ $group: { _id: '$school', screens: { $sum: 1 }, first: { $min: '$registeredAt' } } }]).toArray();
}

/** the name to use for 'name': the spelling already in use (most screens, then oldest), or the tidied name when it is new */
async function canonical(name) {
  const clean = tidy(name), k = key(clean);
  if (!k) return clean;
  const same = (await spellings()).filter((s) => key(s._id) === k);
  if (!same.length) return clean;
  same.sort((a, b) => b.screens - a.screens || new Date(a.first) - new Date(b.first));
  return tidy(same[0]._id) || clean;
}

/**
 * Joins schools that were already stored under different spellings: every screen, usage record, chapter record and session
 * moves to the main spelling, and viewer logins are updated. Safe to run again; does nothing when there is nothing to join.
 */
async function mergeAll() {
  const d = db.get(), groups = new Map();
  for (const s of await spellings()) { const k = key(s._id); if (!k) continue; (groups.get(k) || groups.set(k, []).get(k)).push(s); }
  const merged = [];
  for (const list of groups.values()) {
    list.sort((a, b) => b.screens - a.screens || new Date(a.first) - new Date(b.first));
    const main = tidy(list[0]._id);
    const others = list.map((x) => x._id).filter((n) => n !== main);
    if (!others.length) continue;
    for (const c of ['devices', 'usage_daily', 'chapters', 'sessions']) await d.collection(c).updateMany({ school: { $in: others } }, { $set: { school: main } });
    for (const u of await d.collection('users').find({ schools: { $in: others } }).toArray()) {
      await d.collection('users').updateOne({ _id: u._id }, { $set: { schools: [...new Set(u.schools.map((n) => (others.includes(n) ? main : n)))] } });
    }
    merged.push({ main, joined: others });
  }
  return merged;
}

module.exports = { key, tidy, canonical, mergeAll };
