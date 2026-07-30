# /arc3 Page — ARC-AGI-3 Technical Report Integration

**Author:** Claude Opus 5
**Date:** 2026-07-30
**Target file:** `client/src/pages/Arc3Story.tsx`
**Source:** ARC Prize Foundation, *ARC-AGI-3: A New Challenge for Frontier Agentic Intelligence*, April 22, 2026 — https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf (23 pages, read in full 2026-07-30)

---

## 1. Objective

Make `/arc3` the definitive reference for ARC-AGI-3 by folding in the official technical
report. Two deliverables:

1. **Authoritative facts** — replace the page's placeholder/approximate content (action
   space, "scoring still being confirmed") with what the report actually specifies, and
   link the report itself.
2. **A plain-English breakdown of how the environments are built** — the report's Section 3
   is, in effect, a published recipe for generating ARC-AGI-3-style games at scale. That is
   the section the user specifically wants, presented as scannable reference material, not
   prose.

## 2. What the report changes on the current page

| Current page claim | Report says | Action |
|---|---|---|
| "up to 7 actions ... plus a reset action" | 5 key actions + **Undo**, plus 1 coordinate-select action. Each environment offers a **subset**. | Correct |
| "Competition scoring details ... still being confirmed" | Full RHAE spec (§4.1–4.2) | Replace with real spec |
| No dataset sizes | 25 public demo / 55 semi-private / 55 fully private (Table 1) | Add |
| No leaderboard data | Table 2 release scores; official vs community leaderboard policy (§4.3) | Add |
| Duck harness presented without benchmark context | Official leaderboard **runs no harness at all** (§4.3.1) | Add framing note |
| Timeline lacks report + preview competition specifics | Preview ran Jul 18 – Aug 19 2025; StochasticGoose 12.58%, Blind Squirrel 6.71%; report published Apr 22 2026 | Update rows |

## 3. New content: "How the Games Get Made"

Sourced from §3.1–3.5, §1.3.3, §4.3.1. Structure:

- **Production pipeline** (§3.2) — 4 stages, each with its gate. Note the throughput finding
  (3–4 environments in flight per developer beats serial development).
- **Design rules a candidate must satisfy** (§3.4) — core knowledge priors only; no language
  or cultural symbols; the **mechanizable novelty test** (one program solving two
  environments at ≥50% shorter than two concatenated solutions ⇒ too similar); ≥6 levels;
  multiple mechanics; tutorial level 1; difficulty by composition; opaque 4-char IDs.
- **Automated validation gates** (§3.5) — the part that makes synthetic generation tractable:
  - 50,000-step random regime: no level beaten by accident.
  - 1,000,000-step regime: non-tutorial levels unbeaten under random play.
  - 1,000,000-step sweep across all levels doubling as fuzz/perf harness.
  - Recording replay under win and loss conditions ⇒ determinism and serializability.
  - Graph-based state-space construction: hash-identified nodes, action edges, merge of
    convergent trajectories, cycle/depth/merge-density tracking, bounded P(win | random
    policy) even without exhaustive enumeration. **Acceptance: ≤ 1 in 10,000.**
  - Engine rationale: Unity rejected as too slow; custom Python engine targeting 1,000 FPS
    — this exists *because* validation needs millions of random steps.
- **Human calibration** (§5) — 10 testers per environment, ≥2 independent full solves
  required for inclusion; 486 participants / 414 candidate environments / 2,893 attempts.
- **The catch** (§1.3.3 + §4.3.1) — the generate→solve→verify→train loop is what the report
  believes saturated ARC-AGI-1/2, and it is reproducible here (engine open source,
  environments verifiable). But the report classifies training on synthetic lookalikes as
  **domain-specific overfitting**: it is routed to the self-reported community leaderboard,
  never the official one. Evidence cited: Opus 4.6 scores 0.0% unharnessed and 97.1% with the
  Duke harness on a TR87 variant, yet 0.0% both ways on BP35. Counterweight (§4.3.2): ARC
  Prize expects genuinely general harness ideas to migrate behind the model API, as
  chain-of-thought did into o1.

State both sides plainly. No advocacy either direction.

## 4. Implementation notes (SRP/DRY)

- Add one generic `RefTable({ headers, rows, label })` helper inside the page and use it for
  the four new tables. The existing `GameTable` stays as-is (it owns game-specific link
  rendering); `RefTable` prevents four more copies of the same `<table>` markup.
- No new components, no new dependencies, no new routes. Existing dark section-card layout,
  `ExtLink`, and `usePageMeta` are reused unchanged.
- Report link added to both `QUICK_LINKS` and `RESOURCES`.

## 5. Verification

- `npx tsc --noEmit` clean.
- Render `/arc3` in the browser preview; confirm no console errors, tables scroll rather than
  overflow the body, and the new sections match the existing visual language.

## 6. Out of scope

- Game metadata (`shared/arc3Games/`) is untouched. The report never names the preview-era
  games beyond `ls20`, `ft09`, `vc33`, `re86`, `TR87`, `BP35`, so no catalog reconciliation
  is possible or attempted here.
- No changes to `/arc3/playground`, community pages, or the archive routes.
