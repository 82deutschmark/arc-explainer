<!--
Author: Claude Opus 5.5 Low
Date: 07-November-2026
PURPOSE: How to push an edit to a /specials/ page (the Turducken write-up first) live in seconds
through the API instead of a full Railway build, and what the pushed copy's lifetime is.
-->

# Fast publishing for special pages

A special page such as `/specials/2026-11-06-arc3-solution-draft.html` used to change only through
a full Railway build (several minutes). Edits can now go live in seconds through an authenticated
API. Git stays the record: commit and push the same edit as usual.

## Push an edit

From the arc-explainer checkout, after editing files under `client/public/specials/`:

```
python3 tools/specials-publish/publish_specials.py --changed \
  --expect "We would also like to thank"
```

- `--changed` pushes every specials file that differs from HEAD (edited or new). Name files
  directly instead, or use `--since <git ref>` to push everything changed since a commit.
- After each push the script fetches the live URL once and checks the bytes match. `--expect`
  also checks a pushed page contains the given text. A non-zero exit means something did not land.
- `--dry-run` lists what would be pushed. `--base-url` targets another host (staging).
- Token: `ARC3_COMMUNITY_ADMIN_TOKEN` from the environment, else the macOS keychain item
  `arc3-community-admin-token`. It is the same secret already set as a Railway variable for the
  Kaggle push. It is never printed; never paste it into chat, logs or commits.

## How it works

- `PUT /api/specials/file?path=<path under /specials/>` with the raw file as
  `application/octet-stream` and the `X-ARC3-Admin-Token` header writes the file onto the Railway
  volume. `DELETE` with the same query removes it so the baked copy shows again.
- Allowed: `.html .md .png .svg .csv .json .webp .jpg .jpeg .txt`, up to 15 MB, nested folders
  allowed, no `..`, no leading slash, no backslash, no dotfiles, no percent signs after decoding.
- A layer mounted at `/specials` just before the static file handler serves a pushed file with
  `Cache-Control: no-cache` (header `X-Specials-Source: overlay`); anything not pushed falls
  through to the files baked into the build.
- Code: `server/services/specialsOverlay.ts` (path rules, storage), `server/routes/specialsPublish.ts`
  (API), `server/middleware/specialsOverlay.ts` (serving). Tests: `tests/unit/specialsOverlay.test.ts`.

## Lifetime: until the next deploy

Pushed files are stored per Railway deployment (`/app/data/specials-overlay/<deployment id>/`).
A restart keeps them. A new deploy starts with an empty overlay and deletes old ones, so the
build's git copy wins again. This stops a stale pushed copy from hiding later git edits forever.
Consequence: an edit pushed through the API but never committed is undone by the next deploy.
Always commit and push the edit too.

The serving layer runs only in production. Locally, the script works against any server started
with `SPECIALS_OVERLAY_ROOT` set, but the real check is the live host.
