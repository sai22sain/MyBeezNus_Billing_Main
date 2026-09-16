-- Threaded comments for support tickets. Existing admin_reply remains supported for legacy tickets.
create table if not exists public.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null default 'user' check (sender in ('user', 'admin')),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists ticket_replies_ticket_idx
  on public.ticket_replies (ticket_id, created_at asc);
create index if not exists ticket_replies_user_idx
  on public.ticket_replies (user_id, created_at desc);

alter table public.ticket_replies enable row level security;

drop policy if exists "Users can view replies on own tickets" on public.ticket_replies;
create policy "Users can view replies on own tickets"
  on public.ticket_replies for select
  using (
    exists (
      select 1
      from public.support_tickets
      where support_tickets.id = ticket_replies.ticket_id
        and support_tickets.user_id = auth.uid()
    )
  );

drop policy if exists "Users can create replies on own tickets" on public.ticket_replies;
create policy "Users can create replies on own tickets"
  on public.ticket_replies for insert
  with check (
    auth.uid() = user_id
    and sender = 'user'
    and exists (
      select 1
      from public.support_tickets
      where support_tickets.id = ticket_replies.ticket_id
        and support_tickets.user_id = auth.uid()
        and support_tickets.status <> 'closed'
    )
  );

-- Admin replies are inserted by the service-role CRM workflow, which bypasses RLS.
