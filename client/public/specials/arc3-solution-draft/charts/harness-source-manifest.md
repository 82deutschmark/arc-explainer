<!--
Author: Claude Opus 5.5 (Main innovation thread)
Date: 17-October-2026
PURPOSE: The harness the Main thread runs today (Son 17-Oct: "push our latest harness to arc-3"): what it is, where each
  piece lives, its scores, and the experiments running on it. A record, not a build tree: the scripts here carry the
  absolute Windows paths of Son's PC.
SRP/DRY check: Pass - one folder per harness (harnesses/README.md); the kernel code stays in the private arc3-speed repo.
-->
# daniel-main-1017: goal first + notes head+tail on Daniel's notebook, M180 serving

The best harness on the Score Climb 2 board (25 official + 25 copycats, 200 min, 32 lanes) as of 17-Oct-2026, and the
line every Kaggle submission since 15-Oct comes from.

## What it is
**Base:** Daniel Franzen's Kaggle notebook. It runs his ARC3-Inference harness and the Flash-Next W4A16 model,
`dfranzen/intel-qwen3.8-flash-next-w4a16-autoround`, on his SGLang fork. On top of that base:

- **Port blocks** (`variants/`). Python inserted into the notebook's port cell. Each block edits his source with
  `_ARC3_EDITS` text replacements, and every anchor must match exactly once.

  | block | what it does |
  |---|---|
  | `unstick/block_fresh.py` | fresh start on stuck levels |
  | `verbatim/` | verbatim history kept |
  | `exec/` | `run_checked` / `check_rule` prediction helpers, `ARC3_EXEC_HELPERS=1` |
  | `mem/` | game notes that survive trims, `ARC3_MEM=notes` |
  | `shared/` | notes re-shown as first 2k + last 4k characters, `ARC3_NOTES_SHOW=headtail` |
  | `pa/` | goal first, `ARC3_GOAL_FIRST=1`: each level's first turn asks what solved looks like |

- **Settings:**
  - Temperature 0.6 (Daniel: 0.7), relaxed acceptance off, 32 lanes.
  - Window 140k cut to 58k.
  - Mamba 180 states (5N+20), memfrac 0.94.
  - 24 GB host-RAM KV tier.
  - Expert chop 341, skip-experts k0 4.
- **SGLang kernel patch sets.** All are exact (no model change). They live in the PRIVATE repo
  `sonpham-org/arc3-speed`, not here: the int8 / NVFP4 chain, `kprsync`, `kpleconv` (fixes an OOM), `kvlmhost`,
  `kh44sw` (the host tier).

## Scores (Score Climb 2 = mean over 50 games; Kaggle = the public leaderboard, kept separate)
| build | board (runs) | Kaggle |
|---|---|---|
| C: Seal + notes head+tail | 61.1 (4 runs: 62.0, 63.2, 58.2, 61.1) | **48.92** (16-Oct) |
| + goal first | ~62.4 (65.0, 59.8 at min 194) | 47.45 (17-Oct) |
| + M180 serving, = this harness (`notebooks/board_...4911ac0a250e`) | 61.5 (60.7, 62.3; official-25 72.9 on run b) | not submitted yet |

Run-to-run spread is about ±2 on the board. Two runs only show effects of 4 points or more.

## Files
- `notebooks/board_goalfirst_c_m180_4911ac0a250e.ipynb`: the exact GCP board notebook. It is self-contained: the port
  cell carries every block, and the 25 copycats are embedded as a tar.
- `notebooks/kaggle_c_48.92.ipynb` and `notebooks/kaggle_goalfirst_c_47.45.ipynb`: the two last Kaggle submissions,
  `sonphamorg/arc3-daniel-k44c341l32nht-ct1` and `...nhtg-ct1`.
- `variants/<block>/`:
  - each block with its builder and tests;
  - `pa/make_tree_pa.py` and `unstick/make_arm.py` build patched copies of his source to test against.
- `build/`:
  - `build_sc2_lineup.py`: every board arm, `OPTIONAL["sc2l32xu8np00nhtgm180"]` is this one;
  - `make_variant_notebook.py` and `build_cfg.py`: notebook from base + kernel sets + blocks + env;
  - `build_kaggle32nhtm180.py`: the C + M180 Kaggle package, built, not pushed;
  - `make_kernel_stack.py` and `add_kdnsfix.py`: GCP notebook to Kaggle kernel.

## Experiments running on it (17-Oct, 2 runs each vs this harness)
| variant | switch | what it changes |
|---|---|---|
| `instruments/` | `ARC3_INSTRUMENTS=1` | GAUGE / LEDGER / PLAYBOOK / COURT readouts at the end of each turn opener (+4.6 on the old 20-lane line) |
| `rgbchars/` | always on | RGB Agent's brightness-ramp symbols `$8#hqOCznf(G->I"` in place of the letters `WwgGcBMPRbSYOrNp` |
| temperature | `LOCAL_ANALYZER_TEMPERATURE` | 0.5 / 0.4 / 0.3 instead of 0.6 |
| `predict/` | `ARC3_PREDICT_STRICT=1` | one unpredicted move per python call; batches only through `run_checked` with a prediction per move |
| `slim1017/` | `ARC3_SLIM_PROMPT` | Daniel's system prompt deduplicated, without "puzzle" or DON'T DO THIS (11.7k vs 18.3k chars); turn messages unchanged |

Results go to the Score Climb page and the run catalog.
