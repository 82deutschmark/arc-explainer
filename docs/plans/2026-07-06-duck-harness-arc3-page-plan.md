<!--
Author: Claude Fable 5
Date: 2026-07-06
PURPOSE: Plan for adding Tufa Labs' duck harness (published July 1, 2026) to the /arc3
         reference page. Documents scope, source facts, and where the content lands.
SRP/DRY check: Pass — extends the existing single-purpose reference page; no new components needed.
-->

# Add Duck Harness to /arc3 Reference Page — July 6, 2026

## Scope

**In:** Document Tufa Labs' duck harness on the ARC-AGI-3 reference page (`client/src/pages/Arc3Story.tsx`):
a timeline row, a short dedicated section, and resource links.

**Out:** No new components, no changes to game data, no integration with the harness itself.

## Source facts (from https://tufalabs.ai/research/duck-harness/, fetched 2026-07-06)

- Agent harness for the ARC-AGI-3 challenge on Kaggle, published July 1, 2026 by Tufa Labs.
- Authors: Harold Bessis, Jeroen Cottaar, Isaiah Pressman, Andries Smit, Michal Tešnar, Stefano Viel.
- Minimal coding harness: LLM works in a Python REPL where all game observations are encoded as
  Python variables; it inspects state via tool calls, evaluates pre-built helper functions, and
  takes actions in the game environment.
- Built around Qwen 3.6 27B FP8; uses both image and text representations of the grid; context is
  kept short by automatically evicting the oldest messages.
- Results: mean score 1.6002 ± 0.4475 across 25 public games with 20 attempts each. Evaluated with
  GPT 5.4, it is an order of magnitude cheaper per game than Executable World Models while solving
  a similar set of games.
- Performance is uneven: some games solved consistently for over 40% of levels; others never clear
  the first level.
- Links: GitHub `github.com/Tufalabs/duck-harness`, Kaggle technical write-up (discussion 717133).

## Architecture

Reuse the existing section/table/link patterns in `Arc3Story.tsx` — the page is a dense reference
layout with static data arrays at the top. New content goes into:

1. `TIMELINE` array — one new row for July 2026, inserted before the "Now" row.
2. A new "Duck Harness" prose section between "How Games Work" and "Resources".
3. `RESOURCES` array — blog post, GitHub repo, Kaggle write-up entries.

## TODOs

- [x] Fetch and verify facts from tufalabs.ai.
- [x] Add timeline row.
- [x] Add duck harness section.
- [x] Add resource links.
- [x] Update file header metadata.
- [x] Changelog entry (7.4.2).
- [ ] User verifies rendering on /arc3.
