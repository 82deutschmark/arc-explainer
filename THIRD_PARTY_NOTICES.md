<!--
Author: Claude Opus 5.5
Date: 2026-10-09
PURPOSE: States what the root MIT LICENSE covers and lists the third-party material in this
         repository or referenced by it, with owners, licenses and upstream sources, so nobody
         reusing this code mistakes someone else's work for ours. Verbatim upstream license
         texts live in licenses/.
SRP/DRY check: Pass — the only licensing inventory; README links here instead of repeating it.
-->

# Third-party notices

The MIT license in [LICENSE](./LICENSE) covers ARC Explainer's own code, documentation and
writing, including the ARC-AGI-3 game guides. The material below belongs to other people. It
is included or referenced under its own terms, and this project does not relicense it.

## Included in this repository

| Material | Location | Owner | License |
|---|---|---|---|
| ARC-AGI-1 tasks | `data/training`, `data/evaluation` | François Chollet ([fchollet/ARC-AGI](https://github.com/fchollet/ARC-AGI)) | Apache 2.0, [licenses/ARC-AGI-1.txt](./licenses/ARC-AGI-1.txt) |
| ARC-AGI-2 tasks | `data/training2`, `data/evaluation2` | ARC Prize Foundation ([arcprize/ARC-AGI-2](https://github.com/arcprize/ARC-AGI-2)) | Apache 2.0, [licenses/ARC-AGI-2.txt](./licenses/ARC-AGI-2.txt) |
| ConceptARC tasks | `data/concept-arc` | Victor Vikram Odouard ([victorvikram/ConceptARC](https://github.com/victorvikram/ConceptARC)) | MIT, [licenses/ConceptARC.txt](./licenses/ConceptARC.txt) |
| ARC-Heavy tasks (BARC synthetic problems) | `data/arc-heavy` | BARC authors ([xu3kev/BARC](https://github.com/xu3kev/BARC)), via Simon Strandgaard's [arc-dataset-collection](https://github.com/neoneye/arc-dataset-collection) | Listed as MIT in that collection; the upstream repository publishes no license file |
| Poetiq solver | `solver/poetiq` | Poetiq, Inc. ([poetiq-ai/poetiq-arc-agi-solver](https://github.com/poetiq-ai/poetiq-arc-agi-solver)) | MIT, [licenses/Poetiq.txt](./licenses/Poetiq.txt) |
| Saturn visual solver | `solver/arc_visual_solver.py`, `solver/arc_visualizer.py`, `solver/arc_stdin_visualizer.py`, `solver/README.md` | Zoe Carver ([zoecarver/saturn-arc](https://github.com/zoecarver/saturn-arc)) | No license published upstream; not covered by this project's MIT license |
| Grover solver | `solver/grover-arc` | Zoe Carver ([zoecarver/grover-arc](https://github.com/zoecarver/grover-arc)) | No license published upstream; not covered by this project's MIT license |
| ARC-AGI-3 community games | `server/data/arc3-games`, `server/data/arc3-research-games`, `server/data/arc3-uploads` | Built with Son Pham's [autoresearch-arena](https://github.com/sonpham-org/autoresearch-arena) pipeline or uploaded from it; some contributed by other players | Reuse terms come from their authors, not from this repository's LICENSE |
| AS66 recreation | `server/data/arc3-holdout-games/as66.py` | Code written for this project; the game it recreates is ARC Prize's withdrawn preview game, and its design belongs to ARC Prize | Code under this project's MIT license; game design not ours to license |
| ARC-AGI-3 recordings, frames and screenshots | `arc3/`, `public/replays/`, game images on the site | Gameplay of ARC Prize's official games, which belong to ARC Prize | Shared for reference and commentary |
| Claude skills | `.claude/skills/*` | Anthropic | Apache 2.0, see the `LICENSE.txt` in each skill |
| Base UI components | `client/src/components/ui` (components generated from shadcn/ui) | shadcn ([shadcn-ui/ui](https://github.com/shadcn-ui/ui)) | MIT |

Screenshots, logos and quoted posts shown in the news and report pages belong to their owners
and are used for reporting and commentary. npm and Python dependencies keep their own licenses,
listed in `package-lock.json` and `requirements.txt`.

## Referenced as git submodules, not included

| Submodule | Upstream | License |
|---|---|---|
| `external/ARCEngine` | Fork of ARC Prize's [ARCEngine](https://github.com/arcprize/ARCEngine) | MIT |
| `external/re-arc` | Fork of Michael Hodel's [re-arc](https://github.com/michaelhodel/re-arc) | MIT |
| `external/SnakeBench` | Fork of Greg Kamradt's [SnakeBench](https://github.com/gkamradt/SnakeBench) | No license published upstream |
| `llm-council` | Fork of Andrej Karpathy's [llm-council](https://github.com/karpathy/llm-council) | No license published upstream |
