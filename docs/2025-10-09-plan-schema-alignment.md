 * 
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T16:53:46-04:00
 * PURPOSE: Detail the roadmap for aligning arcJsonSchema.ts with the minimal HuggingFace dataset format while capturing dependencies, risks, and validation steps.
 * SRP/DRY check: Pass - Scoped to schema alignment plan; confirmed no existing plan covers this target.
 * shadcn/ui: Pass - Documentation only, no UI work.

# Goal
Create a streamlined JSON schema for solver outputs that mirrors the HuggingFace ingestion structure (single `predictedOutput` or enumerated multi-test grids) to reduce duplication and invalid responses.

# Context
- Current `ARC_JSON_SCHEMA` mandates narrative fields and multiple numbered predictions regardless of puzzle shape.
- HuggingFace imports rely on minimal structures and already pass validation with only prediction grids.
- Providers (OpenAI, Anthropic) re-enforce the bloated schema, causing excessive instructions and error surfaces.

# Tasks
- Audit touch points that depend on `ARC_JSON_SCHEMA` (provider services, validator, analyzers).
- Redesign schema to require only prediction grids with optional metadata.
- Update dependent providers/validators to rely on the shared schema instead of bespoke requirements.
- Ensure multi-test behavior mirrors HuggingFace (`predictedOutput1..n` + `multiplePredictedOutputs` boolean).
- Smoke test by running targeted validation on single and multi-test samples.

# Risks & Mitigations
- **Provider drift**: Some services override schema (e.g., Anthropic tool). Mitigation: Update them in lockstep or ensure compatibility with relaxed schema.
- **Validator expectations**: `responseValidator` pads to three grids; must handle dynamic array lengths. Mitigation: adjust after schema changes.
- **Historical data**: Existing DB rows include narrative fields; ensure backend remains backward compatible.

