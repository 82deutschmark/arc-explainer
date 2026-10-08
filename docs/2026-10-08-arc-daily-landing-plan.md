# ARC Daily landing page refresh

**Author:** GPT-6.1 Sol / Codex
**Date:** 8 October 2026

## Goal

Make `/news` an ARC-AGI-3 Kaggle contest daily in the visual language of the ARC Explainer landing page, while keeping ARC-AGI-2 reporting clearly separate and easy to find.

## Changes

- Use the site's white, black, pink and mono vocabulary for the newspaper shell, with readable story type and responsive grids.
- Lead the front page with the latest ARC-AGI-3 article, even when an ARC-AGI-2 dispatch was published later.
- Add a practical exploration shelf linking to the ARC-AGI-3 leaderboard and its graphics, human and AI records, official public-game guides, ARC-AGI-3 background, and ARC-AGI-2 standings.
- Give cited competitor notebooks richer preview cards without adding claims or merging competition identities.
- Add stable fragment targets around existing leaderboard visualizations for direct links.

## Check

- Check the production client build and TypeScript diagnostics.
- Inspect representative desktop and narrow layouts and verify all linked local routes exist.

## Verification

- Vite client build passed.
- News and SEO integration suites passed: 17 tests.
- Static layout preview inspected at 1440px and 500px. The preview used sample headlines solely to check spacing and breakpoints; the published page still reads live archive data.
- TypeScript reports pre-existing diagnostics in unrelated server and test files; none point to this change.

## Editorial follow-up, 8 October

The publication keeps the name **The ARC Daily** and covers ARC-AGI-3 and ARC-AGI-2 as separate contests. The front page may lead with ARC-AGI-3 while still giving ARC-AGI-2 its own story and direct chart link. Add the established ARC Prize Discord invite to the page. Use dates in visible article furniture; keep exact observation times in archived evidence. The reporter workflow now calls for specific, lively sports writing rather than timestamp-led prose.

## Archive cards and model credit, 8 October

The newspaper links to the existing illustrated Hall of Fame and shows three of its archive cards as a visual route into that gallery. These cards represent past ARC contributors and prize stories. Current Kaggle team dossiers remain separate and use their own cited identities and facts. The visible reporter credit and instructions spell the model **GPT-6 Sol**; the scheduled model identifier remains `gpt-6-sol`.

The client build and 18 focused news/SEO tests passed. The archive strip was inspected at 1440px and 500px. The site reuses the gallery's existing image files and `/hall-of-fame` route.
