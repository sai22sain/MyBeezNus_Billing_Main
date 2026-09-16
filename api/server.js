// Vercel serverless function: handles all /api/* requests via rewrite in vercel.json.
// Delegates to the Express app in backend/server.js (service-role Supabase,
// payments, webhooks, reports). No app logic lives here.
const app = require('../backend/server');

module.exports = app;
