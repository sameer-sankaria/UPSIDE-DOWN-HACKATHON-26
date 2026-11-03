-- Run only in the Supabase SQL editor as the project owner, after migration.
-- Replace the email with the verified initial administrator's real email.
-- Never expose this operation in a browser API or base it on raw_user_meta_data.
insert into public.admin_roles(user_id)
select id from auth.users
where lower(email)=lower('REPLACE_WITH_VERIFIED_ADMIN_EMAIL')
  and email_confirmed_at is not null and not is_anonymous
on conflict do nothing;
