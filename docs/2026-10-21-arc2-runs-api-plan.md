# 2026-10-21 ARC-2 runs API plan (all internal run kinds)

Author: Claude Opus 5.5 · Ask: Son, 21-Oct-2026

## Scope

In: one documented, versioned API for publishing every internal ARC-AGI-2 run to the team pages, not only
accuracy runs with traces. Run kinds: `accuracy` (a panel scored output by output, with traces), `speed`
(serving A/Bs: tok/s windows, lanes, KV pool, step ms), `kernel` (kernel benches), `profile` (per-family GPU time
per decode step). The team pages list all kinds and show speed / kernel / profile runs as a table of arms side by
side. A stdlib-only Python client and its doc live in Jack's repo (`tools/arc2runs/`, `docs/RUNS_API.md`).

Out: new tables, new tokens or new sign-in; charts; uploading torch-profiler traces (they stay with the box
download, linked from the run).

## Architecture

- Reuse the eval-runs store as it is (`team_eval_runs`, `team_eval_traces`, `TeamEvalRepository`): a run is one
  JSON document whatever its kind; traces stay per output and accuracy-only. Nothing is deployed yet, so there
  is no data to migrate.
- `server/routes/teamEvals.ts`: the run document gains `apiVersion: 2` and `kind`. Version 1 documents (no kind)
  are still accepted as accuracy runs. Checks per kind: accuracy needs `rows`; the others need `arms` (1-64,
  each a unique `name`, `metrics` numbers or null, `status` ok / failed / skipped). New token-guarded
  `GET /arc2-evals/machine/schema` so a client can check its token and the versions the site takes without
  writing anything. The PUT reply names the kind and the page.
- `TeamEvalRepository.listRuns`: the index adds kind, author, box, verdict, headline metric and each arm's name,
  status and metrics (small); still never the per-output rows.
- Client: `teamEvalsApi.ts` types for v2; `Arc2Evals.tsx` lists accuracy runs as now and the other kinds in a
  second table (kind, arms with their headline metric, box cost); `Arc2Eval.tsx` renders non-accuracy runs with a
  new `components/teamEvals/ArmsTable.tsx` (metrics as rows, arms as columns, best per row marked, ratio to the
  baseline arm; per-family profile ms the same way; failed arms show their error).

## TODOs

1. Server: version and kind checks, schema route, index fields. Tests in `tests/teamEvals.test.ts`.
2. Client types, list page second table, arms view on the run page.
3. Jack's repo: `tools/arc2runs/arc2runs.py` (stdlib client + CLI: check, validate, publish, delete) and
   `docs/RUNS_API.md` (the schema, metric names, examples).
4. Son's jobs: `publish_evals.py` emits v2 and sends through the client; an fnx adapter publishes any fnx job
   download (`<phase>/summary.json` per arm) as a speed / kernel / profile run.
5. Verify: vitest, tsc, a local server run with a real document of each kind; dry-run documents for today's
   runs. Production steps (push, PR, Railway variable, deploy, real uploads) wait for Son.

## Docs / changelog

`CHANGELOG.md` top entry; this plan; `docs/RUNS_API.md` in Jack's repo is the API's reference.
