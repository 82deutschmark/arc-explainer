<!--
Author: GPT-6.1 Terra / Codex (reasoning effort not exposed)
Date: 03-November-2026
PURPOSE: Fix the three visible newspaper problems found on the live Goose front page and verify the deployed result.
SRP/DRY check: Pass — retain the existing story, market and layout components and their shared styles.
-->

# Fix the Goose front page

The Boss wants three visible problems corrected: unreadable floating-point tails, an unclear post-deadline clock, the lead story pushed too far down on phones, and the missing closing report. Existing stories keep their public addresses; the missing report receives one permanent address.

## Ownership

- `team_highlighting` owns `NewsMarkets.tsx` and the formatting regression; it integrates the closed-label change.
- `style_guide` owns the separate closed-state regression and coordinates its component change with the shared-file owner.
- `live_site` owns the mobile front-page layout and its focused checks.
- `made_audit` owns the closing article, its evidence and reusable article-table/image support, coordinating the lead renderer with `live_site`.
- Root owns this plan, the changelog, integration, production release and live verification.

## Finish

1. Format observed scores and changes without binary arithmetic tails or invented precision; keep scores, score differences and places semantically distinct.
2. Show that submissions are closed when the actual UTC deadline has passed, even if a board snapshot is stale. Keep unknown and upcoming deadlines distinct and avoid implying private results are final.
3. Put the lead headline and report earlier on phones without changing their reading order or the desktop newspaper layout.
4. Prepare the full closing feature from the saved draft, with both dated public tables, selected art, current verified name changes, and an honest explanation of private-result uncertainty. Validate the same reading order at the front page, permanent story and plain server page.
5. Run targeted meaningful tests and the production build; reconcile unrelated active changes. Commit only the owned files and push the existing branch to the host's main deployment.
6. Verify the actual public page and both existing article links, including images, at desktop and phone sizes. A local test or a successful deployment is not proof that the live page works.
