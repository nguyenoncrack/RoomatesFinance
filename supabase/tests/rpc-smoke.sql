-- Exercises the RPCs as different users. Lines that should fail print ERROR; see README.
\set ON_ERROR_STOP 0
\set VERBOSITY terse
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','alex@x.com','{"display_name":"Alex"}'),
 ('00000000-0000-0000-0000-00000000000b','ben@x.com','{}'),
 ('00000000-0000-0000-0000-00000000000c','chris@x.com','{}'),
 ('00000000-0000-0000-0000-00000000000d','eve@x.com','{}');
select id, display_name from profiles order by id;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select create_household('UCSB Apartment') as hid \gset
select token from create_invitation(:'hid') \gset
-- direct writes are blocked
insert into expenses(household_id,title,amount_cents,paid_by,category,expense_date,split_method,created_by) values (:'hid','x',1,'00000000-0000-0000-0000-00000000000a','food',current_date,'equal','00000000-0000-0000-0000-00000000000a');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select * from preview_invitation(:'token');
select accept_invitation(:'token') = :'hid' as joined_b;
select accept_invitation(:'token') = :'hid' as rejoin_noop;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select accept_invitation(:'token') = :'hid' as joined_c;
select accept_invitation('bogus');

-- Eve is not a member: sees nothing, can't add
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000d',false);
select count(*) as eve_sees_households from households;
select create_expense(:'hid','hack',100,'00000000-0000-0000-0000-00000000000d','food','',current_date,'equal','[{"user_id":"00000000-0000-0000-0000-00000000000d","share_cents":100}]');

-- Spec example
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select create_expense(:'hid','Groceries',12000,'00000000-0000-0000-0000-00000000000a','groceries','',current_date,'equal',
 '[{"user_id":"00000000-0000-0000-0000-00000000000a","share_cents":4000},{"user_id":"00000000-0000-0000-0000-00000000000b","share_cents":4000},{"user_id":"00000000-0000-0000-0000-00000000000c","share_cents":4000}]',
 null,'11111111-1111-1111-1111-111111111111') as e1 \gset
-- idempotent retry returns same id
select create_expense(:'hid','Groceries',12000,'00000000-0000-0000-0000-00000000000a','groceries','',current_date,'equal',
 '[{"user_id":"00000000-0000-0000-0000-00000000000a","share_cents":4000},{"user_id":"00000000-0000-0000-0000-00000000000b","share_cents":4000},{"user_id":"00000000-0000-0000-0000-00000000000c","share_cents":4000}]',
 null,'11111111-1111-1111-1111-111111111111') = :'e1' as idempotent;
-- bad sums / negatives / non-member participant rejected
select create_expense(:'hid','Bad',12000,'00000000-0000-0000-0000-00000000000a','groceries','',current_date,'equal','[{"user_id":"00000000-0000-0000-0000-00000000000a","share_cents":11999}]');
select create_expense(:'hid','Neg',-5,'00000000-0000-0000-0000-00000000000a','groceries','',current_date,'equal','[{"user_id":"00000000-0000-0000-0000-00000000000a","share_cents":-5}]');
select create_expense(:'hid','Neg2',100,'00000000-0000-0000-0000-00000000000a','groceries','',current_date,'custom','[{"user_id":"00000000-0000-0000-0000-00000000000a","share_cents":150},{"user_id":"00000000-0000-0000-0000-00000000000b","share_cents":-50}]');
select create_expense(:'hid','Outsider',100,'00000000-0000-0000-0000-00000000000a','groceries','',current_date,'equal','[{"user_id":"00000000-0000-0000-0000-00000000000d","share_cents":100}]');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select create_expense(:'hid','Electricity',9000,'00000000-0000-0000-0000-00000000000b','utilities','',current_date,'equal',
 '[{"user_id":"00000000-0000-0000-0000-00000000000a","share_cents":3000},{"user_id":"00000000-0000-0000-0000-00000000000b","share_cents":3000},{"user_id":"00000000-0000-0000-0000-00000000000c","share_cents":3000}]') as e2 \gset
select member_net_balance(:'hid','00000000-0000-0000-0000-00000000000a') a, member_net_balance(:'hid','00000000-0000-0000-0000-00000000000b') b, member_net_balance(:'hid','00000000-0000-0000-0000-00000000000c') c;

-- Ben can't edit Alex's expense (not creator/payer/owner)
select update_expense(:'e1','Groceries',100,'00000000-0000-0000-0000-00000000000a','groceries','',current_date,'equal','[{"user_id":"00000000-0000-0000-0000-00000000000a","share_cents":100}]');
-- Chris can't leave with balance
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select leave_household(:'hid');
-- settlements: Chris pays Alex 50 partially as 30 then 20, plus pending to Ben
select record_settlement(:'hid','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000a',3000,'venmo','completed',null,'22222222-2222-2222-2222-222222222222') as s1 \gset
select record_settlement(:'hid','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000a',3000,'venmo','completed',null,'22222222-2222-2222-2222-222222222222') = :'s1' as settle_idempotent;
select record_settlement(:'hid','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000a',2000,'cash','completed',null,null);
select record_settlement(:'hid','00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000b',2000,'zelle','pending',null,null) as s3 \gset
-- third-party recording blocked
select record_settlement(:'hid','00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b',100,'cash','completed',null,null);
select member_net_balance(:'hid','00000000-0000-0000-0000-00000000000c') c_after_partial;
select set_settlement_status(:'s3','completed');
select member_net_balance(:'hid','00000000-0000-0000-0000-00000000000c') c_settled;

-- Alex edits own expense with stale timestamp -> conflict; with fresh -> ok
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select update_expense(:'e1','Groceries',6000,'00000000-0000-0000-0000-00000000000a','groceries','',current_date,'equal','[{"user_id":"00000000-0000-0000-0000-00000000000a","share_cents":2000},{"user_id":"00000000-0000-0000-0000-00000000000b","share_cents":2000},{"user_id":"00000000-0000-0000-0000-00000000000c","share_cents":2000}]',null,'2000-01-01');
select updated_at as ts from expenses where id = :'e1' \gset
select update_expense(:'e1','Groceries',6000,'00000000-0000-0000-0000-00000000000a','groceries','',current_date,'equal','[{"user_id":"00000000-0000-0000-0000-00000000000a","share_cents":2000},{"user_id":"00000000-0000-0000-0000-00000000000b","share_cents":2000},{"user_id":"00000000-0000-0000-0000-00000000000c","share_cents":2000}]',null,:'ts');
select member_net_balance(:'hid','00000000-0000-0000-0000-00000000000c') c_after_edit;
select delete_expense(:'e2');
select count(*) filter (where deleted_at is null) live, count(*) total from expenses;
select action, entity_type from audit_log order by id;
-- internal helper not callable
select expense_json(:'e1');
-- receipts path must be household scoped
select create_expense(:'hid','R',100,'00000000-0000-0000-0000-00000000000a','other','',current_date,'equal','[{"user_id":"00000000-0000-0000-0000-00000000000a","share_cents":100}]','other-household/x.jpg');
-- anon can preview, not accept
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select household_name, is_valid from preview_invitation(:'token');
select accept_invitation(:'token');
