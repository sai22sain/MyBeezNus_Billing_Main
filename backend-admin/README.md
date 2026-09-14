# Salon Admin Dashboard

Standalone, local-first admin dashboard for the **MyBeezNus / salon-app** project.
It talks to Supabase with the **service-role key** (which bypasses RLS), so when you
host it publicly set `ADMIN_TOKEN` — see *Protecting the public URL* below.

## What it does

| Section | Description |
|---------|-------------|
| **Stats** | Totals for users, onboarded salons, bills, customers, items, categories + all-time / today / this-month revenue |
| **Deletion requests** | Pending user-initiated account-deletion requests — approve (deletes everything) or reject |
| **Users** | Every registered account with per-user data counts, searchable, with a direct delete button |
| **Recently deleted** | Audit log of accounts the admin permanently removed |

> The legacy single-tenant SQLite DB (`backend/salon.db`) was migrated to Supabase
> with `tools/migrate-sqlite-to-supabase.js` (verified by `tools/verify-migration.js`)
> and then deleted. A backup copy lives in `backend/backups/`.

When a user clicks **Request deletion** in the main app's Settings page, a row is
inserted into `public.delete_requests` with `status = 'pending'`. It shows up here.

## 1. Database setup (required, one time)

Apply these migrations in **Supabase Dashboard → SQL Editor**:

1. `supabase-migrations/001_create_delete_requests_table.sql`
2. `supabase-migrations/002_create_deleted_accounts_log.sql`

## 2. Environment

Copy `.env.example` to `.env` and fill in the values:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
PORT=3001
BACKEND_BASE_SQLITE_DB=c:/salon-app/backend/salon.db
```

* `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Project Settings → API →
  `service_role`. **Never** put this in frontend code.
* `BACKEND_BASE_SQLITE_DB` — optional, only used by the one-off migration tools in
  `tools/` to locate the legacy `salon.db` (a backup copy is in `backend/backups/`).

## 3. Run locally

```bash
cd backend-admin
npm install
npm start
# open http://localhost:3001
```

## 4. Deploy on Render

1. Push this `backend-admin/` folder to its own GitHub repo.
2. Render Dashboard → **New → Web Service** → connect that repo.
3. Settings:
   * **Runtime**: Node
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
   * **Environment Variables**:
     * `SUPABASE_URL`
     * `SUPABASE_SERVICE_ROLE_KEY`
     (do **not** set `PORT` — Render injects it)
4. Deploy. The dashboard is then reachable at the Render URL.

> ⚠️ There is currently **no authentication**. Anyone with the URL can read and
> delete every account. Keep it local, or put it behind Render's password
> protection / a private network before sharing the link.
>
> The admin token (`ADMIN_TOKEN`) protects the dashboard when hosted publicly.
>
> The migration tools in `tools/` are kept for reference; they need the backed-up
> `salon.db` (point `BACKEND_BASE_SQLITE_DB` at it) to run again.

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/health` | Liveness probe |
| GET | `/api/admin/snapshot` | Everything the dashboard needs in one round trip |
| GET | `/api/admin/stats` | Totals + revenue |
| GET | `/api/admin/users` | All users with per-user counts |
| GET | `/api/admin/requests` | Deletion requests (pending first) |
| GET | `/api/admin/deleted` | Audit log of deleted accounts |
| POST | `/api/admin/requests/:id/approve` | Delete that user + mark request approved |
| POST | `/api/admin/requests/:id/reject` | Mark request rejected |
| POST | `/api/admin/users/:uid/delete` | Delete a user directly |

## Files

```
backend-admin/
  server.js            Express server + Supabase service-role access
  public/index.html    Dashboard markup + styles
  public/app.js        Dashboard logic (vanilla JS)
  .env                 Local secrets (gitignored)
  .env.example         Template
  README.md            This file
```