-- Roommate AI schema: households, members, expenses + splits, settlements, invitations, audit log.
-- All money is integer cents (bigint). Clients never write financial tables directly; every
-- mutation goes through SECURITY DEFINER RPCs below, which validate membership and amounts
-- and run in a single transaction.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  -- Members are never deleted so their history and balances stay intact.
  left_at timestamptz,
  unique (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id) where left_at is null;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 1000000000),
  paid_by uuid not null references public.profiles (id),
  category text not null check (category in ('groceries', 'utilities', 'rent', 'internet', 'household_supplies', 'food', 'other')),
  description text check (description is null or char_length(description) <= 1000),
  expense_date date not null,
  split_method text not null check (split_method in ('equal', 'custom', 'percentage', 'shares')),
  receipt_path text,
  client_request_id uuid unique,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft delete: financial history is never silently lost.
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id)
);
create index expenses_household_date_idx on public.expenses (household_id, expense_date desc) where deleted_at is null;
create index expenses_paid_by_idx on public.expenses (paid_by);

create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  share_cents bigint not null check (share_cents >= 0),
  -- Raw method input: custom cents, percentage basis points, or share weight.
  weight bigint check (weight is null or weight >= 0),
  unique (expense_id, user_id)
);
create index expense_splits_user_idx on public.expense_splits (user_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete restrict,
  paid_by uuid not null references public.profiles (id),
  paid_to uuid not null references public.profiles (id),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 1000000000),
  payment_method text not null check (payment_method in ('venmo', 'zelle', 'cash', 'other')),
  status text not null default 'completed' check (status in ('pending', 'completed', 'voided')),
  note text check (note is null or char_length(note) <= 280),
  client_request_id uuid unique,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (paid_by <> paid_to)
);
create index settlements_household_idx on public.settlements (household_id, created_at desc);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- Only the SHA-256 of the token is stored; the raw token exists only in the invite link.
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_uses int not null default 5 check (max_uses between 1 and 50),
  use_count int not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (use_count <= max_uses)
);
create index household_invitations_household_idx on public.household_invitations (household_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_household_idx on public.audit_log (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Integrity: splits must always sum to the expense total (checked at commit).
-- ---------------------------------------------------------------------------

create or replace function public.check_expense_split_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_amount bigint;
  v_sum bigint;
begin
  if tg_table_name = 'expenses' then
    v_id := new.id;
  elsif tg_op = 'DELETE' then
    v_id := old.expense_id;
  else
    v_id := new.expense_id;
  end if;

  select amount_cents into v_amount from public.expenses where id = v_id;
  if v_amount is null then
    return null;
  end if;
  select coalesce(sum(share_cents), 0) into v_sum from public.expense_splits where expense_id = v_id;
  if v_sum <> v_amount then
    raise exception 'Splits (% cents) must sum to the expense amount (% cents)', v_sum, v_amount using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger expense_splits_total
  after insert or update or delete on public.expense_splits
  deferrable initially deferred
  for each row execute function public.check_expense_split_total();

create constraint trigger expenses_total
  after insert or update of amount_cents on public.expenses
  deferrable initially deferred
  for each row execute function public.check_expense_split_total();

-- ---------------------------------------------------------------------------
-- Profiles are created automatically on sign-up.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1),
      'Roommate'
    ), 60),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so RLS policies don't recurse).
-- ---------------------------------------------------------------------------

create or replace function public.is_active_member(p_household uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = p_user and left_at is null
  );
$$;

create or replace function public.shares_household(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members them on them.household_id = me.household_id
    where me.user_id = auth.uid() and me.left_at is null and them.user_id = p_other
  );
$$;

create or replace function public.member_role(p_household uuid, p_user uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.household_members
  where household_id = p_household and user_id = p_user and left_at is null;
$$;

create or replace function public.require_user()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'You need to sign in first' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

create or replace function public.expense_json(p_expense_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', e.title,
    'amount_cents', e.amount_cents,
    'paid_by', e.paid_by,
    'category', e.category,
    'expense_date', e.expense_date,
    'split_method', e.split_method,
    'splits', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'share_cents', s.share_cents) order by s.user_id)
      from public.expense_splits s where s.expense_id = e.id
    ), '[]'::jsonb)
  )
  from public.expenses e where e.id = p_expense_id;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: members can read their households; writes go through RPCs.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.household_invitations enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles: read self and housemates" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_household(id));
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "households: members read" on public.households
  for select to authenticated using (public.is_active_member(id));

create policy "members: members read roster" on public.household_members
  for select to authenticated using (public.is_active_member(household_id));

create policy "expenses: members read" on public.expenses
  for select to authenticated using (public.is_active_member(household_id));

create policy "splits: members read" on public.expense_splits
  for select to authenticated using (
    exists (select 1 from public.expenses e where e.id = expense_id and public.is_active_member(e.household_id))
  );

create policy "settlements: members read" on public.settlements
  for select to authenticated using (public.is_active_member(household_id));

create policy "invitations: members read" on public.household_invitations
  for select to authenticated using (public.is_active_member(household_id));

create policy "audit: members read" on public.audit_log
  for select to authenticated using (public.is_active_member(household_id));

-- Defense in depth: even without policies, make sure clients can't write money tables.
revoke insert, update, delete on public.households, public.household_members, public.expenses,
  public.expense_splits, public.settlements, public.household_invitations, public.audit_log
  from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Households
-- ---------------------------------------------------------------------------

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_id uuid;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Household name must be 1–80 characters' using errcode = '22023';
  end if;
  insert into public.households (name, created_by) values (btrim(p_name), v_uid) returning id into v_id;
  insert into public.household_members (household_id, user_id, role) values (v_id, v_uid, 'owner');
  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, after)
  values (v_id, v_uid, 'household', v_id, 'create', jsonb_build_object('name', btrim(p_name)));
  return v_id;
end;
$$;

create or replace function public.rename_household(p_household_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_old text;
begin
  if public.member_role(p_household_id, v_uid) is distinct from 'owner' then
    raise exception 'Only the household owner can rename it' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Household name must be 1–80 characters' using errcode = '22023';
  end if;
  select name into v_old from public.households where id = p_household_id for update;
  update public.households set name = btrim(p_name) where id = p_household_id;
  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, before, after)
  values (p_household_id, v_uid, 'household', p_household_id, 'rename',
    jsonb_build_object('name', v_old), jsonb_build_object('name', btrim(p_name)));
end;
$$;

create or replace function public.member_net_balance(p_household uuid, p_user uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_member(p_household, public.require_user()) then
    raise exception 'Not a member of this household' using errcode = '42501';
  end if;
  return
    coalesce((select sum(amount_cents) from public.expenses
      where household_id = p_household and paid_by = p_user and deleted_at is null), 0)
    - coalesce((select sum(s.share_cents) from public.expense_splits s
      join public.expenses e on e.id = s.expense_id
      where e.household_id = p_household and e.deleted_at is null and s.user_id = p_user), 0)
    + coalesce((select sum(amount_cents) from public.settlements
      where household_id = p_household and paid_by = p_user and status = 'completed'), 0)
    - coalesce((select sum(amount_cents) from public.settlements
      where household_id = p_household and paid_to = p_user and status = 'completed'), 0);
end;
$$;

create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_member public.household_members%rowtype;
  v_balance bigint;
  v_successor uuid;
begin
  -- Lock the household's roster so concurrent leaves/joins serialize.
  perform 1 from public.households where id = p_household_id for update;
  select * into v_member from public.household_members
    where household_id = p_household_id and user_id = v_uid and left_at is null for update;
  if not found then
    raise exception 'You are not a member of this household' using errcode = '42501';
  end if;

  v_balance := public.member_net_balance(p_household_id, v_uid);
  if v_balance <> 0 then
    raise exception 'Settle your balance (% cents) before leaving', v_balance using errcode = 'P0001';
  end if;

  if v_member.role = 'owner' then
    select user_id into v_successor from public.household_members
      where household_id = p_household_id and user_id <> v_uid and left_at is null
      order by joined_at limit 1;
    if v_successor is not null then
      update public.household_members set role = 'owner'
        where household_id = p_household_id and user_id = v_successor;
    end if;
  end if;

  update public.household_members set left_at = now(), role = 'member' where id = v_member.id;
  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action)
  values (p_household_id, v_uid, 'member', v_uid, 'leave');
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitations: random 192-bit tokens, stored hashed, expiring, use-limited.
-- ---------------------------------------------------------------------------

create or replace function public.create_invitation(p_household_id uuid, p_ttl_hours int default 168, p_max_uses int default 5)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_token text;
  v_expires timestamptz;
begin
  if not public.is_active_member(p_household_id, v_uid) then
    raise exception 'Not a member of this household' using errcode = '42501';
  end if;
  if p_ttl_hours not between 1 and 720 or p_max_uses not between 1 and 50 then
    raise exception 'Invalid invitation settings' using errcode = '22023';
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires := now() + make_interval(hours => p_ttl_hours);
  insert into public.household_invitations (household_id, token_hash, expires_at, max_uses, created_by)
  values (p_household_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires, p_max_uses, v_uid);
  return query select v_token, v_expires;
end;
$$;

create or replace function public.preview_invitation(p_token text)
returns table (household_id uuid, household_name text, member_count int, expires_at timestamptz, is_valid boolean)
language sql
stable
security definer
set search_path = public
as $$
  select h.id, h.name,
    (select count(*)::int from public.household_members m where m.household_id = h.id and m.left_at is null),
    i.expires_at,
    (i.revoked_at is null and i.expires_at > now() and i.use_count < i.max_uses)
  from public.household_invitations i
  join public.households h on h.id = i.household_id
  where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_inv public.household_invitations%rowtype;
  v_existing public.household_members%rowtype;
begin
  select * into v_inv from public.household_invitations
    where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    for update;
  if not found then
    raise exception 'This invite link is invalid' using errcode = 'P0002';
  end if;

  select * into v_existing from public.household_members
    where household_id = v_inv.household_id and user_id = v_uid;
  if found and v_existing.left_at is null then
    return v_inv.household_id; -- already a member; don't burn a use
  end if;

  if v_inv.revoked_at is not null or v_inv.expires_at <= now() or v_inv.use_count >= v_inv.max_uses then
    raise exception 'This invite link has expired or was already used' using errcode = 'P0001';
  end if;

  if found then
    update public.household_members set left_at = null, joined_at = now(), role = 'member' where id = v_existing.id;
  else
    insert into public.household_members (household_id, user_id, role) values (v_inv.household_id, v_uid, 'member');
  end if;
  update public.household_invitations set use_count = use_count + 1 where id = v_inv.id;
  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action)
  values (v_inv.household_id, v_uid, 'member', v_uid, 'join');
  return v_inv.household_id;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_household uuid;
begin
  select household_id into v_household from public.household_invitations where id = p_invitation_id;
  if v_household is null or not public.is_active_member(v_household, v_uid) then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  update public.household_invitations set revoked_at = now() where id = p_invitation_id and revoked_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------

create or replace function public.validate_expense(
  p_household_id uuid,
  p_title text,
  p_amount_cents bigint,
  p_paid_by uuid,
  p_category text,
  p_split_method text,
  p_splits jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count int;
  v_distinct int;
  v_sum bigint;
  v_all_nonneg boolean;
  v_all_members boolean;
begin
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then
    raise exception 'Expense name must be 1–120 characters' using errcode = '22023';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 1000000000 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;
  if p_category not in ('groceries', 'utilities', 'rent', 'internet', 'household_supplies', 'food', 'other') then
    raise exception 'Unknown category' using errcode = '22023';
  end if;
  if p_split_method not in ('equal', 'custom', 'percentage', 'shares') then
    raise exception 'Unknown split method' using errcode = '22023';
  end if;
  if not public.is_active_member(p_household_id, p_paid_by) then
    raise exception 'The payer must be a current roommate' using errcode = '22023';
  end if;
  if p_splits is null or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'Split the expense with at least one roommate' using errcode = '22023';
  end if;

  select count(*), count(distinct user_id), coalesce(sum(share), 0), bool_and(share >= 0),
         bool_and(public.is_active_member(p_household_id, user_id))
    into v_count, v_distinct, v_sum, v_all_nonneg, v_all_members
  from (
    select (s ->> 'user_id')::uuid as user_id, (s ->> 'share_cents')::bigint as share
    from jsonb_array_elements(p_splits) s
  ) x;

  if v_count <> v_distinct then
    raise exception 'Each roommate can only appear once in a split' using errcode = '22023';
  end if;
  if not v_all_nonneg then
    raise exception 'Shares cannot be negative' using errcode = '22023';
  end if;
  if not v_all_members then
    raise exception 'Everyone in the split must be a current roommate' using errcode = '22023';
  end if;
  if v_sum <> p_amount_cents then
    raise exception 'Shares (% cents) must add up to the total (% cents)', v_sum, p_amount_cents using errcode = '22023';
  end if;
end;
$$;

create or replace function public.create_expense(
  p_household_id uuid,
  p_title text,
  p_amount_cents bigint,
  p_paid_by uuid,
  p_category text,
  p_description text,
  p_expense_date date,
  p_split_method text,
  p_splits jsonb,
  p_receipt_path text default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_id uuid;
begin
  if not public.is_active_member(p_household_id, v_uid) then
    raise exception 'Not a member of this household' using errcode = '42501';
  end if;
  perform public.validate_expense(p_household_id, p_title, p_amount_cents, p_paid_by, p_category, p_split_method, p_splits);
  if p_receipt_path is not null and split_part(p_receipt_path, '/', 1) <> p_household_id::text then
    raise exception 'Receipt must belong to this household' using errcode = '22023';
  end if;

  insert into public.expenses (household_id, title, amount_cents, paid_by, category, description, expense_date,
    split_method, receipt_path, client_request_id, created_by)
  values (p_household_id, btrim(p_title), p_amount_cents, p_paid_by, p_category, nullif(btrim(p_description), ''),
    coalesce(p_expense_date, current_date), p_split_method, p_receipt_path, p_client_request_id, v_uid)
  on conflict (client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- Duplicate submission (double click / retry): return the original.
    select id into v_id from public.expenses where client_request_id = p_client_request_id;
    return v_id;
  end if;

  insert into public.expense_splits (expense_id, user_id, share_cents, weight)
  select v_id, (s ->> 'user_id')::uuid, (s ->> 'share_cents')::bigint, nullif(s ->> 'weight', '')::bigint
  from jsonb_array_elements(p_splits) s;

  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, after)
  values (p_household_id, v_uid, 'expense', v_id, 'create', public.expense_json(v_id));
  return v_id;
end;
$$;

create or replace function public.update_expense(
  p_expense_id uuid,
  p_title text,
  p_amount_cents bigint,
  p_paid_by uuid,
  p_category text,
  p_description text,
  p_expense_date date,
  p_split_method text,
  p_splits jsonb,
  p_receipt_path text default null,
  p_expected_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_old public.expenses%rowtype;
  v_before jsonb;
begin
  select * into v_old from public.expenses where id = p_expense_id for update;
  if not found or v_old.deleted_at is not null or not public.is_active_member(v_old.household_id, v_uid) then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
  if v_uid not in (v_old.created_by, v_old.paid_by) and public.member_role(v_old.household_id, v_uid) <> 'owner' then
    raise exception 'Only the person who added or paid for this expense can edit it' using errcode = '42501';
  end if;
  if p_expected_updated_at is not null and v_old.updated_at <> p_expected_updated_at then
    raise exception 'Someone else changed this expense. Refresh and try again.' using errcode = '40001';
  end if;
  perform public.validate_expense(v_old.household_id, p_title, p_amount_cents, p_paid_by, p_category, p_split_method, p_splits);
  if p_receipt_path is not null and split_part(p_receipt_path, '/', 1) <> v_old.household_id::text then
    raise exception 'Receipt must belong to this household' using errcode = '22023';
  end if;

  v_before := public.expense_json(p_expense_id);
  update public.expenses set
    title = btrim(p_title),
    amount_cents = p_amount_cents,
    paid_by = p_paid_by,
    category = p_category,
    description = nullif(btrim(p_description), ''),
    expense_date = coalesce(p_expense_date, v_old.expense_date),
    split_method = p_split_method,
    receipt_path = p_receipt_path,
    updated_at = now()
  where id = p_expense_id;

  delete from public.expense_splits where expense_id = p_expense_id;
  insert into public.expense_splits (expense_id, user_id, share_cents, weight)
  select p_expense_id, (s ->> 'user_id')::uuid, (s ->> 'share_cents')::bigint, nullif(s ->> 'weight', '')::bigint
  from jsonb_array_elements(p_splits) s;

  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, before, after)
  values (v_old.household_id, v_uid, 'expense', p_expense_id, 'update', v_before, public.expense_json(p_expense_id));
end;
$$;

create or replace function public.delete_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_old public.expenses%rowtype;
begin
  select * into v_old from public.expenses where id = p_expense_id for update;
  if not found or v_old.deleted_at is not null or not public.is_active_member(v_old.household_id, v_uid) then
    raise exception 'Expense not found' using errcode = 'P0002';
  end if;
  if v_uid not in (v_old.created_by, v_old.paid_by) and public.member_role(v_old.household_id, v_uid) <> 'owner' then
    raise exception 'Only the person who added or paid for this expense can delete it' using errcode = '42501';
  end if;
  update public.expenses set deleted_at = now(), deleted_by = v_uid, updated_at = now() where id = p_expense_id;
  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, before)
  values (v_old.household_id, v_uid, 'expense', p_expense_id, 'delete', public.expense_json(p_expense_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Settlements (records of external payments; no money moves here)
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

  insert into public.settlements (household_id, paid_by, paid_to, amount_cents, payment_method, status, note,
    client_request_id, created_by, completed_at)
  values (p_household_id, p_paid_by, p_paid_to, p_amount_cents, p_payment_method, p_status, nullif(btrim(p_note), ''),
    p_client_request_id, v_uid, case when p_status = 'completed' then now() end)
  on conflict (client_request_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.settlements where client_request_id = p_client_request_id;
    return v_id;
  end if;

  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, after)
  values (p_household_id, v_uid, 'settlement', v_id, 'create',
    jsonb_build_object('paid_by', p_paid_by, 'paid_to', p_paid_to, 'amount_cents', p_amount_cents, 'status', p_status));
  return v_id;
end;
$$;

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
  select * into v_old from public.settlements where id = p_settlement_id for update;
  if not found or not public.is_active_member(v_old.household_id, v_uid) then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_uid not in (v_old.paid_by, v_old.paid_to) then
    raise exception 'Only the payer or recipient can change this payment' using errcode = '42501';
  end if;
  if p_status = 'completed' and v_old.status <> 'pending' then
    raise exception 'Only pending payments can be marked completed' using errcode = 'P0001';
  end if;
  if p_status = 'voided' and v_old.status = 'voided' then
    return;
  end if;
  if p_status not in ('completed', 'voided') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.settlements set
    status = p_status,
    completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_settlement_id;
  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, before, after)
  values (v_old.household_id, v_uid, 'settlement', p_settlement_id, p_status,
    jsonb_build_object('status', v_old.status, 'amount_cents', v_old.amount_cents, 'paid_by', v_old.paid_by, 'paid_to', v_old.paid_to),
    jsonb_build_object('status', p_status));
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: authenticated users only (plus invite preview for anon).
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.preview_invitation(text) to anon;
-- Internal helpers that take arbitrary ids and skip membership checks.
revoke execute on function public.expense_json(uuid) from authenticated;
revoke execute on function public.validate_expense(uuid, text, bigint, uuid, text, text, jsonb) from authenticated;

-- ---------------------------------------------------------------------------
-- Receipt storage: private bucket, objects stored under "<household_id>/...".
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy "receipts: members read" on storage.objects
  for select to authenticated using (
    bucket_id = 'receipts' and exists (
      select 1 from public.household_members m
      where m.user_id = auth.uid() and m.left_at is null and m.household_id::text = (storage.foldername(name))[1]
    )
  );

create policy "receipts: members upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'receipts' and exists (
      select 1 from public.household_members m
      where m.user_id = auth.uid() and m.left_at is null and m.household_id::text = (storage.foldername(name))[1]
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: push changes to other roommates' open tabs (RLS still applies).
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.expenses, public.expense_splits, public.settlements, public.household_members;
