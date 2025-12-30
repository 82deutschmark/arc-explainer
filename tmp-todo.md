# TODO

## Add the `RE_ARC_SEED_PEPPER` env var

Make sure to do it for both your local setup and for all deployed instances.

```
# Server secret for RE-ARC dataset generation (32+ character random string)
# Used to derive internal seeds that prevent dataset regeneration without server access
RE_ARC_SEED_PEPPER=your-secret-pepper-here-minimum-32-characters-required
```

## Add a way to get to `/re-arc`

There's currently no link to there.

## Link Unfurling for /re-arc via Bot Detection Middleware

**Recommendation**: Use Express middleware with bot detection instead of Vike SSR.

**Why**: You only need meta tags for social media crawlers, not full server-side rendering. This is simpler, Railway-friendly, and industry standard for SPAs.

### Implementation Plan

**Phase 1: Infrastructure Setup**
1. Install `isbot` package for bot detection
2. Modify `client/index.html` - add `__META_TAGS__` placeholder in `<head>`
3. Create `server/middleware/metaTagInjector.ts` - bot detection + HTML injection logic
4. Update `server/index.ts` - register middleware before SPA fallback (production only)

**Phase 2: RE-ARC Meta Tags**
5. Define meta tags for `/re-arc` route:
   - Title: "RE-ARC Bench - Test Your ARC Solver"
   - Description: "Generate fresh ARC puzzles and evaluate your solver with verifiable results"
6. Implement meta tag generation helper function

**Phase 3: Testing & Documentation**
7. Test with Discord bot user-agents
8. Validate using Discord, Twitter validators
    - https://linkpreview.xyz/ (use something like ngrok to test local dev server)
9. Document other routes that would benefit (puzzle/:id, debate/:id, worm-arena, etc.)
10. Add tests for bot detection middleware

**Files to Create/Modify**:
- `server/middleware/metaTagInjector.ts` (new)
- `client/index.html` (add placeholder)
- `server/index.ts` (register middleware)
- `package.json` (add isbot dependency)
- `docs/LINK_UNFURLING.md` (new - document routes for future expansion)

**Railway Concerns**: None - this approach has negligible performance impact vs Vike SSR which could add 500ms-2s cold starts.

**Future Routes**: Document /puzzle/:id, /debate/:id, /worm-arena/live/:id, /leaderboards for Phase 2 expansion.