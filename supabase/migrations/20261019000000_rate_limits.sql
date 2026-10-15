-- Per-account rate limits for write-heavy actions.
--
-- The website sits behind Vercel's network protection, but a signed-in account can also talk straight to
-- Supabase's API, skipping the site entirely. These limits live in the database so they hold either way:
-- a flooded account gets "too fast, wait a moment" instead of filling the tables.
--
-- How it works: a BEFORE INSERT/UPDATE trigger on each table calls check_rate_limit(scope, limit, window),
-- which counts that user's recent actions in one-minute buckets and refuses once the limit is passed. Only
-- user-driven calls are counted (auth.uid() must be set), so admin/SQL-editor work is never throttled.
--
-- Every statement is safe to run again.

create table if not exists public.rate_limit_hits (
  user_id uuid not null,
  scope text not null,
  bucket timestamptz not null,
  hits int not null default 0,
  primary key (user_id, scope, bucket)
);
create index if not exists rate_limit_hits_bucket_idx on public.rate_limit_hits (bucket);
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

create or replace function public.check_rate_limit(p_scope text, p_limit int, p_window_seconds int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / 60) * 60);
  v_total int;
begin
  if v_uid is null then
    return;
  end if;

  insert into public.rate_limit_hits (user_id, scope, bucket, hits)
  values (v_uid, p_scope, v_bucket, 1)
  on conflict (user_id, scope, bucket) do update set hits = public.rate_limit_hits.hits + 1;

  select coalesce(sum(hits), 0) into v_total
  from public.rate_limit_hits
  where user_id = v_uid and scope = p_scope and bucket > now() - make_interval(secs => p_window_seconds);

  if v_total > p_limit then
    -- 54000 = program_limit_exceeded. The raise rolls this attempt's count back too, so blocked retries
    -- don't push the window further out; the limit simply clears as old buckets age past the window.
    raise exception 'You''re doing that too fast. Wait a moment and try again.' using errcode = '54000';
  end if;

  -- Housekeeping: now and then, forget counts older than a day.
  if random() < 0.01 then
    delete from public.rate_limit_hits where bucket < now() - interval '1 day';
  end if;
end;
$$;

create or replace function public.rate_limit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.check_rate_limit(tg_argv[0], tg_argv[1]::int, tg_argv[2]::int);
  return new;
end;
$$;

revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.rate_limit_trigger() from public, anon, authenticated;

-- scope, max actions, within this many seconds
drop trigger if exists rate_limit_households on public.households;
create trigger rate_limit_households before insert on public.households
  for each row execute function public.rate_limit_trigger('household_create', '10', '3600');

drop trigger if exists rate_limit_invitations on public.household_invitations;
create trigger rate_limit_invitations before insert on public.household_invitations
  for each row execute function public.rate_limit_trigger('invitation_create', '30', '3600');

drop trigger if exists rate_limit_members on public.household_members;
create trigger rate_limit_members before insert on public.household_members
  for each row execute function public.rate_limit_trigger('member_join', '40', '3600');

drop trigger if exists rate_limit_expenses on public.expenses;
create trigger rate_limit_expenses before insert on public.expenses
  for each row execute function public.rate_limit_trigger('expense_create', '300', '600');

drop trigger if exists rate_limit_expense_edits on public.expenses;
create trigger rate_limit_expense_edits before update on public.expenses
  for each row execute function public.rate_limit_trigger('expense_edit', '300', '600');

drop trigger if exists rate_limit_settlements on public.settlements;
create trigger rate_limit_settlements before insert on public.settlements
  for each row execute function public.rate_limit_trigger('settlement_create', '60', '600');

do $$
begin
  if to_regclass('public.recurring_expenses') is not null then
    execute 'drop trigger if exists rate_limit_recurring on public.recurring_expenses';
    execute 'create trigger rate_limit_recurring before insert on public.recurring_expenses
      for each row execute function public.rate_limit_trigger(''recurring_create'', ''30'', ''3600'')';
  end if;
end $$;

notify pgrst, 'reload schema';
