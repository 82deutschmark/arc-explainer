# Plan for Model Comparison Feature

This document outlines the plan to implement a model comparison feature on the `AnalyticsOverview.tsx` page.

## 1. Backend: New Comparison Endpoint

- **Action:** Create a new API endpoint `GET /api/analytics/compare`.
- **Parameters:** `model1: string`, `model2: string`, `dataset: string`.
- **Functionality:**
  - Fetch all puzzle IDs for the given `dataset`.
  - For each puzzle, retrieve the latest `explanation` for `model1` and `model2`.
  - Determine the correctness status (`is_prediction_correct` or `multi_test_all_correct`) for each.
- **Response:** Return a JSON object containing:
  - `summary`: Counts for categories (Both Correct, Model 1 Only, Model 2 Only, Both Incorrect, etc.).
  - `details`: An array of objects, one for each puzzle, with the puzzle ID and the result for each model.

## 2. Frontend: UI Modifications

- **File:** `client/src/pages/AnalyticsOverview.tsx`.
- **Changes:**
  - Add a second `Select` component for choosing `model2`.
  - Add a "Compare" button, which will be disabled until two different models and a dataset are selected.
  - On-click, the button will trigger a new data fetch to the `/api/analytics/compare` endpoint.

## 3. Frontend: Display Results

- **File:** `client/src/pages/AnalyticsOverview.tsx`.
- **Changes:**
  - Create a new component, `ModelComparisonResults`, to render the comparison data.
  - **Summary View:** Display the summary statistics in clear, easy-to-read cards.
  - **Detailed View:** Render a table similar to the one on the `/feedback` page:
    - **Rows:** Puzzle IDs from the dataset.
    - **Columns:** Model 1 Result, Model 2 Result.
    - **Cells:** Use icons (e.g., checkmark for correct, 'x' for incorrect) to show the result for each model on each puzzle.

## 4. Refinement and Finalization

- **Action:** Review the implementation for clarity, performance, and adherence to the project's coding standards.
- **Action:** Add comments where necessary.
- **Action:** Commit all changes with a detailed commit message outlining the new feature.
