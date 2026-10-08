# ARC Explainer SEO glowup

Author: GPT-6.1 Sol / Codex
Date: 2026-10-07

Requested: apply the earlier MarkSite and farm SEO work to ARC Explainer; commit and push, with deployment handled automatically.

## Evidence and scope

Precedents: `MarkSite/docs/SEO-CHECKLIST.md`, `MarkSite/docs/SEO-AUDIT-03-Oct-2026.md`, and `farm-2026/docs/SEO-AUDIT-03-Oct-2026.md` in the local GitHub checkouts. Their useful common requirement is to inspect downloaded HTML, not merely React's DOM.

ARC Explainer already has an Express metadata injector and a shared game registry. Extend these instead of replacing the framework. Current gaps: incomplete route metadata, raw titles without escaping, duplicate keywords, nonexistent SearchAction, empty initial bodies for most routes and game guides, arbitrary host canonicals, stale metadata after client navigation, successful responses for missing pages, a manually drifting sitemap, and all route components in the entry bundle.

## Work

- [x] Centralize canonical route policy, indexability, descriptive metadata and real redirects.
- [x] Serve meaningful initial HTML for public hubs and existing official game guides using current registry content; keep synthetic answer keys unlisted.
- [x] Generate sitemap from actual route/game/puzzle registries; keep llms.txt factual.
- [x] Keep title, description, canonical, social tags and structured data consistent during navigation.
- [x] Return HTTP 404 for missing pages and resources; server-side noindex for administrative/session surfaces.
- [x] Improve initial bundle loading and meaningful image accessibility; permit browser zoom.
- [x] Validate raw HTML and HTTP behavior, production build, internal sitemap links and local browser navigation.
- [x] Record verified results, remaining limits and commit/push.

No invented author credentials, dates, results, FAQs or search features. Existing gameplay and canonical game rules remain unchanged. Human ARC is independently built and remains a separate application. Search Console access, external link campaigns and production field performance are not assumed.

Primary references:
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies
