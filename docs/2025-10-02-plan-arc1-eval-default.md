* Author: AI Agent using GPT-5-Codex
* Date: 2025-10-02T00:32:07-04:00
* PURPOSE: Document plan to ensure AnalyticsOverview defaults to ARC1 evaluation dataset while preserving SRP-compliant dataset selection logic and existing hook integrations.
* SRP/DRY check: Pass - Single-purpose planning note referencing existing dataset selection utilities.
* shadcn/ui: Pass - No custom UI proposed; plan reuses shadcn/ui components already in place.

## Goal
Ensure AnalyticsOverview loads ARC1 evaluation statistics by default without disrupting dataset selector UX.

## To-Do
- [ ] Inspect dataset directory names exposed by available datasets endpoint.
- [ ] Update default dataset selection logic to target the ARC1 evaluation directory (evaluation).
- [ ] Align dataset selector labels with human-readable ARC naming while retaining underlying identifiers.
