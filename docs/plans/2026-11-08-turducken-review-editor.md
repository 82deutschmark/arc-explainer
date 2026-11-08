<!--
Author: Claude Opus 5.5 Medium
Date: 08-November-2026
PURPOSE: Plan and record for the Turducken review editor: Google-Docs-style shared comments on the
write-up so Son can mark up the article and hand the notes to an agent.
-->

# Turducken review editor

## Goal
Son (and the Boss, and anyone else reviewing) highlights text on the Turducken write-up, attaches a
comment, and everyone sees the same comments. Open comments export as plain text to paste to an
agent that applies the edits. The article's wording and its live page do not change.

## Scope
- New unlisted, noindex page `/specials/2026-11-06-arc3-solution-draft-review.html`. It fetches the
  live article page and shows its `<main>` with the article's own styles, so it always reviews the
  current text.
- Select text, press Comment, type a note. Reply, resolve, reopen, delete. Author name kept in the
  browser. Open / Resolved / All tabs. Click a highlight to open its comment and back.
- Shared, durable storage: `/api/review-comments/<doc>` on this server, an append-only JSON-lines
  log on the Railway volume (`/app/data/review-comments/`). Not the specials overlay, which is wiped
  on every deploy. Production volume confirmed present on 8-Nov before building (the overlay API
  answered normally instead of "overlay disabled").
- Re-anchoring: each comment keeps the quote, 64 characters of context each side, its position and
  the nearest heading. Lookup order: exact (context breaks ties), whitespace-insensitive, text
  between the old context (quote reworded, flagged on the card), else listed under "Not found in
  the current text". Never dropped.
- Export open comments as text (section, quote, comment, replies; unfound ones listed separately).
  Backup and Restore as JSON. If the API is unreachable the page says so and saves in the browser.

## Decisions
- No sign-in: an unlisted link, like a shared Google Doc. Writes are rate limited and capped, only
  listed documents accept comments, and a delete only hides a comment (the log keeps it).
- Append-only log, not a rewritten JSON file, so simultaneous comments cannot overwrite each other.
- No database migration: a volume file is the smaller durable change.

## TODO
- [x] Storage service, route, mount, unit tests
- [x] Review page, script, styles; browser test (two reviewers, overlap, reply, resolve, delete,
      reload, edited article, removed quote, phone layout, offline fallback, restore)
- [x] CHANGELOG, API note
- [ ] One push to main (server change, so it builds); verify review page, article and versions page live
