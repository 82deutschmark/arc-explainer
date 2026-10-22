# Private summit conversation guide

Author: GPT-6 / Codex
Date: 2026-10-22

The requested first pass is a small, unlisted conversation guide for the team. It explains selected attendees' work, connects it to the team's interests, and distinguishes verified MLST appearances from thematic connections. Detailed research on all registrations is outside scope.

- [x] Add the lazy page at `/team/summit-2026` in `client/src/App.tsx`, beside the other team pages (around line 190).
- [x] Register noindex metadata in `shared/routes.ts` (additional pages around line 420); add no navigation or sitemap entry.
- [x] Keep the actual guide outside this public repository and browser bundles. Store its runtime document in a new `team_guides` table, initialized alongside the existing team tables in `server/repositories/database/DatabaseSchema.ts` (around line 58).
- [x] Add a protected reader and token-authenticated publisher in `server/routes/teamGuide.ts`, mounted beside the other team APIs in `server/routes.ts` (around line 140). Reuse existing team sessions and admin-token middleware.
- [x] Build a responsive people list, Mark/Son lenses, topic/search filters, source links, device-local bookmarks/notes, MLST connections, and a short explanation of the team's work. Shared code contains schemas and selection helpers only.
- [x] Verify access control, validation, filters, indexing policy, production build, and desktop/mobile behavior. Publish the runtime document only through the authenticated API.
- [ ] Commit only code, tests and documentation; publish and verify the unlisted link.

The route shell is public like existing team pages; attendee details are returned only after team sign-in. An unlisted address and noindex alone are not the access control. Device-local notes are never uploaded.

Validation: 28 focused tests passed; the production build passed. The TypeScript check reports existing errors in unrelated features, with no guide errors. Desktop and small-screen browser checks covered accent search, MLST filtering, the Mark/Son lens, familiar people, bookmark/note persistence, and no page overflow. Private payload markers are absent from public build files.
