# Plan: Lenient JSON Schema Enforcement for AI Model Responses

*   **Date**: September 9, 2025
*   **Author**: Gemini 2.5 Pro
*   **Status**: Proposed

## 1. Problem Statement

The current system requires AI models, particularly those from OpenRouter, to return a comprehensive JSON object that strictly adheres to the `analysisResponseSchema`. This schema mandates several text-based fields like `pattern_description`, `solving_strategy`, and `hints`. If a model fails to return any of these fields, the entire response is discarded, even if it contains the critical data needed for evaluation: the `predicted_output_grid`(s) and the `confidence` score. This results in unnecessary failures and data loss from otherwise compliant models.

## 2. Guiding Principles

*   **The Database is the Source of Truth**: All changes must align with the existing `explanations` table schema as defined in `CLAUDE.md`.
*   **Prioritize Critical Data**: The primary goal is to successfully capture the predicted grid(s) and confidence score. All other fields are secondary.
*   **Graceful Degradation**: The system should handle missing secondary data gracefully by using default values, rather than failing the entire analysis.
*   **Maintain Multi-Test Logic**: The existing workflow for handling puzzles with multiple test cases (expecting a `multiplePredictedOutputs` array) will be maintained to ensure compatibility with the database and frontend.

## 3. Proposed Solution: Two-Stage Validation

I will implement a two-stage validation process within the `ResponseProcessor` service to make the system more resilient.

### Stage 1: Minimal Viable Validation

First, I will validate the parsed JSON from the AI against a new, highly lenient Zod schema. This schema will only enforce the absolute minimum requirements for the analysis to be useful.

There will be two minimal schemas:

1.  `minimalSingleTestSchema`: Requires `predicted_output_grid` (a 2D array of numbers/strings) and `confidence` (an integer).
2.  `minimalMultiTestSchema`: Requires `multiple_predicted_outputs` (an array of objects, each with a `predicted_grid`) and finally a top-level `confidence` (1-100).

The system will first check if the puzzle has multiple test cases and apply the appropriate minimal schema.

### Stage 2: Data Enrichment and Full Validation

If the minimal validation from Stage 1 is successful, the system will proceed to a second stage:

1.  **Attempt Full Validation**: The system will try to parse the *same* JSON object against the existing, stricter `analysisResponseSchema`.
2.  **On Success**: If it passes, the full, validated data object is used, and the process continues as normal.
3.  **On Failure (Graceful Fallback)**: If it fails, the system will *not* throw a fatal error. Instead, it will:
    *   Log a warning indicating which fields were missing from the full schema.
    *   Create a new data object by combining the successfully parsed minimal data (from Stage 1) with default values for all missing fields (e.g., `pattern_description: 'Not provided'`, `hints: []`).
    *   This enriched object, now compliant with the system's internal types, will be used for the rest of the process (database saving, etc.).

## 4. Implementation Details

1.  **File to Modify**: `server/services/ResponseProcessor.ts`.
2.  **New Schemas**: Define `minimalSingleTestSchema` and `minimalMultiTestSchema` using Zod at the top of the file.
3.  **Refactor `normalizeAndValidate`**: This method will be updated to implement the two-stage logic described above.
4.  **Default Values**: A constant object `DEFAULT_ANALYSIS_FIELDS` will be created to hold the fallback values for missing text fields.

This approach ensures that as long as the AI provides a valid grid prediction and a confidence score, the analysis will be saved, drastically improving the reliability and data capture rate from less-compliant models.
