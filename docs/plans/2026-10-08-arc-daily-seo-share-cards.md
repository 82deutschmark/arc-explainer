# ARC Daily: search metadata and per-article share cards

Author: Claude Opus 5.5 (Bubba)
Date: 08-October-2026
Requested by: the Boss, via Bubba's Discord session. Applies the MarkSite / farm-2026 SEO checklist to `/news`.

## What the live site served on 08-Oct-2026 (before)

Checked with curl against https://arc.markbarney.net:

- Every news page (front page, all four articles, notebook, competitor pages) used the site-wide
  `og-preview.png`: a blue "ARC-AGI Explainer" card that says nothing about the newspaper or the
  story. Its alt text was "ARC Explainer — puzzles, games and results".
- The NewsArticle JSON-LD image was the same generic card; no publisher logo; the citation list
  repeated URLs.
- Article titles ran past the display budget once " | The ARC Daily" was appended (71–79 chars).
- `/news` structured data was a plain WebPage, and its breadcrumb repeated the full title.
- The crawler body printed raw codes and timestamps ("2026-10-08 · arc-2 · morning",
  "2026-10-08T10:00:14Z").
- The sitemap had no `lastmod` anywhere, although news articles and notebooks have real dates.
- The RSS feed had no self link and no build date.
- Browser and server disagreed on competitor-page titles and descriptions. On in-app navigation the
  article page wrote the default image back into og:image and the JSON-LD.
- Good already: canonical, robots meta, RSS autodiscovery link, real 404s, breadcrumbs, one H1,
  server-rendered article text, robots.txt allows everything news.

## Scope

1. **Share cards.** A 1200x630 newspaper-style PNG per article (masthead, competition and
   edition, headline, top three from the article's own box score) and one section card for the
   front page and the notebook. Rendered on the server with satori (text becomes vector paths) and
   the existing sharp, using committed OFL IBM Plex fonts, so the Alpine container needs no system
   fonts. Derived only from existing article fields; no schema change, no newsroom change.
   Article card URLs carry a content version, so they can be cached as immutable.
2. **Metadata.** One shared helper for title, description and image alt text, used by server
   HTML and the React pages. Title keeps the " | The ARC Daily" suffix only when it fits in 65
   characters (committed headlines are not edited). og:image dimensions, article published time
   and section.
3. **Structured data.** NewsArticle gets an ImageObject card, publisher logo, de-duplicated
   citations. `/news` becomes a CollectionPage with an ItemList of editions. Breadcrumb names use
   the short page name.
4. **Sitemap `lastmod`** for news URLs only, from real data (article published time, competitor
   last-checked time). Other routes stay without dates, as before.
5. **RSS:** atom self link, last build date, categories and a media image per item.
6. **Readable crawler body:** competition names, edition names and Eastern dates.

Not changed: committed headlines and deks; HTML cache policy (pages stay `no-cache` with ETag
revalidation because they reference hashed assets that change on deploy); robots.txt.

## TODO

- [x] Survey live HTML, image, sitemap, robots, RSS
- [x] Shared helpers in `shared/news.ts`; card service and routes; wire server and client
- [x] Sitemap lastmod, RSS, CollectionPage
- [x] Tests updated; build; typecheck diff against baseline (identical to main)
- [x] Render real production HTML locally, parse JSON-LD, check card pixels and size
- [x] CHANGELOG, PR (not merged)

## Notes from the build

- The fonts under `.claude/skills/canvas-design/canvas-fonts/` are corrupted in git (their bytes
  were re-encoded as text), so the card fonts were taken fresh from the google/fonts repository
  with their OFL licence files.
- satori breaks lines after hyphens and IBM Plex has no non-breaking hyphen, so headlines are set
  word by word; lines only break at spaces ("ARC-AGI-3" stays whole).
- Team names outside Latin script (emoji, Japanese) are dropped from the card only; a name with
  nothing left prints as its Kaggle team number. Articles are untouched.

## Left for a human

- Submit the sitemap in Google Search Console and watch coverage for /news.
- After deploy, re-scrape one article in the Facebook/LinkedIn/X card validators; they cache the
  old generic image.
