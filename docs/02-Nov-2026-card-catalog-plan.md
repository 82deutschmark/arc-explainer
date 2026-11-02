<!--
Author: GPT-6 / Codex (reasoning effort not exposed)
Date: 02-November-2026
PURPOSE: Improve the catalog across Kaggle contests, clarify subject types and bound page loading without redesigning approved cards.
SRP/DRY check: Pass — reuse collection identities, competition directory, existing images and filters.
-->

# Extend the catalog beyond ARC

The prior turn made authoritative progress: Daniel’s repaired original-design pair was committed and pushed. The wider goal remains active.

This pass owns `NewsCards.tsx`, a small shared catalog helper, focused tests and a separate catalog stylesheet. Preserve concurrent newspaper/story changes and stage only owned changelog lines. Keep original card artwork and frames; no generation or wider art changes.

Fix the hard-coded contest/year wording. Derive competition choices from dated memberships as well as available standings, keeping person/team identities separate. Label individuals and teams explicitly, filter by actual card season, and compare ranks only within a selected competition. Bound the binder to 24 cards per page and give readers clear navigation and result counts. Keep existing card links and all archive entries accessible.

Verify helpers with future-season and non-ARC fixtures, render real collection pages, check a phone layout and filtered navigation locally, then build, commit and push. This pass does not prove the full goal complete: the issuance/projection path and account-versus-person classification still need an audit.

The Boss clarified the set model during this pass: continuing competitors are like planeswalkers across sets; each competition has its own edition. Preserve original baseball-card styling, actual Kaggle medals and tier names, and dense veteran statistics backs. Competition sets are now exposed from the existing validated series registry and selectable independently of season. Explicit set membership remains filterable without a leaderboard reading; legacy combined sets do not imply participation in every included contest.

Validation: 12 focused catalog/page tests pass, including future-season/non-ARC and same-person/different-set cases. Type checking passes with the existing local configuration excluding the unrelated story-route test dependency. Local browser checks confirm 24 cards per page, page-two results 25–48, 20 clearly labelled team cards after filtering, and no horizontal overflow at 390px. Existing artwork/frame rendering is untouched. The full objective remains active for further source/issuance and identity audits.
