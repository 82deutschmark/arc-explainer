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

## 3. Proposed Architecture: The Ingest-and-Process Pipeline (Revised)

This revised plan leverages our existing database structure, making the transition more efficient and less disruptive. Instead of creating a new table, we will enhance the existing `explanations` table to support a two-stage pipeline.

### Stage 1: Ingest into the `explanations` Table

-   **Responsibility:** To capture the raw, unaltered response from any AI provider and store it immediately in a new `explanations` record.
-   **Implementation:**
    -   A new `status` column will be added to the `explanations` table (`'raw'`, `'processing'`, `'parsed'`, `'failed'`).
    -   When an AI response is received, `explanationService.ts` will create a new record in `explanations`.
    -   It will populate only the essential metadata (`puzzle_id`, `model_name`) and the complete, unaltered response into the existing `provider_raw_response` column.
    -   The record's `status` will be set to `'raw'`. All other analysis fields (`pattern_description`, `hints`, etc.) will be left null.

### Stage 2: The Asynchronous Processing Service

-   **Responsibility:** To find `'raw'` records in the `explanations` table, parse the `provider_raw_response`, and update the record with the structured data.
-   **Implementation:**
    -   A new background service (`ParsingService.ts`) will periodically query the `explanations` table for records where `status = 'raw'`.
    -   For each record, it will apply our new, smarter parsing logic to the `provider_raw_response` data.
    -   Upon successful parsing, it will **update** the existing record, filling in all the analysis fields (`pattern_description`, `solving_strategy`, `predicted_output_grid`, etc.) and setting the `status` to `'parsed'`.
    -   If parsing fails, it will update the `status` to `'failed'` and log the error, preserving the raw data for future analysis or reprocessing.

## 4. Implementation Plan (Revised)

This project will be executed in distinct, sequential phases.

### Phase 1: Database and Schema Setup

-   [ ] **Task:** Add a `status` column (`VARCHAR(20)`) to the `explanations` table with a default value of `'parsed'`. Create a Drizzle migration file for this change.
-   [ ] **Task:** Update the `DatabaseExplanation` type in `shared/types.ts` to include the new `status` field.
-   [ ] **Task:** Simplify the prompts and `arcJsonSchema.ts` to ask the AI for a simple, text-based prediction format followed by a JSON block for analysis, as previously discussed.

### Phase 2: Refactor `explanationService.ts` for Ingest

-   [ ] **Task:** Modify the `saveExplanation` function. It will now perform an `INSERT` operation, saving only the raw response and metadata and setting `status` to `'raw'`. The complex multi-source data mapping logic will be removed from this function.

### Phase 3: Build the Asynchronous Processing Service

-   [ ] **Task:** Create a new `ParsingService.ts`. This service will contain the logic to fetch `raw` explanation records.
-   [ ] **Task:** Implement the advanced, multi-stage parsing logic within `ParsingService.ts`. This parser will:
    1.  Read the `provider_raw_response`.
    2.  Extract prediction grids using text-based markers.
    3.  Extract the analysis JSON block.
    4.  Construct the full explanation object.
-   [ ] **Task:** The service will then `UPDATE` the existing record in the `explanations` table with the parsed data and set the `status` to `'parsed'` or `'failed'`.
-   [ ] **Task:** Integrate this service as a background worker (e.g., via `setInterval` for the initial version).

### Phase 4: Frontend and User Experience

-   [ ] **Task:** Update the frontend UI to handle the asynchronous nature of explanations. When a user requests an analysis, the UI should immediately show a "Processing..." or "Analysis in progress" state.
-   [ ] **Task:** Implement a mechanism (like WebSockets or polling) for the frontend to be notified when the processing is complete, at which point it will fetch and display the final, parsed explanation from the `explanations` table.

## 5. Benefits of This Architecture

1.  **Zero Data Loss:** Every paid API call result is permanently stored, regardless of parsing success.
2.  **System Resilience:** A failure in parsing no longer crashes the entire process. The system can gracefully handle malformed data and continue operating.
3.  **Re-processability:** We can fix or improve our parser and re-run it on all previously failed responses, recovering data that would have otherwise been lost.
4.  **Simplified AI Integration:** Adding new AI models becomes much easier. We only need to handle their raw output, not create complex, model-specific parsing logic in the critical path.
5.  **Improved Debugging:** When a response fails to parse, we have the exact raw data available for inspection and debugging.
