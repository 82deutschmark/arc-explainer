# 2026-01-07 ARC3 palette + landing refresh plan

**Owner:** Cascade (ChatGPT)
**Context:** Fix the ARC3 color mismatches between the landing replay pipeline and the shared palette, expand the replay encoder so every available ARC3 run can ship as an MP4, and redesign the landing hero to be purely visual (placeholder copy only).

## Goals
1. **Palette alignment:** Eliminate bespoke color tables so the Python encoder and any future tooling reuse the single shared ARC3 palette from `shared/config/arc3Colors.ts`.
2. **Replay coverage:** Extend the encoding script + documentation so we can batch-convert every JSONL replay in `arc3/` or `public/replays/` without manual per-file tweaks.
3. **Landing hero redesign:** Strip the previous instructional copy and CTAs, keeping only the two hero graphics on a tasteful layout with placeholder text blocks where necessary.
4. **Documentation + changelog:** Update landing hero docs (and CHANGELOG later) to reflect the new workflow and design.

## Proposed Work Breakdown
1. **Investigate palette reuse approach**
   - Confirm the shared palette exports (hex + RGB tuples) and decide how to expose them to Python (e.g., generate a JSON file from the shared TS module or hard-code a single canonical JSON definition under `shared/`).
   - Validate that all frontend references point at the shared source of truth to avoid drift.

2. **Update `generate_arc3_video.py`**
   - Replace the inline `ARC3_COLOR_MAP` with data loaded from the shared palette artifact.
   - Add CLI/utility helpers to iterate over all replay JSONLs, optionally filtering by pattern, so we can encode entire runs in one command.
   - Ensure output structure (e.g., `client/public/videos/arc3/<gameId>.mp4`) is clear and documented.

3. **Documentation refresh**
   - Expand `docs/reference/frontend/landing-hero.md` with the new batch encoding instructions, dependency notes, and placeholder-copy guidance.
   - Link to any helper scripts or commands added above.

4. **Landing hero redesign**
   - Update the relevant React component(s) so the hero is just the two visual cards (ARC1&2 GIF rotator + ARC3 replay) with placeholder labels, no descriptive paragraphs/CTAs.
   - Ensure accessibility (alt text, reduced-motion guards) still works.
   - Keep layout elegant (spacing, typography, gradient background) while obeying the "placeholder text only" constraint.

5. **Validation + polish**
   - Run lint/build as needed for frontend changes.
   - Regenerate at least one replay clip via the new workflow to verify palette correctness.

Please confirm this plan or request adjustments before I begin implementation.
