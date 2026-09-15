const Razorpay = require('razorpay');
const crypto = require('crypto');
const { PLANS, planExpiry } = require('../lib/plans');

// Lazily create the client so a missing key doesn't crash the whole module
// at load time (which would kill the Vercel serverless function cold-start
// with an obscure error instead of a clear 500 response).
let razorpay = null;
const getRazorpay = () => {
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpay;
};

// Create Razorpay order
const createOrder = async (req, res) => {
  try {
    const { plan, userId } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Payment gateway is not configured on the server' });
    }

    // Razorpay receipt max length is 56 chars — use a short, unique receipt
    const receipt = `rcpt_${Date.now()}`.slice(0, 56);

    const order = await getRazorpay().orders.create({
      amount: PLANS[plan].amount,
      currency: PLANS[plan].currency,
      receipt,
      notes: { userId, plan } // userId kept in notes (not length-limited)
    });

    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error('Razorpay order creation failed:', {
      statusCode: error.statusCode,
      error: error.error,
      message: error.message
    });
    res.status(500).json({ error: error.error?.description || error.message || 'Unable to create payment order' });
  }
};

// Verify payment signature and return subscription data
const verifyPayment = (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, userId } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const planData = PLANS[plan];
    const { period, startedAt, expiresAt } = planExpiry(plan);

    res.json({
      success: true,
      subscription: {
        plan: 'pro',
        period,
        startedAt,
        expiresAt,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: planData.amount / 100
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createOrder, verifyPayment };
