'use strict';
const db = require('./db');

/**
 * The plans on sale. These are only the STARTING plans created the first time the server runs: prices are placeholders.
 * Change them (price, length, text, on/off) in the admin area, under Plans. They are stored in MongoDB.
 */
const DEFAULT_PLANS = [
  { _id: 'class-year', name: 'One Class', tagline: 'Everything for one class, for a year', priceInr: 999, durationDays: 365, scope: 'one-class', badge: '',
    features: ['All chapters of the class you choose', 'Every simulation, unlimited use', 'Progress tracking and streaks', 'Works on phone, tablet and computer'], active: true, sort: 1 },
  { _id: 'all-year', name: 'All Classes', tagline: 'Classes 6 to 10, for a year', priceInr: 2999, durationDays: 365, scope: 'all-classes', badge: 'Best value',
    features: ['All 5 classes (6, 7, 8, 9, 10)', 'Every chapter, every simulation', 'Switch classes any time', 'Progress tracking and streaks'], active: true, sort: 2 },
];

async function seed() {
  const plans = db.get().collection('plans');
  if (await plans.estimatedDocumentCount() === 0) await plans.insertMany(DEFAULT_PLANS);
}
const list = async ({ onlyActive = true } = {}) => db.get().collection('plans').find(onlyActive ? { active: true } : {}).sort({ sort: 1, priceInr: 1 }).toArray();
const get = (id) => db.get().collection('plans').findOne({ _id: String(id) });
const pub = (p) => ({ id: p._id, name: p.name, tagline: p.tagline, priceInr: p.priceInr, durationDays: p.durationDays, scope: p.scope, badge: p.badge || '', features: p.features || [] });

module.exports = { DEFAULT_PLANS, seed, list, get, pub };
