# ARC Daily Card Cabinet

Author: GPT-6.1 Sol / Codex · 29 October 2026

The Boss commissioned a permanent baseball-card-style collection for important individual
competitors and teams, using the artwork already commissioned and preserved. The Cabinet
lives at `/news/cards`, linked from every newspaper masthead.

The existing people and competitor ledgers remain identity authorities. `cards.json` assigns
stable collectible IDs/numbers and binds unchanged artwork to those identities, with dated
public snapshots. `card-results.json` starts empty; only explicit official results and credited
rosters can add final finishes, Kaggle medals and ARC Prize awards. Imports are idempotent;
corrections supersede earlier result records. The card renderer draws names and statistics
programmatically without altering the native illustration. Cards and PNG exports preserve
Japanese names, complete group images and explicit fictional-mascot distinctions.

The initial Cabinet contains 65 individual cards and 16 team cards. Nineteen additional
verified identities and twelve genuine own-account pictures fill gaps in the existing ledger.
Held feature manuscripts and all original artwork/provenance remain in their established
archives. No feature-release hold or social-send permission changes.

`TEAM_PLAYBOOK.md` is the durable reporting map. Six active Codex newsroom jobs and their
reviewed repository prompts reference it directly; the desk guides and fallback workflow link
to it too. Existing timing, models, project targets and job status remain configured.

Validation covers exact entry/handle joins, credited historical rosters, unknown/zero values,
public-versus-final honors, official result corrections, all registered art bindings, real HTTP
routes, PNG output, CJK text, original-byte preservation and private-data exclusion. Existing
news content tests, newsroom Python checks and the production build complete integration.
