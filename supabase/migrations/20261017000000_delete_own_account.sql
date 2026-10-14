-- User deletes their own account. Financial history is kept: expenses they paid,
-- splits, settlements, and audit_log rows stay, pointed at an anonymized profile.
-- Blocked when they still have a non-zero net in any household, or they are the
-- only owner of a household that still has other roommates (leave or kick first).
--
-- Safe to run again. Does not use the service role; clients call the RPC with the
-- anon key and their user JWT.

alter table public.profiles add column if not exists deleted_at timestamptz;

drop policy if exists "profiles: update self" on public.profiles;
create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = auth.uid() and deleted_at is null)
  with check (id = auth.uid() and deleted_at is null);

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
  if exists (select 1 from public.profiles p where p.id = v_uid and p.deleted_at is not null) then
    raise exception 'This account has been deleted' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_mem record;
  v_balance bigint;
  v_other_members int;
  v_other_owners int;
begin
  perform 1 from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  -- Serialize against concurrent leave / kick / join on every household we belong to.
  perform 1 from public.households h
    where h.id in (
      select m.household_id from public.household_members m
      where m.user_id = v_uid and m.left_at is null
    )
    order by h.id
    for update;

  for v_mem in
    select m.id, m.household_id, m.role, h.name as household_name
    from public.household_members m
    join public.households h on h.id = m.household_id
    where m.user_id = v_uid and m.left_at is null
    order by h.id
  loop
    v_balance := public.member_net_balance(v_mem.household_id, v_uid);
    if v_balance <> 0 then
      raise exception 'Settle your balance (% cents) in "%" before deleting your account',
        v_balance, v_mem.household_name using errcode = 'P0001';
    end if;

    select count(*)::int, count(*) filter (where role = 'owner')::int
      into v_other_members, v_other_owners
    from public.household_members
    where household_id = v_mem.household_id and user_id <> v_uid and left_at is null;

    if v_mem.role = 'owner' and v_other_members > 0 and v_other_owners = 0 then
      raise exception 'You''re the owner of "%" with other roommates. Leave or kick them first so someone else can own it',
        v_mem.household_name using errcode = 'P0001';
    end if;
  end loop;

  -- Soft-leave every household. History (expenses, splits, settlements) stays.
  for v_mem in
    select id, household_id from public.household_members
    where user_id = v_uid and left_at is null
    for update
  loop
    update public.household_members set left_at = now(), role = 'member' where id = v_mem.id;
    insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action)
    values (v_mem.household_id, v_uid, 'member', v_uid, 'leave');
  end loop;

  -- Repeats they created or pay would fail on the next run (payer must be active).
  if to_regclass('public.recurring_expenses') is not null then
    update public.recurring_expenses
      set stopped_at = now(), stopped_by = v_uid
      where stopped_at is null
        and (created_by = v_uid or paid_by = v_uid);
  end if;

  update public.household_invitations
    set revoked_at = now()
    where created_by = v_uid and revoked_at is null;

  update public.profiles
    set display_name = 'Deleted user',
        avatar_url = null,
        deleted_at = now()
    where id = v_uid;

  -- Disable login without deleting auth.users: profiles.id is the PK expenses
  -- and splits still reference, and ON DELETE CASCADE from auth.users would
  -- try to remove it. Changing the email frees it for a future signup.
  update auth.users
    set email = 'deleted-' || v_uid::text || '@deleted.invalid',
        raw_user_meta_data = jsonb_build_object('deleted', true)
    where id = v_uid;

  if to_regclass('auth.identities') is not null then
    execute 'delete from auth.identities where user_id = $1' using v_uid;
  end if;
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using v_uid;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    execute 'delete from auth.refresh_tokens where user_id = $1' using v_uid;
  end if;

  begin
    execute 'update auth.users set banned_until = ''infinity''::timestamptz where id = $1' using v_uid;
  exception
    when undefined_column then null;
  end;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

notify pgrst, 'reload schema';
