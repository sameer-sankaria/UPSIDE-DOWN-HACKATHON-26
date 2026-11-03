# API access policy

`api-access.ts` enforces the exact local web origin or configured Chrome extension identity for the Phase 2 POST routes. This is a local development boundary, not production user authentication. Actual metadata, content, monitoring, and tab-opening permissions are checked separately in the extension controller. The backend has no browser-command channel.
