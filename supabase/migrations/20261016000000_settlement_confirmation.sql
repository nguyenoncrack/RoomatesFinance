-- Recipient confirmation for settlements.
--
-- When the payer records "I paid", the settlement is saved as pending and the recipient gets a
-- notification to accept or reject it. Only the recipient can confirm. Accepting completes it (and
-- balances move); rejecting keeps balances unchanged. Either outcome notifies the payer. Pending and
-- rejected settlements never count toward balances (member_net_balance only sums completed ones).
--
-- Notifications are rows in public.notifications, one per person to tell, written by the RPCs in
-- the same transaction as the status change and pushed to clients through Supabase Realtime.
--
-- Every statement is safe to run again (Supabase preview replays migrations).

-- ---------------------------------------------------------------------------
-- Settlement status: add "rejected", and record who responded and when.
-- ---------------------------------------------------------------------------

alter table public.settlements drop constraint if exists settlements_status_check;
alter table public.settlements add constraint settlements_status_check
  check (status in ('pending', 'completed', 'voided', 'rejected'));
alter table public.settlements add column if not exists responded_at timestamptz;
alter table public.settlements add column if not exists responded_by uuid references public.profiles (id);

-- At most one identical payment (same payer, recipient and amount) can be waiting at a time,
-- so a double submit or a retry from another tab can't queue the same payment twice.
-- If existing data already has identical pending rows the index is skipped; record_settlement still
-- refuses new duplicates.
do $$
begin
  create unique index if not exists settlements_one_pending_per_payment
    on public.settlements (household_id, paid_by, paid_to, amount_cents)
    where status = 'pending';
exception
  when unique_violation then
    raise notice 'Skipped settlements_one_pending_per_payment: existing duplicate pending payments';
end $$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- Who should see it.
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('settlement_requested', 'settlement_accepted', 'settlement_rejected', 'settlement_cancelled')),
  settlement_id uuid references public.settlements (id) on delete cascade,
  -- Who caused it.
  actor_id uuid references public.profiles (id),
  amount_cents bigint,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = auth.uid() and public.is_active_member(household_id));
revoke insert, update, delete on public.notifications from anon, authenticated;

create or replace function public.notify(
  p_household_id uuid,
  p_user_id uuid,
  p_kind text,
  p_settlement_id uuid,
  p_actor_id uuid,
  p_amount_cents bigint
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (household_id, user_id, kind, settlement_id, actor_id, amount_cents)
  values (p_household_id, p_user_id, p_kind, p_settlement_id, p_actor_id, p_amount_cents);
$$;
-- Internal helper: only the RPCs below may write notifications.
revoke execute on function public.notify(uuid, uuid, text, uuid, uuid, bigint) from public, anon, authenticated;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
begin
  update public.notifications set read_at = now()
  where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
end;
$$;

-- ---------------------------------------------------------------------------
-- Recording a payment: the payer's own record always waits for the recipient.
-- ---------------------------------------------------------------------------

create or replace function public.record_settlement(
  p_household_id uuid,
  p_paid_by uuid,
  p_paid_to uuid,
  p_amount_cents bigint,
  p_payment_method text,
  p_status text default 'completed',
  p_note text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_status text;
  v_id uuid;
begin
  if not public.is_active_member(p_household_id, v_uid) then
    raise exception 'Not a member of this household' using errcode = '42501';
  end if;
  if v_uid not in (p_paid_by, p_paid_to) then
    raise exception 'You can only record payments you sent or received' using errcode = '42501';
  end if;
  if p_paid_by = p_paid_to then
    raise exception 'Payer and recipient must be different people' using errcode = '22023';
  end if;
  if not public.is_active_member(p_household_id, p_paid_by) or not public.is_active_member(p_household_id, p_paid_to) then
    raise exception 'Both people must be current roommates' using errcode = '22023';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 1000000000 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if p_status not in ('pending', 'completed') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  -- Retry of the same submission: hand back the original.
  if p_client_request_id is not null then
    select id into v_id from public.settlements where client_request_id = p_client_request_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  -- Only the recipient can confirm money arrived, so the payer's record always starts pending.
  v_status := case when v_uid = p_paid_to then p_status else 'pending' end;

  if v_status = 'pending' and exists (
    select 1 from public.settlements
    where household_id = p_household_id and paid_by = p_paid_by and paid_to = p_paid_to
      and amount_cents = p_amount_cents and status = 'pending'
  ) then
    raise exception 'That payment is already waiting for confirmation' using errcode = 'P0001';
  end if;

  insert into public.settlements (household_id, paid_by, paid_to, amount_cents, payment_method, status, note,
    client_request_id, created_by, completed_at, responded_at, responded_by)
  values (p_household_id, p_paid_by, p_paid_to, p_amount_cents, p_payment_method, v_status, nullif(btrim(p_note), ''),
    p_client_request_id, v_uid,
    case when v_status = 'completed' then now() end,
    case when v_status = 'completed' then now() end,
    case when v_status = 'completed' then v_uid end)
  on conflict (client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.settlements where client_request_id = p_client_request_id;
    return v_id;
  end if;

  -- The recipient is asked to confirm whenever it's pending and they aren't the one who recorded it.
  if v_status = 'pending' and v_uid <> p_paid_to then
    perform public.notify(p_household_id, p_paid_to, 'settlement_requested', v_id, v_uid, p_amount_cents);
  end if;

  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, after)
  values (p_household_id, v_uid, 'settlement', v_id, 'create',
    jsonb_build_object('paid_by', p_paid_by, 'paid_to', p_paid_to, 'amount_cents', p_amount_cents, 'status', v_status));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status changes
--   completed (accept): recipient only, from pending.
--   rejected:           recipient only, from pending. Balances unchanged.
--   voided:             payer cancels their pending payment, or either side voids a completed one.
-- ---------------------------------------------------------------------------

create or replace function public.set_settlement_status(p_settlement_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_old public.settlements%rowtype;
begin
  -- Row lock: two quick taps, or both roommates acting at once, are applied one after the other.
  select * into v_old from public.settlements where id = p_settlement_id for update;
  if not found or not public.is_active_member(v_old.household_id, v_uid) then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_uid not in (v_old.paid_by, v_old.paid_to) then
    raise exception 'Only the payer or recipient can change this payment' using errcode = '42501';
  end if;
  if p_status not in ('completed', 'rejected', 'voided') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  -- Asking for the state it's already in is a no-op (double tap, or a stale tab).
  if v_old.status = p_status then
    return;
  end if;

  if p_status in ('completed', 'rejected') then
    if v_uid <> v_old.paid_to then
      raise exception 'Only the recipient can confirm this payment' using errcode = '42501';
    end if;
    if v_old.status <> 'pending' then
      raise exception 'This payment was already %', v_old.status using errcode = 'P0001';
    end if;
  else -- voided
    if v_old.status = 'pending' and v_uid <> v_old.paid_by and v_old.created_by <> v_uid then
      raise exception 'The recipient can accept or reject this payment instead' using errcode = '42501';
    end if;
    if v_old.status not in ('pending', 'completed') then
      raise exception 'This payment was already %', v_old.status using errcode = 'P0001';
    end if;
  end if;

  update public.settlements set
    status = p_status,
    completed_at = case when p_status = 'completed' then now() else completed_at end,
    responded_at = case when p_status in ('completed', 'rejected') then now() else responded_at end,
    responded_by = case when p_status in ('completed', 'rejected') then v_uid else responded_by end
  where id = p_settlement_id;

  if p_status = 'completed' then
    perform public.notify(v_old.household_id, v_old.paid_by, 'settlement_accepted', p_settlement_id, v_uid, v_old.amount_cents);
  elsif p_status = 'rejected' then
    perform public.notify(v_old.household_id, v_old.paid_by, 'settlement_rejected', p_settlement_id, v_uid, v_old.amount_cents);
  elsif v_old.status = 'pending' and v_uid <> v_old.paid_to then
    perform public.notify(v_old.household_id, v_old.paid_to, 'settlement_cancelled', p_settlement_id, v_uid, v_old.amount_cents);
  end if;
  -- The request is settled one way or another, so it no longer needs the recipient's attention.
  update public.notifications set read_at = coalesce(read_at, now())
  where settlement_id = p_settlement_id and kind = 'settlement_requested';

  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, before, after)
  values (v_old.household_id, v_uid, 'settlement', p_settlement_id, p_status,
    jsonb_build_object('status', v_old.status, 'amount_cents', v_old.amount_cents, 'paid_by', v_old.paid_by, 'paid_to', v_old.paid_to),
    jsonb_build_object('status', p_status));
end;
$$;

revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
revoke execute on function public.record_settlement(uuid, uuid, uuid, bigint, text, text, text, uuid) from public, anon;
grant execute on function public.record_settlement(uuid, uuid, uuid, bigint, text, text, text, uuid) to authenticated;
revoke execute on function public.set_settlement_status(uuid, text) from public, anon;
grant execute on function public.set_settlement_status(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
