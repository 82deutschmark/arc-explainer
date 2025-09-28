<!--
 *
 * Author: AI Agent using GPT-5-Codex
 * Date: 2025-09-28T00:00:00Z
 * PURPOSE: Detailed action plan to remove Command R model entries and confirm configuration integrity.
 * SRP/DRY check: Pass - planning document unique within docs directory.
 * shadcn/ui: Pass - no UI implementation in this plan document.
-->

# Goal
Remove deprecated Command R models from server configuration while keeping model ecosystem consistent.

# Context
- Command R models deprecated per user direction.
- Configuration sourced from `server/config/models.ts` consumed by lookup utilities.
- No direct references found beyond config list.

# Constraints
- Maintain SRP/DRY alignment within configuration modules.
- Preserve comment header requirements for touched files.
- Ensure removal does not impact lookup utilities or categories.

# TODO
- [ ] Update `server/config/models.ts` header to conform with repository metadata format.
- [ ] Remove any Command R configuration objects.
- [ ] Verify `ModelDefinitions` import/export integrity after removal.
- [ ] Prepare for git commit with clear message once validated.

# Approach
1. Revise file headers to required format while capturing purpose and checks.
2. Delete Command R model entries and ensure array syntax remains valid.
3. Confirm there are no downstream references requiring adjustments.
4. Run sanity checks if necessary; stage changes for review and commit.