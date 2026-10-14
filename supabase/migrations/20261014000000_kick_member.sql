-- Owner removes another roommate. Same settlement rule as leave_household:
-- their history stays, and a non-zero balance blocks the removal.

create or replace function public.kick_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := public.require_user();
  v_target public.household_members%rowtype;
  v_balance bigint;
  v_name text;
begin
  perform 1 from public.households where id = p_household_id for update;
  if public.member_role(p_household_id, v_uid) is distinct from 'owner' then
    raise exception 'Only the household owner can remove a roommate' using errcode = '42501';
  end if;
  if p_user_id = v_uid then
    raise exception 'You can''t remove yourself. Leave the household instead' using errcode = '22023';
  end if;

  select * into v_target from public.household_members
    where household_id = p_household_id and user_id = p_user_id and left_at is null
    for update;
  if not found then
    raise exception 'That roommate isn''t in this household' using errcode = 'P0002';
  end if;

  v_balance := public.member_net_balance(p_household_id, p_user_id);
  if v_balance <> 0 then
    raise exception 'Settle their balance (% cents) before removing them', v_balance using errcode = 'P0001';
  end if;

  update public.household_members set left_at = now(), role = 'member' where id = v_target.id;
  select display_name into v_name from public.profiles where id = p_user_id;
  insert into public.audit_log (household_id, actor_id, entity_type, entity_id, action, after)
  values (p_household_id, v_uid, 'member', p_user_id, 'kick', jsonb_build_object('name', v_name));
end;
$$;

revoke execute on function public.kick_member(uuid, uuid) from public, anon;
grant execute on function public.kick_member(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
