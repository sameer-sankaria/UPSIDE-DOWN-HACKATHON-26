# Phase 6A — Interactive Chrome browser companion

## Branch and baseline

Work is on `feature/phase-6a-browser-companion`. The working tree was clean before implementation. Baseline `npm test` passed all 110 tests and the baseline production build passed. No branch was merged or pushed.

## Implemented

- Persistent Chrome Side Panel document with NAVI's black/violet identity, conversation messages, clear request status, editable instruction/transcript, explicit approval/rejection, and Chrome execution feedback.
- Toolbar activation through `sidePanel.setPanelBehavior` and the `open-companion` command. Default shortcut: **Ctrl+Shift+Y**, **Command+Shift+Y** on macOS. Configure conflicts or alternatives at `chrome://extensions/shortcuts`; no system-wide interception.
- Existing popup controls are retained as an extension-owned frame opened by **Controls**. Account login/logout, permissions, ContextFlow, Ghost Mode, session clearing, and website pairing retain their existing implementation.
- Push-to-talk using feature-detected `SpeechRecognition` / `webkitSpeechRecognition`. Microphone access is requested only after a click. Recognition is non-continuous, stops after one utterance or 15 seconds, and never submits a transcript automatically. Users can stop, edit, cancel, or type instead. Pending microphone grants and late recognition callbacks cannot restart cancelled listening.
- Optional `Hey Buddy` prefix is removed from confirmed instructions. It is not a background wake word.
- Normal single-turn Gemini chat, SHOW ME explanations, and DO IT plans through the existing server-side SDK provider, auth boundary, structured response validation, budget, and timeout. `/api/companion` adapts that provider; it does not introduce a second provider implementation.
- At most **one** proposed action: Google search, explicitly requested known website/public HTTPS URL, or an enrolled existing-tab switch. No automatic action execution. Summarization, grouping, email composition/sending, DOM automation, and autonomous workflows are unavailable in the companion.

Known websites: YouTube, Instagram, Gmail, and GitHub. Examples:

```text
Hey Buddy, open YouTube.
Open Instagram
Open Gmail
Open https://example.com/docs
Search for React tutorials
Switch to my GitHub tab
```

A switch needs authorized metadata and the separate switch grant. A new tab/search needs the existing opening grant and optional Chrome `tabs` destination-verification permission. The exact proposed URL/query/tab is shown before approval.

## Loading and setup

Keep the Phase 4/5 Gemini and Supabase environment configuration and migrations. No new environment variables, database schema, libraries, or dependencies were added.

```sh
npm ci
npm run build:extension
npm run dev
```

1. Use desktop Chrome 120+. Open `chrome://extensions`, enable Developer mode, and load/reload `apps/extension/dist`. Accept the added `sidePanel` capability if Chrome requests extension re-enablement. Check manifest/service-worker errors.
2. Keep the web app at **http://localhost:3000**. Set `NAVI_EXTENSION_ID` to the actual loaded extension ID and restart the web server. Complete the existing Phase 5 account setup; live account authentication is required in the companion, even though the unconfigured legacy API development path remains available separately.
3. Click NAVI's toolbar action. It now opens the Side Panel. Open **Controls**, connect the local backend, and sign in through the existing website auth window. The extension stores only its existing scoped session credential, not Supabase access/refresh tokens. Return with **Back to companion**.
4. Enable **Allow approved new tabs and searches** and grant destination verification if desired. Enable switching separately if desired. Set these permissions before requesting a plan; changing them invalidates pending approvals.
5. To switch existing tabs, use Controls to enroll the target tab's metadata. Invoke NAVI on that active tab to obtain Chrome's temporary `activeTab` grant; repeat enrollment for other targets as needed. Then check **Include authorized tab metadata**. The companion never reads page text.
6. Select SHOW ME or DO IT, type an instruction, consent to the current backend request, and send. For DO IT, review and click **Approve this action** or **Reject**. The native panel does not need the website's manual pairing token; it is authenticated through its own exact extension-page sender and scoped account session. The existing website dashboard/pairing flow remains unchanged.
7. For voice, choose **Voice**, grant microphone access, speak one instruction, then stop/edit the transcript and press **Send instruction** to confirm. **Cancel transcript** restores the prior typed draft. Speech processing may use Chrome's remote recognition service; availability depends on Chrome, platform, network, and policy. Typed input always remains available.
8. Close with Chrome's Side Panel X and reopen from toolbar/shortcut. The in-panel close button uses the supported close API when present and falls back on older Chrome. Conversation text is document-local and clears on reload/destruction; no conversation database or background recording was added.

For production preview: `npm run build`, then `npm start`.

## Reuse and security

`CompanionController` uses Phase 5 `syncAccount`, the existing authorized backend client, and Phase 4 `AssistantEngine`. Native companion grants are separate from website grants, bound to the authenticated account, and stored in browser session state. State writes and Chrome operations use the existing serialization queue; the model request waits outside that queue so Stop can abort it promptly. Account and permission changes invalidate work, and authentication is rechecked after model generation and before approval execution.

Only exact `sidepanel.html` messages from this extension, with no tab/content-script sender, reach companion commands. Public websites, external messaging, and other extension pages cannot send these commands. The original ping and website bridge boundaries remain intact.

URLs must be HTTPS with no credentials, control characters, backslashes, alternate ports, local-name suffixes, or IP literals. The model's `open_url` must exactly match the known site or explicit URL in the confirmed instruction. This is syntactic validation, not DNS reputation checking. The website dashboard retains its original origin-only action policy; it cannot use the new companion URL capability.

The shared action engine checks grants and snapshots, consumes approval before calling Chrome, rejects replay, and verifies created tab destination or active-tab state. Verification confirms Chrome's requested state, not successful page loading or page contents. Redirects or browser failures can yield a failed verification after a tab was created; inspect Chrome before retrying. Stop cannot undo an API call already issued.

Model output and transcripts are rendered as text, not executable HTML. No arbitrary scripts, broad content scripts, webpage extraction, new privileged keys, or database changes were added. Microphone streams are stopped and recognition callbacks are invalidated on cancellation/closure. Browser speech recognition can be unavailable or denied in extension contexts; the UI reports this and keeps typed input.

## Automated verification

- Baseline: 110 tests and production build passed before implementation.
- `npm test`: **141 passed**, including the original regression coverage and new companion/voice/DOM tests.
- `npm run typecheck`: all workspaces passed.
- `npm run build`: production Next.js and extension passed; `npm run build:extension` passed again after final panel changes.
- `npm run test:db`: existing isolated PostgreSQL account/RLS assertions passed. No database migration changed or hosted database was accessed.
- `npm run test:http`: passed against a separate production server on localhost:3106, including `/api/companion`, existing intelligence APIs, account gates, pages, assets and rejected origins/payloads. No live credentials were used.
- Client/extension artifacts contained no Gemini or Supabase server credential identifiers; `git diff --check` passed.
- Companion tests cover manifest/shortcut registration, trusted messaging, URL schemes and destination substitution, dashboard scope preservation, metadata-only requests, authentication failures, Gemini failure/fallback, SHOW ME, approval/rejection/replay, permissions, verified native navigation/switching, cancellation, voice state/permission/error handling, and rendered DOM approval flow.
- Tests mock Chrome and model calls; they do not prove live Chrome Side Panel, microphone, account login, or Gemini service behavior.

## Manual Chrome acceptance checklist — not yet performed

1. Reload extension without errors. Toolbar opens the panel, which stays available while switching tabs. Close/reopen works. Configure the command at `chrome://extensions/shortcuts` and test it on the current platform.
2. Controls opens the original UI. Backend connection, website login, preference sync, Ghost opt-in/pause/disable, ContextFlow, clear session, and dashboard pairing still work. Unauthenticated/expired-account companion requests fail with a visible error.
3. Send ordinary chat in SHOW ME. A real configured Gemini response is labeled correctly; no Chrome change occurs. Remove/disable the key to verify the explicitly labeled fallback.
4. In DO IT, try YouTube, Instagram, Gmail, a public HTTPS URL, and a Google search. No tab opens before approval. Reject opens nothing. Approval opens one inactive tab and produces verified/failed feedback. A consumed approval cannot replay.
5. Decline opening or destination verification permission; no tab opens. Try unsafe schemes and a model-substituted URL; they are rejected. Gmail navigation must not read the inbox, compose, or send anything.
6. Enroll a GitHub tab and include authorized metadata. Request a switch; it must require the separate switch grant and approval. Closed, revoked, expired, or changed tabs must fail. Switching activates a tab in its existing window and does not automatically focus another window.
7. Voice: no microphone at startup. Test allow/deny, no microphone, recognition network failure, stop, cancel, transcript editing, and typed fallback. Confirm the transcript is never automatically sent. Say “Hey Buddy” and verify it is only a prefix.
8. Stop during a model request, reject a staged action, and close while listening. Nothing should start from stale callbacks. Log out and confirm future plans/approvals fail closed.
9. Regression: use the existing website assistant, extension ContextFlow/Ghost controls, and landing animations. No live browser acceptance item is claimed passed without observation.

## Reference APIs

[Chrome Side Panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [Chrome commands](https://developer.chrome.com/docs/extensions/reference/api/commands), [SpeechRecognition browser reference](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

## Changed-file inventory

- `README.md`
- `apps/extension/manifest.json`
- `apps/extension/scripts/build.mjs`
- `apps/extension/sidepanel.css`
- `apps/extension/sidepanel.html`
- `apps/extension/src/assistant-engine.ts`
- `apps/extension/src/backend/client.ts`
- `apps/extension/src/background.ts`
- `apps/extension/src/companion.ts`
- `apps/extension/src/controller.ts`
- `apps/extension/src/session/state.ts`
- `apps/extension/src/sidepanel.ts`
- `apps/extension/src/voice.ts`
- `apps/web/src/app/api/companion/route.ts`
- `apps/web/src/components/assistant-panel.tsx`
- `apps/web/src/server/modules/assistant/companion.ts`
- `apps/web/src/server/modules/assistant/provider.ts`
- `docs/PHASE6A-VERIFICATION.md`
- `packages/shared/src/assistant.ts`
- `packages/shared/src/companion.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/navigation.ts`
- `scripts/smoke-http.mjs`
- `tests/companion.test.ts`
- `tests/foundation.test.ts`
