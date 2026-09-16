# MyBeezNus Business Billing

MyBeezNus is an easy-to-use, multi-tenant business billing application for small businesses. It provides customer and item management, bill creation, dashboards, reports, subscriptions, account settings, and support tickets. User authentication and tenant data are powered by Supabase.

## Features

### Customer Management
- Auto-generated customer IDs using each business's configured prefix
- Customer profiles with name, mobile, DOB, gender, address, notes
- Search customers by mobile or name
- View customer visit history
- Birthday reminders
## Technology

- **Frontend:** React 18, React Router 6, Create React App, Supabase JavaScript client
- **Backend:** Node.js, Express, Supabase service-role client
- **Database and authentication:** Supabase PostgreSQL and Supabase Auth
- **Payments:** Razorpay
- **Documents and exports:** PDFKit and ExcelJS
- **Messaging:** WhatsApp Cloud API integration
- **Deployment:** Vercel or a Node.js host running the production server

## Requirements

- Node.js 24.x for the frontend, as specified by `frontend/package.json`
- npm
- A Supabase project for authentication and application data
- Google OAuth configured in Supabase Auth for sign-in
- Backend Supabase service-role credentials for privileged API routes

The backend no longer uses SQLite as its active data store. Do not follow older documentation that refers to `salon.db`, SQLite tables, or `backend/seed.js`; those instructions do not describe the current application.

## Project Structure

```text
.
├── api/
│   └── server.js                 # Vercel serverless API entry point
├── backend/
│   ├── server.js                 # Express development/API server
│   ├── server.production.js      # Express server serving frontend/build
│   ├── src/
│   │   ├── controllers/          # Payment and report handlers
│   │   ├── lib/                  # Supabase, tenant, number, and plan helpers
│   │   ├── routes/                # Account, payments, numbers, reports, support, webhooks
│   │   └── utils/                 # PDF, timezone, and WhatsApp utilities
│   └── package.json
├── frontend/
│   ├── public/                   # Static assets and public index.html
│   ├── src/
│   │   ├── components/           # Shared UI and branding components
│   │   ├── context/              # Authentication context
│   │   ├── pages/                # Dashboard, billing, customers, items, reports, etc.
│   │   ├── services/             # Notifications and shared services
│   │   └── utils/                # Supabase, API, caching, validation, and formatting
│   └── package.json
├── supabase-migrations/          # Database schema and policy migrations
├── start.bat                     # Windows development launcher
├── build-and-run.bat             # Windows production build and launcher
├── vercel.json                   # Vercel build and API rewrite configuration
└── package.json                  # Root convenience scripts
```

## Configuration

### Frontend variables

Create `frontend/.env.local` when overriding the built-in Supabase project or when pointing the frontend at a deployed backend:

```dotenv
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_API_URL=http://localhost:5000
```

`REACT_APP_API_URL` may be empty for local development when the backend is not required by a particular workflow. The frontend uses Supabase directly for normal tenant CRUD operations and uses the backend for privileged operations such as number allocation, report export, and account deletion.

The current frontend includes a built-in Supabase project fallback. Set the variables explicitly for a different project or for a controlled deployment.

### Backend variables

Create `backend/.env`:

```dotenv
PORT=5000
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Razorpay payments and webhook verification
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Optional WhatsApp Cloud API and PDF branding
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
BUSINESS_NAME=Your Business Name
BUSINESS_ADDRESS=Your Business Address
BUSINESS_PHONE=Your Contact Number
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, or `WHATSAPP_ACCESS_TOKEN` in frontend code or public environment variables. The older `SALON_NAME`, `SALON_ADDRESS`, and `SALON_PHONE` variables remain supported as compatibility aliases.

## Supabase Setup

1. Create or select a Supabase project.
2. Configure Google under **Authentication > Providers**.
3. Add the local and deployed application URLs under **Authentication > URL Configuration**.
4. Run the SQL files in `supabase-migrations/` in filename order using the Supabase SQL editor or migration tooling.
5. Confirm that Row Level Security policies are enabled for application tables.
6. Set the frontend and backend environment variables described above.

The migrations include account-deletion request/audit tables, support tickets, and billing behavior such as billing without a customer. The application expects Supabase tables including `profiles`, `customers`, `items`, `categories`, `bills`, `sequences`, `subscriptions`, `support_tickets`, and the account-deletion audit tables.

## Installation

From the repository root:

```bash
npm run install-all
```

Or install each package separately:

```bash
npm install --prefix backend
npm install --prefix frontend
```

## Local Development

### Windows shortcut

Run `start.bat`. It installs dependencies if needed and opens separate command windows for the backend and frontend.

### Manual startup

Start the backend in one terminal:

```bash
npm --prefix backend start
```

Start the frontend in a second terminal:

```bash
npm --prefix frontend start
```

Open:

- Frontend: http://localhost:3000
- Backend health check: http://localhost:5000/api/health

The root project does not define an `npm start` script. Use the prefixed commands above or the Windows launcher.

## Available Scripts

### Root scripts

| Command | Purpose |
| --- | --- |
| `npm run install-all` | Install backend and frontend dependencies |
| `npm run dev-backend` | Start the backend |
| `npm run dev-frontend` | Start the React development server |
| `npm run build` | Build the frontend |
| `npm run production` | Start `backend/server.production.js` |

### Frontend scripts

```bash
npm --prefix frontend start
npm --prefix frontend run build
npm --prefix frontend test
```

### Backend scripts

```bash
npm --prefix backend start
npm --prefix backend run dev
```

## Backend API

All backend routes are mounted under `/api`. Routes marked authenticated require a Supabase access token in the form `Authorization: Bearer <token>`.

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/health` | `GET` | Health check |
| `/api/numbers/next-bill` | `POST` | Allocate the next tenant-scoped bill number; authenticated |
| `/api/numbers/next-customer` | `POST` | Allocate the next tenant-scoped customer number; authenticated |
| `/api/reports/export` | `GET` | Download an authenticated tenant's Excel revenue report |
| `/api/account` | `DELETE` | Delete the authenticated account and tenant data |
| `/api/support` | `POST` | Create an authenticated support ticket |
| `/api/support/mine` | `GET` | List the authenticated user's support tickets and ordered comments |
| `/api/support/:ticketId/replies` | `POST` | Add a follow-up comment to the authenticated user's open ticket |
| `/api/payments/create-order` | `POST` | Create a Razorpay order |
| `/api/payments/verify-payment` | `POST` | Verify a Razorpay payment |
| `/api/webhooks/razorpay` | `POST` | Receive and verify Razorpay subscription webhooks |

The legacy report paths `/api/reports/dashboard`, `/daily`, `/monthly`, `/top-services`, and `/repeat-customers` remain registered for compatibility, but the current frontend primarily reads tenant data through Supabase and uses the backend export route for Excel downloads.

## Production

### Vercel

The included `vercel.json`:

- Installs backend and frontend dependencies
- Builds the React frontend into `frontend/build`
- Rewrites `/api/*` requests to `api/server`
- Rewrites other routes to the React application entry point

Configure the frontend and backend environment variables in the Vercel project settings. The Vercel API entry point uses the Express app from `backend/server.js` and does not start a local listener.

### Node.js production server

Build the frontend and start the Express server:

```bash
npm --prefix frontend run build
npm run production
```

The existing Windows shortcut performs the build and starts `backend/server.production.js`:

```text
build-and-run.bat
```

The production server serves the compiled React app and API from one port, defaulting to `http://localhost:5000`.

## Testing and Verification

Run the frontend build before deployment:

```bash
npm --prefix frontend run build
```

Run the frontend test command when changing tested UI behavior:

```bash
npm --prefix frontend test
```

Useful checks:

```bash
curl http://localhost:5000/api/health
```

Verify that Supabase authentication works, a profile can be created during onboarding, and authenticated backend calls include a valid access token.

## Troubleshooting

### `npm start` fails from the repository root

The root package has no `start` script. Use `npm --prefix frontend start`, `npm --prefix backend start`, or run `start.bat` on Windows.

### Authentication does not complete

- Confirm Google is enabled in Supabase Auth.
- Add the exact local or deployed origin to Supabase redirect settings.
- Check `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`.
- Inspect the browser console for Supabase OAuth errors.

### Backend returns `401 Authentication required`

The backend expects `Authorization: Bearer <supabase access token>`. Confirm the user is signed in and that the frontend API URL points to the correct backend.

### Backend reports missing Supabase credentials

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`. The service-role key is server-only and must not be placed in `frontend/.env*`.

### Payment or subscription updates do not arrive

- Confirm the Razorpay key variables are configured.
- Point the Razorpay webhook to `/api/webhooks/razorpay`.
- Set the same webhook secret in Razorpay and `RAZORPAY_WEBHOOK_SECRET`.
- Confirm the webhook signature header is present.

### Report export fails

Confirm the backend is running, the frontend API URL is correct, the user is authenticated, and both `startDate` and `endDate` are supplied in `YYYY-MM-DD` format.

## Security Notes

- Supabase service-role credentials are used only by the backend.
- Backend tenant routes verify the Supabase JWT and scope privileged queries to the authenticated `user_id`.
- Support-ticket comments are stored in `ticket_replies`; users can read and add comments only on their own non-closed tickets.
- Do not commit `.env`, `.env.local`, service-role keys, payment secrets, or WhatsApp access tokens.
- Review and test Supabase Row Level Security policies before production deployment.

## License

This project is distributed under the MIT license as declared by the root package metadata.
