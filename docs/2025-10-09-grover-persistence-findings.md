 * 
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T17:49:32-04:00
 * PURPOSE: Capture the investigation into Grover solver persistence to explain why database rows lack predicted grids and outline remediation steps.
 * SRP/DRY check: Pass - No overlapping report in docs; single purpose analysis.
 * shadcn/ui: Pass - Documentation only.

# Grover Solver Persistence Findings

## Summary
Grover runs currently store iteration metadata without ever saving predicted grids. The system never executes the best candidate program on test inputs, so the explanation row is missing `predictedOutputGrid`, `multiplePredictedOutputs`, and correctness metrics.

## Key Observations
- `GroverService.buildGroverResponse` initializes `predictedOutput` to `null` and never updates it because the execution block is a stub (`server/services/grover.ts:506-533`).
- The sandbox (`grover_executor.py`) evaluates candidates only on training inputs. No routine reruns the best program against `task.test`.
- `explanationService.transformRawExplanation` persists the null grids straight into the repository; validators are bypassed.
- Downstream analytics therefore see Grover entries as missing predictions and accuracy.

## Recommended Fixes
1. After selecting `bestProgram`, run it through `pythonBridge.runGroverExecution` on every test grid; populate both `predictedOutput` and numbered outputs where appropriate.
2. Invoke `responseValidator.validateSolverResponse` / `validateSolverResponseMulti` so correctness and trustworthiness scores are computed consistently.
3. Set `hasMultiplePredictions`, `multiplePredictedOutputs`, and related fields before saving; continue to store iteration metadata alongside the standard solver data.

Addressing these items will align Grover persistence with the HuggingFace-compatible schema and unblock analytics/leaderboards from treating Grover runs as solver attempts rather than diagnostics only.

