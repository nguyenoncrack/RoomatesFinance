-- Repeating expenses and an optional household settle day.
--
-- Repeats are templates: create_recurring_expense stores one, and run_due_recurring (called by any
-- member's client on load) adds every occurrence that has come due and advances the template, all
-- in one transaction. Each occurrence gets a client_request_id derived from (template, date), so two
-- roommates opening the app at once can't add the same rent twice.
--
-- Every statement is safe to run again (Supabase preview replays migrations).

-- ---------------------------------------------------------------------------
-- Settle day on households
-- ---------------------------------------------------------------------------

alter table public.households add column if not exists settle_cadence text;
alter table public.households add column if not exists settle_day int;

do $$
begin
  alter table public.households add constraint households_settle_schedule check (
    (settle_cadence is null and settle_day is null)
    or (settle_cadence = 'weekly' and settle_day between 0 and 6)
    or (settle_cadence = 'monthly' and settle_day between 1 and 28)
  );
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Repeating expense templates
-- ---------------------------------------------------------------------------

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 1000000000),
  paid_by uuid not null references public.profiles (id),
  category text not null check (category in ('groceries', 'utilities', 'rent', 'internet', 'household_supplies', 'food', 'other')),
  description text check (description is null or char_length(description) <= 1000),
  split_method text not null check (split_method in ('equal', 'custom', 'percentage', 'shares')),
  -- Same shape create_expense takes: [{user_id, share_cents, weight}], validated on insert.
  splits jsonb not null,
  cadence text not null check (cadence in ('weekly', 'monthly')),
  anchor_day int not null check (anchor_day between 1 and 31),
  next_date date not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  stopped_at timestamptz,
  stopped_by uuid references public.profiles (id)
);
create index if not exists recurring_expenses_due_idx on public.recurring_expenses (household_id, next_date) where stopped_at is null;

alter table public.recurring_expenses enable row level security;
drop policy if exists "recurring: members read" on public.recurring_expenses;
create policy "recurring: members read" on public.recurring_expenses
  for select to authenticated using (public.is_active_member(household_id));
revoke insert, update, delete on public.recurring_expenses from anon, authenticated;

-- Monthly repeats keep their anchor day and clamp to short months (Jan 31 -> Feb 28 -> Mar 31).
create or replace function public.next_recurring_date(p_date date, p_cadence text, p_anchor int)
returns date
language sql
immutable
as $$
  select case
    when p_cadence = 'weekly' then p_date + 7
    else (
      date_trunc('month', p_date)::date + interval '1 month'
      + make_interval(days => least(
          p_anchor,
          extract(day from (date_trunc('month', p_date) + interval '2 month' - interval '1 day'))::int
        ) - 1)
    )::date
  end;
$$;

create or replace function public.create_recurring_expense(
  p_household_id uuid,
  p_title text,
  p_amount_cents bigint,
  p_paid_by uuid,
  p_category text,
  p_description text,
  p_split_method text,
  p_splits jsonb,
  p_cadence text,
  p_start_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_id uuid;
  v_anchor int;
begin
  if not public.is_active_member(p_household_id, v_uid) then
    raise exception 'Not a member of this household' using errcode = '42501';
  end if;
  if p_cadence not in ('weekly', 'monthly') then
    raise exception 'Pick weekly or monthly' using errcode = '22023';
  end if;
  if p_start_date is null then
    raise exception 'Pick a start date' using errcode = '22023';
  end if;
  perform public.validate_expense(p_household_id, p_title, p_amount_cents, p_paid_by, p_category, p_split_method, p_splits);

  v_anchor := extract(day from p_start_date)::int;
  insert into public.recurring_expenses (household_id, title, amount_cents, paid_by, category, description,
    split_method, splits, cadence, anchor_day, next_date, created_by)
  values (p_household_id, btrim(p_title), p_amount_cents, p_paid_by, p_category, nullif(btrim(p_description), ''),
    p_split_method, p_splits, p_cadence, v_anchor, public.next_recurring_date(p_start_date, p_cadence, v_anchor), v_uid)
  returning id into v_id;

  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, after)
  values (p_household_id, v_uid, 'expense', v_id, 'repeat',
    jsonb_build_object('title', btrim(p_title), 'amount_cents', p_amount_cents, 'cadence', p_cadence));
  return v_id;
end;
$$;

create or replace function public.stop_recurring_expense(p_recurring_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_old public.recurring_expenses%rowtype;
begin
  select * into v_old from public.recurring_expenses where id = p_recurring_id for update;
  if not found or v_old.stopped_at is not null or not public.is_active_member(v_old.household_id, v_uid) then
    raise exception 'Repeating expense not found' using errcode = 'P0002';
  end if;
  if v_uid not in (v_old.created_by, v_old.paid_by) and public.member_role(v_old.household_id, v_uid) <> 'owner' then
    raise exception 'Only the person who set this up, the payer, or the owner can stop it' using errcode = '42501';
  end if;
  update public.recurring_expenses set stopped_at = now(), stopped_by = v_uid where id = p_recurring_id;
  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, before)
  values (v_old.household_id, v_uid, 'expense', p_recurring_id, 'stop_repeat', jsonb_build_object('title', v_old.title));
end;
$$;

-- Adds every due occurrence (up to 12 per template per run) and advances each template.
-- p_today is the caller's local date, clamped so a client can't schedule ahead of real time.
create or replace function public.run_due_recurring(p_household_id uuid, p_today date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_today date := least(coalesce(p_today, current_date), current_date + 1);
  v_tpl public.recurring_expenses%rowtype;
  v_date date;
  v_count int;
  v_created int := 0;
  v_id uuid;
begin
  if not public.is_active_member(p_household_id, v_uid) then
    raise exception 'Not a member of this household' using errcode = '42501';
  end if;

  for v_tpl in
    select * from public.recurring_expenses
    where household_id = p_household_id and stopped_at is null and next_date <= v_today
    order by next_date
    for update skip locked
  loop
    begin
      v_date := v_tpl.next_date;
      v_count := 0;
      while v_date <= v_today and v_count < 12 loop
        -- Fails (and skips this template) if the payer or a participant has since left.
        perform public.validate_expense(p_household_id, v_tpl.title, v_tpl.amount_cents, v_tpl.paid_by, v_tpl.category,
          v_tpl.split_method, v_tpl.splits);
        insert into public.expenses (household_id, title, amount_cents, paid_by, category, description, expense_date,
          split_method, client_request_id, created_by)
        values (p_household_id, v_tpl.title, v_tpl.amount_cents, v_tpl.paid_by, v_tpl.category, v_tpl.description, v_date,
          v_tpl.split_method, md5(v_tpl.id::text || ':' || v_date::text)::uuid, v_tpl.created_by)
        on conflict (client_request_id) do nothing
        returning id into v_id;

        if v_id is not null then
          insert into public.expense_splits (expense_id, user_id, share_cents, weight)
          select v_id, (s ->> 'user_id')::uuid, (s ->> 'share_cents')::bigint, nullif(s ->> 'weight', '')::bigint
          from jsonb_array_elements(v_tpl.splits) s;
          insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, after)
          values (p_household_id, v_uid, 'expense', v_id, 'create', public.expense_json(v_id));
          v_created := v_created + 1;
        end if;

        v_date := public.next_recurring_date(v_date, v_tpl.cadence, v_tpl.anchor_day);
        v_count := v_count + 1;
      end loop;
      -- After a capped catch-up, skip ahead so the template isn't permanently behind.
      while v_date <= v_today loop
        v_date := public.next_recurring_date(v_date, v_tpl.cadence, v_tpl.anchor_day);
      end loop;
      update public.recurring_expenses set next_date = v_date where id = v_tpl.id;
    exception
      when others then
        -- Leave this template where it is; someone can stop or recreate it.
        null;
    end;
  end loop;
  return v_created;
end;
$$;

create or replace function public.set_settle_schedule(p_household_id uuid, p_cadence text, p_day int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
begin
  if public.member_role(p_household_id, v_uid) is distinct from 'owner' then
    raise exception 'Only the household owner can set the settle day' using errcode = '42501';
  end if;
  if not (
    (p_cadence is null and p_day is null)
    or (p_cadence = 'weekly' and p_day between 0 and 6)
    or (p_cadence = 'monthly' and p_day between 1 and 28)
  ) then
    raise exception 'Pick a weekday, or a day from 1 to 28' using errcode = '22023';
  end if;
  update public.households set settle_cadence = p_cadence, settle_day = p_day where id = p_household_id;
  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, after)
  values (p_household_id, v_uid, 'household', p_household_id, 'settle_day',
    jsonb_build_object('cadence', p_cadence, 'day', p_day));
end;
$$;

revoke execute on function public.create_recurring_expense(uuid, text, bigint, uuid, text, text, text, jsonb, text, date) from public, anon;
revoke execute on function public.stop_recurring_expense(uuid) from public, anon;
revoke execute on function public.run_due_recurring(uuid, date) from public, anon;
revoke execute on function public.set_settle_schedule(uuid, text, int) from public, anon;
grant execute on function public.create_recurring_expense(uuid, text, bigint, uuid, text, text, text, jsonb, text, date) to authenticated;
grant execute on function public.stop_recurring_expense(uuid) to authenticated;
grant execute on function public.run_due_recurring(uuid, date) to authenticated;
grant execute on function public.set_settle_schedule(uuid, text, int) to authenticated;
grant execute on function public.next_recurring_date(date, text, int) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.recurring_expenses;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
