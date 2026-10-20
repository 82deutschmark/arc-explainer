# Team Turducken picture correction

Author: GPT-6 / Codex · 20 October 2026

The Boss requests the ARC-3 team picture that includes everybody. Today's Early edition
uses the earlier three-character First Flight. Replace that illustration with the approved
seven-character Whole Crew Takes Flight base, inspected against the commissioned cast in
`docs/newsroom/CHARACTERS.md`.

- Reuse the existing native image and deterministic compositor; generate no new artwork.
- Reconstruct an explicitly identified artwork-revision brief from the archived Early brief.
  Keep the article's reporting, closing scores, sources and publication time intact.
- Archive the original article and artwork in a separate revision record. Correct the image
  caption, alternative text and the one sentence describing the illustration.
- Record the replacement in the artwork inventory and make full-crew selection explicit in
  the art-desk guidance. Keep the original images, evidence and X send-once history.
- Visually inspect all seven characters, both Yorkies and the original-time score panel;
  validate the attachment and run the required newsroom content checks before publishing.

The Boss clarified that both the Digest and website team pictures must include everybody.
Replace the old trio on `/about` and `/news/staff` with the clean full-crew flight image.
Keep their image, alternative text and caption in `shared/arc3TeamArtwork.ts` so both
placements stay together. The ARC3 game catalog at `arc3.sonpham.net` has no team-picture
placement; its game UI needs no change.

Scope: the October 20 ARC-3 Early edition, both website team-picture placements and future
team-picture selection. No social post.

Completed verification: all seven approved avatars and both Yorkies remain visible in the
final composition; original score rows and observation time match exactly. The article and
attachment validators pass. The required newsroom suites pass (27 JavaScript checks and
62 Python checks), both updated pages bundle successfully, and `git diff --check` is clean.
