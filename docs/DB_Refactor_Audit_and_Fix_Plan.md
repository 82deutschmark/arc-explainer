/**
 * DB Refactor Audit and Fix Plan
 * 
 * @author Gemini 2.5 Pro (Senior Developer)
 * @date 2025-08-23
 */

# Database Refactoring Audit & Remediation Plan

**Prepared by:** Gemini 2.5 Pro (Senior Developer)
**Date:** August 23, 2025

## 1. Executive Summary

The recent database service refactoring was left in a partially completed state, resulting in significant application instability. The core issues stem from inconsistent data access patterns, incorrect data formatting, and broken business logic within controllers. The `PuzzleOverview` page is non-functional, and new explanations do not display correctly because of these defects.

This document outlines the root causes and provides a clear, actionable plan to stabilize the application, complete the refactoring, and implement consistent, maintainable data access patterns.

## 2. Root Cause Analysis

My audit confirms the initial theories and reveals three primary points of failure:

*   __Mixed Data Access Patterns:__ The `puzzleController.ts` and `feedbackController.ts` incorrectly bypass their intended service layers and make direct calls to the database service (`getDatabaseService`). This creates two sources of truth for data retrieval logic and is a major architectural flaw.

*   __Inconsistent Data Formatting:__ The new database service at `server/db/index.ts` contains a legacy compatibility layer that is a source of critical bugs. It returns data with `snake_case` field names for write operations (e.g., `saveExplanation`) but `camelCase` for read operations. The frontend exclusively expects `camelCase`, causing newly saved data to be invisible.

*   __Broken & Misplaced Business Logic:__ The `puzzleController.overview` method contains highly complex, inefficient, and buggy logic for filtering and aggregating puzzle data. This logic directly calls a broken `getBulkExplanationStatus` function in the database service, which is the immediate cause of the `PuzzleOverview.tsx` page crash. This business logic belongs in the `puzzleService`, not the controller.

## 3. Remediation Plan

I will execute the following steps to resolve these issues. The guiding principle is to enforce a strict separation of concerns: **Controllers handle HTTP, Services contain business logic, and Repositories handle database interaction.**

### Step 1: Unify Database Service Logic

I will fix the `server/db/index.ts` file to ensure all methods consistently return `camelCase` properties. This will resolve the immediate issue of new explanations not appearing.

### Step 2: Consolidate Controller Logic

I will refactor the `puzzleController.ts` and `feedbackController.ts` to remove all direct calls to `getDatabaseService`. All database interactions will be delegated to their respective service layers (`puzzleService`, `feedbackService`).

### Step 3: Relocate and Fix Overview Logic

I will move the complex data aggregation logic from `puzzleController.overview` into the `puzzleService`. I will then fix the underlying database query (`getBulkExplanationStatus`) to be efficient and correct, resolving the overview page crash.

### Step 4: Remove Legacy Compatibility Layer

Once all controllers are using the service layer correctly, I will remove the legacy `dbService` export from `server/db/index.ts` to prevent future misuse.

### Step 5: Documentation & Changelog

I will update the `CHANGELOG.md` to reflect the repairs and document the correct data access patterns for the team.

## 4. Expected Outcome

Upon completion of this plan:

*   The `PuzzleOverview` page will be functional and load efficiently.
*   New explanations will appear immediately after being saved.
*   The backend will have a consistent, maintainable, and robust data access layer.
*   The risk of similar future bugs will be significantly reduced.

I will now begin implementing this plan, starting with Step 1.
