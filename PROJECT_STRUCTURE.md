# MyBeezNus Business Billing Project Structure

```
mybeeznus-business-billing/
│
├── backend/                          # Backend Node.js application
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # SQLite database configuration
│   │   ├── controllers/
│   │   │   ├── customerController.js # Customer CRUD operations
│   │   │   ├── itemController.js     # Services/Products management
│   │   │   ├── billController.js     # Billing operations
│   │   │   └── reportController.js   # Reports and analytics
│   │   ├── routes/
│   │   │   ├── customers.js          # Customer routes
│   │   │   ├── items.js              # Items/Services routes
│   │   │   ├── bills.js              # Billing routes
│   │   │   └── reports.js            # Reports routes
│   │   ├── models/                   # (Database models - SQLite uses direct queries)
│   │   └── utils/
│   │       ├── whatsapp.js           # WhatsApp Cloud API integration
│   │       └── pdfGenerator.js       # PDF bill generation
│   ├── bills/                        # Generated PDF bills (auto-created)
│   ├── package.json                  # Backend dependencies
│   ├── .env                          # Environment configuration
│   ├── server.js                     # Development server
│   ├── server.production.js          # Production server (serves frontend)
│   ├── seed.js                       # Sample data seeder
│   └── package.json                  # Backend dependencies and scripts
│
├── frontend/                         # React frontend application
│   ├── public/
│   │   └── index.html               # HTML template
│   ├── src/
│   │   ├── components/              # Reusable React components (future)
│   │   ├── pages/
│   │   │   ├── Dashboard.js         # Dashboard page
│   │   │   ├── NewBill.js           # Billing page
│   │   │   ├── Customers.js         # Customer management page
│   │   │   ├── Services.js          # Services management page
│   │   │   ├── Reports.js           # Reports and analytics page
│   │   │   └── Settings.js          # Settings page
│   │   ├── utils/
│   │   │   └── api.js               # API client for backend
│   │   ├── App.js                   # Main app component with routing
│   │   ├── App.css                  # Application styles
│   │   └── index.js                 # React entry point
│   ├── package.json                 # Frontend dependencies
│   └── build/                       # Production build (created by npm run build)
│
├── .gitignore                       # Git ignore file
├── README.md                        # Complete documentation
├── SETUP_GUIDE.md                   # Quick setup guide
├── start.bat                        # Development startup script (Windows)
└── build-and-run.bat               # Production build script (Windows)
```

## Key Files Explained

### Backend Files

**server.js**
- Development server
- Runs API on port 5000
- Hot reload with nodemon

**server.production.js**
- Production server
- Serves both API and frontend build
- Single port deployment

**database.js**
- SQLite database initialization
- Creates tables on first run
- Seeds default categories

**Controllers**
- Handle business logic
- Process requests
- Return responses

**Routes**
- Define API endpoints
- Map URLs to controllers

**whatsapp.js**
- WhatsApp Cloud API integration
- Send messages and documents
- Upload media files

**pdfGenerator.js**
- Generate PDF bills
- Format bill layout
- Include business branding

### Frontend Files

**App.js**
- Main application component
- React Router setup
- Navigation sidebar

**Pages**
- Individual page components
- Handle UI and user interactions
- Call API functions

**api.js**
- Axios configuration
- API endpoint definitions
- Centralized API calls

**App.css**
- Global styles
- Responsive design
- Tablet-optimized layout

## Database Tables

1. **customers** - Customer information
2. **categories** - Service categories
3. **items** - Services and products
4. **bills** - Bill headers
5. **bill_items** - Bill line items

## API Endpoints Summary

- `/api/customers/*` - Customer operations
- `/api/items/*` - Services/Products operations
- `/api/bills/*` - Billing operations
- `/api/reports/*` - Analytics and reports

## Scripts

**Development:**
- `start.bat` - Start both backend and frontend in dev mode

**Production:**
- `build-and-run.bat` - Build frontend and run production server

**Seeding:**
- `node backend/seed.js` - Add sample services

## Environment Variables

Required in `backend/.env`:
- PORT
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- WHATSAPP_API_URL
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_ACCESS_TOKEN
- BUSINESS_NAME
- BUSINESS_ADDRESS
- BUSINESS_PHONE
