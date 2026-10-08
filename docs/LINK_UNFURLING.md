# Search metadata and link previews

Author: GPT-6.1 Sol / Codex
Updated: 2026-10-07

ARC Explainer uses its existing Express HTML injector for search and social previews. All visitors receive the same initial content; there is no bot-specific rendering. React replaces the initial summary or game guide with the interactive page.

## Sources of truth

- `shared/routes.ts`: static route descriptions and explicit noindex flags.
- `shared/seo.ts`: canonical origin, redirects, safe escaping, breadcrumb and schema policy.
- `server/services/seo/pageContent.ts`: initial public content from those routes and the existing game/puzzle registries; generated sitemap.
- `server/middleware/metaTagInjector.ts`: HTTP redirects, sitemap response, head/body serialization and page status.
- `client/src/components/RouteMetadata.tsx`: initializes from server metadata, then resets head state on navigation.
- `client/src/hooks/usePageMeta.ts`: common head writer, dynamic page refinements and legacy title-effect bridge.

Production order matters: API and Human ARC routes, `seoRouting`, static assets with `index: false`, then the metadata/page responder. `/index.html` redirects to `/`; static serving cannot bypass that canonicalization. The sitemap is dynamic and must not be restored as a separately maintained `client/public/sitemap.xml`.

## Adding a page

Register static pages in `ROUTE_META_TAGS`, give them accurate title/description, and set `noindex: true` for transient or administrative tools. Every indexable entry appears in the generated sitemap and resource-hub directory. Custom bodyHtml must describe content actually visible on the page, never keywords or stale result claims. A descriptive fallback is provided when no custom body exists.

For dynamic content, extend the resolver and URL policy with real existence validation and useful canonical content. Unknown official games and locally catalogued puzzle IDs return HTTP 404. Add route-coverage and HTTP tests when adding a new route family. Community play screens keep their existing API validation and remain noindex.

Use `usePageMeta` for dynamic page metadata and `setPageTitle` for older title-only effects; never assign `document.title` directly. Registered static pages keep server and client wording aligned. Do not add a second canonical, description, robots or JSON-LD script inside page components. Structured data must describe visible content; a search action is inappropriate unless the advertised search actually exists.

All head strings are ordinary unescaped prose; the serializer escapes them exactly once. JSON inside script tags escapes `<`. Shared image URLs are absolute; pages without a dedicated card use `/og-preview.png`, generated from the existing SVG. Recreate it with sharp after intentionally changing the SVG.

## Checks

Build the client, then run `npx vitest run tests/integration/seo.test.ts tests/metaTagInjector.test.ts`. Inspect raw HTTP HTML as well as browser navigation. Test both a deep direct URL and a client-side transition, including leaving a noindex route. See [the October audit](SEO-AUDIT-2026-10-07.md) for the measured results and explicit limits.
