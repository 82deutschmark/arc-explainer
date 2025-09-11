# Strategic Plan: A Resilient AI Response Processing Pipeline

**Date:** 2025-09-11
**Author:** Gemini 2.5 Pro
**Status:** Proposed

## 1. Executive Summary

This document outlines a strategic architectural shift for the ARC Explainer backend. Our current approach, which attempts to fetch, parse, and save AI responses in a single, monolithic transaction, is fragile. It leads to the loss of valuable data when an AI provider returns a response in an unexpected format, a common occurrence with evolving models. 

Following a strategic review, we will move to a **two-stage ingest-and-process pipeline**. This new architecture prioritizes data integrity by immediately saving all raw AI responses to a dedicated table. A separate, asynchronous process will then handle the complex task of parsing this raw data and populating our primary `explanations` table. This decouples data acquisition from data processing, creating a more robust, resilient, and future-proof system.

## 2. The Core Problem: Fragility and Data Loss

The current system couples two distinct processes:
1.  **Fetching Data:** Making an expensive API call to an AI provider.
2.  **Processing Data:** Parsing the response and saving it to the `explanations` database.

This tight coupling is the root of our problem. If the parsing logic fails for any reason—a new model format, a slight deviation in the JSON, or an unexpected character—the entire operation fails. The raw response, which we paid for, is discarded, and the data is lost forever. This is unacceptable.

Furthermore, this architecture makes it difficult to:
-   **Support new models:** Each new model with a slightly different output format requires fragile, custom parsing logic within the main request-response cycle.
-   **Recover from errors:** There is no mechanism to re-process responses that failed to parse. 
-   **Iterate on parsing:** Improving our parsing logic requires re-running expensive API calls to get the same data back.

## 3. Proposed Architecture: The Ingest-and-Process Pipeline

To solve these issues, we will implement a two-stage pipeline that separates concerns.

### Stage 1: The Ingest Service

-   **Responsibility:** To capture the raw, unaltered response from any AI provider as quickly and reliably as possible.
-   **Implementation:**
    -   A new database table, `raw_api_responses`, will be created.
    -   All AI services (`gemini.ts`, `openrouter.ts`, etc.) will be modified. Their sole responsibility after receiving a response from the provider will be to save the entire raw payload to this new table.
    -   Immediate, complex parsing will be removed from these services.

### `raw_api_responses` Table Schema:

```sql
CREATE TABLE raw_api_responses (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  puzzle_id VARCHAR(100) NOT NULL,
  raw_response JSONB NOT NULL, -- Store the full, raw JSON or text
  api_processing_time_ms INT,
  estimated_cost NUMERIC(12, 8),
  status VARCHAR(20) DEFAULT 'pending' NOT NULL, -- pending, processed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE
);
```

### Stage 2: The Processing Service

-   **Responsibility:** To read `pending` entries from the `raw_api_responses` table, parse them into our structured format, and save the result to the `explanations` table.
-   **Implementation:**
    -   A new, asynchronous background worker or service will be created.
    -   This service will periodically query the `raw_api_responses` table for entries with `status = 'pending'`.
    -   It will apply a new, more sophisticated multi-stage parsing logic to the `raw_response` data.
    -   On successful parsing, it will save the structured data to the `explanations` table and update the corresponding `raw_api_responses` entry to `status = 'processed'`.
    -   If parsing fails, it will update the status to `failed` and log the error, preserving the raw data for future analysis or reprocessing.

## 4. Implementation Plan

This project will be executed in distinct, sequential phases.

### Phase 1: Database and Schema Setup

-   [ ] **Task:** Create the `raw_api_responses` table in the database using a new Drizzle migration file.
-   [ ] **Task:** Update the `arcJsonSchema.ts` to reflect the simplest possible output from the AI. The schema should only define the *analysis* portion (strategy, hints, confidence), not the predictions.

### Phase 2: Refactor AI Services for Ingest

-   [ ] **Task:** Modify `explanationService.ts`. The `saveExplanation` function will be refactored to no longer perform parsing. It will instead take the raw response from an AI service and save it directly to the new `raw_api_responses` table.
-   [ ] **Task:** Update all AI provider services (`gemini.ts`, `openrouter.ts`, `anthropic.ts`, etc.). The `analyzePuzzleWithModel` method in each service will now return the raw response object, which will then be passed to the new ingest logic in `explanationService.ts`.

### Phase 3: Build the Asynchronous Processing Service

-   [ ] **Task:** Create a new `ParsingService.ts`. This service will contain the logic to fetch pending raw responses.
-   [ ] **Task:** Implement the advanced, multi-stage parsing logic within `ParsingService.ts`. This parser will:
    1.  Extract prediction grids using text-based markers (e.g., `Here is my prediction:`).
    2.  Extract the analysis JSON block.
    3.  Combine the extracted data into the structure required by the `explanations` table.
-   [ ] **Task:** Integrate this service as a background worker. This could be a simple `setInterval` loop for initial implementation, or a more robust job queue system if needed.

### Phase 4: Frontend and User Experience

-   [ ] **Task:** Update the frontend UI to handle the asynchronous nature of explanations. When a user requests an analysis, the UI should immediately show a "Processing..." or "Analysis in progress" state.
-   [ ] **Task:** Implement a mechanism (like WebSockets or polling) for the frontend to be notified when the processing is complete, at which point it will fetch and display the final, parsed explanation from the `explanations` table.

## 5. Benefits of This Architecture

1.  **Zero Data Loss:** Every paid API call result is permanently stored, regardless of parsing success.
2.  **System Resilience:** A failure in parsing no longer crashes the entire process. The system can gracefully handle malformed data and continue operating.
3.  **Re-processability:** We can fix or improve our parser and re-run it on all previously failed responses, recovering data that would have otherwise been lost.
4.  **Simplified AI Integration:** Adding new AI models becomes much easier. We only need to handle their raw output, not create complex, model-specific parsing logic in the critical path.
5.  **Improved Debugging:** When a response fails to parse, we have the exact raw data available for inspection and debugging.
