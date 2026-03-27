# ARC3 Story Page Redesign Plan

**Author:** Cascade (Claude Sonnet 4)
**Date:** 2026-03-27
**Branch:** arc3
**Status:** In progress

---

## Goal

Replace the current ARC3 landing page (game launcher UI) with an editorial, timeline-focused story page that explains what ARC-AGI-3 is, how it evolved, and how it works. Direct users to arc3.sonpham.net for playing games and running agents.

## Editorial Direction

The frame is: **"We've been watching this since the beginning. Here's what we learned."**

Target audience: smart non-technical people who want to understand ARC-AGI-3.

## New Page Structure: `/arc3` (Arc3Story.tsx)

1. **Hero** — Title, one-sentence hook, single striking visual (replay canvas or screenshot)
2. **What is ARC-AGI-3?** — 3-4 paragraphs, no jargon. Interactive games, no instructions, figure it out.
3. **Timeline** — Vertical timeline component:
   - Jul-Aug 2025: Preview competition launches (6 games)
   - Late 2025: Game set reduced, community analysis
   - Mar 2026: Full ARCEngine released (40+ games)
   - Current: Where things stand
4. **The Preview Games** — Compact cards for the 6 original games linking to spoiler pages
5. **How Scoring Works** — Brief section (needs research to fill in accurately)
6. **Play & Explore** — CTA section directing to arc3.sonpham.net and three.arcprize.org
7. **External Resources** — Compact links section (official platform, docs, StochasticGoose writeup)

## Route Changes

| Route | Before | After |
|-------|--------|-------|
| `/arc3` | CommunityLanding (game launcher) | **Arc3Story** (new story page) |
| `/arc3/games/:gameId` | Redirect to archive | **Arc3GameSpoiler** (direct, no archive prefix) |
| `/arc3/archive/*` | Keep for now | Redirect to `/arc3` (consolidate later) |
| `/arc3/playground` | ARC3AgentPlayground | Redirect to arc3.sonpham.net (later) |

## What NOT to build

- No game player/launcher on the story page
- No playground (Son Pham handles this)
- No "Submit Game" or "Upload" flows on the story page
- No gradient text, no pixel-art UI, no card-grid-of-everything layouts

## Content Gaps (need research)

- Exact scoring mechanism for ARC-AGI-3 (per-game scoring, aggregate scoring)
- Exact dates of preview competition start/end
- Prize amounts and competition structure for 2026
- Current state of AI performance on the benchmark

## Files to Create

- `client/src/pages/Arc3Story.tsx` — the new story page
- `client/src/components/arc3/Arc3Timeline.tsx` — reusable timeline component

## Files to Modify

- `client/src/App.tsx` — route `/arc3` to Arc3Story, update game spoiler route

## Files Eventually to Archive (not in this pass)

- `Arc3ArchiveLanding.tsx`
- `ARC3Browser.tsx`
- `CommunityLanding.tsx`
