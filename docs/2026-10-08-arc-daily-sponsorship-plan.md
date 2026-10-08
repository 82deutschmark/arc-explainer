# ARC Daily sponsorship treatment

## Scope

- Keep the news and leaderboard reporting independent and unchanged.
- Disclose VoynichLabs sponsorship in the newspaper masthead and footer.
- Add clearly marked house advertisements to the front page and article rail.
- Link only to live VoynichLabs pages: the site and its published music-video catalogue.

## Files

- `client/src/components/news/NewsDesk.tsx`: shared newspaper disclosure.
- `client/src/components/news/SponsorPlacement.tsx`: reusable display ad.
- `client/src/pages/News.tsx`: front-page ad placement.
- `client/src/pages/NewsArticle.tsx`: article-rail ad placement.
- `client/src/components/news/news.css`: responsive display treatment.
- `CHANGELOG.md`: record the behavior and verification.

## Verification

- Confirmed the destination pages and copy against the live VoynichLabs homepage and music-video catalogue on 8 October.
- Vite production client build passed; 18 focused news and SEO integration tests passed.
- Reviewed static layout renders at desktop and phone widths and a narrow article rail. The rail check caught and fixed an oversized mobile button layout.
- Repository-wide TypeScript checking still reports existing diagnostics in unrelated server and test files; none refer to the changed news files.
