# MIT license, clean front page, archived early pages

Author: Claude Opus 5.5
Date: 2026-10-09

## Goal

Mark offered ARC Prize anything from ARC Explainer and asked for an MIT license, with the repository clean enough that nobody arriving from arcprize.org or the feedback page sees half-finished or misleading material. The early (August–September 2025) experiments around confidence scores, trustworthiness, explanation feedback, debates and Elo voting should be archived, not highlighted. The point of the exercise is ARC Prize hosting more useful things, not traffic to this site.

## License (done first)

- `package.json` has declared MIT since the first commit (July 1, 2025); the root `LICENSE` makes it real: MIT, "Mark Barney and contributors" (David Lu, Son Pham and others contributed code).
- `THIRD_PARTY_NOTICES.md` scopes the grant to our own code and writing. Verified upstream licenses with the GitHub API: ARC-AGI-1 and ARC-AGI-2 data (Apache 2.0), ConceptARC (MIT), ARC-Heavy/BARC (MIT per neoneye's collection, no upstream file), Poetiq solver (MIT). Zoe Carver's Saturn and Grover solvers publish no license; the matching files (compared with upstream file lists) are listed as not covered. ARC-3 community games come from Son Pham's autoresearch-arena pipeline or other players and keep their authors' terms. Submodules keep their own.
- Verbatim upstream texts in `licenses/`.
- README rewritten as a short, current front page: fixed broken API links, the dev port, a nonexistent script, wrong dataset sizes in the data tree, puzzle-format counts (checked against the data), and dropped an unverified human-performance figure and the confidence-calibration research pitch. The long route/API listing moved verbatim to `docs/reference/architecture/ROUTES_AND_API.md`.
- Feedback page, coding-agent sheet and structured asks now say the code is MIT-licensed; ask 2 cites only the single saved-attempt example.
- Removed two stray tracked files (a UTF-16 solver log and a temp task dump).
- Secret scan of tracked files and full history (key-shaped strings outside `data/`): nothing found.

## Archive (second commit)

Archived = removed from the top navigation, the `/home` resource hub and the sitemap, marked noindex; every route still serves by direct link. `/analytics` keeps its exact URL because ARC Prize links to it.

## Analytics

Remove the collapsed "Most Difficult Puzzles" card at the bottom of `/analytics`: its ranking mixes uneven model coverage into a misleading "hardest" list and duplicates the unsolved-puzzle view on the puzzle DB page. No restyle in this change.

## Feedback page as bullets

Mark asked for clear bullet points with no disjointed prose. The page, agent sheet and structured asks now share one bullet structure. All page and sheet links were checked live (HTTP 200).
