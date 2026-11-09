'use strict';
const express = require('express');
const config = require('../config');
const plans = require('../plans');
const catalog = require('../catalog');
const { wrap } = require('../lib');

const router = express.Router();

router.get('/plans', wrap(async (req, res) => res.json({ plans: (await plans.list()).map(plans.pub), trialChapters: config.trialChapters })));

router.get('/config', (req, res) => {
  const cat = catalog.load();
  res.json({
    brand: config.brand, paymentMode: config.paymentMode, razorpayKeyId: config.paymentMode === 'razorpay' ? config.razorpayKeyId : '', supportEmail: config.supportEmail,
    totalChapters: catalog.total(), classes: Object.fromEntries(Object.entries(cat.classes).map(([c, l]) => [c, l.length])),
  });
});

module.exports = router;
