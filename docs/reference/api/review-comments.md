<!--
Author: Claude Opus 5.5 Medium
Date: 08-November-2026
PURPOSE: Reference for the shared review-comments API behind the special-page review editor.
-->

# Review comments for special pages

Review page: `/specials/2026-11-06-arc3-solution-draft-review.html` (unlisted, noindex). Select
text in the article, press **Comment**. Everyone with the link sees the same comments.

## API (`/api/review-comments`, no sign-in, rate limited)

| Method | Path | Body |
| --- | --- | --- |
| GET | `/:doc` | — returns `{ document, threads }` |
| POST | `/:doc/threads` | `{ author, body, anchor: { exact, prefix, suffix, start, heading } }` |
| POST | `/:doc/threads/:id/replies` | `{ author, body }` |
| PATCH | `/:doc/threads/:id` | `{ author, status: "open" \| "resolved" }` |
| DELETE | `/:doc/threads/:id` | `{ author }` (hides; the log keeps the text) |
| DELETE | `/:doc/threads/:id/replies/:replyId` | `{ author }` |
| POST | `/:doc/import` | `{ threads }` from a page Backup; ids already stored are skipped |

`:doc` must be listed in `REVIEW_DOCUMENTS` in `server/services/reviewComments.ts`
(today: `turducken-2026-11-06`). To review another special page, add an entry there and copy the
review page with its `data-review-doc` and `data-review-article` changed.

## Storage

One append-only JSON-lines file per document at `$RAILWAY_VOLUME_MOUNT_PATH/review-comments/<doc>.jsonl`
(`/app/data/review-comments/` in production), or `$REVIEW_COMMENTS_ROOT` when set. It survives
deploys and restarts; it is separate from the per-deploy specials overlay. Every action is one line,
so the file is also the full history. A delete is a tombstone line; to undo one, remove that line.
With no volume configured the API answers 503 and the page falls back to the browser.
