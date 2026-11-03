# Phase 4 — Gemini assistant and browser action engine

## Run the application

Use the repository's supported Node version (22.22.2+, 24.15+, or 26+).

```sh
npm ci
npm run build:extension
npm run dev
```

Create an **untracked** `apps/web/.env.local` containing `GEMINI_API_KEY`, `GEMINI_MODEL`, and `NAVI_EXTENSION_ID`. The model must support JSON-schema structured output through `generateContent`. An example currently listed stable is `gemini-3.6-flash`; availability depends on your Google project. Neither model nor API key is silently supplied. No secrets were created or committed during implementation.

1. Load/reload `apps/extension/dist` at `chrome://extensions` with Developer mode enabled. Copy its ID into `NAVI_EXTENSION_ID`, and restart the web server.
2. Open normal, non-sensitive pages. Open the popup on each and authorize metadata. Separately permit visible page text on up to two documents for summaries. Connect the local backend.
3. In the popup's dashboard pairing section, optionally allow switching/grouping (requests Chrome's optional `tabGroups` permission), optionally allow new-tab destination verification (requests Chrome’s `tabs` metadata permission, needed for dashboard search/open), then enable pairing. Copy the session pairing token.
4. Open **http://localhost:3000/dashboard** in Chrome. Paste the extension ID and token into the assistant panel. The first valid message binds the token to that dashboard tab. Another tab must get a regenerated token. Tokens expire after 30 minutes; pending plans/captures after five minutes.
5. Click **Read authorized tab metadata**. Optionally select up to two tabs and explicitly request separately permitted page text. This reuses Phase 2's document-bound isolated extraction, sensitive-page refusal, visible semantic text filtering, and redaction.
6. Choose SHOW ME or DO IT, write an instruction, and consent to sending captured context to Google Gemini. Generate a plan. No action runs at this stage.
7. SHOW ME displays the summary, steps, and proposed actions without execution controls. DO IT stages a validated plan and requires selecting individual actions and clicking **Approve and execute**. Search/opening additionally needs the existing popup opening permission; switching/grouping needs the pairing management opt-in.
8. Inspect verified/failed/cancelled results. **Read session action log** recovers the last batch after reload/reconnection. **Stop / reject pending plan** aborts dashboard planning and invalidates staged actions; a currently issued Chrome call cannot be undone. Revoking pairing, changing permissions, or clearing the session interrupts remaining actions.

Production: `npm run build`, then `npm start`. Run `npm run test:http` against that server.

## Implemented actions and limits

| Capability | Actual behavior |
| --- | --- |
| Metadata | Only enrolled, unexpired HTTP(S), non-sensitive, non-incognito tabs |
| Summaries | Gemini summarizes explicitly captured, permitted text; no text means no page summary |
| Search | Creates an inactive Google search tab with the approved query |
| Open tab | Creates an inactive tab at an **origin already enrolled**; arbitrary paths/URLs are rejected |
| Switch | Activates an enrolled tab; does not focus a different browser window |
| Group | Groups two to ten enrolled tabs in one window and applies the approved topic title |
| Verification | Chrome tab ID/destination, active state, or group membership/title; not page load, contents, or factual correctness |

No arbitrary scripts, DOM clicks, forms, purchases, tab closing, automatic execution, or general automation. Failed verification may follow a partially applied Chrome operation; inspect Chrome before retrying. Stop cannot roll back an operation already submitted.

## Gemini provider and fallback

`@google/genai` is used only in `apps/web/src/server/modules/assistant/provider.ts`. The provider reads server environment variables, uses a system instruction plus explicitly separated untrusted evidence, requests a bounded JSON schema, and independently validates the returned JSON and every tab/origin reference. It has a 15-second abort/HTTP timeout, one attempt, two concurrent requests, and a process-local budget of 20 requests per minute. The shared API parser enforces origin checks, JSON, a streamed 32 KiB body limit, strict request/response keys, at most ten context tabs, and at most two text-bearing tabs. Plans allow at most five actions.

The model has no tools or browser credentials. Page instructions are explicitly excluded from authority; common injection patterns in titles/text are quarantined. Prompt filters cannot guarantee semantic immunity, so the extension independently enforces fixed actions, enrolled origins, snapshot freshness, permissions, and explicit approval. React renders all model output as escaped text.

Model errors, malformed/unsafe JSON, unavailable configuration, quota, and timeout return an honestly labeled deterministic fallback. Fallback can propose an instruction-based search but never fabricates a page summary. ContextFlow and explicitly requested Ghost backend suggestions use Gemini **only** with their separate remote-AI consent toggle. Otherwise they retain the original deterministic result. Ghost monitoring remains opt-in, local, and non-executing; only explicit suggestion requests transfer aggregate counters. Disable/revoke interrupts pending backend fetches before the serialized state change.

Official references: [Chrome tab metadata permissions](https://developer.chrome.com/docs/extensions/reference/api/tabs), [Google structured output](https://aistudio.google.com/docs/structured-output), [model catalog](https://aistudio.google.com/docs/models), [SDK generation configuration](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html).

## Extension security and lifecycle

The original strict ping path remains compatible. Assistant messages are separately validated, require the exact localhost origin, top frame, `/dashboard` path, no extension sender, a random 256-bit popup-issued token, and a matching bound sender tab ID. The token never leaves browser session memory or travels to the backend/model. Required Chrome permissions remain unchanged; `tabGroups` and `tabs` are optional and requested only through a popup user gesture. `tabs` allows verification of newly created destinations; the engine still accesses only enrolled tabs and tab IDs it creates.

Captures and pending plans keep URL hashes rather than raw paths. Before model upload, staging, and each approved change, the engine checks live grants, expiry, origin, and URL snapshot. It preflights the entire selected subset, consumes approval in session storage before execution, and rejects replay. A service-worker restart preserves consumed state; if the worker dies during a Chrome call, inspect browser state and do not assume it failed. Only bounded last-batch result statuses are logged in session storage, without raw page text, instructions, titles, or URLs. Plans temporarily retain the approved action parameters needed for execution.

This remains a localhost development-origin boundary, not production account authentication. Local processes can forge HTTP Origin headers. Rate budgets are per process, not a distributed quota system. Data intentionally sent to Google is subject to that service's policies. No persistent browsing history or external telemetry was added.

## Files changed for Phase 4

- Shared contracts: `packages/shared/src/assistant.ts`, `index.ts`.
- Provider/API: `apps/web/package.json`, root lockfile, `src/server/modules/assistant/{provider,service,recommendations}.ts`, `src/server/api/validated.ts`, and assistant/ContextFlow/Ghost API routes.
- Dashboard/UI: `apps/web/src/components/assistant-panel.tsx`, `connection-panel.tsx`, `landing-markup.json`, `src/lib/assistant-client.ts`, dashboard route, and shared CSS.
- Extension: `manifest.json`, popup HTML/TypeScript, controller, session state, backend client, internal parser, background routing, and `src/assistant-engine.ts`.
- Verification/docs: `tests/assistant.test.ts`, HTTP smoke checks, README, and this document. Phase 3 working-tree changes are retained.

## Verification status

`npm test` passed all 101 tests, including existing regressions and new model validation, injection quarantine, pairing, permissions, context capture, AI consent, approvals/rejection, replay, cancellation, navigation, verification failure, and Chrome error checks. `npm run typecheck` passed in all workspaces. `npm run build` passed for the extension and production Next.js application, including `/api/assistant`. `npm run test:http` passed against the production server for both pages, assets, assistant, existing intelligence endpoints, and rejected origins/payloads. `git diff --check` passed.

Tests use an injected model provider and mocked Chrome APIs; they do not call a paid Gemini endpoint. No real API key was supplied, so **live Gemini responses are unverified**. No interactive Chrome is available, so real extension pairing, visual rendering, and end-to-end Chrome actions remain manual acceptance checks. Do not describe those as passed.
