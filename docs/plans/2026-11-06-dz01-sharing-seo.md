# DZ01 gallery and article sharing metadata

Author: GPT-6.1 Sol / Codex · 6 November 2026

## Scope
The boss requested better search/social metadata and an actual DZ01 game preview after the gallery-link correction. Fix both the gallery's inconsistent server/client image selection and the linked Turducken draft's absent sharing tags. Preserve article artwork and its deliberate draft noindex policy.

## Implementation and verification
- Use the committed, manifest-verified DZ01 opening thumbnail (`dz01-6ab85ff0e7d2.png`), scaled nearest-neighbour onto the existing game-card dimensions and background (1200×630, 540px board).
- Pin gallery title, description, image and image alt/dimensions in the shared route registry. Stop the server overwriting those with the first catalog entry.
- Add article description, canonical URL, Open Graph, Twitter and Article structured metadata without changing visible prose, charts or indexing status.
- Verify actual rendered server metadata, shared client metadata, image dimensions and visual quality; run focused existing SEO checks; commit and push only these changes.

## Acceptance
Gallery shares show DZ01 instead of AB02 or the former g012 fallback. The draft shares with its own article title/description and explicit DZ01 preview. All original article illustrations remain in place.

## Results
- Visually inspected the authentic DZ01 thumbnail and the final wide card; pixels remain crisp and the full board/HUD is retained.
- Focused checks passed: actual HTTP gallery HTML emits the DZ01 Open Graph/Twitter URL, canonical URL, dimensions and index policy; shared client/server metadata agree; Article JSON-LD parses; draft noindex stays unchanged.
- Existing SEO integration suite: eleven passed; three unrelated failures: unregistered `/news/tips`, `/news/competitors` resolving to `/news/cards`, and the full sitemap timeout. These newsroom surfaces were not changed here.
- Article prose, charts, body illustrations and Markdown/package contents are unchanged; the new image is sharing-only.
