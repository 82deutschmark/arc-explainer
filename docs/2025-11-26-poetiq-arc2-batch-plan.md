# 2025-11-26-poetiq-arc2-batch-plan

## Goal
- Ensure the Poetiq batch runner targets 20 ARC2-Eval puzzles with two experts per run and execute the batch against the live dev server.

## Files & Touchpoints
- `run-poetiq-batch.js` – update puzzle selection (20 IDs), default expert count, logging, and summary math.
- `CHANGELOG.md` – record the script update with semantic versioning.

## Tasks
1. Update the batch runner script to load 20 ARC2-Eval puzzles, default to two experts, and clean up the logging.
2. Execute the script against the running dev server to submit all 20 puzzles sequentially.
3. Capture the batch outcome for reporting back to the user.
