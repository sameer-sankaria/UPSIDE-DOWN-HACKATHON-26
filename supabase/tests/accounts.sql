-- Transactional assertions. For local isolated database only; all fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('11111111-1111-4111-8111-111111111111','alice@example.test',now(),'{"display_name":"Alice","role":"admin"}'),
('22222222-2222-4222-8222-222222222222','bob@example.test',now(),'{"display_name":"Bob"}');
do $$ begin
 if (select count(*) from public.profiles where id in('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'))<>2 then raise exception 'profile trigger failed';end if;
 if exists(select 1 from public.user_preferences where ghost_mode_enabled or analytics_enabled) then raise exception 'unsafe opt-in defaults';end if;
 if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','user_preferences','usage_events','admin_roles','extension_auth_codes','extension_sessions','usage_receipts') and c.relrowsecurity)<>7 then raise exception 'missing RLS';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ declare affected integer;begin
 if (select count(*) from public.profiles)<>1 then raise exception 'cross-user profile leak';end if;
 if (select count(*) from public.user_preferences)<>1 then raise exception 'cross-user preferences leak';end if;
 update public.profiles set display_name='Alice updated' where id='11111111-1111-4111-8111-111111111111';get diagnostics affected=row_count;if affected<>1 then raise exception 'own profile update denied';end if;
 update public.profiles set display_name='Attack' where id='22222222-2222-4222-8222-222222222222';get diagnostics affected=row_count;if affected<>0 then raise exception 'cross-user profile update allowed';end if;
 update public.user_preferences set analytics_enabled=true where user_id='22222222-2222-4222-8222-222222222222';get diagnostics affected=row_count;if affected<>0 then raise exception 'cross-user preference update allowed';end if;
 begin update public.profiles set created_at=now();raise exception 'immutable creation timestamp writable';exception when insufficient_privilege then null;end;
 begin select email from auth.users;raise exception 'auth emails exposed';exception when insufficient_privilege then null;end;
 begin insert into public.admin_roles(user_id) values('11111111-1111-4111-8111-111111111111');raise exception 'self promotion allowed';exception when insufficient_privilege then null;end;
 if public.navi_is_admin() then raise exception 'editable metadata promoted administrator';end if;
 begin perform public.navi_admin_report();raise exception 'non-admin report allowed';exception when insufficient_privilege then null;end;
 begin insert into public.usage_events(user_id,event_type) values('22222222-2222-4222-8222-222222222222','user_login');raise exception 'analytics impersonation allowed';exception when insufficient_privilege then null;end;
 begin perform public.navi_record_usage('11111111-1111-4111-8111-111111111111','user_login');raise exception 'client privileged analytics allowed';exception when insufficient_privilege then null;end;
 begin select * from public.extension_sessions;raise exception 'extension credentials exposed';exception when insufficient_privilege then null;end;
 begin perform public.navi_exchange_extension(repeat('a',64),repeat('b',64),repeat('a',32),repeat('c',64));raise exception 'client auth exchange allowed';exception when insufficient_privilege then null;end;
 perform public.navi_touch_activity();
end $$;
reset role;
-- Trusted operator assigns the administrator, never editable user metadata.
insert into public.admin_roles(user_id) values('11111111-1111-4111-8111-111111111111');
set local role authenticated;
do $$ declare report jsonb;begin
 report=public.navi_admin_report();
 if not public.navi_is_admin() or (report->>'total_users')::int<2 or jsonb_array_length(report->'users')<2 then raise exception 'admin report did not read real records';end if;
end $$;
reset role;
-- Consent and single-use receipts enforced at the database boundary.
select public.navi_record_usage('11111111-1111-4111-8111-111111111111','user_login');
do $$ begin if exists(select 1 from public.usage_events) then raise exception 'analytics recorded without consent';end if;end $$;
update public.user_preferences set analytics_enabled=true where user_id='11111111-1111-4111-8111-111111111111';
select public.navi_redeem_usage('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','browser_action_completed');
select public.navi_redeem_usage('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','browser_action_completed');
do $$ begin if (select count(*) from public.usage_events)<>1 then raise exception 'receipt replay counted twice';end if;end $$;
-- Code exchange must match the proof challenge, expire, and consume atomically.
insert into public.extension_auth_codes(code_hash,user_id,challenge,extension_id) values(repeat('a',64),'11111111-1111-4111-8111-111111111111',repeat('b',64),repeat('a',32));
set local role service_role;
do $$ begin
 begin perform public.navi_exchange_extension(repeat('a',64),repeat('d',64),repeat('a',32),repeat('c',64));raise exception 'wrong PKCE challenge accepted';exception when invalid_authorization_specification then null;end;
 perform public.navi_exchange_extension(repeat('a',64),repeat('b',64),repeat('a',32),repeat('c',64));
 begin perform public.navi_exchange_extension(repeat('a',64),repeat('b',64),repeat('a',32),repeat('c',64));raise exception 'authorization code replay accepted';exception when invalid_authorization_specification then null;end;
end $$;
-- A browser pairing capability cannot be linked to two different accounts.
insert into public.extension_sessions(token_hash,user_id,extension_id,pairing_hash) values(repeat('e',64),'22222222-2222-4222-8222-222222222222',repeat('a',32),repeat('f',64));
do $$ begin
 begin update public.extension_sessions set pairing_hash=repeat('f',64) where user_id='11111111-1111-4111-8111-111111111111';raise exception 'cross-account pairing link allowed';exception when unique_violation then null;end;
end $$;
reset role;
set local role authenticated;
select public.navi_revoke_extensions();
reset role;
do $$ begin if exists(select 1 from public.extension_sessions where user_id='11111111-1111-4111-8111-111111111111') then raise exception 'logout did not revoke extension sessions';end if;end $$;
-- Cascades delete all account-owned records, including administrator assignments and events.
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
do $$ begin
 if exists(select 1 from public.profiles where id='11111111-1111-4111-8111-111111111111') or exists(select 1 from public.usage_events where user_id='11111111-1111-4111-8111-111111111111') or exists(select 1 from public.admin_roles) then raise exception 'unsafe deletion cascade';end if;
end $$;
rollback;
select 'PASS: signup triggers, ownership RLS, immutable columns, admin authorization, consent, receipts, PKCE exchange, logout and deletion cascades' as result;
