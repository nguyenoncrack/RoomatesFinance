-- Exercises the per-account rate limits. Expected rejections print as ERROR lines.
\set ON_ERROR_STOP 0
\set VERBOSITY terse
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a4','alex@rl.com','{"display_name":"Alex"}'),
 ('00000000-0000-0000-0000-0000000000b4','ben@rl.com','{"display_name":"Ben"}');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a4',false);

-- Households: 10 an hour. The 11th is refused with a friendly message.
do $$
declare n int := 0;
begin
  for i in 1..10 loop
    perform create_household('House ' || i);
    n := n + 1;
  end loop;
  raise notice 'created % households', n;
end $$;
select create_household('One too many');
select count(*) = 10 as ten_households from households where created_by = '00000000-0000-0000-0000-0000000000a4';

-- Another person is unaffected.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b4',false);
select create_household('Ben''s house') is not null as ben_can_still_create;

-- Expenses: 300 per 10 minutes.
select id as bhid from households where created_by = '00000000-0000-0000-0000-0000000000b4' limit 1 \gset
do $$
declare
  hid uuid;
  n int := 0;
begin
  select id into hid from households where created_by = '00000000-0000-0000-0000-0000000000b4' limit 1;
  for i in 1..300 loop
    perform create_expense(hid, 'Item ' || i, 100, '00000000-0000-0000-0000-0000000000b4', 'food', '', current_date, 'equal',
      '[{"user_id":"00000000-0000-0000-0000-0000000000b4","share_cents":100}]');
    n := n + 1;
  end loop;
  raise notice 'created % expenses', n;
end $$;
select create_expense(:'bhid','Item 301',100,'00000000-0000-0000-0000-0000000000b4','food','',current_date,'equal',
  '[{"user_id":"00000000-0000-0000-0000-0000000000b4","share_cents":100}]');
select count(*) = 300 as exactly_300_expenses from expenses where household_id = :'bhid';

-- Counts are per scope: invitations are a separate budget and still work.
select (select count(*) from create_invitation(:'bhid')) = 1 as invite_still_works;

-- Admin/SQL-editor work (no signed-in user) is never throttled.
reset role;
insert into households (name, created_by) values ('Admin made', '00000000-0000-0000-0000-0000000000b4') returning name;
select count(*) = 0 as admin_not_counted from rate_limit_hits where user_id is null;

-- Once the window passes, the limit clears: age Ben's counts and he can act again.
update rate_limit_hits set bucket = bucket - interval '2 hours' where user_id = '00000000-0000-0000-0000-0000000000a4';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a4',false);
select create_household('After the window') is not null as allowed_after_window;

-- Clients can't read or change the counters.
select count(*) from rate_limit_hits;
delete from rate_limit_hits;
