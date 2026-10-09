# Short public feedback address

Author: Codex
Date: 2026-10-08

Serve the existing dated report at `/feedback`, keeping one report source. Redirect the old report address permanently, preserve query strings and anchor navigation, and update canonical/social/share URLs and the Resource Hub link. Keep downloadable evidence under the dated directory with root-relative links so changing the report address cannot break them.

Validate GET/HEAD, trailing slash and old-link redirects, canonical metadata, and every report download through the production routing middleware. Build and verify the deployed short address.

The existing `/feedback` explanation-comments explorer moves to `/explanation-feedback`, with its navigation and metadata updated. Client-side navigation to `/feedback` loads the standalone document, matching direct requests. No comment data or API is changed.
