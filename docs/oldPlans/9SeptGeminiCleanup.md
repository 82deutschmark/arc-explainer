# Plan: Consolidate AI Response Debug Logging

*   **Date**: September 9, 2025
*   **Author**: Gemini 2.5 Pro
*   **Status**: Proposed

## 1. Problem Statement

Currently, when an AI model provider returns a response that cannot be parsed as valid JSON, the system generates up to four separate debug files for a single analysis attempt. This includes a raw text dump (`-PARSE_FAILED-raw.txt`), multiple timestamped JSON files containing the raw response (`-raw.json`), and the final `EXPLAINED.json` which also indicates a failure. This behavior is redundant, clutters the `data/explained` directory, and makes debugging inefficient.

## 2. Objective

Refactor the AI service layer to ensure that for any given analysis, only **one** file is created: the final `EXPLAINED.json`. In the event of a JSON parsing failure, the raw, unparsable response from the model provider must be preserved within a designated field (e.g., `provider_raw_response`) inside this single `EXPLAINED.json` file. All other intermediate debug files (`.txt`, extra `.json` files) should be eliminated.

## 3. Files to be Modified

The following files are the primary targets for this refactoring effort:

1.  `server/services/base/BaseAIService.ts`
2.  `server/services/openrouter.ts`
3.  `server/services/gemini.ts`
4.  `server/services/anthropic.ts`
5.  `server/services/deepseek.ts`
6.  `server/services/ExplanationService.ts`

## 4. Execution Plan

This is a task list for a senior developer to execute.

### Task 1: Eliminate Raw Text File Logging

*   **File**: `server/services/base/BaseAIService.ts`
*   **Action**: Locate the logic responsible for saving the `-PARSE_FAILED-raw.txt` file. This functionality is likely within the `parseProviderResponse` method of concrete service implementations or a utility they call. Remove this file-writing operation entirely. The raw response will be persisted in the main JSON object instead.

### Task 2: Remove Redundant JSON Debug Files

*   **Files**: `server/services/openrouter.ts`, `server/services/gemini.ts`, `server/services/anthropic.ts`, `server/services/deepseek.ts` (and any other provider-specific services).
*   **Action**: Inspect the `parseProviderResponse` method in each service. Identify and remove any code that saves an intermediate `-raw.json` file to the `data/explained` directory upon a parsing failure. The `extractJsonFromResponse` method in `BaseAIService.ts` already prepares an object with the raw response; this object should be returned up the call stack, not saved to a file at this stage.

### Task 3: Standardize Failure Object Propagation

*   **File**: `server/services/base/BaseAIService.ts`
*   **Action**: Ensure the `extractJsonFromResponse` method consistently returns a standardized object on failure, containing fields like `_parsingFailed: true` and `_rawResponse`. This object should be the single source of truth for a parse failure.

### Task 4: Ensure Final Persistence in ExplanationService

*   **File**: `server/services/ExplanationService.ts`
*   **Action**: Modify the `saveExplanation` (or equivalent) method. Add logic to check if the incoming `explanationData` object has the `_parsingFailed` flag set to `true`. If it does, ensure that the content of the `_rawResponse` field is saved to the `provider_raw_response` column in the database and the corresponding field in the final `EXPLAINED.json` file. This centralizes the responsibility of persisting the failed response into the final, authoritative artifact.

By completing these tasks, the system will adhere to a much cleaner and more efficient logging strategy, saving only the essential `EXPLAINED.json` file while still preserving critical debugging information in the case of a model response parsing error.
