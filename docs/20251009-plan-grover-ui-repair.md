 * 
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T13:28:05Z
 * PURPOSE: Detailed plan and to-do list for diagnosing and repairing Grover solver UI regressions impacting progress streaming and launch flow from PuzzleExaminer.
 * SRP/DRY check: Pass - Unique planning doc for this effort; verified no equivalent doc exists.
 * shadcn/ui: Pass - Documentation only, no UI components involved.

# Grover Solver UI Repair Plan

## Goal
Restore full functionality of the Grover iterative solver page so users can launch runs from PuzzleExaminer and observe real-time progress, iteration history, and final results without runtime errors or blank states.

## Current Hypotheses
- Recent commits introduced Grover UI but WebSocket state handling or session bootstrapping may deviate from Saturn patterns, causing the page to stay idle.
- Missing backend broadcasts for intermediate states may prevent UI from updating beyond initial status.
- API request may fail due to mismatched model keys or unexpected payload shape, leaving UI in loading state.
- Saturn solver regression may be masking Grover issues if shared infrastructure (WebSocket hub, broadcast payload shapes) is broken; a full Saturn audit is required before concluding Grover is at fault.

## Immediate To-Do List
1. **Reproduce Issue** – Load `/puzzle/grover/:taskId` in dev environment, start solver, capture console/network errors.
2. **Inspect Hook State Transitions** – Trace `useGroverProgress` updates; confirm WebSocket path, payload shape, and session workflow.
3. **Audit Saturn Solver** – Run `/puzzle/saturn/:taskId`, confirm progress streaming works; inspect shared WebSocket + backend services for regressions.
4. **Validate Backend Responses** – Verify `groverController` and Saturn controllers broadcast payloads that match their hooks’ expectations.
5. **Check Model Configurations** – Ensure frontend model keys align with backend `server/config/models.ts`.
6. **Implement Fixes** – Address detected faults (likely in shared ws service or solver services), keeping SRP/DRY principles.
7. **Regression Testing** – Repeat end-to-end runs for both Grover and Saturn, confirm UI updates correctly.
8. **Document Findings** – Update this plan or related docs with resolutions and follow-up items.

## Architectural Notes
- Reuse Saturn patterns for session lifecycle; avoid duplicating state logic where a shared utility could exist.
- Ensure WebSocket cleanup on unmount to prevent leaks.
- Align response typings between backend and frontend (`GroverProgressState` vs broadcast payload).
