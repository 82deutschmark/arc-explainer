# 2025-12-31 ARC3 Claude SDK Banner Plan

## Scope
Add a prominent yet tasteful banner on the ARC3 landing page (`client/src/pages/ARC3Browser.tsx`) that showcases the Claude Code SDK for ARC3 games and links to the Anthropic partner template at https://docs.arcprize.org/partner_templates/anthropic.

## Objectives
1. Highlight the Claude Code SDK resource without overwhelming the hero section.
2. Ensure the banner visually aligns with existing ARC3 branding (cool blues, purposeful gradients, not generic purple slop).
3. Keep the UX accessible on both desktop and mobile, with clear affordance that the banner is an external link.
4. Maintain SRP/DRY by reusing existing design primitives (Card, Alert, icons) when possible.

## Constraints & Considerations
- Page already uses shadcn/ui components; reuse them for consistency.
- Banner should feel "special"—likely a slim gradient Card or Alert with iconography and microcopy about the SDK.
- Must include metadata + file header updates per repository standards.
- Update `CHANGELOG.md` with What/Why/How once the banner ships.

## Proposed Approach
1. Place the banner directly under the hero CTA stack so it is visible before scrolling but does not break layout.
2. Implement a `Card` (or `Alert`) with subtle gradient, Anthropic/Claude-coded copy, and an external link button styled as `variant="outline"` with an icon.
3. Add any necessary helper styles inline (Tailwind utility classes) rather than creating new global styles.
4. Verify responsive behavior by checking the container layout at sm/md breakpoints.
5. Document the change in `CHANGELOG.md` under a new patch version entry.

## TODOs
- [ ] Inspect ARC3Browser layout to confirm insertion point and component reuse opportunities.
- [ ] Implement the Claude Code SDK banner with accessible semantics and external link treatment.
- [ ] Review the page in dev tools (or via reasoning) for responsive issues.
- [ ] Update `CHANGELOG.md` (top entry) with summary and author credit.
- [ ] Summarize changes for the user once verified.
