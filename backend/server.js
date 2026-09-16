require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'https://mybeeznus.in'
].filter(Boolean).map((origin) => origin.replace(/\/$/, ''));

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Payment routes
app.use('/api/payments', require('./src/routes/payments'));

// MyBeezNus backend library routes (Supabase-backed, service-role)
app.use('/api/numbers', require('./src/routes/numbers'));
app.use('/api/webhooks', require('./src/routes/webhooks'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/account', require('./src/routes/account'));

// Support tickets (customers raise concerns from any MyBeezNus app)
app.use('/api/support', require('./src/routes/support'));

app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'MyBeezNus.in API running' }));

// Only start an HTTP server when run directly (node server.js).
// On Vercel this file is loaded as a serverless function — Vercel invokes
// `app` as a request handler itself, so listen() must be skipped there.
if (require.main === module) {
  app.listen(PORT, () => console.log(`MyBeezNus.in backend running on port ${PORT}`));
}

module.exports = app;
