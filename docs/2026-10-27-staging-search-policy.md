# Staging search policy

Author: GPT-6 / Codex
Date: 2026-10-27

The user approved fixing the public site's indexing issues and committing/pushing the repair.
The old `arc3` staging branch is deployed separately from main, so it needs its own early
response policy. Apply noindex/nofollow only to `arc-explainer-staging.up.railway.app`.
No login, game, production-host or deployment configuration changes are required.
