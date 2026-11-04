<!--
Author: GPT-6 / Codex (reasoning effort not exposed)
Date: 03-November-2026
PURPOSE: Record the card-first cleanup and its compatibility and verification requirements.
SRP/DRY check: Pass — the existing wiki projection and collection remain the sources.
-->

# Card-first cast cleanup

The Card Cabinet becomes the single public entrance for the Goose's cast. People and teams without cards remain findable, and existing individual and card addresses continue to work.

1. Remove duplicate directory links and the front-page team dossier column. Redirect the old directory addresses to the cabinet, including in-app navigation and search indexing.
2. Keep the existing card filters, sets, editions and art. Make uncarded people and teams searchable from the cabinet using the existing news index, and include source-linked context on card pages.
3. Connect legacy individual profiles to their existing cards. Preserve distinct competition entries, dates, source links, historical awards and all issued card addresses. Never infer identity from a name or replace the wiki source with another ledger.
4. Check client and server navigation, source and card relationships, uncarded results, old addresses, and the production build. Update the changelog and commit the finished change.

## Source audit

The host's archived people all have matching wiki IDs, and no verified account was found under two different person IDs across the two inputs. The wiki projection already replaces matching archive records when the host builds its index. Six older team records exist only in the archive, so the cleanup keeps them available instead of deleting or guessing at a match. Competition and team IDs remain distinct; issued cards remain separate editions.
