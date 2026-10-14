-- Exercises delete_own_account. Expected rejections print as ERROR lines.
-- Run after stubs + every file in supabase/migrations/ (same DB as the other smokes is fine;
-- these ids don't collide).
\set ON_ERROR_STOP 0
\set VERBOSITY terse
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a3','alex@d.com','{"display_name":"Alex"}'),
 ('00000000-0000-0000-0000-0000000000b3','ben@d.com','{"display_name":"Ben"}'),
 ('00000000-0000-0000-0000-0000000000c3','chris@d.com','{"display_name":"Chris"}'),
 ('00000000-0000-0000-0000-0000000000d3','dana@d.com','{"display_name":"Dana"}');

set role authenticated;

-- Alex owns a household; Ben joins with a $0 balance.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a3',false);
select create_household('Delete House') as hid \gset
select token from create_invitation(:'hid') \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b3',false);
select accept_invitation(:'token') = :'hid' as ben_joined;

-- Sole owner with other members cannot delete.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a3',false);
select delete_own_account();

-- Member with a $0 balance can delete. History stays.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b3',false);
select delete_own_account();
select display_name = 'Deleted user' and deleted_at is not null as ben_anonymized
  from profiles where id = '00000000-0000-0000-0000-0000000000b3';
select left_at is not null as ben_left
  from household_members
  where household_id = :'hid' and user_id = '00000000-0000-0000-0000-0000000000b3';
-- The login itself is gone from auth.users; the profile survives for history. (Checked as admin: a person
-- who has left a household can no longer read it, and clients can't read auth.users at all.)
reset role;
select count(*) = 0 as ben_login_removed from auth.users where id = '00000000-0000-0000-0000-0000000000b3';
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b3',false);
-- Deleted account cannot create a household.
select create_household('Nope');

-- Alex is now the only active roommate and can delete (no other members to orphan).
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a3',false);
select delete_own_account();
reset role;
select count(*) = 0 as alex_login_removed from auth.users where id = '00000000-0000-0000-0000-0000000000a3';
select count(*) = 2 as both_leaves_logged from audit_log where household_id = :'hid' and action = 'leave';
set role authenticated;

-- Outstanding balance blocks. Chris pays $10 split with Dana, then Dana cannot delete.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false);
select create_household('Balance House') as hid2 \gset
select token from create_invitation(:'hid2') \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d3',false);
select accept_invitation(:'token') = :'hid2' as dana_joined;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false);
select create_expense(:'hid2','Snacks',1000,'00000000-0000-0000-0000-0000000000c3','food','',current_date,'equal',
 '[{"user_id":"00000000-0000-0000-0000-0000000000c3","share_cents":500},{"user_id":"00000000-0000-0000-0000-0000000000d3","share_cents":500}]');
select member_net_balance(:'hid2','00000000-0000-0000-0000-0000000000d3') = -500 as dana_owes;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d3',false);
select delete_own_account();
-- Expense row is still there after the blocked attempt.
select count(*) = 1 as expense_kept from expenses where household_id = :'hid2';

-- Recipient records the payment as completed (payer-recorded rows stay pending).
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false);
select record_settlement(:'hid2','00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000c3',500,'cash','completed',null,null);
select member_net_balance(:'hid2','00000000-0000-0000-0000-0000000000d3') = 0 as dana_settled;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d3',false);
select delete_own_account();
reset role;
select count(*) = 0 as dana_login_removed from auth.users where id = '00000000-0000-0000-0000-0000000000d3';
select count(*) = 1 as expense_still_there from expenses where household_id = :'hid2';
select paid_by = '00000000-0000-0000-0000-0000000000c3' as payer_id_unchanged from expenses where household_id = :'hid2';
select display_name = 'Deleted user' as dana_anonymized from profiles where id = '00000000-0000-0000-0000-0000000000d3';
set role authenticated;

-- Deleting a user straight from Supabase Auth (the dashboard) also works and keeps history.
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000e3','eve@d.com','{"display_name":"Eve"}'),
 ('00000000-0000-0000-0000-0000000000f3','fay@d.com','{"display_name":"Fay"}');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e3',false);
select create_household('Dashboard Delete House') as hid3 \gset
select token from create_invitation(:'hid3') \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f3',false);
select accept_invitation(:'token') = :'hid3' as fay_joined;
select create_expense(:'hid3','Pizza',2000,'00000000-0000-0000-0000-0000000000f3','food','',current_date,'equal',
 '[{"user_id":"00000000-0000-0000-0000-0000000000e3","share_cents":1000},{"user_id":"00000000-0000-0000-0000-0000000000f3","share_cents":1000}]') is not null as pizza;
reset role;
-- Owner Eve is removed from the dashboard while Fay is still in the house.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000e3';
select count(*) = 0 as eve_login_gone from auth.users where id = '00000000-0000-0000-0000-0000000000e3';
select display_name = 'Deleted user' and deleted_at is not null as eve_anonymized from profiles where id = '00000000-0000-0000-0000-0000000000e3';
select role = 'owner' as fay_promoted_to_owner from household_members
  where household_id = :'hid3' and user_id = '00000000-0000-0000-0000-0000000000f3';
select count(*) = 1 as pizza_kept from expenses where household_id = :'hid3';
select count(*) = 2 as splits_kept from expense_splits s join expenses e on e.id = s.expense_id where e.household_id = :'hid3';
