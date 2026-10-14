-- Let a person be deleted from Supabase Auth (dashboard, API, or the in-app "Delete account") without
-- losing the household history they were part of.
--
-- Before this, profiles.id referenced auth.users with ON DELETE CASCADE. Deleting a user tried to
-- delete their profile too, but expenses, splits, settlements and roommate rows still point at that
-- profile (no cascade), so Supabase refused with "Database error deleting user".
--
-- Now the profile outlives the login: dropping that foreign key lets auth.users rows go, and a trigger
-- turns the profile into an anonymous "Deleted user" and removes them from their households.
--
-- Every statement is safe to run again.

alter table public.profiles drop constraint if exists profiles_id_fkey;

create or replace function public.anonymize_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owned record;
begin
  -- Households they owned that still have other roommates pass ownership to the longest-standing member.
  for v_owned in
    select household_id from public.household_members
    where user_id = old.id and role = 'owner' and left_at is null
  loop
    update public.household_members set role = 'owner'
    where id = (
      select id from public.household_members
      where household_id = v_owned.household_id and user_id <> old.id and left_at is null
      order by joined_at
      limit 1
    );
  end loop;

  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action)
  select household_id, old.id, 'member', old.id, 'leave'
  from public.household_members
  where user_id = old.id and left_at is null;

  update public.household_members set left_at = now(), role = 'member'
  where user_id = old.id and left_at is null;

  if to_regclass('public.recurring_expenses') is not null then
    update public.recurring_expenses set stopped_at = now(), stopped_by = old.id
    where stopped_at is null and (created_by = old.id or paid_by = old.id);
  end if;

  update public.household_invitations set revoked_at = now()
  where created_by = old.id and revoked_at is null;

  update public.profiles
  set display_name = 'Deleted user', avatar_url = null, deleted_at = coalesce(deleted_at, now())
  where id = old.id;

  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.anonymize_deleted_user();

-- ---------------------------------------------------------------------------
-- In-app deletion: same checks as before, but the login is now really removed.
-- ---------------------------------------------------------------------------

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

  -- Removing the login fires on_auth_user_deleted, which soft-leaves every household, stops their
  -- repeats, revokes their invites and anonymizes the profile. History stays.
  delete from auth.users where id = v_uid;
  if not found then
    -- No auth row to remove (shouldn't happen): still anonymize so the account is closed.
    update public.profiles set display_name = 'Deleted user', avatar_url = null, deleted_at = coalesce(deleted_at, now())
    where id = v_uid;
  end if;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
revoke execute on function public.anonymize_deleted_user() from public, anon, authenticated;

notify pgrst, 'reload schema';
