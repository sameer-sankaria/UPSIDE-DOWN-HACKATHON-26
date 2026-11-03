# ContextFlow

`service.ts` uses the shared deterministic reasoning provider and sanitized, explicitly supplied one/two-tab context. It returns search queries with required approval, not fabricated source URLs. The POST route validates requests and responses. No source fetching, AI, storage, or browser execution occurs here.
