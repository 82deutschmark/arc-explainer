# 020526-arc3-landing-redesign

## Objective
Complete redesign of ARC3 Community landing page (`/arc3`) to be game-focused, using the 16-color ARC3 palette as a creative design language. Remove instructional text dumped into UI. Fix game loading for deployment.

## Problems
1. Double header (app nav + ARC3 sub-header)
2. Instructional text ("how to upload", "what to upload") used as main content
3. Games buried in a tiny sidebar panel
4. Random sprite mosaics instead of actual game content
5. Games not loading in production deployment

## Design Vision
- **Hero**: Compact title bar with 16-color palette strip as visual identity
- **Main content**: Grid of playable official games with large Play buttons
- **Palette integration**: Use ARC3 colors as borders, accents, decorative strips - not just panel backgrounds
- **Tone**: Serious research platform for interactive reasoning benchmarks, not a kids' game site
- **Secondary actions**: Upload/docs/GitHub links demoted to footer or subtle nav

## Files to Change
1. `client/src/pages/arc3-community/CommunityLanding.tsx` - Complete rewrite
2. `client/src/components/arc3-community/Arc3PixelUI.tsx` - Add PaletteStrip component
3. `CHANGELOG.md` - Top entry
4. Investigate deployment game loading issues

## Tasks
- [x] Explore codebase
- [ ] Rewrite CommunityLanding.tsx
- [ ] Add PaletteStrip to Arc3PixelUI.tsx
- [ ] Test locally
- [ ] Investigate deployment game loading
- [ ] Update CHANGELOG.md
