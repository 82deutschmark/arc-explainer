# Plan for PuzzleDBViewer and User Solution Submission

**Author:** Gemini2.5 Pro

## 1. Project Overview

This project will introduce a new user-facing feature to the ARC Explainer application. The goal is to create a dedicated page, `PuzzleDBViewer`, where users can view existing data and analysis for a specific ARC puzzle and submit their own explanations for how to solve it. This enhances user engagement and allows for the collection of human-generated solutions.

This new page will replace the current behavior where clicking a puzzle in the discussion area navigates back to the `PuzzleExaminer`.

## 2. Backend Changes

### 2.1. Database Schema

We will leverage the existing `feedback` table to store user-submitted puzzle solutions. A new `feedback_type` or similar column will be added to distinguish these submissions from other types of feedback. This avoids creating a new table and reuses existing feedback infrastructure as requested.

*   **Table:** `feedback`
*   **Action:** Add a new column `submission_type` (e.g., 'solution_explanation', 'general_feedback').

### 2.2. API Endpoints

New endpoints will be created to support the `PuzzleDBViewer` page.

*   **`GET /api/puzzles/:puzzleId/solutions`**
    *   **Description:** Fetches all user-submitted solutions for a given puzzle ID.
    *   **Controller:** A new method in `feedbackController.ts`.
    *   **Service:** A new method in a feedback service to query the database.

*   **`POST /api/puzzles/:puzzleId/solutions`**
    *   **Description:** Submits a new user explanation for a puzzle.
    *   **Controller:** A new method in `feedbackController.ts`.
    *   **Service:** A new method in a feedback service to write to the `feedback` table.

## 3. Frontend Changes

### 3.1. New Page: `PuzzleDBViewer.tsx`

A new page component will be created at `client/src/pages/PuzzleDBViewer.tsx`.

*   **Structure:** This component will be based on `PuzzleExaminer.tsx` but adapted for viewing existing data and submitting a solution.
*   **Features:**
    *   Display the ARC puzzle grid (input and output pairs).
    *   Fetch and display existing AI-generated explanations and user-submitted solutions.
    *   Include a rich text editor or a simple text area for users to write their own solution explanation.
    *   A "Submit" button to post the explanation via the new backend API.

### 3.2. Routing

*   Add a new route in the main router file (e.g., `App.tsx`) for the `PuzzleDBViewer` page:
    *   **Path:** `/puzzle/:puzzleId`
    *   **Component:** `PuzzleDBViewer`

### 3.3. Update `PuzzleDiscussion.tsx`

*   Modify the `PuzzleCard` components within `PuzzleDiscussion.tsx`.
*   The `onClick` handler or link will be changed to navigate to the new `/puzzle/:puzzleId` route instead of the `/examine/:puzzleId` route.

## 4. Task Breakdown

- [ ] **Phase 1: Backend**
    - [ ] Create a database migration script to add the `submission_type` column to the `feedback` table.
    - [ ] Implement the `GET /api/puzzles/:puzzleId/solutions` endpoint.
    - [ ] Implement the `POST /api/puzzles/:puzzleId/solutions` endpoint.
    - [ ] Add corresponding controller and service methods.

- [ ] **Phase 2: Frontend**
    - [ ] Create the basic `PuzzleDBViewer.tsx` file by copying and adapting `PuzzleExaminer.tsx`.
    - [ ] Add the new `/puzzle/:puzzleId` route.
    - [ ] Implement data fetching for puzzle details and existing solutions.
    - [ ] Create the solution submission form.
    - [ ] Implement the logic to `POST` the new solution.
    - [ ] Update `PuzzleDiscussion.tsx` to link to the new page.

- [ ] **Phase 3: Commits & Cleanup**
    - [ ] Commit all changes with detailed messages, authored by "Gemini2.5 Pro".
    - [ ] Review and comment all new code.
