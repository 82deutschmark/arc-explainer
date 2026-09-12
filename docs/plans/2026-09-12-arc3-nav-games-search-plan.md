# ARC-3 Nav Modernization + Searchable Game Index

**Date:** 2026-09-12
**Author:** Claude Sonnet 5

## Problem

The ARC-3 nav dropdown (`client/src/components/layout/AppNavigation.tsx`) still
points at `/arc3/playground` under "Research" — the agent-testing playground.
We don't run agents against games here anymore; that flow is deprecated and
should not be advertised in the nav.

Meanwhile, the thing we actually built today and yesterday — full spoiler
write-ups for all 25 official ARC-AGI-3 games, each with its own page
(`/arc3/games/:gameId`, commits `99f155fa`, `b0b05448`, `54e423a9`) — has no
real front door. The only index (`Arc3GamesIndex.tsx` at `/arc3/games`) exists
but isn't linked from the nav at all, and the other place that lists all 25
(`Arc3Story.tsx`'s `GameTable`) is buried ~430 lines into a long technical
report.

## Plan

1. **Nav (`AppNavigation.tsx`)** — in the ARC-3 dropdown:
   - Remove the "Agent playground" link entirely (deprecated, no longer a
     thing this site does).
   - Promote "All 25 Games" (`/arc3/games`) to the first, lead item — it's
     the reason someone opens this dropdown now.
   - Keep "About ARC-3" (`/arc3`, the technical report) as secondary
     reference material, and "Hypothesis traces" as the lone remaining
     Research item.
2. **Make `/arc3/games` actually searchable** — add a search box at the top
   of `Arc3GamesIndex.tsx` that filters the 25 game cards live by id, name,
   tag, and mechanics text, with a result count. This is currently a static
   full-page dump with no way to jump to one game besides scrolling.
3. Leave `Arc3GameSpoiler.tsx` (the per-game pages) and `Arc3Story.tsx`'s
   buried table alone — they already work and aren't what's broken.

## Out of scope

- Deleting the `/arc3/playground` route itself (still reachable by URL;
  just not advertised).
- Restyling the per-game spoiler pages.
