-- Exercises recipient confirmation. Expected rejections print as ERROR lines.
\set ON_ERROR_STOP 0
\set VERBOSITY terse
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a2','alex@c.com','{"display_name":"Alex"}'),
 ('00000000-0000-0000-0000-0000000000b2','ben@c.com','{}'),
 ('00000000-0000-0000-0000-0000000000e2','eve@c.com','{}');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select create_household('Confirm House') as hid \gset
select token from create_invitation(:'hid') \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false);
select accept_invitation(:'token') = :'hid' as ben_joined;
-- Ben owes Alex 40.00
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select create_expense(:'hid','Dinner',8000,'00000000-0000-0000-0000-0000000000a2','food','',current_date,'equal',
 '[{"user_id":"00000000-0000-0000-0000-0000000000a2","share_cents":4000},{"user_id":"00000000-0000-0000-0000-0000000000b2","share_cents":4000}]') is not null as dinner;

-- Ben (payer) asks for "completed" but it's saved pending, and Alex is notified.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false);
select record_settlement(:'hid','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2',4000,'venmo','completed','dinner',
  '22222222-2222-2222-2222-222222222222') as sid \gset
select status = 'pending' as payer_record_is_pending from settlements where id = :'sid';
select member_net_balance(:'hid','00000000-0000-0000-0000-0000000000b2') = -4000 as balance_unchanged_while_pending;
-- Retry returns the same row; a second identical payment while one waits is refused.
select record_settlement(:'hid','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2',4000,'venmo','pending',null,
  '22222222-2222-2222-2222-222222222222') = :'sid' as retry_same_row;
select record_settlement(:'hid','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2',4000,'venmo','pending',null,null);
-- Ben sees no notification of his own; he can't accept his own payment.
select count(*) = 0 as payer_not_notified from notifications;
select set_settlement_status(:'sid','completed');

-- Outsider can't touch it.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e2',false);
select set_settlement_status(:'sid','completed');

-- Alex (recipient) has a request and accepts; Ben is notified and balances move.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select count(*) = 1 as recipient_has_request from notifications where kind = 'settlement_requested' and settlement_id = :'sid';
select set_settlement_status(:'sid','completed');
select status = 'completed' and responded_by = '00000000-0000-0000-0000-0000000000a2' as accepted from settlements where id = :'sid';
select read_at is not null as request_cleared from notifications where kind = 'settlement_requested' and settlement_id = :'sid';
-- Accepting again is a no-op; rejecting after accepting is refused.
select set_settlement_status(:'sid','completed');
select set_settlement_status(:'sid','rejected');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false);
select count(*) = 1 as payer_told_accepted from notifications where kind = 'settlement_accepted';
select member_net_balance(:'hid','00000000-0000-0000-0000-0000000000b2') = 0 as balance_settled;

-- A second payment that Alex rejects: balances stay put and Ben is told.
select record_settlement(:'hid','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2',1500,'cash','pending',null,null) as sid2 \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select set_settlement_status(:'sid2','rejected');
select status = 'rejected' as rejected from settlements where id = :'sid2';
select member_net_balance(:'hid','00000000-0000-0000-0000-0000000000b2') = 0 as rejected_did_not_move;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b2',false);
select count(*) = 1 as payer_told_rejected from notifications where kind = 'settlement_rejected';
-- Rejected frees the slot: the same amount can be sent again.
select record_settlement(:'hid','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2',1500,'cash','pending',null,null) as sid3 \gset
-- The payer can cancel their pending payment; the recipient is told.
select set_settlement_status(:'sid3','voided');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a2',false);
select count(*) = 1 as recipient_told_cancelled from notifications where kind = 'settlement_cancelled';
-- Recipient recording "they paid me" can complete directly (they're the one confirming).
select record_settlement(:'hid','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2',500,'cash','completed',null,null) as sid4 \gset
select status = 'completed' as recipient_record_completes from settlements where id = :'sid4';
-- Users only see their own notifications, and can mark them read.
select count(*) = count(*) filter (where user_id = '00000000-0000-0000-0000-0000000000a2') as only_own from notifications;
select mark_notifications_read();
select count(*) = 0 as all_read from notifications where read_at is null;
