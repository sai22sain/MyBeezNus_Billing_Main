const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/tenant');
const { createOrder, verifyPayment } = require('../controllers/paymentController');

router.post('/create-order', requireAuth, createOrder);
router.post('/verify-payment', requireAuth, verifyPayment);

module.exports = router;
