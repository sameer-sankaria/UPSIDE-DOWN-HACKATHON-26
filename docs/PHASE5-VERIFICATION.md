# Phase 5 — Supabase accounts, extension identity, private analytics

## Required configuration

Create an **untracked** `apps/web/.env.local` (do not commit it):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://sfczfhjpxunnipdxksew.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
NAVI_EXTENSION_ID=your_32_character_extension_id
GEMINI_API_KEY=your_existing_key
GEMINI_MODEL=your_existing_supported_model
```

The two `NEXT_PUBLIC_` settings are public project configuration, not privileged credentials. The service-role key stays in server modules and is needed for opaque extension sessions and optional analytics. It is never returned to React, bundled into the extension, or sent in page messages. Website auth, own-profile/preferences, and admin RPC reporting use the publishable key plus the verified user's session. No project key or credentials were supplied during this implementation; no hosted data changes were made.

The existing website/extension origin remains **http://localhost:3000**. Changing the public deployment origin requires updating the existing exact-origin protocol/manifest allowlists as a separate deployment task. This phase does not silently widen them.

## Supabase dashboard setup

1. Review and apply `supabase/migrations/202611040001_accounts.sql` through a normal Supabase migration workflow or the SQL editor. It adds tables/functions/policies, backfills existing users, and does not drop existing objects. Do not run the local test bootstrap against Supabase.
2. Keep email/password authentication and **Confirm email** enabled. Keep anonymous sign-ins disabled. Set the minimum password length to at least eight. Configure SMTP for a reliable demonstration; provider email limits still apply.
3. Set Site URL to `http://localhost:3000`. Add exact redirect URLs `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/callback?next=/reset-password`, and `http://localhost:3000/auth/confirm`.
4. For robust server-side confirmation across email clients, set the signup email link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. Set the recovery link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. The default PKCE code callback is supported too, but requires the browser that initiated the request. Do not include access or refresh tokens in templates.
5. Register and confirm the initial administrator normally. As project owner, replace the placeholder in `supabase/INITIAL_ADMIN.sql` with that verified user's email and run it in the SQL editor. Only this trusted role table controls admin access; user metadata cannot promote an account. Revocation is an operator action against that table.
6. Load/reload the built extension, configure `NAVI_EXTENSION_ID`, and restart the server after changing environment variables.

## Run and exercise

```sh
npm ci
npm run build:extension
npm run dev
# http://localhost:3000/signup
# http://localhost:3000/login
# http://localhost:3000/dashboard
# http://localhost:3000/admin   (administrator only)
```

Signup takes name/email/password and requests confirmation. Verify the email, then log in. Forgot/reset password and confirmation resend have their own pages. Sessions persist through Supabase SSR cookies; Proxy refreshes them and server-side route/data checks call `auth.getUser()`. Auth cookies are HttpOnly in this server-driven UI. Logout first revokes extension sessions and then signs out globally. A revocation failure is shown rather than falsely reporting safe logout. Dashboard and admin routes always fail closed, including when account configuration is missing.

Set your display name and preferences in the dashboard. Ghost Mode and optional usage analytics default **off**; ContextFlow defaults on; SHOW ME is the default AI mode. A saved Ghost preference permits later monitoring but never starts it. Browser grants, remote-AI consent, per-action approval, and dashboard pairing remain independent.

In the extension popup, connect the local backend, then **Sign in through website**. It requests optional `identity` permission and uses `chrome.identity.launchWebAuthFlow`. Log in and approve the account connection in the website auth window. A random state and SHA-256 proof verifier protect the flow. Only a one-time code goes to the fixed, configured extension callback; the exchange returns a scoped opaque one-hour credential, **not a Supabase access/refresh token**. The database stores only hashes. No arbitrary page-message token transfer was added.

**Sync account preferences** fetches only the authenticated account's preferences; popup opening also checks the connection. Disabling Ghost in saved preferences stops local monitoring on sync. Enabling it never starts monitoring automatically. Account switching clears old browser grants. Website logout revokes all extension sessions on the server; subsequent authenticated extension interactions fail closed and clear local grants. Expired credentials are removed from extension session storage. Browser restart requires extension sign-in again. Unconfigured localhost intelligence endpoints retain their Phase 4 development behavior; account data, protected routes and admin access never bypass authentication. With Supabase configured, intelligence APIs require a verified website session or valid scoped extension credential.

Continue using the original Phase 4 dashboard pairing token for browser actions. Before browser messages, the website links its pairing capability to the signed-in account through an authenticated server call. The extension independently checks that its account owns that unique capability, preventing cross-account pairing. Supabase tokens do not travel through that bridge. Account authentication does not replace browser authorization. SHOW ME/DO IT, Gemini, ContextFlow, Ghost controls and the landing animations are retained.

## Database and admin security

Tables: `profiles`, `user_preferences`, `usage_events`, `admin_roles`, `extension_auth_codes`, `extension_sessions`, `usage_receipts`. All enable RLS. Foreign keys cascade on account deletion. Profiles do not duplicate email. The signup trigger creates profile/preferences rows, and users can update only their own allowed columns. Immutable identity/timestamps cannot be edited through user privileges. Roles, analytics, auth codes, extension sessions and receipt claims have no direct authenticated/anonymous table access.

`navi_admin_report()` checks the trusted role assignment in the database, then reads real `auth.users`, profiles and consented events. `/admin` also checks authorization server-side. It returns aggregate counts and the latest 100 account rows, including Auth email, only to administrators. No unrestricted client query can enumerate user emails. Reporting failures render an unavailable state, never mock metrics. Recent signup activity is the signup-ordered management table. Operational last-active timestamps represent authenticated app/account use, not browsing history.

Optional analytics includes only user ID, event type, event UUID and timestamp. Database insertion rechecks `analytics_enabled`. Login, extension connection and successful model completion are server-observed. ContextFlow acceptance and browser completion require account-bound, signed, expiring receipts issued for real server-generated suggestions/plans; the database atomically consumes each nonce once. There is no public endpoint accepting an arbitrary event type or user ID. These completion events are client-reported outcomes, not hardware-attested proof that Chrome performed an action; users controlling their own client can misreport a completion of an issued plan. They cannot forge other accounts, privileged roles, login/connection events, or unlimited receipt replays.

Active-user/account counts are operational records, while optional usage totals cover consenting users only. Withdrawal stops new optional events. Account deletion through trusted Supabase administration cascades owned rows; no destructive account-deletion UI or remote destructive change was added.

## Verification

- JavaScript/TypeScript regression and new account-security tests: **110 passed**.
- Additive migration executed successfully in isolated PostgreSQL 17 with a minimal Supabase Auth role/schema fixture.
- Transactional database assertions passed: signup trigger/defaults, own-data RLS, cross-user rejection, immutable columns, email isolation, metadata-based self-promotion rejection, admin report authorization, analytics consent and forgery rejection, receipt replay, PKCE proof/code replay, logout revocation, and deletion cascades.
- `npm run typecheck` passed for all workspaces.
- `npm run build` passed for production Next.js and extension; `npm run build:extension` also passed after final extension safeguards.
- `npm run test:http` passed against the isolated production server on localhost:3105 (port 3000 was occupied): landing/assets, login redirects, protected dashboard/admin/account routes, and legacy intelligence APIs. This used the unconfigured development state, not hosted authentication.
- Browser/extension artifacts contained no service-role key references. `git diff --check` passed.

To reproduce database checks with Docker: `npm run test:db`. It creates a disposable network-isolated PostgreSQL container without mounted project/production data, applies bootstrap/migration/tests, and removes it. This proves PostgreSQL policy behavior, **not hosted Supabase integration or GoTrue email/session behavior**.

Live signup, SMTP verification, recovery emails, hosted RLS/PostgREST behavior, real Chrome identity windows, and full authenticated Gemini/action workflows remain **manual checks** because no Supabase credentials or interactive browser were provided. Do not report these as passed.

## Files

- SQL migration, operator admin assignment, local DB bootstrap/assertions, and `scripts/test-database.mjs`.
- Supabase config/server/service clients, SSR Proxy, auth/session/security/account/receipt/extension helpers.
- Login/signup/verification/recovery pages, confirmation/callback routes, server auth actions, account settings, protected dashboard/admin, extension consent page.
- Account, extension-session and usage-completion APIs; authenticated intelligence API wrapper and optional analytics hooks.
- Extension account module, popup, optional identity permission, authenticated backend requests, preference sync and original permission/approval integrations.
- `tests/accounts.test.ts`, HTTP smoke checks, workspace scripts/dependencies/lockfile, styles, README and this report.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [password-based authentication](https://supabase.com/docs/guides/auth/passwords), [Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity).

## Complete changed-file inventory

- `README.md`
- `apps/extension/manifest.json`
- `apps/extension/popup.html`
- `apps/extension/src/account.ts`
- `apps/extension/src/assistant-engine.ts`
- `apps/extension/src/backend/client.ts`
- `apps/extension/src/background.ts`
- `apps/extension/src/controller.ts`
- `apps/extension/src/messaging/internal.ts`
- `apps/extension/src/popup.ts`
- `apps/extension/src/session/state.ts`
- `apps/web/next-env.d.ts`
- `apps/web/package.json`
- `apps/web/src/app/(auth)/[screen]/page.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/api/account/link/route.ts`
- `apps/web/src/app/api/account/route.ts`
- `apps/web/src/app/api/extension/session/route.ts`
- `apps/web/src/app/api/usage/complete/route.ts`
- `apps/web/src/app/auth/actions.ts`
- `apps/web/src/app/auth/callback/route.ts`
- `apps/web/src/app/auth/confirm/route.ts`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/extension/authorize/actions.ts`
- `apps/web/src/app/extension/authorize/page.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/components/account-settings.tsx`
- `apps/web/src/components/assistant-panel.tsx`
- `apps/web/src/components/auth-form.tsx`
- `apps/web/src/lib/supabase/config.ts`
- `apps/web/src/lib/supabase/server.ts`
- `apps/web/src/lib/supabase/service.ts`
- `apps/web/src/proxy.ts`
- `apps/web/src/server/api/body.ts`
- `apps/web/src/server/api/validated.ts`
- `apps/web/src/server/modules/account/actor.ts`
- `apps/web/src/server/modules/account/analytics.ts`
- `apps/web/src/server/modules/account/extension.ts`
- `apps/web/src/server/modules/account/receipts.ts`
- `apps/web/src/server/modules/account/security.ts`
- `apps/web/src/server/modules/account/session.ts`
- `docs/PHASE5-VERIFICATION.md`
- `package-lock.json`
- `package.json`
- `scripts/smoke-http.mjs`
- `scripts/test-database.mjs`
- `supabase/INITIAL_ADMIN.sql`
- `supabase/migrations/202611040001_accounts.sql`
- `supabase/tests/accounts.sql`
- `supabase/tests/bootstrap.sql`
- `tests/accounts.test.ts`
