# Plan: Worm Arena Insights Refactor & Responses API Fix

**Date:** 2025-12-29
**Author:** Cascade
**Status:** Approved
**Objective:** Resolve conflicting LLM instructions and refactor the bloated `snakeBenchService.ts` for better SRP.

## 1. Problem Statement
- **Responses API Conflict:** `snakeBenchService.ts` sends a user prompt asking for a single paragraph while providing a JSON schema requiring structured fields.
- **Service Bloat:** `snakeBenchService.ts` is ~1000 lines, handling everything from match orchestration to reporting, prompt engineering, and tweet formatting.
- **Audit Gaps:** Missing metrics (rank, ties, etc.) identified in `docs/plans/2025-12-29-worm-arena-insights-audit-plan.md` need implementation.

## 2. Proposed Architecture

### A. `server/services/prompts/wormArenaInsights.ts` (NEW)
- Responsibility: Pure prompt construction.
- No business logic or API calls.
- Moves formatting helpers (`formatPercent`, `formatCost`) out of the main service.

### B. `server/services/wormArena/WormArenaReportService.ts` (NEW)
- Responsibility: Orchestrating the LLM request and formatting the final report (Markdown/Tweet).
- Handles both streaming and non-streaming report flows.
- Implements the fix for Responses API payload.

### C. `server/services/snakeBenchService.ts` (REFACTOR)
- Responsibility: Thin facade/orchestrator.
- Delegates match running to existing runners.
- Delegates report generation to `WormArenaReportService`.

## 3. Implementation Steps

### Step 1: Fix Responses API Payload
- Align instructions: Use the user prompt for **data context** only.
- Move narrative style ("hype-y eSports commentator") and structure requirements to the `instructions` and `text.format` fields.

### Step 2: Extract Prompts
- Create `server/services/prompts/wormArenaInsights.ts`.
- Implement `buildInsightsSummaryPrompt` with the missing metrics from the audit plan.

### Step 3: Create Report Service
- Create `server/services/wormArena/WormArenaReportService.ts`.
- Move Markdown and Tweet building logic.
- Implement `getModelInsightsReport` and `streamModelInsightsReport` logic here.

### Step 4: Refactor SnakeBenchService
- Strip out the reporting and prompt logic.
- Wire up the new service.

### Step 5: Verification
- Verify `getModelInsightsReport` returns the correct JSON-structured summary.
- Verify streaming works as expected with the new delegation.

## 4. Success Criteria
- [ ] `snakeBenchService.ts` reduced in size by ~40-50%.
- [ ] No more conflicting instructions in Responses API payload.
- [ ] All missing metrics from the audit plan included in the prompt.
- [ ] Clean separation of concerns (SRP).
