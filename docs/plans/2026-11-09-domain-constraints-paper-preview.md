# Nonpersonal ARC paper preview

Author: GPT-6.1 Sol
Date: 09-November-2026

## Scope and authorization
The Boss requested a paper-track rewrite rather than a personal essay. Parent is reviewing the new prose before publication. Publish it as a distinct unlisted preview, leaving every earlier version intact. Preserve the six-game strip and its captions from v11, whose placement Son liked, and the existing simple serif reading layout.

## Steps
- [x] Check current repository, worktree and PR state: v8 PR482 has merged; current main also contains the distinct personal “Out of My Depth” v12.
- [x] Create an adjacent isolated branch/worktree from freshly fetched origin/main, not stacked on the old v8 branch.
- [x] Receive parent-approved prose and preserve it as the source.
- [x] Render a separate domain-constraints preview with the existing v11 game-image assets/captions, no memoir byline or editorial notes.
- [x] Validate prose fidelity, image paths, metadata and whitespace checks.
- [ ] Commit and push source, create a review PR, then fast-publish exact specials files and verify live bytes.

## Publication route
Use `tools/specials-publish/publish_specials.py`, documented in `docs/reference/api/specials-fast-publish.md`. Existing secure credential lookup only. No service/config changes, new dependencies or merge. The overlay is deployment-scoped; the PR is needed for next-deployment retention. Keep unmerged worktree for review and report its path.

## Verified publication
Published the distinct unnumbered preview and prose source through the established API. Its single verification fetch matched the complete HTML and source bytes, including title, Chollet reference, and closing. Each of the six original v11 image URLs returned a PNG matching the local source bytes. Commit/push and review PR preserve the next-deployment source; merge is not part of this task.
