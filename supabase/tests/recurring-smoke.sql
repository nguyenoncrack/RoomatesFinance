-- Exercises repeating expenses and the settle day. Run after rpc-smoke.sql's setup pattern:
--   psql -d roommate_test -f supabase/tests/supabase-stubs.sql
--   psql -d roommate_test -f supabase/migrations/<each migration in order>.sql
--   psql -d roommate_test -f supabase/tests/recurring-smoke.sql   # expected rejections print as ERROR lines
\set ON_ERROR_STOP 0
\set VERBOSITY terse
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','alex@r.com','{"display_name":"Alex"}'),
 ('00000000-0000-0000-0000-0000000000b1','ben@r.com','{}'),
 ('00000000-0000-0000-0000-0000000000e1','eve@r.com','{}');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select create_household('Repeat House') as hid \gset
select token from create_invitation(:'hid') \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
select accept_invitation(:'token') = :'hid' as ben_joined;

-- Date math: monthly clamps to short months and returns to the anchor.
select next_recurring_date('2027-01-31','monthly',31) = '2027-02-28' as clamp_feb,
       next_recurring_date('2027-02-28','monthly',31) = '2027-03-31' as back_to_31,
       next_recurring_date('2026-10-14','weekly',14) = '2026-10-21' as weekly;

-- Ben sets up weekly groceries that started three weeks ago: the next one was two weeks ago.
select create_recurring_expense(:'hid','Groceries',6000,'00000000-0000-0000-0000-0000000000b1','groceries','','equal',
  '[{"user_id":"00000000-0000-0000-0000-0000000000a1","share_cents":3000},{"user_id":"00000000-0000-0000-0000-0000000000b1","share_cents":3000}]',
  'weekly', current_date - 21) as rid \gset
select next_date = current_date - 14 as next_is_two_weeks_ago from recurring_expenses where id = :'rid';

-- Bad split sum and bad cadence are rejected.
select create_recurring_expense(:'hid','Bad',6000,'00000000-0000-0000-0000-0000000000b1','groceries','','equal',
  '[{"user_id":"00000000-0000-0000-0000-0000000000b1","share_cents":100}]','weekly', current_date);
select create_recurring_expense(:'hid','Bad',6000,'00000000-0000-0000-0000-0000000000b1','groceries','','equal',
  '[{"user_id":"00000000-0000-0000-0000-0000000000b1","share_cents":6000}]','daily', current_date);

-- Catch-up adds the occurrences 14 days ago, 7 days ago and today; a second run adds nothing.
select run_due_recurring(:'hid', current_date) = 3 as caught_up_three;
select run_due_recurring(:'hid', current_date) = 0 as second_run_noop;
select count(*) = 3 as three_expenses from expenses where household_id = :'hid' and title = 'Groceries';
select next_date = current_date + 7 as next_is_next_week from recurring_expenses where id = :'rid';
-- Clients can't run ahead of real time.
select run_due_recurring(:'hid', current_date + 30) = 0 as future_clamped;

-- Outsiders can't see, run or stop it.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false);
select count(*) = 0 as eve_sees_nothing from recurring_expenses;
select run_due_recurring(:'hid', current_date);
select stop_recurring_expense(:'rid');

-- Settle day: owner only, validated.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false);
select set_settle_schedule(:'hid','monthly',1);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
select set_settle_schedule(:'hid','monthly',31);
select set_settle_schedule(:'hid','weekly',0);
select settle_cadence = 'weekly' and settle_day = 0 as settle_set from households where id = :'hid';
select set_settle_schedule(:'hid',null,null);
select settle_cadence is null as settle_cleared from households where id = :'hid';

-- The owner can stop Ben's series; stopped series are no longer run.
select stop_recurring_expense(:'rid');
select stopped_at is not null as stopped from recurring_expenses where id = :'rid';
select run_due_recurring(:'hid', current_date + 1) = 0 as stopped_not_run;
