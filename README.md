# NAVI OS — Phase 4 Gemini assistant & approved browser actions

TypeScript npm-workspaces monorepo: `apps/web`, `apps/extension`, `packages/shared`.

NAVI OS combines the original Onda-based landing page, a functional dashboard assistant, and a Chrome extension with explicit per-tab permissions. Phase 4 adds server-side Gemini planning, SHOW ME explanations, DO IT approvals, authorized-context summaries, and a bounded extension action engine. Existing deterministic ContextFlow and Ghost behavior remains available when Gemini is absent, fails, or has no remote-data consent.

The existing Phase 1 ping contract is unchanged. Dashboard actions use a separate opt-in pairing token issued by the extension popup, bound to one exact localhost dashboard tab for 30 minutes. Tokens stay in browser session memory and are never sent to Gemini. The dashboard requires explicit consent before sending captured browser data to Google; ContextFlow/Ghost remote suggestions have their own popup consent switch, off by default.

See [Phase 4 setup, architecture, security, verification, and limitations](docs/PHASE4-VERIFICATION.md). The source template remains intact; template license and credits are served from `apps/web/public/onda/`.

## Gemini configuration

Create an untracked `apps/web/.env.local` with:

```dotenv
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-3.6-flash
NAVI_EXTENSION_ID=your_32_character_chrome_extension_id
```

Choose a model supported by your Google account and the Gen AI `generateContent` API. `GEMINI_MODEL` is required; no model is silently selected. The key is read only by the server and never included in a public variable or extension bundle. Restart the server after configuration changes. Do not commit `.env.local` or credentials. Without a key/model the assistant visibly uses deterministic fallback; it does not fabricate a summary.

## Preview

```sh
npm ci
npm run build:extension
npm run dev
# Website:   http://localhost:3000
# Dashboard: http://localhost:3000/dashboard
```

For production, run `npm run build` followed by `npm start`. Follow the extension setup below to exercise the real browser features. You can check backend health without installing the extension. Extension connection requires Chrome, the unpacked extension, its ID, and the exact localhost origin.

See [docs/PHASE3-VERIFICATION.md](docs/PHASE3-VERIFICATION.md) for implementation details and verification limits.

## Setup

Use Node **22.22.2+ within the Node 22 LTS line** (recommended, `.nvmrc` selects 22), or Node 24.15+ / 26+. The development-only DOM testing library determines this minimum. npm 10+ is supported.

From this directory:

```sh
npm ci
npm run build:extension
```

1. In Chrome 120+, open `chrome://extensions`, enable Developer mode, and **Load unpacked** from `apps/extension/dist`. For an existing installation, click Reload after rebuilding. Check that the extension has no Errors entry.
2. Copy NAVI OS's 32-character extension ID.
3. Create **apps/web/.env.local** with the variables above. Set `NAVI_EXTENSION_ID` to that ID. This is a non-secret browser-client allowlist, not a credential.
4. Start or restart the web app:

```sh
npm run dev
```

Use **http://localhost:3000**, not 127.0.0.1 or another port. The server binds to localhost. Next.js development and production builds use its supported webpack option.

```sh
curl http://localhost:3000/api/health
# {"status":"ok","app":"NAVI OS"}
```

No credentials are required. The three analysis endpoints reject extension requests until the ID is configured. The website retains the Phase 1 console diagnostic:

```js
await window.naviOs.pingExtension("YOUR_32_CHARACTER_EXTENSION_ID")
```

The legacy diagnostic remains ping-only. The separate assistant bridge requires popup-issued pairing and explicit action approval.

## Extension workflow

### Authorize one or two tabs and run ContextFlow

1. Open a normal, non-sensitive HTTP(S) page, such as React documentation. Open NAVI OS from Chrome's extension toolbar. Opening the popup supplies Chrome's temporary `activeTab` grant; it does not opt you into Ghost Mode or page extraction.
2. Click **Authorize this tab's title and URL**. This enrolls only that tab for metadata access, for up to 30 minutes. The list displays a redacted title and origin-only URL. Query strings, fragments, credentials, and paths are not stored or sent to the backend.
3. Separately click **Allow visible page text for this tab**. This binds content consent to this specific document and a hash of the current URL. It does not extract or send the page body yet.
4. Optionally repeat steps 1–3 on a second tab. At most ten tabs can be metadata-authorized; an analysis accepts only one or two tabs.
5. Click **Connect local backend** and accept Chrome's optional localhost-only host permission. This grants network access to the local API, not permission to other websites. Connection consent resets with the browser session.
6. Select one or two content-authorized tabs, then click **Extract selected tabs and send sanitized context to local backend**. Only these tabs are injected, in isolated main-frame documents. The extractor reads viewport-visible semantic text, excluding forms, inputs, private regions, hidden content, and child frames. Credential/OTP entry pages are blocked. Output is bounded and redacted again before transmission.
7. Review detected topics, recommendation reasons, heuristic confidence, and the actual proposed search-query strings. No source links are invented and no tabs open automatically.
8. To open searches, separately enable **Allow opening selected search tabs after per-action approval**, choose query checkboxes, and click **Approve opening selected search queries**. Only Google search results pages for those queries open, as background tabs. A pending approval is consumed before execution and expires after five minutes.

Use **Revoke page text** to withdraw content permission, or **Revoke** to withdraw metadata and content permission for a tab. Navigation invalidates content consent; cross-origin navigation or closing a tab removes its enrollment. Reauthorize after navigation. Incognito and known sensitive pages are not supported.

### Ghost Mode

1. Metadata-authorize a GitHub tab and a documentation tab (for example react.dev). Stack Overflow is an additional recognized signal. Page-text permission is unnecessary for Ghost Mode.
2. Click **Enable / resume authorized session monitoring**. Ghost Mode defaults off and observes only enrolled, non-expired tabs, using tab activation, URL/loading changes, and title updates. It does not inspect page contents or every open tab.
3. A deterministic GitHub + documentation combination produces a workspace suggestion. React, TypeScript, Next.js, JavaScript, and generic development topics are supported. Stack Overflow and repeated observations increase a bounded heuristic score; the score is not a calibrated probability.
4. **Send counters to backend for suggestions** optionally sends only site/topic category counters. There is no automatic background upload. Local suggestions use the same deterministic provider as the backend.
5. **Prepare Workspace** opens only the selected search queries after the same separate permission and explicit approval described above. It does not run code, arrange windows, or execute tasks. **Not Now** dismisses the suggestion for this session.
6. **Pause** stops observations and removes pending Ghost suggestions while retaining counters. **Clear Ghost data and pause** clears counters, dismissals, and pending Ghost suggestions; resume is explicit. **Disable and erase Ghost data** clears those values and stops monitoring.
7. **Revoke all permissions and clear NAVI session** clears all NAVI tab grants, counters, pending suggestions, backend consent, and tab-opening consent, and removes the optional localhost network permission. The extension's installed `activeTab` capability remains, but no NAVI tab is enrolled.

Ghost counters contain categories, topics, counts, and the last-observed timestamp, not sequences of raw URLs, titles, or page text. Identical combinations have a 30-second counting cooldown. There are at most 16 patterns, each with a count capped at 100 and a 30-minute retention window. Enrollment and session state use `chrome.storage.session`, survive service-worker suspension, and reset on browser restart or extension reload. Extracted page text is never stored; it exists only during an explicit request and is discarded afterwards.

## API contracts

All three POST endpoints require JSON, enforce a 32 KiB streamed-body limit, validate strict request and response schemas, return `Cache-Control: no-store`, and do not log or persist request data. Unknown properties and unsupported actions are rejected. There is no permissive CORS policy.

| Endpoint | Input | Output |
| --- | --- | --- |
| `GET /api/health` | None | `{status:"ok",app:"NAVI OS"}` |
| `POST /api/browser-context` | `ContextRequest`: version 1, one/two origin-only tab contexts | `Analysis`: version, supported topics and site categories |
| `POST /api/contextflow` | Same context request | Validated `Recommendations` containing search queries |
| `POST /api/ghost/suggestions` | `GhostRequest`: version 1, up to 16 category/topic patterns | Validated workspace recommendations |

Each context contains `tabId`, redacted `title` (max 200 chars), origin-only `url`, sanitized `text` (max 8,000 chars), and `capturedAt`. Each recommendation includes `id`, `kind`, `title`, `reason`, `confidence`, `topics`, `queries`, and `requiresApproval:true`. Errors have the fixed shape `{error:{code}}`, with 400, 403, 413, 415, or 500 status codes.

The backend accepts the exact web origin `http://localhost:3000`, or the configured extension ID in `X-Navi-Extension-Id` with the matching `chrome-extension://ID` Origin when Chrome supplies it. An extension request without Origin still needs the configured ID header. Arbitrary website origins are rejected even if they spoof that header. Extension host permission permits its cross-origin fetch; websites receive no cross-origin response access.

This is a development browser-origin boundary, not production user authentication. A local process can forge HTTP headers. Backend routes return data and validated plans; only the paired extension executes approved allowlisted actions. Production accounts/authentication and general action execution remain out of scope.

## Permission and privacy boundaries

Required Chrome permissions are **activeTab**, **scripting**, and **storage**. The only optional host permission is `http://localhost/*`. Optional `tabs` metadata permission supports new-tab destination verification and optional `tabGroups` supports approved grouping, both requested explicitly in the pairing popup. There is no `history`, `<all_urls>`, wildcard website host permission, persistent content script, or web-accessible extension resource.

- Metadata: explicit per-tab enrollment plus Chrome's temporary activeTab permission.
- Content: separate per-document consent, exact-URL hash check, document-ID-targeted injection, and URL checks inside and after extraction.
- Monitoring: independent Ghost Mode enable/pause/disable state; no content reads.
- Opening tabs: independent opt-in plus a non-expired pending recommendation and per-action selection/approval. Chrome's `tabs.create` itself needs no broad `tabs` permission.
- Backend transfer: separate localhost permission and session consent; extraction/transmission and Ghost counter transmission require explicit actions.

Only the exact extension popup may send internal commands; content scripts, websites, and other extensions cannot. External messages remain limited by the manifest, exact-origin/top-frame checks, and strict schemas. The separate assistant bridge additionally requires an unexpired popup-issued token bound to one `/dashboard` tab.

Sensitive-data filtering is conservative and heuristic, not a universal PII detector. Custom-rendered secrets, sensitive prose without recognizable markers, occlusion, and unusual page structures may evade detection. Do not authorize confidential pages; this phase is a local-development foundation. Shadow DOM, embedded frames, PDFs, restricted browser pages, and full-page crawling are unsupported. Context changes do not cause automatic text extraction or DOM surveillance.

## Structure and future reasoning provider

- `apps/extension/src/controller.ts`: permission-checked context and approval orchestration.
- `apps/extension/src/context`: self-contained, bounded visible-text extractor.
- `apps/extension/src/session`: bounded session grants and state; no persistent history store.
- `apps/extension/src/ghost`: aggregation and local deterministic suggestions.
- `apps/extension/src/backend`: fixed-endpoint, response-validated local client.
- `apps/extension/src/messaging`: separate internal popup commands, legacy strict pings, and paired assistant transport.
- `apps/web/src/server/api`: shared request-body and response-validation infrastructure.
- `apps/web/src/server/modules`: context analysis, Ghost, ContextFlow, API access policy, and retained reserved orchestration/history boundaries.
- `packages/shared/src/intelligence.ts`, `schemas.ts`, `reasoning.ts`: contracts, strict runtime schemas, deterministic reasoning-provider functions. `assistant.ts` adds strict plans and bridge contracts. The server-only Gemini adapter lives in `apps/web/src/server/modules/assistant`.

## Tests

```sh
npm run typecheck
npm test
npm run build
# With npm run dev running in another terminal:
npm run test:http
```

`npm run build` builds both workspaces. `npm start` serves the production web build. See **TESTING.md** for actual results and **docs/CHROME-VERIFICATION.md** for the real-browser acceptance checklist. Mocked Chrome APIs and DOM layout stubs are clearly distinguished from actual Chrome verification.

Phase 2 is the stopping point.

## References

- [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chrome scripting and document targeting](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Chrome session storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Chrome tab API permissions](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
