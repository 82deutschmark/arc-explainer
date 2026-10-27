# Publish approved games through the existing public arcade

Author: GPT-6 / Codex
Date: 2026-10-27

Approved by the user: fix the audited issues using what exists, make current Trainable games and existing ARC3 information searchable, then commit and push.

- Reuse the lab's `training_set` selection through a public metadata-only projection; keep research authentication and licensing exclusions.
- Reuse Arc3MirrorCatalog, Pyodide, thumbnails and telemetry. Add approved exact-version addresses and a verified source/PNG snapshot for availability; refresh approvals from the live feed.
- Make the existing gallery and Play entry choose the approved set, with real links, descriptive page metadata and game screenshots. Keep legacy bookmarks functional and unapproved pages unindexed.
- Render the existing ARC3 article from one shared component in both initial HTML and the browser. Render the approved catalog/game descriptions into initial HTML and sitemap.
- Correct the homepage's public/research split, preserve the existing synthetic landing route, redirect known production aliases and keep staging out of indexing.
- Verify approval projection, exact source hashes, game loading and action handling under Python 3.13, crawlable HTML, redirects, source routes and build. No browser publication checks, verdict writes or Railway credentials.

## Delivery and upkeep

The lab feed is on main in `0d26c65fd`; the isolated staging fix is on the existing `arc3` branch in `2923b610`.
The public manifest refreshes every five minutes. Approval removals (including an empty selection) replace the cached selection; outages retain the last verified snapshot. Each new approval uses its own source-hash URL. Legacy local games cannot overwrite those bytes. Source and PNG routes are same-origin on ARC Explainer.

To refresh the committed availability snapshot before a future deploy, run:

```sh
python3.13 scripts/arc3/sync_trainable_games.py
```

This uses the public application API only. It verifies the selection hash and every source hash, rejects the excluded parametric runtime, compiles each source, copies its actual PNG, and publishes the manifest only after all files are present. No credentials or lab reviewer data are needed. The live API remains authoritative after deploy; the snapshot is an outage fallback, not another approval list.

Validation: 48 games and 226 advertised actions pass through the existing worker-contract harness under Python 3.13. Production build and focused HTTP tests cover source bytes, screenshots, crawlable links, full article content, redirects, indexing policy and sitemap. TypeScript reports 12 pre-existing errors in unrelated SnakeBench, ingestion and streaming-test files, none in changed code. Publication completes at successful Git push, per the user's workflow.
