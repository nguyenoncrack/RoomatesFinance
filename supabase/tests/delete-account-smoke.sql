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
select delete_own_account() is null as ben_deleted;
select display_name = 'Deleted user' and deleted_at is not null as ben_anonymized
  from profiles where id = '00000000-0000-0000-0000-0000000000b3';
select left_at is not null as ben_left
  from household_members
  where household_id = :'hid' and user_id = '00000000-0000-0000-0000-0000000000b3';
select email like 'deleted-%@deleted.invalid' as ben_email_freed
  from auth.users where id = '00000000-0000-0000-0000-0000000000b3';
-- Deleted account cannot create a household.
select create_household('Nope');

-- Alex is now the only active roommate and can delete (no other members to orphan).
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a3',false);
select delete_own_account() is null as alex_deleted_solo;
select action from audit_log where household_id = :'hid' and action = 'leave' order by id;

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
select delete_own_account() is null as dana_deleted_after_settle;
select count(*) = 1 as expense_still_there from expenses where household_id = :'hid2';
select paid_by = '00000000-0000-0000-0000-0000000000c3' as payer_id_unchanged from expenses where household_id = :'hid2';
select display_name from profiles where id = '00000000-0000-0000-0000-0000000000d3';
