Author: GPT-5
Date: 2025-12-25
PURPOSE: Plan to fix SnakeBench OpenAI Responses transforms routing for OpenAI direct while keeping OpenRouter transforms for Snake Arena.
SRP/DRY check: Pass - reuse existing provider request assembly and avoid duplication.

# 2025-12-25 - SnakeBench OpenAI transforms routing fix plan

## Goals
- Keep OpenAI models routing direct by default.
- Ensure Snake Arena can route via OpenRouter when configured.
- Prevent OpenAI SDK from receiving OpenRouter-only transforms.

## Scope
- Update request assembly in external/SnakeBench/backend/llm_providers.py:
  - Move transforms into OpenRouter extra_body.
  - Strip transforms when calling OpenAI direct.
  - Add comments about provider-only fields.
- Update documentation to explain transforms are OpenRouter-only.
- Update changelog entries with semantic version and file list.
- Commit changes with a detailed message.

## Files to touch
- external/SnakeBench/backend/llm_providers.py
- external/SnakeBench/README.md
- CHANGELOG.md
- external/SnakeBench/CHANGELOG.md

## Validation
- Confirm OpenAI SDK responses.create signature does not accept transforms.
- Optional: run a local Snake Arena match to verify calls succeed.
