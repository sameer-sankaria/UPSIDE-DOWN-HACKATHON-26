# Phase 7 baseline audit

Baseline: clean `main` at `cd6fd66`, before source changes. Work branch: `feature/phase-7-assistant-reliability`. No Phase 6B source, migration, or verification document was found. Phase 6A's single-turn companion remains the last documented extension phase.

| Check | Result before changes |
| --- | --- |
| Unit/regression suite | PASS: 143 tests |
| Production web + extension build | PASS |
| TypeScript, after build | PASS |
| Live localhost HTTP smoke | PASS |
| Disposable PostgreSQL account/RLS tests | PASS |
| Chromium landing, login/signup forms, protected dashboard redirect | PASS at 1440, 1024, 768, 390px |
| WebKit | Initially unavailable (missing libraries); PASS after installation at all four widths, before/after comparisons use unchanged marketing source |
| Live Gemini | NOT TESTED: no key/model configured |
| Hosted Supabase signup/confirmation/login/refresh/logout/preferences/admin | NOT TESTED: no Supabase settings configured |
| Authenticated native Chrome Side Panel/voice/action flow | NOT TESTED: no configured extension identity/accounts/provider |

The first concurrent typecheck/build invocation failed TS6053 because the build regenerated `.next/types` during `tsc`. A sequential rerun passed; this was a verification-order error, not a source regression. The first dev startup found port 3000 already occupied by the existing working server; HTTP/browser checks used that server. Docker checks required sandbox escalation. No credentials or environment files were changed or printed.

## Existing implementation

- Phases 1–2: strict extension/web origin checks, ping contracts, session-only tab enrollment, document-bound visible-text consent/extraction, deterministic ContextFlow, aggregate opt-in Ghost Mode, approved searches.
- Phase 3: Onda-based landing markup/assets/motion, dashboard. Existing recent card/scroll fixes are in main and must be retained.
- Phase 4: existing server-only Gemini SDK, structured plans, bounded requests, fallback, dashboard context summaries, approved/snapshot-bound open/switch/group actions, replay consumption.
- Phase 5: Supabase SSR HttpOnly cookies, confirmation/recovery/logout, protected accounts/admin, own preferences/RLS, opaque PKCE-bound extension sessions, optional consent-based analytics. Local SQL security checks pass; hosted integration is not established.
- Phase 6A: Side Panel, toolbar/shortcut, single-turn chat, known-site/explicit HTTPS navigation, metadata-based switching, explicit approval, editable push-to-talk transcript with typed fallback.

## Confirmed gaps and risks to address

- Companion discards conversation on every turn; no follow-up site/reference context.
- Companion explicitly rejects page text; summarization is dashboard-only.
- No YouTube search destination, email-draft workflow, or approved native tab closing.
- Execution relies on the background mutation queue for replay safety; direct concurrent engine calls need their own guard.
- Voice Stop depends on recognizer `onend`; a stalled recognition service can leave controls stuck.
- Missing Supabase configuration allows legacy intelligence APIs even in production; production should fail closed while preserving the documented local development path.
- Auth cookies explicitly use `secure:false`; production cookies should be Secure.
- Tab access/content revocation already checks URL/document snapshots; new features must reuse those checks.

Baseline screenshots are local artifacts in `/tmp/navi-phase7-browser/before-*.png`. Landing visuals were inspected separately; no marketing files are part of Phase 7 changes. Existing screenshots may include remote-image availability differences. No real Chrome microphone, live AI, or hosted authentication success is inferred from mocks or rendered forms.
