# Research game collection

Author: Codex (GPT-6), 2026-09-14.

The user requested 25 games, five each covering private beliefs/cooperation, causal intervention, selective memory, relational transfer and controlled appearance invariance. This work is separate from contributed-glowup and the original 50-game feedback edits.

Integration reuses Arc3MirrorCatalog's existing local-source path, thumbnail service and Pyodide player. A separate `server/data/arc3-research-games/` catalog keeps ownership and validation distinct from the older g-number importer. The gallery labels the collection as new and awaiting player review, without exposing mechanics on tiles.

Authoring, independent policies, mutation checks and paired-appearance tests live in autoresearch-arena under `arc3games/research/`. Each published Python file is standalone, uses a 64×64 palette-index frame, and has five levels. Source headers and reasoning notes stay in the authoring files; published modules contain no explanatory prose.

Acceptance: 25 unique opaque IDs; all 125 levels replay through the real engine; source/bundled parity; score, failure, RESET and animation checks; 25 mechanic mutations rejected; five appearance games retain identical transitions under their paired skins; browser input and playback checked. No claims of human calibration or measured model-performance improvement.

The notebook games limit rendered notes, not a model's external transcript. Transfer and appearance conditions are research candidates whose intended cognitive demands still require human/agent comparisons.
