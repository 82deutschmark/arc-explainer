<!--
  Analysis_Data_Flow_Trace.md
  What: A step-by-step trace of the data flow for puzzle analysis.
  How: Explains the process from a user click to the result display.
  Author: Cascade
-->

# Analysis Data Flow Trace

This document provides a detailed, step-by-step trace of the data flow that occurs when a user initiates a puzzle analysis in the ARC Explainer application. Understanding this flow is key to debugging and extending the application's capabilities.

## The Big Picture

The process follows a "database-first" architecture. The frontend UI doesn't display results directly from the AI. Instead, it triggers a backend process, waits for the results to be saved to the database, and then re-fetches the data from the database to update the display. 

```
Frontend (Browser)         Backend (Server)              External AI (e.g., OpenAI)
+----------------+         +-------------------+           +------------------------+
| 1. User Clicks | ------> | 2. API Request    |           |                        |
|   'Analyze'    |         |    Arrives        |           |                        |
|                |         |                   |           |                        |
|                |         | 3. Build Prompt   |           |                        |
|                |         |                   |           |                        |
|                |         | 4. Call AI API    | --------> | 5. Process & Respond   |
|                |         |                   | <-------- |                        |
|                |         |                   |           |                        |
|                |         | 6. Validate & Save|           |                        |
|                |         |    to Database    |           |                        |
|                |         |                   |           |                        |
| 8. Refetch &   | <------ | 7. Send Success   |           |                        |
|    Update UI   |         |    Response       |           |                        |
+----------------+         +-------------------+           +------------------------+
```

## Step-by-Step Data Flow

The process is broken down into two main parts: the Frontend (what happens in the user's browser) and the Backend (what happens on our server).

### Part 1: The Frontend (User's Browser)

1.  **User Clicks "Analyze"**
    *   **Where**: `PuzzleExaminer.tsx` page.
    *   **What**: The user clicks a `ModelButton` component for a specific AI model.
    *   **Action**: This triggers the `onAnalyze` function that was passed to the button.

2.  **The `useAnalysisResults` Hook Takes Over**
    *   **Where**: `client/src/hooks/useAnalysisResults.ts`.
    *   **What**: The `onAnalyze` function belongs to this hook. It immediately sets an `isAnalyzing` state for that model to `true`.
    *   **Action**: The UI reacts, disabling the button and showing a loading spinner to provide feedback to the user.

3.  **API Request to the Backend**
    *   **What**: The hook calls `analyzePuzzleWithModel`, which uses the browser's `fetch` API to send a `POST` request to the server.
    *   **Endpoint**: `/api/puzzle/analyze`.
    *   **Payload**: The request body contains the `puzzleId`, the selected `modelKey`, and any advanced parameters like `temperature`.

4.  **UI Waits for the Result**
    *   **What**: The frontend now waits asynchronously for the backend to complete the entire analysis and database-saving process.

5.  **UI Refreshes with New Data**
    *   **What**: Once the backend sends a success response, the `useAnalysisResults` hook calls the `refetchExplanations` function (from the `useExplanation` hook).
    *   **Action**: This triggers another API call (`GET /api/explanations/:puzzleId`) to fetch a fresh, complete list of all explanations for the puzzle directly from the database.
    *   **Result**: React detects the updated list of explanations, re-renders the component, and the new `AnalysisResultCard` appears on the screen.

### Part 2: The Backend (The Server)

1.  **API Request Arrives**
    *   **Where**: `server/routes.ts` and `server/controllers/puzzleController.ts`.
    *   **What**: The server's router maps the `/api/puzzle/analyze` endpoint to the `analyzePuzzle` function in the `puzzleController`.

2.  **The `puzzleController` Gets to Work**
    *   **What**: The controller orchestrates the entire backend process. It first fetches the complete puzzle data from the local file system using the `puzzleService`.

3.  **Building the Prompt**
    *   **Where**: `server/services/promptBuilder.ts`.
    *   **What**: The controller calls the `promptBuilder` to construct the precise prompt to be sent to the AI. This includes formatting the puzzle grids, adding instructions, and incorporating any selected prompt templates.

4.  **Calling the AI Model**
    *   **Where**: `server/services/openai.ts` (or other provider services).
    *   **What**: The controller determines the correct AI provider based on the `modelKey` and calls its `analyzePuzzleWithModel` function. This service is responsible for making the actual API call to the external AI provider (e.g., OpenAI's API).

5.  **Validating the AI's Answer**
    *   **Where**: `server/services/responseValidator.ts`.
    *   **What**: After the AI model responds, its output is passed to the `responseValidator`. This service extracts the predicted grid(s) from the JSON response and compares them to the actual correct output grids from the puzzle file. It calculates correctness and accuracy scores.

6.  **Saving to the Database**
    *   **Where**: `server/services/dbService.ts`.
    *   **What**: The controller takes the full, validated result—including the AI's text explanation, the predicted grids, correctness flags, and performance scores—and calls `dbService.saveExplanation`.
    *   **Action**: This service function inserts a new record into the `explanations` table in the PostgreSQL database.

7.  **Sending Success Back to Frontend**
    *   **What**: Once the database write is successful, the controller sends a success status (e.g., `200 OK`) back to the frontend.
    *   **Action**: This response signals to the frontend that the process is complete, which triggers the data refetching step (Part 1, Step 5).

## Conclusion

This data flow ensures a high degree of data integrity. By making the database the single source of truth, we guarantee that what the user sees on the screen is always a persistent, validated, and accurate record of the analysis that was performed.
