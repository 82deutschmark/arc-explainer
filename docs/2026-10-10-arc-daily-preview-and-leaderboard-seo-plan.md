# ARC Daily Digest link preview, and search for "ARC leaderboards"

Author: Claude Sonnet 5.5
Date: 10-October-2026
Requested by: the Boss. The preview showed October 8 news; it should use ARC-puzzle-looking art, show up-to-date items or else say what the paper is; and the site should show up when anyone searches for ARC leaderboards.

## What was wrong (checked against production on 10-Oct-2026)

- The live card at `/api/news/og-image.png` already showed the October 10 headlines, and the crawler text on `/news` was current. The server was not the problem.
- The card was advertised at one fixed address on every ARC Daily page. Link-preview services (Discord, X, Facebook, LinkedIn) cache a preview picture by address and ignore a 30-minute max-age, so whatever they fetched when the feature shipped on 8 October is what they kept showing. The 8-Oct plan left a manual re-scrape to a human, which could not have lasted anyway because the address never changed.
- The card was cream and ink only, with no ARC imagery.
- The generic "ARC leaderboards" query had no page of its own: the best-matching address, `/leaderboards`, is the retired model-rankings page (410, noindex), and the two Kaggle board pages carried no standings in their crawler text and no change dates in the sitemap.

## Changes

1. **Versioned card address.** `sectionCardPath()` in `shared/news.ts`: a short hash of the design number, the Eastern day and the fresh editions shown. Server HTML (`newsPresentation.ts`, every page that shares the card) and the browser (`useNewsCardImage`) advertise it. The route ignores the query and renders the current card; cache is one hour.
2. **Freshness rule.** `sectionCardArticles()`: a contest's newest edition counts only if under 36 hours old. None fresh gives the "what this is" panel at full width; one fresh gives that edition plus the panel in short form.
3. **ARC puzzle of the day.** `newsCardPuzzle.ts` picks one ARC-AGI-1 training puzzle per Eastern day (longest side at most ten; first training pair; input and output must differ). Drawn by satori as coloured cells in `ARC_COLORS_TUPLES` on grey grid lines, with a pixel arrow. Missing puzzle: figure omitted, never faked.
4. **ARC leaderboards hub** `/arc-leaderboards` (new route, React page plus crawler copy in `shared/routes.ts`). `/leaderboards` stays a 410 (the old model rankings are still retired) and now links to the hub.
5. **Titles.** Hub, ARC-AGI-3 and ARC-AGI-2 board titles lead with the leaderboard name and stay inside 65 characters; home title and description name the leaderboards.
6. **Live text for crawlers.** `leaderboardSeo.ts` adds the top ten of each saved board, dated by the snapshot, to the hub and board pages and stamps `dateModified`; the sitemap dates those pages by their latest snapshot. Two-and-a-half-second ceiling, then the static copy.
7. **Leaderboard share art.** The hub and the ARC-AGI-2 board use the existing puzzle card (a colourful ARC-AGI-2 puzzle, 1190bc91); the ARC-AGI-3 board uses an official game frame (r11l), instead of the generic blue site card.
8. **Internal links.** Discovery nav (every page's crawler HTML), home page, front-page crawler text, menu, landing page card, `llms.txt`; breadcrumbs Home, ARC leaderboards, board.

## TODO

- [x] Confirm the live card and crawler text are current; identify the fixed address as the cause
- [x] Versioned address, freshness rule, puzzle figure, evergreen panel; rendered fresh, one-fresh, stale and no-puzzle variants and looked at them
- [x] Hub page, titles, crawler standings, sitemap dates, links
- [x] Tests: address changes with day, edition and staleness; every card-sharing page advertises the current address and it serves a drawn card; puzzle rotation; ARC-palette pixels; hub; standings escaping and failure fallbacks
- [x] CHANGELOG, commit, push

## Left for a human

- Services that already cached the old picture keep it until they re-read the page. The new address makes that happen on their next visit; to speed it up, run the front page and one article through the Facebook Sharing Debugger and the LinkedIn Post Inspector (X and Discord refresh on their own schedule).
- In Google Search Console, resubmit the sitemap and use "Request indexing" on `/arc-leaderboards`.
- Ranking for a broad query is earned, not set. The official `arcprize.org/leaderboard` page and Kaggle will very likely outrank us on "ARC leaderboard"; the realistic win is the narrower "ARC-AGI-3 leaderboard", "ARC Prize 2026 leaderboard" and "Kaggle ARC leaderboard" queries, where live, dated, current standings are what we have that they do not.
