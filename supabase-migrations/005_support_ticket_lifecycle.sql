-- Expand the support lifecycle and retain timestamps for the customer
-- self-service reopen window.
alter table public.support_tickets
  drop constraint if exists support_tickets_status_check;

alter table public.support_tickets
  add constraint support_tickets_status_check
  check (status in ('open', 'in_progress', 'awaiting_user_info', 'resolved', 'closed', 'reopened'));

alter table public.support_tickets
  add column if not exists resolved_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists reopened_at timestamptz;

create or replace function public.set_support_ticket_lifecycle_timestamps()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'resolved' and (old.status is distinct from new.status or new.resolved_at is null) then
    new.resolved_at = coalesce(new.resolved_at, now());
  end if;

  if new.status = 'closed' and (old.status is distinct from new.status or new.closed_at is null) then
    new.closed_at = coalesce(new.closed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists support_ticket_lifecycle_timestamps on public.support_tickets;
create trigger support_ticket_lifecycle_timestamps
  before update on public.support_tickets
  for each row execute function public.set_support_ticket_lifecycle_timestamps();

create index if not exists support_tickets_reopen_idx
  on public.support_tickets (status, resolved_at, closed_at);

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
        and support_tickets.status not in ('resolved', 'closed')
    )
  );