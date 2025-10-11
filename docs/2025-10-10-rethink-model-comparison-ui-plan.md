# Plan: Rethink and Rebuild Model Comparison UI

**Author:** Cascade (GPT-4)
**Date:** 2025-10-10

## 1. Objective

The current model comparison UI is failing to display data correctly, despite backend fixes. This plan outlines the steps to diagnose the root cause, redesign, and implement a new, robust, and intuitive frontend component for comparing AI model performance.

## 2. Analysis Phase

I will conduct a thorough analysis of the existing implementation, covering both frontend and backend.

### 2.1. Backend Analysis
- **Goal**: Understand the exact structure of the data provided by the model comparison API endpoint.
- **Files to Review**:
  - `server/controllers/metricsController.ts`: To find the API endpoint and see how it handles requests.
  - `server/repositories/MetricsRepository.ts`: To understand the data aggregation logic.
  - `server/repositories/ModelDatasetRepository.ts`: To see how puzzle lists are generated.
  - `shared/types.ts`: For relevant data type definitions.

### 2.2. Frontend Analysis
- **Goal**: Identify why the current component is failing to request or render data correctly.
- **Files to Review**:
  - `client/src/pages/AnalyticsOverview.tsx`: To see how the comparison dialog is triggered and what parameters are passed.
  - `client/src/components/analytics/ModelComparisonDialog.tsx`: To analyze the data fetching, state management, and rendering logic.

## 3. Diagnosis (Hypothesis)

Based on the user's report, my initial hypotheses are:
- The frontend is sending an incorrectly formatted request to the backend (e.g., wrong parameters for models or dataset).
- The frontend is failing to correctly parse or process the complex data structure returned by the backend.
- The rendering logic is flawed and cannot handle the matrix of comparison data, especially with edge cases like missing data for a specific model/puzzle combination.

## 4. Proposed Solution & Implementation Plan

I will replace the existing `ModelComparisonDialog.tsx` with a new, more robust component. 

### 4.1. New Component: `NewModelComparison.tsx`
- **Data Fetching**: Use `tanstack-query` for robust data fetching, caching, and state management (loading, error, success).
- **State Management**: Manage selected models and the selected dataset cleanly using React state.
- **Display Logic**: 
  - Render a clear matrix (table) with puzzles as rows and models as columns.
  - Each cell will display the key performance metric (e.g., `is_prediction_correct` or `multi_test_all_correct`).
  - Use clear visual indicators (e.g., icons, colors) for correct, incorrect, and missing data points.
  - Display summary statistics (total correct, total incorrect, accuracy %) for each model.
- **User Experience**:
  - Show a loading spinner while data is being fetched.
  - Display a clear error message if the API call fails.
  - Ensure the dialog is well-styled and responsive, using `shadcn/ui` components.

### 4.2. Implementation Steps
1.  **Create Plan Document**: (This file) - **Done**
2.  **Analyze Codebase**: Review files listed in the analysis phase.
3.  **Create New Component**: Create `client/src/components/analytics/NewModelComparison.tsx` with the logic described above.
4.  **Integrate Component**: Modify `client/src/pages/AnalyticsOverview.tsx` to remove the old `ModelComparisonDialog` and integrate the new one.
5.  **Testing**: Manually verify that the new component fetches and displays data correctly for various model and dataset selections.
6.  **Cleanup**: Remove the old `ModelComparisonDialog.tsx` file.
7.  **Commit**: Commit all changes with a clear and descriptive message, referencing this plan.

## 5. SRP and DRY Check
- The new component will have the single responsibility of displaying model comparison data.
- Data fetching logic will be encapsulated within the component or a dedicated hook.
- Reusable `shadcn/ui` components will be used to avoid writing custom UI code.

This plan ensures a methodical approach to fixing the issue and delivering a high-quality feature that meets the user's expectations.
