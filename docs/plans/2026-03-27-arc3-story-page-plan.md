# ARC3 Explainer Page Redesign

**Author:** Cascade (Claude Opus 4.6 thinking)
**Date:** 2026-03-29
**Branch:** arc3
**Status:** Awaiting approval

---

## Context

The `/arc3` route currently renders `CommunityLanding.tsx` — a pixel-art themed game launcher with "Play" buttons, game upload, and palette legends. This was appropriate when ARC Explainer hosted its own game harness, but Son Pham's [arc3.sonpham.net](https://arc3.sonpham.net) now handles game play and agent testing far better than we can. Our role is the **explainer**: what ARC-AGI-3 is, how it evolved, what we documented, and where to go next.

The first attempt at this page (committed 2026-03-27) produced a marketing-style landing page with big hero text, lots of whitespace, and a decorative vertical timeline component. That was the wrong vibe. The user wants something closer to the `/cc` page (ClaudeCodeGuide.tsx) — dense, dark, bordered sections, tables for structured data, technical blog-post energy.

### Design reference: `/cc` (ClaudeCodeGuide.tsx)
- Dark: `bg-slate-950 text-slate-100`
- Sections: `rounded-lg border border-slate-800 bg-slate-900/60 p-6` with `h2` headings
- Tables: `w-full text-sm` with `divide-y divide-slate-800` rows
- Code: `bg-slate-800 rounded p-4 text-xs font-mono text-green-400`
- Max width: `max-w-4xl`
- No hero, no CTAs, no gradient text, no cards

---

## Scope

**In scope:**
- Rewrite `Arc3Story.tsx` with dense, `/cc`-style layout
- Present useful links and navigation at the top (not buried at the bottom)
- Compact timeline as a table, not a vertical dot-and-line component
- Game reference table with the 6 preview-era games, linking to spoiler pages
- Brief "what is this" section — 2-3 short paragraphs, not a marketing pitch
- Brief scoring section (honest about gaps in our knowledge)
- AS66's notable absence from the March 2026 catalog

**Out of scope (this pass):**
- Restyling `Arc3GameSpoiler.tsx` (separate task)
- Removing/archiving old pages (`CommunityLanding`, `ARC3Browser`, etc.)
- Playground redirect changes
- Researching competition scoring details (flagged as a content gap, filled in later)

---

## Architecture

### Existing assets to reuse
- `usePageMeta` hook for meta tags
- `shared/arc3Games/` for game metadata (gameId, names, categories, difficulty)
- `docs/arc3-game-analysis/*.md` — content source for game descriptions (not rendered dynamically, but referenced for accuracy)

### What gets deleted
- `client/src/components/arc3/Arc3Timeline.tsx` — the vertical timeline component created 2026-03-27. Replaced by an inline table. No external consumers.

### Files to modify
| File | Change |
|------|--------|
| `client/src/pages/Arc3Story.tsx` | Full rewrite — dense dark layout |
| `client/src/App.tsx` | No changes needed (routes already correct from prior pass) |

---

## Page Structure

The page is a single-column dark document (`bg-slate-950`) with bordered sections. No hero. No CTA buttons. Information density is the priority.

### 1. Header (compact)
- Title: **ARC-AGI-3** in `text-3xl font-bold`, no subtitle bloat
- One line underneath: what this page is ("Reference and history of ARC-AGI-3 interactive reasoning benchmarks")
- Separator line

### 2. Quick Links (prominent, top of page)
A small bordered section with the 3-4 links people actually need:
| Destination | URL |
|---|---|
| Play games / run agents | arc3.sonpham.net |
| Official ARC-AGI-3 platform | three.arcprize.org |
| ARCEngine source | github.com/arcprize/ARCEngine |
| ARC Prize overview | arcprize.org/arc-agi/3/ |

Rendered as a compact list or small table — not big buttons.

### 3. What Is ARC-AGI-3? (2-3 paragraphs)
Dense prose, no jargon. Key points:
- ARC 1 & 2 = static grid puzzles with examples. ARC 3 = interactive games, no instructions.
- 64×64 grid, 16 colors, up to 7 actions. Figure out the rules by experimenting.
- The question: can AI learn a new game the way a person does?

### 4. Timeline (table, not a vertical component)
A compact table with 4-5 rows:

| When | What |
|------|------|
| Late July 2025 | Preview competition launches. Three games public: ls20, as66, ft09 |
| August 2025 | Evaluation set revealed: lp85, sp80, vc33. Six total games documented |
| Late 2025 | StochasticGoose (Dries Smit) wins preview competition |
| March 2026 | ARCEngine open-sourced. 40+ games. as66 notably absent from new catalog |
| Current | ARC Prize 2026 competition underway. Community building agents at scale |

### 5. The Six Preview-Era Games (reference table)
Two sub-tables: Preview Set and Evaluation Set.

Columns: `ID` | `Name` | `Input` | `Difficulty` | `Notes`

Each row links to `/arc3/games/{gameId}`. The as66 row gets a note about its absence from the current catalog.

### 6. How Scoring Works (brief, honest)
Short section with what we know:
- Games have multiple levels, agents aim to complete as many as possible
- Interaction via numbered actions (1-7) plus reset
- No text or reward signal — visual feedback only

Ends with an honest note that we're still filling in 2026 competition scoring details.

### 7. External Resources (compact list)
Simple `<a>` list with short descriptions, no icons:
- ARC Prize blog: 30-day learnings
- StochasticGoose writeup (Dries Smit)
- Son Pham's GitHub
- ARCEngine docs

---

## Content Gaps (to be researched separately)

- Exact competition scoring for 2026 (prize structure, aggregate scoring, evaluation protocol)
- Exact dates of preview period start/end (verify against arcprize.org)
- Why as66 is missing from the March 2026 catalog (eval holdback? retired?)
- Current AI performance numbers on the benchmark

---

## TODOs (ordered)

1. Get plan approval from user
2. Rewrite `Arc3Story.tsx` — dense dark layout per spec above
3. Delete `Arc3Timeline.tsx` (unused after rewrite)
4. Verify build compiles clean
5. Commit, push to `arc3` for Railway deploy
6. Update `CHANGELOG.md`

---

## Docs / Changelog Touchpoints

- `CHANGELOG.md` — entry for the `/arc3` page redesign (what/why/how)
- `docs/plans/2026-03-27-arc3-story-page-plan.md` — this file (mark as complete when done)
