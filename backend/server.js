require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'https://mybills.in', 'https://mybeeznus-billing.web.app', 'https://mybeeznus.web.app'],
  credentials: true
}));
app.use(express.json());

// Payment routes only - all data is in Firestore
app.use('/api/payments', require('./src/routes/payments'));

// MyBeezNus backend library routes (Supabase-backed, service-role)
app.use('/api/numbers', require('./src/routes/numbers'));
app.use('/api/webhooks', require('./src/routes/webhooks'));
app.use('/api/reports', require('./src/routes/reports'));

app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'MyBills.in API running' }));

app.listen(PORT, () => console.log(`MyBills.in backend running on port ${PORT}`));
