# Worm Arena DeepSeek Champions Tournament Plan

Date: 2026-01-10
Owner: Codex (GPT-5)

## Scope
Create a Python tournament script that runs DeepSeek v3.2 EXP and DeepSeek Chat v3.1 against a curated list of free OpenRouter models, plus a head-to-head match between the two champions. Two matches total per pairing, both directions. Use default SnakeBench settings and enforce a single active free-model match at a time by running matches sequentially.

## Objectives
- Use only catalog-backed OpenRouter slugs for all models.
- Run two matches total per pairing, one per direction.
- Keep free-model concurrency to one active match by running matches sequentially.
- Provide clear console output and error handling.

## TODO
- Add the Python tournament script under scripts/worm-arena-tournaments/.
- Add a CHANGELOG entry describing the new script and why it exists.
- Run the script against the local API once the server is running.

## Notes
- API endpoint: POST /api/snakebench/run-batch (count=1 per match).
- Defaults are used for board size, rounds, and apples.
