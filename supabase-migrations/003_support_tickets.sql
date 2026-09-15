-- Support tickets: customers raise concerns from any MyBeezNus app; admin reviews in the CRM dashboard.
-- (Applied to production via MCP on 2026-09-15; kept here for the migration record.)
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app text not null default 'billing',
  category text not null default 'other' check (category in ('bug','feature','billing','account','other')),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 5 and 4000),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "Users can view own tickets" on public.support_tickets;
create policy "Users can view own tickets"
  on public.support_tickets for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own tickets" on public.support_tickets;
create policy "Users can create own tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

-- Status/admin_reply are admin-managed (service role bypasses RLS); users cannot edit rows.