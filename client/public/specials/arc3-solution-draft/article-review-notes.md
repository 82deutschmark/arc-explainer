# Editorial verification notes — not article copy

Prepared 6 November 2026 by GPT-6.1 Sol from local repository evidence. Original source-check pass made no Kaggle requests or GPU runs. The draft was subsequently posted to ARC Explainer and editorially revised on 6 November; this remains a review draft.

## Scope and unresolved items

- Article describes the October 18 temperature-0.5 harness, not an unverified final November submission. Exact final result, team attribution and final model need Son's confirmation before this becomes a final solution report. No leaderboard rank or score is claimed.
- CPMP's quoted 128k/30k strategy describes his team's experience, not ours. It is deliberately not attributed to our implementation.
- **Artwork discrepancy:** harness illustration says keep 52k, but the selected BUILD and notebook retain approximately 58,000. Article follows BUILD. Do not silently publish inconsistent figure and text.
- **Artwork discrepancy:** inference illustration says 34 lanes; the selected harness BUILD uses 32. Article follows BUILD. Different configurations may have used 34; no source checked establishes that as the selected October 18 harness.
- Inference illustration's FP8 label must not be read as the precision of every cache/model component. Selected BUILD says `nvfp4_qsa`, routed experts W4A16, other tensors remain higher precision.
- ARC-CODE URL was not established. No guessed link included. Son should provide the intended project if this article must answer that question directly; the quoted comment may concern another team's work.
- Image links are local relative links for the delivery ZIP. Upload the PNGs to Kaggle and replace links with Kaggle-hosted URLs before pasting. The ARC Explainer reading copy has been published for review.
- References are links documented in local source, not freshly HTTP-verified for public access. Private datasets and serving patches are not claimed to have been released.

## Evidence

1. `~/GitHub/arc-3/docs/onboarding/harness.md`: October 18 stack, model writes sandbox Python, lanes, clock, 140k/58k, M180, 24 GB host tier, notes headtail, temperature choices, expert chop, drafter.
2. `~/GitHub/arc-3/harnesses/daniel-main-1018/gcp-twin-t05/BUILD.json`: exact window143360, keep_after_cut58000, lanes32, mamba180, memfrac.94, HICACHE24, nvfp4_qsa, selected blocks and temperature .5.
3. `~/GitHub/arc-3/harnesses/daniel-main-1018/goalfirst-c-m180-t05/arc3-daniel-k44c341l32nhtgm180t5-ct1.ipynb`: output12*1024; overridden context143360; fixed keep58000. Reserve logic inherited from agent: context minus output allowance minus512. Thus estimated input budget130560; requests containing oversized latest message can require additional overflow handling.
4. `~/GitHub/arc-3/harnesses/daniel-main-1017/variants/verbatim/block_verbatim.py`: preserving generated history to improve prefix reuse.
5. `~/GitHub/arc-3/harnesses/daniel-main-1017/variants/mem/block_mem.py`: embedded arc3_mem implementation, MAX_NOTES40000 characters, write-stream persistence, helper retention, notes mode. Store belongs to agent, key uses runtime parent; article intentionally does not claim path-keyed cross-game isolation is formally proven.
6. `~/GitHub/arc-3/docs/onboarding/fine-tuning.md`: historical unsuccessful RL v1/v3, training/serving fidelity, expert chop, quantization, drafter.
7. `~/GitHub/arc-3/docs/static/data/rl4-live.json`: October19 timestamp and later RL v4 internal improvements. Not a live November status. Named LB harness matches140k/58k/T.5. No current score inferred.
8. `~/GitHub/arc-3/docs/onboarding/games.md`: procedural generators provide solutions verified by actual engine. No claim that generated games improved final score.

The root `ARC3-Inference/inference/agent/tool_agent.py` defaults (32768 context / output unset /60% low water /1600 summary output) are NOT the selected submission recipe. Article deliberately avoids substituting those defaults for the runtime-patched notebook.

## Editorial pass — 6 November 2026

Reworked the opening and transitions around the nested playing, harness and serving layers. Reduced repeated defensive qualifications while preserving numerical settings, cache limitations, source links and the distinction between internal training evaluations and submission evidence. Artwork remains unchanged.

## Son feedback revision — 6 November 2026

Organizer thanks, evaluation mismatch, failed custom-eval correlation, recovery regret and the untested 110-lane counterfactual use Son’s direct account in #arc3, 6-November-2026 12:49 EST. The optimization inventory is exactly all 102 k-prefixed directories in ~/GitHub/arc3-speed/kernels, cross-checked against README.md, KERNEL-LEDGER.md, set READMEs and builder docstrings. It includes revisions, snapshots, diagnostics and dead ends, not 102 independent shipped optimizations. The descriptive table copies no implementation code. The repository link is access-controlled and explicitly labeled. Public source release/access remains a separate decision; this article does not claim availability. Authored-game link /arc3/games verified against the application route. Existing artwork and numerical source checks unchanged.

## Settings tables and charts — 6 November 2026

Added context/trim and serving settings tables plus three archived measured charts. Full aggregate data, reproducible plotting script and source/workload caveats accompany the PNGs in charts/. No local/Kaggle correlation is asserted; no new experiments or Kaggle requests. Existing illustration discrepancies remain disclosed.

## Recovered engineering visualization — 6 November 2026

Recovered the November 4 four-panel engineering figure from the existing arc-3 worktree (`.claude/worktrees/arc3-game-defects-e13202/docs/lab-notes/engineering-figures`). Original figure, SVG, source JSON and renderer preserved under charts/engineering-evidence/. Values independently cross-checked here against current arc3-speed kernels/kkv84, kw8 and kpgraph READMEs. Article distinguishes storage accounting, decode-iteration samples, variable-length prefill ranges and full-game-clock throughput; these are not a cumulative ablation, boot-inclusive throughput or final submission result. This recovery does not establish that these notes are the Claude-authored draft Son referenced.

Fourth illustration recovered directly from Son's reattachment in #arc3 on 6 November 2026. Added to “When speed no longer matters.” Original preserved, only antialiased alpha clipping applied; original dimensions and every RGB pixel verified unchanged. The 56.02 label belongs to the supplied artwork, not a newly established final-stack result.

## Original headings and harness comparison — 6 November 2026

Restored Son’s four exact narrative headings. Moved evaluation observations into Harness Iteration. Original Claude draft graphic remains unidentified. A clearly labeled reconstruction uses the Claude Opus 5.5-authored October 17 harnesses/daniel-main-1017/MANIFEST.md snapshot, with missing Kaggle value left absent and local run/suite limits disclosed. No claim of complete improvement history or original-chart recovery.
