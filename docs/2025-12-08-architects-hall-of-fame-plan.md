# 2025-12-08 ARChitects Hall of Fame Plan

**Goal:** Spotlight The ARChitects ARC Prize 2025 Solution Summary (LambdaLabs link and crew names) on the Hall of Fame page and contributor data, making the people cards and seed data reference the canonical paper for Daniel Franzen 1*, Jan Disselhoff 1*, and David Hartmann 2* from 1 JGU Mainz / 2 Lambda, Inc.

## Files & Todos
- `client/src/pages/HumanTradingCards.tsx`
  - Add a Hall of Fame highlight callout that reiterates the ARC Prize 2025 Solution Summary, lists the three team members, mentions the JGU Mainz / Lambda, Inc. affiliations, and links to https://lambdalabsml.github.io/ARC2025_Solution_by_the_ARChitects/.
  - Ensure the callout sits near the top so visitors see it before exploring other cards.
- `server/scripts/seedContributors.ts`
  - Update the ARChitects 2025 entry to include the LambdaLabs solution summary link (via `links.website` or `links.papers`), mention the required keywords, and highlight their honors so the people cards reflect the paper reference.
  - Double-check other ARChitects-related entries (2024 card, team mention) for consistency with the link and team names.
- `docs/ARCitechts.md` (reference doc)
  - Already includes the names and link, so confirm no additional edits are needed; mention the file in this plan so reviewers know the broader context.
