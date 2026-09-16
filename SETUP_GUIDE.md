# MyBeezNus Business Billing Setup

## Step 1: Install Dependencies

### Backend:
```bash
cd backend
npm install
```

### Frontend:
```bash
cd frontend
npm install
```

## Step 2: Configure WhatsApp Cloud API

1. Visit https://developers.facebook.com/
2. Create a new app or use existing app
3. Add WhatsApp product
4. Get your credentials:
   - Phone Number ID
   - Access Token (generate permanent token)

5. Update `backend/.env` file:
```
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_access_token_here
BUSINESS_NAME=Your Business Name
BUSINESS_ADDRESS=Your Address
BUSINESS_PHONE=Your Phone
```

## Step 3: Seed Sample Data (Optional)

```bash
cd backend
node seed.js
```

This will add sample items to get you started when the optional seed script is available.

## Step 4: Start the Application

### Option A: Using the start script (Windows)
Double-click `start.bat` in the root folder

### Option B: Manual start

Terminal 1 (Backend):
```bash
cd backend
npm start
```

Terminal 2 (Frontend):
```bash
cd frontend
npm start
```

## Step 5: Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## First Time Usage

1. **Add Items**: Go to Items and add the products or services your business provides
2. **Add Customers**: Go to Customers page and add customer details
3. **Create Bill**: Go to New Bill page to create your first bill
4. **View Reports**: Check Dashboard and Reports for analytics

## Testing WhatsApp Integration

1. Make sure your WhatsApp credentials are configured
2. Create a test bill
3. The system will automatically send the bill to customer's WhatsApp
4. Check the customer's WhatsApp for the PDF bill

## Troubleshooting

### Port Already in Use
If port 5000 or 3000 is already in use:
- Change PORT in backend/.env
- Update API_BASE_URL in frontend/src/utils/api.js

### WhatsApp Not Sending
- Verify credentials in .env
- Check phone number format (+919876543210)
- Ensure internet connection
- Check Meta Business Manager for API limits

### Database Issues
- Check the Supabase URL, service-role key, migrations, and Row Level Security policies
- Confirm the backend is running with `npm --prefix backend start`

## Production Deployment

For ChromeOS/Chromebook:
1. Build frontend: `cd frontend && npm run build`
2. Copy build folder to backend
3. Update backend to serve static files
4. Run: `cd backend && npm start`

## Support

Check README.md for detailed documentation and API endpoints.
