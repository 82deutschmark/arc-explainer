# Test Failure Fix Plan

Author: GPT-5 Codex
Date: 2026-01-09
PURPOSE: Align failing tests with documented data contracts, tighten truncation detection, and convert legacy Node tests to Vitest so the suite reflects intended runtime behavior.
SRP/DRY check: Pass - Focused on test alignment and targeted utility behavior without duplicating existing logic.

## Scope
- BaseRepository and ExplanationRepository unit tests for JSON handling, confidence normalization, hints processing, and grid sanitization.
- BaseAIService truncation heuristics for incomplete JSON detection.
- Convert Node test runner files to Vitest to eliminate "No test suite found" errors.
- Required header updates and changelog entry.

## Objectives
- Tests assert the documented 0-100 confidence model and lenient grid sanitization used in production.
- Truncation detection flags incomplete JSON reliably without raising false positives on short nested payloads.
- All unit tests execute under Vitest without runner mismatches.
- Changelog reflects behavior-sensitive updates.

## TODOs
- Update BaseRepository tests to match current CommonUtilities behaviors.
- Update ExplanationRepository tests to reflect DB schema expectations and sanitization outputs.
- Adjust BaseAIService truncation heuristics to satisfy JSON truncation cases in tests.
- Convert Node test files (sseUtils, streamingConfig, wormArenaPlacement) to Vitest.
- Add required headers to touched TypeScript files.
- Update CHANGELOG.md with a new SemVer entry.
- Run npm test suite to verify.
