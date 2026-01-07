Plan: Landing page rotating ARC GIF hero
Date: 2026-01-06
Author: Codex (GPT-5)

Scope
- Remove the visitor counter hero from the landing page.
- Replace it with a rotating selection of the existing ARC GIFs.
- Keep routing and the GIF list source as-is.

Objectives
- Show a single landing hero that cycles through the existing ARC GIFs.
- Preserve accessibility (alt text) and keep the UI lightweight.
- Avoid new dependencies or data sources.

Todo
- Update `client/src/pages/LandingPage.tsx` to remove the counter hero and render the rotating GIF hero.
- Keep the existing GIF list as the source for the rotation.
- Update the file header metadata and text copy to remove stray non-ASCII characters.
- Update the top entry in `CHANGELOG.md` with the behavior change and author.

Status
- Complete (2026-01-07)
