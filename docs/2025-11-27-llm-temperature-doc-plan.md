# 2025-11-27 LLM Temperature Guidance Plan

## Goal
Document how the Poetiq integration stays LLM-agnostic while still exposing a temperature control, and explain why the solver defaults to `1.0` even though individual providers ship different sampling ranges.

## Why
- Folks reviewing the Poetiq deployment keep asking why we hard-code `temperature: 1.0` in a few places (`PoetiqSolver.tsx`, `poetiqController.ts`, Python wrapper defaults).
- Providers treat randomness knobs differently (OpenAI GPT-5 ignores temperature, Gemini defaults to top-p 0.95, Anthropic caps temp at 1, Grok allows the full 0-2 span), so we need a single doc that explains how we normalize those realities.
- Having a written explanation avoids future regressions when someone tries to “fix” the default without understanding how Poetiq’s multi-expert voting layer relies on diversity.

## Key Touchpoints to Review
- `client/src/pages/PoetiqSolver.tsx` – UI default + user override path
- `server/controllers/poetiqController.ts` + `server/services/poetiq/poetiqService.ts` – backend defaults and request payload
- `server/python/poetiq_wrapper.py` + `poetiq-solver/arc_agi/llm.py` – how options become expert configs, how LiteLLM adapts requests per provider
- `server/config/models.ts` + `server/services/openai/payloadBuilder.ts` – canonical capability flags (`supportsTemperature`) and provider-specific payload trimming

## Tasks
1. **Confirm temperature flow**  
   Trace the value from the UI, through the controller/service, down to the Python bridge so we can cite exact files/lines that make Poetiq agnostic.
2. **Capture provider constraints**  
   Summarize what the model registry says about temperature support (OpenAI GPT-5 false, Grok true, etc.) and note ancillary defaults like top-p handling in `openai/payloadBuilder`.
3. **Explain the 1.0 default**  
   Describe how Poetiq’s multi-expert search benefits from higher randomness while still being bounded by per-provider validation (training set gating + LiteLLM safeguards).
4. **Author consolidated doc**  
   Create a new `docs/` write-up that answers the “isn’t 1.0 too high?” question in plain language and references the relevant components.
5. **Update changelog**  
   Record the doc + plan so auditors can see why we touched documentation only.

## Deliverables
- New explanatory doc living under `docs/`.
- This plan file (for provenance) plus an updated `CHANGELOG.md` entry describing the documentation work.
