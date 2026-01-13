Author: Codex (GPT-5)
Date: 2026-01-09T00:00:00Z
PURPOSE: Plan to send OpenRouter reasoning configuration via extra_body in the
         Python streaming solver to avoid unsupported parameter errors.
SRP/DRY check: Pass - Focused on OpenRouter request shape only.

Scope
- Move reasoning config into extra_body for OpenRouter chat completions.

Objectives
- Eliminate unsupported keyword errors for reasoning.
- Preserve existing reasoning effort configuration.

TODOs
- Update OpenRouter request to pass reasoning via extra_body.
- Update CHANGELOG.md with what/why/how.

Status
- Approved and implemented on 2026-01-09.
