-- Additive migration. Apply using Supabase migrations/SQL editor after review.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  last_active_at timestamptz
);
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ghost_mode_enabled boolean not null default false,
  contextflow_enabled boolean not null default true,
  preferred_ai_mode text not null default 'SHOW_ME' check (preferred_ai_mode in ('SHOW_ME','DO_IT')),
  analytics_enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check(event_type in ('user_login','extension_connected','ai_request_completed','contextflow_suggestion_accepted','browser_action_completed')),
  created_at timestamptz not null default now()
);
-- No user-writable role or user-metadata based authorization.
create table public.admin_roles (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create table public.extension_auth_codes (
  code_hash text primary key check (length(code_hash)=64),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge text not null check(length(challenge)=64), extension_id text not null check(extension_id ~ '^[a-p]{32}$'),
  expires_at timestamptz not null default now() + interval '2 minutes'
);
create table public.extension_sessions (
  token_hash text primary key check(length(token_hash)=64),
  pairing_hash text unique check(pairing_hash is null or length(pairing_hash)=64),
  user_id uuid not null references auth.users(id) on delete cascade,
  extension_id text not null check(extension_id ~ '^[a-p]{32}$'),
  expires_at timestamptz not null default now() + interval '1 hour', created_at timestamptz not null default now()
);
create index usage_events_user_date on public.usage_events(user_id,created_at desc);
create index usage_events_type_date on public.usage_events(event_type,created_at desc);
create index profiles_active on public.profiles(last_active_at);
create index profiles_created on public.profiles(created_at);
create index extension_sessions_user on public.extension_sessions(user_id);
create index extension_auth_codes_user on public.extension_auth_codes(user_id);
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.usage_events enable row level security;
alter table public.admin_roles enable row level security;
alter table public.extension_auth_codes enable row level security;
alter table public.extension_sessions enable row level security;
revoke all on public.profiles,public.user_preferences,public.usage_events,public.admin_roles,public.extension_auth_codes,public.extension_sessions from anon,authenticated;
grant select on public.profiles,public.user_preferences to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant update(ghost_mode_enabled,contextflow_enabled,preferred_ai_mode,analytics_enabled) on public.user_preferences to authenticated;
create policy profile_owner_read on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy profile_owner_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy preferences_owner_read on public.user_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy preferences_owner_update on public.user_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
-- Analytics, roles, auth codes and extension tokens have no direct user policies.
grant all on public.profiles,public.user_preferences,public.usage_events,public.admin_roles,public.extension_auth_codes,public.extension_sessions to service_role;
create function public.navi_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),100));
  insert into public.user_preferences(user_id) values(new.id);
  return new;
end $$;
revoke all on function public.navi_new_user() from public,anon,authenticated;
create trigger navi_signup after insert on auth.users for each row execute function public.navi_new_user();
-- Backfill already registered accounts, without replacing their data.
insert into public.profiles(id,display_name) select id,left(coalesce(raw_user_meta_data->>'display_name',''),100) from auth.users on conflict do nothing;
insert into public.user_preferences(user_id) select id from auth.users on conflict do nothing;
create function public.navi_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create trigger profile_updated before update on public.profiles for each row execute function public.navi_updated_at();
create trigger preferences_updated before update on public.user_preferences for each row execute function public.navi_updated_at();
create function public.navi_touch_activity() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles set last_active_at=now() where id=auth.uid() and (last_active_at is null or last_active_at < now()-interval '5 minutes');
end $$;
revoke all on function public.navi_touch_activity() from public,anon;
grant execute on function public.navi_touch_activity() to authenticated;
create function public.navi_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.admin_roles where user_id=auth.uid())
$$;
revoke all on function public.navi_is_admin() from public,anon;
grant execute on function public.navi_is_admin() to authenticated;
create function public.navi_admin_report() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.navi_is_admin() then raise exception 'administrator required' using errcode='42501'; end if;
 return jsonb_build_object(
  'total_users',(select count(*) from auth.users where not is_anonymous),
  'signups_7d',(select count(*) from auth.users where not is_anonymous and created_at>=now()-interval '7 days'),
  'active_7d',(select count(*) from public.profiles where last_active_at>=now()-interval '7 days'),
  'ai_requests',(select count(*) from public.usage_events where event_type='ai_request_completed'),
  'extension_connections',(select count(*) from public.usage_events where event_type='extension_connected'),
  'users',coalesce((select jsonb_agg(r) from (select p.id,p.display_name,u.email,u.created_at,p.last_active_at from public.profiles p join auth.users u on p.id=u.id where not u.is_anonymous order by u.created_at desc limit 100) r),'[]'::jsonb));
end $$;
revoke all on function public.navi_admin_report() from public,anon;
grant execute on function public.navi_admin_report() to authenticated;
-- Atomic, single-use PKCE exchange; only the trusted web server can invoke this.
create function public.navi_exchange_extension(p_code_hash text,p_challenge text,p_extension_id text,p_token_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 delete from public.extension_auth_codes where code_hash=p_code_hash and challenge=p_challenge and extension_id=p_extension_id and expires_at>now() returning user_id into owner_id;
 if owner_id is null then raise exception 'invalid authorization code' using errcode='28000'; end if;
 if not exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null and not is_anonymous) then raise exception 'verified account required'; end if;
 delete from public.extension_sessions where user_id=owner_id and (extension_id=p_extension_id or expires_at<=now());
 insert into public.extension_sessions(token_hash,user_id,extension_id) values(p_token_hash,owner_id,p_extension_id);
 return owner_id;
end $$;
revoke all on function public.navi_exchange_extension(text,text,text,text) from public,anon,authenticated;
grant execute on function public.navi_exchange_extension(text,text,text,text) to service_role;
-- Analytics insertion is server-only; consent is rechecked in the same database transaction.
create function public.navi_record_usage(p_user_id uuid,p_event_type text) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.user_preferences where user_id=p_user_id and analytics_enabled) then
  insert into public.usage_events(user_id,event_type) values(p_user_id,p_event_type);
 end if;
end $$;
revoke all on function public.navi_record_usage(uuid,text) from public,anon,authenticated;
grant execute on function public.navi_record_usage(uuid,text) to service_role;

-- Users can revoke only their own extension sessions; no token material is exposed.
create function public.navi_revoke_extensions() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 delete from public.extension_sessions where user_id=auth.uid();
 delete from public.extension_auth_codes where user_id=auth.uid();
end $$;
revoke all on function public.navi_revoke_extensions() from public,anon;
grant execute on function public.navi_revoke_extensions() to authenticated;

-- A server-minted completion receipt can contribute at most one optional event.
create table public.usage_receipts (nonce uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now());
alter table public.usage_receipts enable row level security;
revoke all on public.usage_receipts from public,anon,authenticated;
grant all on public.usage_receipts to service_role;
create index usage_receipts_user on public.usage_receipts(user_id);
create function public.navi_redeem_usage(p_nonce uuid,p_user_id uuid,p_event_type text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_event_type not in ('contextflow_suggestion_accepted','browser_action_completed') then raise exception 'unsupported completion';end if;
 insert into public.usage_receipts(nonce,user_id) values(p_nonce,p_user_id) on conflict do nothing;
 if not found then return;end if;
 perform public.navi_record_usage(p_user_id,p_event_type);
end $$;
revoke all on function public.navi_redeem_usage(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.navi_redeem_usage(uuid,uuid,text) to service_role;

commit;
