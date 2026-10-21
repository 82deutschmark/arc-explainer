<!--
Author: Claude Opus 5.5
Date: 21-October-2026
PURPOSE: Plan for team-only ARC-AGI-2 eval runs with per-output reasoning traces on ARC Explainer
  (Son's ask, 21-Oct-2026): our model-evaluation box runs, readable output by output so the team
  can see where the model goes wrong. Built beside the Kaggle runs record (/team/arc2-runs).
SRP/DRY check: Pass - plan only. Reuses the team sign-in, the runs record's terminal look and
  data helpers, the site's TinyGrid, and the Postgres document pattern of team_run_documents.
-->

# ARC-AGI-2 eval runs and reasoning traces (plan, 21-Oct-2026)

## Scope

In: storage, upload routes for the eval box, team-only read routes, a runs list page, a run page
with an outputs table and the selected output's trace (grids, expected vs answer, final text,
reasoning with find), a link from the Kaggle runs page, tests.

Out: the publisher on the eval box (it sends the documents below), any public page, Kaggle
submissions (still /team/arc2-runs), editing anything from the site.

## Data

- `team_eval_runs (competition, run_key, body TEXT, updated_at)`, one JSON document per run:
  title, createdAt, model, panel, box, client, summary, reference lines, notes, and one row per
  output (finish, tokens, parsed, correct, cells wrong, reference solved/runs, hasTrace).
- `team_eval_traces (competition, run_key, output_key, body TEXT, updated_at)`, one JSON document
  per output: train pairs, test input, expected, answer, final content, reasoning.
- Competition is `arc-2`. Bodies are stored and served verbatim; unknown fields pass through.
- Created at boot in `DatabaseSchema.initialize` with the other tables.

## API (mounted at /api/team)

Machine, header `X-ARC2-Eval-Token` = env `ARC2_EVAL_UPLOAD_TOKEN` (its own secret, at least 32
characters; 503 `eval_uploads_not_configured` when unset or short, 401 when wrong), 600 writes an
hour per address:

- `PUT /arc2-evals/machine/runs/:key` (key `^[a-z0-9][a-z0-9._-]{0,99}$`; body.key = key, rows an
  array; max 4 MB)
- `PUT /arc2-evals/machine/runs/:key/traces/:output` (output `^[0-9a-f]{8}_[0-9]{1,2}$`; body.key and
  body.outputKey match; max 3 MB; 404 until the run exists)
- `DELETE /arc2-evals/machine/runs/:key` (run and traces; returns whether it existed)

Team (sign-in cookie): `GET /arc2-evals` (index fields, newest first), `GET /arc2-evals/:key`,
`GET /arc2-evals/:key/traces/:output`.

Re-publishing a run with fewer outputs leaves the old traces; the publisher deletes first when it
renames or drops outputs.

## Architecture

- Server: `middleware/arc2EvalToken.ts`, `repositories/TeamEvalRepository.ts`,
  `routes/teamEvals.ts`, tables in `DatabaseSchema.ts`, mount in `routes.ts`.
- Client: `components/teamEvals/` (data `teamEvalsApi.ts` over teamRunsApi's `call`, figures
  `evalStats.ts`, `EvalGrid.tsx` over TinyGrid, `ReasoningView.tsx`, `Chips.tsx`),
  pages `pages/team/Arc2Evals.tsx` and `Arc2Eval.tsx`, lazy routes in `App.tsx`, noindex meta in
  `shared/routes.ts`.
- Long reasoning renders as one text node; a search splits it on the matches only (capped at
  2000), so a 65k-token trace does not stall the page.
- The selected output is in the address (`?o=`); the sign-in return path now keeps that query.

## TODOs

1. Tables, repository, token middleware, routes, mount.
2. Data module, pure figures, grid and reasoning components, pages, routes, meta, link.
3. Tests: key and document checks, token (unset, short, wrong, right), route order without a
   database, sign-in return path, filters, sort, wrong cells, find.
4. Typecheck (server and client configs) and vitest.
5. CHANGELOG entry.

## Deploy

Set `ARC2_EVAL_UPLOAD_TOKEN` (32+ random characters) on Railway and give the same value to the
eval box. Tables appear on the next boot.
