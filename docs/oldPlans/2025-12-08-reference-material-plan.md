# 2025-12-08 Reference Material Highlight Plan

**Goal:** Ensure the Research Terminal makes The ARChitects ARC Prize 2025 Solution Summary paper prominent, with all required keywords and the provided LambdaLabs link.

## Files & Todos
- client/src/components/browser/ReferenceMaterial.tsx
  - Review the current sections to find the best spot near line 79 to surface a new Reference entry.
  - Add a dedicated link entry for the LambdaLabs-hosted ARC Prize 2025 Solution Summary paper and include the names Daniel Franzen 1*, Jan Disselhoff 1*, David Hartmann 2* plus the The ARChitects mention.
  - Consider an explanatory paragraph or footer element reiterating the Kaggle team honorific and linking to https://lambdalabsml.github.io/ARC2025_Solution_by_the_ARChitects/.
- docs/2025-12-08-reference-material-plan.md
  - Document this plan with the target files and required keywords so reviewers can see the intent before code updates.
- CHANGELOG.md
  - Add a new semantic version entry at the top describing the ReferenceMaterial update and noting both the component and changelog edits (author: Codex).
  - Reference the plan document as part of the revision log per repo conventions.
