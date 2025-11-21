# PuzzleDB Viewer White Theme & Metrics Integrity Plan

**Author:** Cascade (ChatGPT)
**Date:** 2025-11-20
**Status:** Draft – ready for implementation once approved

## 1. Background
- Feedback: the new dark-themed PuzzleDB Viewer regressed usability (too dark, cramped, unnecessary margins) and the preview cards surface nonsensical statistics (e.g., 0 models tested yet 126 attempts, >100% confidence).
- Scope: restore a crisp white layout that matches the rest of ARC Explainer and redesign the stats stack so every number on the preview cards is both accurate and genuinely useful (solve rate, attempts, test cases, grid size, etc.).

## 2. Goals & Non-Goals
- **Goals**
  1. Ship a white, margin-light PuzzleDB Viewer layout that spots unsolved evaluation puzzles instantly.
  2. Define the exact metrics that belong on puzzle preview cards and guarantee they draw from trustworthy sources.
  3. Remove confidence/trustworthiness/accuracy badges that confuse users and keep only research-relevant context (solve rate, attempts, test-case flavor, grid size, dataset, last-attempt recency).
  4. Ensure backend + hooks expose the data required to power the curated metrics with no derived guesswork in the UI.
- **Non-Goals**
  - No new datasets or ingestion flows—reuse existing evaluation data.
  - No net-new visualization surface (e.g., charts). Focus is the list + cards experience.

## 3. Current Issues Snapshot
| Area | Problem | Source |
| --- | --- | --- |
| Palette/Layout | Dark slate cards + extra padding make content hard to scan; gradients conflict with rest of site | `client/src/pages/PuzzleDBViewer.tsx` lines 343-502 |
| Preview Cards | Metrics mix (confidence %, trustworthiness) is meaningless for researchers; also duplicates PuzzleCard component logic | `client/src/pages/PuzzleDBViewer.tsx` (inline card) + `client/src/components/puzzle/PuzzleCard.tsx` |
| Data Integrity | Aggregated stats allow impossible combinations (0 models, 126 attempts). Need consistent source-of-truth and validation | `useWorstPerformingPuzzles`, `usePuzzleDBStats`, backend `/api/puzzles/stats`, `MetricsRepository` |

## 4. Proposed Experience
1. **White Canvas:**
   - Outer container: `bg-white text-slate-900`, zero mysterious gradients, padding strictly `px-4 py-6` (desktop) / `px-2 py-4` (mobile).
   - Section cards: subtle border (`border-slate-200`), shadow-sm, zero tinted backgrounds. ARC2 block can rely on iconography + copy for emphasis, not heavy color fills.
   - Remove redundant margin stacks; rely on CSS grid gap utilities.

2. **Preview Card Metrics (keep only reality-based stats):**
   - Solve Rate (label, derived from avgAccuracy but displayed as “Solve Rate”).
   - Attempt Count (total explanations).
   - Unique Models Tested (count, optional badge if 0).
   - Test Case Mode (Single vs Multi).
   - Grid Size + consistency indicator.
   - Dataset tag + “Last Attempt” timestamp if available.
   - Optional “Avg cost per attempt” only if value present and < $1 to avoid noise.
   - Remove: confidence %, “trustworthiness”, “accuracy” badges, meaningless percentages >100%.

3. **Data Contract:**
   - Extend `/api/puzzle/worst-performing` (or `/api/puzzles/stats`) responses with:
     - `uniqueModelsAttempted` (number).
     - `attemptsTotal` (number) – matches explanations count.
     - `lastAttemptAt` (ISO) – for freshness copy.
   - Enforce server-side validation so `attemptsTotal >= uniqueModelsAttempted >= 0` and solve rate is `0 ≤ rate ≤ 100`.

## 5. Workstreams & Tasks
### WS1 – UI Palette Reset (PuzzleDBViewer page)
- [ ] Replace container + section wrappers with white/gray-100 palette, drop slate backgrounds (`client/src/pages/PuzzleDBViewer.tsx`).
- [ ] Remove extra `pb-3 pt-2 px-2 gap-2` wrappers; rely on consistent `space-y-4` or `gap-4` utilities.
- [ ] Re-style ARC2/ARC1 headers using typography + icon badges instead of colored boxes.
- [ ] Ensure filters (Select/Input) inherit white backgrounds and 1px borders for visual coherence.

### WS2 – Preview Card Redesign
- [ ] Delete inline CompactPuzzleCard from `PuzzleDBViewer.tsx`; reuse a single source-of-truth component.
- [ ] Refactor `client/src/components/puzzle/PuzzleCard.tsx`:
  - Introduce “Research Metrics” section with the curated stat list above.
  - Add guard rails to clamp solve rate ranges and format attempts with thousands separators.
  - Make layout responsive (stacked metrics on mobile, 2-column on desktop) while keeping white interior.
- [ ] Update consuming pages (PuzzleDBViewer, PuzzleBrowser, etc.) to pass the new metric props only.

### WS3 – Metrics Accuracy & Backend Plumbing
- [ ] Audit `useWorstPerformingPuzzles` and `/api/puzzle/worst-performing` to confirm what fields each exposes today.
- [ ] Enhance `server/repositories/MetricsRepository.ts` (and related services) to compute: total attempts, unique model count, last-attempt timestamp, test-case classification, grid size metadata.
- [ ] Update corresponding controller DTOs so UI never fabricates numbers.
- [ ] Add unit tests that cover edge cases (0 attempts, large attempts, multi vs single test puzzles) to `tests/analysisStreamService*.test.ts` or new spec file.

### WS4 – Validation & QA
- [ ] Snapshot comparison of 5 representative puzzles (0 attempts, few attempts, many attempts) before/after to prove metrics accuracy.
- [ ] Cross-check against raw explanations data to confirm the numbers align.
- [ ] Accessibility pass (contrast, focus states) on white layout.

## 6. Dependencies & Risks
- Requires coordination with backend metrics pipeline; ensure DB queries remain performant when adding counts.
- Need clear null-handling contract so UI can display “—” instead of junk values.
- DaisyUI vs shadcn/ui: decide whether to keep Daisy for legacy components or wrap new pieces with shadcn equivalents to avoid style drift.

## 7. Deliverables
1. Updated white themed PuzzleDB Viewer page.
2. Single, trustworthy PuzzleCard component powering previews everywhere.
3. Backend + hook updates delivering only curated, validated metrics.
4. QA notes demonstrating credible numbers.

## 8. Acceptance Criteria
- No dark backgrounds or gratuitous margins remain on PuzzleDB Viewer.
- Preview cards only show: Solve Rate, Attempts, Unique Models, Test Case Mode, Grid Size, Dataset, optional Avg Cost/Last Attempt.
- All numeric fields have server-side validation (0–100% solve rate, attempts >= 0, etc.).
- Manual spot-check confirms metrics align with raw explanations records.

---
End of plan.
