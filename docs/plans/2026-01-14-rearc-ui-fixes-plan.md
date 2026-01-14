# 2026-01-14 RE-ARC UI polish plan

**Author:** Cascade (OpenAI Assistant)

## 1. Context
- Collaborator feedback highlights four regressions on the RE-ARC Bench:
  1. "Generated" timestamps lack timezone context, making screenshot verification ambiguous.
  2. The sentence "Difficulty is tuned to roughly match the ARC-AGI-2 evaluation set" is over-emphasized in the hero card, confusing users.
  3. The submissions list does not surface the originating dataset generation timestamp, blocking screenshot-only verification.
  4. After removing the explicit "Generate again" CTA, the surviving button looks broken and still fires a second generation.
- All fixes must respect the RE-ARC Benchmark codemap @[RE-ARC Benchmark: Generation Caching, Evaluation Performance, and Benchmark Integration], particularly the timestamp semantics tied to XOR-encoded task IDs.

## 2. Goals
1. Make every displayed generation timestamp unambiguous (explicit UTC plus human-friendly relative time) on both the evaluation success alert and the submissions table.
2. Relocate/de-emphasize the ARC-AGI-2 difficulty sentence into the About section so it reads as historical context instead of a promise.
3. Surface dataset generation timestamps alongside submissions so screenshots alone show which dataset was solved.
4. Fix the generation CTA so that, after a successful download, it no longer triggers another generation or present as a malformed icon-only button.
5. Update `CHANGELOG.md` and any touched TS/TSX headers per repository policy.

## 3. Proposed Work
1. **Timestamp display utility**
   - Introduce (or extend) a client-side formatter that returns `ISO8601Z (relative)` strings using `Intl.RelativeTimeFormat` for clarity across locales.
   - Apply it to the Evaluation success alert (`client/src/components/rearc/EvaluationSection.tsx`) and to the submissions table, ensuring we still show the numeric UNIX seed-derived timestamp.
2. **Hero copy tuning**
   - Remove the difficulty sentence from the hero CTA block in `client/src/pages/ReArc.tsx`.
   - Insert a toned-down note inside the About section (likely the "This Benchmark" subsection) clarifying the intent without sounding like an ARC-AGI-2 guarantee.
3. **Submissions dataset timestamp**
   - In `ReArcSubmissions.tsx`, add a new column (or enrich the date column) that shows `Generated {ISO UTC} (relative)` using the new formatter.
   - Ensure the tooltip/footnote explains that generated-at derives from XOR-encoded task IDs + DB seed for screenshot validation.
4. **Generation CTA fix**
   - Adjust `GenerationSection.tsx` so the primary button becomes disabled (and labelled e.g. "Dataset ready") once a generation completes, preventing accidental re-generation.
   - Maintain a clear Retry affordance only in the error state; ensure compact mode is covered.
5. **Verification & docs**
   - Manually verify flows by generating a dataset and confirming the button state and alert copy.
   - Update `CHANGELOG.md` (top entry) describing behavioral changes and doc impact.

## 4. Risks & Mitigations
- **Time math bugs**: Ensure relative time math correctly handles seconds vs milliseconds (seed IDs are seconds). Convert to ms before using Date APIs.
- **Layout regressions**: Table column additions could overflow; keep responsive design by wrapping long timestamps or using monospace small text.
- **Accessibility**: Maintain descriptive text for screen readers when disabling buttons.

## 5. Validation Plan
- Generate a dataset locally, confirm success alert reads `Generated 2026-01-09T14:30:04.297Z (2 hours ago)` format.
- Load submissions page, verify each row shows dataset generation timestamp with timezone.
- Attempt to click the generation CTA after completion; it should be disabled and visually clear.
- Review hero copy placement to ensure messaging is now in About.
- Run targeted lint/type check if required (or at minimum, `npm run build` subset) to ensure no TypeScript errors.

---

**Status:** Completed 2026-01-14 — ISO+relative timestamps now live across evaluation + submissions, copy/CTA fixes shipped.
