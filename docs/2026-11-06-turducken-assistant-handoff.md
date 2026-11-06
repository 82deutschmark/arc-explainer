# Turducken article: assistant handoff and source map

Author: GPT-6.1 Sol · 6 November 2026

## Start here: article being edited

- Reading page: <https://arc.markbarney.net/specials/2026-11-06-arc3-solution-draft.html>
- Published HTML source: [client/public/specials/2026-11-06-arc3-solution-draft.html](../client/public/specials/2026-11-06-arc3-solution-draft.html)
- Portable prose: [article-draft.md](../client/public/specials/arc3-solution-draft/article-draft.md)
- Provenance and editorial history: [article-review-notes.md](../client/public/specials/arc3-solution-draft/article-review-notes.md)
- Original chart measurements: [source-data.json](../client/public/specials/arc3-solution-draft/charts/original/source-data.json)
- Local publishing checkout: `/Users/macmini/GitHub/arc-explainer` (only active checkout; do not recreate retired duplicates).
- Local canonical working package: `/Users/macmini/bubba-workspace/reports/arc3-kaggle-images-2026-11-06/`. It contains `article-draft.md`, `article-review-notes.md`, `claude-original-frame.html`, `claude-original-readable.txt`, eleven vector-chart assets/renderers and `kaggle-article-draft.zip`. Original Claude artifact files are local evidence, not a second publishing repository.

## The synthetic-games repository the Boss means

**Use <https://github.com/82deutschmark/arc3-synthetic-games>.** Verified directly against GitHub and its README on 6 November 2026.

- Curated browse page: <https://82deutschmark.github.io/arc3-synthetic-games/>
- Evaluation/holdout setup: <https://github.com/82deutschmark/arc3-synthetic-games/blob/main/EVALUATION.md>
- DZ01 implementation: <https://github.com/82deutschmark/arc3-synthetic-games/blob/main/games/dz01.py>
- Runtime adapter: `tools/runtime.py`; game list and hashes: `docs/catalog.json`; real-engine preview frames: `docs/previews/`.
- Local clone: `/Users/macmini/GitHub/arc3-synthetic-games`.

Do **not** substitute ARC Explainer’s `server/data/arc3-games` directory or the separate `82deutschmark/ARC-AGI-3-Training-Data` repository. <https://arc.markbarney.net/arc3/gallery> is the site gallery, not the dedicated synthetic-game source repository. The authored holdout collection is not automatically the historical 25-copycat evaluation set measured in Son’s article. Agents being evaluated must not be able to read game source or spoiler pages. Read the repository’s validation limitations before claiming solvability or a validated benchmark.

## Harness engineering: where to read, and what each source establishes

The private ARC-3 team repository resolves from its former `sonpham-org/arc-3` address to **<https://github.com/Autoresearch-Arena/arc-3>**. Team access is required. The local checkout remains `/Users/macmini/GitHub/arc-3`.

1. [18 October architecture comparison and merge plan](https://github.com/Autoresearch-Arena/arc-3/blob/main/harnesses/MERGE-OVERVIEW-KEITH-DZJ-1018.md). Start here for team engineering, rather than reconstructing it from the article’s short bullet list. It compares Daniel/Son’s notes-based line, Keith’s C5m execution fixes and dzj’s structured memory/observation line. Inspect its linked patch files for implementation. Candidate-to-merge is not proof of final adoption.
2. Local `harnesses/daniel-main-1017/`, `harnesses/daniel-main-1018/` and their `MANIFEST.md`/notebooks describe dated packages. Confirm remote availability and notebook contents before handing a repository URL to someone else. The local 1018 manifest URL was not present in the remote repository at this check. Do not infer a 1024 archive exists locally merely from older notes.
3. `ARC3-Inference/inference/agent/tool_agent.py`, `prompts.py`, `python_tool_sandbox.py`, `runtime_state.py` are the local implementation entry points. They are mutable current code, **not** proof of exactly what the scored notebook contained. Review the package snapshot/patches first.
4. Local `/Users/macmini/GitHub/arc-3/HARNESS-NOTES.md` is an experimental ledger; it mixes dates, models and branches. Preserve each run’s model/package/test-set context.
5. Workspace evidence: `/Users/macmini/bubba-workspace/docs/2026-10-22-arc3-team-notes.md` records scheduling and an October 24 notebook comparison; `/Users/macmini/bubba-workspace/docs/2026-11-02-arc3-engineering-writeup-notes.md` records a **separate reporter/package history**, evidence boundaries and uncertain adoption status. Do not merge its 38.95/36.26 results into Son’s 56.02 configuration.

## Editorial rules for the next pass

Keep the exact sections: **Harness Iteration**, **Inference Optimization**, **RL**, **When speed no longer matters**. Preserve the eleven static charts, original measurement arrays, current artwork and DZ01 sharing metadata. Give memory, execution reliability, observation fidelity and scheduling real explanatory space, but separate final-package changes, alternate team branches, proposals and failed experiments. Local gains, microbenchmarks, Kaggle scores and noisy multi-change packages are not interchangeable.

Publication checks: synchronize HTML, Markdown, review notes and canonical ZIP; publish only scoped changes; one public check. A pushed commit is not proof the public page is live. Report the observed revision honestly; do not create repeated deployments to hide lag.
