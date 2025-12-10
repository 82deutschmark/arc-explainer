# 2025-12-08 – ARC3 Playground UI Plan

## Goal
Make the ARC3 Agent Playground streaming UI (Actions / Action One timeline and reasoning view) easier to read and follow during real game runs.

## Scope
- Actions panel (left column `Arc3ToolTimeline`).
- Reasoning panel (`Arc3ReasoningViewer`).
- Layout adjustments in `ARC3AgentPlayground` to let the Actions scroll box extend toward the bottom of the viewport.

## Tasks
- **T1 – Typography & sizing**
  - Increase base font sizes for headers and body text in both panels.
  - Use a slightly larger mono font for JSON / reasoning text.

- **T2 – Scroll behavior**
  - Give the Actions panel a taller scroll area that can grow to near full viewport height.
  - Add auto-scroll-to-bottom when new tool entries are streamed.

- **T3 – JSON highlighting**
  - Stop truncating tool call / result JSON to a short substring.
  - Render nicely formatted (multi-line) JSON in a clear, bordered block.
  - Use subtle color accents to distinguish tool calls vs tool results.

- **T4 – Integration & docs**
  - Wire updated component props/layout from `ARC3AgentPlayground`.
  - Update `CHANGELOG.md` with a new semantic version entry describing the UI improvements.
