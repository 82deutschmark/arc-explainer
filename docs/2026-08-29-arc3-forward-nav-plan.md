# ARC-3-Forward Navigation — Plan

Author: Claude Opus 5
Date: 2026-08-29
PURPOSE: Restructure the top nav so ARC-AGI-3 is the front door, demote ARC-1/2 tooling into a
single archive dropdown, and surface the two official/sibling ARC-3 sites as external links.
Presentation-layer only — no routes are added, removed, or changed.
SRP/DRY check: Pass — plan scoped to `AppNavigation.tsx` + `AppHeader.tsx`; reuses the existing
shadcn `DropdownMenu` primitives (including the already-exported `DropdownMenuLabel` /
`DropdownMenuSeparator`, previously unused here) rather than introducing new components.

## Why now

`App.tsx` already forks the root by host: `arc3.markbarney.net` gets `SyntheticLanding`, and every
other host redirects `/` → `/arc3/gallery`. The site is ARC-3-first at the root already; the nav is
what lags. It currently carries **11 top-level items**, of which exactly one ("ARC-3", a two-item
dropdown) is ARC-3, and that entry lands on `Arc3Story` prose rather than anything playable.

## Scope fence

The user framed the ARC-1/2 archival as a **separate, future effort**. This change touches the nav
only. Every route in `App.tsx` stays live, so deep links, bookmarks, and in-page `<Link>`s keep
working — that is what makes a single-file presentation change safe.

## Decisions taken (confirmed with the user)

| Question | Decision |
| --- | --- |
| Worm Arena / SnakeBench placement | Keeps its own top-level dropdown — it is neither ARC-1/2 nor ARC-3, so filing it under "Archive" would mislabel it |
| Brand mark target | `/arc3/gallery`, matching the root redirect. `/home` moves into the archive dropdown |
| External links | Top-level, right side, beside the existing GitHub button |

## Target structure

**Left — ARC-3 first, in the order a visitor uses them:**

1. Play → `/arc3/gallery` (`CommunityGallery`)
2. Playground → `/arc3/playground` (`ARC3AgentPlayground`)
3. Submit → `/arc3/upload` (`GameSubmissionPage`)
4. About ARC-3 → `/arc3` (`Arc3Story`)
5. **ARC 1 & 2** dropdown — the whole former top level, sectioned
6. **Arena** dropdown — SnakeBench + the 8 Worm Arena pages

**Right:** `ARC Prize ↗` (arcprize.org) · `arc3.sonpham.net ↗` · GitHub.

`arc3.sonpham.net` is Son Pham's sibling ARC-3 catalog — the same Pyodide/ARCEngine architecture
this repo runs (`docs/sonpham-arc3-pyodide-architecture.md`), already linked from
`CommunityLanding.tsx` and `README.md`. Labelling it by hostname keeps it self-describing.

### Archive dropdown sections

Nineteen links in one flat list is unreadable, so the dropdown is sectioned:

- **Analysis** — Analytics, Leaderboards, Compare (Elo), Model Comparison
- **Datasets & Scoring** — Official Scoring, RE-ARC, Dataset Viewer, Kaggle Readiness
- **Explore** — Home (resource hub), Puzzle DB, Test Solution, Debate, Discussion, Council,
  Feedback, Poetiq
- **Reading & Collections** — About, LLM Reasoning, Cards, People

## Aesthetic refresh

The user likes the current look and wants it refreshed, not replaced. So the ARC palette
(🟥🟧🟨🟩🟦🟪) and the shadcn structure stay; what changes is the noise:

- Emoji dividers currently sit between **every** one of 11 items. They become **group boundary
  markers only** — one between the ARC-3 cluster and the archive, one before Arena — so they read
  as structure rather than decoration.
- ARC-3 top-level items get a subtle active/accent treatment so the primary cluster is visibly
  primary.
- Dropdown sections gain `DropdownMenuLabel` headings and `DropdownMenuSeparator` rules.
- Header subtitle flips from `ARC 1 🟥 ARC 2 🟨 ARC 3 🟦` to lead with ARC-3.

## Known bug to fix while here

`isActiveRoute` uses `location.startsWith(href)`, and `/` is the only special case. With `/arc3`
("What is ARC-3?") as a sibling of `/arc3/gallery`, `/arc3/playground`, and `/arc3/upload`, the
prefix match lights up **both** entries at once on every `/arc3/*` route. `/arc3` needs exact
matching, the way `/` already has it.

## Type change

`NavDropdown.children: NavLink[]` → `NavDropdown.sections: NavSection[]`, where
`NavSection = { label: string; items: NavLink[] }`. `NavLink` gains an optional `external?: true`
so the right-hand links reuse the same shape. `isDropdownActive` walks sections instead of children.

## Work items

1. Rewrite the `navigationItems` array and the `NavItem` types in `AppNavigation.tsx`.
2. Section-aware dropdown rendering; group-boundary dividers instead of per-item.
3. Fix `isActiveRoute` exact-match for `/arc3`.
4. External link rendering (right side, `ExternalLink` icon, `rel="noopener noreferrer"`).
5. `AppHeader.tsx`: brand → `/arc3/gallery`, subtitle reworded.
6. Refresh both files' header comment blocks — the current "Groups:" line goes stale on edit.
7. `CHANGELOG.md` entry at top.

## Explicitly not done

- No route additions or deletions in `App.tsx`.
- No links to `Arc3OpenRouterPlayground`, `Arc3CodexPlayground`, `Arc3HaikuPlayground`, or
  `Arc3GamesBrowser` — those pages have **no route registered** in `App.tsx`. Linking them would
  ship dead nav entries. Worth raising separately.
- No archival of ARC-1/2 content or data. Future effort, per the user.

## Outcome

Built and verified in the browser. The first cut overflowed the `h-12` header by 62px at 1280px,
which the typecheck could not see; fixed by shortening the label to "About ARC-3", overriding the
trigger padding to `px-3`, and moving the scroll container from `AppHeader` into `AppNavigation`
with `min-w-0` so the right rail stays pinned rather than being pushed off-screen. Clean at 1440px
and 1280px; at 1024px only the two archive dropdowns scroll out, which is the intended order of
sacrifice. See the CHANGELOG 7.7.0 entry for the measured results.
