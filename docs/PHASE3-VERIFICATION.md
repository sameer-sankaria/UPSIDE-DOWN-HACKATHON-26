# Phase 3 — NAVI OS website integration

## Implementation

- `/` adapts the repository's original Onda `index.html`, rather than recreating its design. Trusted markup is stored as reviewable lines in `apps/web/src/components/landing-markup.json` and rendered by the server. Never populate this HTML from user input.
- `apps/web/public/onda/template.css` retains the original stylesheet, including fonts, tokens, keyframes, scene timing, responsive layouts, and reduced-motion fallbacks. `navi.css` adds product-specific illustrations and layouts.
- `motion.js` retains the original motion gate, kit, section navigation, hero/orbit, horizontal track, rotating wheel, collage, and footer measurements. Only the unused contact/newsletter scripts were removed. The footer visibility observer is retained without newsletter logic.
- All section IDs, motion selectors, scene attributes, five-card groups, four process steps, five collage cards, and four editorial stories remain. Native links between website and dashboard load a fresh document to release the template's global scroll listeners.
- `connection-panel.tsx` is shared between the landing page (via a portal into the original section) and `/dashboard`. It explicitly requests real `/api/health` and correlated extension pings. It never invents browser state or requests expanded extension access.
- Before Phase 3 the website had only a foundation message and console diagnostic, not a functional dashboard. The diagnostic remains on both routes. All existing browser operations remain in the extension popup, which has new visual styling and a dashboard link; its controller, message validation, permission gates, shared contracts, and APIs are unchanged.
- The problem, five core features, product overview with actual connection checks, four-step process, privacy/control, FAQ, installation guide, and violet CTA are complete. Automatic tab organization is explicitly labeled planned.
- The original template directory remains intact. MIT notice, original header, generator metadata, and Design: 8B attribution are preserved. Served license and credits are linked in the footer.

## Verification

Executed successfully during implementation:

- `npm ci` — installed existing locked dependencies; no new package dependencies.
- `npm run typecheck` — all three workspaces.
- `npm test` — 73 passing tests, including all 69 existing tests and four new landing checks for links, placeholder removal, animation-group counts, reduced-motion/unsupported-timeline initialization, and keyboard/menu behavior.
- `npm run build` — Next.js production routes and Chrome extension bundle.
- `npm run test:http` against `npm start` — homepage, dashboard, all landing assets, health, three intelligence endpoints, approval flags, invalid payload rejection, and denied cross-site origins.
- `git diff --check` — clean.

The sandbox blocked the test runner’s IPC socket, the first production compiler attempt, and localhost network access. Both commands completed successfully with approved execution outside that sandbox.

Real Chrome extension acceptance, actual scroll rendering, and visual inspection at 375px/1440px are **not verified** in this environment: no interactive browser is available. DOM tests validate fallback initialization and menu behavior, not browser layout. Follow `docs/CHROME-VERIFICATION.md` for live extension acceptance. The website cannot observe current Ghost Mode, permission, context, or suggestion state through the existing ping-only bridge.

## Preview

```sh
npm ci
npm run build:extension
npm run dev
```

Open `http://localhost:3000` and `http://localhost:3000/dashboard`. In Chrome 120+, load `apps/extension/dist` unpacked. Set its ID as `NAVI_EXTENSION_ID` in `apps/web/.env.local` and restart the server. Use the extension popup to connect the backend and authorize tabs; the dashboard's extension field only checks the connection.

For production preview: `npm run build`, then `npm start`. With the production server running, `npm run test:http` checks both pages and all existing API behavior.
