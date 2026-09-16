require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes (Supabase-backed — all tenant data lives in Supabase)
app.use('/api/payments', require('./src/routes/payments'));
app.use('/api/numbers', require('./src/routes/numbers'));
app.use('/api/webhooks', require('./src/routes/webhooks'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/account', require('./src/routes/account'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'MyBills API is running' });
});

// Serve static files from React build (Production)
const buildPath = path.join(__dirname, '../frontend/build');
app.use(express.static(buildPath));

// All other routes serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`
  ========================================
  MyBills Application
  ========================================
  Server running on: http://localhost:${PORT}
  Environment: Production
  Data store: Supabase
  ========================================
  `);
});
