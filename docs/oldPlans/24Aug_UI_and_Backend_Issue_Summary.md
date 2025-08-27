# Summary of UI Crash and Backend Errors (as of Aug 24)

This document outlines two critical issues identified in the ARC Explainer application: a frontend UI crash related to React hooks and a backend data corruption error. This summary is intended for a new developer to take over the debugging and resolution process.

---

## 1. Frontend: React Hook Order Violation Causing UI Crash

### Issue Description
The application's UI crashes when a user attempts to view multi-test results within the analysis view. This is caused by a violation of React's "Rules of Hooks."

*   **Component:** `client/src/components/puzzle/AnalysisResultCard.tsx`
*   **Error Trigger:** Clicking the button to expand and display results for puzzles with multiple test cases.
*   **Root Cause:** The `useMemo` hook is being called conditionally inside a `.map()` loop, which is forbidden. Hooks must be called at the top level of a component and in the same order on every render.

### Investigation & Progress
- The problematic code was identified in the section of `AnalysisResultCard.tsx` responsible for rendering the grid of multi-test predictions.
- An attempt was made to refactor this logic by extracting it into a new, dedicated component (`MultiTestResults`). This approach isolates the hook usage and ensures it's called consistently, resolving the violation.
- The refactoring is currently in progress but has not been completed or fully tested.

### Next Steps
1.  Complete the refactoring of the multi-test rendering logic from `AnalysisResultCard.tsx` into its own component.
2.  Ensure all necessary props are passed to the new component.
3.  Verify that all hooks (`useMemo`, `useState`, etc.) are called at the top level of the new component, not within any loops or conditions.
4.  Test the UI thoroughly with single-test and multi-test puzzles to confirm the crash is resolved and results display correctly.

---

## 2. Backend: 500 Internal Server Error on Save

### Issue Description
The backend throws a 500 Internal Server Error when attempting to save an explained puzzle that contains multi-test data. This points to a data handling or serialization issue.

*   **Endpoint:** `POST /api/puzzle/save-explained/:taskId`
*   **Root Cause:** The investigation (see `docs/Multi-Test-Data-Corruption-Investigation-24Aug.md`) revealed that 3D prediction arrays for multi-test cases were being incorrectly converted to a string (`JSON.stringify`) before being passed to the database driver for insertion into a PostgreSQL `JSONB` column. The database driver expects a raw JavaScript object/array for `JSONB` fields, not a pre-stringified JSON string. This double-stringification corrupts the data.

### Investigation & Progress
- The root cause has been clearly identified. The fix requires modifying the data-saving logic to prevent the premature `JSON.stringify` call.

### Next Steps
1.  Locate the code in the backend service responsible for handling the `/api/puzzle/save-explained/:taskId` route. This is likely in `server/controllers/explanationController.ts` or a related service file.
2.  Identify where the multi-test prediction data is prepared for the database query.
3.  Remove the `JSON.stringify()` call that is incorrectly applied to the prediction data. Ensure the raw JavaScript array is passed directly to the database insertion/update function (e.g., using Drizzle ORM).
4.  Test the endpoint by saving a multi-test puzzle explanation and verifying that the request succeeds (200 OK).
5.  Query the database directly to inspect the stored `JSONB` data and confirm it is structured correctly as a JSON array/object, not a string.
