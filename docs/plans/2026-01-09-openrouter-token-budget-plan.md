Author: Codex (GPT-5)
Date: 2026-01-09T00:00:00Z
PURPOSE: Plan to ensure OpenRouter solver requests reserve enough output budget when reasoning is enabled, avoiding truncation.
SRP/DRY check: Pass - Focused on solver request parameters only.

Scope
- Update RE-ARC free solver request parameters to prevent output truncation when reasoning is enabled.
- Add configurable max token budget and safe defaults for OpenRouter calls in the solver.
- Record the change in CHANGELOG.md.

Objectives
- Ensure solver requests avoid premature length cutoff while still using medium reasoning.
- Keep configuration optional and environment-driven for flexibility across models.
- Preserve existing solver behavior when the new configuration is not set.

TODOs
- Add REARC_MAX_TOKENS env support and apply it to OpenRouter requests.
- Add a guardrail for reasoning-enabled requests to avoid pathological tiny budgets.
- Update CHANGELOG.md with what/why/how and author.
