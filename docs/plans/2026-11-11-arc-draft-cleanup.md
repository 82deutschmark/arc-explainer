# ARC draft cleanup

Author: GPT-6.1 Sol
Date: 11-November-2026

## Scope and authority

The Boss asked to clean up the various drafts on ARC Explainer, following his direction to write more simply about intelligence, acquiring capacity, slop and creativity, with less autobiography. This is reversible organization, not a new approved essay, factual revalidation, publication, or permission to delete old writing. The request authorizes the cleanup; no new editorial choice is needed to preserve and label drafts.

## Architecture

- One unlisted static draft desk at `client/public/specials/arc-drafts.html` is the starting point.
- Group the paper/essay versions, technical article variants and editorial tools separately.
- Give saved drafts a small navigation/status banner back to the desk. Preserve all original prose, assets, scripts, source files and old addresses. Evidence pages remain evidence, not superseded drafts.
- Preserve older generated HTML as archival snapshots; do not regenerate them during cleanup.
- Reuse existing static-special hosting and plain serif styling. No application routes or new dependencies.
- Record the source map and future editing convention in `docs/arc-drafts.md`.

## TODOs

1. Inventory the related pages, their editable sources, and the existing handoff records.
2. Add the desk and source map; distinguish latest saved version from approved/current writing.
3. Label historical draft pages without moving or removing their content.
4. Verify every desk link, banner presence, original-page preservation, and responsive rendering.
5. Update the changelog; commit on an isolated branch and open a draft pull request for review.

## Verification and delivery

Static HTML has no compilation impact. Check internal links against actual public files, compare each old page after removing only the added banner to its original bytes, inspect the desk at desktop and narrow widths, and run `git diff --check`. No Kaggle calls, new research claims, production publish, merge or unrelated newsroom cleanup.

## Verification results

- All twenty-five modified historical pages restore byte-for-byte to the original when only the marked notice is removed.
- Every desk link resolves to an existing public file; every labeled historical page appears in the desk.
- The desk is noindex/nofollow and is described as unlisted, not access-controlled.
- Chrome inspection confirmed the desktop reading layout, a narrow phone-width layout, the expandable essay archive, and the latest saved essay’s notice/link back to the desk. The old essay’s game images still loaded.
- `git diff --check` passed. No application build or broad tests were needed for static HTML/navigation-only changes.
- The temporary local static server was stopped and the browser viewport override reset; the test tab was closed.
