# Experimental reasoning collection

25 games, five levels each. This folder is a separate local source in Arc3MirrorCatalog. All games are research candidates awaiting the user's first feedback; no human calibration is claimed. No contributed-glowup files are included.

Authoring source and design notes live in `sonpham-org/autoresearch-arena`, under `arc3games/research/`. Use its `build.py`, `verify.py`, `check_failures.py`, and `publish.py --site /path/to/arc-explainer` to regenerate these files. Do not edit standalone copies here without updating the authoring source.

`manifest.json` supplies opaque IDs and control/display metadata. `replays.json` contains author-state winning witnesses, not blind-player baselines. `failure-replays.json` contains reachable game-over witnesses and their starting seed/level. `scripts/arc3/check_research_games.py` replays all three seeds and verifies the failure/reset paths; Docker runs it before publication.

Open `/arc3/gallery?category=research`. The experimental category is labeled separately, Next task remains within it, and action animation finishes at the manifest frame rate before another move is accepted. RESET can interrupt playback. The ordinary visitor recommendation pool is not widened by this collection.

The private-partner games simulate deterministic partners. Notebook capacity does not constrain an external agent's memory. Transfer needs no-source comparison trials. Appearance tests must pair the same level and seed across explicit variants. Mechanical verification establishes tested legal solutions, not cognitive construct validity.
