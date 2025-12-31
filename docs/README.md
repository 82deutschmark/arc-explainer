# Author: Codex
# Date: 2025-12-18
# PURPOSE: Maintain the documentation index while clarifying how to enable VS Code's proposed chat session menu.
# SRP/DRY check: Pass - this addition purely documents existing workspace content with no duplication.

# Documentation Index (updated 2025-10-16)

The `docs/` directory is now organized around active focus areas. Use the table below to quickly locate the plan or reference material you need.

## VS Code Proposed API note

`chatSessions/newSession` is a proposed menu identifier and needs the workspace root `package.json` entry `enabledApiProposals: ["chatSessionsProvider"]` to surface in stable builds. The property is committed here, so reopening VS Code normally exposes the menu; otherwise or when experimenting outside this workspace, launch the application with `--enable-proposed-api openai.chatgpt`.

## Active workstreams (`docs/plans/`)

| Folder | Focus | Example documents |
| --- | --- | --- |
| `analytics/` | Metrics, trustworthiness, and database quality follow-ups | `10Oct2025-Metric-Badges-Implementation-Plan.md` |
| `daisyui-conversion/` | Completed DaisyUI migration notes and follow-up tasks | `12-10-2025-shadcn-to-daisyui-conversion-plan.md` |
| `grover/` | Grover solver recovery and streaming readiness | `2025-10-10-plan-grover-streaming-recovery.md` |
| `model-comparison/` | Model comparison UI/architecture improvements | `2025-10-11-ModelComparisonMatrix-Redesign.md` |
| `platform/` | Cross-cutting platform maintenance and terminology fixes | `2025-10-16-fix-ts-errors-plan.md` |
| `progressive-reasoning/` | Progressive reasoning UI and data integrity work | `CRITICAL-PROGRESSIVE-REASONING-DATA-LEAKAGE.md` |
| `prompts/` | Prompt hardening and integration plans | `CRITICAL-PROMPT-AND-DATA-LEAKAGE-AUDIT-OCT2025.md` |
| `puzzle-browser/` | PuzzleBrowser redesign initiatives | `16Oct2025-PuzzleBrowser-RealMetrics-Redesign-Plan.md` |
| `puzzle-discussion/` | PuzzleDiscussion refinements | `2025-10-11-puzzle-discussion-fixes.md` |
| `puzzle-examiner/` | PuzzleExaminer refactors and restoration plans | `2025-10-16-puzzleexaminer-restoration-plan.md` |
| `responses-api/` | OpenAI Responses API refactors and audits | `2025-10-12-Reasoning-Capture-Analysis.md` |
| `saturn/` | Saturn visual solver recovery and production fixes | `2025-10-16-saturn-streaming-fix-plan.md` |
| `solver/` | Heuristic solver investigations | `2025-10-12-plan-heuristic-solver.md` |
| `streaming/` | SSE and streaming UX implementation history | `10Oct2025-Streaming-Validation-Complete-Analysis.md` |

> Tip: Each folder contains the most recent (≤ 7 days old) documentation for that topic so you can jump straight to the current state of work.

📌 For the ARC-AGI-3 playground rollout, see the standalone plan `docs/2025-11-06-arc3-agent-ui-plan.md`.

## Reference material (`docs/reference/`)

- `api/` – External and internal API contracts, streaming guides, and integration notes.
- `architecture/` – System-wide architecture, schema alignment, and developer onboarding references.
- `data/` – Data extracts and schema investigations.
- `frontend/` – Frontend patterns: hooks reference, error message guidelines, dev routes pattern.
- `solvers/` – Deep dives on Python/solver implementations.

## Archived work (`docs/oldPlans/`)

Historical plans (older than 7 days) now live under `docs/oldPlans/`. Recent archival batches are grouped by month, e.g.:

- `docs/oldPlans/2025-10/` – Early October 2025 responses API, Grover, and documentation clean-up efforts.
- `docs/oldPlans/2025-02/` – February 2025 puzzle browser refresh plans.

Older summer plans remain in the root of `docs/oldPlans/` and can be further organized if needed.

---
Need something specific? Start in the relevant `docs/plans/<topic>/` folder, then fall back to the reference section for architectural context.
