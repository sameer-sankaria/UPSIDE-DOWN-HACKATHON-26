# Phase 7 — implementation and verification

Work branch: `feature/phase-7-assistant-reliability`, based on clean `main` at `cd6fd66`. See [baseline audit](PHASE7-BASELINE.md). No commit, push, merge, deployment, environment edit, migration, or marketing UI change is part of this work.

**Phase 7 is not fully production-verified.** Live Gemini credentials, Supabase configuration and authenticated native Chrome/real-microphone acceptance remain required. Mocked tests do not prove those integrations.

## Existing versus new

Phases 1–6A already provided the landing/dashboard, deterministic ContextFlow and opt-in Ghost, server-side Gemini structured planning, document-bound extraction, paired dashboard approval engine, Supabase SSR/RLS/accounts/admin, opaque extension sessions, Side Panel chat and push-to-talk. No separate Phase 6B implementation was found.

New implementation reuses those modules:

- Six bounded conversation messages in `chrome.storage.session`, tied to verified account ID and a 30-minute expiry. Each request explicitly consents to sharing this context. Account changes cannot inherit another user's turns. Clear conversation, session clearing and permission changes discard the relevant context. Ordinary Stop rejects pending work while retaining conversation. Page summaries and email drafts are not retained as conversation messages.
- Follow-up YouTube searches resolve from confirmed user turns only. “Find Starboy by The Weeknd” proposes YouTube results. “Play that song” resolves only when an earlier user turn names a song; nothing claims playback. A proposal does not establish execution success. Model conversation evidence cannot grant authority.
- Normal chat and summaries use empty action lists. Unique authorized tab titles or explicit numbers resolve switch/close requests; ambiguous references ask for clarification. List/search operates only on included, enrolled tab metadata.
- **Summarize authorized page** captures the currently active, enrolled document only after the sharing checkbox and existing document-specific content grant. Reuses the exact document-ID, URL-hash, visible semantic text, redaction, credential-page and field exclusion checks. No forms, passwords, private values, hidden areas, frames or arbitrary script extraction. Snapshot validation runs again before displaying the result. Chrome may require invoking the toolbar again to regain its temporary activeTab grant.
- Email generation uses the existing server-only Gemini SDK, shared budget, timeout and strict structured-data validation. Missing recipient asks for an email address; an address is accepted only if explicitly supplied, never inferred from a name. The Side Panel provides editable To/Subject/Body fields. **Review Gmail compose action** builds a fixed Gmail compose URL locally and stages it in the same action engine; **Approve this action** opens it. NAVI has no send action or Gmail DOM automation. Long drafts can exceed the bounded navigation URL limit and must be shortened or copied manually. Opening is not confirmation that Gmail retained a draft.
- Closing has a separate opt-in, exact tab identity/snapshot, optional Chrome verification permission and per-action approval. The existing engine verifies the tab's absence. Unsaved work may be lost. Dashboard closing remains forbidden. No closing privileges are inferred from metadata or switching permissions.
- Navigation rejects trailing-dot aliases of local/private hostnames; the original validator compared unnormalized hostname suffixes. Public explicit HTTPS URLs retain their existing behavior.
- An engine-local queue prevents concurrent approval replay even when callers omit the outer background mutation queue. Executions queued before Stop retain their cancellation epoch. Once issued, a Chrome operation cannot be undone by cancellation.
- Voice exposes processing after Stop, waits up to two seconds for the recognizer to finish, then recovers to transcript/idle and ignores late events. Existing 15-second utterance limit, track shutdown, editable transcript, generation guards and typed fallback remain. No continuous listening, wake-word service or new Chrome microphone permission.
- Production intelligence APIs now require verified identity even when Supabase is missing. Missing/partial configuration fails closed. Unconfigured local **development** retains its legacy deterministic testing path. Supabase cookies use Secure in production, HttpOnly and SameSite Lax; localhost auth/callback/origin boundaries remain unchanged.

## Results

| Major feature/check | Status and evidence |
| --- | --- |
| Baseline | PASS: 143 tests, sequential TypeScript, production builds, HTTP smoke and isolated PostgreSQL |
| Conversation/follow-up/reference interpretation | PASS automated; NOT TESTED with real Gemini |
| Page summary consent/extraction/validation | PASS mocked orchestration and existing extractor tests; NOT TESTED on an authenticated real Chrome page with Gemini |
| YouTube navigation | PASS exact URL/fallback/approval tests; NOT TESTED real YouTube page/playback (playback unsupported) |
| Email drafts/review | PASS mocked generation, recipient rules, edited-field UI and compose staging; NOT TESTED live Gmail composition; sending unsupported |
| Tab list/search/switch/close | PASS mocked native engine, stale/denied/rejected/replayed cases; NOT TESTED authenticated user toolbar workflow |
| Voice | PASS mocked state/error/cancellation/watchdog; NOT TESTED microphone hardware or speech service |
| Auth/signup/confirmation/login/logout/preferences/admin | PASS existing automated contracts, local SQL/RLS and unauthenticated page behavior; NOT TESTED hosted Supabase |
| Chrome extension startup and sender boundary | PASS: built MV3 extension loaded in actual isolated Chromium; ordinary-tab companion messages rejected |
| Website browser verification | PASS Chromium and WebKit at 1440/1024/768/390: landing, login/signup forms, dashboard login redirect, no uncaught page errors |
| Side Panel document UI | PASS real Chromium at 320/390/768 with explicitly mocked runtime/AI: draft editing, review, reject and clear; no horizontal document overflow |
| Native Chrome Side Panel activation and approval | NOT TESTED with a signed-in account and actual toolbar user gesture |
| Safari | PASS WebKit engine rendering; NOT TESTED shipping Safari/macOS/iOS |
| Production build | PASS: production Next.js and Chrome extension builds |
| TypeScript | PASS: all workspaces, sequentially after production generation |
| Full regression suite | PASS: 162 tests (143 baseline plus 19 new checks) |
| Live HTTP smoke after changes | PASS: existing development contracts and origin/schema rejection |
| Production unauthenticated API denial | PASS: actual temporary production server; account/assistant/companion 401, dashboard/admin redirect, public pages 200 |

The temporary production verification server on port 3100 was stopped; the existing development server on port 3000 was left running. Screenshots and temporary browser scripts are under `/tmp/navi-phase7-browser/`. The first WebKit attempt lacked system libraries; after installation its checks passed. The first parallel baseline build/typecheck raced generated Next files; the sequential rerun passed. A new jsdom assertion initially compared objects from different JavaScript realms; it was corrected to compare their serialized field values.

## UI preservation

No `apps/web/public/onda/`, landing markup, page, global style, design token, navbar, hero, card or scroll-animation file was changed. New styles are in the extension-only Side Panel stylesheet. Existing mobile hero/card fixes from main are retained. Baseline screenshots include desktop and mobile card/hero views. Before/after desktop Chromium and mobile WebKit hero/card screenshots were visually compared; no visible regression was found in the inspected views. Chromium and WebKit browser checks passed at all four viewport widths. No separate existing marketing defect was confirmed in the inspected views; this is not an exhaustive visual audit of every section/scroll state.

## Changed files

- Shared contracts: `packages/shared/src/conversation.ts`, `companion.ts`, `assistant.ts`, `navigation.ts`, `index.ts`.
- Extension: `apps/extension/src/companion.ts`, `assistant-engine.ts`, `background.ts`, `controller.ts`, `session/state.ts`, `sidepanel.ts`, `voice.ts`; `apps/extension/sidepanel.html`, `sidepanel.css`.
- Server: `apps/web/src/server/modules/assistant/provider.ts`, `companion.ts`; `apps/web/src/app/api/companion/route.ts`; `apps/web/src/lib/supabase/config.ts`, `server.ts`; `apps/web/src/proxy.ts`.
- Tests: `tests/phase7.test.ts`, `tests/assistant.test.ts` (dashboard close denial retained explicitly).
- Documentation: this file, `docs/PHASE7-BASELINE.md`, `README.md`.

`next-env.d.ts` is generated during checks and restored to its original development imports; it is not an intended change. No new package/dependency, Chrome permission, database column/migration or token transport was introduced. No credential patterns were found in changed source or browser bundles; no environment files were changed. `git diff --check` passed. Existing assistant API requests and responses remain compatible; companion requests gain bounded optional history/page selection and responses gain optional draft data. Reload the rebuilt extension to use the new companion fields.

## Manual Chrome acceptance checklist

Use a disposable Chrome profile and non-sensitive test tabs. This checklist is **NOT TESTED** until performed against your configured account/provider:

1. Configure the existing untracked server Gemini model/key, Supabase settings and exact `NAVI_EXTENSION_ID` following Phase 5 docs. Use the existing localhost deployment boundary. Apply no new migration for Phase 7. Run `npm run build:extension`, reload `apps/extension/dist`, start `npm run dev`.
2. Signup with a test address, verify the email link, log in, refresh/reopen the dashboard, edit/sync preferences, and log out. Confirm protected dashboard/admin APIs reject missing sessions; ordinary users cannot access admin data. Confirm extension auth callbacks/state/code exchange and logout revoke its session. Check production HTTPS cookie Secure/HttpOnly flags when an appropriate deployment is configured.
3. Invoke the toolbar or configured Ctrl/Command+Shift+Y. Confirm Side Panel opens, Controls opens existing permissions/account UI, and account login/backend connection works. Confirm close/reopen does not expose another account's conversation.
4. With SHOW ME, ask “Open YouTube.” Nothing opens. With DO IT, request again; reject once, then approve a newly requested plan. Grant opening and optional destination verification separately. Confirm only the requested background tab opens and a repeat approval cannot open another.
5. Follow with “Search for JavaScript tutorials.” Check exact YouTube results URL. Try “Find Starboy by The Weeknd.” Check search results and no playback claim. Clear conversation, then try “Play that song”; it must ask for the song instead of guessing.
6. Enroll two tabs. Include metadata, list permitted tabs, search by title, and request a switch. Verify ambiguous same-title tabs require explicit numbers, switching needs its own grant, and unenrolled/incognito/sensitive tabs remain inaccessible.
7. On an enrolled normal article, request a summary without content consent: expect an explanation/error and no text upload. Grant document-specific visible text in Controls, check sharing consent, and click the summary button. Inspect only permitted visible text reaches the backend; ensure inputs/private/credential controls are excluded. Navigate/reload/revoke during a request and confirm no stale result displays. Confirm summary text is absent from retained conversation storage.
8. Draft an email to “my professor”: expect an editable draft and request for recipient address. Enter a test recipient, change subject/body, review then reject. Retry review and approve; verify Gmail shows the edited compose fields. Confirm NAVI never sends. Try header injection and an overly long draft: reject safely; copy/shorten long drafts manually.
9. Use a disposable enrolled tab: ask to close it with closing permission off, then on, rejecting once. Approve a new plan and confirm only that tab closes. Change its URL, revoke its grant or close it before approval: stale plans must fail. Double-click/replay approval and rapidly Stop: no duplicate mutation.
10. Voice: deny permission; retry; test no microphone, no speech and network errors; record one instruction, Stop, edit transcript, Send once. Cancel during permission prompt/listening/processing, hide the panel and reopen. No automatic send, duplicate action or restarted background listening. Typed input must remain usable.
11. Confirm existing popup ContextFlow, Ghost enable/pause/clear/disable, dashboard pairing and approved grouping still work with their original permissions. Check narrow panel widths, normal/reduced motion, desktop/mobile website and Safari separately. Inspect extension errors/network failures before claiming production readiness.

## Limits

- No live Gemini, hosted Supabase, Gmail or user speech-service integration was verified; provider responses and Chrome mutation behavior in unit/UI tests are mocked where noted.
- WebKit is a Safari engine check, not a shipping Safari test. Chrome worker loading is not proof of authenticated Side Panel/microphone acceptance.
- “This page” means the active tab with an existing exact-document grant, not any arbitrary open page. Extraction remains viewport-visible, bounded, heuristic and unsupported on browser pages, PDFs, frames and confidential pages.
- Conversation is six bounded messages, session-only; it is not persistent full chat history or a contacts/music library. Ambiguous references require clarification.
- Only one action per companion plan; no autonomous multi-step workflows, purchases, form submission, email sending or arbitrary generated JavaScript.
- The fixed localhost bridge/callback boundary and process-local Gemini budget remain. A publicly deployed/distributed production service still needs deployment-specific origin/callback setup and operational controls; this phase does not deploy or widen trust boundaries.
